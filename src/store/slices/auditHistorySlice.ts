/**
 * Audit History Redux Slice
 */
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { AuditHistoryTable, getAuditLogForDepartmentFilter, searchAuditHistory } from '@/services/auditHistoryService';
import type { AuditHistoryRow } from '@/utils/auditHistoryUtils';
import { showToast } from './toastSlice';
import type { AuditFilter } from '@/types/common';

export interface AuditHistoryState {
  auditHistory: AuditHistoryRow[];
  isLoading: boolean;
  error: string | null;
  totalItems: number;
}

const initialState: AuditHistoryState = {
  auditHistory: [],
  isLoading: false,
  error: null,
  totalItems: 0,
};

// Async thunks
export const fetchAuditHistory = createAsyncThunk(
  'auditHistory/fetchAuditHistory',
  async (
    params: {
      table: AuditHistoryTable;
      pagination?: AuditFilter;
      filterEntityId?: string;
    },
    thunkAPI
  ) => {
    const { rejectWithValue, dispatch } = thunkAPI;
    try {
      const { data, totalRecords } = await getAuditLogForDepartmentFilter(
        params.table,
        params.pagination,
        params.filterEntityId
      );
      return { data, totalRecords };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch audit history';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const searchAuditHistoryThunk = createAsyncThunk(
  'auditHistory/searchAuditHistory',
  async (
    params: {
      table: AuditHistoryTable;
      searchTerm: string;
      pagination?: AuditFilter;
      filterEntityId?: string;
    },
    thunkAPI
  ) => {
    const { rejectWithValue, dispatch } = thunkAPI;
    try {
      const { data, totalRecords } = await searchAuditHistory(
        params.table,
        params.searchTerm,
        params.pagination,
        params.filterEntityId
      );
      return { data, totalRecords };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to search audit history';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

const auditHistorySlice = createSlice({
  name: 'auditHistory',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearAuditHistory: (state) => {
      state.auditHistory = [];
      state.totalItems = 0;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Audit History
      .addCase(fetchAuditHistory.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchAuditHistory.fulfilled, (state, action) => {
        state.isLoading = false;
        state.auditHistory = action.payload.data;
        state.totalItems = action.payload.totalRecords;
        state.error = null;
      })
      .addCase(fetchAuditHistory.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Search Audit History
      .addCase(searchAuditHistoryThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(searchAuditHistoryThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.auditHistory = action.payload.data;
        state.totalItems = action.payload.totalRecords;
        state.error = null;
      })
      .addCase(searchAuditHistoryThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError, clearAuditHistory } = auditHistorySlice.actions;
export default auditHistorySlice.reducer;
