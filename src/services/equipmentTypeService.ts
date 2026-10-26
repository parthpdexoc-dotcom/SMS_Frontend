/**
 * EquipmentType API Service
 * Handles all API calls related to Equipment Types
 */

import { apiDelete, apiGet, apiPost } from '@/utils/apiClient';
import {
  CreateEquipmentTypeRequest,
  EquipmentTypePaginationParams,
  EquipmentTypeResponse,
  UpdateEquipmentTypeRequest,
} from '@/types/equipmentType';
import { expectOkReadText, parseJsonText, parseJsonTextArray, parsePagedListJson, readResponseOk } from '@/services/textPlainJson';
import { normalizeEquipmentType } from '@/utils/normalizers';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';

type ActiveEquipmentTypeParams = {
  selectedId?: string;
};

export const getEquipmentTypes = async (
  pagination?: EquipmentTypePaginationParams
): Promise<{ data: EquipmentTypeResponse[]; totalRecords: number }> => {
  try {
    const queryParams = buildPaginationQueryParams(pagination);

    const endpoint = `/EquipmentType${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await apiGet(endpoint);
    const responseText = await expectOkReadText(response, 'Failed to fetch equipment types');
    return parsePagedListJson(responseText, (row) => normalizeEquipmentType(row));
  } catch (error) {
    console.error('Error fetching equipment types:', error);
    throw error;
  }
};

/**
 * Get all active equipment types (for form dropdowns).
 * Endpoint: GET /EquipmentType/GetAllActiveequipment[?selectedId=]
 */
export const getActiveEquipmentTypes = async (params?: ActiveEquipmentTypeParams): Promise<EquipmentTypeResponse[]> => {
  try {
    const selectedId = typeof params?.selectedId === 'string' ? params.selectedId.trim() : '';
    const path =
      selectedId === ''
        ? '/EquipmentType/GetAllActiveequipment'
        : `/EquipmentType/GetAllActiveequipment?${new URLSearchParams({ selectedId }).toString()}`;
    const response = await apiGet(path);
    const responseText = await expectOkReadText(response, 'Failed to fetch active equipment types');
    return parseJsonTextArray<any>(responseText).map(normalizeEquipmentType);
  } catch (error) {
    console.error('Error fetching active equipment types:', error);
    throw error;
  }
};

export const createEquipmentType = async (
  data: CreateEquipmentTypeRequest
): Promise<EquipmentTypeResponse> => {
  try {
    const response = await apiPost('/EquipmentType', data, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const responseText = await readResponseOk(response, 'Failed to create equipment type');
    return normalizeEquipmentType(parseJsonText<any>(responseText));
  } catch (error) {
    console.error('Error creating equipment type:', error);
    throw error;
  }
};

export const updateEquipmentType = async (
  data: UpdateEquipmentTypeRequest
): Promise<EquipmentTypeResponse> => {
  try {
    const response = await apiPost('/EquipmentType', data, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const responseText = await readResponseOk(response, 'Failed to update equipment type');
    return normalizeEquipmentType(parseJsonText<any>(responseText));
  } catch (error) {
    console.error('Error updating equipment type:', error);
    throw error;
  }
};

export const deleteEquipmentType = async (equipementTypeID: string): Promise<void> => {
  try {
    const response = await apiDelete(`/EquipmentType/${equipementTypeID}`, {
      headers: {
        accept: '*/*',
      },
    });
    await readResponseOk(response, 'Failed to delete equipment type');
  } catch (error) {
    console.error('Error deleting equipment type:', error);
    throw error;
  }
};


