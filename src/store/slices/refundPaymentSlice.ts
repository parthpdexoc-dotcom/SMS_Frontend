import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { PAYMENT_GRID } from '@/constants/strings';
import {
  allocateRefundPayment,
  deleteRefundPayment,
  getRequesterRefundSummary,
} from '@/services/refundPaymentService';
import { unwrapPagedList } from '@/services/textPlainJson';
import type {
  RefundPaymentAllocatePayload,
  RequesterRefundPaymentSummaryResult,
} from '@/types/payment';
import { showToast } from './toastSlice';
import type { RootState } from '@/store';

export interface FetchRequesterRefundSummaryArgs {
  requesterId: string;
  startDate?: string | null;
  endDate?: string | null;
  page: number;
  pageSize: number;
}

export const fetchRequesterRefundSummary = createAsyncThunk(
  'refundPayment/fetchRequesterRefundSummary',
  async (
    { requesterId, startDate, endDate, page, pageSize }: FetchRequesterRefundSummaryArgs,
    { rejectWithValue }
  ) => {
    try {
      const dto = await getRequesterRefundSummary(requesterId, startDate, endDate, page, pageSize);
      const { data: refunds, totalRecords } = unwrapPagedList(dto.refunds);
      return { ...dto, refunds, totalRecords };
    } catch (error) {
      const message = error instanceof Error ? error.message : PAYMENT_GRID.ERRORS.LOAD_FAILED;
      return rejectWithValue(message);
    }
  }
);

export const allocateRefundPaymentThunk = createAsyncThunk(
  'refundPayment/allocateRefundPayment',
  async (payload: RefundPaymentAllocatePayload, { rejectWithValue, dispatch }) => {
    try {
      const result = await allocateRefundPayment(payload);
      dispatch(showToast(PAYMENT_GRID.REQUESTER_PAYMENT_PAGE.REFUND.TOAST_SUCCESS, 'success'));
      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : PAYMENT_GRID.REQUESTER_PAYMENT_PAGE.REFUND.FAILED;
      dispatch(showToast(message, 'error'));
      return rejectWithValue(message);
    }
  }
);

export const deleteRefundPaymentThunk = createAsyncThunk(
  'refundPayment/deleteRefundPayment',
  async (
    { refundPaymentId, reason }: { refundPaymentId: string; reason: string },
    { rejectWithValue, dispatch }
  ) => {
    try {
      await deleteRefundPayment(refundPaymentId, reason);
      dispatch(showToast(PAYMENT_GRID.TOAST.DELETE_REFUND_SUCCESS, 'success'));
      return { refundPaymentId };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : PAYMENT_GRID.ERRORS.DELETE_REFUND_FAILED;
      dispatch(showToast(message, 'error'));
      return rejectWithValue(message);
    }
  }
);

interface RefundPaymentState {
  requesterRefundSummary: RequesterRefundPaymentSummaryResult | null;
  requesterRefundSummaryLoading: boolean;
  requesterRefundSummaryError: string | null;
  isSavingRefund: boolean;
}

const initialState: RefundPaymentState = {
  requesterRefundSummary: null,
  requesterRefundSummaryLoading: false,
  requesterRefundSummaryError: null,
  isSavingRefund: false,
};

const refundPaymentSlice = createSlice({
  name: 'refundPayment',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchRequesterRefundSummary.pending, (state) => {
        state.requesterRefundSummaryLoading = true;
        state.requesterRefundSummaryError = null;
      })
      .addCase(fetchRequesterRefundSummary.fulfilled, (state, action) => {
        state.requesterRefundSummaryLoading = false;
        state.requesterRefundSummary = action.payload;
      })
      .addCase(fetchRequesterRefundSummary.rejected, (state, action) => {
        state.requesterRefundSummaryLoading = false;
        state.requesterRefundSummary = null;
        state.requesterRefundSummaryError =
          (action.payload as string) ?? PAYMENT_GRID.ERRORS.LOAD_FAILED;
      })
      .addCase(allocateRefundPaymentThunk.pending, (state) => {
        state.isSavingRefund = true;
      })
      .addCase(allocateRefundPaymentThunk.fulfilled, (state) => {
        state.isSavingRefund = false;
      })
      .addCase(allocateRefundPaymentThunk.rejected, (state) => {
        state.isSavingRefund = false;
      });
  },
});

export const selectRequesterRefundSummaryState = (state: RootState) => ({
  summary: state.refundPayment.requesterRefundSummary,
  loading: state.refundPayment.requesterRefundSummaryLoading,
  error: state.refundPayment.requesterRefundSummaryError,
});

export const selectRefundPaymentSavingState = (state: RootState) => ({
  saving: state.refundPayment.isSavingRefund,
});

export default refundPaymentSlice.reducer;
