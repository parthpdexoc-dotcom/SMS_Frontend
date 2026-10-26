/**
 * DepartmentDivision DTOs and Types
 *
 * Backend names:
 * - DivisionID, DivisionShort, DivisionLong, DivisionActive
 */

export interface CreateDepartmentDivisionRequest {
  divisionShort: string;
  divisionLong: string;
  divisionActive: boolean;
}

export interface UpdateDepartmentDivisionRequest extends CreateDepartmentDivisionRequest {
  divisionID: string; // GUID as string (primary key)
}

export interface DepartmentDivisionResponse {
  divisionID: string;
  divisionShort: string;
  divisionLong: string;
  divisionActive: boolean;
  createdDate: string | null;
  createdUserID: string | null;
  createdBy: string | null;
  editedDate: string | null;
  editedUserID: string | null;
  editedBy: string | null;
}

import { PaginationParams } from '@/utils/paginationUtils';

export interface DepartmentDivisionPaginationParams extends PaginationParams { }

export interface DepartmentDivisionSearchParams extends DepartmentDivisionPaginationParams {
  searchTerm?: string;
}

export interface ActiveDepartmentDivisionParams {
  departmentId?: string;
  selectedId?: string;
}


