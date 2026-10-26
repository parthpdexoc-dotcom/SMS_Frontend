/**
 * RequestApprovalRouting API Service
 * Handles all API calls related to Request Approval Routing
 */

import { RequestApprovalRoutingResponseDto } from '@/types/requestApprovalRouting';
import { expectOkReadText, parseJsonTextArray } from '@/services/textPlainJson';
import { apiGetAll } from '@/utils/apiClient';

/**
 * Gets all request approval routing records by request ID with routing group information.
 * @param requestId - The request ID to filter by
 * @returns Promise<RequestApprovalRoutingResponseDto[]>
 */
export const getRequestRoutingGroupsByRequestId = async (
  requestId: string
): Promise<RequestApprovalRoutingResponseDto[]> => {
  try {
    const endpoint = `/RequestApprovalRouting/request/${requestId}`;
    const response = await apiGetAll(endpoint);
    const responseText = await expectOkReadText(
      response,
      'Failed to fetch request routing groups by request ID'
    );
    return parseJsonTextArray<RequestApprovalRoutingResponseDto>(responseText);
  } catch (error) {
    console.error('Error fetching request routing groups by request ID:', error);
    throw error;
  }
};

