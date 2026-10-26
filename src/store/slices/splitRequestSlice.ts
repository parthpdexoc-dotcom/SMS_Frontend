/**
 * Split Request Redux Slice
 */
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import {
  declineSplitRequest,
} from '@/services/closedPostPositionEquipmentService';
import { updatePostPositionStatus } from '@/services/postPositionService';
import { SplitRequest } from '@/types/closedPostPositionEquipment';
import { POST_READY_TO_CLOSE_STATUS_FILTER } from '@/types/postPosition';
import { showToast } from './toastSlice';
import { fetchPostPositionsByStatus } from './postPositionSlice';

interface SplitRequestState {
  pendingSplitRequests: SplitRequest[];
  loading: boolean;
  error: string | null;
}

const initialState: SplitRequestState = {
  pendingSplitRequests: [],
  loading: false,
  error: null,
};

export const acceptSplitRequestThunk = createAsyncThunk(
  'splitRequest/accept',
  async (postPositionId: string, { rejectWithValue, dispatch }) => {
    try {
      // Update post position status to 1 (Post Ready to Close)
      await updatePostPositionStatus(postPositionId, 1);
      dispatch(showToast('Split request accepted successfully', 'success'));
      dispatch(fetchPostPositionsByStatus({
        statusEnum: 1,
        statuses: [...POST_READY_TO_CLOSE_STATUS_FILTER],
        filters: { isOngoing: true },
      }));
      return postPositionId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to accept split request';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const declineSplitRequestThunk = createAsyncThunk(
  'splitRequest/decline',
  async (postPositionId: string, { rejectWithValue, dispatch }) => {
    try {
      await declineSplitRequest(postPositionId);
      dispatch(showToast('Split request declined successfully', 'success'));
      dispatch(fetchPostPositionsByStatus({
        statusEnum: 1,
        statuses: [...POST_READY_TO_CLOSE_STATUS_FILTER],
        filters: { isOngoing: true },
      }));
      return postPositionId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to decline split request';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

const splitRequestSlice = createSlice({
  name: 'splitRequest',
  initialState,
  reducers: {
    clearSplitRequests: (state) => {
      state.pendingSplitRequests = [];
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(acceptSplitRequestThunk.pending, (state) => {
        state.loading = true;
      })
      .addCase(acceptSplitRequestThunk.fulfilled, (state) => {
        state.loading = false;
        // Remove the accepted request from pending list
        // Note: We'll refetch after accept, but this provides immediate UI update
      })
      .addCase(acceptSplitRequestThunk.rejected, (state) => {
        state.loading = false;
      })
      .addCase(declineSplitRequestThunk.pending, (state) => {
        state.loading = true;
      })
      .addCase(declineSplitRequestThunk.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(declineSplitRequestThunk.rejected, (state) => {
        state.loading = false;
      });
  },
});

export const { clearSplitRequests } = splitRequestSlice.actions;
export default splitRequestSlice.reducer;
