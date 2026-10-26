/**
 * BlockDate API Service
 * Handles all API calls related to Block Dates
 */

import { apiDelete, apiGet, apiPost } from '@/utils/apiClient';
import {
  BlockDatePaginationParams,
  BlockDateResponse,
  CreateBlockDateRequest,
  UpdateBlockDateRequest,
} from '@/types/blockDate';
import { parseJsonText, readResponseOk } from '@/services/textPlainJson';
import { normalizeBlockDate } from '@/utils/normalizers';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';
import { PagedResponse } from '@/types/common';

export const getBlockDates = async (
  pagination?: BlockDatePaginationParams
): Promise<PagedResponse<BlockDateResponse>> => {
  try {
    const queryParams = buildPaginationQueryParams(pagination);
    if (pagination?.postId) {
      queryParams.set('postid', pagination.postId);
    }
    const endpoint = `/BlockDate${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await apiGet(endpoint);
    const responseText = await readResponseOk(response, 'Failed to fetch block dates');
    const parsed = JSON.parse(responseText) as { totalRecords?: number; data?: unknown[] } | unknown[];

    // Handle paginated response with data array
    if (parsed && typeof parsed === 'object' && 'data' in parsed && Array.isArray((parsed as any).data)) {
      const items = (parsed as any).data as Record<string, unknown>[];
      return {
        data: items.map((raw) => normalizeBlockDate(raw)),
        totalRecords: (parsed as any).totalRecords || items.length
      };
    }

    // Fallback to wrapping array in PagedResponse
    const items = (Array.isArray(parsed) ? parsed : []) as Record<string, unknown>[];
    return {
      data: items.map((raw) => normalizeBlockDate(raw)),
      totalRecords: items.length
    };
  } catch (error) {
    console.error('Error fetching block dates:', error);
    throw error;
  }
};

export const createBlockDate = async (
  data: CreateBlockDateRequest
): Promise<BlockDateResponse> => {
  try {
    const response = await apiPost('/BlockDate', data, {
      headers: { 'Content-Type': 'application/json' },
    });
    const responseText = await readResponseOk(response, 'Failed to create block date');
    return normalizeBlockDate(parseJsonText<any>(responseText));
  } catch (error) {
    console.error('Error creating block date:', error);
    throw error;
  }
};

export const updateBlockDate = async (
  data: UpdateBlockDateRequest
): Promise<BlockDateResponse> => {
  try {
    const response = await apiPost('/BlockDate', data, {
      headers: { 'Content-Type': 'application/json' },
    });
    const responseText = await readResponseOk(response, 'Failed to update block date');
    return normalizeBlockDate(parseJsonText<any>(responseText));
  } catch (error) {
    console.error('Error updating block date:', error);
    throw error;
  }
};

export const deleteBlockDate = async (blockDateId: string): Promise<void> => {
  try {
    const response = await apiDelete(`/BlockDate/${blockDateId}`, {
      headers: { accept: '*/*' },
    });
    await readResponseOk(response, 'Failed to delete block date');
  } catch (error) {
    console.error('Error deleting block date:', error);
    throw error;
  }
};
