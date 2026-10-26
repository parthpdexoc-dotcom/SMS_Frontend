import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getTenureJobsDashboard } from '@/services/tenureJobsDashboardService';
import type {
  TenureJobsDashboardFetchParams,
  TenureJobsDashboardGroup,
} from '@/types/tenureJobsDashboard';

interface TenureJobsDashboardState {
  groups: TenureJobsDashboardGroup[];
  totalRecords: number;
  listMessage: string | null;
  isLoading: boolean;
  error: string | null;
  lastParams: TenureJobsDashboardFetchParams | null;
}

const initialState: TenureJobsDashboardState = {
  groups: [],
  totalRecords: 0,
  listMessage: null,
  isLoading: false,
  error: null,
  lastParams: null,
};

export const fetchTenureJobsDashboard = createAsyncThunk(
  'tenureJobsDashboard/fetch',
  async (params: TenureJobsDashboardFetchParams, { rejectWithValue }) => {
    try {
      const result = await getTenureJobsDashboard(params);
      return { ...result, params };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load tenure jobs';
      return rejectWithValue(msg);
    }
  }
);

const tenureJobsDashboardSlice = createSlice({
  name: 'tenureJobsDashboard',
  initialState,
  reducers: {
    clearTenureJobsDashboard: (state) => {
      state.groups = [];
      state.totalRecords = 0;
      state.listMessage = null;
      state.error = null;
      state.lastParams = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTenureJobsDashboard.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTenureJobsDashboard.fulfilled, (state, action) => {
        state.isLoading = false;
        state.groups = action.payload.groups;
        state.totalRecords = action.payload.totalRecords;
        state.listMessage = action.payload.listMessage;
        state.lastParams = action.payload.params;
        state.error = null;
      })
      .addCase(fetchTenureJobsDashboard.rejected, (state, action) => {
        state.isLoading = false;
        state.groups = [];
        state.totalRecords = 0;
        state.listMessage = null;
        state.error = (action.payload as string) ?? 'Failed to load tenure jobs';
      });
  },
});

export const { clearTenureJobsDashboard } = tenureJobsDashboardSlice.actions;
export default tenureJobsDashboardSlice.reducer;
