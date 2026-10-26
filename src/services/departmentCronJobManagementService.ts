import { apiGet, apiPost } from '@/utils/apiClient';
import { expectOkReadText, parseJsonText, parseJsonTextArray } from '@/services/textPlainJson';
import {
  type DepartmentCronJobTypeOptionDto,
  type DepartmentCronScheduleDto,
  type DepartmentCronScheduleUpsertDto,
} from '@/types/departmentCronSchedule';

const BASE = '/DepartmentCronJobManagement';

export const getDepartmentCronSchedules = async (
  departmentId: string
): Promise<DepartmentCronScheduleDto[]> => {
  const response = await apiGet(`${BASE}/department/${departmentId}/schedules`);
  const text = await expectOkReadText(response, 'Failed to load cron schedules');
  return parseJsonTextArray<DepartmentCronScheduleDto>(text);
};

export const getUnconfiguredDepartmentCronJobTypes = async (
  departmentId: string
): Promise<DepartmentCronJobTypeOptionDto[]> => {
  const response = await apiGet(`${BASE}/department/${departmentId}/unconfigured-job-types`);
  const text = await expectOkReadText(response, 'Failed to load unconfigured job types');
  return parseJsonTextArray<DepartmentCronJobTypeOptionDto>(text);
};

export const upsertDepartmentCronSchedule = async (
  payload: DepartmentCronScheduleUpsertDto
): Promise<DepartmentCronScheduleDto> => {
  const response = await apiPost(`${BASE}/upsert`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });
  const text = await expectOkReadText(response, 'Failed to save schedule');
  return parseJsonText<DepartmentCronScheduleDto>(text);
};
