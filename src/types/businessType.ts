/**
 * BusinessType DTOs and Types
 */

export interface CreateBusinessTypeRequest {
  businessTypeShort: string;
  businessTypeLong: string;
  businessTypeStatus: boolean;
}

export interface UpdateBusinessTypeRequest extends CreateBusinessTypeRequest {
  businessTypeID: string; // GUID as string (primary key)
}

export interface BusinessTypeResponse {
  businessTypeID: string;
  businessTypeShort: string;
  businessTypeLong: string;
  businessTypeStatus: boolean;
  createdDate: string | null;
  createdUserID: string | null;
  createdBy: string | null;
  editedDate: string | null;
  editedUserID: string | null;
  editedBy: string | null;
}

import { PaginationParams } from '@/utils/paginationUtils';

export interface BusinessTypePaginationParams extends PaginationParams { }

export interface BusinessTypeSearchParams extends BusinessTypePaginationParams {
  searchTerm?: string;
}


