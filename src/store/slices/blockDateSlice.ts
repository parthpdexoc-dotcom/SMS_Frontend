/**
 * BlockDate Redux Slice
 */
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants/tablePagination';
import {
  createBlockDate,
  deleteBlockDate,
  getBlockDates,
  updateBlockDate,
} from '@/services/blockDateService';
import {
  BlockDatePaginationParams,
  BlockDateSearchParams,
  BlockDateResponse,
  CreateBlockDateRequest,
  UpdateBlockDateRequest,
} from '@/types/blockDate';
import { BLOCK_DATE } from '@/constants/strings';
import { showToast } from './toastSlice';
import { apiGet } from '@/utils/apiClient';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';
import { expectOkReadText, parsePagedListJson } from '@/services/textPlainJson';
import { normalizeBlockDate } from '@/utils/normalizers';

interface BlockDateState {
  blockDates: BlockDateResponse[];
  isLoading: boolean;
  error: string | null;
  totalItems: number;
  currentPage: number;
  pageSize: number;
}

const initialState: BlockDateState = {
  blockDates: [],
  isLoading: false,
  error: null,
  totalItems: 0,
  currentPage: 1,
  pageSize: DEFAULT_TABLE_PAGE_SIZE,
};

export const fetchBlockDates = createAsyncThunk(
  'blockDate/fetchBlockDates',
  async (pagination: BlockDatePaginationParams | undefined, { rejectWithValue, dispatch }) => {
    try {
      const data = await getBlockDates(pagination);
      return { data, pagination };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch block dates';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const upsertBlockDateThunk = createAsyncThunk(
  'blockDate/upsertBlockDate',
  async (
    payload: CreateBlockDateRequest | UpdateBlockDateRequest,
    { rejectWithValue, dispatch }
  ) => {
    try {
      const isUpdate = 'blockDateId' in payload && payload.blockDateId;
      const result = isUpdate
        ? await updateBlockDate(payload as UpdateBlockDateRequest)
        : await createBlockDate(payload as CreateBlockDateRequest);
      dispatch(showToast(isUpdate ? BLOCK_DATE.SUCCESS.UPDATED : BLOCK_DATE.SUCCESS.ADDED, 'success'));
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save block date';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const searchBlockDatesThunk = createAsyncThunk(
  'blockDate/searchBlockDates',
  async (pagination: BlockDateSearchParams | undefined, { rejectWithValue, dispatch }) => {
    try {
      const queryParams = buildPaginationQueryParams(pagination);
      const searchTerm = pagination?.searchTerm?.trim();
      if (searchTerm) queryParams.append('searchTerm', searchTerm);
      if (pagination?.postId) queryParams.append('postid', pagination.postId);
      const endpoint = `/BlockDate/search${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await apiGet(endpoint);
      const responseText = await expectOkReadText(response, 'Failed to search block dates');
      const { data, totalRecords } = parsePagedListJson(responseText, (row) => normalizeBlockDate(row));
      return { data, totalRecords, pagination };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to search block dates';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const removeBlockDate = createAsyncThunk(
  'blockDate/removeBlockDate',
  async (blockDateId: string, { rejectWithValue, dispatch }) => {
    try {
      await deleteBlockDate(blockDateId);
      dispatch(showToast(BLOCK_DATE.SUCCESS.DELETED, 'success'));
      return blockDateId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete block date';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

const blockDateSlice = createSlice({
  name: 'blockDate',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setPagination: (state, action) => {
      state.currentPage = action.payload.page ?? state.currentPage;
      state.pageSize = action.payload.pageSize ?? state.pageSize;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBlockDates.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchBlockDates.fulfilled, (state, action) => {
        state.isLoading = false;
        state.blockDates = action.payload.data.data;
        state.totalItems = action.payload.data.totalRecords;
        if (action.payload.pagination) {
          if (action.payload.pagination.page !== undefined) state.currentPage = action.payload.pagination.page;
          if (action.payload.pagination.pageSize !== undefined) state.pageSize = action.payload.pagination.pageSize;
        }
        state.error = null;
      })
      .addCase(fetchBlockDates.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(searchBlockDatesThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(searchBlockDatesThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.blockDates = action.payload.data;
        if (action.payload.pagination) {
          if (action.payload.pagination.page !== undefined) state.currentPage = action.payload.pagination.page;
          if (action.payload.pagination.pageSize !== undefined) state.pageSize = action.payload.pagination.pageSize;
        }
        state.totalItems = action.payload.totalRecords ?? action.payload.data.length;
        state.error = null;
      })
      .addCase(searchBlockDatesThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(upsertBlockDateThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(upsertBlockDateThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        const idx = state.blockDates.findIndex((b) => b.blockDateId === action.payload.blockDateId);
        if (idx >= 0) state.blockDates[idx] = action.payload;
        else state.blockDates.push(action.payload);
        state.error = null;
      })
      .addCase(upsertBlockDateThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(removeBlockDate.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(removeBlockDate.fulfilled, (state, action) => {
        state.isLoading = false;
        state.blockDates = state.blockDates.filter((b) => b.blockDateId !== action.payload);
        state.error = null;
      })
      .addCase(removeBlockDate.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError, setPagination } = blockDateSlice.actions;
export default blockDateSlice.reducer;
