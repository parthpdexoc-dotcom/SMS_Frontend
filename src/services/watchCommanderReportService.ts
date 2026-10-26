import { apiGet } from '@/utils/apiClient';
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants/tablePagination';
import { expectOkReadText, getErrorMessageFromErrorResponse, parsePagedListJson } from '@/services/textPlainJson';
import { downloadExcelFileFromResponse } from '@/utils/excelFileDownload';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';
import type { PageParam } from '@/types/common';
import type { WatchCommanderReportRowDto } from '@/types/watchCommanderReportRowDto';

/** Backend: `GetWatchCommanderReportAsync` → `[HttpGet("watch-commander-report")]` on `Report`. */
const WATCH_COMMANDER_REPORT_ENDPOINT = '/Report/watch-commander-report';

/** Query name from `[FromQuery(Name = "isgeneratereport")]`. */
const IS_GENERATE_REPORT_QUERY = 'isgeneratereport';

export interface GetWatchCommanderReportParams {
  startDate?: string;
  endDate?: string;
  numberOfDays?: number;
  searchTerm?: string;
  pagination?: PageParam;
}

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

function vehicleField(raw: Record<string, unknown>): boolean | string | undefined {
  const v = pick(raw, 'vehicle', 'Vehicle');
  if (v === null || v === undefined) return undefined;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v;
  return undefined;
}

export function normalizeWatchCommanderReportRow(raw: Record<string, unknown>): WatchCommanderReportRowDto {
  return {
    startDate: str(raw, 'startDate', 'StartDate'),
    employeeName: str(raw, 'employeeName', 'EmployeeName'),
    payroll: str(raw, 'payroll', 'Payroll'),
    callSign: str(raw, 'callSign', 'CallSign'),
    employeeType: str(raw, 'employeeType', 'EmployeeType'),
    startTime: str(raw, 'startTime', 'StartTime'),
    hoursWorked: num(raw, 'hoursWorked', 'HoursWorked'),
    endTime: str(raw, 'endTime', 'EndTime'),
    requester: str(raw, 'requester', 'Requester'),
    requesterAddress: str(raw, 'requesterAddress', 'RequesterAddress'),
    vehicle: vehicleField(raw),
  };
}

function appendWatchCommanderFilters(queryParams: URLSearchParams, params?: GetWatchCommanderReportParams): void {
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
  if (params.searchTerm?.trim()) {
    queryParams.append('searchTerm', params.searchTerm.trim());
  }
}

function defaultWatchCommanderFileName(): string {
  return `watch-commander-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
}

/** Paged JSON when `isgeneratereport` is false / omitted. */
export async function getWatchCommanderReportRows(
  params?: GetWatchCommanderReportParams
): Promise<{ data: WatchCommanderReportRowDto[]; totalRecords: number }> {
  const queryParams = new URLSearchParams();
  appendWatchCommanderFilters(queryParams, params);
  const p = buildPaginationQueryParams({
    page: params?.pagination?.page ?? 1,
    pageSize: params?.pagination?.pageSize ?? DEFAULT_TABLE_PAGE_SIZE,
  });
  p.forEach((value, key) => {
    queryParams.append(key, value);
  });

  const qs = queryParams.toString();
  const endpoint = qs ? `${WATCH_COMMANDER_REPORT_ENDPOINT}?${qs}` : WATCH_COMMANDER_REPORT_ENDPOINT;

  const response = await apiGet(endpoint);
  const responseText = await expectOkReadText(response, 'Failed to fetch watch commander report');
  return parsePagedListJson(responseText, (row) => normalizeWatchCommanderReportRow(row as Record<string, unknown>));
}

/** Excel export when `isgeneratereport=true`. */
export async function downloadWatchCommanderReportExcel(
  params?: Omit<GetWatchCommanderReportParams, 'pagination'>
): Promise<void> {
  const queryParams = new URLSearchParams();
  appendWatchCommanderFilters(queryParams, params);
  queryParams.append(IS_GENERATE_REPORT_QUERY, 'true');

  const qs = queryParams.toString();
  const endpoint = `${WATCH_COMMANDER_REPORT_ENDPOINT}?${qs}`;

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
    defaultWatchCommanderFileName(),
    'Failed to download report'
  );
}
