/**
 * HolidayDay API Service
 * Handles all API calls related to HolidayDays
 */

import { HolidayDayResponse, CreateHolidayDayRequest, UpdateHolidayDayRequest, HolidayDayPaginationParams } from '@/types/holidayDay';
import { apiGet, apiPost, apiDelete } from '@/utils/apiClient';
import { expectOkReadText, readResponseOk, parseJsonText, parsePagedListJson } from '@/services/textPlainJson';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';

/**
 * Get all holiday days
 * @param pagination - Optional pagination parameters
 * @returns Promise<HolidayDayResponse[]>
 */
export const getHolidayDays = async (
  pagination?: HolidayDayPaginationParams
): Promise<{ data: HolidayDayResponse[]; totalRecords: number }> => {
  try {
    const queryParams = buildPaginationQueryParams(pagination);
    const endpoint = `/HolidayDay${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await apiGet(endpoint);
    const responseText = await expectOkReadText(response, 'Failed to fetch holiday days');
    return parsePagedListJson(responseText, (row) => row as unknown as HolidayDayResponse);
  } catch (error) {
    console.error('Error fetching holiday days:', error);
    throw error;
  }
};

/**
 * Create a new holiday day
 * @param data - The holiday day data to create
 * @returns Promise<HolidayDayResponse>
 */
export const createHolidayDay = async (data: CreateHolidayDayRequest): Promise<HolidayDayResponse> => {
  try {
    const response = await apiPost('/HolidayDay', data, {
      headers: { 'Content-Type': 'application/json' },
    });
    const responseText = await readResponseOk(response, 'Failed to create holiday day');
    return parseJsonText<HolidayDayResponse>(responseText);
  } catch (error) {
    console.error('Error creating holiday day:', error);
    throw error;
  }
};

/**
 * Update an existing holiday day
 * @param data - The holiday day data to update (must include holidayDayID)
 * @returns Promise<HolidayDayResponse>
 */
export const updateHolidayDay = async (data: UpdateHolidayDayRequest): Promise<HolidayDayResponse> => {
  try {
    const response = await apiPost('/HolidayDay', data, {
      headers: { 'Content-Type': 'application/json' },
    });
    const responseText = await readResponseOk(response, 'Failed to update holiday day');
    return parseJsonText<HolidayDayResponse>(responseText);
  } catch (error) {
    console.error('Error updating holiday day:', error);
    throw error;
  }
};

/**
 * Delete a holiday day by ID
 * @param holidayDayID - The ID of the holiday day to delete
 * @returns Promise<void>
 */
export const deleteHolidayDay = async (holidayDayID: string): Promise<void> => {
  try {
    const response = await apiDelete(`/HolidayDay/${holidayDayID}`, {
      headers: { accept: '*/*' },
    });
    await readResponseOk(response, 'Failed to delete holiday day');
  } catch (error) {
    console.error('Error deleting holiday day:', error);
    throw error;
  }
};
