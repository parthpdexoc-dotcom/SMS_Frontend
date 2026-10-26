import { apiGet } from '@/utils/apiClient';
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants/tablePagination';
import { expectOkReadText, getErrorMessageFromErrorResponse, parsePagedListJson } from '@/services/textPlainJson';
import { downloadExcelFileFromResponse } from '@/utils/excelFileDownload';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';
import type { PageParam } from '@/types/common';
import type { ReportRowDto } from '@/types/reportRowDto';

/** Backend route: `[HttpGet("archived-report")]` on the report controller (default `Report` → `/Report/archived-report`). */
const ARCHIVED_REPORT_ENDPOINT = '/Report/archived-report';

/** Same Excel toggle as watch-commander: `[FromQuery(Name = "isgeneratereport")]`. */
const IS_GENERATE_REPORT_QUERY = 'isgeneratereport';

function pick(raw: Record<string, unknown>, camel: string, pascal: string): unknown {
  return raw[camel] ?? raw[pascal];
}

function str(raw: Record<string, unknown>, camel: string, pascal: string): string | undefined {
  const v = pick(raw, camel, pascal);
  if (v === null || v === undefined) return undefined;
  return String(v);
}

function num(raw: Record<string, unknown>, camel: string, pascal: string): number | undefined {
  const v = pick(raw, camel, pascal);
  if (v === null || v === undefined) return undefined;
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : undefined;
}

function bool(raw: Record<string, unknown>, camel: string, pascal: string): boolean | undefined {
  const v = pick(raw, camel, pascal);
  if (v === null || v === undefined) return undefined;
  if (typeof v === 'boolean') return v;
  if (v === 'true' || v === 1) return true;
  if (v === 'false' || v === 0) return false;
  return undefined;
}

/** First defined non-null value from ordered (camel, pascal) pairs (API renames + legacy payloads). */
function strCoalesce(raw: Record<string, unknown>, pairs: [string, string][]): string | undefined {
  for (const [camel, pascal] of pairs) {
    const v = pick(raw, camel, pascal);
    if (v !== null && v !== undefined) return String(v);
  }
  return undefined;
}

export function normalizeReportRowDto(raw: Record<string, unknown>): ReportRowDto {
  return {
    employeeCode: strCoalesce(raw, [
      ['employeeCode', 'EmployeeCode'],
      ['employeeNumber', 'EmployeeNumber'],
    ]),
    employeeName: str(raw, 'employeeName', 'EmployeeName'),
    payroll: str(raw, 'payroll', 'Payroll'),
    pvt: str(raw, 'pvt', 'Pvt'),
    requestCode: strCoalesce(raw, [
      ['requestCode', 'RequestCode'],
      ['requestId', 'RequestId'],
    ]),
    postCode: strCoalesce(raw, [
      ['postCode', 'PostCode'],
      ['postId', 'PostId'],
    ]),
    hoursWorked: num(raw, 'hoursWorked', 'HoursWorked'),
    postDay: str(raw, 'postDay', 'PostDay'),
    payCode: str(raw, 'payCode', 'PayCode'),
    comments: str(raw, 'comments', 'Comments'),
    requesterName: str(raw, 'requesterName', 'RequesterName'),
    requesterAddress: str(raw, 'requesterAddress', 'RequesterAddress'),
    startTime: str(raw, 'startTime', 'StartTime'),
    hoursRequired: num(raw, 'hoursRequired', 'HoursRequired'),
    responseArea: str(raw, 'responseArea', 'ResponseArea'),
    requestAddress: str(raw, 'requestAddress', 'RequestAddress'),
    callSign: str(raw, 'callSign', 'CallSign'),
    vehicle: (() => {
      const v = pick(raw, 'vehicle', 'Vehicle');
      if (v === null || v === undefined) return undefined;
      if (typeof v === 'boolean') return v ? 'Yes' : 'No';
      return String(v);
    })(),
    onDuty: bool(raw, 'onDuty', 'OnDuty'),
    postFor: str(raw, 'postFor', 'PostFor'),
    postPayRate: num(raw, 'postPayRate', 'PostPayRate'),
    empHrlyRate: num(raw, 'empHrlyRate', 'EmpHrlyRate'),
    ldrPc116: num(raw, 'ldrPc116', 'LdrPc116'),
    ldrPc103: num(raw, 'ldrPc103', 'LdrPc103'),
    ldrPc102: num(raw, 'ldrPc102', 'LdrPc102'),
    pc102: num(raw, 'pc102', 'Pc102'),
    pc102At125: num(raw, 'pc102At125', 'Pc102At125'),
    pc102Rate: num(raw, 'pc102Rate', 'Pc102Rate'),
    vehicleNumber: str(raw, 'vehicleNumber', 'VehicleNumber'),
    vehicleHrs: num(raw, 'vehicleHrs', 'VehicleHrs'),
    requestName: str(raw, 'requestName', 'RequestName'),
    agency: str(raw, 'agency', 'Agency'),
    closedBy: str(raw, 'closedBy', 'ClosedBy'),
    ptaeo: str(raw,'ptaeo', 'Ptaeo',),
    invoice: (() => {
      const v =
        pick(raw, 'invoice', 'Invoice') ??
        pick(raw, 'isInvoice', 'IsInvoice') ??
        pick(raw, 'isInvoiced', 'IsInvoiced');
      if (v === null || v === undefined) return undefined;
      if (typeof v === 'boolean') return v ? 'Yes' : 'No';
      return String(v);
    })(),
    isPlaceholder: (() => {
      const v = pick(raw, 'isPlaceholder', 'IsPlaceholder');
      if (v === null || v === undefined) return undefined;
      if (typeof v === 'boolean') return v ? 'Yes' : 'No';
      return String(v);
    })(),
    isClosed: (() => {
      const v = pick(raw, 'isClosed', 'IsClosed');
      if (v === null || v === undefined) return undefined;
      if (typeof v === 'boolean') return v ? 'Yes' : 'No';
      return String(v);
    })(),
    vehicleClosedHours: num(raw, 'vehicleClosedHours', 'VehicleClosedHours'),
    personalRank: str(raw, 'personalRank', 'PersonalRank'),
    shiftRank: str(raw, 'shiftRank', 'ShiftRank'),
  };
}

export interface GetArchivedReportRowsParams {
  startDate?: string;
  endDate?: string;
  numberOfDays?: number;
  /** Optional filter when the API supports it. */
  postId?: string;
  searchTerm?: string;
  isPlaceholder?: boolean;
  pagination?: PageParam;
}

function appendArchivedReportFilters(queryParams: URLSearchParams, params?: GetArchivedReportRowsParams): void {
  if (!params) return;
  if (params.startDate?.trim()) {
    queryParams.append('startDate', params.startDate.trim());
  }
  if (params.endDate?.trim()) {
    queryParams.append('endDate', params.endDate.trim());
  }
  if (params.numberOfDays != null && Number.isFinite(params.numberOfDays)) {
    queryParams.append('numberOfDays', String(Math.trunc(params.numberOfDays)));
  }
  if (params.postId?.trim()) {
    queryParams.append('postId', params.postId.trim());
  }
  if (params.searchTerm?.trim()) {
    queryParams.append('searchTerm', params.searchTerm.trim());
  }
  if (params.isPlaceholder != null) {
    queryParams.append('isPlaceholder', String(params.isPlaceholder));
  }
}

/** Paged JSON rows (`isgeneratereport` omitted / false). */
export async function getArchivedReportRows(
  params?: GetArchivedReportRowsParams
): Promise<{ data: ReportRowDto[]; totalRecords: number }> {
  const queryParams = new URLSearchParams();
  appendArchivedReportFilters(queryParams, params);
  const p = buildPaginationQueryParams({
    page: params?.pagination?.page ?? 1,
    pageSize: params?.pagination?.pageSize ?? DEFAULT_TABLE_PAGE_SIZE,
    sortBy: params?.pagination?.sortBy,
    sortDirection: params?.pagination?.sortDirection,
  });
  p.forEach((value, key) => {
    queryParams.append(key, value);
  });

  const qs = queryParams.toString();
  const endpoint = qs ? `${ARCHIVED_REPORT_ENDPOINT}?${qs}` : ARCHIVED_REPORT_ENDPOINT;

  const response = await apiGet(endpoint);
  const responseText = await expectOkReadText(response, 'Failed to fetch archived report');
  return parsePagedListJson(responseText, (row) => normalizeReportRowDto(row as Record<string, unknown>));
}

function defaultArchivedReportFileName(): string {
  return `archived-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
}

/**
 * Full export: `isgeneratereport=true`. Backend returns an Excel file stream (not JSON).
 */
export async function downloadArchivedReportExcel(params?: Omit<GetArchivedReportRowsParams, 'pagination'>): Promise<void> {
  const queryParams = new URLSearchParams();
  appendArchivedReportFilters(queryParams, params);
  queryParams.append(IS_GENERATE_REPORT_QUERY, 'true');

  const qs = queryParams.toString();
  const endpoint = `${ARCHIVED_REPORT_ENDPOINT}?${qs}`;

  const response = await apiGet(endpoint, {
    headers: { accept: '*/*' },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      getErrorMessageFromErrorResponse(text, `Failed to download report (${response.status})`)
    );
  }

  await downloadExcelFileFromResponse(
    response,
    defaultArchivedReportFileName(),
    'Failed to download report'
  );
}
