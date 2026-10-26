/**
 * Available Post Redux Slice
 */
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import {
    getAvailablePosts,
    getDashboardRequesterFilterOptions,
    assignPostToMe,
    assignTenurePositionToMe,
    applySpecialEventRequestToMe,
    isCancelledSlotAvailablePositionsMessage,
} from '@/services/availablePostService';
import { SearchModel, AssignToMeRequest, RequestFilterOption } from '@/types/availablePost';
import type { EmployeePostListingItem } from '@/types/employeePostListingItem';
import type { RootState } from '@/store';
import { PageParam } from '@/types/common';
import { ReleaseAs } from '@/types/request';
import { getLocalTodayYyyyMmDd } from '@/utils/dateTimeUtils';
import { getRequestViewDetails } from '@/services/requestViewDetailsService';
import {
    enrichEmployeeListingViewDetailsFromRow,
    mapEmployeeListingViewDetails,
    type EmployeeListingViewDetailsMapped,
} from '@/utils/mapRequestViewDetails';
import type { RequestResponse } from '@/types/request';
import type { RequesterResponse } from '@/types/requester';
import type { Post } from '@/types/post';
import type { FileUploadDto } from '@/types/fileUpload';
import { showToast } from './toastSlice';
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants/tablePagination';

interface AvailablePostState {
    posts: EmployeePostListingItem[];
    totalRecords: number;
    /** Last requested page for main available-post API (used when refreshing after assign, etc.). */
    listPage: number;
    listPageSize: number;
    isLoading: boolean;
    /** When true, list page shows waiting posts (0 slots) instead of available posts */
    showWaitingPosts: boolean;
    waitingListPosts: EmployeePostListingItem[];
    waitingListTotalRecords: number;
    waitingListPage: number;
    waitingListPageSize: number;
    isWaitingListLoading: boolean;
    waitingListMessage: string | null;
    waitingListSelectedPost: EmployeePostListingItem | null;
    waitingListDetailsOpen: boolean;
    isWaitingListDetailsLoading: boolean;
    waitingListDetailsMessage: string | null;
    waitingListRequest: RequestResponse | null;
    waitingListRequester: RequesterResponse | null;
    waitingListPost: Post | null;
    waitingListFiles: FileUploadDto[];
    assigningPostIds: Record<string, boolean>; // Track which posts are being assigned
    error: string | null; // API/network errors
    displayError: string | null; // Blocking error from backend (e.g., outstanding ready-to-close post)
    hasOutstandingReadyToClosePost: boolean;
    searchModel: SearchModel;
    /** Timestamp when Apply was last clicked; list refetches when this changes so Apply always triggers API */
    filterAppliedAt: number;
    /** Requester dropdown options from dashboard-requesteroptions (date window) */
    requesterFilterOptions: RequestFilterOption[];
    requesterFilterOptionsLoading: boolean;
}

const initialSearchModel: SearchModel = {
    startDate: getLocalTodayYyyyMmDd(),
    numberOfDays: 30, // Default 30 days (matches dropdown option)
    // Default to Open so Available Post opens on Open tab
    releaseAs: ReleaseAs.Open,
    managedGeneralIncludesPreferred: false,
};

const initialState: AvailablePostState = {
    posts: [],
    totalRecords: 0,
    listPage: 1,
    listPageSize: DEFAULT_TABLE_PAGE_SIZE,
    isLoading: false,
    showWaitingPosts: false,
    waitingListPosts: [],
    waitingListTotalRecords: 0,
    waitingListPage: 1,
    waitingListPageSize: DEFAULT_TABLE_PAGE_SIZE,
    isWaitingListLoading: false,
    waitingListMessage: null,
    waitingListSelectedPost: null,
    waitingListDetailsOpen: false,
    isWaitingListDetailsLoading: false,
    waitingListDetailsMessage: null,
    waitingListRequest: null,
    waitingListRequester: null,
    waitingListPost: null,
    waitingListFiles: [],
    assigningPostIds: {},
    error: null,
    displayError: null,
    hasOutstandingReadyToClosePost: false,
    searchModel: initialSearchModel,
    filterAppliedAt: 0,
    requesterFilterOptions: [],
    requesterFilterOptionsLoading: false,
};

export const fetchDashboardRequesterFilterOptions = createAsyncThunk(
    'availablePost/fetchRequesterFilterOptions',
    async (
        {
            startDate,
            numberOfDays,
            searchTerm,
        }: { startDate: string; numberOfDays: number; searchTerm?: string },
        { rejectWithValue }
    ) => {
        try {
            return await getDashboardRequesterFilterOptions(startDate, numberOfDays, searchTerm);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to fetch requesters';
            return rejectWithValue(errorMessage);
        }
    }
);

export const fetchAvailablePosts = createAsyncThunk(
    'availablePost/fetch',
    async (
        args: { searchModel: SearchModel; pagination?: PageParam; employeeId?: string } | undefined,
        { getState, rejectWithValue, dispatch }
    ) => {
        try {
            const state = getState() as RootState;
            const ap = state.availablePost;
            const searchModel = args?.searchModel || ap.searchModel;
            const pagination: PageParam = {
                page: args?.pagination?.page ?? ap.listPage ?? 1,
                pageSize: args?.pagination?.pageSize ?? ap.listPageSize ?? DEFAULT_TABLE_PAGE_SIZE,
            };
            const result = await getAvailablePosts(searchModel, pagination, {
                employeeId: args?.employeeId,
            });

            return { ...result, pagination };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to fetch available jobs';
            dispatch(showToast(errorMessage, 'error'));
            return rejectWithValue(errorMessage);
        }
    }
);

/**
 * Fetch waiting-list rows from the API (same endpoint as available posts with displayWaitingList).
 * The server decides which posts belong on the waiting list; the client does not filter by slot count.
 */
export const fetchWaitingListPosts = createAsyncThunk(
    'availablePost/fetchWaitingList',
    async (
        args: { searchModel: SearchModel; pagination?: PageParam; employeeId?: string } | undefined,
        { getState, rejectWithValue }
    ) => {
        try {
            const state = getState() as RootState;
            const ap = state.availablePost;
            const searchModel = args?.searchModel || ap.searchModel;
            const pagination: PageParam = {
                page: args?.pagination?.page ?? ap.waitingListPage ?? 1,
                pageSize: args?.pagination?.pageSize ?? ap.waitingListPageSize ?? DEFAULT_TABLE_PAGE_SIZE,
            };

            const r = await getAvailablePosts(searchModel, pagination, {
                displayWaitingList: true,
                employeeId: args?.employeeId,
            });

            return {
                data: r.data ?? [],
                totalRecords: r.totalRecords ?? 0,
                pagination,
                error: r.error,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to fetch waiting list';
            return rejectWithValue(errorMessage);
        }
    }
);

export const fetchWaitingListPostDetails = createAsyncThunk(
    'availablePost/fetchWaitingListDetails',
    async (post: EmployeePostListingItem, { rejectWithValue }) => {
        try {
            return await loadAvailablePostDetails(post);
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Failed to load post details';
            return rejectWithValue(msg);
        }
    }
);

/**
 * Fetch details for an available post (request, requester, post, attachments).
 * Components should dispatch and unwrap() then render from local state.
 */
export const fetchAvailablePostDetails = createAsyncThunk(
    'availablePost/fetchDetails',
    async (post: EmployeePostListingItem, { rejectWithValue }) => {
        try {
            return await loadAvailablePostDetails(post);
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Failed to load post details';
            return rejectWithValue(msg);
        }
    }
);

async function loadAvailablePostDetails(post: EmployeePostListingItem): Promise<EmployeeListingViewDetailsMapped> {
    const postPositionId = post.postPositionId?.trim() || undefined;
    const postId = post.postID?.trim() || undefined;
    const requestId = post.requestID?.trim() || undefined;
    if (!postPositionId && !postId && !requestId) {
        return {
            postData: null,
            requestData: null,
            requesterData: null,
            files: [],
            viewDetailsAvailablePositions: null,
            viewDetailsTotalPostPositions: null,
            specialEventJobDetailsMessage: null,
            latestPostNote: null,
            detailModalEquipmentRaw: [],
            viewDetailsShowVehicle: false,
            viewDetailsShowEquipment: false,
        };
    }

    const dateOfWork = String(post.startDate ?? '').trim().slice(0, 10) || undefined;

    const dto = await getRequestViewDetails({
        postPositionId,
        postId,
        requestId,
        dateOfWork,
        isSpecialEvent:
            post.isSpecialEvent === true ? true : post.isSpecialEvent === false ? false : undefined,
    });

    return enrichEmployeeListingViewDetailsFromRow(
        mapEmployeeListingViewDetails(post, dto),
        post
    );
}

export type AssignPostToMeThunkArg = AssignToMeRequest & {
    releaseAs?: ReleaseAs;
    suppressToast?: boolean;
    /** When true, call assign-post-to-me without postPositionId (after 422 from cancelled-slot attempt). */
    omitPostPositionId?: boolean;
};

function specialEventAssignKey(requestID: string, dateOfWork: string): string {
    return `se:${(requestID ?? '').trim()}:${String(dateOfWork ?? '').slice(0, 10)}`;
}

export const applySpecialEventRequestThunk = createAsyncThunk(
    'availablePost/applySpecialEventRequest',
    async (
        args: { requestID: string; dateOfWork: string; suppressToast?: boolean },
        { rejectWithValue, dispatch }
    ) => {
        try {
            const result = await applySpecialEventRequestToMe(args.requestID, args.dateOfWork);
            const { status, message } = result;

            if (status === 200) {
                if (!args.suppressToast && message) dispatch(showToast(message, 'success'));
                return { assigningKey: specialEventAssignKey(args.requestID, args.dateOfWork), message };
            }

            if (!args.suppressToast && message) dispatch(showToast(message, 'error'));
            return rejectWithValue({
                status,
                message: message || 'Failed to apply for special event',
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to apply for special event';
            if (!args.suppressToast) dispatch(showToast(errorMessage, 'error'));
            return rejectWithValue({ status: 500, message: errorMessage });
        }
    }
);

export const assignPostToMeThunk = createAsyncThunk(
    'availablePost/assignToMe',
    async (assignData: AssignPostToMeThunkArg, { rejectWithValue, dispatch }) => {
        try {
            const assignPayload: AssignToMeRequest = {
                postID: assignData.postID,
                dateOfWork: assignData.dateOfWork,
                startDate: assignData.startDate ?? assignData.dateOfWork,
                confirmConflict: assignData.confirmConflict,
                ...(!assignData.omitPostPositionId && assignData.postPositionId?.trim()
                    ? { postPositionId: assignData.postPositionId.trim() }
                    : {}),
            };

            const result =
                assignData.releaseAs === ReleaseAs.TenureBased
                    ? await assignTenurePositionToMe(assignData)
                    : await assignPostToMe(assignPayload);

            const { status, message, hasTimeConflictRequiringConfirmation } = result;

            // Status 200: Success - show success toast
            if (status === 200) {
                if (!assignData.suppressToast && message) dispatch(showToast(message, 'success'));
                return { 
                    postID: assignData.postID, 
                    message
                };
            }

            // Assign-post-to-me / tenure-assign return HTTP/body 409 only for overlap confirmation; body may omit hasTimeConflictRequiringConfirmation (see GetStatusMessageOnly).
            if (status === 409 && hasTimeConflictRequiringConfirmation === true) {
                return rejectWithValue({ 
                    status: 409, 
                    message: message || 'Time conflict detected. Please confirm to proceed.',
                    requiresConfirmation: true 
                });
            }

            // Status 422 (or same semantics with wrong HTTP code / PascalCase): offer retry without postPositionId
            const cancelledSlotFallback =
                assignData.releaseAs !== ReleaseAs.TenureBased &&
                !!assignData.postPositionId?.trim() &&
                isCancelledSlotAvailablePositionsMessage(message);
            if (Number(status) === 422 || (Number(status) !== 200 && Number(status) !== 409 && cancelledSlotFallback)) {
                return rejectWithValue({
                    status: 422,
                    message: message || 'Unable to take this job from the cancelled request.',
                    requiresAvailablePostRetry: true,
                });
            }

            // Status 400 or other errors: Show error toast
            if (!assignData.suppressToast && message) dispatch(showToast(message, 'error'));
            return rejectWithValue({ 
                status, 
                message: message || 'Failed to assign job',
                requiresConfirmation: false 
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to assign job';
            if (!assignData.suppressToast) dispatch(showToast(errorMessage, 'error'));
            return rejectWithValue({ 
                status: 500, 
                message: errorMessage,
                requiresConfirmation: false 
            });
        }
    }
);

const availablePostSlice = createSlice({
    name: 'availablePost',
    initialState,
    reducers: {
        setShowWaitingPosts: (state, action: { payload: boolean }) => {
            state.showWaitingPosts = action.payload;
        },
        setSearchModel: (state, action) => {
            state.searchModel = { ...state.searchModel, ...action.payload };
        },
        clearWaitingList: (state) => {
            state.waitingListPosts = [];
            state.waitingListTotalRecords = 0;
            state.waitingListPage = 1;
            state.waitingListPageSize = DEFAULT_TABLE_PAGE_SIZE;
            state.isWaitingListLoading = false;
            state.waitingListMessage = null;
            state.waitingListSelectedPost = null;
            state.waitingListDetailsOpen = false;
            state.isWaitingListDetailsLoading = false;
            state.waitingListDetailsMessage = null;
            state.waitingListRequest = null;
            state.waitingListRequester = null;
            state.waitingListPost = null;
            state.waitingListFiles = [];
        },
        setWaitingListMessage: (state, action: { payload: string | null }) => {
            state.waitingListMessage = action.payload;
        },
        openWaitingListDetails: (state, action: { payload: EmployeePostListingItem }) => {
            state.waitingListSelectedPost = action.payload;
            state.waitingListDetailsOpen = true;
            state.waitingListDetailsMessage = null;
            state.isWaitingListDetailsLoading = true;
            state.waitingListRequest = null;
            state.waitingListRequester = null;
            state.waitingListPost = null;
            state.waitingListFiles = [];
        },
        closeWaitingListDetails: (state) => {
            state.waitingListDetailsOpen = false;
            state.waitingListSelectedPost = null;
            state.isWaitingListDetailsLoading = false;
            state.waitingListDetailsMessage = null;
            state.waitingListRequest = null;
            state.waitingListRequester = null;
            state.waitingListPost = null;
            state.waitingListFiles = [];
        },
        /** Apply filter and bump refetch trigger so list always refetches when Apply is clicked */
        applyFilter: (state, action: { payload: SearchModel }) => {
            state.searchModel = { ...state.searchModel, ...action.payload };
            state.filterAppliedAt = Date.now();
        },
        resetFilters: (state) => {
            state.searchModel = initialSearchModel;
        },
        /** Full reset when re-entering Available Job (defaults, no stale list/filters). */
        resetAvailableJobEntry: (state) => {
            state.searchModel = {
                startDate: getLocalTodayYyyyMmDd(),
                numberOfDays: 30,
                releaseAs: ReleaseAs.Open,
                requester: null,
                payCode: null,
                managedGeneralIncludesPreferred: false,
            };
            state.filterAppliedAt = Date.now();
            state.posts = [];
            state.totalRecords = 0;
            state.isLoading = true;
            state.error = null;
            state.displayError = null;
            state.showWaitingPosts = false;
            state.waitingListPosts = [];
            state.waitingListTotalRecords = 0;
            state.waitingListPage = 1;
            state.isWaitingListLoading = false;
            state.waitingListMessage = null;
            state.requesterFilterOptions = [];
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchDashboardRequesterFilterOptions.pending, (state) => {
                state.requesterFilterOptionsLoading = true;
            })
            .addCase(fetchDashboardRequesterFilterOptions.fulfilled, (state, action) => {
                state.requesterFilterOptionsLoading = false;
                state.requesterFilterOptions = action.payload ?? [];
            })
            .addCase(fetchDashboardRequesterFilterOptions.rejected, (state) => {
                state.requesterFilterOptionsLoading = false;
                state.requesterFilterOptions = [];
            })
            .addCase(fetchAvailablePosts.pending, (state) => {
                state.isLoading = true;
                state.posts = [];
                state.error = null;
                state.displayError = null;
            })
            .addCase(fetchAvailablePosts.fulfilled, (state, action) => {
                state.isLoading = false;
                state.posts = action.payload.data ?? [];
                state.totalRecords = action.payload.totalRecords ?? 0;
                state.displayError = action.payload.error ?? null;
                if (action.payload.hasOutstandingReadyToClosePost !== undefined) {
                    state.hasOutstandingReadyToClosePost = action.payload.hasOutstandingReadyToClosePost;
                }
                state.error = null;
                const p = action.payload.pagination;
                if (p) {
                    state.listPage = p.page ?? 1;
                    state.listPageSize = p.pageSize ?? DEFAULT_TABLE_PAGE_SIZE;
                }
            })
            .addCase(fetchAvailablePosts.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload as string;
            })
            .addCase(fetchWaitingListPosts.pending, (state) => {
                state.isWaitingListLoading = true;
                state.waitingListMessage = 'There are no waiting list posts available.';
            })
            .addCase(fetchWaitingListPosts.fulfilled, (state, action) => {
                state.isWaitingListLoading = false;
                if (action.payload.error) {
                    state.waitingListPosts = [];
                    state.waitingListTotalRecords = 0;
                    state.waitingListMessage = action.payload.error;
                    return;
                }
                state.waitingListPosts = action.payload.data ?? [];
                state.waitingListTotalRecords = action.payload.totalRecords ?? 0;
                state.waitingListMessage = 'There are no waiting list posts available.';
                const p = action.payload.pagination;
                if (p) {
                    state.waitingListPage = p.page ?? 1;
                    state.waitingListPageSize = p.pageSize ?? DEFAULT_TABLE_PAGE_SIZE;
                }
            })
            .addCase(fetchWaitingListPosts.rejected, (state, action) => {
                state.isWaitingListLoading = false;
                state.waitingListPosts = [];
                state.waitingListTotalRecords = 0;
                state.waitingListMessage = (action.payload as string) || 'Failed to load waiting list';
            })
            .addCase(fetchWaitingListPostDetails.pending, (state) => {
                state.isWaitingListDetailsLoading = true;
                state.waitingListDetailsMessage = 'Loading details...';
                state.waitingListRequest = null;
                state.waitingListRequester = null;
                state.waitingListPost = null;
                state.waitingListFiles = [];
            })
            .addCase(fetchWaitingListPostDetails.fulfilled, (state, action) => {
                state.isWaitingListDetailsLoading = false;
                state.waitingListDetailsMessage = null;
                state.waitingListPost = action.payload.postData ?? null;
                state.waitingListRequest = action.payload.requestData ?? null;
                state.waitingListRequester = action.payload.requesterData ?? null;
                state.waitingListFiles = action.payload.files ?? [];
            })
            .addCase(fetchWaitingListPostDetails.rejected, (state, action) => {
                state.isWaitingListDetailsLoading = false;
                state.waitingListDetailsMessage = (action.payload as string) || 'Failed to load post details';
            })
            // Assign post to me
            .addCase(assignPostToMeThunk.pending, (state, action) => {
                const postID = action.meta.arg.postID;
                state.assigningPostIds[postID] = true;
            })
            .addCase(assignPostToMeThunk.fulfilled, (state, action) => {
                const postID = action.payload.postID;
                delete state.assigningPostIds[postID];
                const post = state.posts.find((p) => p.postID === postID);
                const avail = post?.availablePositions;
                if (post != null && avail != null && avail > 0) {
                    post.availablePositions = avail - 1;
                }
            })
            .addCase(assignPostToMeThunk.rejected, (state, action) => {
                const postID = action.meta.arg.postID;
                delete state.assigningPostIds[postID];
            })
            .addCase(applySpecialEventRequestThunk.pending, (state, action) => {
                state.assigningPostIds[specialEventAssignKey(action.meta.arg.requestID, action.meta.arg.dateOfWork)] = true;
            })
            .addCase(applySpecialEventRequestThunk.fulfilled, (state, action) => {
                delete state.assigningPostIds[action.payload.assigningKey];
            })
            .addCase(applySpecialEventRequestThunk.rejected, (state, action) => {
                const req = action.meta.arg.requestID;
                const d = action.meta.arg.dateOfWork;
                delete state.assigningPostIds[specialEventAssignKey(req, d)];
            });
    },
});

export const {
    setShowWaitingPosts,
    setSearchModel,
    applyFilter,
    resetFilters,
    resetAvailableJobEntry,
    clearWaitingList,
    setWaitingListMessage,
    openWaitingListDetails,
    closeWaitingListDetails,
} = availablePostSlice.actions;
export default availablePostSlice.reducer;
