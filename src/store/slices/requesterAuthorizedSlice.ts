/**
 * Requester Authorized Redux Slice
 */
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants/tablePagination';
import {
  getRequesterAuthorizedList,
  getAllActiveRequesterAuthorized,
  getRequesterAuthorizedById,
  getRequesterAuthorizedOptions,
  createRequesterAuthorized,
  updateRequesterAuthorized,
  deleteRequesterAuthorized,
} from '@/services/requesterAuthorizedService';
import type { RequesterAuthorizedOptionsParams } from '@/services/requesterAuthorizedService';
import type {
  RequesterAuthorized,
  CreateRequesterAuthorizedRequest,
  UpdateRequesterAuthorizedRequest,
  RequesterAuthorizedSearchParams,
  GetAllActiveRequesterAuthorizedParams,
} from '@/types/requesterAuthorized';
import type { SelectOptionDto } from '@/types/common';
import { showToast } from './toastSlice';

interface RequesterAuthorizedState {
  list: RequesterAuthorized[];
  /** Active (and selected inactive) rows for request form dropdown — from GetAllActiveRequesterAuthorized */
  activeList: RequesterAuthorized[];
  requesterAuthorizedOptions: SelectOptionDto[];
  isLoadingActiveList: boolean;
  isLoadingOptions: boolean;
  isLoading: boolean;
  error: string | null;
  totalItems: number;
  currentPage: number;
  pageSize: number;
}

const initialState: RequesterAuthorizedState = {
  list: [],
  activeList: [],
  requesterAuthorizedOptions: [],
  isLoadingActiveList: false,
  isLoadingOptions: false,
  isLoading: false,
  error: null,
  totalItems: 0,
  currentPage: 1,
  pageSize: DEFAULT_TABLE_PAGE_SIZE,
};

export const fetchRequesterAuthorizedList = createAsyncThunk(
  'requesterAuthorized/fetchList',
  async (pagination: RequesterAuthorizedSearchParams | undefined, { rejectWithValue, dispatch }) => {
    try {
      const data = await getRequesterAuthorizedList(pagination);
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch requester authorized list';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchActiveRequesterAuthorized = createAsyncThunk(
  'requesterAuthorized/fetchActive',
  async (params: GetAllActiveRequesterAuthorizedParams | undefined, { rejectWithValue }) => {
    try {
      const { data, totalRecords } = await getAllActiveRequesterAuthorized(params);
      return { data, totalRecords };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to fetch active requester authorized list';
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchRequesterAuthorizedOptions = createAsyncThunk<
  SelectOptionDto[],
  RequesterAuthorizedOptionsParams | undefined
>(
  'requesterAuthorized/fetchOptions',
  async (params, { rejectWithValue, dispatch }) => {
    try {
      return await getRequesterAuthorizedOptions(params);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to fetch requester authorized options';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchRequesterAuthorizedById = createAsyncThunk(
  'requesterAuthorized/fetchById',
  async (requesterAuthorizedID: string, { rejectWithValue, dispatch }) => {
    try {
      const data = await getRequesterAuthorizedById(requesterAuthorizedID);
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch requester authorized';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const createRequesterAuthorizedThunk = createAsyncThunk(
  'requesterAuthorized/create',
  async (payload: CreateRequesterAuthorizedRequest, { rejectWithValue, dispatch }) => {
    try {
      const data = await createRequesterAuthorized(payload);
      dispatch(showToast('Requester authorized created successfully.', 'success'));
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create requester authorized';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const updateRequesterAuthorizedThunk = createAsyncThunk(
  'requesterAuthorized/update',
  async (payload: UpdateRequesterAuthorizedRequest, { rejectWithValue, dispatch }) => {
    try {
      const data = await updateRequesterAuthorized(payload);
      dispatch(showToast('Requester authorized updated successfully.', 'success'));
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update requester authorized';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

function getMessageFromDeleteResponse(responseText: string): string {
  const fallback = 'Requester authorized deleted successfully.';
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

export const removeRequesterAuthorized = createAsyncThunk(
  'requesterAuthorized/remove',
  async (requesterAuthorizedID: string, { rejectWithValue, dispatch }) => {
    try {
      const responseText = await deleteRequesterAuthorized(requesterAuthorizedID);
      const message = getMessageFromDeleteResponse(responseText);
      dispatch(showToast(message, 'success'));
      return requesterAuthorizedID;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete requester authorized';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

const slice = createSlice({
  name: 'requesterAuthorized',
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
      .addCase(fetchRequesterAuthorizedList.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchRequesterAuthorizedList.fulfilled, (state, action) => {
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
      .addCase(fetchRequesterAuthorizedList.rejected, (state, action) => {
        state.isLoading = false;
        state.error = (action.payload as string) ?? null;
      })
      .addCase(fetchActiveRequesterAuthorized.pending, (state) => {
        state.isLoadingActiveList = true;
        state.error = null;
      })
      .addCase(fetchActiveRequesterAuthorized.fulfilled, (state, action) => {
        state.isLoadingActiveList = false;
        state.activeList = action.payload.data;
        state.error = null;
      })
      .addCase(fetchActiveRequesterAuthorized.rejected, (state, action) => {
        state.isLoadingActiveList = false;
        state.error = (action.payload as string) ?? null;
      })
      .addCase(fetchRequesterAuthorizedOptions.pending, (state) => {
        state.isLoadingOptions = true;
        state.error = null;
      })
      .addCase(fetchRequesterAuthorizedOptions.fulfilled, (state, action) => {
        state.isLoadingOptions = false;
        state.requesterAuthorizedOptions = action.payload;
        state.error = null;
      })
      .addCase(fetchRequesterAuthorizedOptions.rejected, (state, action) => {
        state.isLoadingOptions = false;
        state.error = (action.payload as string) ?? null;
        state.requesterAuthorizedOptions = [];
      })
      .addCase(fetchRequesterAuthorizedById.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchRequesterAuthorizedById.fulfilled, (state, action) => {
        state.isLoading = false;
        // Update the item in the list if it exists, otherwise add it
        const idx = state.list.findIndex(r => r.requesterAuthorizedID === action.payload.requesterAuthorizedID);
        if (idx >= 0) {
          state.list[idx] = action.payload;
        } else {
          state.list.push(action.payload);
        }
        state.error = null;
      })
      .addCase(fetchRequesterAuthorizedById.rejected, (state, action) => {
        state.isLoading = false;
        state.error = (action.payload as string) ?? null;
      })
      .addCase(createRequesterAuthorizedThunk.fulfilled, (state, action) => {
        state.list.push(action.payload);
        state.error = null;
      })
      .addCase(createRequesterAuthorizedThunk.rejected, (state, action) => {
        state.error = (action.payload as string) ?? null;
      })
      .addCase(updateRequesterAuthorizedThunk.fulfilled, (state, action) => {
        const idx = state.list.findIndex(
          (r) => r.requesterAuthorizedID === action.payload.requesterAuthorizedID
        );
        if (idx >= 0) state.list[idx] = action.payload;
        else state.list.push(action.payload);
        state.error = null;
      })
      .addCase(updateRequesterAuthorizedThunk.rejected, (state, action) => {
        state.error = (action.payload as string) ?? null;
      })
      .addCase(removeRequesterAuthorized.fulfilled, (state, action) => {
        state.list = state.list.filter((r) => r.requesterAuthorizedID !== action.payload);
        state.error = null;
      })
      .addCase(removeRequesterAuthorized.rejected, (state, action) => {
        state.error = (action.payload as string) ?? null;
      });
  },
});

export const { clearError, setPagination } = slice.actions;
export default slice.reducer;
