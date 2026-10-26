/**
 * DepartmentEquipment DTOs and Types
 */

import { PaginationParams } from "@/utils/paginationUtils";

export interface VehicleApprovalRoutingDto {
  vehicleApprovalRouteID?: string | null; // GUID as string, optional (null for new records)
  approverID: string; // GUID as string (routing group ID)
  departmentEquipmentID?: string; // GUID as string (set by backend, optional in request)
  rank: number; // 1-based ranking (1 = first approver, 2 = second, etc.)
  vehicleApproverHasFinalAuthority: boolean;
}

export interface VehicleApprovalRoutingResponseDto extends VehicleApprovalRoutingDto {
  routingGroupName?: string | null; // Routing group short name
}

export interface CreateDepartmentEquipmentRequest {
  equipmentTypeID: string; // GUID as string
  chargedType: number;
  charge: number;
  chargeMileage: boolean;
  mileageCharge: number;
  mileageCondition: number;
  equipmentStatus: boolean;
  requiresApproval: boolean;
  vehicleApprovalRoutings?: VehicleApprovalRoutingDto[] | null; // Array of VehicleApprovalRoutingDto, optional
  requiresUtilizationRecorded: boolean;
  isDefault: boolean;
}

export interface UpdateDepartmentEquipmentRequest extends CreateDepartmentEquipmentRequest {
  departmentEquipmentID: string; // GUID as string (primary key)
}

export enum DepartmentEquipmentCategory {
  Equipment = 0,
  Vehicle = 1
}

export interface DepartmentEquipmentResponse {
  departmentEquipmentID: string;
  equipmentTypeID: string;
  equipmentType: string; // Added field for name
  chargedType: number;
  charge: number;
  chargeMileage: boolean;
  mileageCharge: number;
  mileageCondition: number;
  equipmentStatus: boolean;
  requiresApproval: boolean;
  routingGroupID?: string | null; // GUID as string, optional (legacy single value)
  routingGroupIDs?: string[] | string | null; // Array of GUIDs, optional (for multi-select)
  vehicleApprovalRoutings?: VehicleApprovalRoutingDto[] | null; // Array of VehicleApprovalRoutingDto, optional
  requiresUtilizationRecorded: boolean;
  isDefault: boolean;
  /** From API; when absent, derived from equipment type. */
  isVehicle?: boolean;
  createdDate: string | null;
  createdUserID: string | null;
  createdBy: string | null;
  editedDate: string | null;
  editedUserID: string | null;
  editedBy: string | null;
}


export interface DepartmentEquipmentPaginationParams extends PaginationParams { }

export interface DepartmentEquipmentSearchParams extends DepartmentEquipmentPaginationParams {
  searchTerm?: string;
}
