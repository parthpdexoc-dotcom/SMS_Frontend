/**
 * RequesterRestricted Redux Slice
 */
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants/tablePagination';
import {
  createRequesterRestrict,
  getRequesterRestrictedList,
  updateRequesterRestrict,
} from '@/services/requesterRestrictedService';
import {
  CreateRequesterRestrictRequest,
  RequesterRestrictPaginationParams,
  RequesterRestrict,
  UpdateRequesterRestrictRequest,
} from '@/types/requesterRestrict';
import { showToast } from './toastSlice';
import { shouldPersistGridPageSize } from '@/constants/pagination';

interface RequesterRestrictedState {
  requesterRestrictedList: RequesterRestrict[];
  isLoading: boolean;
  error: string | null;
  totalItems: number;
  currentPage: number;
  pageSize: number;
}

const initialState: RequesterRestrictedState = {
  requesterRestrictedList: [],
  isLoading: false,
  error: null,
  totalItems: 0,
  currentPage: 1,
  pageSize: DEFAULT_TABLE_PAGE_SIZE,
};

export const fetchRequesterRestrictedList = createAsyncThunk(
  'requesterRestricted/fetchRequesterRestrictedList',
  async (pagination: RequesterRestrictPaginationParams | undefined, thunkAPI) => {
    const { rejectWithValue, dispatch } = thunkAPI;
    try {
      const data = await getRequesterRestrictedList(pagination);
      return { data, pagination };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch requester restricted list';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const upsertRequesterRestrictThunk = createAsyncThunk(
  'requesterRestricted/upsertRequesterRestrict',
  async (
    payload: CreateRequesterRestrictRequest | UpdateRequesterRestrictRequest,
    { rejectWithValue, dispatch }
  ) => {
    try {
      if ('requesterRestrictID' in payload && payload.requesterRestrictID) {
        const data = await updateRequesterRestrict(payload as UpdateRequesterRestrictRequest);
        dispatch(showToast('Requester restrict updated successfully.', 'success'));
        return data;
      }
      const data = await createRequesterRestrict(payload as CreateRequesterRestrictRequest);
      dispatch(showToast('Requester restrict created successfully.', 'success'));
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save requester restrict';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

const requesterRestrictedSlice = createSlice({
  name: 'requesterRestricted',
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
      .addCase(fetchRequesterRestrictedList.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchRequesterRestrictedList.fulfilled, (state, action) => {
        state.isLoading = false;
        state.requesterRestrictedList = action.payload.data.data;
        if (action.payload.pagination) {
          if (action.payload.pagination.page !== undefined)
            state.currentPage = action.payload.pagination.page;
          if (shouldPersistGridPageSize(action.payload.pagination.pageSize))
            state.pageSize = action.payload.pagination.pageSize as number;
        }
        state.totalItems = action.payload.data.totalRecords;
        state.error = null;
      })
      .addCase(fetchRequesterRestrictedList.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(upsertRequesterRestrictThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(upsertRequesterRestrictThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        const idx = state.requesterRestrictedList.findIndex(
          (r) => r.requesterRestrictID === action.payload.requesterRestrictID
        );
        if (idx >= 0) state.requesterRestrictedList[idx] = action.payload;
        else state.requesterRestrictedList.push(action.payload);
        state.error = null;
      })
      .addCase(upsertRequesterRestrictThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError, setPagination } = requesterRestrictedSlice.actions;
export default requesterRestrictedSlice.reducer;
