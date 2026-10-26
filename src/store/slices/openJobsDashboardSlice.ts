import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getOpenJobsDashboard } from '@/services/openJobsDashboardService';
import type { OpenJobsDashboardFetchParams, OpenJobsDashboardGroup } from '@/types/openJobsDashboard';

interface OpenJobsDashboardState {
  groups: OpenJobsDashboardGroup[];
  totalRecords: number;
  /** Message from API when result set is empty (PagedList.Error). */
  listMessage: string | null;
  isLoading: boolean;
  error: string | null;
  lastParams: OpenJobsDashboardFetchParams | null;
}

const initialState: OpenJobsDashboardState = {
  groups: [],
  totalRecords: 0,
  listMessage: null,
  isLoading: false,
  error: null,
  lastParams: null,
};

export const fetchOpenJobsDashboard = createAsyncThunk(
  'openJobsDashboard/fetch',
  async (params: OpenJobsDashboardFetchParams, { rejectWithValue }) => {
    try {
      const result = await getOpenJobsDashboard(params);
      return { ...result, params };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load open jobs';
      return rejectWithValue(msg);
    }
  }
);

const openJobsDashboardSlice = createSlice({
  name: 'openJobsDashboard',
  initialState,
  reducers: {
    clearOpenJobsDashboard: (state) => {
      state.groups = [];
      state.totalRecords = 0;
      state.listMessage = null;
      state.error = null;
      state.lastParams = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchOpenJobsDashboard.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchOpenJobsDashboard.fulfilled, (state, action) => {
        state.isLoading = false;
        state.groups = action.payload.groups;
        state.totalRecords = action.payload.totalRecords;
        state.listMessage = action.payload.listMessage;
        state.lastParams = action.payload.params;
        state.error = null;
      })
      .addCase(fetchOpenJobsDashboard.rejected, (state, action) => {
        state.isLoading = false;
        state.groups = [];
        state.totalRecords = 0;
        state.listMessage = null;
        state.error = (action.payload as string) ?? 'Failed to load open jobs';
      });
  },
});

export const { clearOpenJobsDashboard } = openJobsDashboardSlice.actions;
export default openJobsDashboardSlice.reducer;
