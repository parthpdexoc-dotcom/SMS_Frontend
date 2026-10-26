/**
 * Request API Service
 */

import {
  RequestResponse,
  RequestListParams,
  type RequestOneTimeDateChangeConflictDto,
  type RequesterRequestsFilter,
  type RequesterRequestsResponseDto,
  type RequesterRequestsWithLocationsResponseDto,
  type RequestPostsFilter,
  type RequestPostsResponseDto,
  type RequestPostPositionsFilter,
  type RequestPostPositionsResponseDto,
  type PostPositionInRequestListDto,
} from '@/types/request';
import { EmployeeResponse } from '@/types/employee';
import { apiGetAll, apiPost, apiGet, apiDelete } from '@/utils/apiClient';
import { downloadExcelFileFromResponse } from '@/utils/excelFileDownload';
import {
  ApiResponseError,
  expectOkReadText,
  getErrorMessageFromErrorResponse,
  getErrorMessagesFromResult,
  isSuccessResultFailure,
  parseJsonText,
  parseJsonTextArray,
  parsePagedListDto,
  parseRequestPostsResponseDto,
  readResponseOk,
} from '@/services/textPlainJson';
import type { EmployeePostLocation } from '@/types/employeePostLocation';
import type { InvoiceDto } from '@/types/invoice';
import { INVOICE_GRID } from '@/constants/strings';
import type { RosterResponse } from '@/types/roster';
import { normalizeEmployee } from '@/utils/normalizers';
import { buildPageParamBody } from '@/utils/paginationUtils';
import { extractYyyyMmDdPrefix } from '@/utils/dateTimeUtils';
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants/tablePagination';

export interface SendVehicleApprovalEmailsRequest {
  requestId: string;
  routingGroupId: string;
  systemUrl: string;
}

/** Backend filter uses PageParam.Offset / PageParam.Limit for Skip/Take. */
function buildPostPositionFilterPageParam(
  pageParam?: RequestPostPositionsFilter['pageParam']
): Record<string, unknown> {
  const page = Math.max(1, pageParam?.page ?? 1);
  const pageSize = Math.max(1, pageParam?.pageSize ?? DEFAULT_TABLE_PAGE_SIZE);
  const offset = (page - 1) * pageSize;
  return {
    page,
    pageSize,
    offset,
    limit: pageSize,
  };
}

export const getRequests = async (filters?: RequestListParams): Promise<RequestResponse[]> => {
  const response = await apiGetAll('/Request', filters);
  const responseText = await expectOkReadText(response, 'Failed to fetch requests');
  return parseJsonTextArray<RequestResponse>(responseText);
};

/** POST `/Request/requester-requests` */
export const getRequesterRequests = async (
  filters: RequesterRequestsFilter
): Promise<RequesterRequestsResponseDto> => {
  const body: Record<string, unknown> = {
    requesterId: filters.requesterId,
  };
  const startDate = filters.startDate?.trim();
  if (startDate) body.startDate = startDate;
  const endDate = filters.endDate?.trim();
  if (endDate) body.endDate = endDate;
  if (filters.requestStatuses?.length) {
    body.requestStatuses = filters.requestStatuses;
  }
  if (filters.requestTypes?.length) {
    body.requestTypes = filters.requestTypes;
  }
  const search = filters.search?.trim();
  if (search) body.search = search;
  if (filters.releaseAs?.length) {
    body.releaseAs = filters.releaseAs;
  }
  if (filters.applyDateOnSchedules) {
    body.applyDateOnSchedules = true;
  }
  const pageParam = buildPageParamBody(filters.pageParam);
  if (pageParam) body.pageParam = pageParam;

  const response = await apiPost('/Request/requester-requests', body, {
    headers: { 'Content-Type': 'application/json' },
  });
  const responseText = await expectOkReadText(response, 'Failed to fetch requester requests');
  const paged = parsePagedListDto<RequesterRequestsResponseDto['data'][number]>(responseText);
  const dto = parseJsonText<RequesterRequestsResponseDto>(responseText);
  return {
    ...dto,
    data: paged.data,
    totalRecords: paged.totalRecords,
  };
};

/** POST `/Request/requester-requests-with-locations?requesterId=` */
export const getRequesterRequestsWithLocations = async (
  requesterId: string
): Promise<RequesterRequestsWithLocationsResponseDto> => {
  const id = requesterId.trim();
  const response = await apiPost(
    `/Request/requester-requests-with-locations?requesterId=${encodeURIComponent(id)}`,
    {},
    { headers: { 'Content-Type': 'application/json' } }
  );
  const responseText = await expectOkReadText(response, 'Failed to fetch requester locations');
  const dto = parseJsonText<RequesterRequestsWithLocationsResponseDto>(responseText);
  const paged = parsePagedListDto<RequesterRequestsWithLocationsResponseDto['data'][number]>(
    responseText
  );
  return {
    ...dto,
    data: paged.data,
    totalRecords: paged.totalRecords,
  };
};

/** GET `/EmployeePostLocation/by-employee/{employeeId}?postPositionId=` */
export const getCoordinatesByEmployeeId = async (
  employeeId: string,
  postPositionId: string
): Promise<EmployeePostLocation[]> => {
  const id = employeeId.trim();
  const positionId = postPositionId.trim();
  const query = positionId ? `?postPositionId=${encodeURIComponent(positionId)}` : '';
  const response = await apiGet(
    `/EmployeePostLocation/by-employee/${encodeURIComponent(id)}${query}`
  );
  const text = await expectOkReadText(response, 'Failed to fetch employee locations');
  return parseJsonTextArray<EmployeePostLocation>(text);
};

/** POST `/Post/request-posts` */
export const getRequestPosts = async (filters: RequestPostsFilter): Promise<RequestPostsResponseDto> => {
  const body: Record<string, unknown> = {
    requestId: filters.requestId,
  };
  const search = filters.search?.trim();
  if (search) body.search = search;
  const pageParam = buildPageParamBody(filters.pageParam);
  if (pageParam) body.pageParam = pageParam;

  const response = await apiPost('/Post/request-posts', body, {
    headers: { 'Content-Type': 'application/json' },
  });
  const responseText = await expectOkReadText(response, 'Failed to fetch request posts');
  return parseRequestPostsResponseDto(responseText);
};

/** POST `/PostPosition/by-post/filter` */
export const getRequestPostPositions = async (
  filters: RequestPostPositionsFilter
): Promise<RequestPostPositionsResponseDto> => {
  const body: Record<string, unknown> = {
    postId: filters.postId,
  };
  const startDate = extractYyyyMmDdPrefix(filters.startDate);
  const endDate = extractYyyyMmDdPrefix(filters.endDate);
  if (startDate && endDate) {
    body.startDate = startDate;
    body.endDate = endDate;
  }
  const normalizedDates = (filters.dates ?? [])
    .map((date) => extractYyyyMmDdPrefix(date))
    .filter((date): date is string => Boolean(date));
  if (normalizedDates.length > 0) body.dates = normalizedDates;
  body.pageParam = buildPostPositionFilterPageParam(filters.pageParam);

  // Controller binds `isViewHistory` from the query string (`[FromQuery]`), not the body.
  const endpoint =
    typeof filters.isViewHistory === 'boolean'
      ? `/PostPosition/by-post/filter?isViewHistory=${filters.isViewHistory}`
      : '/PostPosition/by-post/filter';

  const response = await apiPost(endpoint, body, {
    headers: { 'Content-Type': 'application/json' },
  });
  const responseText = await expectOkReadText(response, 'Failed to fetch request post positions');
  const paged = parsePagedListDto<PostPositionInRequestListDto>(responseText);
  const dto = parseJsonText<RequestPostPositionsResponseDto>(responseText);
  return {
    data: paged.data,
    totalRecords: paged.totalRecords,
    dates: dto.dates ?? [],
  };
};

export class RequestOneTimeDateChangeConflictError extends Error {
    readonly status = 409;
    readonly conflict: RequestOneTimeDateChangeConflictDto;

    constructor(conflict: RequestOneTimeDateChangeConflictDto) {
        super(conflict.message || 'Request date change conflict');
        this.name = 'RequestOneTimeDateChangeConflictError';
        this.conflict = conflict;
    }
}

/**
 * Create or update a request (upsert operation)
 * @param requestData - The request data
 * @returns Promise<RequestResponse>
 */
export const upsertRequest = async (requestData: Record<string, unknown>): Promise<RequestResponse> => {
    try {
        const response = await apiPost('/Request', requestData, {
            headers: {
                'Content-Type': 'application/json',
            },
        });
        const responseText = await response.text();
        const message = getErrorMessageFromErrorResponse(responseText, 'Failed to save request');

        if (response.status === 409) {
            try {
                const conflict = parseJsonText<RequestOneTimeDateChangeConflictDto>(responseText);
                // Date-change conflicts include assigned rows; message-only 409s (e.g. premium pay-rate)
                // must fall through to requiresConfirmation so the confirm dialog can open.
                if (
                    Array.isArray(conflict.assignedPostPositions) &&
                    conflict.assignedPostPositions.length > 0
                ) {
                    throw new RequestOneTimeDateChangeConflictError(conflict);
                }
            } catch (error) {
                if (error instanceof RequestOneTimeDateChangeConflictError) {
                    throw error;
                }
            }
            throw { status: 409, message, requiresConfirmation: true };
        }
        if (!response.ok) {
            throw new ApiResponseError(message);
        }
        return parseJsonText<RequestResponse>(responseText);
    } catch (error) {
        console.error('Error saving request:', error);
        throw error;
    }
};

/**
 * Get a single request by ID
 * @param requestId - The ID of the request to fetch
 * @returns Promise<RequestResponse>
 */
export const getRequestById = async (requestId: string): Promise<RequestResponse> => {
    try {
        const response = await apiGet(`/Request/${requestId}`);
        const responseText = await expectOkReadText(response, 'Failed to fetch request');
        return parseJsonText<RequestResponse>(responseText);
    } catch (error) {
        console.error('Error fetching request by ID:', error);
        throw error;
    }
};

/**
 * GET /Request/{requestId}/assignable-employees — optional `searchTerm`.
 */
export const getAssignableEmployeesByRequestId = async (
  requestId: string,
  searchTerm?: string
): Promise<EmployeeResponse[]> => {
  try {
    const params = new URLSearchParams();
    const term = searchTerm?.trim();
    if (term) params.set('searchTerm', term);
    const qs = params.toString();
    const response = await apiGet(
      qs
        ? `/Request/${requestId}/assignable-employees?${qs}`
        : `/Request/${requestId}/assignable-employees`
    );
    const responseText = await expectOkReadText(response, 'Failed to fetch assignable employees');
    const parsedData = parseJsonTextArray<Record<string, unknown>>(responseText);
    return parsedData.map(normalizeEmployee);
  } catch (error) {
    console.error('Error fetching assignable employees:', error);
    throw error;
  }
};

/**
 * Delete a request by ID
 * @param requestId - The ID of the request to delete
 * @returns Promise<void>
 */
export const deleteRequest = async (requestId: string): Promise<void> => {
  try {
    const response = await apiDelete(`/Request/${requestId}`, {
      headers: {
        accept: '*/*',
      },
    });
    await readResponseOk(response, 'Failed to delete request');
  } catch (error) {
    console.error('Error deleting request:', error);
    throw error;
  }
};

/**
 * Clone a request by ID
 * @param requestId - The source request ID
 * @returns Promise<RequestResponse>
 */
export const cloneRequest = async (requestId: string): Promise<RequestResponse> => {
  try {
    const response = await apiPost(`/Request/clone-request?requestId=${encodeURIComponent(requestId)}`, undefined, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const responseText = await readResponseOk(response, 'Failed to clone request');
    return parseJsonText<RequestResponse>(responseText);
  } catch (error) {
    console.error('Error cloning request:', error);
    throw error;
  }
};

/**
 * Get available dates for a post by post ID
 * @param postId - The ID of the post
 * @returns Promise<string[]> - Array of date strings (raw from API)
 */
export const getPostPositionsDatesByPostId = async (postId: string): Promise<string[]> => {
    try {
        const response = await apiGet(`/Request/post/${postId}/positions-dates`);
        const responseText = await expectOkReadText(response, 'Failed to fetch job position dates');
        // The API returns an array of DateOnly which is serialized as date strings
        return parseJsonText<string[]>(responseText);
    } catch (error) {
        console.error('Error fetching post position dates:', error);
        throw error;
    }
};

/**
 * Bulk assign employees to a post
 * @param bulkAssignData - The bulk assignment data (postID, dateOfWork, and employeeIDs array)
 * @returns Promise<BulkAssignPostPositionItemDto[]> - List of slim results (one per assignment) with hasError and message
 */
export interface BulkAssignPostPositionRequest {
    postID: string;
    dateOfWork: string; // DateOnly serialized as string "yyyy-MM-dd"
    employeeIDs: string[];
    /** Placeholder mode: allow creating a virtual assignment row without selecting employees. */
    isPlaceholder?: boolean;
    /** One row per placeholder with per-row invoice/payroll flag. */
    placeholders?: BulkAssignPlaceholderItem[];
    /**
     * When true, backend should end/reassign from the source post position and assign to employeeIDs (typically one).
     * Sent as JSON `isTransfer` (maps to C# `IsTransfer`).
     */
    isTransfer?: boolean;
    /**
     * Post position row being transferred from. Required when `isTransfer` is true.
     * Sent as JSON `sourcePostPositionId`.
     */
    sourcePostPositionId?: string;
    /** When true, backend allows assignment when it would otherwise require a time-overlap / same-slot confirmation. */
    confirmConflict?: boolean;
}

/** Placeholder row for bulk assign (`BulkAssignPlaceholderItemDto`). */
export interface BulkAssignPlaceholderItem {
    placeholderId?: string | null;
    firstName: string;
    lastName: string;
    contactNumber?: string | null;
    employeeNumber?: string | null;
    enableInvoiceAndPayroll: boolean;
    isUniquePerPosition: boolean;
}

/** Slim DTO returned by bulk-assign-post-positions API (no nested Post/Request/Posts). */
export interface BulkAssignPostPositionItemDto {
    postPositionId?: string | null;
    postID: string;
    dateOfWork: string;
    postStartTime?: string;
    lengthOfWork?: number;
    postPositionStatus: number;
    message: string | null;
    hasError: boolean;
    /** Backend: `HasTimeConflictRequiringConfirmation` / JSON `hasTimeConflictRequiringConfirmation`. */
    hasTimeConflictRequiringConfirmation?: boolean;
    employeeId?: string | null;
    /** Backend: placeholder display name when bulk assign uses placeholder rows. */
    employeeName?: string | null;
    /** When set, full preformatted text for the time-conflict dialog (name + server detail from API). Prefer over `message` in the UI. */
    timeConflictDialogMessage?: string | null;
}

export const bulkAssignPostPositions = async (bulkAssignData: BulkAssignPostPositionRequest): Promise<BulkAssignPostPositionItemDto[]> => {
    try {
        const { postID, dateOfWork, employeeIDs, isTransfer, sourcePostPositionId, confirmConflict, isPlaceholder } = bulkAssignData;
        
        const isPlaceholderMode = isPlaceholder === true;

        // Non-placeholder mode requires at least one employee.
        if (!isPlaceholderMode && (!employeeIDs || employeeIDs.length === 0)) {
            throw new Error('Employee IDs list cannot be empty.');
        }

        // Placeholder mode requires one or more named rows.
        const cleanedPlaceholders = (bulkAssignData.placeholders ?? [])
            .map((row) => {
                const firstName = String(row.firstName ?? '').trim();
                const lastName = String(row.lastName ?? '').trim();
                const contactRaw = String(row.contactNumber ?? '').replace(/\D/g, '');
                const isUniquePerPosition = row.isUniquePerPosition;
                const badgeRaw = isUniquePerPosition
                    ? ''
                    : String(row.employeeNumber ?? '').replace(/\D/g, '');
                const placeholderId = String(row.placeholderId ?? '').trim();
                return {
                    ...(placeholderId ? { placeholderId } : {}),
                    firstName,
                    lastName,
                    enableInvoiceAndPayroll: row.enableInvoiceAndPayroll === true,
                    isUniquePerPosition,
                    ...(contactRaw.length > 0 ? { contactNumber: contactRaw } : {}),
                    ...(badgeRaw.length > 0 ? { employeeNumber: badgeRaw } : {}),
                };
            })
            .filter((row) => row.firstName.length > 0 && row.lastName.length > 0);
        if (isPlaceholderMode && cleanedPlaceholders.length === 0) {
            throw new Error('At least one placeholder is required when adding placeholder assignments.');
        }

        if (isTransfer === true && (!sourcePostPositionId || !String(sourcePostPositionId).trim())) {
            throw new Error('Transfer requires sourcePostPositionId.');
        }
        
        const requestBody: Record<string, unknown> = {
            postID,
            dateOfWork,
            employeeIDs,
        };
        if (isPlaceholderMode) {
            requestBody.isPlaceholder = true;
            requestBody.placeholders = cleanedPlaceholders;
        }
        if (isTransfer === true && sourcePostPositionId) {
            requestBody.isTransfer = true;
            requestBody.sourcePostPositionId = sourcePostPositionId;
        }
        if (confirmConflict === true) {
            requestBody.confirmConflict = true;
        }

        const endpoint = '/Request/bulk-assign-post-positions';
        const response = await apiPost(endpoint, requestBody, {
            headers: {
                'Content-Type': 'application/json',
            },
        });
        const responseText = await expectOkReadText(response, 'Failed to bulk assign employees to job');
        const parsed = parseJsonText<unknown>(responseText);
        if (Array.isArray(parsed)) return parsed as BulkAssignPostPositionItemDto[];
        if (parsed && typeof parsed === 'object') {
            const obj = parsed as Record<string, unknown>;
            const arr = obj.data ?? obj.Data;
            if (Array.isArray(arr)) return arr as BulkAssignPostPositionItemDto[];
        }
        return [];
    } catch (error) {
        console.error('Error bulk assigning post positions:', error);
        throw error;
    }
};

/**
 * Send the next approval email for a request routing group.
 * The backend derives request/approver display names from requestId and routingGroupId,
 * so the UI only needs to send requestId, routingGroupId, and systemUrl.
 * @param payload - requestId, routingGroupId, systemUrl (full link for the email)
 */
export const sendVehicleApprovalEmail = async (payload: SendVehicleApprovalEmailsRequest): Promise<void> => {
    const response = await apiPost('/Request/send-vehicle-approval-emails', payload, {
        headers: { 'Content-Type': 'application/json' },
    });
    await readResponseOk(response, 'Failed to send vehicle approval email');
};

export interface SendAssignPostEmailParams {
    employeeId: string;
    postTitle: string;
    dateOfWork?: string | null;
    startTime?: string | null;
    postLength?: number | null;
    postLocation?: string | null;
}

/**
 * Send assignment invite email for a scheduled post (PostPositionController).
 * @see POST /PostPosition/send-assign-post-email
 */
export const sendAssignPostEmail = async (postPositionId: string, params: SendAssignPostEmailParams): Promise<void> => {
    const response = await apiPost(`/PostPosition/send-assign-post-email?postPositionId=${encodeURIComponent(postPositionId)}`, params, {
        headers: {
            'Content-Type': 'application/json',
            accept: '*/*',
        },
    });
    await expectOkReadText(response, 'Failed to send invite email');
};

/**
 * Get request invoice data.
 * API returns SuccessResult<InvoiceDto> (backend merges multi-request results).
 * Query params: repeated projectNumber values, startDate (DateOnly yyyy-MM-dd), endDate (DateOnly yyyy-MM-dd).
 */
export interface GetRequestInvoiceDataParams {
    projectNumber: string | string[];
    /** DateOnly serialized as string "yyyy-MM-dd" */
    startDate: string;
    /** DateOnly serialized as string "yyyy-MM-dd" */
    endDate: string;
}

/** API wrapper for invoice endpoint (SuccessResult<List<InvoiceDto>>) */
interface InvoiceSuccessResult extends Record<string, unknown> {
    status?: number;
    message?: string;
    data?: InvoiceDto | InvoiceDto[] | null;
    Status?: number;
    Message?: string;
    Data?: InvoiceDto | InvoiceDto[] | null;
    isSuccessStatusCode?: boolean;
    IsSuccessStatusCode?: boolean;
    errors?: unknown;
    Errors?: unknown;
}

export interface RequestInvoiceDataResult {
    invoice: InvoiceDto | null;
    /** Partial-failure messages returned with a successful invoice payload. */
    errorMessages: string[];
}

const getInvoiceResultErrorMessages = (parsed: InvoiceSuccessResult): string[] => {
    const errors = parsed.errors ?? parsed.Errors;
    if (!Array.isArray(errors) || errors.length === 0) return [];
    return getErrorMessagesFromResult(parsed);
};

export const getRequestInvoiceData = async (
    params: GetRequestInvoiceDataParams
): Promise<RequestInvoiceDataResult> => {
    const { projectNumber, startDate, endDate } = params;
    const searchParams = new URLSearchParams({
        startDate,
        endDate,
    });
    const projectNumbers = Array.isArray(projectNumber) ? projectNumber : [projectNumber];
    projectNumbers.map((value) => value.trim()).filter(Boolean).forEach((value) => searchParams.append('projectNumber', value));

    const response = await apiGet(`/Request/invoices/request-data?${searchParams.toString()}`);
    const text = await response.text();

    if (!text?.trim()) {
        throw new Error(INVOICE_GRID.ERRORS.NO_DATA_FOR_CRITERIA);
    }

    try {
        const parsed = parseJsonText<InvoiceSuccessResult>(text);

        if (isSuccessResultFailure(parsed, response.ok)) {
            const messages = getErrorMessagesFromResult(parsed);
            throw new Error(
                messages.length > 0
                    ? messages.join('\n')
                    : getErrorMessageFromErrorResponse(text, INVOICE_GRID.ERRORS.NO_DATA_FOR_CRITERIA)
            );
        }

        const errorMessages = getInvoiceResultErrorMessages(parsed);
        const data = parsed.data ?? parsed.Data ?? null;
        if (!data) return { invoice: null, errorMessages };

        if (Array.isArray(data)) {
            if (data.length === 0) return { invoice: null, errorMessages };
            return { invoice: data[0], errorMessages };
        }

        return { invoice: data, errorMessages };
    } catch (err) {
        if (err instanceof Error && err.message) throw err;
        throw new Error(INVOICE_GRID.ERRORS.NO_DATA_FOR_CRITERIA);
    }
};

/**
 * Get all calculated roster work dates for a request (schedules + recurrence).
 * Unlike getPostPositionsDatesByPostId, this is request-scoped and not filtered by open slots.
 * @param requestID - The request ID
 * @returns Promise<string[]> — DateOnly values as YYYY-MM-DD strings
 */
export const getRosterDates = async (requestID: string): Promise<string[]> => {
    const response = await apiGet(
        `/Request/roster-dates?requestID=${encodeURIComponent(requestID)}`
    );
    const responseText = await expectOkReadText(response, 'Failed to fetch roster dates');
    return parseJsonText<string[]>(responseText);
};

/** Get roster information for a post (backend-preformatted tables). */
export const getRosterInformation = async (postId: string, dateOfWork: string): Promise<RosterResponse> => {
    const response = await apiGet(
        `/Request/roster-information?postId=${encodeURIComponent(postId)}&dateOfWork=${encodeURIComponent(dateOfWork)}`
    );
    const responseText = await expectOkReadText(response, 'Failed to fetch roster information');
    return parseJsonText<RosterResponse>(responseText);
};

/** Get roster information for a request (backend-preformatted tables). */
export const getRosterInformationByRequest = async (
    requestID: string,
    dateOfWork: string
): Promise<RosterResponse> => {
    const response = await apiGet(
        `/Request/roster-information-by-request?requestID=${encodeURIComponent(requestID)}&dateOfWork=${encodeURIComponent(dateOfWork)}`
    );
    const responseText = await expectOkReadText(response, 'Failed to fetch roster information');
    return parseJsonText<RosterResponse>(responseText);
};

export interface DownloadRosterExcelParams {
    requestId?: string;
    postId?: string;
    dateOfWork: string;
    defaultFileName?: string;
}

/** Export roster as Excel via `RequestController.ExportRoster` (`ExportRosterExcelAsync`). */
export const downloadRosterExcel = async (params: DownloadRosterExcelParams): Promise<void> => {
    const requestId = params.requestId?.trim();
    const postId = params.postId?.trim();
    const workDate = params.dateOfWork.trim();
    const defaultFileName = params.defaultFileName;

    if (!requestId && !postId) {
        throw new Error('Either requestId or postId is required.');
    }
    if (requestId && postId) {
        throw new Error('Provide either requestId or postId, not both.');
    }
    if (!workDate) {
        throw new Error('Date of work is required.');
    }

    const query = new URLSearchParams({
        dateOfWork: workDate,
    });
    if (requestId) {
        query.set('requestId', requestId);
    } else if (postId) {
        query.set('postId', postId);
    }

    const response = await apiGet(`/Request/export?${query.toString()}`, {
        headers: { accept: '*/*' },
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(
            getErrorMessageFromErrorResponse(text, `Failed to export roster (${response.status})`)
        );
    }

    const fallbackName =
        defaultFileName?.trim() ||
        `roster-${workDate}.xlsx`;

    await downloadExcelFileFromResponse(response, fallbackName, 'Failed to export roster');
};