/**
 * AdminType DTOs and Types
 */

export interface CreateAdminTypeRequest {
  adminTypeShort: string;
  adminTypeLong: string;
  adminTypeStatus: boolean;
  isManagePost: boolean;
  parentID?: string | null;
}

export interface UpdateAdminTypeRequest extends CreateAdminTypeRequest {
  adminTypeID: string; // GUID as string (primary key)
}

export interface AdminTypeResponse {
  adminTypeID: string;
  adminTypeShort: string;
  adminTypeLong: string;
  adminTypeStatus: boolean;
  isManagePost: boolean;
  parentID: string | null;
  createdDate: string | null;
  createdUserID: string | null;
  createdBy: string | null;
  editedDate: string | null;
  editedUserID: string | null;
  editedBy: string | null;
}

import { PaginationParams } from '@/utils/paginationUtils';

export interface AdminTypePaginationParams extends PaginationParams { }

export interface AdminTypeSearchParams extends AdminTypePaginationParams {
  searchTerm?: string;
}


