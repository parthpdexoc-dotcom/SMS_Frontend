/**
 * Requester Authorized Types
 */

import type { Option } from './common';

export interface RequesterOption extends Option { }

export interface RequesterAuthorized {
  requesterAuthorizedID: string;
  requesterID: string;
  firstName: string;
  lastName: string;
  primaryPhone: string;
  secondaryPhone?: string;
  primaryEmail: string;
  secondaryEmail?: string;
  status: number; // 1 = Active, 0 = Inactive
  createdBy?: string | null;
  editedBy?: string | null;
  createdDate?: string | null;
  editedDate?: string | null;
}

// Response DTO that extends RequesterAuthorized with additional fields from backend
export interface RequesterAuthorizedResponseDto extends RequesterAuthorized {
  // Add any additional fields that might come from the backend response
}

export type RequesterAuthorizedFormMode = 'create' | 'edit';

export interface RequesterAuthorizedFormProps {
  mode?: RequesterAuthorizedFormMode;
  initialData?: RequesterAuthorized | null;
  requesterOptions?: RequesterOption[];
  /** Requester when opened from requester list (backend requesterID). */
  requesterID?: string;
  /** Requester display name (from getallrequesterwithdetails). */
  requesterName?: string;
  onSuccess?: (data: RequesterAuthorized) => void;
  onCancel?: () => void;
  className?: string;
}

export interface CreateRequesterAuthorizedRequest {
  requesterID: string;
  firstName: string;
  lastName: string;
  primaryPhone: string;
  secondaryPhone?: string;
  primaryEmail: string;
  secondaryEmail?: string;
  status: number;
}

export interface UpdateRequesterAuthorizedRequest extends CreateRequesterAuthorizedRequest {
  requesterAuthorizedID: string;
}

export interface RequesterAuthorizedPaginationParams {
  page?: number;
  pageSize?: number;
  requesterId?: string;
}

export interface RequesterAuthorizedSearchParams extends RequesterAuthorizedPaginationParams {
  searchTerm?: string;
  isActive?: boolean;
}

/** GET GetAllActiveRequesterAuthorized (request form dropdown: active + optional selected inactive). */
export interface GetAllActiveRequesterAuthorizedParams extends RequesterAuthorizedPaginationParams {
  /** Include inactive rows so a saved selection still appears when editing. */
  selectedIds?: string[];
}

// UI filter for Requester Authorized table (client-side)
export enum RequesterAuthorizedStatusFilter {
  Active = 'active',
  Inactive = 'inactive',
}

export interface RequesterAuthorizedListProps {
  className?: string;
}

export interface DisplayRequesterAuthorized extends RequesterAuthorizedResponseDto {
  requesterName?: string;
}
