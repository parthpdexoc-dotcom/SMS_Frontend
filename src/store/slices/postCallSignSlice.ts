/**
 * PostCallSign Redux Slice
 */
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  getPostCallSignsByPostId,
  bulkUpsertPostCallSigns,
  getAvailablePostCallSignsForDropdown,
} from '@/services/postCallSignService';
import type {
  AvailablePostCallSignParams,
  PostCallSign,
  UpsertPostCallSignRequest,
} from '@/types/postCallSign';
import { availablePostCallSignCacheKey } from '@/types/postCallSign';
import type { PaginationParams } from '@/utils/paginationUtils';

export type FetchPostCallSignsArg =
  | string
  | {
      postId: string;
      pagination?: PaginationParams;
    };

interface PostCallSignState {
  postCallSigns: PostCallSign[];
  isLoading: boolean;
  error: string | null;
  availableByKey: Record<string, PostCallSign[]>;
  availableLoadingByKey: Record<string, boolean>;
  availableErrorByKey: Record<string, string | null>;
}

const initialState: PostCallSignState = {
  postCallSigns: [],
  isLoading: false,
  error: null,
  availableByKey: {},
  availableLoadingByKey: {},
  availableErrorByKey: {},
};

export const fetchPostCallSignsThunk = createAsyncThunk(
  'postCallSign/fetchPostCallSigns',
  async (arg: FetchPostCallSignsArg, { rejectWithValue }) => {
    const postId = typeof arg === 'string' ? arg : arg.postId;
    const pagination = typeof arg === 'string' ? undefined : arg.pagination;
    try {
      return await getPostCallSignsByPostId(postId, pagination);
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to fetch post call signs'
      );
    }
  }
);

export const bulkUpsertPostCallSignsThunk = createAsyncThunk(
  'postCallSign/bulkUpsertPostCallSigns',
  async (payload: UpsertPostCallSignRequest[], { rejectWithValue }) => {
    try {
      return await bulkUpsertPostCallSigns(payload);
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to save post call signs'
      );
    }
  }
);

export const fetchAvailablePostCallSignsThunk = createAsyncThunk(
  'postCallSign/fetchAvailable',
  async ({ postId, dateOfWork }: AvailablePostCallSignParams, { rejectWithValue }) => {
    const key = availablePostCallSignCacheKey(postId, dateOfWork);
    try {
      const data = await getAvailablePostCallSignsForDropdown(postId, dateOfWork);
      return { key, data };
    } catch (error) {
      return rejectWithValue({
        key,
        message:
          error instanceof Error ? error.message : 'Failed to fetch available call signs',
      });
    }
  }
);

const postCallSignSlice = createSlice({
  name: 'postCallSign',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearPostCallSigns: (state) => {
      state.postCallSigns = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPostCallSignsThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchPostCallSignsThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.postCallSigns = action.payload;
        state.error = null;
      })
      .addCase(fetchPostCallSignsThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(bulkUpsertPostCallSignsThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(bulkUpsertPostCallSignsThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.postCallSigns = action.payload;
        state.error = null;
      })
      .addCase(bulkUpsertPostCallSignsThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchAvailablePostCallSignsThunk.pending, (state, action) => {
        const key = availablePostCallSignCacheKey(
          action.meta.arg.postId,
          action.meta.arg.dateOfWork
        );
        state.availableLoadingByKey[key] = true;
        state.availableErrorByKey[key] = null;
      })
      .addCase(fetchAvailablePostCallSignsThunk.fulfilled, (state, action) => {
        const { key, data } = action.payload;
        state.availableLoadingByKey[key] = false;
        state.availableByKey[key] = data;
        state.availableErrorByKey[key] = null;
      })
      .addCase(fetchAvailablePostCallSignsThunk.rejected, (state, action) => {
        const payload = action.payload as { key: string; message: string } | undefined;
        const key =
          payload?.key ??
          availablePostCallSignCacheKey(
            action.meta.arg.postId,
            action.meta.arg.dateOfWork
          );
        state.availableLoadingByKey[key] = false;
        state.availableErrorByKey[key] =
          payload?.message ?? 'Failed to fetch available call signs';
      });
  },
});

export const { clearError, clearPostCallSigns } = postCallSignSlice.actions;
export default postCallSignSlice.reducer;
