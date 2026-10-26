/**
 * RequestApprovalRouting DTOs and Types
 */

export interface RequestApprovalRoutingDto {
  requestApprovalRouteID?: string | null; // GUID as string, optional (null for new records)
  approverID: string; // GUID as string (routing group ID)
  requestID?: string; // GUID as string (set by backend, optional in request)
  rank: number; // 1-based ranking (1 = first approver, 2 = second, etc.)
  requestApproverHasFinalAuthority: boolean;
}

export interface RequestApprovalRoutingResponseDto extends RequestApprovalRoutingDto {
  routingGroupName?: string | null; // Routing group short name
  approvalType: number;
}

