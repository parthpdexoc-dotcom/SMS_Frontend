/**
 * DepartmentActivityType DTOs and Types
 */

export interface CreateDepartmentActivityTypeRequest {
  activityTypeShort: string;
  activityTypeLong: string;
  activityTypeAbstract?: string | null;
  activityTypeStatus: boolean;
}

export interface UpdateDepartmentActivityTypeRequest extends CreateDepartmentActivityTypeRequest {
  departmentActivityTypeId: string; // GUID as string (primary key) - matches backend DepartmentActivityTypeDto
}

/** Matches backend DepartmentActivityTypeDto (DepartmentActivityTypeId, ActivityTypeShort, etc.) */
export interface DepartmentActivityTypeResponse {
  departmentActivityTypeId: string;
  activityTypeShort: string;
  activityTypeLong: string;
  activityTypeAbstract?: string | null;
  /** Source indicator from backend (e.g. MASTER for system-seeded rows). */
  valueBy?: string | null;
  activityTypeStatus: boolean;
  createdDate: string | null;
  createdUserID: string | null;
  createdBy: string | null;
  editedDate: string | null;
  editedUserID: string | null;
  editedBy: string | null;
}

import { PaginationParams } from '@/utils/paginationUtils';

export interface DepartmentActivityTypePaginationParams extends PaginationParams { }

export interface DepartmentActivityTypeSearchParams extends DepartmentActivityTypePaginationParams {
  searchTerm?: string;
}


