/**
 * Department API Service
 * Handles all API calls related to Department
 */

import { apiDelete, apiGet, apiGetAll, apiPost } from '@/utils/apiClient';
import {
  DepartmentLocationResponse,
  DepartmentPaginationParams,
  DepartmentResponse,
} from '@/types/department';
import { expectOkReadText, parseJsonText, parsePagedListJson, readResponseOk } from '@/services/textPlainJson';
import { normalizeDepartment } from '@/utils/normalizers';

export const getDepartments = async (
  pagination?: DepartmentPaginationParams
): Promise<{ data: DepartmentResponse[]; totalRecords: number }> => {
  try {
    // Backend policy: SuperUserOnly
    const response = await apiGetAll('/Department', pagination);
    const responseText = await expectOkReadText(response, 'Failed to fetch departments');
    return parsePagedListJson(responseText, (row) => normalizeDepartment(row));
  } catch (error) {
    console.error('Error fetching departments:', error);
    throw error;
  }
};

export const getDepartmentById = async (id: string): Promise<DepartmentResponse | null> => {
  try {
    // Backend policy: DepartmentAdminOnly
    const response = await apiGet(`/Department/${id}`);
    const responseText = await expectOkReadText(response, 'Failed to fetch department');
    return normalizeDepartment(parseJsonText<Record<string, unknown>>(responseText));
  } catch (error) {
    console.error('Error fetching department:', error);
    throw error;
  }
};

export const createDepartment = async (
  payload: Record<string, unknown>
): Promise<DepartmentResponse> => {
  try {
    const response = await apiPost('/Department', payload, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const responseText = await readResponseOk(response, 'Failed to create department');
    return normalizeDepartment(parseJsonText<Record<string, unknown>>(responseText));
  } catch (error) {
    console.error('Error creating department:', error);
    throw error;
  }
};

export const updateDepartment = async (
  payload: Record<string, unknown>
): Promise<DepartmentResponse> => {
  try {
    const response = await apiPost('/Department', payload, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const responseText = await readResponseOk(response, 'Failed to update department');
    return normalizeDepartment(parseJsonText<Record<string, unknown>>(responseText));
  } catch (error) {
    console.error('Error updating department:', error);
    throw error;
  }
};

export const deleteDepartment = async (departmentID: string): Promise<void> => {
  try {
    const response = await apiDelete(`/Department/${departmentID}`, {
      headers: {
        accept: '*/*',
      },
    });
    await readResponseOk(response, 'Failed to delete department');
  } catch (error) {
    console.error('Error deleting department:', error);
    throw error;
  }
};

/**
 * Gets location coordinates and address for the authenticated department from JWT token.
 * Used for showcasing the Department Location on Master Maps.
 */
export const getDepartmentLocation = async (): Promise<DepartmentLocationResponse | null> => {
  try {
    const response = await apiGet('/Department/location');
    const responseText = await expectOkReadText(response, 'Failed to fetch department location');
    return parseJsonText<DepartmentLocationResponse>(responseText);
  } catch (error) {
    console.error('Error fetching department location:', error);
    throw error;
  }
};

