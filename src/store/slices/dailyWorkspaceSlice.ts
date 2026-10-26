import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { fetchRequesterWorkspaceList } from '@/services/requesterService';
import {
  DEFAULT_DAILY_WORKSPACE_REQUEST_TYPES,
  DEFAULT_REQUESTER_WITH_REQUESTS_STATUSES,
} from '@/constants/dailyWorkspaceFilters';
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants/tablePagination';
import type { RequesterRequestSummary } from '@/types/requester';
import type { RequestStatus, RequestTypes } from '@/types/request';

export type DailyWorkspaceListFilters = {
  requesterName?: string | null;
  requestStatuses?: ReadonlyArray<RequestStatus>;
  requestTypes?: ReadonlyArray<RequestTypes>;
  startDate?: string | null;
  endDate?: string | null;
  isShiftStartingWithin30Minutes?: boolean;
};

interface DailyWorkspaceState {
  requesters: RequesterRequestSummary[];
  totalRecords: number;
  currentPage: number;
  hasMore: boolean;
  listFilterKey: string;
  /** Filter key for the in-flight page-1 request (dedupes Strict Mode / double effects). */
  pendingListFilterKey: string | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
}

const initialState: DailyWorkspaceState = {
  requesters: [],
  totalRecords: 0,
  currentPage: 0,
  hasMore: false,
  listFilterKey: '',
  pendingListFilterKey: null,
  isLoading: false,
  isLoadingMore: false,
  error: null,
};

function shouldSkipInitialWorkspaceListFetch(
  state: DailyWorkspaceState,
  filterKey: string
): boolean {
  if (state.isLoading && state.pendingListFilterKey === filterKey) {
    return true;
  }
  if (
    !state.isLoading &&
    !state.isLoadingMore &&
    state.listFilterKey === filterKey &&
    state.currentPage >= 1
  ) {
    return true;
  }
  return false;
}

export const DAILY_WORKSPACE_REQUESTER_PAGE_SIZE = DEFAULT_TABLE_PAGE_SIZE;

/** Same rule as Daily Administration (`RequesterList.tsx`). */
export function computeDailyWorkspaceHasMore(
  currentPage: number,
  totalRecords: number,
  loadedCount: number
): boolean {
  if (totalRecords <= 0) return false;
  if (loadedCount < totalRecords) return true;
  return currentPage * DAILY_WORKSPACE_REQUESTER_PAGE_SIZE < totalRecords;
}

function buildSummariesFilter(
  filters: DailyWorkspaceListFilters | undefined
): Parameters<typeof fetchRequesterWorkspaceList>[0] {
  const requestStatuses =
    filters?.requestStatuses !== undefined
      ? filters.requestStatuses
      : DEFAULT_REQUESTER_WITH_REQUESTS_STATUSES;
  const requestTypes =
    filters?.requestTypes !== undefined
      ? filters.requestTypes
      : DEFAULT_DAILY_WORKSPACE_REQUEST_TYPES;
  return {
    isDailyWorkspace: true,
    ...(filters?.startDate ? { startDate: filters.startDate } : {}),
    ...(filters?.endDate ? { endDate: filters.endDate } : {}),
    ...(filters?.requesterName?.trim() ? { requesterName: filters.requesterName.trim() } : {}),
    ...(requestStatuses.length > 0
      ? { requestStatuses: requestStatuses.map((status) => Number(status)) }
      : {}),
    ...(requestTypes.length > 0
      ? { requestTypes: requestTypes.map((type) => Number(type)) }
      : {}),
    ...(filters?.isShiftStartingWithin30Minutes
      ? { isShiftStartingWithin30Minutes: true }
      : {}),
  };
}

export function dailyWorkspaceListFilterKey(filters: DailyWorkspaceListFilters | undefined): string {
  return JSON.stringify(buildSummariesFilter(filters));
}

function workspaceListPageParam(page: number) {
  return {
    page,
    pageSize: DAILY_WORKSPACE_REQUESTER_PAGE_SIZE,
    sortBy: 'requesterName',
    sortDirection: 'asc' as const,
  };
}

function mergeRequesterSummaries(
  existing: RequesterRequestSummary[],
  incoming: RequesterRequestSummary[]
): RequesterRequestSummary[] {
  if (incoming.length === 0) return existing;
  const seen = new Set(existing.map((row) => row.requesterId));
  const merged = [...existing];
  incoming.forEach((row) => {
    const id = row.requesterId?.trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    merged.push(row);
  });
  return merged;
}

export const fetchDailyWorkspaceRequesters = createAsyncThunk(
  'dailyWorkspace/fetchRequesters',
  async (filters: DailyWorkspaceListFilters | undefined, { rejectWithValue }) => {
    try {
      const filterKey = dailyWorkspaceListFilterKey(filters);
      const page = await fetchRequesterWorkspaceList({
        ...buildSummariesFilter(filters),
        pageParam: workspaceListPageParam(1),
      });
      return {
        filterKey,
        data: page.data as RequesterRequestSummary[],
        totalRecords: page.totalRecords,
        page: 1,
      };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch requesters');
    }
  },
  {
    condition: (filters, { getState }) => {
      const state = (getState() as { dailyWorkspace: DailyWorkspaceState }).dailyWorkspace;
      const filterKey = dailyWorkspaceListFilterKey(filters);
      return !shouldSkipInitialWorkspaceListFetch(state, filterKey);
    },
  }
);

export const fetchMoreDailyWorkspaceRequesters = createAsyncThunk(
  'dailyWorkspace/fetchMoreRequesters',
  async (filters: DailyWorkspaceListFilters | undefined, { getState, rejectWithValue }) => {
    const state = (getState() as { dailyWorkspace: DailyWorkspaceState }).dailyWorkspace;
    const filterKey = dailyWorkspaceListFilterKey(filters);
    if (filterKey !== state.listFilterKey) {
      return rejectWithValue('Stale filters');
    }
    if (!computeDailyWorkspaceHasMore(state.currentPage, state.totalRecords, state.requesters.length)) {
      return rejectWithValue('Nothing to load');
    }

    const nextPage = state.currentPage + 1;
    try {
      const page = await fetchRequesterWorkspaceList({
        ...buildSummariesFilter(filters),
        pageParam: workspaceListPageParam(nextPage),
      });
      return {
        filterKey,
        data: page.data as RequesterRequestSummary[],
        totalRecords: page.totalRecords,
        page: nextPage,
      };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch requesters');
    }
  },
  {
    condition: (_, { getState }) => {
      const state = (getState() as { dailyWorkspace: DailyWorkspaceState }).dailyWorkspace;
      if (state.isLoading || state.isLoadingMore || state.currentPage < 1) return false;
      return computeDailyWorkspaceHasMore(
        state.currentPage,
        state.totalRecords,
        state.requesters.length
      );
    },
  }
);

const dailyWorkspaceSlice = createSlice({
  name: 'dailyWorkspace',
  initialState,
  reducers: {
    clearDailyWorkspaceError: (state) => {
      state.error = null;
    },
    resetDailyWorkspaceList: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDailyWorkspaceRequesters.pending, (state, action) => {
        state.isLoading = true;
        state.isLoadingMore = false;
        state.hasMore = false;
        state.pendingListFilterKey = dailyWorkspaceListFilterKey(action.meta.arg);
        state.error = null;
      })
      .addCase(fetchDailyWorkspaceRequesters.fulfilled, (state, action) => {
        state.isLoading = false;
        state.pendingListFilterKey = null;
        state.requesters = action.payload.data;
        state.totalRecords = action.payload.totalRecords;
        state.currentPage = action.payload.page;
        state.listFilterKey = action.payload.filterKey;
        state.hasMore = computeDailyWorkspaceHasMore(
          action.payload.page,
          action.payload.totalRecords,
          action.payload.data.length
        );
        state.error = null;
      })
      .addCase(fetchDailyWorkspaceRequesters.rejected, (state, action) => {
        state.isLoading = false;
        state.pendingListFilterKey = null;
        state.error = (action.payload as string) || 'Failed to fetch requesters';
      })
      .addCase(fetchMoreDailyWorkspaceRequesters.pending, (state) => {
        state.isLoadingMore = true;
        state.error = null;
      })
      .addCase(fetchMoreDailyWorkspaceRequesters.fulfilled, (state, action) => {
        state.isLoadingMore = false;
        if (action.payload.filterKey !== state.listFilterKey) return;
        if (action.payload.data.length === 0) {
          state.hasMore = false;
          return;
        }
        state.requesters = mergeRequesterSummaries(state.requesters, action.payload.data);
        state.totalRecords = action.payload.totalRecords;
        state.currentPage = action.payload.page;
        state.hasMore = computeDailyWorkspaceHasMore(
          action.payload.page,
          action.payload.totalRecords,
          state.requesters.length
        );
      })
      .addCase(fetchMoreDailyWorkspaceRequesters.rejected, (state, action) => {
        state.isLoadingMore = false;
        const message = action.payload as string;
        if (message === 'Nothing to load' || message === 'Stale filters') return;
        state.error = message || 'Failed to fetch requesters';
      });
  },
});

export const { clearDailyWorkspaceError, resetDailyWorkspaceList } = dailyWorkspaceSlice.actions;
export default dailyWorkspaceSlice.reducer;
