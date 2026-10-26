/**
 * DepartmentActivityType API Service
 * Handles all API calls related to Department Activity Types
 */

import { apiDelete, apiGet, apiGetAll, apiPost } from '@/utils/apiClient';
import {
  CreateDepartmentActivityTypeRequest,
  DepartmentActivityTypePaginationParams,
  DepartmentActivityTypeResponse,
  UpdateDepartmentActivityTypeRequest,
} from '@/types/departmentActivityType';
import type { SelectOptionDto } from '@/types/common';
import { expectOkReadText, parseJsonText, parsePagedListJson, readResponseOk } from '@/services/textPlainJson';
import { normalizeDepartmentActivityType } from '@/utils/normalizers';

type ActiveDepartmentActivityTypeParams = {
  selectedId?: string;
};

/** Fetches all active department activity types (for dropdowns). Uses GetAllActiveDepartmentActivityType API. */
export const getAllActiveDepartmentActivityType = async (
  params?: ActiveDepartmentActivityTypeParams
): Promise<DepartmentActivityTypeResponse[]> => {
  try {
    const selectedId = typeof params?.selectedId === 'string' ? params.selectedId.trim() : '';
    const path =
      selectedId === ''
        ? '/DepartmentActivityType/GetAllActiveDepartmentActivityType'
        : `/DepartmentActivityType/GetAllActiveDepartmentActivityType?${new URLSearchParams({ selectedId }).toString()}`;
    const response = await apiGet(path, {
      headers: { accept: 'text/plain' },
    });
    const responseText = await expectOkReadText(response, 'Failed to fetch active department activity types');
    const parsed = parseJsonText<unknown>(responseText);
    const arr = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
    return (arr as Record<string, unknown>[]).map(normalizeDepartmentActivityType);
  } catch (error) {
    console.error('Error fetching active department activity types:', error);
    throw error;
  }
};

export type DepartmentActivityTypeOptionsParams = {
  searchTerm?: string;
  selectedId?: string;
};

/** Lightweight department activity type options for searchable dropdowns. */
export const getDepartmentActivityTypeOptions = async (
  params?: DepartmentActivityTypeOptionsParams
): Promise<SelectOptionDto[]> => {
  const body: Record<string, unknown> = {};
  const trimmedSearch = params?.searchTerm?.trim();
  if (trimmedSearch) body.searchTerm = trimmedSearch;
  const selectedId = params?.selectedId?.trim();
  if (selectedId) body.selectedId = selectedId;
  const response = await apiPost('/DepartmentActivityType/departmentactivitytypeoptions', body, {
    headers: { 'Content-Type': 'application/json' },
  });
  const responseText = await expectOkReadText(response, 'Failed to fetch department activity type options');
  return parseJsonText<SelectOptionDto[]>(responseText);
};

export const getDepartmentActivityTypes = async (
  pagination?: DepartmentActivityTypePaginationParams
): Promise<{ data: DepartmentActivityTypeResponse[]; totalRecords: number }> => {
  try {
    const defaultPagination = { ...pagination };
    const response = await apiGetAll('/DepartmentActivityType', defaultPagination);
    const responseText = await readResponseOk(response, 'Failed to fetch department activity types');
    return parsePagedListJson(responseText, (row) => normalizeDepartmentActivityType(row));
  } catch (error) {
    console.error('Error fetching department activity types:', error);
    throw error;
  }
};

/**
 * Backend supports POST upsert at `/DepartmentActivityType`.
 * For update we POST with `departmentActivityTypeId` present (matches backend DepartmentActivityTypeDto).
 */
export const createDepartmentActivityType = async (
  data: CreateDepartmentActivityTypeRequest
): Promise<DepartmentActivityTypeResponse> => {
  try {
    const response = await apiPost('/DepartmentActivityType', data, {
      headers: { 'Content-Type': 'application/json' },
    });
    const responseText = await readResponseOk(response, 'Failed to create department activity type');
    return normalizeDepartmentActivityType(parseJsonText<any>(responseText));
  } catch (error) {
    console.error('Error creating department activity type:', error);
    throw error;
  }
};

export const updateDepartmentActivityType = async (
  data: UpdateDepartmentActivityTypeRequest
): Promise<DepartmentActivityTypeResponse> => {
  try {
    const response = await apiPost('/DepartmentActivityType', data, {
      headers: { 'Content-Type': 'application/json' },
    });
    const responseText = await readResponseOk(response, 'Failed to update department activity type');
    return normalizeDepartmentActivityType(parseJsonText<any>(responseText));
  } catch (error) {
    console.error('Error updating department activity type:', error);
    throw error;
  }
};

export const deleteDepartmentActivityType = async (departmentActivityTypeId: string): Promise<void> => {
  try {
    const response = await apiDelete(`/DepartmentActivityType/${departmentActivityTypeId}`, {
      headers: { accept: '*/*' },
    });
    await readResponseOk(response, 'Failed to delete department activity type');
  } catch (error) {
    console.error('Error deleting department activity type:', error);
    throw error;
  }
};


