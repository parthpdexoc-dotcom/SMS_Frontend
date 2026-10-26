/**
 * Requester Authorized API Service
 */

import type {
  RequesterAuthorized,
  CreateRequesterAuthorizedRequest,
  UpdateRequesterAuthorizedRequest,
  RequesterAuthorizedSearchParams,
  GetAllActiveRequesterAuthorizedParams,
} from '@/types/requesterAuthorized';
import { apiGet, apiPost, apiDelete } from '@/utils/apiClient';
import { expectOkReadText, getErrorMessageFromErrorResponse, parseJsonText } from '@/services/textPlainJson';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';
import { normalizeRequesterAuthorized } from '@/utils/normalizers';
import { PagedResponse, SelectOptionDto } from '@/types/common';

const ENDPOINT = '/RequesterAuthorized';

export type RequesterAuthorizedOptionsParams = {
  searchTerm?: string;
  requesterId?: string;
  selectedId?: string;
};

export const getRequesterAuthorizedOptions = async (
  params?: RequesterAuthorizedOptionsParams
): Promise<SelectOptionDto[]> => {
  const body: Record<string, unknown> = {};
  const trimmedSearch = params?.searchTerm?.trim();
  if (trimmedSearch) body.searchTerm = trimmedSearch;
  const requesterId = params?.requesterId?.trim();
  if (requesterId) body.requesterId = requesterId;
  const selectedId = params?.selectedId?.trim();
  if (selectedId) body.selectedId = selectedId;
  const response = await apiPost(`${ENDPOINT}/requesterauthorizedoptions`, body, {
    headers: { 'Content-Type': 'application/json' },
  });
  const responseText = await expectOkReadText(response, 'Failed to fetch requester authorized options');
  return parseJsonText<SelectOptionDto[]>(responseText);
};

export const getRequesterAuthorizedList = async (
  pagination?: RequesterAuthorizedSearchParams
): Promise<PagedResponse<RequesterAuthorized>> => {
  const queryParams = buildPaginationQueryParams(pagination);
  if (pagination?.requesterId) {
    queryParams.set('requesterId', pagination.requesterId);
  }
  if (pagination?.isActive !== undefined) {
    queryParams.set('isActive', pagination.isActive.toString());
  }

  const endpoint = `${ENDPOINT}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

  const response = await apiGet(endpoint);
  const responseText = await expectOkReadText(response, 'Failed to fetch requester authorized list');

  const parsed = JSON.parse(responseText) as { totalRecords?: number; data?: unknown[] } | unknown[];
  
  // Handle paginated response with data array
  if (parsed && typeof parsed === 'object' && 'data' in parsed && Array.isArray((parsed as any).data)) {
    const items = (parsed as any).data as Record<string, unknown>[];
    return {
      data: items.map((raw) => normalizeRequesterAuthorized(raw)),
      totalRecords: (parsed as any).totalRecords || items.length
    };
  }
  
  // Fallback to wrapping array in PagedResponse
  const items = (Array.isArray(parsed) ? parsed : []) as Record<string, unknown>[];
  return {
    data: items.map((raw) => normalizeRequesterAuthorized(raw)),
    totalRecords: items.length
  };
};

/**
 * Active requester-authorized rows for form dropdowns (and inactive rows whose IDs are in selectedIds).
 * GET /RequesterAuthorized/GetAllActiveRequesterAuthorized
 */
export const getAllActiveRequesterAuthorized = async (
  params?: GetAllActiveRequesterAuthorizedParams
): Promise<PagedResponse<RequesterAuthorized>> => {
  const queryParams = buildPaginationQueryParams(params);
  const requesterId = params?.requesterId?.trim();
  if (requesterId) {
    queryParams.set('requesterId', requesterId);
  }
  const selectedIds = Array.from(
    new Set((params?.selectedIds ?? []).map((id) => String(id ?? '').trim()).filter(Boolean))
  );
  selectedIds.forEach((id) => queryParams.append('selectedIds', id));

  const q = queryParams.toString();
  const endpoint = `${ENDPOINT}/GetAllActiveRequesterAuthorized${q ? `?${q}` : ''}`;

  const response = await apiGet(endpoint);
  const responseText = await expectOkReadText(
    response,
    'Failed to fetch active requester authorized list'
  );

  const parsed = JSON.parse(responseText) as { totalRecords?: number; data?: unknown[] } | unknown[];

  if (parsed && typeof parsed === 'object' && 'data' in parsed && Array.isArray((parsed as any).data)) {
    const items = (parsed as any).data as Record<string, unknown>[];
    return {
      data: items.map((raw) => normalizeRequesterAuthorized(raw)),
      totalRecords: (parsed as any).totalRecords || items.length,
    };
  }

  const items = (Array.isArray(parsed) ? parsed : []) as Record<string, unknown>[];
  return {
    data: items.map((raw) => normalizeRequesterAuthorized(raw)),
    totalRecords: items.length,
  };
};

/**
 * Returns the RequesterAuthorized record by ID
 */
export const getRequesterAuthorizedById = async (
  requesterAuthorizedID: string
): Promise<RequesterAuthorized> => {
  const response = await apiGet(`${ENDPOINT}/${requesterAuthorizedID}`);
  const responseText = await expectOkReadText(response, 'Failed to fetch requester authorized');
  const raw = parseJsonText<Record<string, unknown>>(responseText);
  return normalizeRequesterAuthorized(raw);
};

export const createRequesterAuthorized = async (
  data: CreateRequesterAuthorizedRequest
): Promise<RequesterAuthorized> => {
  // Transform UI format to API format.
  const apiPayload = {
    RequesterID: data.requesterID,
    FirstName: data.firstName,
    LastName: data.lastName,
    PrimaryPhone: data.primaryPhone,
    SecondaryPhone: data.secondaryPhone || '',
    PrimaryEmail: data.primaryEmail,
    SecondaryEmail: data.secondaryEmail || '',
    Status: data.status,
  };
  const response = await apiPost(ENDPOINT, apiPayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const responseText = await expectOkReadText(response, 'Failed to create requester authorized');
  const raw = JSON.parse(responseText) as Record<string, unknown>;
  return normalizeRequesterAuthorized(raw);
};

export const updateRequesterAuthorized = async (
  data: UpdateRequesterAuthorizedRequest
): Promise<RequesterAuthorized> => {
  // Transform UI format to API format (PascalCase)
  const apiPayload = {
    RequesterAuthorizedID: data.requesterAuthorizedID,
    RequesterID: data.requesterID,
    FirstName: data.firstName,
    LastName: data.lastName,
    PrimaryPhone: data.primaryPhone,
    SecondaryPhone: data.secondaryPhone || '',
    PrimaryEmail: data.primaryEmail,
    SecondaryEmail: data.secondaryEmail || '',
    Status: data.status,
  };
  const response = await apiPost(ENDPOINT, apiPayload, {
    headers: { 'Content-Type': 'application/json' },
  });
  const responseText = await expectOkReadText(response, 'Failed to update requester authorized');
  const raw = JSON.parse(responseText) as Record<string, unknown>;
  return normalizeRequesterAuthorized(raw);
};

/** Returns the response body text on success (for toast message). On error, throws with backend message only. */
export const deleteRequesterAuthorized = async (requesterAuthorizedID: string): Promise<string> => {
  const response = await apiDelete(`${ENDPOINT}/${requesterAuthorizedID}`, {
    headers: { accept: '*/*' },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(getErrorMessageFromErrorResponse(text, 'Failed to delete requester authorized'));
  }
  return text;
};
