import { apiDelete, apiGet, apiPost } from '@/utils/apiClient';
import { expectOkReadText, parseJsonText, parseJsonTextArray, readResponseOk } from '@/services/textPlainJson';
import type { EmployeeAdminResponse, CreateEmployeeAdminPayload } from '@/types/employeeAdmin';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';

function normalizeEmployeeAdmin(raw: Record<string, unknown>): EmployeeAdminResponse {
  return {
    employeeAdminID: String(raw?.employeeAdminID ?? raw?.EmployeeAdminID ?? ''),
    employeeID: String(raw?.employeeID ?? raw?.EmployeeID ?? ''),
    adminTypeID: String(raw?.adminTypeID ?? raw?.AdminTypeID ?? ''),
  };
}

/**
 * Fetch all employee admin assignments
 */
export const getEmployeeAdmins = async (pagination?: { page?: number; pageSize?: number }): Promise<EmployeeAdminResponse[]> => {
  const queryParams = buildPaginationQueryParams(pagination);
  const endpoint = `/EmployeeAdmin${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await apiGet(endpoint);
  const text = await expectOkReadText(response, 'Failed to fetch employee admins');
  const arr = parseJsonTextArray<Record<string, unknown>>(text);
  return arr.map(normalizeEmployeeAdmin);
};

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000';

/**
 * Create a new employee admin record (assign one admin type to an employee)
 */
export const createEmployeeAdmin = async (payload: CreateEmployeeAdminPayload): Promise<EmployeeAdminResponse> => {
  const body = {
    employeeAdminID: EMPTY_GUID,
    employeeID: payload.employeeID,
    adminTypeID: payload.adminTypeID,
  };
  const response = await apiPost('/EmployeeAdmin', body, {
    headers: { 'Content-Type': 'application/json' },
  });
  const text = await readResponseOk(response, 'Failed to create employee admin record');
  return normalizeEmployeeAdmin(parseJsonText<Record<string, unknown>>(text));
};

/**
 * Delete an employee admin record by ID
 */
export const deleteEmployeeAdmin = async (employeeAdminID: string): Promise<void> => {
  const response = await apiDelete(`/EmployeeAdmin/${employeeAdminID}`, { headers: { accept: '*/*' } });
  await readResponseOk(response, 'Failed to delete employee admin record');
};
