/**
 * DepartmentEquipment API Service
 * Handles all API calls related to Department Equipment
 */

import { apiDelete, apiGet, apiPost } from '@/utils/apiClient';
import {
  CreateDepartmentEquipmentRequest,
  DepartmentEquipmentPaginationParams,
  DepartmentEquipmentResponse,
  UpdateDepartmentEquipmentRequest,
  DepartmentEquipmentCategory,
} from '@/types/departmentEquipment';
import type { DepartmentEquipmentSelectOptionDto } from '@/types/common';
import { expectOkReadText, parseJsonText, parseJsonTextArray, parsePagedListJson, readResponseOk } from '@/services/textPlainJson';
import { normalizeDepartmentEquipment } from '@/utils/normalizers';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';
import { coalesceKeyedRequest } from '@/utils/coalesceKeyedRequest';

export const getDepartmentEquipments = async (
  pagination?: DepartmentEquipmentPaginationParams
): Promise<{ data: DepartmentEquipmentResponse[]; totalRecords: number }> => {
  try {
    const queryParams = buildPaginationQueryParams(pagination);

    const endpoint = `/DepartmentEquipment${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await apiGet(endpoint);
    const responseText = await expectOkReadText(response, 'Failed to fetch department equipment');
    return parsePagedListJson(responseText, (row) => normalizeDepartmentEquipment(row));
  } catch (error) {
    console.error('Error fetching department equipment:', error);
    throw error;
  }
};

export const createDepartmentEquipment = async (
  data: CreateDepartmentEquipmentRequest
): Promise<DepartmentEquipmentResponse> => {
  try {
    const response = await apiPost('/DepartmentEquipment', data, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const responseText = await readResponseOk(response, 'Failed to create department equipment');
    return normalizeDepartmentEquipment(parseJsonText<any>(responseText));
  } catch (error) {
    console.error('Error creating department equipment:', error);
    throw error;
  }
};

export const updateDepartmentEquipment = async (
  data: UpdateDepartmentEquipmentRequest
): Promise<DepartmentEquipmentResponse> => {
  try {
    const response = await apiPost('/DepartmentEquipment', data, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const responseText = await readResponseOk(response, 'Failed to update department equipment');
    return normalizeDepartmentEquipment(parseJsonText<any>(responseText));
  } catch (error) {
    console.error('Error updating department equipment:', error);
    throw error;
  }
};

export const deleteDepartmentEquipment = async (departmentEquipmentID: string): Promise<void> => {
  try {
    const response = await apiDelete(`/DepartmentEquipment/${departmentEquipmentID}`, {
      headers: {
        accept: '*/*',
      },
    });
    await readResponseOk(response, 'Failed to delete department equipment');
  } catch (error) {
    console.error('Error deleting department equipment:', error);
    throw error;
  }
};

export const getDepartmentEquipmentByType = async (
  departmentId: string,
  category: DepartmentEquipmentCategory,
  options?: (DepartmentEquipmentPaginationParams & { selectedIds?: string[] })
): Promise<DepartmentEquipmentResponse[]> => {
  try {
    const queryParams = buildPaginationQueryParams(options);
    queryParams.append('category', category.toString());
    const selectedIds = Array.from(
      new Set((options?.selectedIds ?? []).map((id) => String(id ?? '').trim()).filter(Boolean))
    );
    selectedIds.forEach((selectedId) => queryParams.append('selectedIds', selectedId));

    const response = await apiGet(`/DepartmentEquipment/department/${departmentId}/equipment?${queryParams.toString()}`);
    const responseText = await expectOkReadText(response, 'Failed to fetch department equipment');
    return parseJsonTextArray<any>(responseText).map(normalizeDepartmentEquipment);
  } catch (error) {
    console.error(`Error fetching department equipment (Category: ${category}):`, error);
    throw error;
  }
};

type DepartmentEquipmentOptionsParams = {
  searchTerm?: string;
  selectedIds?: string[];
};

async function fetchDepartmentEquipmentOptions(
  endpoint: string,
  cacheKey: string,
  errorLabel: string,
  params?: DepartmentEquipmentOptionsParams
): Promise<DepartmentEquipmentSelectOptionDto[]> {
  const selectedIds = Array.from(
    new Set((params?.selectedIds ?? []).map((id) => String(id ?? '').trim()).filter(Boolean))
  );
  const body: DepartmentEquipmentOptionsParams = {
    searchTerm: params?.searchTerm?.trim() || undefined,
    selectedIds: selectedIds.length > 0 ? selectedIds : undefined,
  };
  const requestKey = JSON.stringify(body);
  return coalesceKeyedRequest(cacheKey, requestKey, async () => {
    try {
      const response = await apiPost(endpoint, body, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const responseText = await expectOkReadText(response, `Failed to fetch ${errorLabel}`);
      return parseJsonText<DepartmentEquipmentSelectOptionDto[]>(responseText);
    } catch (error) {
      console.error(`Error fetching ${errorLabel}:`, error);
      throw error;
    }
  });
}

/**
 * Lightweight department vehicle options for dropdowns.
 */
export const getDepartmentVehicleOptions = async (
  params?: DepartmentEquipmentOptionsParams
): Promise<DepartmentEquipmentSelectOptionDto[]> =>
  fetchDepartmentEquipmentOptions(
    '/DepartmentEquipment/vehicleoptions',
    'getDepartmentVehicleOptions',
    'department vehicle options',
    params
  );

/**
 * Lightweight department equipment options for dropdowns.
 */
export const getDepartmentEquipmentOptions = async (
  params?: DepartmentEquipmentOptionsParams
): Promise<DepartmentEquipmentSelectOptionDto[]> =>
  fetchDepartmentEquipmentOptions(
    '/DepartmentEquipment/equipmentoptions',
    'getDepartmentEquipmentOptions',
    'department equipment options',
    params
  );
