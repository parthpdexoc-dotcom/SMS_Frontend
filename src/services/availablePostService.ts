import { apiGet, apiPost } from '@/utils/apiClient';
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants/tablePagination';
import { parseJsonText, parseJsonTextArray, expectOkReadText } from '@/services/textPlainJson';
import type { RequestFilterOption } from '@/types/availablePost';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';
import { SearchModel, AssignToMeRequest } from '@/types/availablePost';
import { PageParam } from '@/types/common';
import { ReleaseAs } from '@/types/request';
import { getPostPositionsByStatus } from '@/services/postPositionService';
import { PostPositionStatus } from '@/types/postPosition';
import type { EmployeePostListingItem } from '@/types/employeePostListingItem';
import { parseEmployeePostListingItem } from '@/utils/employeePostListingItem';

export interface PagedEmployeePostListingResponse {
  data: EmployeePostListingItem[];
  totalRecords: number;
  error?: string;
  hasOutstandingReadyToClosePost?: boolean;
}

function normalizeDashboardFilterOption(raw: unknown): RequestFilterOption {
  if (!raw || typeof raw !== 'object') return { id: '', title: '' };
  const o = raw as Record<string, unknown>;
  return {
    id: String(o.id ?? o.Id ?? '').trim(),
    title: String(o.label ?? o.Label ?? o.title ?? o.Title ?? '').trim(),
  };
}

/** Date-scoped requester options for Available Job filter (`POST /Request/dashboard-requesteroptions`). */
export const getDashboardRequesterFilterOptions = async (
  startDate: string,
  numberOfDays: number,
  searchTerm?: string
): Promise<RequestFilterOption[]> => {
  const queryParams = new URLSearchParams({
    startDate,
    numberOfDays: String(numberOfDays),
  });
  const body: Record<string, unknown> = {};
  const trimmedSearch = searchTerm?.trim();
  if (trimmedSearch) body.searchTerm = trimmedSearch;

  const response = await apiPost(
    `/Request/dashboard-requesteroptions?${queryParams.toString()}`,
    body,
    { headers: { 'Content-Type': 'application/json' } }
  );
  const responseText = await expectOkReadText(response, 'Failed to fetch requester filter options');
  return parseJsonTextArray<unknown>(responseText)
    .map(normalizeDashboardFilterOption)
    .filter((option) => option.id);
};

export const getAvailablePosts = async (
  searchModel: SearchModel,
  pagination?: PageParam,
  options?: { displayWaitingList?: boolean; employeeId?: string }
): Promise<PagedEmployeePostListingResponse> => {
  if (searchModel.releaseAs === ReleaseAs.Cancelled) {
    const result = await getPostPositionsByStatus(PostPositionStatus.CancellationPending, {
      page: pagination?.page ?? 1,
      pageSize: pagination?.pageSize ?? DEFAULT_TABLE_PAGE_SIZE,
      isOngoing: false,
      ...(options?.employeeId?.trim() ? { employeeID: options.employeeId.trim() } : {}),
      searchModel,
    });
    return {
      data: result.data ?? [],
      totalRecords: result.totalRecords ?? 0,
    };
  }

  const queryParams = buildPaginationQueryParams(pagination);
  // Supervisor Employee Jobs view: scope to selected employee instead of the JWT employee.
  if (options?.employeeId?.trim()) queryParams.append('employeeId', options.employeeId.trim());
  if (searchModel.startDate) queryParams.append('StartDate', searchModel.startDate);
  if (searchModel.numberOfDays) queryParams.append('NumberOfDays', searchModel.numberOfDays.toString());
  if (searchModel.releaseAs !== undefined && searchModel.releaseAs !== null) {
    queryParams.append('ReleaseAs', searchModel.releaseAs.toString());
  }
  const requesterFilter = searchModel.requester?.trim();
  if (requesterFilter) queryParams.append('Requester', requesterFilter);
  const payCodeFilter = searchModel.payCode?.trim();
  if (payCodeFilter) queryParams.append('PayCode', payCodeFilter);
  if (options?.displayWaitingList) {
    queryParams.append('DisplayWaitingList', 'true');
  }

  const queryString = queryParams.toString();
  const endpoint = `/Request/available-post${queryString ? `?${queryString}` : ''}`;

  const response = await apiGet(endpoint);
  const responseText = await expectOkReadText(response, 'Failed to fetch available jobs');
  const parsed = parseJsonText<{
    data?: unknown[];
    totalRecords?: number;
    error?: string;
    hasOutstandingReadyToClosePost?: boolean;
  }>(responseText);
  const rawList = Array.isArray(parsed?.data) ? parsed.data : [];

  return {
    data: rawList.map(parseEmployeePostListingItem),
    totalRecords: parsed?.totalRecords ?? rawList.length,
    error: parsed?.error,
    hasOutstandingReadyToClosePost: parsed?.hasOutstandingReadyToClosePost ?? false,
  };
};

function coerceNumericStatus(raw: unknown): number | undefined {
  if (typeof raw === 'number' && !Number.isNaN(raw)) return raw;
  if (typeof raw === 'string' && raw.trim() !== '' && !Number.isNaN(Number(raw))) return Number(raw);
  return undefined;
}

function parseAssignPostToMeBody(responseText: string): {
  bodyStatus?: number;
  parsedMessage: string;
  hasTimeConflictRequiringConfirmation: boolean;
} {
  const trimmed = responseText.trim();
  if (!trimmed) return { parsedMessage: '', hasTimeConflictRequiringConfirmation: false };
  let parsed: unknown;
  try {
    parsed = parseJsonText<unknown>(responseText);
  } catch {
    return { parsedMessage: trimmed, hasTimeConflictRequiringConfirmation: false };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { parsedMessage: trimmed, hasTimeConflictRequiringConfirmation: false };
  }

  const pick = (obj: Record<string, unknown>) => {
    const rawSt = obj.status ?? obj.Status ?? obj.statusCode ?? obj.StatusCode;
    const bodyStatus = coerceNumericStatus(rawSt);
    const rawMsg = obj.message ?? obj.Message ?? obj.error ?? obj.Error ?? obj.title ?? obj.Title;
    const parsedMessage =
      rawMsg != null && String(rawMsg).trim() !== '' ? String(rawMsg).trim() : '';
    const hasTimeConflictRequiringConfirmation =
      obj.hasTimeConflictRequiringConfirmation === true ||
      obj.HasTimeConflictRequiringConfirmation === true;
    return { bodyStatus, parsedMessage, hasTimeConflictRequiringConfirmation };
  };

  const o = parsed as Record<string, unknown>;
  const top = pick(o);
  if (top.bodyStatus !== undefined || top.parsedMessage !== '') {
    return top;
  }
  const inner = o.data ?? o.Data;
  if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
    return pick(inner as Record<string, unknown>);
  }
  return top;
}

export function isCancelledSlotAvailablePositionsMessage(message?: string): boolean {
  const m = (message || '').toLowerCase();
  return m.includes('available position') && (m.includes('cancelled') || m.includes('canceled'));
}

export interface AssignPostToMeResponse {
  status: number;
  message: string;
  hasTimeConflictRequiringConfirmation: boolean;
}

export const applySpecialEventRequestToMe = async (
  requestId: string,
  dateOfWork: string
): Promise<AssignPostToMeResponse> => {
  const queryParams = new URLSearchParams();
  queryParams.append('requestId', requestId);
  queryParams.append('dateOfWork', String(dateOfWork ?? '').slice(0, 10));
  const endpoint = `/WaitingPostPosition/special-event?${queryParams.toString()}`;

  const response = await apiPost(endpoint);
  const responseText = await response.text();
  const { bodyStatus, parsedMessage } = parseAssignPostToMeBody(responseText);
  const httpStatus = response.status;
  const status =
    typeof bodyStatus === 'number'
      ? bodyStatus
      : httpStatus >= 400
        ? httpStatus
        : httpStatus === 204
          ? 200
          : 200;
  const message =
    (parsedMessage !== '' ? parsedMessage : '') ||
    (httpStatus >= 400 && responseText.trim() ? responseText.trim() : '');

  return { status, message, hasTimeConflictRequiringConfirmation: false };
};

export const assignTenurePositionToMe = async (
  assignData: AssignToMeRequest & { releaseAs?: ReleaseAs; confirmConflict?: boolean }
): Promise<AssignPostToMeResponse> => {
  const queryParams = new URLSearchParams();
  queryParams.append('postId', assignData.postID);
  queryParams.append('dateOfWork', assignData.startDate ?? assignData.dateOfWork);

  if (assignData.releaseAs !== undefined && assignData.releaseAs !== null) {
    queryParams.append('releaseAs', String(assignData.releaseAs));
  }
  if (assignData.confirmConflict !== undefined) {
    queryParams.append('confirmConflict', String(assignData.confirmConflict));
  }

  const endpoint = `/WaitingPostPosition/assign-tenure-position-to-me?${queryParams.toString()}`;

  const response = await apiGet(endpoint);
  const responseText = await response.text();
  // Same as assign-post-to-me: SuccessResult may use status/message or Status/Message
  const { bodyStatus, parsedMessage, hasTimeConflictRequiringConfirmation } = parseAssignPostToMeBody(responseText);
  const status = typeof bodyStatus === 'number' ? bodyStatus : 200;
  return {
    status,
    message: parsedMessage,
    hasTimeConflictRequiringConfirmation:
      hasTimeConflictRequiringConfirmation === true || status === 409,
  };
};

export const assignPostToMe = async (
  assignData: AssignToMeRequest & { confirmConflict?: boolean }
): Promise<AssignPostToMeResponse> => {
  const queryParams = new URLSearchParams();
  queryParams.append('postId', assignData.postID);
  queryParams.append('dateOfWork', assignData.startDate ?? assignData.dateOfWork);

  if (assignData.confirmConflict !== undefined) {
    queryParams.append('confirmConflict', assignData.confirmConflict.toString());
  }

  const ppId = (assignData.postPositionId ?? '').trim();
  if (ppId) {
    queryParams.append('postPositionId', ppId);
  }

  const endpoint = `/Request/assign-post-to-me?${queryParams.toString()}`;

  const response = await apiGet(endpoint);
  const responseText = await response.text();
  const trimmed = responseText.trim();
  const { bodyStatus, parsedMessage, hasTimeConflictRequiringConfirmation } = parseAssignPostToMeBody(responseText);

  const httpStatus = response.status;
  const status =
    typeof bodyStatus === 'number'
      ? bodyStatus
      : httpStatus >= 400
        ? httpStatus
        : httpStatus === 204
          ? 200
          : 200;

  const message =
    (parsedMessage !== '' ? parsedMessage : '') || (httpStatus >= 400 && trimmed ? trimmed : '');

  return {
    status,
    message,
    // assign-post-to-me uses StatusCode(409, { status, message }) without the flag; 409 always means overlap confirmation.
    hasTimeConflictRequiringConfirmation:
      hasTimeConflictRequiringConfirmation === true || status === 409,
  };
};
