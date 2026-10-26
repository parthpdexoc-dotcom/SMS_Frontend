/**
 * RoutingGroup API Service
 * Handles all API calls related to Routing Groups
 */

import { apiDelete, apiGet, apiPost } from '@/utils/apiClient';
import {
  RoutingGroupPaginationParams,
  RoutingGroupResponse,
  CreateRoutingGroupRequest,
  UpdateRoutingGroupRequest,
} from '@/types/routingGroup';
import { expectOkReadText, parseJsonText, parsePagedListJson, readResponseOk } from '@/services/textPlainJson';
import { normalizeRoutingGroup } from '@/utils/normalizers';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';

/**
 * Get all routing groups with details (including employeeNames for grid).
 * Backend now returns paged list payloads ({ data, totalRecords }).
 */
export const getAllRoutingGroupDetails = async (): Promise<{ data: RoutingGroupResponse[]; totalRecords: number }> => {
  try {
    const response = await apiGet('/RoutingGroup/getallroutinggroupdetails');
    const responseText = await expectOkReadText(response, 'Failed to fetch routing group details');
    return parsePagedListJson(responseText, (row) => normalizeRoutingGroup(row));
  } catch (error) {
    console.error('Error fetching routing group details:', error);
    throw error;
  }
};

export const getRoutingGroups = async (
  pagination?: RoutingGroupPaginationParams
): Promise<{ data: RoutingGroupResponse[]; totalRecords: number }> => {
  try {
    const queryParams = buildPaginationQueryParams(pagination);

    const endpoint = `/RoutingGroup${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await apiGet(endpoint);
    const responseText = await expectOkReadText(response, 'Failed to fetch routing groups');
    return parsePagedListJson(responseText, (row) => normalizeRoutingGroup(row));
  } catch (error) {
    console.error('Error fetching routing groups:', error);
    throw error;
  }
};

export const createRoutingGroup = async (
  data: CreateRoutingGroupRequest
): Promise<RoutingGroupResponse> => {
  try {
    const response = await apiPost('/RoutingGroup', data, {
      headers: { 'Content-Type': 'application/json' },
    });
    const responseText = await readResponseOk(response, 'Failed to create routing group');
    return normalizeRoutingGroup(parseJsonText<any>(responseText));
  } catch (error) {
    console.error('Error creating routing group:', error);
    throw error;
  }
};

export const updateRoutingGroup = async (
  data: UpdateRoutingGroupRequest
): Promise<RoutingGroupResponse> => {
  try {
    const response = await apiPost('/RoutingGroup', data, {
      headers: { 'Content-Type': 'application/json' },
    });
    const responseText = await readResponseOk(response, 'Failed to update routing group');
    return normalizeRoutingGroup(parseJsonText<any>(responseText));
  } catch (error) {
    console.error('Error updating routing group:', error);
    throw error;
  }
};

export const deleteRoutingGroup = async (routingGroupId: string): Promise<void> => {
  try {
    const response = await apiDelete(`/RoutingGroup/${routingGroupId}`, {
      headers: { accept: '*/*' },
    });
    await readResponseOk(response, 'Failed to delete routing group');
  } catch (error) {
    console.error('Error deleting routing group:', error);
    throw error;
  }
};
