/**
 * Department Configuration API Service
 * Backend: GET {id} = DeptConfigID, GET (no id) = get all with pagination, POST = upsert, PUT {id} = update by DeptConfigID.
 */

import { apiDelete, apiGet, apiPost, apiPut } from '@/utils/apiClient';
import { DepartmentConfigurationResponse } from '@/types/departmentConfiguration';
import { expectOkReadText, parseJsonText, parseJsonTextArray } from '@/services/textPlainJson';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';

const BASE = '/DepartmentConfiguration';

/** Reads EnableGenerateRequestSchedule from the department configuration API (camelCase or PascalCase). */
export function isGenerateRequestScheduleEnabled(
  config: DepartmentConfigurationResponse | null | undefined
): boolean {
  if (!config) return false;
  const raw = config as unknown as Record<string, unknown>;
  const value = raw.enableGenerateRequestSchedule ?? raw.EnableGenerateRequestSchedule;
  return value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true';
}

/**
 * Gets a department configuration by DepartmentID.
 * GET /DepartmentConfiguration/department/{departmentId}
 * Returns null if not found (404).
 */
export const getByDepartmentId = async (
  departmentId: string
): Promise<DepartmentConfigurationResponse | null> => {
  try {
    const response = await apiGet(`${BASE}/department/${departmentId}`);
    const text = await expectOkReadText(response, 'Failed to fetch department configuration');
    return parseJsonText<DepartmentConfigurationResponse>(text);
  } catch (err) {
    if (err instanceof Error && (err.message.includes('404') || err.message.includes('Not Found'))) {
      return null;
    }
    console.error('Error fetching department configuration by departmentId:', err);
    throw err;
  }
};

/**
 * Gets the department configuration for the given department ID.
 * Uses GET /DepartmentConfiguration (get all with pagination) and finds the item matching departmentID.
 * Returns null if none found (create mode).
 */
export const getDepartmentConfigurationByDepartmentId = async (
  departmentId: string
): Promise<DepartmentConfigurationResponse | null> => {
  try {
    const queryParams = buildPaginationQueryParams({ page: 1, pageSize: 500 });
    const response = await apiGet(`${BASE}?${queryParams.toString()}`);
    const text = await expectOkReadText(response, 'Failed to fetch department configurations');
    const items = parseJsonTextArray<DepartmentConfigurationResponse>(text);
    const match = items.find((item) => {
      const raw = item as unknown as Record<string, unknown>;
      const deptId = raw.departmentID ?? raw.DepartmentID;
      return String(deptId ?? '') === departmentId;
    });
    return match ?? null;
  } catch (err) {
    if (err instanceof Error && (err.message.includes('404') || err.message.includes('Not Found'))) {
      return null;
    }
    console.error('Error fetching department configuration:', err);
    throw err;
  }
};

export const createDepartmentConfiguration = async (
  payload: DepartmentConfigurationResponse
): Promise<DepartmentConfigurationResponse> => {
  const response = await apiPost(BASE, payload, {
    headers: { 'Content-Type': 'application/json' },
  });
  const text = await expectOkReadText(response, 'Failed to create department configuration');
  return parseJsonText<DepartmentConfigurationResponse>(text);
};

// FIX: Parameter is DeptConfigID, not DepartmentID
export const updateDepartmentConfiguration = async (
  deptConfigId: string,
  payload: DepartmentConfigurationResponse
): Promise<DepartmentConfigurationResponse> => {
  const response = await apiPut(`${BASE}/${deptConfigId}`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });
  const text = await expectOkReadText(response, 'Failed to update department configuration');
  return parseJsonText<DepartmentConfigurationResponse>(text);
};

/**
 * DELETE /DepartmentConfiguration/{id}. id is DeptConfigID (primary key).
 */
export const deleteDepartmentConfiguration = async (deptConfigId: string): Promise<void> => {
  const response = await apiDelete(`${BASE}/${deptConfigId}`, { headers: { accept: '*/*' } });
  if (!response.ok && response.status !== 204) {
    const text = await response.text();
    throw new Error(`Failed to delete department configuration: ${response.status} ${text}`);
  }
};
