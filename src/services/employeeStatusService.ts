/**
 * EmployeeStatus API Service
 * Handles all API calls related to Employee Status
 */

import { apiDelete, apiGet, apiPost } from '@/utils/apiClient';
import {
  CreateEmployeeStatusRequest,
  EmployeeStatusPaginationParams,
  EmployeeStatusResponse,
  UpdateEmployeeStatusRequest,
} from '@/types/employeeStatus';
import { expectOkReadText, parseJsonText, parseJsonTextArray, parsePagedListJson, readResponseOk } from '@/services/textPlainJson';
import { normalizeEmployeeStatus } from '@/utils/normalizers';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';
import { coalesceKeyedRequest } from '@/utils/coalesceKeyedRequest';

type ActiveEmployeeStatusParams = {
  departmentId?: string;
  selectedId?: string;
};

export const getEmployeeStatuses = async (
  pagination?: EmployeeStatusPaginationParams
): Promise<{ data: EmployeeStatusResponse[]; totalRecords: number }> => {
  try {
    const queryParams = buildPaginationQueryParams(pagination);

    const endpoint = `/EmployeeStatus${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await apiGet(endpoint);
    const responseText = await expectOkReadText(response, 'Failed to fetch employee statuses');
    return parsePagedListJson(responseText, (row) => normalizeEmployeeStatus(row));
  } catch (error) {
    console.error('Error fetching employee statuses:', error);
    throw error;
  }
};

/**
 * Get all active employee statuses (for form dropdowns).
 * Endpoint: GET /EmployeeStatus/allactiveemployeestatus[?departmentId=][&selectedId=]
 */
export const getActiveEmployeeStatuses = async (
  params?: ActiveEmployeeStatusParams
): Promise<EmployeeStatusResponse[]> => {
  const departmentId = typeof params?.departmentId === 'string' ? params.departmentId.trim() : '';
  const selectedId = typeof params?.selectedId === 'string' ? params.selectedId.trim() : '';
  let path = '/EmployeeStatus/allactiveemployeestatus';
  if (departmentId || selectedId) {
    const query = new URLSearchParams();
    if (departmentId) query.set('departmentId', departmentId);
    if (selectedId) query.set('selectedId', selectedId);
    path = `/EmployeeStatus/allactiveemployeestatus?${query.toString()}`;
  }
  return coalesceKeyedRequest('getActiveEmployeeStatuses', path, async () => {
    try {
      const response = await apiGet(path);
      const responseText = await expectOkReadText(response, 'Failed to fetch active employee statuses');
      return parseJsonTextArray<any>(responseText).map(normalizeEmployeeStatus);
    } catch (error) {
      console.error('Error fetching active employee statuses:', error);
      throw error;
    }
  });
};

export const createEmployeeStatus = async (
  data: CreateEmployeeStatusRequest
): Promise<EmployeeStatusResponse> => {
  try {
    const response = await apiPost('/EmployeeStatus', data, {
      headers: { 'Content-Type': 'application/json' },
    });
    const responseText = await readResponseOk(response, 'Failed to create employee status');
    return normalizeEmployeeStatus(parseJsonText<any>(responseText));
  } catch (error) {
    console.error('Error creating employee status:', error);
    throw error;
  }
};

export const updateEmployeeStatus = async (
  data: UpdateEmployeeStatusRequest
): Promise<EmployeeStatusResponse> => {
  try {
    const response = await apiPost('/EmployeeStatus', data, {
      headers: { 'Content-Type': 'application/json' },
    });
    const responseText = await readResponseOk(response, 'Failed to update employee status');
    return normalizeEmployeeStatus(parseJsonText<any>(responseText));
  } catch (error) {
    console.error('Error updating employee status:', error);
    throw error;
  }
};

export const deleteEmployeeStatus = async (employeeStatusID: string): Promise<void> => {
  try {
    const response = await apiDelete(`/EmployeeStatus/${employeeStatusID}`, {
      headers: { accept: '*/*' },
    });
    await readResponseOk(response, 'Failed to delete employee status');
  } catch (error) {
    console.error('Error deleting employee status:', error);
    throw error;
  }
};


