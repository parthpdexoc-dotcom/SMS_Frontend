/**
 * Tenure Waiting Position Redux Slice
 * Holds "my tenure waiting list" for the logged-in employee (same pattern as post position by status).
 * Also holds detail modal state (selected row, request, requester, files) so the component uses only slice state and thunks.
 */
import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants/tablePagination';
import {
  buildTenureWaitingListRequestKey,
  getMyTenureWaitingPositions,
  updateTenureWaitingPositionStatus,
  getSpecialEventEmployeeIds,
} from '@/services/tenureWaitingPositionService';
import { getRequestViewDetails } from '@/services/requestViewDetailsService';
import type { EmployeePostListingItem } from '@/types/employeePostListingItem';
import type { TenureWaitingPositionFilter } from '@/types/tenureWaitingPosition';
import type { RequestResponse } from '@/types/request';
import type { RequesterResponse } from '@/types/requester';
import type { FileUploadDto } from '@/types/fileUpload';
import type { EmployeeResponse } from '@/types/employee';
import { showToast } from './toastSlice';
import { POST_POSITION } from '@/constants/strings';
import { assignTenurePositionToMe } from '@/services/availablePostService';
import { ReleaseAs } from '@/types/request';
import { PostPositionStatus } from '@/types/postPosition';
import type { RootState } from '@/store';

import type { Post } from '@/types/post';
import {
  mapEmployeeListingViewDetails,
  type EmployeeListingViewDetailsMapped,
  type ViewDetailsLatestPostNoteMapped,
} from '@/utils/mapRequestViewDetails';
import type { PostEquipmentDto } from '@/services/postEquipmentService';

export interface TenureWaitingPositionPagination {
  currentPage: number;
  pageSize: number;
  totalItems: number;
}

export type WaitingListTabKey = 'tenureBased' | 'general';

export function waitingListTabKeyFromReleaseAs(releaseAs: ReleaseAs): WaitingListTabKey {
  return releaseAs === ReleaseAs.General ? 'general' : 'tenureBased';
}

interface TenureWaitingPositionState {
  /** Separate list + paging per `releaseAs` so Tenure based and General never share total row counts. */
  byTab: Record<
    WaitingListTabKey,
    { list: EmployeePostListingItem[]; pagination: TenureWaitingPositionPagination; isViewWLHistory: boolean }
  >;
  loading: boolean;
  /** In-flight my-waiting-list request keys (same signature as {@link buildTenureWaitingListRequestKey}) for de-dupe / multi-tab loads. */
  listInFlightByKey: Record<string, true>;
  error: string | null;
  cancellingId: string | null;
  /** Detail modal */
  selectedRow: EmployeePostListingItem | null;
  detailModalOpen: boolean;
  requestData: RequestResponse | null;
  requesterData: RequesterResponse | null;
  requestFiles: FileUploadDto[];
  /** Full post from `GET /Request/view-details` when opening job details. */
  detailPostData: Post | null;
  /** From view-details; used when `postPositionStatus` is special event. */
  specialEventJobDetailsMessage: string | null;
  latestPostNoteFromDetails: ViewDetailsLatestPostNoteMapped | null;
  detailModalEquipmentRaw: PostEquipmentDto[];
  viewDetailsShowVehicle: boolean;
  viewDetailsShowEquipment: boolean;
  loadingDetails: boolean;
  specialEventEmployees: EmployeeResponse[];
  specialEventEmployeesLoading: boolean;
  specialEventEmployeesError: string | null;
}

const emptyTabState = (): {
  list: EmployeePostListingItem[];
  pagination: TenureWaitingPositionPagination;
  isViewWLHistory: boolean;
} => ({
  list: [],
  pagination: {
    currentPage: 1,
    pageSize: DEFAULT_TABLE_PAGE_SIZE,
    totalItems: 0,
  },
  isViewWLHistory: false,
});

const initialState: TenureWaitingPositionState = {
  byTab: {
    tenureBased: emptyTabState(),
    general: emptyTabState(),
  },
  loading: false,
  listInFlightByKey: {},
  error: null,
  cancellingId: null,
  selectedRow: null,
  detailModalOpen: false,
  requestData: null,
  requesterData: null,
  requestFiles: [],
  detailPostData: null,
  specialEventJobDetailsMessage: null,
  latestPostNoteFromDetails: null,
  detailModalEquipmentRaw: [],
  viewDetailsShowVehicle: false,
  viewDetailsShowEquipment: false,
  loadingDetails: false,
  specialEventEmployees: [],
  specialEventEmployeesLoading: false,
  specialEventEmployeesError: null,
};

export const fetchMyTenureWaitingPositions = createAsyncThunk(
  'tenureWaitingPosition/fetchMyList',
  async (filters: TenureWaitingPositionFilter | undefined, { rejectWithValue, dispatch }) => {
    try {
      const result = await getMyTenureWaitingPositions(filters);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch tenure waiting list';
      dispatch(showToast(message, 'error'));
      return rejectWithValue(message);
    }
  },
  {
    condition: (filters, { getState }) => {
      const key = buildTenureWaitingListRequestKey(filters);
      const s = (getState() as RootState).tenureWaitingPosition;
      if (s.listInFlightByKey[key]) return false;
      return true;
    },
  }
);

export const cancelTenureWaitingPositionThunk = createAsyncThunk(
  'tenureWaitingPosition/cancel',
  async (
    args: {
      waitingPostPositionId: string;
      pagination: TenureWaitingPositionPagination;
      listReleaseAs: ReleaseAs;
      isViewWLHistory?: boolean;
    },
    { rejectWithValue, dispatch }
  ) => {
    try {
      await updateTenureWaitingPositionStatus(
        args.waitingPostPositionId,
        PostPositionStatus.Cancelled
      );
      dispatch(showToast('Waiting job position cancelled', 'success'));
      const refetchFilters = {
        releaseAs: args.listReleaseAs,
        page: args.pagination.currentPage,
        pageSize: args.pagination.pageSize,
        sortBy: 'dateOfWork' as const,
        sortDirection: 'asc' as const,
        isViewWLHistory: args.isViewWLHistory ?? false,
      };
      dispatch(clearWaitingListInFlightKey(refetchFilters));
      dispatch(fetchMyTenureWaitingPositions(refetchFilters));
      return args.waitingPostPositionId;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to cancel';
      dispatch(showToast(message, 'error'));
      return rejectWithValue(message);
    }
  }
);

/**
 * Upsert (assign) a waiting post position to the current user.
 * Used from Available Post "waiting list" take shift flow.
 */
export const upsertWaitingPostPositionThunk = createAsyncThunk(
  'tenureWaitingPosition/upsertWaitingPostPosition',
  async (
    args: { postID: string; dateOfWork: string; releaseAs: ReleaseAs; confirmConflict?: boolean; suppressToast?: boolean },
    { rejectWithValue, dispatch }
  ) => {
    try {
      const result = await assignTenurePositionToMe({
        postID: args.postID,
        dateOfWork: args.dateOfWork,
        releaseAs: args.releaseAs,
        confirmConflict: args.confirmConflict,
      });

      const nStatus = Number(result.status);
      const requiresTimeConflictConfirm = result.hasTimeConflictRequiringConfirmation === true;
      if (nStatus === 200) {
        if (!args.suppressToast && result.message) dispatch(showToast(result.message, 'success'));
        return { postID: args.postID, message: result.message };
      }

      if (nStatus === 409 && requiresTimeConflictConfirm) {
        return rejectWithValue({
          status: 409,
          message: result.message || 'Time conflict detected. Please confirm to proceed.',
          requiresConfirmation: true,
        });
      }

      if (!args.suppressToast && result.message) dispatch(showToast(result.message, 'error'));
      return rejectWithValue({
        status: result.status,
        message: result.message || 'Failed to assign waiting job position',
        requiresConfirmation: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to assign waiting job position';
      if (!args.suppressToast) dispatch(showToast(message, 'error'));
      return rejectWithValue({ status: 500, message, requiresConfirmation: false });
    }
  }
);

export const fetchSpecialEventEmployeesThunk = createAsyncThunk(
  'tenureWaitingPosition/fetchSpecialEventEmployees',
  async (
    args: { requestId: string; dateOfWork: string },
    { rejectWithValue, dispatch }
  ) => {
    try {
      return await getSpecialEventEmployeeIds(args.requestId, args.dateOfWork);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch special event employees';
      dispatch(showToast(message, 'error'));
      return rejectWithValue(message);
    }
  }
);

/** Remove a file from the tenure detail modal (no service in component); reducer removes from state. */
export const removeTenureDetailFileThunk = createAsyncThunk(
  'tenureWaitingPosition/removeDetailFile',
  async (args: { requesterID: string; requestID: string; fileUploadedId: string }, { rejectWithValue, dispatch }) => {
    const { deleteRequestFile } = await import('@/services/fileUploadService');
    try {
      await deleteRequestFile(args.requesterID, args.requestID, args.fileUploadedId);
      return args.fileUploadedId;
    } catch {
      dispatch(showToast('Failed to delete file', 'error'));
      return rejectWithValue('Failed to delete file');
    }
  }
);

const tenureWaitingPositionSlice = createSlice({
  name: 'tenureWaitingPosition',
  initialState,
  reducers: {
    setPagination: (
      state,
      action: {
        payload: {
          releaseAs: ReleaseAs;
          currentPage?: number;
          pageSize?: number;
          totalItems?: number;
        };
      }
    ) => {
      const { releaseAs, currentPage, pageSize, totalItems } = action.payload;
      const tabKey = waitingListTabKeyFromReleaseAs(releaseAs);
      const p = state.byTab[tabKey].pagination;
      if (currentPage !== undefined) p.currentPage = currentPage;
      if (pageSize !== undefined) p.pageSize = pageSize;
      if (totalItems !== undefined) p.totalItems = totalItems;
    },
    setViewWLHistory: (
      state,
      action: PayloadAction<{ releaseAs: ReleaseAs; isViewWLHistory: boolean }>
    ) => {
      const tabKey = waitingListTabKeyFromReleaseAs(action.payload.releaseAs);
      state.byTab[tabKey].isViewWLHistory = action.payload.isViewWLHistory;
      state.byTab[tabKey].pagination.currentPage = 1;
    },
    openDetailModal: (state, action) => {
      state.selectedRow = action.payload;
      state.detailModalOpen = true;
      state.loadingDetails = true;
      state.requestData = null;
      state.requesterData = null;
      state.requestFiles = [];
      state.detailPostData = null;
      state.specialEventJobDetailsMessage = null;
      state.latestPostNoteFromDetails = null;
      state.detailModalEquipmentRaw = [];
      state.viewDetailsShowVehicle = false;
      state.viewDetailsShowEquipment = false;
    },
    /** Fulfilled `GET /Request/view-details` payload (same as Available Post + waiting list details). */
    setTenureModalViewDetails: (state, action: PayloadAction<EmployeeListingViewDetailsMapped>) => {
      const m = action.payload;
      state.requestData = m.requestData;
      state.requesterData = m.requesterData;
      state.requestFiles = m.files;
      state.detailPostData = m.postData;
      state.specialEventJobDetailsMessage = m.specialEventJobDetailsMessage;
      state.latestPostNoteFromDetails = m.latestPostNote;
      state.detailModalEquipmentRaw = m.detailModalEquipmentRaw;
      state.viewDetailsShowVehicle = m.viewDetailsShowVehicle;
      state.viewDetailsShowEquipment = m.viewDetailsShowEquipment;
      if (state.selectedRow) {
        const next = { ...state.selectedRow };
        if (m.viewDetailsAvailablePositions != null) {
          next.availablePositions = m.viewDetailsAvailablePositions;
        }
        if (m.viewDetailsTotalPostPositions != null) {
          next.totalPositions = m.viewDetailsTotalPostPositions;
        } else {
          const totalFromPost = m.postData?.totalPostPositions;
          if (typeof totalFromPost === 'number' && !Number.isNaN(totalFromPost) && totalFromPost >= 0) {
            next.totalPositions = totalFromPost;
          }
        }
        state.selectedRow = next;
      }
      state.loadingDetails = false;
    },
    setDetailPostData: (state, action: PayloadAction<Post | null>) => {
      state.detailPostData = action.payload;
    },
    setDetailRequestData: (state, action) => {
      state.requestData = action.payload;
    },
    setDetailRequesterData: (state, action) => {
      state.requesterData = action.payload;
    },
    setDetailRequestFiles: (state, action) => {
      state.requestFiles = action.payload;
    },
    setDetailLoading: (state, action) => {
      state.loadingDetails = action.payload;
    },
    closeTenureDetailModal: (state) => {
      state.detailModalOpen = false;
      state.selectedRow = null;
      state.requestData = null;
      state.requesterData = null;
      state.requestFiles = [];
      state.detailPostData = null;
      state.specialEventJobDetailsMessage = null;
      state.latestPostNoteFromDetails = null;
      state.detailModalEquipmentRaw = [];
      state.viewDetailsShowVehicle = false;
      state.viewDetailsShowEquipment = false;
      state.loadingDetails = false;
    },
    clearSpecialEventEmployees: (state) => {
      state.specialEventEmployees = [];
      state.specialEventEmployeesError = null;
      state.specialEventEmployeesLoading = false;
    },
    removeDetailFileFromList: (state, action) => {
      state.requestFiles = state.requestFiles.filter((f) => f.fileUploadedId !== action.payload);
    },
    /** Clears de-dupe state so a forced refetch (e.g. after cancel) is not skipped while the same query is still in flight. */
    clearWaitingListInFlightKey: (state, action: PayloadAction<TenureWaitingPositionFilter | undefined>) => {
      const key = buildTenureWaitingListRequestKey(action.payload);
      delete state.listInFlightByKey[key];
      state.loading = Object.keys(state.listInFlightByKey).length > 0;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMyTenureWaitingPositions.pending, (state, action) => {
        const key = buildTenureWaitingListRequestKey(action.meta.arg);
        state.listInFlightByKey[key] = true;
        state.loading = Object.keys(state.listInFlightByKey).length > 0;
        state.error = null;
      })
      .addCase(fetchMyTenureWaitingPositions.fulfilled, (state, action) => {
        const key = buildTenureWaitingListRequestKey(action.meta.arg);
        delete state.listInFlightByKey[key];
        state.loading = Object.keys(state.listInFlightByKey).length > 0;
        state.error = null;
        const releaseAs = action.meta.arg?.releaseAs ?? ReleaseAs.TenureBased;
        const tabKey = waitingListTabKeyFromReleaseAs(releaseAs);
        const list = action.payload.data ?? [];
        state.byTab[tabKey].list = list;
        state.byTab[tabKey].pagination.totalItems =
          action.payload.totalRecords ?? list.length;
      })
      .addCase(fetchMyTenureWaitingPositions.rejected, (state, action) => {
        const key = buildTenureWaitingListRequestKey(action.meta.arg);
        delete state.listInFlightByKey[key];
        state.loading = Object.keys(state.listInFlightByKey).length > 0;
        state.error = (action.payload as string) ?? action.error.message ?? 'Failed to load';
      })
      .addCase(cancelTenureWaitingPositionThunk.pending, (state, action) => {
        state.cancellingId = action.meta.arg.waitingPostPositionId;
      })
      .addCase(cancelTenureWaitingPositionThunk.fulfilled, (state) => {
        state.cancellingId = null;
      })
      .addCase(cancelTenureWaitingPositionThunk.rejected, (state) => {
        state.cancellingId = null;
      })
      .addCase(fetchSpecialEventEmployeesThunk.pending, (state) => {
        state.specialEventEmployeesLoading = true;
        state.specialEventEmployeesError = null;
        state.specialEventEmployees = [];
      })
      .addCase(fetchSpecialEventEmployeesThunk.fulfilled, (state, action) => {
        state.specialEventEmployeesLoading = false;
        state.specialEventEmployees = action.payload ?? [];
      })
      .addCase(fetchSpecialEventEmployeesThunk.rejected, (state, action) => {
        state.specialEventEmployeesLoading = false;
        state.specialEventEmployees = [];
        state.specialEventEmployeesError = (action.payload as string) ?? 'Failed to fetch special event employees';
      })
      .addCase(removeTenureDetailFileThunk.fulfilled, (state, action) => {
        if (action.payload) {
          state.requestFiles = state.requestFiles.filter((f) => f.fileUploadedId !== action.payload);
        }
      });
  },
});

export const {
  setPagination,
  setViewWLHistory,
  openDetailModal,
  setTenureModalViewDetails,
  setDetailRequestData,
  setDetailRequesterData,
  setDetailRequestFiles,
  setDetailPostData,
  setDetailLoading,
  closeTenureDetailModal,
  removeDetailFileFromList,
  clearSpecialEventEmployees,
  clearWaitingListInFlightKey,
} = tenureWaitingPositionSlice.actions;

function resolveRequestIdFromWaitingRow(row: EmployeePostListingItem): string | undefined {
  const raw = row as unknown as Record<string, unknown>;
  const candidates = [
    row.requestID,
    raw.requestId,
    raw.RequestId,
    raw.requestID,
    raw.RequestID,
  ];
  for (const c of candidates) {
    if (typeof c === 'string') {
      const t = c.trim();
      if (t) return t;
    }
  }
  return undefined;
}

function resolveIsSpecialEventForViewDetails(row: EmployeePostListingItem): boolean {
  if (row.isSpecialEvent === true) return true;
  if (row.isSpecialEvent === false) return false;
  if (row.postPositionStatus === PostPositionStatus.SpecialEvent) return true;
  return false;
}

/** Same as `loadAvailablePostDetails` in `availablePostSlice` — one `GET /Request/view-details` for modal. */
async function loadTenureWaitingListViewDetails(
  post: EmployeePostListingItem
): Promise<EmployeeListingViewDetailsMapped> {
  const postPositionId = post.postPositionId?.trim() || undefined;
  const postId = post.postID?.trim() || undefined;
  const requestId = resolveRequestIdFromWaitingRow(post);
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
    isSpecialEvent: resolveIsSpecialEventForViewDetails(post),
  });
  return mapEmployeeListingViewDetails(post, dto);
}

/** Opens detail modal and loads requester + request + post + files from `GET /Request/view-details`. */
export const fetchTenureDetailForModal = createAsyncThunk(
  'tenureWaitingPosition/fetchDetailForModal',
  async (row: EmployeePostListingItem, { dispatch, getState }) => {
    dispatch(openDetailModal(row));
    try {
      const mapped = await loadTenureWaitingListViewDetails(row);
      const { selectedRow } = (getState() as RootState).tenureWaitingPosition;
      if (selectedRow == null) return;
      if (selectedRow.postID !== row.postID || String(selectedRow.startDate ?? '') !== String(row.startDate ?? '')) {
        return;
      }
      const rowPp = row.postPositionId?.trim();
      if (rowPp && selectedRow.postPositionId?.trim() && selectedRow.postPositionId !== rowPp) {
        return;
      }
      dispatch(setTenureModalViewDetails(mapped));
    } catch {
      dispatch(showToast(POST_POSITION.BY_STATUS_LIST.LOAD_DETAILS_ERROR, 'error'));
      dispatch(setDetailLoading(false));
    }
  }
);

/** Download a file from the tenure detail modal (no service in component). */
export const downloadTenureDetailFileThunk = createAsyncThunk(
  'tenureWaitingPosition/downloadDetailFile',
  async (
    args: { requesterID: string; requestID: string; fileUploadedId: string; fileName: string },
    { rejectWithValue, dispatch }
  ) => {
    const { downloadRequestFile } = await import('@/services/fileUploadService');
    try {
      await downloadRequestFile(args.requesterID, args.requestID, args.fileUploadedId, args.fileName);
    } catch {
      dispatch(showToast('Failed to download file', 'error'));
      return rejectWithValue('Failed to download file');
    }
  }
);

export default tenureWaitingPositionSlice.reducer;
