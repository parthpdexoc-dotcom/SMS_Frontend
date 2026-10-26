import { apiGet, apiPost, apiDelete } from '@/utils/apiClient';
import { expectOkReadText, parseJsonText, parsePagedListDto, readPagedListArray, readPagedListTotal, readResponseOk } from '@/services/textPlainJson';
import type { RequestScheduleDto } from '@/types/request';
import { extractYyyyMmDdPrefix, formatHhMmToApiTimeOnly, formatTimeToHHmm } from '@/utils/dateTimeUtils';
import { buildPaginationQueryParams, type PaginationParams } from '@/utils/paginationUtils';

const BASE = '/RequestSchedule';

export interface RequestScheduleListParams {
  requestId: string;
  startDate?: string;
  endDate?: string;
  releaseAs?: number[];
  requestStatus?: number[];
  pagination?: PaginationParams;
}

/** GET `/RequestSchedule/by-request/{requestId}` */
export const getRequestSchedulesByRequestId = async (
  params: RequestScheduleListParams
): Promise<{
  data: RequestScheduleDto[];
  totalRecords: number;
}> => {
  const query = buildPaginationQueryParams(params.pagination);
  const startDate = params.startDate?.trim();
  const endDate = params.endDate?.trim();
  if (startDate) query.set('startDate', startDate);
  if (endDate) query.set('endDate', endDate);
  params.releaseAs?.forEach((value) => query.append('releaseAs', String(value)));
  params.requestStatus?.forEach((value) => query.append('requestStatus', String(value)));
  const queryString = query.toString();
  const endpoint = `${BASE}/by-request/${encodeURIComponent(params.requestId)}${queryString ? `?${queryString}` : ''}`;
  const response = await apiGet(endpoint);
  const responseText = await expectOkReadText(response, 'Failed to fetch request schedules');
  const parsed = parseJsonText<unknown>(responseText, 'Failed to fetch request schedules');
  if (Array.isArray(parsed)) {
    const data = parsed as RequestScheduleDto[];
    return { data, totalRecords: data.length };
  }
  const record = (parsed ?? {}) as Record<string, unknown>;
  const direct = record.data ?? record.Data;
  const data = (Array.isArray(direct) ? direct : readPagedListArray(record)) as RequestScheduleDto[];
  return {
    data,
    totalRecords: readPagedListTotal(record, data.length),
  };
};

export const upsertRequestSchedule = async (payload: RequestScheduleDto): Promise<RequestScheduleDto> => {
  const response = await apiPost(BASE, payload, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
  const responseText = await readResponseOk(response, 'Failed to save request schedule');
  return parseJsonText<RequestScheduleDto>(responseText);
};

export interface GenerateRequestScheduleRequest {
  requestId: string;
  /** Current request end date. Posted only when it differs from the last generation. */
  endDate?: string | null;
  /** Current request type. Posted only when it differs from the last generation. */
  requestType?: number | string | null;
  daysOfWeek?: number[];
  daysOfMonth?: number[];
  monthlyMode?: number;
  weekIndex?: number;
  /** HH:mm or HH:mm:ss. Posted only when it differs from the last generation. */
  scheduledTime?: string | null;
  /** Tenure Available for hours (1, 24, 48, 72). */
  releaseHours?: number | null;
}

/** POST `/RequestSchedule/generate`. Body contains requestId plus only changed generate fields. */
export const generateRequestSchedules = async (
  input: GenerateRequestScheduleRequest
): Promise<RequestScheduleDto> => {
  const previous = await getRequestScheduleGenerationByRequestId(input.requestId).catch(() => null);
  const response = await apiPost(`${BASE}/generate`, toChangedGeneratePayload(input, previous), {
    headers: {
      'Content-Type': 'application/json',
    },
  });
  const responseText = await readResponseOk(response, 'Failed to generate request schedules');
  return parseJsonText<RequestScheduleDto>(responseText);
};

function toChangedGeneratePayload(
  input: GenerateRequestScheduleRequest,
  previous: RequestScheduleGenerationRecord | null
): GenerateRequestScheduleRequest {
  const modalPattern: GenerateRequestScheduleRequest = { requestId: input.requestId };
  if (input.daysOfWeek) modalPattern.daysOfWeek = input.daysOfWeek;
  if (input.daysOfMonth) modalPattern.daysOfMonth = input.daysOfMonth;
  if (input.monthlyMode != null) modalPattern.monthlyMode = input.monthlyMode;
  if (input.weekIndex != null) modalPattern.weekIndex = input.weekIndex;
  const time = formatHhMmToApiTimeOnly(input.scheduledTime);
  if (time) modalPattern.scheduledTime = time;
  if (input.releaseHours != null) modalPattern.releaseHours = input.releaseHours;
  if (!previous) return modalPattern;

  const body: GenerateRequestScheduleRequest = { requestId: input.requestId };
  const endDate = extractYyyyMmDdPrefix(input.endDate);
  const previousEnd = extractYyyyMmDdPrefix(previous.requestEndDate);
  if (endDate && previousEnd && endDate !== previousEnd) body.endDate = endDate;

  const requestType = asNumber(input.requestType);
  if (requestType != null && previous.requestType != null && requestType !== previous.requestType)
    body.requestType = requestType;

  const typeChanged = body.requestType != null;
  const daysChanged = input.daysOfWeek != null && !sameDays(input.daysOfWeek, previous.releaseBeforeDaysOfWeek);
  const monthDaysChanged =
    input.daysOfMonth != null && !sameDays(input.daysOfMonth, previous.releaseBeforeDaysOfMonth);
  const modeChanged = input.monthlyMode != null && input.monthlyMode !== asNumber(previous.releaseBeforeMonthlyMode);
  const weekChanged = input.weekIndex != null && input.weekIndex !== previous.releaseBeforeWeekIndex;
  if (typeChanged || daysChanged || monthDaysChanged || modeChanged || weekChanged) {
    if (input.daysOfWeek) body.daysOfWeek = input.daysOfWeek;
    if (input.daysOfMonth) body.daysOfMonth = input.daysOfMonth;
    if (input.monthlyMode != null) body.monthlyMode = input.monthlyMode;
    if (input.weekIndex != null) body.weekIndex = input.weekIndex;
  }

  if (time && !sameTime(time, previous.scheduledTime)) body.scheduledTime = time;
  if (input.releaseHours != null) body.releaseHours = input.releaseHours;
  return body;
}

function sameDays(left?: number[] | null, right?: number[] | null): boolean {
  const a = left ?? [];
  const b = right ?? [];
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function sameTime(left?: string | null, right?: string | null): boolean {
  return (formatTimeToHHmm(left) || '') === (formatTimeToHHmm(right) || '');
}

function asNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

export interface RequestScheduleGenerationRecord {
  requestType?: number | null;
  requestEndDate?: string | null;
  releaseBeforeDaysOfWeek?: number[] | null;
  releaseBeforeDaysOfMonth?: number[] | null;
  releaseBeforeMonthlyMode?: number | string | null;
  releaseBeforeWeekIndex?: number | null;
  scheduledTime?: string | null;
}

/** Latest generation row for a request. One row is kept and updated. */
export const getRequestScheduleGenerationByRequestId = async (
  requestId: string
): Promise<RequestScheduleGenerationRecord | null> => {
  const query = buildPaginationQueryParams({
    page: 1,
    pageSize: 1,
    sortBy: 'CreatedDate',
    sortDirection: 'desc',
  });
  const response = await apiGet(
    `/RequestScheduleGeneration/by-request/${encodeURIComponent(requestId)}?${query.toString()}`
  );
  const responseText = await expectOkReadText(response, 'Failed to fetch schedule generation');
  const page = parsePagedListDto<Record<string, unknown>>(responseText);
  const raw = page.data[0];
  if (!raw) return null;
  const daysOfWeek = raw.releaseBeforeDaysOfWeek ?? raw.ReleaseBeforeDaysOfWeek;
  const daysOfMonth = raw.releaseBeforeDaysOfMonth ?? raw.ReleaseBeforeDaysOfMonth;
  const time = raw.scheduledTime ?? raw.ScheduledTime;
  const requestType = raw.requestType ?? raw.RequestType;
  const requestEndDate = raw.requestEndDate ?? raw.RequestEndDate;
  return {
    requestType: asNumber(requestType as number | string | null | undefined),
    requestEndDate: requestEndDate == null ? null : String(requestEndDate),
    releaseBeforeDaysOfWeek: Array.isArray(daysOfWeek) ? daysOfWeek.map(Number) : [],
    releaseBeforeDaysOfMonth: Array.isArray(daysOfMonth) ? daysOfMonth.map(Number) : [],
    releaseBeforeMonthlyMode: (raw.releaseBeforeMonthlyMode ?? raw.ReleaseBeforeMonthlyMode) as
      | number
      | string
      | null,
    releaseBeforeWeekIndex: Number(raw.releaseBeforeWeekIndex ?? raw.ReleaseBeforeWeekIndex ?? 0) || null,
    scheduledTime: time == null ? null : String(time),
  };
};

export const deleteRequestSchedule = async (requestScheduleId: string): Promise<void> => {
  const response = await apiDelete(`${BASE}/${encodeURIComponent(requestScheduleId)}`, {
    headers: { accept: '*/*' },
  });
  await readResponseOk(response, 'Failed to delete request schedule');
};

