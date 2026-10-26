/**
 * Requester API Service
 * Handles all API calls related to Requesters
 */

import {
  RequesterResponse,
  RequesterListParams,
  RequesterWithRequestsListResponse,
  RequesterRequestSummaryDto,
  RequesterRequestSummariesFilter,
  RequesterWithRequestsFilter,
  RequesterWorkspaceListFilter,
} from '@/types/requester';
import { PagedResponse, SelectOptionDto } from '@/types/common';
import { RequestResponse, RequestScheduleDto, RequestStatus, RequestTypes } from '@/types/request';
import { apiGet, apiPost, apiDelete } from '@/utils/apiClient';
import {
  expectOkReadText,
  parseJsonText,
  parsePagedListDto,
  readJsonNumber,
  readJsonString,
  readPagedListTotal,
  readResponseOk,
} from '@/services/textPlainJson';
import { normalizeRequester } from '@/utils/normalizers';
import { buildPaginationQueryParams, buildPageParamBody } from '@/utils/paginationUtils';
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants/tablePagination';
import {
  DEFAULT_REQUESTER_WITH_REQUESTS_STATUSES,
  DEFAULT_REQUESTER_WITH_REQUEST_TYPES,
} from '@/constants/dailyWorkspaceFilters';

export {
  DEFAULT_REQUESTER_WITH_REQUESTS_STATUSES,
  DEFAULT_REQUESTER_WITH_REQUEST_TYPES,
} from '@/constants/dailyWorkspaceFilters';

export const getRequesters = async (
  pagination?: RequesterListParams
): Promise<{ data: RequesterResponse[]; totalRecords: number }> => {
  try {
    const queryParams = buildPaginationQueryParams(pagination);
    const endpoint = `/Requester/getallrequesterwithdetails${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await apiGet(endpoint);
    const responseText = await expectOkReadText(response, 'Failed to fetch requesters');
    const pagedResponse = parseJsonText<PagedResponse<Record<string, unknown>>>(responseText);
    const requesters = (pagedResponse.data || []).map(normalizeRequester);
    const totalRecords = pagedResponse.totalRecords ?? 0;
    return { data: requesters, totalRecords };
  } catch (error) {
    console.error('Error fetching requesters:', error);
    throw error;
  }
};

export const upsertRequester = async (
  requesterData: Record<string, unknown>
): Promise<RequesterResponse> => {
  try {
    const response = await apiPost('/Requester', requesterData, {
      headers: { 'Content-Type': 'application/json' },
    });
    const responseText = await readResponseOk(response, 'Failed to save requester');
    return normalizeRequester(parseJsonText<Record<string, unknown>>(responseText));
  } catch (error) {
    console.error('Error saving requester:', error);
    throw error;
  }
};

/**
 * Get a single requester by ID with details
 * @param requesterId - The ID of the requester to fetch
 * @returns Promise<RequesterResponse>
 */
export const getRequesterOptions = async (
  searchTerm?: string
): Promise<SelectOptionDto[]> => {
  const body: Record<string, unknown> = {};
  const trimmedSearch = searchTerm?.trim();
  if (trimmedSearch) {
    body.searchTerm = trimmedSearch;
  }

  const response = await apiPost('/Requester/requesteroptions', body, {
    headers: { 'Content-Type': 'application/json' },
  });
  const responseText = await expectOkReadText(response, 'Failed to fetch requester options');
  return parseJsonText<SelectOptionDto[]>(responseText);
};

export const getRequesterById = async (requesterId: string): Promise<RequesterResponse> => {
  try {
    const response = await apiGet(`/Requester/${requesterId}`);
    const responseText = await expectOkReadText(response, 'Failed to fetch requester');
    return normalizeRequester(parseJsonText<Record<string, unknown>>(responseText));
  } catch (error) {
    console.error('Error fetching requester by ID:', error);
    throw error;
  }
};

export const deleteRequester = async (requesterId: string): Promise<void> => {
  try {
    const response = await apiDelete(`/Requester/${requesterId}`, {
      headers: { accept: '*/*' },
    });
    await readResponseOk(response, 'Failed to delete requester');
  } catch (error) {
    console.error('Error deleting requester:', error);
    throw error;
  }
};

const normalizeRequesterRequestListRow = (
  raw: Record<string, unknown>,
  fallbackRequesterID: string
): RequestResponse => {
  const requestID = readJsonString(raw, 'requestId', 'requestID', 'RequestID');
  const requesterID =
    readJsonString(raw, 'requesterId', 'requesterID', 'RequesterID') || fallbackRequesterID;
  const titleFromRaw = (raw as unknown as RequestResponse).title;
  const title =
    readJsonString(raw, 'title', 'Title', 'name', 'Name') ||
    (typeof titleFromRaw === 'string' ? titleFromRaw : '');
  const schedulesRaw = (raw.requestSchedules ?? raw.RequestSchedules) as Record<string, unknown>[] | undefined;
  const requestSchedules = Array.isArray(schedulesRaw) ? (schedulesRaw as unknown as RequestScheduleDto[]) : [];

  return {
    ...(raw as unknown as RequestResponse),
    requestID,
    requesterID,
    title,
    requestSchedules,
    requestSchedule: requestSchedules[0] ?? ((raw.requestSchedule ?? raw.RequestSchedule) as RequestResponse['requestSchedule']),
    posts: Array.isArray(raw.posts ?? raw.Posts) ? ((raw.posts ?? raw.Posts) as RequestResponse['posts']) : undefined,
    postCount: readJsonNumber(raw, 'postCount', 'PostCount'),
  };
};

const normalizeRequesterWorkspaceSummaryRow = (
  raw: Record<string, unknown>
): RequesterRequestSummaryDto => {
  const requesterId = readJsonString(raw, 'requesterId', 'requesterID', 'RequesterID');
  const requesterName = readJsonString(raw, 'requesterName', 'RequesterName');
  const requestsRaw = (raw.requests ?? raw.Requests) as Record<string, unknown>[] | undefined;
  const hasRequestCountField = ['requestCount', 'RequestCount', 'requestsCount', 'RequestsCount'].some(
    (key) => raw[key] !== undefined && raw[key] !== null
  );
  const requestCount = hasRequestCountField
    ? readJsonNumber(raw, 'requestCount', 'RequestCount', 'requestsCount', 'RequestsCount')
    : Array.isArray(requestsRaw)
      ? requestsRaw.length
      : 0;
  const projectRaw = raw.projectNumbers ?? raw.ProjectNumbers;
  const projectNumbers = Array.isArray(projectRaw)
    ? projectRaw.map((value) => String(value).trim()).filter(Boolean)
    : [];
  const requests = Array.isArray(requestsRaw)
    ? (requestsRaw as unknown as RequesterRequestSummaryDto['requests'])
    : undefined;

  return {
    requesterId,
    requesterName,
    requestCount,
    projectNumbers,
    ...(requests && requests.length > 0 ? { requests } : {}),
  };
};

function buildRequesterWorkspaceListBody(
  filters: RequesterWorkspaceListFilter
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    isDailyWorkspace: filters.isDailyWorkspace,
  };

  const startDateOnly = toDateOnly(filters.startDate);
  if (startDateOnly) body.startDate = startDateOnly;
  const endDateOnly = toDateOnly(filters.endDate);
  if (endDateOnly) body.endDate = endDateOnly;

  const nameTrimmed = filters.requesterName?.trim();
  if (nameTrimmed) body.requesterName = nameTrimmed;

  if (filters.requestStatuses && filters.requestStatuses.length > 0) {
    body.requestStatuses = filters.requestStatuses.map((status) => Number(status));
  }
  if (filters.requestTypes && filters.requestTypes.length > 0) {
    body.requestTypes = filters.requestTypes.map((type) => Number(type));
  }
  if (filters.releaseAs && filters.releaseAs.length > 0) {
    body.releaseAs = filters.releaseAs.map((value) => Number(value));
  }

  if (filters.pageParam) {
    body.pageParam = filters.pageParam;
  }
  if (filters.applyDateOnSchedules === true) {
    body.applyDateOnSchedules = true;
  }
  const searchText = filters.searchText?.trim();
  if (searchText) body.searchText = searchText;
  if (filters.isShiftStartingWithin30Minutes === true) {
    body.isShiftStartingWithin30Minutes = true;
  }
  if (filters.includeCompleted === true) {
    body.includeCompleted = true;
  }

  return body;
}

const fetchRequesterWorkspaceListOnce = async (
  filters: RequesterWorkspaceListFilter
): Promise<{ rows: Record<string, unknown>[]; totalRecords: number }> => {
  const body = buildRequesterWorkspaceListBody(filters);
  const response = await apiPost('/Request/requester-workspace-list', body, {
    headers: { 'Content-Type': 'application/json' },
  });
  const responseText = await expectOkReadText(response, 'Failed to fetch requester workspace list');
  const parsed = parseJsonText<unknown>(responseText);
  if (Array.isArray(parsed)) {
    const rows = parsed as Record<string, unknown>[];
    return { rows, totalRecords: rows.length };
  }
  const record = parsed as Record<string, unknown>;
  const dataRaw = record.data ?? record.Data;
  const rows = Array.isArray(dataRaw) ? (dataRaw as Record<string, unknown>[]) : [];
  const totalRecords = readPagedListTotal(record, rows.length);
  return { rows, totalRecords };
};

/** POST `/Request/requester-workspace-list` — unified daily workspace + Daily Administration lists. */
export const fetchRequesterWorkspaceList = async (
  filters: RequesterWorkspaceListFilter
): Promise<{ data: RequesterWithRequestsListResponse[] | RequesterRequestSummaryDto[]; totalRecords: number }> => {
  try {
    const shouldLoadAllDailyPages =
      filters.isDailyWorkspace && filters.loadAllPages === true && !filters.pageParam;

    if (!shouldLoadAllDailyPages) {
      const { rows, totalRecords } = await fetchRequesterWorkspaceListOnce(filters);
      if (filters.isDailyWorkspace) {
        return {
          data: rows.map(normalizeRequesterWorkspaceSummaryRow),
          totalRecords,
        };
      }
      return {
        data: rows.map(normalizeRequesterWithRequestsListRow),
        totalRecords,
      };
    }

    const pageSize = DEFAULT_TABLE_PAGE_SIZE;
    const baseFilters: RequesterWorkspaceListFilter = { ...filters, loadAllPages: false };
    let page = 1;
    let totalRecords = 0;
    const mergedRows: Record<string, unknown>[] = [];
    const seenRequesterIds = new Set<string>();

    for (;;) {
      const { rows, totalRecords: pageTotal } = await fetchRequesterWorkspaceListOnce({
        ...baseFilters,
        pageParam: {
          page,
          pageSize,
          sortBy: 'requesterName',
          sortDirection: 'asc',
        },
      });
      totalRecords = pageTotal;
      if (rows.length === 0) break;

      rows.forEach((raw) => {
        const id = readJsonString(raw, 'requesterId', 'requesterID', 'RequesterID');
        if (!id || seenRequesterIds.has(id)) return;
        seenRequesterIds.add(id);
        mergedRows.push(raw);
      });

      if (mergedRows.length >= totalRecords || rows.length < pageSize) break;
      page += 1;
      if (page > 500) break;
    }

    return {
      data: mergedRows.map(normalizeRequesterWorkspaceSummaryRow),
      totalRecords,
    };
  } catch (error) {
    console.error('Error fetching requester workspace list:', error);
    throw error;
  }
};

const normalizeRequesterWithRequestsListRow = (raw: Record<string, unknown>): RequesterWithRequestsListResponse => {
  const requesterName = readJsonString(raw, 'requesterName', 'RequesterName');
  const requesterID = readJsonString(raw, 'requesterId', 'requesterID', 'RequesterID');
  const requestsRaw = (raw.requests ?? raw.Requests) as Record<string, unknown>[] | undefined;
  return {
    requesterID,
    requesterName,
    requestsCount: readJsonNumber(raw, 'requestsCount', 'RequestsCount'),
    hasUnpaidInvoice: Boolean(raw.hasUnpaidInvoice ?? raw.HasUnpaidInvoice),
    requests: Array.isArray(requestsRaw)
      ? requestsRaw.map((requestRaw) => normalizeRequesterRequestListRow(requestRaw, requesterID))
      : [],
  };
};

function toDateOnly(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const ymd = trimmed.includes('T') ? trimmed.split('T')[0]! : trimmed;
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : undefined;
}

/**
 * @deprecated Legacy endpoint — kept for rollback. Use {@link fetchRequesterWorkspaceList} instead.
 * POST `/Requester/request-summaries`
 */
export const getRequesterRequestSummaries = async (
  filters: RequesterRequestSummariesFilter = {}
): Promise<{ data: RequesterRequestSummaryDto[]; totalRecords: number }> => {
  const endpoint = filters.isShiftStartingWithin30Minutes
    ? '/Requester/request-summaries?isShiftStartingWithin30Minutes=true'
    : '/Requester/request-summaries';

  const response = await apiPost(endpoint, filters, {
    headers: { 'Content-Type': 'application/json' },
  });
  const responseText = await expectOkReadText(response, 'Failed to fetch requester summaries');
  return parsePagedListDto<RequesterRequestSummaryDto>(responseText);
};

/**
 * @deprecated Legacy endpoint — kept for rollback. Use {@link fetchRequesterWorkspaceList} instead.
 * POST `/Request/requester-with-requests`
 */
export const getRequestersWithRequests = async (
  pagination?: RequesterListParams,
  requestStatuses: ReadonlyArray<RequestStatus> = DEFAULT_REQUESTER_WITH_REQUESTS_STATUSES,
  requestTypes: ReadonlyArray<RequestTypes> = DEFAULT_REQUESTER_WITH_REQUEST_TYPES,
  startDate?: string | null,
  endDate?: string | null,
  requesterName?: string | null
): Promise<{ data: RequesterWithRequestsListResponse[]; totalRecords: number }> => {
  try {
    const body: RequesterWithRequestsFilter = {};
    const pageParam = buildPageParamBody(pagination);
    if (pageParam) body.pageParam = pageParam;
    const nameTrimmed = requesterName?.trim();
    if (nameTrimmed) body.requesterName = nameTrimmed;
    if (requestStatuses.length > 0) {
      body.requestStatuses = requestStatuses.map((status) => Number(status));
    }
    if (requestTypes.length > 0) {
      body.requestTypes = requestTypes.map((type) => Number(type));
    }
    const startDateOnly = toDateOnly(startDate);
    if (startDateOnly) body.startDate = startDateOnly;
    const endDateOnly = toDateOnly(endDate);
    if (endDateOnly) body.endDate = endDateOnly;

    const response = await apiPost('/Request/requester-with-requests', body, {
      headers: { 'Content-Type': 'application/json' },
    });
    const responseText = await expectOkReadText(response, 'Failed to fetch requesters with requests');
    const pagedResponse = parseJsonText<PagedResponse<Record<string, unknown>>>(responseText);
    const data = (pagedResponse.data || []).map(normalizeRequesterWithRequestsListRow);
    return {
      data,
      totalRecords: pagedResponse.totalRecords ?? data.length,
    };
  } catch (error) {
    console.error('Error fetching requesters with requests:', error);
    throw error;
  }
};
