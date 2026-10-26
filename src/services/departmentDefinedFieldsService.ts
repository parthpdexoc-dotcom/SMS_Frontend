/**
 * DepartmentDefinedFields API Service
 * Handles all API calls related to Department Defined Fields
 */

import { apiDelete, apiGet, apiPost } from '@/utils/apiClient';
import {
  DepartmentDefinedFieldsPaginationParams,
  DepartmentDefinedFieldsResponse,
  CreateDepartmentDefinedFieldsRequest,
  UpdateDepartmentDefinedFieldsRequest,
} from '@/types/departmentDefinedFields';
import { expectOkReadText, parseJsonText, parseJsonTextArray } from '@/services/textPlainJson';
import { normalizeDepartmentDefinedFields } from '@/utils/normalizers';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';

export const getDepartmentDefinedFields = async (
  pagination?: DepartmentDefinedFieldsPaginationParams
): Promise<DepartmentDefinedFieldsResponse[]> => {
  try {
    const queryParams = buildPaginationQueryParams(pagination);

    const endpoint = `/DepartmentDefinedFields${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await apiGet(endpoint);
    const responseText = await expectOkReadText(response, 'Failed to fetch department defined fields');
    return parseJsonTextArray<any>(responseText).map(normalizeDepartmentDefinedFields);
  } catch (error) {
    console.error('Error fetching department defined fields:', error);
    throw error;
  }
};

/** GET /api/DepartmentDefinedFields/{departmentDefinedFieldID} - fetch single record by id (matches API get-by-id) */
export const getDepartmentDefinedFieldsById = async (
  departmentDefinedFieldID: string
): Promise<DepartmentDefinedFieldsResponse | null> => {
  try {
    const endpoint = `/DepartmentDefinedFields/${departmentDefinedFieldID}`;
    const response = await apiGet(endpoint, {
      headers: { accept: 'text/plain' },
    });
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      const text = await response.text();
      throw new Error(`Failed to fetch department defined fields: ${response.status} ${text}`);
    }
    const responseText = await response.text();
    if (!responseText || !responseText.trim()) {
      return null;
    }
    const parsed = parseJsonText<unknown>(responseText);
    let data: unknown = Array.isArray(parsed) ? parsed[0] : parsed;
    if (data && typeof data === 'object' && !Array.isArray(data) && 'data' in data && typeof (data as { data?: unknown }).data === 'object') {
      data = (data as { data: unknown }).data;
    }
    return data && typeof data === 'object' && !Array.isArray(data)
      ? normalizeDepartmentDefinedFields(data as Record<string, unknown>)
      : null;
  } catch (error) {
    console.error('Error fetching department defined fields by ID:', error);
    throw error;
  }
};

export const getDepartmentDefinedFieldsByDepartmentId = async (
  departmentID: string
): Promise<DepartmentDefinedFieldsResponse | null> => {
  try {
    const endpoint = `/DepartmentDefinedFields/department/${departmentID}`;
    const response = await apiGet(endpoint, {
      headers: { accept: 'text/plain' },
    });
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      const text = await response.text();
      throw new Error(`Failed to fetch department defined fields: ${response.status} ${text}`);
    }
    const responseText = await response.text();
    if (!responseText || !responseText.trim()) {
      return null;
    }
    const parsed = parseJsonText<unknown>(responseText);
    let data: unknown = Array.isArray(parsed) ? parsed[0] : parsed;
    if (data && typeof data === 'object' && !Array.isArray(data) && 'data' in data && typeof (data as { data?: unknown }).data === 'object') {
      data = (data as { data: unknown }).data;
    }
    return data && typeof data === 'object' && !Array.isArray(data)
      ? normalizeDepartmentDefinedFields(data as Record<string, unknown>)
      : null;
  } catch (error) {
    console.error('Error fetching department defined fields by department ID:', error);
    throw error;
  }
};

const DEPARTMENT_DEFINED_FIELDS_POST_HEADERS = {
  accept: 'text/plain',
  'Content-Type': 'application/json',
} as const;

export const createDepartmentDefinedFields = async (
  data: CreateDepartmentDefinedFieldsRequest
): Promise<DepartmentDefinedFieldsResponse> => {
  try {
    const response = await apiPost('/DepartmentDefinedFields', data, {
      headers: { ...DEPARTMENT_DEFINED_FIELDS_POST_HEADERS },
    });
    const responseText = await expectOkReadText(response, 'Failed to create department defined fields');
    return normalizeDepartmentDefinedFields(parseJsonText<any>(responseText));
  } catch (error) {
    console.error('Error creating department defined fields:', error);
    throw error;
  }
};

export const updateDepartmentDefinedFields = async (
  data: UpdateDepartmentDefinedFieldsRequest
): Promise<DepartmentDefinedFieldsResponse> => {
  try {
    const response = await apiPost('/DepartmentDefinedFields', data, {
      headers: { ...DEPARTMENT_DEFINED_FIELDS_POST_HEADERS },
    });
    const responseText = await expectOkReadText(response, 'Failed to update department defined fields');
    return normalizeDepartmentDefinedFields(parseJsonText<any>(responseText));
  } catch (error) {
    console.error('Error updating department defined fields:', error);
    throw error;
  }
};

export const deleteDepartmentDefinedFields = async (departmentDefinedFieldID: string): Promise<void> => {
  try {
    const response = await apiDelete(`/DepartmentDefinedFields/${departmentDefinedFieldID}`, {
      headers: { accept: '*/*' },
    });
    await expectOkReadText(response, 'Failed to delete department defined fields');
  } catch (error) {
    console.error('Error deleting department defined fields:', error);
    throw error;
  }
};
