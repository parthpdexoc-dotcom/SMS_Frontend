import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { RequestScheduleDto } from '@/types/request';
import { showToast } from './toastSlice';
import {
  deleteRequestSchedule,
  generateRequestSchedules,
  getRequestSchedulesByRequestId,
  upsertRequestSchedule,
  type GenerateRequestScheduleRequest,
} from '@/services/requestScheduleService';

interface RequestScheduleState {
  schedules: RequestScheduleDto[];
  totalRecords: number;
  isLoading: boolean;
  error: string | null;
  /** Latest page request. Older responses are ignored so a slow page cannot replace the current one. */
  activeRequestId: string | null;
}

const initialState: RequestScheduleState = {
  schedules: [],
  totalRecords: 0,
  isLoading: false,
  error: null,
  activeRequestId: null,
};

export const fetchRequestSchedulesByRequestIdThunk = createAsyncThunk(
  'requestSchedule/fetchByRequestId',
  async (
    args: {
      requestId: string;
      /** When false, callers read the result and the stored page is left unchanged. */
      updateState?: boolean;
      startDate?: string;
      endDate?: string;
      pagination?: { page?: number; pageSize?: number; sortBy?: string; sortDirection?: string };
    },
    { rejectWithValue, dispatch }
  ) => {
    try {
      const page = await getRequestSchedulesByRequestId({
        requestId: args.requestId,
        startDate: args.startDate,
        endDate: args.endDate,
        pagination: args.pagination,
      });
      return { data: page.data, totalRecords: page.totalRecords };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to fetch request schedules';
      if (args.updateState !== false) dispatch(showToast(msg, 'error'));
      return rejectWithValue(msg);
    }
  }
);

export const upsertRequestScheduleThunk = createAsyncThunk(
  'requestSchedule/upsert',
  async (payload: RequestScheduleDto, { rejectWithValue, dispatch }) => {
    try {
      const saved = await upsertRequestSchedule(payload);
      dispatch(showToast('Request schedule saved.', 'success'));
      return saved;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to save request schedule';
      dispatch(showToast(msg, 'error'));
      return rejectWithValue(msg);
    }
  }
);

export const deleteRequestScheduleThunk = createAsyncThunk(
  'requestSchedule/delete',
  async (requestScheduleId: string, { rejectWithValue, dispatch }) => {
    try {
      await deleteRequestSchedule(requestScheduleId);
      dispatch(showToast('Request schedule deleted.', 'success'));
      return requestScheduleId;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to delete request schedule';
      dispatch(showToast(msg, 'error'));
      return rejectWithValue(msg);
    }
  }
);

export const generateRequestSchedulesThunk = createAsyncThunk(
  'requestSchedule/generate',
  async (payload: GenerateRequestScheduleRequest, { rejectWithValue, dispatch }) => {
    try {
      const saved = await generateRequestSchedules(payload);
      const createdCount = saved.generatedScheduleCount ?? 0;
      const warning = saved.generationWarning?.trim() ?? '';
      if (warning) {
        dispatch(showToast(warning, 'warning'));
      } else {
        dispatch(
          showToast(
            createdCount > 1 ? `${createdCount} request schedules generated.` : 'Request schedule generated.',
            'success'
          )
        );
      }
      return saved;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to generate request schedules';
      dispatch(showToast(msg, 'error'));
      return rejectWithValue(msg);
    }
  }
);

const requestScheduleSlice = createSlice({
  name: 'requestSchedule',
  initialState,
  reducers: {
    clearRequestScheduleState: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRequestSchedulesByRequestIdThunk.pending, (state, action) => {
        if (action.meta.arg.updateState === false) return;
        state.isLoading = true;
        state.error = null;
        state.activeRequestId = action.meta.requestId;
      })
      .addCase(fetchRequestSchedulesByRequestIdThunk.fulfilled, (state, action) => {
        if (action.meta.arg.updateState === false) return;
        if (state.activeRequestId !== action.meta.requestId) return;
        state.isLoading = false;
        state.schedules = action.payload.data;
        state.totalRecords = action.payload.totalRecords;
      })
      .addCase(fetchRequestSchedulesByRequestIdThunk.rejected, (state, action) => {
        if (action.meta.arg.updateState === false) return;
        if (state.activeRequestId !== action.meta.requestId) return;
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(upsertRequestScheduleThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(upsertRequestScheduleThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        const idx = state.schedules.findIndex(
          (s) => s.requestScheduleID && s.requestScheduleID === action.payload.requestScheduleID
        );
        if (idx >= 0) state.schedules[idx] = action.payload;
        else state.schedules.unshift(action.payload);
      })
      .addCase(upsertRequestScheduleThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(deleteRequestScheduleThunk.fulfilled, (state, action) => {
        state.schedules = state.schedules.filter((s) => s.requestScheduleID !== action.payload);
      })
      .addCase(generateRequestSchedulesThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(generateRequestSchedulesThunk.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(generateRequestSchedulesThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearRequestScheduleState } = requestScheduleSlice.actions;
export default requestScheduleSlice.reducer;

