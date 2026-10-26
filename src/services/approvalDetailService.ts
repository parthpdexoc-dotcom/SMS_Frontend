/**
 * ApprovalDetail API Service (ApprovalDetails table).
 * Handles all API calls related to approval decisions.
 */

import { apiGet, apiGetAll, apiPost } from '@/utils/apiClient';
import {
  expectOkReadText,
  parseJsonText,
  parseJsonTextArray,
} from '@/services/textPlainJson';
import {
  ApprovalDetail,
  ApprovalType,
  ApprovalRequestDetailResponseDto,
} from '@/types/vehicleApproval';

export interface ApprovalDetailDto {
  approvalDetailID?: string | null;
  departmentID: string;
  requestID: string;
  routeToID: string;
  vehicleApproverComments?: string | null;
  approved: boolean;
  finalApproval: boolean;
  type?: ApprovalType;
}

/**
 * Create a new approval detail record.
 * Backend generates ApprovalDetailID and audit fields.
 */
export const createApprovalDetail = async (
  detail: ApprovalDetailDto
): Promise<ApprovalDetail> => {
  try {
    const response = await apiPost('/ApprovalDetail', detail, {
      headers: {
        'Content-Type': 'application/json',
        accept: 'text/plain',
      },
    });

    const responseText = await expectOkReadText(
      response,
      'Failed to save approval detail'
    );

    return parseJsonText<ApprovalDetail>(responseText);
  } catch (error) {
    console.error('Error saving approval detail:', error);
    throw error;
  }
};

/**
 * Get approval request detail (and related info) for a given
 * Request + Routing Group + optional approvalType.
 * Returns null when no record exists (404).
 */
export const getApprovalRequestDetail = async (
  requestId: string,
  routingGroupId: string,
  options?: { approvalType?: ApprovalType }
): Promise<ApprovalRequestDetailResponseDto | null> => {
  // Path-only URL (no query param names): .../approval-request-detail/{requestId}/{routingGroupId}/{approvalType}
  const approvalType = options?.approvalType ?? ApprovalType.SpecialEventApproval;
  const path = `/ApprovalDetail/approval-request-detail/${requestId}/${routingGroupId}/${approvalType}`;

  const response = await apiGet(path, {
    suppressForbiddenCallback: true,
  });

  if (!response.ok && response.status === 404) {
    return null;
  }

  const text = await expectOkReadText(
    response,
    'Failed to fetch approval detail for request and routing group'
  );

  return parseJsonText<ApprovalRequestDetailResponseDto>(text);
};

/**
 * Get all ApprovalDetail records for a given request, optionally filtered by approval type.
 * Used on the Request edit screen to see which routing groups have a decision.
 * Pass approvalType so only decisions for that flow are considered (e.g. SpecialEventApproval for the request's Approval Groups).
 */
export const getApprovalDetailsByRequestId = async (
  requestId: string,
  approvalType?: ApprovalType
): Promise<ApprovalDetail[]> => {
  const response = await apiGetAll(
    '/ApprovalDetail',
    undefined,
    {
      suppressForbiddenCallback: true,
    }
  );

  if (!response.ok && response.status === 404) {
    return [];
  }

  const text = await expectOkReadText(
    response,
    'Failed to fetch approval details for request'
  );

  const allDetails = parseJsonTextArray<ApprovalDetail>(text);
  return allDetails.filter(
    (item) =>
      item.requestID === requestId &&
      (approvalType === undefined || item.type === approvalType)
  );
};
