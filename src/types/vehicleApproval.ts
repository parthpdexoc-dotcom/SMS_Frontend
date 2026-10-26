/**
 * Approval type (matches backend ApprovalType enum).
 * Stored as int in ApprovalDetails.Type.
 */
export enum ApprovalType {
  SpecialEventApproval = 0,
  VehicleApproval = 1,
  PremitApproval = 2,
}

/**
 * Core Approval detail payload used by the frontend (ApprovalDetails table).
 * Represents the approval decision for a given request + routing group.
 */
export interface ApprovalDetail {
  /** DepartmentID - taken from requester/department context */
  departmentID: string;

  /** Primary key for ApprovalDetail (nullable for new records) */
  approvalDetailID: string | null;

  /** RequestID for the vehicle utilization request */
  requestID: string;

  /** Routing Group ID this approval applies to */
  routeToID: string;

  /** Optional comments from the approver */
  vehApproverComments?: string | null;

  /** Approval flag: true = approved, false = rejected, null = no decision yet */
  approved: boolean | null;

  /** Approval type (ApprovalType enum value). */
  type?: ApprovalType;
}

/**
 * Nested DTOs for the ApprovalDetail/approval-request-detail
 * response. This endpoint returns all data needed to render the
 * Vehicle Utilization Request details on the approval page.
 */
export interface VehicleApprovalRequesterInfoDto {
  name: string;
  /** Optional combined contact display string (e.g. "Name - Phone") */
  contact?: string;
  /** Optional individual contact name when provided separately */
  contactName?: string;
  /** Optional phone number when provided separately */
  phone?: string;
  email: string;
}

export interface VehicleApprovalRequestVehicleInfoDto {
  requestedDate: string;
  vehiclesRequired: number;
  vehicleType: string;
}

export interface VehicleApprovalPostDetailDto {
  postStartTime: string;
  location: string;
  postTitle: string;
}

export interface ApprovalRoutingStatusDto {
  routingGroupId: string;
  isApproved: boolean | null;
  finalApproval: boolean;
}

/** Response DTO for ApprovalDetail/approval-request-detail */
export interface ApprovalRequestDetailResponseDto {
  requestId: string;
  routingGroupId: string;
  requesterInfo: VehicleApprovalRequesterInfoDto;
  requestVehicleInfo: VehicleApprovalRequestVehicleInfoDto;
  postDetails: VehicleApprovalPostDetailDto[];
  /** Optional approval flag for this routing group (if a decision was already made). */
  approved?: boolean | null;
  /** Per-routing-group approval status for this request. */
  approvalRouting?: ApprovalRoutingStatusDto[];
  /** When true, the current approver has already submitted; show "Vehicle Approval Recorded" confirmation screen. */
  alreadySubmittedByCurrentApprover?: boolean;
}

