/**
 * ResponseArea DTOs and Types
 * Aligned with DepartmentResponseArea entity (DepartmentResponseAreaID, DepartmentID, etc.)
 */

// Request DTO for creating a response area
export interface CreateResponseAreaRequest {
  departmentID: string;
  responseAreaShort: string;
  responseAreaLong: string;
  responseAreaStatus: boolean;
}

// Request DTO for updating a response area
export interface UpdateResponseAreaRequest extends CreateResponseAreaRequest {
  responseAreaID: string; // GUID as string (DepartmentResponseAreaID)
}

// Response DTO from API (normalized from DepartmentResponseArea)
export interface ResponseAreaResponse {
  responseAreaID: string;
  departmentID: string;
  responseAreaShort: string;
  responseAreaLong: string;
  responseAreaStatus: boolean;
  createdDate: string | null;
  createdUserID: string | null;
  createdBy: string | null;
  editedDate: string | null;
  editedUserID: string | null;
  editedBy: string | null;
}

import { PaginationParams } from '@/utils/paginationUtils';

/** Pagination for GET (uses shared `PaginationParams`, including optional `isActive`). */
export type ResponseAreaPaginationParams = PaginationParams;

export interface ResponseAreaSearchParams extends ResponseAreaPaginationParams {
  searchTerm?: string;
}

