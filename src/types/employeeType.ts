/**
 * EmployeeType DTOs and Types
 */

export interface CreateEmployeeTypeRequest {
  employeeTypeShort: string;
  employeeTypeLong: string;
  employeeTypeActive: boolean;
  payRate: number;
  premiumPayRate: number;
  rank?: number;
  /** Whether this employee type is considered a supervisor type */
  isSupervisor?: boolean;
  /** Whether this employee type is eligible for special assignments/posts */
  isEligible?: boolean;
}

export interface UpdateEmployeeTypeRequest extends CreateEmployeeTypeRequest {
  employeeTypeID: string; // GUID as string (primary key)
  /** Employee type IDs that share the same rank (excludes self); sent on update */
  sameRankIds?: string[];
}

export interface EmployeeTypeResponse {
  employeeTypeID: string;
  employeeTypeShort: string;
  employeeTypeLong: string;
  employeeTypeActive: boolean;
  payRate?: number | null;
  premiumPayRate?: number | null;
  holidayPayRate?: number | null;
   /** True when this type is a supervisor-level type */
   isSupervisor?: boolean | null;
   /** True when this type is eligible (for selection/assignment rules) */
   isEligible?: boolean | null;
  rank: number;
  createdDate: string | null;
  createdUserID: string | null;
  createdBy: string | null;
  editedDate: string | null;
  editedUserID: string | null;
  editedBy: string | null;
  /** IDs of other employee types at the same rank (from API SameRankIds / sameRankIds) */
  sameRankIds?: string[];
}

import { PaginationParams } from '@/utils/paginationUtils';

export interface EmployeeTypePaginationParams extends PaginationParams { }

export interface EmployeeTypeSearchParams extends EmployeeTypePaginationParams {
  searchTerm?: string;
}

export interface ActiveEmployeeTypeParams {
  departmentId?: string;
  selectedId?: string;
}


