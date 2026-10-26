/**
 * DepartmentAdmin DTOs and Types
 * Modeled after BusinessType master data.
 */

export interface CreateDepartmentAdminRequest {
  departmentAdminShort: string;
  departmentAdminLong: string;
  departmentAdminStatus: boolean;
  /**
   * Optional relational IDs used by the backend to link this record
   * to an Admin Type, Employee, and Department.
   * They are optional so existing endpoints that only rely on the
   * short/long fields continue to work.
   */
  employeeID?: string;
  adminTypeID?: string;
  departmentID?: string;
}

export interface UpdateDepartmentAdminRequest extends CreateDepartmentAdminRequest {
  departmentAdminID: string; // GUID as string (primary key)
}

export interface DepartmentAdminResponse {
  departmentAdminID: string;
  /** Foreign keys */
  employeeID?: string;
  adminTypeID?: string;
  departmentID?: string;

  /** Optional denormalized display values from backend */
  employeeName?: string | null;
  adminTypeName?: string | null;

  /** Legacy/master-data style fields (kept for compatibility) */
  departmentAdminShort: string;
  departmentAdminLong: string;
  departmentAdminStatus: boolean;
  createdDate: string | null;
  createdUserID: string | null;
  createdBy: string | null;
  editedDate: string | null;
  editedUserID: string | null;
  editedBy: string | null;
}

import { PaginationParams } from '@/utils/paginationUtils';

export interface DepartmentAdminPaginationParams extends PaginationParams {}

// UI props types for DepartmentAdmin components

export interface DepartmentAdminFormProps {
  initialData?: DepartmentAdminResponse | Partial<DepartmentAdminResponse> | null;
  onSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
  /** When opening from Department list, pass the row's department ID so it is always included in the save payload. */
  departmentId?: string;
  /** When set, Admin Type is fixed to this short name (e.g. 'IA Admin') and optionally disabled. */
  fixedAdminTypeShort?: string;
  /** When true, Admin Type dropdown is disabled (used with fixedAdminTypeShort). */
  disableAdminType?: boolean;
  /** When set (e.g. from Employee grid), Employee dropdown shows this employee and can be disabled. */
  fixedEmployeeID?: string;
  /** When true, Employee dropdown is disabled (used with fixedEmployeeID). */
  disableEmployee?: boolean;
  /** When true, Admin Type is shown as multi-select dropdown (checkboxes) and save creates/removes multiple DepartmentAdmin records. */
  adminTypeMultiSelect?: boolean;
}

export interface DepartmentAdminListProps {
  className?: string;
}


