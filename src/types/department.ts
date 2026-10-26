/**
 * Department DTOs and Types
 */

export interface CreateDepartmentRequest {
  departmentCode?: string;
  departmentName?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  fax?: string;
  email?: string;
  domain?: string;
  active?: boolean;
  timeZoneId?: string;
  employeeDataFolderName?: string;
}

export interface UpdateDepartmentRequest extends CreateDepartmentRequest {
  departmentID: string; // GUID as string (primary key)
}

export interface DepartmentResponse {
  departmentID: string;
  departmentCode?: string;
  departmentName?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  fax?: string;
  email?: string;
  domain?: string;
  active?: boolean;
  timeZoneId?: string;
  employeeDataFolderName?: string;
  createdDate: string | null;
  createdUserID: string | null;
  createdBy: string | null;
  editedDate: string | null;
  editedUserID: string | null;
  editedBy: string | null;
}

import { PaginationParams } from '@/utils/paginationUtils';

export interface DepartmentPaginationParams extends PaginationParams { }

export interface DepartmentSearchParams extends DepartmentPaginationParams {
  searchTerm?: string;
}

export interface DepartmentLocationResponse {
  departmentID: string;
  departmentCode?: string;
  departmentName?: string;
  latitude?: number | null;
  longitude?: number | null;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  email?: string;
  timeZoneId?: string;
  active?: boolean;
}


