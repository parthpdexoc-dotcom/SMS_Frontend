import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import {
  getJobPositionFlowById,
  getJobPositionFlows,
} from '@/services/jobPositionFlowAuditService';
import type { PageParam } from '@/types/common';
import type { JobPositionFlowStory } from '@/types/jobPositionFlowAudit';
import { showToast } from './toastSlice';
import { DASHBOARD } from '@/constants/strings';

const L = DASHBOARD.AUDIT_LOG;

export interface JobPositionFlowAuditState {
  stories: JobPositionFlowStory[];
  selectedStory: JobPositionFlowStory | null;
  isLoading: boolean;
  isLoadingDetail: boolean;
  error: string | null;
  totalItems: number;
}

const initialState: JobPositionFlowAuditState = {
  stories: [],
  selectedStory: null,
  isLoading: false,
  isLoadingDetail: false,
  error: null,
  totalItems: 0,
};

export const fetchJobPositionFlowsThunk = createAsyncThunk(
  'jobPositionFlowAudit/fetchJobPositionFlows',
  async (
    params: { pagination?: PageParam; search?: string },
    { rejectWithValue, dispatch }
  ) => {
    try {
      return await getJobPositionFlows(params.pagination, params.search);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : L.JOB_POSITION_FLOW.LOAD_FAILED;
      dispatch(showToast(message, 'error'));
      return rejectWithValue(message);
    }
  }
);

export const fetchJobPositionFlowByIdThunk = createAsyncThunk(
  'jobPositionFlowAudit/fetchJobPositionFlowById',
  async (postPositionId: string, { rejectWithValue, dispatch }) => {
    try {
      return await getJobPositionFlowById(postPositionId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : L.JOB_POSITION_FLOW.LOAD_DETAIL_FAILED;
      dispatch(showToast(message, 'error'));
      return rejectWithValue(message);
    }
  }
);

const jobPositionFlowAuditSlice = createSlice({
  name: 'jobPositionFlowAudit',
  initialState,
  reducers: {
    clearJobPositionFlowError: (state) => {
      state.error = null;
    },
    clearSelectedJobPositionFlow: (state) => {
      state.selectedStory = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchJobPositionFlowsThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchJobPositionFlowsThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.stories = action.payload.data;
        state.totalItems = action.payload.totalRecords;
        state.error = null;
      })
      .addCase(fetchJobPositionFlowsThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchJobPositionFlowByIdThunk.pending, (state) => {
        state.isLoadingDetail = true;
        state.error = null;
      })
      .addCase(fetchJobPositionFlowByIdThunk.fulfilled, (state, action) => {
        state.isLoadingDetail = false;
        state.selectedStory = action.payload;
        state.error = null;
      })
      .addCase(fetchJobPositionFlowByIdThunk.rejected, (state, action) => {
        state.isLoadingDetail = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearJobPositionFlowError, clearSelectedJobPositionFlow } =
  jobPositionFlowAuditSlice.actions;
export default jobPositionFlowAuditSlice.reducer;
