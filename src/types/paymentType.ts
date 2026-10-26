/**
 * PaymentType master data DTOs (department-scoped).
 */

import { PaginationParams } from '@/utils/paginationUtils';

export interface CreatePaymentTypeRequest {
  name: string;
  isDefault: boolean;
}

export interface UpdatePaymentTypeRequest extends CreatePaymentTypeRequest {
  paymentTypeId: string;
}

export interface PaymentTypeResponse {
  paymentTypeId: string;
  name: string;
  isDefault: boolean;
  createdDate: string | null;
  createdUserID: string | null;
  createdBy: string | null;
  editedDate: string | null;
  editedUserID: string | null;
  editedBy: string | null;
  isDeleted: boolean;
  deletedAt: string | null;
  deletedUserID: string | null;
  deletedBy: string | null;
}

export interface PaymentTypePaginationParams extends PaginationParams {}

export interface PaymentTypeSearchParams extends PaymentTypePaginationParams {
  searchTerm?: string;
}
