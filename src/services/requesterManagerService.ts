/**
 * Requester Manager API Service
 */

import type {
  RequesterManager,
  CreateRequesterManagerRequest,
  UpdateRequesterManagerRequest,
  RequesterManagerPaginationParams,
} from '@/types/requesterManager';
import { apiGet, apiPost, apiDelete } from '@/utils/apiClient';
import { expectOkReadText, getErrorMessageFromErrorResponse, parseJsonText } from '@/services/textPlainJson';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';
import { normalizeRequesterManager } from '@/utils/normalizers';
import { HttpStatus } from '@/constants/httpStatus';
import { PagedResponse } from '@/types/common';
import type { SelectOptionDto } from '@/types/common';

const ENDPOINT = '/RequesterManager';

export type RequesterManagerOptionsParams = {
  searchTerm?: string;
  requesterId?: string;
  selectedId?: string;
};

export const getRequesterManagerOptions = async (
  params?: RequesterManagerOptionsParams
): Promise<SelectOptionDto[]> => {
  const body: Record<string, unknown> = {};
  const trimmedSearch = params?.searchTerm?.trim();
  if (trimmedSearch) body.searchTerm = trimmedSearch;
  const requesterId = params?.requesterId?.trim();
  if (requesterId) body.requesterId = requesterId;
  const selectedId = params?.selectedId?.trim();
  if (selectedId) body.selectedId = selectedId;
  const response = await apiPost(`${ENDPOINT}/requestermanageroptions`, body, {
    headers: { 'Content-Type': 'application/json' },
  });
  const responseText = await expectOkReadText(response, 'Failed to fetch requester manager options');
  return parseJsonText<SelectOptionDto[]>(responseText);
};

export const getAvailableRequesterManagerEmployeeOptions = async (params?: {
  requesterId?: string;
  searchTerm?: string;
}): Promise<SelectOptionDto[]> => {
  const body: Record<string, unknown> = {};
  const requesterId = params?.requesterId?.trim();
  const searchTerm = params?.searchTerm?.trim();
  if (requesterId) body.requesterId = requesterId;
  if (searchTerm) body.searchTerm = searchTerm;

  const response = await apiPost(`${ENDPOINT}/availableemployeeoptions`, body, {
    headers: { 'Content-Type': 'application/json' },
  });
  const responseText = await expectOkReadText(response, 'Failed to fetch available manager employee options');
  return parseJsonText<SelectOptionDto[]>(responseText);
};

// New response type to match backend DTO
export interface RequestManagerResponseDto extends RequesterManager {
  employeeName?: string;
}

export const getRequesterManagerList = async (
  pagination?: RequesterManagerPaginationParams
): Promise<PagedResponse<RequesterManager>> => {
  const queryParams = buildPaginationQueryParams(pagination);
  if (pagination?.requesterId) {
    queryParams.set('requesterId', pagination.requesterId);
  }

  const endpoint = `/RequesterManager/getallRequestManagerwithdetails${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

  const response = await apiGet(endpoint);
  const responseText = await expectOkReadText(response, 'Failed to fetch requester manager list');

  const parsed = JSON.parse(responseText) as { totalRecords?: number; data?: unknown[] } | unknown[];
  
  // Handle paginated response with data array
  if (parsed && typeof parsed === 'object' && 'data' in parsed && Array.isArray((parsed as any).data)) {
    const items = (parsed as any).data as Record<string, unknown>[];
    return {
      data: items.map((raw) => normalizeRequesterManager(raw)),
      totalRecords: (parsed as any).totalRecords || items.length
    };
  }
  
  // Fallback to wrapping array in PagedResponse
  const items = (Array.isArray(parsed) ? parsed : []) as Record<string, unknown>[];
  return {
    data: items.map((raw) => normalizeRequesterManager(raw)),
    totalRecords: items.length
  };
};

/**
 * Returns the RequesterManager row for this requester + employee pair, or null if none (API 404).
 */
export const getRequesterManagerByRequesterAndEmployee = async (
  requesterID: string,
  employeeID: string
): Promise<RequesterManager | null> => {
  const params = new URLSearchParams({
    requesterId: requesterID.trim(),
    employeeId: employeeID.trim(),
  });
  const response = await apiGet(`${ENDPOINT}/by-requester-and-employee?${params.toString()}`);
  if (response.status === HttpStatus.NOT_FOUND) {
    return null;
  }
  const responseText = await expectOkReadText(response, 'Failed to look up requester manager');
  const raw = parseJsonText<Record<string, unknown>>(responseText);
  return normalizeRequesterManager(raw);
};

export const createRequesterManager = async (
  data: CreateRequesterManagerRequest
): Promise<RequesterManager> => {
  // Transform UI format to API format.
  const apiPayload = {
    RequesterID: data.requesterID,
    EmployeeID: data.employeeID,
    IsRequestShared: data.isRequestShared ?? false,
    IsEmployeeShared: data.isEmployeeShared ?? false,
  };
  const response = await apiPost(ENDPOINT, apiPayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  // Check for duplicate/conflict errors
  if (!response.ok) {
    const responseText = await response.text();
    const lowerText = responseText.toLowerCase();
    // Detect common duplicate/conflict error patterns
    if (
      response.status === 400 ||
      response.status === 409 ||
      lowerText.includes('already exists') ||
      lowerText.includes('duplicate') ||
      lowerText.includes('already assigned') ||
      lowerText.includes('conflict') ||
      lowerText.includes('unique constraint')
    ) {
      throw new Error('This employee is already assigned as a manager for this requester.');
    }

    throw new Error(`Failed to create requester manager: ${response.status} ${responseText}`);
  }

  const responseText = await expectOkReadText(response, 'Failed to create requester manager');
  const raw = JSON.parse(responseText) as Record<string, unknown>;
  return normalizeRequesterManager(raw);
};

export const updateRequesterManager = async (
  data: UpdateRequesterManagerRequest
): Promise<RequesterManager> => {
  // Transform UI format to API format (PascalCase)
  const apiPayload = {
    RequesterManagerID: data.requesterManagerID,
    RequesterID: data.requesterID,
    EmployeeID: data.employeeID,
    IsRequestShared: data.isRequestShared ?? false,
    IsEmployeeShared: data.isEmployeeShared ?? false,
  };
  const response = await apiPost(ENDPOINT, apiPayload, {
    headers: { 'Content-Type': 'application/json' },
  });
  const responseText = await expectOkReadText(response, 'Failed to update requester manager');
  const raw = JSON.parse(responseText) as Record<string, unknown>;
  return normalizeRequesterManager(raw);
};

/** Returns the response body text on success (for toast message). On error, throws with backend message only. */
export const deleteRequesterManager = async (requesterManagerID: string): Promise<string> => {
  const response = await apiDelete(`${ENDPOINT}/${requesterManagerID}`, {
    headers: { accept: '*/*' },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(getErrorMessageFromErrorResponse(text, 'Failed to delete requester manager'));
  }
  return text;
};
