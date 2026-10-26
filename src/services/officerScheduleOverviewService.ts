import { apiGet } from '@/utils/apiClient';
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants/tablePagination';
import { expectOkReadText, parsePagedListJson } from '@/services/textPlainJson';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';
import type { PageParam } from '@/types/common';
import {
  OfficerScheduleStatus,
  type OfficerScheduledAssignmentDto,
} from '@/types/officerScheduledAssignmentDto';

const OFFICER_SCHEDULE_OVERVIEW_ENDPOINT = '/PostPosition/officer-schedule-overview';

export interface GetOfficerScheduleOverviewParams {
  searchTerm?: string;
  pagination?: PageParam;
}

export async function getOfficerScheduleOverview(
  params?: GetOfficerScheduleOverviewParams
): Promise<{
  data: OfficerScheduledAssignmentDto[];
  totalRecords: number;
}> {
  const queryParams = new URLSearchParams();
  if (params?.searchTerm?.trim()) {
    queryParams.append('searchTerm', params.searchTerm.trim());
  }
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
  const endpoint = qs ? `${OFFICER_SCHEDULE_OVERVIEW_ENDPOINT}?${qs}` : OFFICER_SCHEDULE_OVERVIEW_ENDPOINT;
  const response = await apiGet(endpoint);
  const text = await expectOkReadText(response, 'Failed to fetch officer schedule overview');
  return parsePagedListJson(text, normalizeOfficerScheduledAssignmentRow);
}

const str = (raw: Record<string, unknown>, ...keys: string[]): string | null => {
  for (const key of keys) {
    const value = raw[key];
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return null;
};

const num = (raw: Record<string, unknown>, ...keys: string[]): number | null => {
  for (const key of keys) {
    const value = raw[key];
    if (value !== null && value !== undefined && !Number.isNaN(Number(value))) {
      return Number(value);
    }
  }
  return null;
};

function normalizeOfficerScheduledAssignmentRow(
  row: Record<string, unknown>
): OfficerScheduledAssignmentDto {
  const statusRaw = row.status ?? row.Status;
  const statusNum = Number(statusRaw);
  const status =
    statusNum === OfficerScheduleStatus.RecentlyEnded ||
    statusNum === OfficerScheduleStatus.CurrentlyWorking ||
    statusNum === OfficerScheduleStatus.Upcoming
      ? statusNum
      : OfficerScheduleStatus.Upcoming;

  return {
    employeeName: str(row, 'employeeName', 'EmployeeName'),
    payroll: str(row, 'employeeNumber', 'EmployeeNumber', 'payroll', 'Payroll'),
    employeeType: str(row, 'employeeType', 'EmployeeType'),
    jobTitle:
      str(row, 'jobTitle', 'JobTitle', 'jobName', 'JobName') ?? str(row, 'post', 'Post'),
    post: str(row, 'post', 'Post'),
    dateOfWork: str(row, 'dateOfWork', 'DateOfWork'),
    startTime: str(row, 'startTime', 'StartTime'),
    endTime: str(row, 'endTime', 'EndTime'),
    callSign: str(row, 'callSign', 'CallSign'),
    hoursWorked: num(row, 'hoursWorked', 'HoursWorked'),
    status,
  };
}
