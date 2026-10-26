/**
 * RequesterRestricted API Service
 * Handles all API calls related to RequesterRestricted
 */

import {
  RequesterRestrict,
  CreateRequesterRestrictRequest,
  UpdateRequesterRestrictRequest,
  RequesterRestrictPaginationParams,
} from '@/types/requesterRestrict';
import { apiGet, apiPost } from '@/utils/apiClient';
import { expectOkReadText, parseJsonText, parseJsonTextArray } from '@/services/textPlainJson';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';
import { PagedResponse, SelectOptionDto } from '@/types/common';

/**
 * Get all requester restricted items with pagination
 * @param pagination - Optional pagination parameters
 * @returns Promise<PagedResponse<RequesterRestrict>>
 */
export const getRequesterRestrictedList = async (
  pagination?: RequesterRestrictPaginationParams
): Promise<PagedResponse<RequesterRestrict>> => {
  try {
    const queryParams = buildPaginationQueryParams(pagination);
    if (pagination?.requesterId) {
      queryParams.set('requesterId', pagination.requesterId);
    }
    const endpoint = `/RequesterRestrictedList${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await apiGet(endpoint);
    const responseText = await expectOkReadText(response, 'Failed to fetch requester restricted list');
    const parsed = parseJsonText<unknown>(responseText);

    // Handle paginated response with data array
    if (parsed && typeof parsed === 'object' && 'data' in parsed && Array.isArray((parsed as any).data)) {
      return parsed as PagedResponse<RequesterRestrict>;
    }

    // Fallback to wrapping array in PagedResponse
    const data = parseJsonTextArray<RequesterRestrict>(responseText);
    return {
      data,
      totalRecords: data.length
    };
  } catch (error) {
    console.error('Error fetching requester restricted list:', error);
    throw error;
  }
};

/**
 * Create a new requester restrict
 * @param data - The requester restrict data to create
 * @returns Promise<RequesterRestrict>
 */
export const createRequesterRestrict = async (
  data: CreateRequesterRestrictRequest
): Promise<RequesterRestrict> => {
  try {
    const response = await apiPost('/RequesterRestrictedList', data, {
      headers: { 'Content-Type': 'application/json' },
    });
    const responseText = await expectOkReadText(response, 'Failed to create requester restrict');
    return parseJsonText<RequesterRestrict>(responseText);
  } catch (error) {
    console.error('Error creating requester restrict:', error);
    throw error;
  }
};

/**
 * Update an existing requester restrict
 * @param data - The requester restrict data to update (must include requesterRestrictID)
 * @returns Promise<RequesterRestrict>
 */
/**
 * Employee options for the restrict form (excludes already-restricted employees for the requester).
 */
export const getAvailableRestrictEmployeeOptions = async (params?: {
  requesterId?: string;
  searchTerm?: string;
}): Promise<SelectOptionDto[]> => {
  try {
    const body: Record<string, unknown> = {};
    const requesterId = params?.requesterId?.trim();
    const searchTerm = params?.searchTerm?.trim();
    if (requesterId) body.requesterId = requesterId;
    if (searchTerm) body.searchTerm = searchTerm;

    const response = await apiPost('/RequesterRestrictedList/availableemployeeoptions', body, {
      headers: { 'Content-Type': 'application/json' },
    });
    const responseText = await expectOkReadText(response, 'Failed to fetch available employee options');
    return parseJsonText<SelectOptionDto[]>(responseText);
  } catch (error) {
    console.error('Error fetching available restrict employee options:', error);
    throw error;
  }
};

export const updateRequesterRestrict = async (
  data: UpdateRequesterRestrictRequest
): Promise<RequesterRestrict> => {
  try {
    const response = await apiPost('/RequesterRestrictedList', data, {
      headers: { 'Content-Type': 'application/json' },
    });
    const responseText = await expectOkReadText(response, 'Failed to update requester restrict');
    return parseJsonText<RequesterRestrict>(responseText);
  } catch (error) {
    console.error('Error updating requester restrict:', error);
    throw error;
  }
};

