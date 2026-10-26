/**
 * Post Position Redux Slice
 */
import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import {
    getPostPositionsByPostId,
    getPostPositionsByStatus,
    cancelPostPosition,
    revokePostPositionCancellation,
    unclosePostPosition,
    swapPostPositionCallSigns,
    getMyCloseAssignments,
    getAssignmentsAndWaitingListForPostDate,
    getAssignmentsAndWaitingListCacheKey,
    updatePostPositionCallSign,
} from '@/services/postPositionService';
import { POST_POSITION_CALL_SIGN_FIELD_NAME } from '@/types/postPosition';
import { getLatestPerPostPositionPaged } from '@/services/closedPostPositionService';
import {
    getPostPositionsDatesByPostId,
    bulkAssignPostPositions,
    type BulkAssignPostPositionItemDto,
    BulkAssignPostPositionRequest,
    sendAssignPostEmail,
} from '@/services/requestService';
import { PostPositionFilter, PostPositionResponse, PostPositionStatus, postPositionListStateKey } from '@/types/postPosition';
import { POST_POSITION } from '@/constants/strings';
import type { EmployeePostListingItem } from '@/types/employeePostListingItem';
import { showToast } from './toastSlice';
import { closePostPositionWithEquipment, splitPostPositionWithEquipment } from '@/services/closedPostPositionEquipmentService';
import { PostCloseFormData, EquipmentDetail, VehicleDetail, QuestionnaireSubmission } from '@/types/postCloseForm';
import { InvoiceRefundRequiredError, type InvoiceRefundActionResult } from '@/types/invoice';
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants/tablePagination';

/** Arg for fetchPostPositions — string postId uses page 1 + default page size (matches RequesterList slider). */
export type FetchPostPositionsArg =
    | string
    | {
          postId: string;
          page?: number;
          pageSize?: number;
          dates?: string[];
          /** Daily Administration filter Start Date (`YYYY-MM-DD`). */
          startDate?: string;
          /** Daily Administration filter End Date (`YYYY-MM-DD`). */
          endDate?: string;
          requestStatuses?: number[];
          includeCompleted?: boolean;
          /**
           * When false, only Assigned; when true, all statuses.
           * Omit to leave the query param unset (API default true).
           */
          isViewHistory?: boolean;
      };

function normalizeFetchPostPositionsArg(arg: FetchPostPositionsArg): {
    postId: string;
    page: number;
    pageSize: number;
    dates?: string[];
    startDate?: string;
    endDate?: string;
    requestStatuses?: number[];
    includeCompleted?: boolean;
    isViewHistory?: boolean;
} {
    const postId = typeof arg === 'string' ? arg : arg.postId;
    const page = typeof arg === 'string' ? 1 : (arg.page ?? 1);
    const pageSize =
        typeof arg === 'string' ? DEFAULT_TABLE_PAGE_SIZE : (arg.pageSize ?? DEFAULT_TABLE_PAGE_SIZE);
    const dates = typeof arg === 'string' ? undefined : arg.dates;
    const startDate = typeof arg === 'string' ? undefined : arg.startDate;
    const endDate = typeof arg === 'string' ? undefined : arg.endDate;
    const requestStatuses = typeof arg === 'string' ? undefined : arg.requestStatuses;
    const includeCompleted = typeof arg === 'string' ? undefined : arg.includeCompleted;
    const isViewHistory = typeof arg === 'string' ? undefined : arg.isViewHistory;
    return {
        postId,
        page,
        pageSize,
        dates,
        startDate,
        endDate,
        requestStatuses,
        includeCompleted,
        isViewHistory,
    };
}

interface PostPositionState {
    // Map postId to list of positions
    positionsByPostId: Record<string, PostPositionResponse[]>;
    /** Map postId to totalRecords from last paged fetch (by-post). */
    totalRecordsByPostId: Record<string, number>;
    // Map postId to loading state
    loadingByPostId: Record<string, boolean>;
    // Map postId to error message
    errorsByPostId: Record<string, string | null>;
    // Map `${statusEnum}:${isOngoing}` to list of positions (see postPositionListStateKey)
    positionsByStatus: Record<string, EmployeePostListingItem[]>;
    loadingByStatus: Record<string, boolean>;
    errorsByStatus: Record<string, string | null>;
    paginationByStatus: Record<string, { currentPage: number; pageSize: number; totalItems: number }>;
    // Map postId to available dates
    availableDatesByPostId: Record<string, string[]>;
    // Map postId to loading state for dates
    loadingDatesByPostId: Record<string, boolean>;
    // Map postId to error message for dates
    errorsDatesByPostId: Record<string, string | null>;
    /** Post position ID currently being cancelled (for loading/disable state). */
    cancellingPostPositionId: string | null;
    /** Post position ID currently revoking a pending cancellation (for loading/disable state). */
    revokingCancellationPostPositionId: string | null;
    /** Close assignments list for logged-in employee (statuses: Closed/ClosedAndSplit/Unclosed). */
    closeAssignments: EmployeePostListingItem[];
    closeAssignmentsLoading: boolean;
    closeAssignmentsError: string | null;
    closeAssignmentsPagination: { currentPage: number; pageSize: number; totalItems: number };
    /** Post position ID currently sending invite (for loading/disable state). */
    sendingInvitePostPositionId: string | null;
    /** True while swapping call signs between two post positions. */
    isSwappingCallSigns: boolean;
    /** Keyed by <code>postId|*</code> (unfiltered) or <code>postId|date|n</code> — View Job Position page */
    assignmentsWaitingCache: Record<
        string,
        { assignments: PostPositionResponse[]; waitingList: PostPositionResponse[] }
    >;
    assignmentsWaitingLoadingKeys: Record<string, boolean>;
    assignmentsWaitingErrorsByKey: Record<string, string | null>;
}

export interface CancelPostPositionThunkArg {
    postPositionId: string;
    /** Omitted, empty, or whitespace-only is sent to the API as null */
    cancellationReason: string | null;
    isApproveCancellation?: boolean;
    statusEnum?: number;
    filters?: { page: number; pageSize: number; isOngoing: boolean };
    /** When true, skips `fetchPostPositionsByStatus` (Daily Workspace manages its own refresh). */
    skipAssignedListRefresh?: boolean;
}

export interface RevokePostPositionCancellationThunkArg {
    postPositionId: string;
    filters?: { page: number; pageSize: number; isOngoing: boolean; employeeID?: string };
}

const initialState: PostPositionState = {
    positionsByPostId: {},
    totalRecordsByPostId: {},
    loadingByPostId: {},
    errorsByPostId: {},
    positionsByStatus: {},
    loadingByStatus: {},
    errorsByStatus: {},
    paginationByStatus: {},
    availableDatesByPostId: {},
    loadingDatesByPostId: {},
    errorsDatesByPostId: {},
    cancellingPostPositionId: null,
    revokingCancellationPostPositionId: null,
    closeAssignments: [],
    closeAssignmentsLoading: false,
    closeAssignmentsError: null,
    closeAssignmentsPagination: { currentPage: 1, pageSize: DEFAULT_TABLE_PAGE_SIZE, totalItems: 0 },
    sendingInvitePostPositionId: null,
    isSwappingCallSigns: false,
    assignmentsWaitingCache: {},
    assignmentsWaitingLoadingKeys: {},
    assignmentsWaitingErrorsByKey: {},
};

export interface SendAssignPostEmailThunkArg {
    postPositionId: string;
    employeeId: string;
    postTitle: string;
    dateOfWork?: string | null;
    startTime?: string | null;
    postLength?: number | null;
    postLocation?: string | null;
}

export const fetchPostPositions = createAsyncThunk(
    'postPosition/fetchByPostId',
    async (arg: FetchPostPositionsArg, { rejectWithValue, dispatch }) => {
        const {
            postId,
            page,
            pageSize,
            dates,
            startDate,
            endDate,
            requestStatuses,
            includeCompleted,
            isViewHistory,
        } = normalizeFetchPostPositionsArg(arg);
        try {
            const data = await getPostPositionsByPostId(postId, {
                page,
                pageSize,
                dates,
                startDate,
                endDate,
                requestStatuses,
                includeCompleted,
                ...(typeof isViewHistory === 'boolean' ? { isViewHistory } : {}),
            });
            return { postId, data };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to fetch positions';
            dispatch(showToast(errorMessage, 'error'));
            return rejectWithValue({
                postId,
                error: errorMessage
            });
        }
    }
);

export type FetchPostPositionsByStatusArg = {
    statusEnum: number;
    statuses?: number[];
    filters?: PostPositionFilter;
};

function storageKeyForFetchPostPositionsByStatus(arg: FetchPostPositionsByStatusArg): string {
    return postPositionListStateKey(arg.statusEnum, arg.filters?.isOngoing === true);
}

export const fetchPostPositionsByStatus = createAsyncThunk(
    'postPosition/fetchByStatus',
    async (args: FetchPostPositionsByStatusArg, { rejectWithValue, dispatch }) => {
        try {
            const statusesForApi = args.statuses ?? [args.statusEnum];
            const data = await getPostPositionsByStatus(statusesForApi, args.filters);
            return { statusEnum: args.statusEnum, data };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to fetch job positions by status';
            dispatch(showToast(errorMessage, 'error'));
            return rejectWithValue({
                statusEnum: args.statusEnum,
                error: errorMessage
            });
        }
    }
);

/** My History → Closed Jobs: GET ClosedPostPosition/latest-per-post-position (pagination + optional employeeId scope). */
export const fetchLatestClosedPerPostPositionPaged = createAsyncThunk(
    'postPosition/fetchLatestClosedPerPost',
    async (
        args: {
            statusEnum: number;
            /** Must match the list row (`PostPositionByStatusList` `isOngoing`); drives Redux cache key. */
            isOngoing: boolean;
            filters?: { page?: number; pageSize?: number; limit?: number; employeeId?: string };
        },
        { rejectWithValue, dispatch }
    ) => {
        try {
            const data = await getLatestPerPostPositionPaged(args.filters);
            return { statusEnum: args.statusEnum, data };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to fetch closed post history';
            dispatch(showToast(errorMessage, 'error'));
            return rejectWithValue({
                statusEnum: args.statusEnum,
                error: errorMessage,
            });
        }
    }
);

export const fetchMyCloseAssignmentsThunk = createAsyncThunk(
    'postPosition/fetchMyCloseAssignments',
    async (
        args: { filters?: { page?: number; pageSize?: number; limit?: number; isOngoing?: boolean; searchTerm?: string; employeeID?: string; requesterID?: string; startDate?: string; endDate?: string; isPlaceholder?: boolean } } | undefined,
        { rejectWithValue, dispatch }
    ) => {
        try {
            const data = await getMyCloseAssignments(args?.filters);
            return { data, filters: args?.filters };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to fetch close assignments';
            dispatch(showToast(errorMessage, 'error'));
            return rejectWithValue({ error: errorMessage });
        }
    }
);

export const unclosePostPositionThunk = createAsyncThunk<
    InvoiceRefundActionResult,
    string,
    { rejectValue: string }
>(
    'postPosition/unclose',
    async (postPositionId, { rejectWithValue, dispatch }) => {
        try {
            await unclosePostPosition(postPositionId);
            return { success: true };
        } catch (error) {
            if (error instanceof InvoiceRefundRequiredError) {
                return error.toFailure({ postPositionId });
            }
            const message = error instanceof Error ? error.message : 'Failed to unclose job position';
            dispatch(showToast(message, 'error'));
            return rejectWithValue(message);
        }
    }
);

export const closePostPositionWithEquipmentThunk = createAsyncThunk<
    InvoiceRefundActionResult,
    {
        data: PostCloseFormData;
        equipmentDetails: EquipmentDetail[];
        vehicleDetails: VehicleDetail[];
        questionnaireSubmissions?: QuestionnaireSubmission[];
    },
    { rejectValue: string }
>(
    'postPosition/closeWithEquipment',
    async (args, { rejectWithValue, dispatch }) => {
        try {
            await closePostPositionWithEquipment(
                args.data,
                args.equipmentDetails,
                args.vehicleDetails,
                args.questionnaireSubmissions
            );
            return { success: true };
        } catch (error) {
            if (error instanceof InvoiceRefundRequiredError) {
                return error.toFailure();
            }
            const message = error instanceof Error ? error.message : 'Failed to close job position';
            dispatch(showToast(message, 'error'));
            return rejectWithValue(message);
        }
    }
);

/** `rejectWithValue` shape when split API returns 409 time conflict (same UX as take-job / assign). */
export type SplitPostTimeConflictRejected = {
    kind: 'splitTimeConflict';
    message: string;
    requiresConfirmation: true;
};

/** Parses `unwrap()` rejection or raw reject payload from {@link splitPostPositionWithEquipmentThunk}. */
export function parseSplitPostTimeConflictRejection(err: unknown): SplitPostTimeConflictRejected | null {
    if (err === null || typeof err !== 'object') return null;
    const o = err as Record<string, unknown>;
    const payload = o.payload;
    if (payload !== null && typeof payload === 'object') {
        const p = payload as Record<string, unknown>;
        if (p.kind === 'splitTimeConflict' && p.requiresConfirmation === true) {
            return payload as SplitPostTimeConflictRejected;
        }
    }
    if (o.kind === 'splitTimeConflict' && o.requiresConfirmation === true) {
        return err as SplitPostTimeConflictRejected;
    }
    return null;
}

function isSplitTimeConflictMessage(message: string | undefined | null): boolean {
    if (!message || !String(message).trim()) return false;
    const t = String(message).toLowerCase();
    return (
        t.includes('time conflict') ||
        t.includes('review and confirm') ||
        t.includes('confirm to proceed') ||
        (t.includes('overlap') && t.includes('confirm')) ||
        t.includes('same time slot')
    );
}

/** HTTP status from `expectOkReadText` error text, e.g. `Failed to split: 409 {...}`. */
function parseHttpStatusFromCloseSplitError(error: unknown): number | null {
    if (!(error instanceof Error)) return null;
    const m = error.message.match(/:\s*(\d{3})\s/);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : null;
}

function parseMessageFromCloseSplitError(error: unknown): string {
    if (!(error instanceof Error)) return '';
    const text = error.message;
    try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const obj = JSON.parse(jsonMatch[0]) as { message?: string; Message?: string };
            const msg = obj?.message ?? obj?.Message;
            if (typeof msg === 'string' && msg.trim()) return msg.trim();
        }
    } catch {
        // ignore
    }
    return '';
}

export const splitPostPositionWithEquipmentThunk = createAsyncThunk(
    'postPosition/splitWithEquipment',
    async (
        args: {
            data: PostCloseFormData;
            equipmentDetails: EquipmentDetail[];
            vehicleDetails: VehicleDetail[];
            questionnaireSubmissions?: QuestionnaireSubmission[];
            confirmConflict?: boolean;
        },
        { rejectWithValue }
    ) => {
        try {
            return await splitPostPositionWithEquipment(
                args.data,
                args.equipmentDetails,
                args.vehicleDetails,
                args.questionnaireSubmissions,
                args.confirmConflict === true ? { confirmConflict: true } : undefined
            );
        } catch (error) {
            const status = parseHttpStatusFromCloseSplitError(error);
            const apiMessage = parseMessageFromCloseSplitError(error);
            if (status === 409 || (status === 400 && isSplitTimeConflictMessage(apiMessage))) {
                return rejectWithValue({
                    kind: 'splitTimeConflict',
                    message: apiMessage || 'Time conflict detected. Please confirm to proceed.',
                    requiresConfirmation: true,
                } satisfies SplitPostTimeConflictRejected);
            }
            return rejectWithValue(
                getCloseOrSplitErrorMessage(error, 'Failed to split job position')
            );
        }
    }
);

/**
 * Extract user-facing message from close/split API error responses.
 * API returns 400 with body: { "error": "...", "message": "Employee is in Different Department." }
 * so we show message in the toast, not the full error string.
 */
function getCloseOrSplitErrorMessage(error: unknown, fallback: string): string {
    if (!(error instanceof Error)) return fallback;
    const text = error.message;
    try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const obj = JSON.parse(jsonMatch[0]) as { message?: string; Message?: string };
            const msg = obj?.message ?? obj?.Message;
            if (typeof msg === 'string' && msg.trim()) return msg.trim();
        }
    } catch {
        // ignore
    }
    return fallback;
}

/**
 * Helper function to parse error messages from API responses
 * Handles format: "Failed to bulk assign employees to post: 500 {"status":500,"message":"...",...}"
 */
const parseErrorMessage = (error: unknown): string => {
    let errorMessage = 'Failed to bulk assign employees';

    if (error instanceof Error) {
        const errorText = error.message;

        // Try to extract JSON object from response (might have status code prefix)
        // Pattern: "500 {...}" or just "{...}"
        try {
            const jsonMatch = errorText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const jsonText = jsonMatch[0];
                const errorJson = JSON.parse(jsonText);

                // Check for message field in the error response
                if (errorJson.message && typeof errorJson.message === 'string') {
                    errorMessage = errorJson.message;
                    
                    // Handle specific error messages with user-friendly alternatives
                    if (errorMessage.includes('A second operation was started on this context instance')) {
                        errorMessage = 'A database operation is already in progress. Please wait a moment and try again.';
                    } else if (errorMessage.includes('DbContext')) {
                        errorMessage = 'A database error occurred. Please try again.';
                    }
                } else if (errorJson.Message && typeof errorJson.Message === 'string') {
                    // Some APIs use capitalized 'Message'
                    errorMessage = errorJson.Message;
                } else if (Array.isArray(errorJson.errors) && errorJson.errors.length > 0) {
                    // Some APIs return errors array
                    errorMessage = errorJson.errors[0];
                }
            } else {
                // If no JSON found, try regex extraction as fallback
                const messageMatch = errorText.match(/"message"\s*:\s*"([^"]+)"/);
                if (messageMatch && messageMatch[1]) {
                    errorMessage = messageMatch[1];
                }
            }
        } catch {
            // If JSON parsing fails, use a generic message instead of raw error
            errorMessage = 'An error occurred while assigning employees. Please try again.';
        }
    }

    return errorMessage;
};

/** Thunk `rejectWithValue` when the API returns a row with `hasTimeConflictRequiringConfirmation` and the request had no `confirmConflict`. */
export type BulkAssignTimeConflictRejected = {
    kind: 'timeConflict';
    /** Raw technical message for fallbacks. */
    message: string;
    /**
     * When the API provides `timeConflictDialogMessage` on a conflict row, full preformatted text for the modal; prefer this in the UI.
     */
    timeConflictDialogMessage?: string | null;
    bulkAssignData: BulkAssignPostPositionRequest;
    /**
     * Employees whose assignment hit a confirmable time conflict (API `employeeId` on those rows).
     * UI "No" should bulk-assign again without these IDs so remaining employees still process (server stops the loop at the first conflict).
     */
    conflictingEmployeeIds: string[];
};

type BulkResultRow = BulkAssignPostPositionItemDto & Record<string, unknown>;

function getBulkResultMessage(r: BulkResultRow): string {
    const m = r.message ?? r['Message'];
    return typeof m === 'string' ? m.trim() : '';
}

function bulkRowRequiresTimeConflictFlag(r: BulkResultRow): boolean {
    return (
        r.hasTimeConflictRequiringConfirmation === true ||
        r['HasTimeConflictRequiringConfirmation'] === true
    );
}

function getBulkTimeConflictDialogText(r: BulkResultRow): string {
    const t = r.timeConflictDialogMessage ?? r['TimeConflictDialogMessage'];
    return typeof t === 'string' ? t.trim() : '';
}

function rowIsBulkTimeConflict(row: BulkResultRow): boolean {
    return bulkRowRequiresTimeConflictFlag(row);
}

function findBulkTimeConflictForModal(
    results: BulkAssignPostPositionItemDto[]
): { message: string; timeConflictDialogMessage: string | null } | null {
    let firstMsg = '';
    let timeConflictDialogMessage: string | null = null;
    for (const r of results) {
        const row = r as BulkResultRow;
        if (!rowIsBulkTimeConflict(row)) continue;
        if (!firstMsg) {
            firstMsg = getBulkResultMessage(row) || 'Time conflict. Please review and confirm to proceed.';
        }
        if (!timeConflictDialogMessage) {
            const d = getBulkTimeConflictDialogText(row);
            if (d) timeConflictDialogMessage = d;
        }
    }
    if (!firstMsg) return null;
    return {
        message: firstMsg,
        timeConflictDialogMessage,
    };
}

function findBulkTimeConflictEmployeeIds(
    results: BulkAssignPostPositionItemDto[],
    requestedEmployeeIds: string[]
): string[] {
    const ids: string[] = [];
    for (const r of results) {
        const row = r as BulkResultRow;
        if (!rowIsBulkTimeConflict(row)) continue;
        const raw =
            row.employeeId ??
            row['EmployeeId'] ??
            row['employeeID'] ??
            row['EmployeeID'];
        if (raw != null && String(raw).trim() !== '') {
            ids.push(String(raw));
        }
    }
    if (ids.length === 0 && results.length > 0 && requestedEmployeeIds.length > 0) {
        const first = results[0] as BulkResultRow;
        if (rowIsBulkTimeConflict(first)) {
            return [requestedEmployeeIds[0]];
        }
    }
    return ids;
}

export const bulkAssignPostPositionsThunk = createAsyncThunk(
    'postPosition/bulkAssign',
    async (bulkAssignData: BulkAssignPostPositionRequest, { rejectWithValue, dispatch }) => {
        try {
            const results = await bulkAssignPostPositions(bulkAssignData);
            if (!bulkAssignData.confirmConflict) {
                const conflict = findBulkTimeConflictForModal(results);
                if (conflict) {
                    const conflictingEmployeeIds = findBulkTimeConflictEmployeeIds(
                        results,
                        bulkAssignData.employeeIDs
                    );
                    return rejectWithValue({
                        kind: 'timeConflict' as const,
                        message: conflict.message,
                        timeConflictDialogMessage: conflict.timeConflictDialogMessage,
                        bulkAssignData,
                        conflictingEmployeeIds,
                    } satisfies BulkAssignTimeConflictRejected);
                }
            }
            // Process results: per-item hasError, message, optional employeeId / hasTimeConflictRequiringConfirmation
            const successResults = results.filter((r) => !r.hasError);
            const errorResults = results.filter((r) => r.hasError);
            const isTransferFlow = bulkAssignData.isTransfer === true;
            const actionPastTense = isTransferFlow ? 'transferred' : 'assigned';
            
            if (errorResults.length > 0) {
                errorResults.forEach((result) => {
                    const message = result.message ?? `Failed to ${isTransferFlow ? 'transfer' : 'assign'} job position`;
                    if (bulkRowRequiresTimeConflictFlag(result as BulkResultRow)) return;
                    // Some transfer responses may return a success message even when hasError is set.
                    const looksLikeSuccessMessage =
                        /\bsuccess(fully)?\b/i.test(message) || /\btransferred?\b/i.test(message);
                    const tone = isTransferFlow && looksLikeSuccessMessage ? 'success' : 'error';
                    dispatch(showToast(message, tone));
                });
                if (successResults.length > 0) {
                    dispatch(showToast(`${successResults.length} employee${successResults.length !== 1 ? 's' : ''} ${actionPastTense} successfully`, 'success'));
                }
            } else {
                dispatch(showToast(`Successfully ${actionPastTense} ${results.length} employee${results.length !== 1 ? 's' : ''}`, 'success'));
            }
            
            return { results, postID: bulkAssignData.postID };
        } catch (error) {
            const errorMessage = parseErrorMessage(error);
            dispatch(showToast(errorMessage, 'error'));
            return rejectWithValue(errorMessage);
        }
    }
);

export const cancelPostPositionThunk = createAsyncThunk(
    'postPosition/cancel',
    async (arg: CancelPostPositionThunkArg, { rejectWithValue, dispatch }) => {
        try {
            await cancelPostPosition(arg.postPositionId, arg.cancellationReason, arg.isApproveCancellation);
            dispatch(showToast('Post cancelled successfully', 'success'));
            
            // Only refresh the list when it's not an approval cancellation
            if (!arg.isApproveCancellation && !arg.skipAssignedListRefresh) {
                dispatch(
                    fetchPostPositionsByStatus({
                        statusEnum: PostPositionStatus.Assigned,
                        statuses: [PostPositionStatus.Assigned, PostPositionStatus.CancellationPending],
                        filters: arg.filters,
                    })
                );
            }
            
            return { postPositionId: arg.postPositionId };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to cancel post';
            dispatch(showToast(errorMessage, 'error'));
            return rejectWithValue({ postPositionId: arg.postPositionId, error: errorMessage });
        }
    }
);

export const swapPostPositionCallSignsThunk = createAsyncThunk(
    'postPosition/swapCallSigns',
    async (
        arg: { postPositionId1: string; postPositionId2: string },
        { rejectWithValue, dispatch }
    ) => {
        try {
            await swapPostPositionCallSigns(arg.postPositionId1, arg.postPositionId2);
            dispatch(showToast('Call signs swapped successfully', 'success'));
            return arg;
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : 'Failed to swap call signs';
            dispatch(showToast(errorMessage, 'error'));
            return rejectWithValue(errorMessage);
        }
    }
);

export const updatePostPositionCallSignThunk = createAsyncThunk(
    'postPosition/updateCallSign',
    async (
        arg: {
            postPositionId: string;
            fieldValue: string | null | undefined;
            fieldName?: string;
        },
        { rejectWithValue, dispatch }
    ) => {
        try {
            await updatePostPositionCallSign(
                arg.postPositionId,
                arg.fieldValue,
                arg.fieldName ?? POST_POSITION_CALL_SIGN_FIELD_NAME
            );
            dispatch(showToast(POST_POSITION.CALL_SIGN.UPDATED, 'success'));
            return arg;
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : POST_POSITION.CALL_SIGN.UPDATE_FAILED;
            dispatch(showToast(errorMessage, 'error'));
            return rejectWithValue(errorMessage);
        }
    }
);

export const revokePostPositionCancellationThunk = createAsyncThunk(
    'postPosition/revokeCancellation',
    async (arg: RevokePostPositionCancellationThunkArg, { rejectWithValue, dispatch }) => {
        try {
            await revokePostPositionCancellation(arg.postPositionId);
            dispatch(showToast('Cancellation revoked successfully', 'success'));
            dispatch(
                fetchPostPositionsByStatus({
                    statusEnum: PostPositionStatus.Assigned,
                    statuses: [PostPositionStatus.Assigned, PostPositionStatus.CancellationPending],
                    filters: arg.filters,
                })
            );
            return { postPositionId: arg.postPositionId };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to revoke cancellation';
            dispatch(showToast(errorMessage, 'error'));
            return rejectWithValue({ postPositionId: arg.postPositionId, error: errorMessage });
        }
    }
);

export const sendAssignPostEmailThunk = createAsyncThunk(
    'postPosition/sendAssignPostEmail',
    async (arg: SendAssignPostEmailThunkArg, { rejectWithValue, dispatch }) => {
        try {
            const employeeId = String(arg.employeeId ?? '').trim();
            const postTitle = String(arg.postTitle ?? '').trim();
            if (!employeeId) {
                const message = 'Current employee ID is required to send invite.';
                dispatch(showToast(message, 'error'));
                return rejectWithValue({ postPositionId: arg.postPositionId, error: message });
            }
            if (!postTitle) {
                const message = 'Post title is required to send invite.';
                dispatch(showToast(message, 'error'));
                return rejectWithValue({ postPositionId: arg.postPositionId, error: message });
            }

            await sendAssignPostEmail(arg.postPositionId, {
                employeeId: String(employeeId),
                postTitle,
                dateOfWork: arg.dateOfWork ?? null,
                startTime: arg.startTime ?? null,
                postLength: typeof arg.postLength === 'number' ? arg.postLength : null,
                postLocation: arg.postLocation ?? null,
            });
            dispatch(showToast('Invite email sent successfully.', 'success'));
            return { postPositionId: arg.postPositionId };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to send invite email.';
            dispatch(showToast(errorMessage, 'error'));
            return rejectWithValue({ postPositionId: arg.postPositionId, error: errorMessage });
        }
    }
);

export const assignmentsWaitingCacheKey = getAssignmentsAndWaitingListCacheKey;

export const fetchAssignmentsAndWaitingListForPostDate = createAsyncThunk(
    'postPosition/fetchAssignmentsAndWaitingForDate',
    async (arg: { postId: string; startDate?: string; numberOfDays?: number }, { rejectWithValue }) => {
        const postId = arg.postId.trim();
        const s = (arg.startDate ?? '').trim();
        const hasWindow = Boolean(s);
        const key = getAssignmentsAndWaitingListCacheKey(
            postId,
            hasWindow ? s : null,
            hasWindow ? arg.numberOfDays : null
        );
        try {
            const data = await getAssignmentsAndWaitingListForPostDate(
                postId,
                hasWindow ? s : null,
                hasWindow ? arg.numberOfDays ?? null : null
            );
            return {
                key,
                postId,
                startDate: hasWindow ? s : undefined,
                numberOfDays: hasWindow ? arg.numberOfDays : undefined,
                assignments: data.assignments ?? [],
                waitingList: data.waitingList ?? [],
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to fetch assignments and waiting list';
            return rejectWithValue({ key, error: errorMessage });
        }
    }
);

export const fetchPostPositionsDatesByPostId = createAsyncThunk(
    'postPosition/fetchDatesByPostId',
    async (postId: string, { rejectWithValue }) => {
        try {
            const dates = await getPostPositionsDatesByPostId(postId);
            // Ensure dates are in YYYY-MM-DD format
            const formattedDates = dates.map(date => {
                // If date includes time, extract just the date part
                if (date.includes('T')) {
                    return date.split('T')[0];
                }
                return date;
            });
            return { postId, dates: formattedDates };
        } catch (error) {
            return rejectWithValue({
                postId,
                error: error instanceof Error ? error.message : 'Failed to fetch job position dates'
            });
        }
    }
);

const postPositionSlice = createSlice({
    name: 'postPosition',
    initialState,
    reducers: {
        clearAssignmentsWaitingCacheKey: (state, action: PayloadAction<string>) => {
            const k = action.payload;
            delete state.assignmentsWaitingCache[k];
            delete state.assignmentsWaitingLoadingKeys[k];
            delete state.assignmentsWaitingErrorsByKey[k];
        },
        clearPostPositions: (state, action) => {
            const postId = action.payload;
            delete state.positionsByPostId[postId];
            delete state.loadingByPostId[postId];
            delete state.errorsByPostId[postId];
        },
        setPaginationByStatus: (
            state,
            action: PayloadAction<{
                statusEnum: number;
                isOngoing: boolean;
                pagination: { currentPage?: number; pageSize?: number; totalItems?: number };
            }>
        ) => {
            const key = postPositionListStateKey(action.payload.statusEnum, action.payload.isOngoing);
            const { pagination } = action.payload;
            if (!state.paginationByStatus[key]) {
                state.paginationByStatus[key] = { currentPage: 1, pageSize: DEFAULT_TABLE_PAGE_SIZE, totalItems: 0 };
            }
            if (pagination.currentPage !== undefined) {
                state.paginationByStatus[key].currentPage = pagination.currentPage;
            }
            if (pagination.pageSize !== undefined) {
                state.paginationByStatus[key].pageSize = pagination.pageSize;
            }
            if (pagination.totalItems !== undefined) {
                state.paginationByStatus[key].totalItems = pagination.totalItems;
            }
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchPostPositions.pending, (state, action) => {
                const { postId } = normalizeFetchPostPositionsArg(action.meta.arg);
                state.loadingByPostId[postId] = true;
                state.errorsByPostId[postId] = null;
            })
            .addCase(fetchPostPositions.fulfilled, (state, action) => {
                const { postId, data } = action.payload;
                state.loadingByPostId[postId] = false;
                state.positionsByPostId[postId] = data.data; // Extract the data array from PagedResponse
                state.totalRecordsByPostId[postId] =
                    data.totalRecords ?? data.data?.length ?? 0;
                state.errorsByPostId[postId] = null;
            })
            .addCase(fetchPostPositions.rejected, (state, action) => {
                const payload = action.payload as { postId: string; error: string };
                // If payload is undefined (e.g. strict mode serialization issue), fallback to meta.arg
                const postId =
                    payload?.postId ?? normalizeFetchPostPositionsArg(action.meta.arg).postId;
                const errorMsg = payload?.error || action.error.message || 'Unknown error';

                state.loadingByPostId[postId] = false;
                state.errorsByPostId[postId] = errorMsg;
            })
            .addCase(fetchPostPositionsByStatus.pending, (state, action) => {
                const storageKey = storageKeyForFetchPostPositionsByStatus(action.meta.arg);
                state.loadingByStatus[storageKey] = true;
                state.errorsByStatus[storageKey] = null;
            })
            .addCase(fetchPostPositionsByStatus.fulfilled, (state, action) => {
                const { data } = action.payload;
                const storageKey = storageKeyForFetchPostPositionsByStatus(action.meta.arg);
                state.loadingByStatus[storageKey] = false;
                state.positionsByStatus[storageKey] = data.data; // Extract the data array from PagedResponse
                state.errorsByStatus[storageKey] = null;
                // Update pagination state
                if (!state.paginationByStatus[storageKey]) {
                    state.paginationByStatus[storageKey] = { currentPage: 1, pageSize: DEFAULT_TABLE_PAGE_SIZE, totalItems: 0 };
                }
                state.paginationByStatus[storageKey].totalItems = data.totalRecords || data.data.length;
            })
            .addCase(fetchPostPositionsByStatus.rejected, (state, action) => {
                const payload = action.payload as { statusEnum: number; error: string } | undefined;
                const storageKey = storageKeyForFetchPostPositionsByStatus(action.meta.arg);
                const errorMsg = payload?.error || action.error.message || 'Unknown error';

                state.loadingByStatus[storageKey] = false;
                state.errorsByStatus[storageKey] = errorMsg;
            })
            .addCase(fetchLatestClosedPerPostPositionPaged.pending, (state, action) => {
                const key = postPositionListStateKey(action.meta.arg.statusEnum, action.meta.arg.isOngoing);
                state.loadingByStatus[key] = true;
                state.errorsByStatus[key] = null;
            })
            .addCase(fetchLatestClosedPerPostPositionPaged.fulfilled, (state, action) => {
                const { data } = action.payload;
                const key = postPositionListStateKey(action.meta.arg.statusEnum, action.meta.arg.isOngoing);
                state.loadingByStatus[key] = false;
                state.positionsByStatus[key] = data.data;
                state.errorsByStatus[key] = null;
                if (!state.paginationByStatus[key]) {
                    state.paginationByStatus[key] = { currentPage: 1, pageSize: DEFAULT_TABLE_PAGE_SIZE, totalItems: 0 };
                }
                state.paginationByStatus[key].totalItems = data.totalRecords || data.data.length;
            })
            .addCase(fetchLatestClosedPerPostPositionPaged.rejected, (state, action) => {
                const payload = action.payload as { statusEnum: number; error: string } | undefined;
                const key = postPositionListStateKey(action.meta.arg.statusEnum, action.meta.arg.isOngoing);
                const errorMsg = payload?.error || action.error.message || 'Unknown error';
                state.loadingByStatus[key] = false;
                state.errorsByStatus[key] = errorMsg;
            })
            // Fetch dates by postId
            .addCase(fetchPostPositionsDatesByPostId.pending, (state, action) => {
                const postId = action.meta.arg;
                state.loadingDatesByPostId[postId] = true;
                state.errorsDatesByPostId[postId] = null;
            })
            .addCase(fetchPostPositionsDatesByPostId.fulfilled, (state, action) => {
                const { postId, dates } = action.payload;
                state.loadingDatesByPostId[postId] = false;
                state.availableDatesByPostId[postId] = dates;
                state.errorsDatesByPostId[postId] = null;
            })
            .addCase(fetchPostPositionsDatesByPostId.rejected, (state, action) => {
                const payload = action.payload as { postId: string; error: string };
                const postId = payload?.postId || action.meta.arg;
                const errorMsg = payload?.error || action.error.message || 'Unknown error';

                state.loadingDatesByPostId[postId] = false;
                state.errorsDatesByPostId[postId] = errorMsg;
            })
            .addCase(cancelPostPositionThunk.pending, (state, action) => {
                state.cancellingPostPositionId = action.meta.arg.postPositionId;
            })
            .addCase(cancelPostPositionThunk.fulfilled, (state) => {
                state.cancellingPostPositionId = null;
            })
            .addCase(cancelPostPositionThunk.rejected, (state) => {
                state.cancellingPostPositionId = null;
            })
            .addCase(revokePostPositionCancellationThunk.pending, (state, action) => {
                state.revokingCancellationPostPositionId = action.meta.arg.postPositionId;
            })
            .addCase(revokePostPositionCancellationThunk.fulfilled, (state) => {
                state.revokingCancellationPostPositionId = null;
            })
            .addCase(revokePostPositionCancellationThunk.rejected, (state) => {
                state.revokingCancellationPostPositionId = null;
            })
            .addCase(fetchMyCloseAssignmentsThunk.pending, (state) => {
                state.closeAssignmentsLoading = true;
                state.closeAssignmentsError = null;
            })
            .addCase(fetchMyCloseAssignmentsThunk.fulfilled, (state, action) => {
                state.closeAssignmentsLoading = false;
                state.closeAssignmentsError = null;
                state.closeAssignments = action.payload.data.data ?? [];
                state.closeAssignmentsPagination.totalItems =
                    action.payload.data.totalRecords ?? action.payload.data.data?.length ?? 0;
                if (action.payload.filters?.page != null) {
                    state.closeAssignmentsPagination.currentPage = action.payload.filters.page;
                }
                if (action.payload.filters?.pageSize != null) {
                    state.closeAssignmentsPagination.pageSize = action.payload.filters.pageSize;
                }
            })
            .addCase(fetchMyCloseAssignmentsThunk.rejected, (state, action) => {
                state.closeAssignmentsLoading = false;
                const payload = action.payload as { error?: string } | undefined;
                state.closeAssignmentsError = payload?.error || action.error.message || 'Failed to fetch close assignments';
                state.closeAssignments = [];
                state.closeAssignmentsPagination.totalItems = 0;
            })
            .addCase(sendAssignPostEmailThunk.pending, (state, action) => {
                state.sendingInvitePostPositionId = action.meta.arg.postPositionId;
            })
            .addCase(sendAssignPostEmailThunk.fulfilled, (state) => {
                state.sendingInvitePostPositionId = null;
            })
            .addCase(sendAssignPostEmailThunk.rejected, (state) => {
                state.sendingInvitePostPositionId = null;
            })
            .addCase(swapPostPositionCallSignsThunk.pending, (state) => {
                state.isSwappingCallSigns = true;
            })
            .addCase(swapPostPositionCallSignsThunk.fulfilled, (state) => {
                state.isSwappingCallSigns = false;
            })
            .addCase(swapPostPositionCallSignsThunk.rejected, (state) => {
                state.isSwappingCallSigns = false;
            })
            .addCase(fetchAssignmentsAndWaitingListForPostDate.pending, (state, action) => {
                const { postId, startDate, numberOfDays } = action.meta.arg;
                const s = (startDate ?? '').trim();
                const hasWindow = Boolean(s);
                const key = getAssignmentsAndWaitingListCacheKey(
                    postId,
                    hasWindow ? s : null,
                    hasWindow ? numberOfDays : null
                );
                state.assignmentsWaitingLoadingKeys[key] = true;
                state.assignmentsWaitingErrorsByKey[key] = null;
            })
            .addCase(fetchAssignmentsAndWaitingListForPostDate.fulfilled, (state, action) => {
                const { key, assignments, waitingList } = action.payload;
                state.assignmentsWaitingLoadingKeys[key] = false;
                state.assignmentsWaitingErrorsByKey[key] = null;
                state.assignmentsWaitingCache[key] = { assignments, waitingList };
            })
            .addCase(fetchAssignmentsAndWaitingListForPostDate.rejected, (state, action) => {
                const payload = action.payload as { key: string; error: string } | undefined;
                const s = (action.meta.arg.startDate ?? '').trim();
                const hasWindow = Boolean(s);
                const key =
                    payload?.key ??
                    getAssignmentsAndWaitingListCacheKey(
                        action.meta.arg.postId,
                        hasWindow ? s : null,
                        hasWindow ? action.meta.arg.numberOfDays : null
                    );
                state.assignmentsWaitingLoadingKeys[key] = false;
                state.assignmentsWaitingErrorsByKey[key] =
                    payload?.error || action.error.message || 'Failed to load';
            });
    },
});

export const { clearPostPositions, setPaginationByStatus, clearAssignmentsWaitingCacheKey } =
    postPositionSlice.actions;
export default postPositionSlice.reducer;
