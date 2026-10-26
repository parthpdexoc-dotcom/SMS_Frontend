/**
 * DepartmentDivisions API Service
 * Handles all API calls related to Department Divisions
 */

import { apiDelete, apiGet, apiPost } from '@/utils/apiClient';
import {
  ActiveDepartmentDivisionParams,
  CreateDepartmentDivisionRequest,
  DepartmentDivisionPaginationParams,
  DepartmentDivisionResponse,
  UpdateDepartmentDivisionRequest,
} from '@/types/departmentDivision';
import { parseJsonText, parseJsonTextArray, parsePagedListJson, readResponseOk } from '@/services/textPlainJson';
import { normalizeDepartmentDivision } from '@/utils/normalizers';
import { coalesceKeyedRequest } from '@/utils/coalesceKeyedRequest';

export const getDepartmentDivisions = async (
  pagination?: DepartmentDivisionPaginationParams,
  departmentID?: string
): Promise<{ data: DepartmentDivisionResponse[]; totalRecords: number }> => {
  try {
    const defaultPagination = { ...pagination };
    // Add departmentID as a query parameter if provided
    let endpoint = '/DepartmentDivisions';
    const queryParams = new URLSearchParams();
    
    if (defaultPagination) {
      if (defaultPagination.page !== undefined) queryParams.append('page', defaultPagination.page.toString());
      if (defaultPagination.pageSize !== undefined) queryParams.append('pageSize', defaultPagination.pageSize.toString());
      if (defaultPagination.sortBy) queryParams.append('sortBy', defaultPagination.sortBy);
      if (defaultPagination.sortDirection) queryParams.append('sortDirection', defaultPagination.sortDirection);
      if (defaultPagination.isActive !== undefined) {
        queryParams.append('isActive', defaultPagination.isActive ? 'true' : 'false');
      }
    }
    
    if (departmentID) {
      console.log('departmentID', departmentID);
      queryParams.append('departmentID', departmentID);
    }
    
    if (queryParams.toString()) {
      endpoint = `${endpoint}?${queryParams.toString()}`;
    }
    
    const response = await apiGet(endpoint);
    console.log('response', response);
    const responseText = await readResponseOk(response, 'Failed to fetch department divisions');
    return parsePagedListJson(responseText, (row) => normalizeDepartmentDivision(row));
  } catch (error) {
    console.error('Error fetching department divisions:', error);
    throw error;
  }
};

/** Get active department divisions for dropdowns. */
export const getActiveDepartmentDivisions = async (
  params?: ActiveDepartmentDivisionParams
): Promise<DepartmentDivisionResponse[]> => {
  const departmentId = typeof params?.departmentId === 'string' ? params.departmentId.trim() : '';
  const selectedId = typeof params?.selectedId === 'string' ? params.selectedId.trim() : '';
  const query = new URLSearchParams();
  if (departmentId) query.set('departmentId', departmentId);
  if (selectedId) query.set('selectedId', selectedId);
  const qs = query.toString();
  const endpoint = `/DepartmentDivisions/GetAllActiveDepartmentDivision${qs ? `?${qs}` : ''}`;
  return coalesceKeyedRequest('getActiveDepartmentDivisions', endpoint, async () => {
    try {
      const response = await apiGet(endpoint);
      const responseText = await readResponseOk(response, 'Failed to fetch active department divisions');
      return parseJsonTextArray<any>(responseText).map(normalizeDepartmentDivision);
    } catch (error) {
      console.error('Error fetching active department divisions:', error);
      throw error;
    }
  });
};

/**
 * Backend supports POST upsert at `/DepartmentDivisions`.
 * For update we POST with `divisionID` present (same pattern as other master data screens).
 */
export const createDepartmentDivision = async (
  data: CreateDepartmentDivisionRequest
): Promise<DepartmentDivisionResponse> => {
  try {
    const response = await apiPost('/DepartmentDivisions', data, {
      headers: { 'Content-Type': 'application/json' },
    });
    const responseText = await readResponseOk(response, 'Failed to create department division');
    return normalizeDepartmentDivision(parseJsonText<any>(responseText));
  } catch (error) {
    console.error('Error creating department division:', error);
    throw error;
  }
};

export const updateDepartmentDivision = async (
  data: UpdateDepartmentDivisionRequest
): Promise<DepartmentDivisionResponse> => {
  try {
    const response = await apiPost('/DepartmentDivisions', data, {
      headers: { 'Content-Type': 'application/json' },
    });
    const responseText = await readResponseOk(response, 'Failed to update department division');
    return normalizeDepartmentDivision(parseJsonText<any>(responseText));
  } catch (error) {
    console.error('Error updating department division:', error);
    throw error;
  }
};

export const deleteDepartmentDivision = async (divisionID: string): Promise<void> => {
  try {
    const response = await apiDelete(`/DepartmentDivisions/${divisionID}`, {
      headers: { accept: '*/*' },
    });
    await readResponseOk(response, 'Failed to delete department division');
  } catch (error) {
    console.error('Error deleting department division:', error);
    throw error;
  }
};


