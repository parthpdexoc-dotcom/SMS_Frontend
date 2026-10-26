/**
 * Requester Manager Redux Slice
 */
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants/tablePagination';
import {
  getRequesterManagerList,
  getRequesterManagerByRequesterAndEmployee,
  getRequesterManagerOptions,
  createRequesterManager,
  updateRequesterManager,
  deleteRequesterManager,
} from '@/services/requesterManagerService';
import type { RequesterManagerOptionsParams } from '@/services/requesterManagerService';
import type {
  RequesterManager,
  CreateRequesterManagerRequest,
  UpdateRequesterManagerRequest,
  RequesterManagerPaginationParams
} from '@/types/requesterManager';
import type { SelectOptionDto } from '@/types/common';
import { showToast } from './toastSlice';

interface RequesterManagerState {
  list: RequesterManager[];
  requesterManagerOptions: SelectOptionDto[];
  isLoading: boolean;
  isLoadingOptions: boolean;
  error: string | null;
  totalItems: number;
  currentPage: number;
  pageSize: number;
}

const initialState: RequesterManagerState = {
  list: [],
  requesterManagerOptions: [],
  isLoading: false,
  isLoadingOptions: false,
  error: null,
  totalItems: 0,
  currentPage: 1,
  pageSize: DEFAULT_TABLE_PAGE_SIZE,
};

export const fetchRequesterManagerList = createAsyncThunk(
  'requesterManager/fetchList',
  async (pagination: RequesterManagerPaginationParams | undefined, { rejectWithValue, dispatch }) => {
    try {
      const data = await getRequesterManagerList(pagination);
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch requester manager list';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchRequesterManagerOptions = createAsyncThunk<
  SelectOptionDto[],
  RequesterManagerOptionsParams | undefined
>(
  'requesterManager/fetchOptions',
  async (params, { rejectWithValue, dispatch }) => {
    try {
      return await getRequesterManagerOptions(params);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to fetch requester manager options';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const createRequesterManagerThunk = createAsyncThunk(
  'requesterManager/create',
  async (payload: CreateRequesterManagerRequest, { rejectWithValue, dispatch }) => {
    try {
      const data = await createRequesterManager(payload);
      dispatch(showToast('Requester manager created successfully.', 'success'));
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create requester manager';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchRequesterManagerByRequesterAndEmployeeThunk = createAsyncThunk(
  'requesterManager/fetchByRequesterAndEmployee',
  async (
    payload: { requesterID: string; employeeID: string },
    { rejectWithValue, dispatch }
  ) => {
    try {
      const data = await getRequesterManagerByRequesterAndEmployee(
        payload.requesterID,
        payload.employeeID
      );
      return data;
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to fetch requester manager by requester and employee';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const updateRequesterManagerThunk = createAsyncThunk(
  'requesterManager/update',
  async (payload: UpdateRequesterManagerRequest, { rejectWithValue, dispatch }) => {
    try {
      const data = await updateRequesterManager(payload);
      dispatch(showToast('Requester manager updated successfully.', 'success'));
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update requester manager';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

function getMessageFromDeleteResponse(responseText: string): string {
  const fallback = 'Requester manager deleted successfully.';
  const trimmed = responseText?.trim();
  if (!trimmed) return fallback;
  try {
    const o = JSON.parse(trimmed) as { message?: string };
    if (o && typeof o.message === 'string' && o.message.trim()) return o.message.trim();
  } catch {
    // not JSON, use as plain message if reasonable length
  }
  return trimmed.length <= 200 ? trimmed : fallback;
}

export const removeRequesterManager = createAsyncThunk(
  'requesterManager/remove',
  async (requesterManagerID: string, { rejectWithValue, dispatch }) => {
    try {
      const responseText = await deleteRequesterManager(requesterManagerID);
      const message = getMessageFromDeleteResponse(responseText);
      dispatch(showToast(message, 'success'));
      return requesterManagerID;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete requester manager';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

const slice = createSlice({
  name: 'requesterManager',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setPagination: (state, action) => {
      state.currentPage = action.payload.page || state.currentPage;
      state.pageSize = action.payload.pageSize || state.pageSize;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRequesterManagerList.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchRequesterManagerList.fulfilled, (state, action) => {
        state.isLoading = false;
        state.list = action.payload.data;
        state.totalItems = action.payload.totalRecords;
        if (action.meta.arg?.page !== undefined) {
          state.currentPage = action.meta.arg.page;
        }
        if (action.meta.arg?.pageSize !== undefined) {
          state.pageSize = action.meta.arg.pageSize;
        }
        state.error = null;
      })
      .addCase(fetchRequesterManagerList.rejected, (state, action) => {
        state.isLoading = false;
        state.error = (action.payload as string) ?? null;
      })
      .addCase(fetchRequesterManagerOptions.pending, (state) => {
        state.isLoadingOptions = true;
        state.error = null;
      })
      .addCase(fetchRequesterManagerOptions.fulfilled, (state, action) => {
        state.isLoadingOptions = false;
        state.requesterManagerOptions = action.payload;
        state.error = null;
      })
      .addCase(fetchRequesterManagerOptions.rejected, (state, action) => {
        state.isLoadingOptions = false;
        state.error = (action.payload as string) ?? null;
        state.requesterManagerOptions = [];
      })
      .addCase(createRequesterManagerThunk.fulfilled, (state, action) => {
        state.list.push(action.payload);
        state.error = null;
      })
      .addCase(createRequesterManagerThunk.rejected, (state, action) => {
        state.error = (action.payload as string) ?? null;
      })
      .addCase(updateRequesterManagerThunk.fulfilled, (state, action) => {
        const idx = state.list.findIndex(
          (r) => r.requesterManagerID === action.payload.requesterManagerID
        );
        if (idx >= 0) state.list[idx] = action.payload;
        else state.list.push(action.payload);
        state.error = null;
      })
      .addCase(updateRequesterManagerThunk.rejected, (state, action) => {
        state.error = (action.payload as string) ?? null;
      })
      .addCase(removeRequesterManager.fulfilled, (state, action) => {
        state.list = state.list.filter((r) => r.requesterManagerID !== action.payload);
        state.error = null;
      })
      .addCase(removeRequesterManager.rejected, (state, action) => {
        state.error = (action.payload as string) ?? null;
      });
  },
});

export const { clearError, setPagination } = slice.actions;
export default slice.reducer;
