import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getRequesterRequests } from '@/services/requestService';
import { getRequestSchedulesByRequestId } from '@/services/requestScheduleService';
import { fetchRequesterWorkspaceList } from '@/services/requesterService';
import { RELEASE_SCHEDULE } from '@/constants/strings';
import type { RequesterRequestSummariesFilter } from '@/types/requester';
import type { RequesterRequestsFilter } from '@/types/request';
import type { ReleaseScheduleState } from '@/types/releaseSchedule';

const initialState: ReleaseScheduleState = {
  rows: [],
  totalRecords: 0,
  isLoading: false,
  error: null,
  requestsByRequester: {},
  schedulePages: {},
};

export const fetchRequestSchedulePage = createAsyncThunk(
  'releaseSchedule/fetchPage',
  async (
    args: {
      requestId: string;
      startDate: string;
      endDate: string;
      releaseAs?: number[];
      requestStatus?: number[];
      page: number;
      pageSize: number;
    },
    { rejectWithValue }
  ) => {
    try {
      return await getRequestSchedulesByRequestId({
        requestId: args.requestId,
        startDate: args.startDate,
        endDate: args.endDate,
        releaseAs: args.releaseAs,
        requestStatus: args.requestStatus,
        pagination: { page: args.page, pageSize: args.pageSize },
      });
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : RELEASE_SCHEDULE.LOAD_ERROR);
    }
  }
);

export const fetchReleaseSchedule = createAsyncThunk(
  'releaseSchedule/fetch',
  async (filters: RequesterRequestSummariesFilter, { rejectWithValue }) => {
    try {
      const page = await fetchRequesterWorkspaceList({
        isDailyWorkspace: true,
        loadAllPages: true,
        ...filters,
      });
      return {
        data: page.data as import('@/types/requester').RequesterRequestSummaryDto[],
        totalRecords: page.totalRecords,
      };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : RELEASE_SCHEDULE.LOAD_ERROR);
    }
  }
);

export const fetchReleaseScheduleRequests = createAsyncThunk(
  'releaseSchedule/fetchRequests',
  async (filters: RequesterRequestsFilter, { rejectWithValue }) => {
    try {
      return await getRequesterRequests(filters);
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : RELEASE_SCHEDULE.LOAD_ERROR);
    }
  }
);

const releaseScheduleSlice = createSlice({
  name: 'releaseSchedule',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchReleaseSchedule.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchReleaseSchedule.fulfilled, (state, action) => {
        state.isLoading = false;
        state.rows = action.payload.data ?? [];
        state.totalRecords = action.payload.totalRecords ?? 0;
        state.error = null;
      })
      .addCase(fetchReleaseSchedule.rejected, (state, action) => {
        state.isLoading = false;
        state.rows = [];
        state.totalRecords = 0;
        state.error = (action.payload as string) || RELEASE_SCHEDULE.LOAD_ERROR;
      })
      .addCase(fetchReleaseScheduleRequests.pending, (state, action) => {
        const requesterId = action.meta.arg.requesterId;
        const page = action.meta.arg.pageParam?.page ?? 1;
        const pageSize = action.meta.arg.pageParam?.pageSize ?? 0;
        const current = state.requestsByRequester[requesterId];
        state.requestsByRequester[requesterId] = {
          rows: current?.rows ?? [],
          totalRecords: current?.totalRecords ?? 0,
          isLoading: true,
          error: null,
          page,
          pageSize,
        };
      })
      .addCase(fetchReleaseScheduleRequests.fulfilled, (state, action) => {
        const requesterId = action.meta.arg.requesterId;
        const page = action.meta.arg.pageParam?.page ?? 1;
        const pageSize = action.meta.arg.pageParam?.pageSize ?? 0;
        const current = state.requestsByRequester[requesterId];
        if (!current || current.page !== page || current.pageSize !== pageSize) return;
        current.isLoading = false;
        const incoming = action.payload.data ?? [];
        if (page > 1 && incoming.length === 0) {
          current.totalRecords = current.rows.length;
        } else {
          current.rows = page > 1 ? [...current.rows, ...incoming] : incoming;
          current.totalRecords = action.payload.totalRecords ?? 0;
        }
        current.error = null;
        const summary = state.rows.find((row) => row.requesterId === requesterId);
        if (summary && !summary.requests?.length) summary.requestCount = current.totalRecords;
      })
      .addCase(fetchReleaseScheduleRequests.rejected, (state, action) => {
        const requesterId = action.meta.arg.requesterId;
        const page = action.meta.arg.pageParam?.page ?? 1;
        const pageSize = action.meta.arg.pageParam?.pageSize ?? 0;
        const current = state.requestsByRequester[requesterId];
        if (!current || current.page !== page || current.pageSize !== pageSize) return;
        current.isLoading = false;
        current.error = (action.payload as string) || RELEASE_SCHEDULE.LOAD_ERROR;
        if (page > 1) return;
        current.rows = [];
        current.totalRecords = 0;
      })
      .addCase(fetchRequestSchedulePage.pending, (state, action) => {
        const { requestId, page, pageSize } = action.meta.arg;
        const current = state.schedulePages[requestId];
        state.schedulePages[requestId] = {
          rows: current?.rows ?? [],
          totalRecords: current?.totalRecords ?? 0,
          isLoading: true,
          page,
          pageSize,
        };
      })
      .addCase(fetchRequestSchedulePage.fulfilled, (state, action) => {
        const { requestId, page, pageSize } = action.meta.arg;
        const current = state.schedulePages[requestId];
        if (!current || current.page !== page || current.pageSize !== pageSize) return;
        current.isLoading = false;
        current.rows = action.payload.data ?? [];
        current.totalRecords = action.payload.totalRecords ?? 0;
      })
      .addCase(fetchRequestSchedulePage.rejected, (state, action) => {
        const { requestId, page, pageSize } = action.meta.arg;
        const current = state.schedulePages[requestId];
        if (!current || current.page !== page || current.pageSize !== pageSize) return;
        current.isLoading = false;
        current.rows = [];
        current.totalRecords = 0;
      });
  },
});

export default releaseScheduleSlice.reducer;
