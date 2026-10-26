/**
 * Requester Employee Redux Slice
 * Supports full list and per-manager list for accordion in RequesterManagerList.
 */
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants/tablePagination';
import {
  getRequesterEmployeeList,
  createRequesterEmployee,
  updateRequesterEmployee,
  deleteRequesterEmployee,
  type GetRequesterEmployeeListParams,
} from '@/services/requesterEmployeeService';
import type {
  RequesterEmployee,
  CreateRequesterEmployeeRequest,
  UpdateRequesterEmployeeRequest,
} from '@/types/requesterEmployee';

interface RequesterEmployeeState {
  list: RequesterEmployee[];
  /** Employees grouped by requesterManagerID for accordion */
  byManagerID: Record<string, RequesterEmployee[]>;
  isLoading: boolean;
  loadingManagerID: string | null;
  error: string | null;
  /** Accordion employee list pagination (same pattern as requesterSlice) */
  currentPage: number;
  pageSize: number;
}

const initialState: RequesterEmployeeState = {
  list: [],
  byManagerID: {},
  isLoading: false,
  loadingManagerID: null,
  error: null,
  currentPage: 1,
  pageSize: DEFAULT_TABLE_PAGE_SIZE,
};

export const fetchRequesterEmployeeList = createAsyncThunk(
  'requesterEmployee/fetchList',
  async (params: GetRequesterEmployeeListParams | undefined, { rejectWithValue }) => {
    try {
      const data = await getRequesterEmployeeList(params);
      return { data, requesterManagerID: params?.requesterManagerID };
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to fetch requester employee list'
      );
    }
  }
);

export const fetchRequesterEmployeesByManager = createAsyncThunk(
  'requesterEmployee/fetchByManager',
  async (requesterManagerID: string, { rejectWithValue }) => {
    try {
      const data = await getRequesterEmployeeList({ requesterManagerID, pageSize: 1000 });
      return { requesterManagerID, data };
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to fetch requester employees'
      );
    }
  }
);

export const createRequesterEmployeeThunk = createAsyncThunk(
  'requesterEmployee/create',
  async (payload: CreateRequesterEmployeeRequest, { rejectWithValue }) => {
    try {
      return await createRequesterEmployee(payload);
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to create requester employee'
      );
    }
  }
);

export const updateRequesterEmployeeThunk = createAsyncThunk(
  'requesterEmployee/update',
  async (payload: UpdateRequesterEmployeeRequest, { rejectWithValue }) => {
    try {
      return await updateRequesterEmployee(payload);
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to update requester employee'
      );
    }
  }
);

export const removeRequesterEmployee = createAsyncThunk(
  'requesterEmployee/remove',
  async (requesterEmployeeID: string, { rejectWithValue }) => {
    try {
      await deleteRequesterEmployee(requesterEmployeeID);
      return requesterEmployeeID;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to delete requester employee'
      );
    }
  }
);

const slice = createSlice({
  name: 'requesterEmployee',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setError: (state, action: { payload: string | null }) => {
      state.error = action.payload;
    },
    clearEmployeesForManager: (state, action: { payload: string }) => {
      delete state.byManagerID[action.payload];
    },
    setPagination: (state, action: { payload: { page?: number; pageSize?: number } }) => {
      if (action.payload.page !== undefined) state.currentPage = action.payload.page;
      if (action.payload.pageSize !== undefined) {
        state.pageSize = action.payload.pageSize;
        state.currentPage = 1;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRequesterEmployeeList.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchRequesterEmployeeList.fulfilled, (state, action) => {
        state.isLoading = false;
        state.list = action.payload.data;
        if (action.payload.requesterManagerID) {
          state.byManagerID[action.payload.requesterManagerID] = action.payload.data;
        }
        state.error = null;
      })
      .addCase(fetchRequesterEmployeeList.rejected, (state, action) => {
        state.isLoading = false;
        state.error = (action.payload as string) ?? null;
      })
      .addCase(fetchRequesterEmployeesByManager.pending, (state, action) => {
        state.loadingManagerID = action.meta.arg;
        state.error = null;
      })
      .addCase(fetchRequesterEmployeesByManager.fulfilled, (state, action) => {
        state.loadingManagerID = null;
        state.byManagerID[action.payload.requesterManagerID] = action.payload.data;
        state.error = null;
      })
      .addCase(fetchRequesterEmployeesByManager.rejected, (state, action) => {
        state.loadingManagerID = null;
        state.error = (action.payload as string) ?? null;
      })
      .addCase(createRequesterEmployeeThunk.fulfilled, (state, action) => {
        state.list.push(action.payload);
        const mid = action.payload.requesterManagerID;
        if (mid && state.byManagerID[mid]) {
          state.byManagerID[mid].push(action.payload);
        }
        state.error = null;
      })
      .addCase(createRequesterEmployeeThunk.rejected, (state, action) => {
        state.error = (action.payload as string) ?? action.error?.message ?? 'Failed to create requester employee';
      })
      .addCase(updateRequesterEmployeeThunk.fulfilled, (state, action) => {
        const idx = state.list.findIndex(
          (r) => r.requesterEmployeeID === action.payload.requesterEmployeeID
        );
        if (idx >= 0) state.list[idx] = action.payload;
        else state.list.push(action.payload);
        const mid = action.payload.requesterManagerID;
        if (mid && state.byManagerID[mid]) {
          const byIdx = state.byManagerID[mid].findIndex(
            (r) => r.requesterEmployeeID === action.payload.requesterEmployeeID
          );
          if (byIdx >= 0) state.byManagerID[mid][byIdx] = action.payload;
          else state.byManagerID[mid].push(action.payload);
        }
        state.error = null;
      })
      .addCase(updateRequesterEmployeeThunk.rejected, (state, action) => {
        state.error = (action.payload as string) ?? action.error?.message ?? 'Failed to update requester employee';
      })
      .addCase(removeRequesterEmployee.fulfilled, (state, action) => {
        const removed = state.list.find((r) => r.requesterEmployeeID === action.payload);
        state.list = state.list.filter((r) => r.requesterEmployeeID !== action.payload);
        if (removed?.requesterManagerID && state.byManagerID[removed.requesterManagerID]) {
          state.byManagerID[removed.requesterManagerID] = state.byManagerID[removed.requesterManagerID].filter(
            (r) => r.requesterEmployeeID !== action.payload
          );
        }
        state.error = null;
      })
      .addCase(removeRequesterEmployee.rejected, (state, action) => {
        state.error = (action.payload as string) ?? null;
      });
  },
});

export const { clearError, setError, clearEmployeesForManager, setPagination } = slice.actions;
export default slice.reducer;
