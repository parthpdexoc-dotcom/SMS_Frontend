/**
 * EmployeeStatus DTOs and Types
 */

export interface CreateEmployeeStatusRequest {
  statusShort: string;
  statusLong: string;
  status: boolean;
}

export interface UpdateEmployeeStatusRequest extends CreateEmployeeStatusRequest {
  employeeStatusID: string; // GUID as string (primary key)
}

export interface EmployeeStatusResponse {
  employeeStatusID: string;
  statusShort: string;
  statusLong: string;
  status: boolean;
  createdDate: string | null;
  createdUserID: string | null;
  createdBy: string | null;
  editedDate: string | null;
  editedUserID: string | null;
  editedBy: string | null;
}

import { PaginationParams } from '@/utils/paginationUtils';

export interface EmployeeStatusPaginationParams extends PaginationParams { }

export interface EmployeeStatusSearchParams extends EmployeeStatusPaginationParams {
  searchTerm?: string;
}


