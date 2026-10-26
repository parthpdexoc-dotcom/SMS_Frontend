/**
 * EmployeeType API Service
 * Handles all API calls related to Employee Types
 */

import { apiDelete, apiGet, apiGetAll, apiPost, apiPut } from '@/utils/apiClient';
import {
  ActiveEmployeeTypeParams,
  CreateEmployeeTypeRequest,
  EmployeeTypePaginationParams,
  EmployeeTypeResponse,
  UpdateEmployeeTypeRequest,
} from '@/types/employeeType';
import type { SelectOptionDto } from '@/types/common';
import { parseJsonText, parseJsonTextArray, parsePagedListJson, readResponseOk } from '@/services/textPlainJson';
import { normalizeEmployeeType } from '@/utils/normalizers';
import { coalesceKeyedRequest } from '@/utils/coalesceKeyedRequest';

export const getEmployeeTypes = async (
  pagination?: EmployeeTypePaginationParams
): Promise<{ data: EmployeeTypeResponse[]; totalRecords: number }> => {
  try {
    // Default to sorting by rank in ascending order if not specified
    const paginationWithSort: EmployeeTypePaginationParams = {
      ...pagination,
      sortBy: pagination?.sortBy ?? 'rank',
      sortDirection: pagination?.sortDirection ?? 'asc',
    };

    const response = await apiGetAll('/EmployeeType', paginationWithSort);
    const responseText = await readResponseOk(response, 'Failed to fetch employee types');
    return parsePagedListJson(responseText, (row) => normalizeEmployeeType(row));
  } catch (error) {
    console.error('Error fetching employee types:', error);
    throw error;
  }
};

/** Appends supported query params when provided (departmentId, selectedId). */
function activeEmployeeTypePath(params?: ActiveEmployeeTypeParams): string {
  const departmentId = typeof params?.departmentId === 'string' ? params.departmentId.trim() : '';
  const selectedId = typeof params?.selectedId === 'string' ? params.selectedId.trim() : '';
  if (!departmentId && !selectedId) return '/EmployeeType/GetAllActiveEmployeeType';
  const query = new URLSearchParams();
  if (departmentId) query.set('departmentId', departmentId);
  if (selectedId) query.set('selectedId', selectedId);
  const q = query.toString();
  return `/EmployeeType/GetAllActiveEmployeeType?${q}`;
}

/**
 * Get all active employee types (for form dropdowns).
 * Endpoint: GET /EmployeeType/GetAllActiveEmployeeType[?departmentId=][&selectedId=]
 */
export const getActiveEmployeeTypes = async (params?: ActiveEmployeeTypeParams): Promise<EmployeeTypeResponse[]> => {
  const path = activeEmployeeTypePath(params);
  return coalesceKeyedRequest('getActiveEmployeeTypes', path, async () => {
    try {
      const response = await apiGet(path);
      const responseText = await readResponseOk(response, 'Failed to fetch active employee types');
      return parseJsonTextArray<any>(responseText).map(normalizeEmployeeType);
    } catch (error) {
      console.error('Error fetching active employee types:', error);
      throw error;
    }
  });
};

export type EmployeeTypeOptionsParams = {
  searchTerm?: string;
  selectedId?: string;
  isSupervisorPost?: boolean;
};

/** Lightweight employee type options for searchable dropdowns. */
export const getEmployeeTypeOptions = async (
  params?: EmployeeTypeOptionsParams
): Promise<SelectOptionDto[]> => {
  const body: Record<string, unknown> = {};
  const trimmedSearch = params?.searchTerm?.trim();
  if (trimmedSearch) body.searchTerm = trimmedSearch;
  const selectedId = params?.selectedId?.trim();
  if (selectedId) body.selectedId = selectedId;
  const endpoint = params?.isSupervisorPost
    ? '/EmployeeType/supervisoremployeeoptions'
    : '/EmployeeType/eligibleemployeeoptions';
  const response = await apiPost(endpoint, body, {
    headers: { 'Content-Type': 'application/json' },
  });
  const responseText = await readResponseOk(response, 'Failed to fetch employee type options');
  return parseJsonText<SelectOptionDto[]>(responseText);
};

export const getEmployeeTypeById = async (employeeTypeID: string): Promise<EmployeeTypeResponse> => {
  const response = await apiGet(`/EmployeeType/${employeeTypeID}`);
  const responseText = await readResponseOk(response, 'Failed to fetch employee type');
  return normalizeEmployeeType(parseJsonText<Record<string, unknown>>(responseText));
};

/**
 * Backend supports POST upsert at `/EmployeeType`.
 * For update we POST with `employeeTypeID` present (same pattern as other master data screens).
 */
export const createEmployeeType = async (
  data: CreateEmployeeTypeRequest
): Promise<EmployeeTypeResponse> => {
  try {
    const response = await apiPost('/EmployeeType', data, {
      headers: { 'Content-Type': 'application/json' },
    });
    const responseText = await readResponseOk(response, 'Failed to create employee type');
    return normalizeEmployeeType(parseJsonText<any>(responseText));
  } catch (error) {
    console.error('Error creating employee type:', error);
    throw error;
  }
};

export const updateEmployeeType = async (
  data: UpdateEmployeeTypeRequest
): Promise<EmployeeTypeResponse> => {
  try {
    const { sameRankIds, ...rest } = data;
    const body: Record<string, unknown> = { ...rest };
    if (sameRankIds !== undefined) {
      body.SameRankIds = sameRankIds;
    }
    const response = await apiPost('/EmployeeType', body, {
      headers: { 'Content-Type': 'application/json' },
    });
    const responseText = await readResponseOk(response, 'Failed to update employee type');
    return normalizeEmployeeType(parseJsonText<any>(responseText));
  } catch (error) {
    console.error('Error updating employee type:', error);
    throw error;
  }
};

export const deleteEmployeeType = async (employeeTypeID: string): Promise<void> => {
  try {
    const response = await apiDelete(`/EmployeeType/${employeeTypeID}`, {
      headers: { accept: '*/*' },
    });
    await readResponseOk(response, 'Failed to delete employee type');
  } catch (error) {
    console.error('Error deleting employee type:', error);
    throw error;
  }
};

/**
 * Update the rank of an employee type
 * @param employeeTypeID The ID of the employee type to update
 * @param rank The new rank (1-based position)
 * @param options.atDisplayRow When set (e.g. after drag-and-drop), sent as query ?atDisplayRow= — 1-based row where the item should sit after the move in the full grid
 * @returns Promise<void>
 */
export const updateEmployeeTypeRank = async (
  employeeTypeID: string,
  rank: number,
  options?: { atDisplayRow?: number }
): Promise<void> => {
  try {
    const params = new URLSearchParams();
    if (options?.atDisplayRow != null && Number.isFinite(Number(options.atDisplayRow))) {
      params.set('atDisplayRow', String(Math.round(Number(options.atDisplayRow))));
    }
    const qs = params.toString();
    const path = `/EmployeeType/${employeeTypeID}/rank/${rank}${qs ? `?${qs}` : ''}`;
    const response = await apiPut(path, undefined, {
      headers: { accept: '*/*' },
    });
    await readResponseOk(response, 'Failed to update employee type rank');
  } catch (error) {
    console.error('Error updating employee type rank:', error);
    throw error;
  }
};


