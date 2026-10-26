import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { getOfficerScheduleOverview } from '@/services/officerScheduleOverviewService';
import type { OfficerScheduledAssignmentDto } from '@/types/officerScheduledAssignmentDto';
import type { PageParam } from '@/types/common';
import { showToast } from './toastSlice';

export interface OfficerScheduleOverviewState {
  rows: OfficerScheduledAssignmentDto[];
  totalRecords: number;
  isLoading: boolean;
  error: string | null;
  lastSearchTerm: string;
  lastPagination: PageParam | null;
}

const initialState: OfficerScheduleOverviewState = {
  rows: [],
  totalRecords: 0,
  isLoading: false,
  error: null,
  lastSearchTerm: '',
  lastPagination: null,
};

export const fetchOfficerScheduleOverview = createAsyncThunk(
  'officerScheduleOverview/fetch',
  async (
    params: { searchTerm?: string; pagination?: PageParam } | undefined,
    { rejectWithValue, dispatch }
  ) => {
    try {
      const result = await getOfficerScheduleOverview(params);
      return {
        ...result,
        searchTerm: params?.searchTerm?.trim() ?? '',
        pagination: params?.pagination ?? null,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to load officer schedule overview';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

const officerScheduleOverviewSlice = createSlice({
  name: 'officerScheduleOverview',
  initialState,
  reducers: {
    clearOfficerScheduleOverview: (state) => {
      state.rows = [];
      state.totalRecords = 0;
      state.isLoading = false;
      state.error = null;
      state.lastSearchTerm = '';
      state.lastPagination = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchOfficerScheduleOverview.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchOfficerScheduleOverview.fulfilled, (state, action) => {
        state.isLoading = false;
        state.rows = action.payload.data;
        state.totalRecords = action.payload.totalRecords;
        state.error = null;
        state.lastSearchTerm = action.payload.searchTerm;
        state.lastPagination = action.payload.pagination;
      })
      .addCase(fetchOfficerScheduleOverview.rejected, (state, action) => {
        state.isLoading = false;
        state.rows = [];
        state.totalRecords = 0;
        state.error = (action.payload as string) ?? 'Failed to load officer schedule overview';
      });
  },
});

export const { clearOfficerScheduleOverview } = officerScheduleOverviewSlice.actions;
export default officerScheduleOverviewSlice.reducer;
