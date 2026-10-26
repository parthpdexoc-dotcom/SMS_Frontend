/**
 * PayCode API Service
 * Mirrors BusinessType service shape.
 */

import { apiDelete, apiGet, apiPost } from '@/utils/apiClient';
import {
  CreatePayCodeRequest,
  PayCodePaginationParams,
  PayCodeResponse,
  UpdatePayCodeRequest,
} from '@/types/payCode';
import type { SelectOptionDto } from '@/types/common';
import { expectOkReadText, parseJsonText, parseJsonTextArray, parsePagedListJson, readResponseOk } from '@/services/textPlainJson';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';

type ActivePayCodeParams = {
  selectedId?: string;
};

/**
 * Lightweight pay code options for dropdowns.
 * Backend returns SelectOptionDto[] directly; no extra frontend mapping here.
 */
export const getPayCodeOptions = async (
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
    const response = await apiPost('/PayCode/paycodeoptions', body, {
      headers: { 'Content-Type': 'application/json' },
    });
    const responseText = await expectOkReadText(response, 'Failed to fetch pay code options');
    return parseJsonText<SelectOptionDto[]>(responseText);
  } catch (error) {
    console.error('Error fetching pay code options:', error);
    throw error;
  }
};

export const getActivePayCodes = async (params?: ActivePayCodeParams): Promise<PayCodeResponse[]> => {
  try {
    const selectedId = typeof params?.selectedId === 'string' ? params.selectedId.trim() : '';
    const path =
      selectedId === ''
        ? '/PayCode/getAllActivePayCodes'
        : `/PayCode/getAllActivePayCodes?${new URLSearchParams({ selectedId }).toString()}`;
    const response = await apiGet(path);
    const responseText = await expectOkReadText(response, 'Failed to fetch active pay codes');
    return parseJsonTextArray<PayCodeResponse>(responseText);
  } catch (error) {
    throw error;
  }
};

export const getPayCodes = async (
  pagination?: PayCodePaginationParams
): Promise<{ data: PayCodeResponse[]; totalRecords: number }> => {
  const queryParams = buildPaginationQueryParams(pagination);
  
  // Add isActive parameter if provided
  if (pagination?.isActive !== undefined) {
    queryParams.append('isActive', pagination.isActive.toString());
  }
  
  const endpoint = `/PayCode${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await apiGet(endpoint);
  const responseText = await expectOkReadText(response, 'Failed to fetch pay codes');
  return parsePagedListJson(responseText, (row) => row as unknown as PayCodeResponse);
};

export const createPayCode = async (
  data: CreatePayCodeRequest
): Promise<PayCodeResponse> => {
  const response = await apiPost('/PayCode', data, {
    headers: { 'Content-Type': 'application/json' },
  });
  const responseText = await readResponseOk(response, 'Failed to create pay code');
  return parseJsonText<PayCodeResponse>(responseText);
};

export const updatePayCode = async (
  data: UpdatePayCodeRequest
): Promise<PayCodeResponse> => {
  const response = await apiPost('/PayCode', data, {
    headers: { 'Content-Type': 'application/json' },
  });
  const responseText = await readResponseOk(response, 'Failed to update pay code');
  return parseJsonText<PayCodeResponse>(responseText);
};

export const deletePayCode = async (payCodeID: string): Promise<void> => {
  const response = await apiDelete(`/PayCode/${payCodeID}`, {
    headers: { accept: '*/*' },
  });
  await readResponseOk(response, 'Failed to delete pay code');
};

