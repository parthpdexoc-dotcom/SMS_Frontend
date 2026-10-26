/**
 * PayCode DTOs and Types
 */

export interface CreatePayCodeRequest {
  /** Mirrors PayCode.PayCodeValue */
  payCodeValue: string;
  /** Mirrors PayCode.PayCodeDescription */
  payCodeDescription: string;
  /** Mirrors PayCode.PayCodeStatus */
  payCodeStatus: boolean;
}

export interface UpdatePayCodeRequest extends CreatePayCodeRequest {
  /** Primary key (Guid as string) */
  payCodeID: string;
}

export interface PayCodeResponse {
  payCodeID: string;
  /** Short code/value used on posts */
  payCodeValue: string;
  /** Human‑readable description */
  payCodeDescription: string;
  payCodeStatus: boolean | null;
  createdDate: string | null;
  createdUserID: string | null;
  createdBy: string | null;
  editedDate: string | null;
  editedUserID: string | null;
  editedBy: string | null;
}

import type { PaginationParams } from '@/utils/paginationUtils';

export interface PayCodePaginationParams extends PaginationParams {
  /** Optional; sent as `isActive` when APIs support `[FromQuery] bool? isActive`. */
  isActive?: boolean;
}

export interface PayCodeSearchParams extends PayCodePaginationParams {
  searchTerm?: string;
}

