/**
 * BusinessType API Service
 * Handles all API calls related to Business Types
 */

import { apiDelete, apiGet, apiPost } from '@/utils/apiClient';
import {
  BusinessTypePaginationParams,
  BusinessTypeResponse,
  CreateBusinessTypeRequest,
  UpdateBusinessTypeRequest,
} from '@/types/businessType';
import { SelectOptionDto } from '@/types/common';
import { expectOkReadText, parseJsonText, parsePagedListJson, readResponseOk } from '@/services/textPlainJson';
import { normalizeBusinessType } from '@/utils/normalizers';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';

export const getBusinessTypes = async (
  pagination?: BusinessTypePaginationParams
): Promise<{ data: BusinessTypeResponse[]; totalRecords: number }> => {
  try {
    const queryParams = buildPaginationQueryParams(pagination);

    const endpoint = `/BusinessType${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await apiGet(endpoint);
    const responseText = await expectOkReadText(response, 'Failed to fetch business types');
    return parsePagedListJson(responseText, (row) => normalizeBusinessType(row));
  } catch (error) {
    console.error('Error fetching business types:', error);
    throw error;
  }
};

/**
 * Lightweight business type options for dropdowns.
 * Backend returns SelectOptionDto[] directly; no extra frontend mapping here.
 */
export const getBusinessTypeOptions = async (
  searchTerm?: string
): Promise<SelectOptionDto[]> => {
  try {
    const body: Record<string, unknown> = {};
    const trimmedSearch = searchTerm?.trim();
    if (trimmedSearch) {
      body.searchTerm = trimmedSearch;
    }
    const response = await apiPost('/BusinessType/businesstypeoptions', body, {
      headers: { 'Content-Type': 'application/json' },
    });
    const responseText = await expectOkReadText(response, 'Failed to fetch business type options');
    return parseJsonText<SelectOptionDto[]>(responseText);
  } catch (error) {
    console.error('Error fetching business type options:', error);
    throw error;
  }
};

export const createBusinessType = async (
  data: CreateBusinessTypeRequest
): Promise<BusinessTypeResponse> => {
  try {
    const response = await apiPost('/BusinessType', data, {
      headers: { 'Content-Type': 'application/json' },
    });
    const responseText = await readResponseOk(response, 'Failed to create business type');
    return normalizeBusinessType(parseJsonText<any>(responseText));
  } catch (error) {
    console.error('Error creating business type:', error);
    throw error;
  }
};

export const updateBusinessType = async (
  data: UpdateBusinessTypeRequest
): Promise<BusinessTypeResponse> => {
  try {
    const response = await apiPost('/BusinessType', data, {
      headers: { 'Content-Type': 'application/json' },
    });
    const responseText = await readResponseOk(response, 'Failed to update business type');
    return normalizeBusinessType(parseJsonText<any>(responseText));
  } catch (error) {
    console.error('Error updating business type:', error);
    throw error;
  }
};

export const deleteBusinessType = async (businessTypeID: string): Promise<void> => {
  try {
    const response = await apiDelete(`/BusinessType/${businessTypeID}`, {
      headers: { accept: '*/*' },
    });
    await readResponseOk(response, 'Failed to delete business type');
  } catch (error) {
    console.error('Error deleting business type:', error);
    throw error;
  }
};


