import {
    PostPositionResponse,
    PostPositionFilter,
    PostPositionAssignmentsAndWaitingListForDate,
} from '@/types/postPosition';
import { PostCloseFormData } from '@/types/postCloseForm';
import { apiDelete, apiPost, apiGet, apiPut } from '@/utils/apiClient';
import { expectOk, expectOkReadText, parseJsonText, parseJsonTextArray, readResponseOk, readResponseOkOrInvoiceRefund } from '@/services/textPlainJson';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';
import { totalMileageFromStartEnd } from '@/utils/mileagePayloadUtils';

import { PagedResponse } from '@/types/common';
import type { EmployeePostListingItem } from '@/types/employeePostListingItem';
import {POST_POSITION_POST_CALL_SIGN_ID_FIELD_NAME } from '@/types/postPosition';
import { parseEmployeePostListingItem } from '@/utils/employeePostListingItem';

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000';

/** Normalize a UI date string to backend `DateOnly` (`YYYY-MM-DD`) for query params. */
function toDateOnlyQuery(value: string | null | undefined): string | undefined {
    if (!value) return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const ymd = trimmed.includes('T') ? trimmed.split('T')[0]! : trimmed;
    return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : undefined;
}

function normalizeEmployeeId(raw: unknown): string | undefined {
    if (raw == null) return undefined;
    const value = String(raw).trim();
    if (!value || value.toLowerCase() === EMPTY_GUID) return undefined;
    return value;
}

/** Map form data to API close/split request body (camelCase for JSON). Aligns with ClosedPostPosition. */
const toCloseRequestBody = (data: PostCloseFormData): Record<string, unknown> => ({
    postPositionId: data.postPositionId,
    employeeID: data.employeeID,
    employeeName: data.employeeName,
    postID: data.postID,
    postTitle: data.postTitle,
    workStartDate: data.workStartDate,
    workStartTime: data.workStartTime,
    workEndTime: data.workEndTime,
    hoursWorked: data.hoursWorked,
    workedOnDuty: data.workedOnDuty,
    comment: data.comment,
    requestedStartDate: data.requestedStartDate,
    requestedStartTime: data.requestedStartTime,
    closeBy: data.closeBy,
    closeDateTime: data.closeDateTime,
    isMinimumDue: data.isMinimumDue,
    minimumHoursDue: data.minimumHoursDue,
    reimburseStatus: data.reimburseStatus,
    payRate: data.payRate,
    reimbursePayRate: data.reimbursePayRate,
    departmentEquipment: data.departmentEquipment,
    isWorked: data.isWorked,
    noWorkReason: data.noWorkReason,
    isUnPaidBreakTime: data.isUnPaidBreakTime,
    breakTime: data.breakTime,
    equipmentUsedIsVehicle: data.equipmentUsedIsVehicle,
    vehicleOwnedBy: data.vehicleOwnedBy,
    vehNumber: data.vehNumber,
    startMileage: data.startMileage,
    endMileage: data.endMileage,
    totalMileage: (() => {
      const total = totalMileageFromStartEnd(data.startMileage, data.endMileage);
      return total === null ? undefined : total;
    })(),
    usedEquipmentQuantity: data.usedEquipmentQuantity,
    equipmentUsedHours: data.equipmentUsedHours,
    paidHours: data.paidHours,
    ...(data.splitEmployeeID && { splitEmployeeID: data.splitEmployeeID }),
    ...(data.splitStartTime && { splitStartTime: data.splitStartTime }),
});

export interface CreatePostPositionRequest {
    postID: string;
    employeeID: string;
    dateOfWork: string;
    startTime: string;
    postPositionStatus: number;
}

/**
 * Collect dates for a post (Daily Administration calendar filter).
 * GET /PostPosition/by-post/{postId}/dates?startDate=&endDate=
 */
export const getCollectDatesForPost = async (
    postId: string,
    startDate?: string | null,
    endDate?: string | null,
    requestStatuses?: ReadonlyArray<number>,
    includeCompleted?: boolean
): Promise<string[]> => {
    if (!postId?.trim()) {
        throw new Error('postId is required');
    }
    const params = new URLSearchParams();
    const startDateOnly = toDateOnlyQuery(startDate);
    if (startDateOnly) params.set('startDate', startDateOnly);
    const endDateOnly = toDateOnlyQuery(endDate);
    if (endDateOnly) params.set('endDate', endDateOnly);
    requestStatuses?.forEach((status) => params.append('requestStatuses', String(status)));
    if (includeCompleted) params.set('includeCompleted', 'true');
    const queryString = params.toString();
    const endpoint = `/PostPosition/by-post/${encodeURIComponent(postId.trim())}/dates${queryString ? `?${queryString}` : ''}`;
    const response = await apiGet(endpoint);
    const responseText = await expectOkReadText(response, 'Failed to fetch job position dates');
    const parsed = parseJsonText<unknown>(responseText);
    // Accept bare arrays or common wrapped shapes (`data` / `dates`).
    const rawList = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === 'object'
          ? (() => {
                const obj = parsed as Record<string, unknown>;
                const nested = obj.data ?? obj.Data ?? obj.dates ?? obj.Dates;
                return Array.isArray(nested) ? nested : [];
            })()
          : [];
    return rawList
        .map((item) => {
            if (item && typeof item === 'object') {
                const obj = item as Record<string, unknown>;
                const nested = obj.date ?? obj.Date ?? obj.dateOfWork ?? obj.DateOfWork;
                item = nested;
            }
            const value = String(item ?? '').trim();
            if (!value) return '';
            return value.includes('T') ? value.split('T')[0]! : value;
        })
        .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value));
};

function readResponseDateList(parsed: unknown): string[] {
    if (!parsed || typeof parsed !== 'object') return [];
    const obj = parsed as Record<string, unknown>;
    const rawList = obj.dates ?? obj.Dates;
    if (!Array.isArray(rawList)) return [];
    return rawList
        .map((item) => {
            const value = String(item ?? '').trim();
            if (!value) return '';
            return value.includes('T') ? value.split('T')[0]! : value;
        })
        .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value));
}

/** Paged post positions plus the distinct work dates returned by GET `/PostPosition/by-post/{postId}`. */
export interface PostPositionsByPostPage extends PagedResponse<PostPositionResponse> {
    dates: string[];
}

/**
 * Get post positions by post ID
 * @param postId - The ID of the post
 * @returns Promise<PostPositionsByPostPage>
 */
export const getPostPositionsByPostId = async (postId: string, filters?: PostPositionFilter): Promise<PostPositionsByPostPage> => {
    try {
        const endpoint = `/PostPosition/by-post/${postId}`;

        const effectiveFilters: PostPositionFilter = {
            ...filters
        };

        const params = buildPaginationQueryParams(effectiveFilters);
        const startDateOnly = toDateOnlyQuery(effectiveFilters.startDate);
        if (startDateOnly) params.set('startDate', startDateOnly);
        const endDateOnly = toDateOnlyQuery(effectiveFilters.endDate);
        if (endDateOnly) params.set('endDate', endDateOnly);
        const normalizedDates = (effectiveFilters.dates ?? [])
            .map((date) => toDateOnlyQuery(date))
            .filter((date): date is string => Boolean(date));
        normalizedDates.forEach((date) => params.append('dates', date));
        (effectiveFilters.requestStatuses ?? []).forEach((status) => params.append('requestStatuses', String(status)));
        if (effectiveFilters.includeCompleted) params.set('includeCompleted', 'true');
        if (typeof effectiveFilters.isViewHistory === 'boolean') {
            params.set('isViewHistory', String(effectiveFilters.isViewHistory));
        }
        const queryString = params.toString();
        const fullEndpoint = queryString ? `${endpoint}?${queryString}` : endpoint;

        const response = await apiGet(fullEndpoint);
        const responseText = await expectOkReadText(response, 'Failed to fetch job positions');

        const parsed = parseJsonText<unknown>(responseText);

        // Handle paginated response with data array
        if (parsed && typeof parsed === 'object' && 'data' in parsed && Array.isArray((parsed as any).data)) {
            const paged = parsed as PagedResponse<PostPositionResponse>;
            return {
                ...paged,
                data: paged.data.map(normalizeAssignmentWaitingRow),
                dates: readResponseDateList(parsed),
            };
        }

        // Fallback to wrapping array in PagedResponse
        const data = parseJsonTextArray<unknown>(responseText).map(normalizeAssignmentWaitingRow);

        console.log('Fetched post positions by post ID:', {data });
        return {
            data,
            totalRecords: data.length,
            dates: readResponseDateList(parsed),
        };
    } catch (error) {
        console.error('Error fetching post positions:', error);
        throw error;
    }
};

function firstObjectArray(obj: Record<string, unknown>, keys: string[]): unknown[] {
    for (const k of keys) {
        const v = obj[k];
        if (Array.isArray(v)) return v;
    }
    return [];
}

function normalizeAssignmentWaitingRow(raw: unknown): PostPositionResponse {
    const obj = (raw ?? {}) as Record<string, unknown>;
    const normalized = obj as unknown as PostPositionResponse;
    const normalizedRecord = normalized as unknown as Record<string, unknown>;
    const employeeIdRaw = getFromRaw<string>(obj, 'employeeID', 'EmployeeID', 'employeeId', 'EmployeeId');
    const employeeNameRaw = getFromRaw<string>(obj, 'employeeName', 'EmployeeName', 'placeholder', 'Placeholder');

    const idVal = getFromRaw<string>(obj, 'postPositionId', 'PostPositionId', 'waitingPostPositionId', 'WaitingPostPositionId');
    if (idVal !== undefined) {
        normalizedRecord.postPositionId = String(idVal);
    }
    normalizedRecord.employeeID = normalizeEmployeeId(employeeIdRaw);
    if (employeeNameRaw !== undefined) {
        const normalizedName = String(employeeNameRaw).trim();
        normalizedRecord.employeeName = normalizedName || undefined;
    }

    const startVal = getFromRaw<string>(obj, 'postStartTime', 'PostStartTime', 'startTime', 'StartTime');
    if (startVal !== undefined) {
        normalizedRecord.postStartTime = String(startVal);
    }

    const dateOfWorkVal = getFromRaw<string>(obj, 'dateOfWork', 'DateOfWork');
    if (dateOfWorkVal !== undefined && dateOfWorkVal !== null) {
        const raw = String(dateOfWorkVal).trim();
        normalizedRecord.dateOfWork = raw.includes('T') ? raw.split('T')[0]! : raw;
    }

    const statusRaw = getFromRaw<unknown>(obj, 'postPositionStatus', 'PostPositionStatus');
    if (statusRaw !== undefined && statusRaw !== null) {
        const n = typeof statusRaw === 'number' && !Number.isNaN(statusRaw) ? statusRaw : Number(statusRaw);
        if (!Number.isNaN(n)) {
            normalizedRecord.postPositionStatus = n;
        }
    }

    const isPlaceholderRaw = getFromRaw<boolean | string>(obj, 'isPlaceholder', 'IsPlaceholder');
    if (isPlaceholderRaw !== undefined) {
        normalizedRecord.isPlaceholder = isPlaceholderRaw === true || isPlaceholderRaw === 'true';
    }

    const isUniquePerPositionRaw = getFromRaw<boolean | string>(
        obj,
        'isUniquePerPosition',
        'IsUniquePerPosition'
    );
    normalizedRecord.isUniquePerPosition =
        isUniquePerPositionRaw === true || isUniquePerPositionRaw === 'true';

    const defineCallSignRaw = getFromRaw<boolean | string>(obj, 'defineCallSign', 'DefineCallSign');
    if (defineCallSignRaw !== undefined) {
        normalizedRecord.defineCallSign = defineCallSignRaw === true || defineCallSignRaw === 'true';
    }

    const callSignRaw = getFromRaw<string>(obj, 'callSign', 'CallSign', 'callSing', 'CallSing');
    if (callSignRaw !== undefined && callSignRaw !== null) {
        normalizedRecord.callSign = String(callSignRaw);
    }

    const postCallSignIdRaw = getFromRaw<string>(obj, 'postCallSignID', 'PostCallSignID', 'postCallSignId', 'PostCallSignId');
    if (postCallSignIdRaw !== undefined && postCallSignIdRaw !== null) {
        normalizedRecord.postCallSignID = String(postCallSignIdRaw);
    }

    return normalized;
}

const ASSIGNMENTS_NUMBER_OF_DAYS_CHOICES = [15, 30, 45, 60] as const;

function normalizeAssignmentsNumberOfDays(value: number | null | undefined): number {
    if (value == null || !Number.isFinite(value)) return 15;
    const n = Math.trunc(value);
    return ASSIGNMENTS_NUMBER_OF_DAYS_CHOICES.includes(n as (typeof ASSIGNMENTS_NUMBER_OF_DAYS_CHOICES)[number]) ? n : 15;
}

/** Key for client-side cache + Redux: unfiltered = <code>postId|*</code>, windowed = <code>postId|date|n</code>. */
export const getAssignmentsAndWaitingListCacheKey = (
    postId: string,
    startDate: string | null | undefined,
    numberOfDays: number | null | undefined
): string => {
    const p = (postId || '').trim();
    const s = (startDate ?? '').trim();
    if (!s) return `${p}|*`;
    return `${p}|${s}|${normalizeAssignmentsNumberOfDays(numberOfDays)}`;
};

/**
 * Assigned / applied / closed post positions and active waiting-list applicants for a post.
 * If <code>startDate</code> is null/empty, the request is sent with no date params (all dates for the post).
 * If <code>startDate</code> is set, <code>numberOfDays</code> is sent (default 15 when not provided).
 * GET /PostPosition/by-post/{postId}/assignments-and-waiting-list
 * or ?startDate=yyyy-MM-dd&numberOfDays=15
 */
export const getAssignmentsAndWaitingListForPostDate = async (
    postId: string,
    startDate: string | null,
    numberOfDays: number | null
): Promise<PostPositionAssignmentsAndWaitingListForDate> => {
    if (!postId?.trim()) {
        throw new Error('postId is required');
    }
    const trimmed = (startDate ?? '').trim();
    const params = new URLSearchParams();
    if (trimmed) {
        params.set('startDate', trimmed);
        params.set('numberOfDays', String(normalizeAssignmentsNumberOfDays(numberOfDays)));
    }
    const qs = params.toString();
    const endpoint = `/PostPosition/by-post/${encodeURIComponent(postId.trim())}/assignments-and-waiting-list${qs ? `?${qs}` : ''}`;
    const response = await apiGet(endpoint);
    const responseText = await expectOkReadText(response, 'Failed to fetch assignments and waiting list');
    const parsed = parseJsonText<unknown>(responseText);
    const obj = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
    const assignments = firstObjectArray(obj, [
        'assignments',
        'appliedEmployees',
        'postPositions',
        'assignedPostPositions',
        'appliedOrCancelled',
        'AppliedOrCancelled',
        'AppliedEmployees',
        'PostPositions',
        'Assignments',
    ]) as PostPositionResponse[];
    const waitingList = firstObjectArray(obj, [
        'waitingList',
        'waitingPostPositions',
        'waitingListEmployees',
        'waitingListApplicants',
        'activeWaitingListApplicants',
        'WaitingList',
        'WaitingPostPositions',
        'WaitingListEmployees',
        'WaitingListApplicants',
    ]) as PostPositionResponse[];
    return {
        assignments: assignments.map(normalizeAssignmentWaitingRow),
        waitingList: waitingList.map(normalizeAssignmentWaitingRow),
    };
};

/**
 * Get a single post position with Post details by post position ID (includes Post fields, lengthOfWork, callSign for modal display)
 * @param postPositionId - The post position ID to fetch (required)
 * @returns Promise<PostPositionResponse | null>
 */
/** Extract numeric/string from raw API response (handles camelCase and PascalCase) */
function getFromRaw<T>(raw: Record<string, unknown>, ...keys: string[]): T | undefined {
    for (const k of keys) {
        const v = raw[k];
        if (v !== undefined && v !== null) return v as T;
    }
    return undefined;
}

const POST_FLEXIBLE_KEYS = ['postIsFlexible', 'PostIsFlexible', 'isFlexible', 'IsFlexible'] as const;

/**
 * Read Post flexible (IsFlexible) flag from a post-position or with-post DTO (root or nested `post` / `Post`).
 * Returns undefined when no property is present (caller may default).
 */
export function readPostIsFlexibleFromUnknown(raw: unknown): boolean | undefined {
    const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
    if (!obj) return undefined;
    const pick = (o: Record<string, unknown>): boolean | undefined => {
        for (const k of POST_FLEXIBLE_KEYS) {
            if (!Object.prototype.hasOwnProperty.call(o, k)) continue;
            const v = o[k];
            if (typeof v === 'boolean') return v;
        }
        return undefined;
    };
    const direct = pick(obj);
    if (direct !== undefined) return direct;
    const nested = obj.post ?? obj.Post;
    if (nested && typeof nested === 'object') {
        return pick(nested as Record<string, unknown>);
    }
    return undefined;
}

export const getPostPositionWithPostDetails = async (postPositionId: string): Promise<PostPositionResponse | null> => {
    try {
        if (!postPositionId) return null;
        const endpoint = `/PostPosition/with-post?postPositionId=${encodeURIComponent(postPositionId)}`;
        const response = await apiGet(endpoint);
        const responseText = await expectOkReadText(response, 'Failed to fetch job position with job details');
        const parsed = parseJsonText<Record<string, unknown>>(responseText);
        if (!parsed || typeof parsed !== 'object') return null;
        // Normalize: ensure lengthOfWork and postPayRate work regardless of API casing
        const normalized: PostPositionResponse = parsed as unknown as PostPositionResponse;
        const lengthVal = getFromRaw<number>(parsed, 'postLength', 'PostLength', 'lengthOfWork', 'LengthOfWork');
        const payRateVal = getFromRaw<number>(parsed, 'postPayRate', 'PostPayRate');
        const normalizedRecord = normalized as unknown as Record<string, unknown>;
        if (lengthVal !== undefined) {
            normalizedRecord.lengthOfWork = lengthVal;
            normalizedRecord.postLength = lengthVal;
        }
        if (payRateVal !== undefined) {
            normalizedRecord.postPayRate = payRateVal;
        }
        normalizedRecord.postIsFlexible = readPostIsFlexibleFromUnknown(parsed) ?? false;
        return normalized;
    } catch (error) {
        console.error('Error fetching post position with post details:', error);
        throw error;
    }
};

/**
 * Create/assign a post position
 * @param positionData - The post position data
 * @returns Promise<PostPositionResponse>
 */
export const createPostPosition = async (positionData: CreatePostPositionRequest): Promise<PostPositionResponse> => {
    try {
        const endpoint = '/PostPosition';
        const response = await apiPost(endpoint, positionData, {
            headers: {
                'Content-Type': 'application/json',
            },
        });
        const responseText = await expectOkReadText(response, 'Failed to assign employee to job');
        return parseJsonText<PostPositionResponse>(responseText);
    } catch (error) {
        console.error('Error creating post position:', error);
        throw error;
    }
};


/**
 * Delete/unassign a post position
 * @param postPositionId - The ID of the post position to delete
 * @returns Promise<void>
 */
export const deletePostPosition = async (postPositionId: string): Promise<void> => {
    try {
        const endpoint = `/PostPosition/${postPositionId}`;
        const response = await apiDelete(endpoint);
        await expectOkReadText(response, 'Failed to delete job position');
    } catch (error) {
        console.error('Error deleting post position:', error);
        throw error;
    }
};

export {
    POST_POSITION_CALL_SIGN_FIELD_NAME,
    POST_POSITION_POST_CALL_SIGN_ID_FIELD_NAME,
} from '@/types/postPosition';

/** Sends `fieldValue` query param (may be empty string to clear call sign). */
export const updatePostPositionCallSign = async (
    postPositionId: string,
    fieldValue: string | null | undefined,
    fieldName: string = POST_POSITION_POST_CALL_SIGN_ID_FIELD_NAME
): Promise<void> => {
    const trimmed = (fieldValue ?? '').trim();
    const query = new URLSearchParams();
    query.set('fieldName', fieldName);
    query.set('fieldValue', trimmed);

    const endpoint = `/PostPosition/${postPositionId}/updatecallsign?${query.toString()}`;
    const response = await apiPut(endpoint, undefined, {
        headers: { accept: '*/*' },
    });
    await expectOkReadText(response, 'Failed to update callsign');
};

/**
 * Swap call signs between two post positions on the same work date.
 * PUT /PostPosition/swap-callsign?postPositionId1=&postPositionId2=
 */
export const swapPostPositionCallSigns = async (
  postPositionId1: string,
  postPositionId2: string
): Promise<void> => {
  const query = new URLSearchParams({ postPositionId1, postPositionId2 });
  await expectOk(
    await apiPut(`/PostPosition/swap-callsign?${query.toString()}`),
    'Failed to swap call signs'
  );
};

/**
 * Send assignment invite email for a scheduled post (PostPositionController).
 * @see GET /PostPosition/send-assign-post-email
 */
export const sendAssignPostEmail = async (postPositionId: string): Promise<void> => {
    const response = await apiGet(`/PostPosition/send-assign-post-email?postPositionId=${encodeURIComponent(postPositionId)}`);
    await expectOkReadText(response, 'Failed to send invite email');
};

/**
 * Get post positions for the logged-in employee filtered by one or more statuses.
 * Uses POST my-post-positions/by-statuses: body = statuses array, query = isOngoing + pagination.
 * When statuses include Assigned (1), isOngoing controls ongoing vs scheduled.
 *
 * @param statusEnumOrStatuses - Single status or array of status enums (e.g. 1 = Assigned, 2 = Closed, 3 = Cancelled)
 * @param filters - Optional filters (pagination, isOngoing)
 * @returns Promise<PagedResponse<EmployeePostListingItem>>
 */
export const getPostPositionsByStatus = async (
    statusEnumOrStatuses: number | number[],
    filters?: PostPositionFilter
): Promise<PagedResponse<EmployeePostListingItem>> => {
    try {
        const statuses = Array.isArray(statusEnumOrStatuses) ? statusEnumOrStatuses : [statusEnumOrStatuses];
        if (statuses.length === 0) {
            throw new Error('At least one status is required.');
        }

        const endpoint = '/PostPosition/my-post-positions/by-statuses';

        // Query params: isOngoing + pagination only (statuses go in body)
        const params = buildPaginationQueryParams(filters);
        if (filters?.isOngoing !== undefined) {
            params.append('isOngoing', filters.isOngoing.toString());
        }
        if (filters?.employeeID) {
            params.append('employeeId', filters.employeeID);
        }
        const searchModel = filters?.searchModel;
        if (searchModel) {
            if (searchModel.startDate) params.append('searchModel.StartDate', searchModel.startDate);
            if (searchModel.numberOfDays) {
                params.append('searchModel.NumberOfDays', searchModel.numberOfDays.toString());
            }
            if (searchModel.releaseAs !== undefined && searchModel.releaseAs !== null) {
                params.append('searchModel.ReleaseAs', searchModel.releaseAs.toString());
            }
            const requesterFilter = searchModel.requester?.trim();
            if (requesterFilter) params.append('searchModel.Requester', requesterFilter);
            const payCodeFilter = searchModel.payCode?.trim();
            if (payCodeFilter) params.append('searchModel.PayCode', payCodeFilter);
        }

        const queryString = params.toString();
        const fullEndpoint = queryString ? `${endpoint}?${queryString}` : endpoint;

        const response = await apiPost(fullEndpoint, statuses, {
            headers: { 'Content-Type': 'application/json' },
        });
        const responseText = await expectOkReadText(response, 'Failed to fetch job positions by status');

        const parsed = parseJsonText<unknown>(responseText);

        // Handle paginated response (PagedList<PostTypeResponseDto>): data/Data, totalRecords/TotalRecords
        if (parsed && typeof parsed === 'object') {
            const p = parsed as Record<string, unknown>;
            const list = (p.data ?? p.Data ?? p.items ?? p.Items) as unknown[] | undefined;
            const total = p.totalRecords ?? p.TotalRecords;
            if (Array.isArray(list)) {
                const normalized = list.map((item) => parseEmployeePostListingItem(item));
                return {
                    data: normalized,
                    totalRecords: typeof total === 'number' ? total : normalized.length,
                };
            }
        }

        const data = parseJsonTextArray<unknown>(responseText);
        const normalized = data.map((item) => parseEmployeePostListingItem(item));
        return {
            data: normalized,
            totalRecords: normalized.length,
        };
    } catch (error) {
        console.error('Error fetching post positions by status:', error);
        throw error;
    }
};

/**
 * Search post positions with optional paging/status filters.
 * Uses GET /PostPosition/search with query params.
 */
export const searchPostPositions = async (
    filters?: PostPositionFilter
): Promise<PagedResponse<EmployeePostListingItem>> => {
    try {
        const params = buildPaginationQueryParams(filters);
        const searchTerm = filters?.searchTerm?.trim();
        if (searchTerm) {
            params.append('searchTerm', searchTerm);
        }
        if (filters?.isOngoing !== undefined) {
            params.append('isOngoing', filters.isOngoing.toString());
        }
        if (filters?.employeeID) {
            params.append('employeeID', filters.employeeID);
        }
        const queryString = params.toString();
        const endpoint = `/PostPosition/search${queryString ? `?${queryString}` : ''}`;
        const response = await apiGet(endpoint);
        const responseText = await expectOkReadText(response, 'Failed to search post positions');
        const parsed = parseJsonText<unknown>(responseText);
        if (parsed && typeof parsed === 'object') {
            const p = parsed as Record<string, unknown>;
            const list = (p.data ?? p.Data ?? p.items ?? p.Items) as unknown[] | undefined;
            const total = p.totalRecords ?? p.TotalRecords;
            if (Array.isArray(list)) {
                return {
                    data: list.map((item) => parseEmployeePostListingItem(item)),
                    totalRecords: typeof total === 'number' ? total : list.length,
                };
            }
        }
        const data = parseJsonTextArray<unknown>(responseText);
        return {
            data: data.map((item) => parseEmployeePostListingItem(item)),
            totalRecords: data.length,
        };
    } catch (error) {
        console.error('Error searching post positions:', error);
        throw error;
    }
};

/**
 * Get close assignments for logged-in employee.
 * Uses GET /ClosedPostPosition/my-post-positions/close-assignments
 * Query params: isOngoing, pagination, optional searchTerm, optional employeeID, optional requesterID, startDate, endDate, isPlaceholder.
 */
export const getMyCloseAssignments = async (
    filters?: Pick<
        PostPositionFilter,
        'page' | 'pageSize' | 'limit' | 'isOngoing' | 'employeeID' | 'requesterID' | 'searchTerm' | 'startDate' | 'endDate' | 'isPlaceholder'
    >
): Promise<PagedResponse<EmployeePostListingItem>> => {
    try {
        const endpoint = '/ClosedPostPosition/my-post-positions/close-assignments';
        const params = buildPaginationQueryParams(filters);
        if (filters?.isOngoing !== undefined) {
            params.append('isOngoing', filters.isOngoing.toString());
        }
        if (filters?.employeeID) {
            params.append('employeeID', filters.employeeID);
        }
        if (filters?.requesterID) {
            params.append('requesterID', filters.requesterID);
        }
        const searchTerm = filters?.searchTerm?.trim();
        if (searchTerm) {
            params.append('searchTerm', searchTerm);
        }
        if (filters?.startDate) {
            params.append('startDate', filters.startDate);
        }
        if (filters?.endDate) {
            params.append('endDate', filters.endDate);
        }
        if (filters?.isPlaceholder === true) {
            params.append('isPlaceholder', 'true');
        }

        const queryString = params.toString();
        const fullEndpoint = queryString ? `${endpoint}?${queryString}` : endpoint;

        const response = await apiGet(fullEndpoint);
        const responseText = await expectOkReadText(response, 'Failed to fetch close assignments');
        const parsed = parseJsonText<unknown>(responseText);

        if (parsed && typeof parsed === 'object') {
            const p = parsed as Record<string, unknown>;
            const list = (p.data ?? p.Data ?? p.items ?? p.Items) as unknown[] | undefined;
            const total = p.totalRecords ?? p.TotalRecords;
            if (Array.isArray(list)) {
                return {
                    data: list.map((item) => parseEmployeePostListingItem(item)),
                    totalRecords: typeof total === 'number' ? total : list.length,
                };
            }
        }

        const data = parseJsonTextArray<unknown>(responseText);
        return {
            data: data.map((item) => parseEmployeePostListingItem(item)),
            totalRecords: data.length,
        };
    } catch (error) {
        console.error('Error fetching close assignments:', error);
        throw error;
    }
};

/**
 * Close a post position (mark as worked/closed).
 * @param data - Close form data
 * @returns Promise<PostPositionResponse | void>
 */
export const closePostPosition = async (data: PostCloseFormData): Promise<PostPositionResponse | void> => {
    const endpoint = '/PostPosition/close';
    const response = await apiPost(endpoint, toCloseRequestBody(data), {
        headers: { 'Content-Type': 'application/json' },
    });
    const responseText = await expectOkReadText(response, 'Failed to close job position');
    if (!responseText || responseText.trim() === '') return;
    return parseJsonText<PostPositionResponse>(responseText);
};

/**
 * Split a post position with another employee.
 * @param data - Close form data including splitEmployeeID and splitStartTime
 * @returns Promise<PostPositionResponse | void>
 */
export const splitPostPosition = async (data: PostCloseFormData): Promise<PostPositionResponse | void> => {
    const endpoint = '/PostPosition/split';
    const response = await apiPost(endpoint, toCloseRequestBody(data), {
        headers: { 'Content-Type': 'application/json' },
    });
    const responseText = await expectOkReadText(response, 'Failed to split job position');
    if (!responseText || responseText.trim() === '') return;
    return parseJsonText<PostPositionResponse>(responseText);
};

/**
 * Update a post position status.
 * @param postPositionId - The post position ID
 * @param status - The status enum value
 */
export const updatePostPositionStatus = async (
    postPositionId: string,
    status: number
): Promise<void> => {
    const endpoint = `/PostPosition/${postPositionId}/status/${status}`;
    const response = await apiPut(endpoint);
    await expectOkReadText(response, 'Failed to update job position status');
};

/**
 * Cancel a post position (sets status to Cancelled and sends cancellation email to current employee's primary email).
 * @param postPositionId - The post position ID to cancel
 * @param cancellationReason - Optional; empty or whitespace-only is sent as null in the request body
 */
export const cancelPostPosition = async (
    postPositionId: string,
    cancellationReason: string | null,
    isApproveCancellation: boolean = false
): Promise<void> => {
    const endpoint = `/PostPosition/${postPositionId}/cancel?isApproveCancellation=${encodeURIComponent(String(isApproveCancellation))}`;
    const trimmed = cancellationReason == null ? '' : String(cancellationReason).trim();
    const reasonPayload: string | null = trimmed === '' ? null : trimmed;
    const response = await apiPut(endpoint, {
        cancellationReason: reasonPayload,
        reason: reasonPayload,
    });
    await readResponseOk(response, 'Failed to cancel job position');
};

/**
 * Revoke a pending employee cancellation; restores status to Assigned.
 * @param postPositionId - The post position ID
 */
export const revokePostPositionCancellation = async (postPositionId: string): Promise<void> => {
    const endpoint = `/PostPosition/${postPositionId}/revoke-cancellation`;
    const response = await apiPut(endpoint);
    await readResponseOk(response, 'Failed to revoke cancellation');
};

/**
 * Unclose a closed post position.
 * @param postPositionId - The post position ID to unclose
 */
export const unclosePostPosition = async (postPositionId: string): Promise<void> => {
    const response = await apiPut(`/ClosedPostPositionEquipment/${postPositionId}/unclose`);
    await readResponseOkOrInvoiceRefund(response, 'Failed to unclose job position');
};