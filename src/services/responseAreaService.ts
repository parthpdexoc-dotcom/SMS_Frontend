/**
 * ResponseArea API Service
 * Handles all API calls related to Department Response Areas (GET, POST, PUT, DELETE).
 * Aligned with DepartmentResponseArea entity and RoutingGroup pattern.
 */

import { apiDelete, apiGet, apiPost } from '@/utils/apiClient';
import {
  CreateResponseAreaRequest,
  ResponseAreaPaginationParams,
  ResponseAreaResponse,
  UpdateResponseAreaRequest,
} from '@/types/responseArea';
import { SelectOptionDto } from '@/types/common';
import { expectOkReadText, parseJsonText, parseJsonTextArray, parsePagedListJson, readResponseOk } from '@/services/textPlainJson';
import { normalizeResponseArea } from '@/utils/normalizers';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';

type ActiveResponseAreaParams = {
  selectedId?: string;
};

export const getResponseAreas = async (
  pagination?: ResponseAreaPaginationParams
): Promise<{ data: ResponseAreaResponse[]; totalRecords: number }> => {
  try {
    const queryParams = buildPaginationQueryParams(pagination);
    const endpoint = `/DepartmentResponseArea${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await apiGet(endpoint);
    const responseText = await expectOkReadText(response, 'Failed to fetch response areas');
    return parsePagedListJson(responseText, (row) => normalizeResponseArea(row));
  } catch (error) {
    console.error('Error fetching response areas:', error);
    throw error;
  }
};

export const createResponseArea = async (
  data: CreateResponseAreaRequest
): Promise<ResponseAreaResponse> => {
  try {
    // DTO: DepartmentID is JsonIgnore (auto from token); use camelCase to match JsonPropertyName
    const body = {
      departmentResponseAreaShort: data.responseAreaShort,
      departmentResponseAreaLong: data.responseAreaLong,
      departmentResponseAreaStatus: data.responseAreaStatus,
    };
    const response = await apiPost('/DepartmentResponseArea', body, {
      headers: { 'Content-Type': 'application/json' },
    });
    const responseText = await readResponseOk(response, 'Failed to create response area');
    return normalizeResponseArea(parseJsonText<any>(responseText));
  } catch (error) {
    console.error('Error creating response area:', error);
    throw error;
  }
};

export const updateResponseArea = async (
  data: UpdateResponseAreaRequest
): Promise<ResponseAreaResponse> => {
  try {
    // DTO: responseAreaID (JsonPropertyName); DepartmentID is JsonIgnore (auto from token)
    const body = {
      responseAreaID: data.responseAreaID,
      departmentResponseAreaShort: data.responseAreaShort,
      departmentResponseAreaLong: data.responseAreaLong,
      departmentResponseAreaStatus: data.responseAreaStatus,
    };
    if (process.env.NODE_ENV === 'development') {
      console.log('ResponseArea updateResponseArea request body:', { responseAreaID: body.responseAreaID, hasId: Boolean(body.responseAreaID) });
    }
    const response = await apiPost('/DepartmentResponseArea', body, {
      headers: { 'Content-Type': 'application/json' },
    });
    const responseText = await readResponseOk(response, 'Failed to update response area');
    return normalizeResponseArea(parseJsonText<any>(responseText));
  } catch (error) {
    console.error('Error updating response area:', error);
    throw error;
  }
};

export const deleteResponseArea = async (responseAreaID: string): Promise<void> => {
  try {
    // Same as BusinessType: DELETE /Controller/{id} (path parameter)
    const response = await apiDelete(`/DepartmentResponseArea/${responseAreaID}`, {
      headers: { accept: '*/*' },
    });
    await readResponseOk(response, 'Failed to delete response area');
  } catch (error) {
    console.error('Error deleting response area:', error);
    throw error;
  }
};

/**
 * Lightweight department response area options for dropdowns.
 * Backend returns SelectOptionDto[] directly; no extra frontend mapping here.
 */
export const getDepartmentResponseAreaOptions = async (
  searchTerm?: string,
  selectedId?: string
): Promise<SelectOptionDto[]> => {
  try {
    const body: Record<string, unknown> = {};
    const trimmedSearch = searchTerm?.trim();
    if (trimmedSearch) {
      body.searchTerm = trimmedSearch;
    }
    const trimmedSelectedId = selectedId?.trim();
    if (trimmedSelectedId) {
      body.selectedId = trimmedSelectedId;
    }
    const response = await apiPost('/DepartmentResponseArea/departmentresponseareaoptions', body, {
      headers: { 'Content-Type': 'application/json' },
    });
    const responseText = await expectOkReadText(response, 'Failed to fetch department response area options');
    return parseJsonText<SelectOptionDto[]>(responseText);
  } catch (error) {
    console.error('Error fetching department response area options:', error);
    throw error;
  }
};

/**
 * Gets response areas by department ID from the token.
 * GET /DepartmentResponseArea/GetAllActiveDepartment[?selectedId=]
 * @returns Promise<ResponseAreaResponse[]>
 */
export const getResponseAreasByDepartmentId = async (
  params?: ActiveResponseAreaParams
): Promise<ResponseAreaResponse[]> => {
  try {
    const selectedId = typeof params?.selectedId === 'string' ? params.selectedId.trim() : '';
    const path =
      selectedId === ''
        ? '/DepartmentResponseArea/GetAllActiveDepartment'
        : `/DepartmentResponseArea/GetAllActiveDepartment?${new URLSearchParams({ selectedId }).toString()}`;
    const response = await apiGet(path);
    const responseText = await expectOkReadText(response, 'Failed to fetch response areas by department');
    return parseJsonTextArray<any>(responseText).map(normalizeResponseArea);
  } catch (error) {
    console.error('Error fetching response areas by department ID:', error);
    throw error;
  }
};

