/**
 * Requester Types
 */

import type { RequestInRequesterListDto, RequestResponse } from './request';
import type { PageParam } from './common';

// Base request types for creating/updating requesters
export interface CreateRequesterRequest {
  departmentDefinedNumber?: string;
  businessTypeID?: string | null;
  departmentQuestionnaireId?: string | null;
  status?: boolean;
  name?: string;
  address?: string;
  address2?: string;
  city?: string;
  state?: string;
  zip?: string;
  email?: string;
  phone?: string;
  primaryContact?: string;
  fax?: string;
  secondaryContact?: string;
  secondaryPhone?: string;
  invoiceBillingName?: string;
  invoiceContact?: string;
  invoiceAddress?: string;
  invoiceAddress2?: string;
  invoiceCity?: string;
  invoiceState?: string;
  invoiceZip?: string;
  invoicePhone?: string;
  invoicePhoneExt?: string;
  invoiceEmail?: string;
  invoiceFax?: string;
  isLiquorLicenseRequired?: boolean;
  liquorLicense?: string;
  billingNotes?: string;
  comments?: string;
  approvedForCivilians?: boolean;
  exemptFromExtract?: boolean;
  isChild?: boolean;
  notificationRecipients?: string;
  parentID?: string | null;
  // Skills requirements
  isSkillsRequired?: boolean;
  skillIDs?: string[] | null;
  isRequesterAuthorized?: boolean;
}

export interface UpdateRequesterRequest extends CreateRequesterRequest {
  requesterID: string;
}

// Response types
export interface RequesterResponse {
  requesterID: string;
  departmentDefinedNumber?: string;
  businessTypeID?: string | null;
  departmentQuestionnaireId?: string | null;
  businessType?: string; // From the response DTO
  status?: boolean;
  name?: string;
  address?: string;
  address2?: string;
  city?: string;
  state?: string;
  zip?: string;
  email?: string;
  phone?: string;
  primaryContact?: string;
  fax?: string;
  secondaryContact?: string;
  secondaryPhone?: string;
  invoiceBillingName?: string;
  invoiceContact?: string;
  invoiceAddress?: string;
  invoiceAddress2?: string;
  invoiceCity?: string;
  invoiceState?: string;
  invoiceZip?: string;
  invoicePhone?: string;
  invoicePhoneExt?: string;
  invoiceEmail?: string;
  invoiceFax?: string;
  isLiquorLicenseRequired?: boolean;
  liquorLicense?: string;
  billingNotes?: string;
  comments?: string;
  approvedForCivilians?: boolean;
  exemptFromExtract?: boolean;
  isChild?: boolean;
  notificationRecipients?: string;
  parentID?: string | null;
  // Skills requirements
  isSkillsRequired?: boolean;
  skillIDs?: string[] | null;
  isRequesterAuthorized?: boolean;
  createdDate?: string;
  createdUserID?: string;
  createdBy?: string;
  editedDate?: string;
  editedUserID?: string;
  editedBy?: string;
}

// Pagination types
export interface RequesterListParams {
  offset?: number;
  limit?: number;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface RequesterSearchParams extends RequesterListParams {
  searchTerm?: string;
}

export type RequestInRequesterListResponse = RequestResponse;

export interface RequesterWithRequestsListResponse {
  requesterID: string;
  requesterName: string;
  requestsCount: number;
  requests: RequestInRequesterListResponse[];
  hasUnpaidInvoice?: boolean;
}

/** Row from `RequesterRequestSummaryDto` (POST `/Requester/request-summaries`). */
export interface RequesterRequestSummaryDto {
  requesterId: string;
  requesterName: string;
  requestCount: number;
  projectNumbers: string[];
  /** Present when `searchText` is sent. */
  requests?: RequestInRequesterListDto[];
}

export type RequesterRequestSummary = RequesterRequestSummaryDto;

/** Filter body for POST `/Requester/request-summaries`. */
export interface RequesterRequestSummariesFilter {
  startDate?: string;
  endDate?: string;
  requestTypes?: number[];
  requestStatuses?: number[];
  requesterName?: string;
  /** When true, start/end dates filter schedule dates. */
  applyDateOnSchedules?: boolean;
  /** Schedule release types. */
  releaseAs?: number[];
  /** Matches requester name or request title. */
  searchText?: string;
  isShiftStartingWithin30Minutes?: boolean;
  pageParam?: PageParam;
}

/** Filter body for POST `/Request/requester-with-requests`. */
export interface RequesterWithRequestsFilter {
  pageParam?: {
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
  };
  requesterName?: string;
  requestStatuses?: number[];
  requestTypes?: number[];
  startDate?: string;
  endDate?: string;
}

/** Filter body for POST `/Request/requester-workspace-list` (unified daily + administration lists). */
export interface RequesterWorkspaceListFilter {
  isDailyWorkspace: boolean;
  startDate?: string;
  endDate?: string;
  requestStatuses?: number[];
  requestTypes?: number[];
  releaseAs?: number[];
  requesterName?: string;
  pageParam?: PageParam;
  applyDateOnSchedules?: boolean;
  searchText?: string;
  isShiftStartingWithin30Minutes?: boolean;
  includeCompleted?: boolean;
  /** Daily workspace lists: fetch every page (legacy summaries returned all rows in one call). */
  loadAllPages?: boolean;
}

// UI filter for Requester Authorized table (client-side)
export enum RequesterAuthorizedStatusFilter {
  Active = 'active',
  Inactive = 'inactive',
}

// Table column types for display
export interface RequesterTableColumn {
  key: keyof RequesterResponse;
  label: string;
  sortable?: boolean;
  width?: string;
}
