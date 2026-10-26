/**
 * RoutingGroup DTOs and Types
 */

import { PaginationParams } from '@/utils/paginationUtils';
import { ApprovalType } from '@/types/vehicleApproval';

export interface CreateRoutingGroupRequest {
  employeeIDs: string[];
  approverLong?: string;
  approverShort?: string;
  approverEmail?: string;
  approverStatus?: boolean;
  /** Optional. Each department can have only one routing group per approval type when set. */
  approvalType?: ApprovalType | null;
}

export interface UpdateRoutingGroupRequest extends CreateRoutingGroupRequest {
  routingGroupId: string; // GUID as string (primary key)
}

export interface RoutingGroupResponse {
  routingGroupId: string;
  employeeIDs: string[];
  approverLong: string | null;
  approverShort: string | null;
  approverEmail: string | null;
  approverStatus: boolean;
  /** Optional. SpecialEventApproval (0) or VehicleApproval (1). Each department has at most one per type when set. */
  approvalType?: ApprovalType | null;
  /** From getallroutinggroupdetails API – employee names for grid Employees column */
  employeeNames?: string[];
  createdDate: string | null;
  createdUserID: string | null;
  createdBy: string | null;
  editedDate: string | null;
  editedUserID: string | null;
  editedBy: string | null;
}

export interface RoutingGroupPaginationParams extends PaginationParams {}

export interface RoutingGroupSearchParams extends RoutingGroupPaginationParams {
  searchTerm?: string;
}
