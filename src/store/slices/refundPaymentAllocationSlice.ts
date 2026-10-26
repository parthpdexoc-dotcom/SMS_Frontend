import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { PAYMENT_GRID } from '@/constants/strings';
import {
  getRefundPaymentAllocationHistory,
  getRefundPaymentAllocations,
  voidRefundPaymentAllocation,
} from '@/services/refundPaymentAllocationService';
import { unwrapPagedList } from '@/services/textPlainJson';
import type {
  RefundPaymentAllocationHistoryResponseDto,
  RefundPaymentAllocationsResult,
} from '@/types/payment';
import { showToast } from './toastSlice';
import type { RootState } from '@/store';

const trimRefundPaymentId = (value?: string | null): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

export interface FetchRefundPaymentAllocationsArgs {
  refundPaymentId: string;
  page: number;
  pageSize: number;
}

export const fetchRefundPaymentAllocations = createAsyncThunk(
  'refundPaymentAllocation/fetchRefundPaymentAllocations',
  async (
    { refundPaymentId, page, pageSize }: FetchRefundPaymentAllocationsArgs,
    { rejectWithValue, dispatch }
  ) => {
    try {
      const dto = await getRefundPaymentAllocations(refundPaymentId, page, pageSize);
      const { data: allocations, totalRecords } = unwrapPagedList(dto.allocations);
      return {
        ...dto,
        refundPaymentId: trimRefundPaymentId(dto.refundPaymentId) ?? refundPaymentId.trim(),
        allocations,
        totalRecords,
      } satisfies RefundPaymentAllocationsResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : PAYMENT_GRID.ERRORS.LOAD_FAILED;
      dispatch(showToast(message, 'error'));
      return rejectWithValue(message);
    }
  }
);

export const fetchRefundPaymentAllocationHistory = createAsyncThunk(
  'refundPaymentAllocation/fetchRefundPaymentAllocationHistory',
  async (refundPaymentId: string, { rejectWithValue, dispatch }) => {
    try {
      const dto = await getRefundPaymentAllocationHistory(refundPaymentId);
      return {
        ...dto,
        refundPaymentId: trimRefundPaymentId(dto.refundPaymentId) ?? refundPaymentId.trim(),
        allocationHistory: dto.allocationHistory ?? [],
      } satisfies RefundPaymentAllocationHistoryResponseDto;
    } catch (error) {
      const message = error instanceof Error ? error.message : PAYMENT_GRID.ERRORS.LOAD_FAILED;
      dispatch(showToast(message, 'error'));
      return rejectWithValue(message);
    }
  }
);

export interface VoidRefundPaymentAllocationArgs {
  refundPaymentAllocationId: string;
  reason: string;
}

export const voidRefundPaymentAllocationThunk = createAsyncThunk(
  'refundPaymentAllocation/voidRefundPaymentAllocation',
  async (
    { refundPaymentAllocationId, reason }: VoidRefundPaymentAllocationArgs,
    { rejectWithValue, dispatch }
  ) => {
    try {
      await voidRefundPaymentAllocation(refundPaymentAllocationId, reason);
      dispatch(showToast(PAYMENT_GRID.TOAST.VOID_REFUND_ALLOCATION_SUCCESS, 'success'));
      return { refundPaymentAllocationId };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : PAYMENT_GRID.ERRORS.DELETE_FAILED;
      dispatch(showToast(message, 'error'));
      return rejectWithValue(message);
    }
  }
);

interface RefundPaymentAllocationState {
  refundPaymentAllocations: RefundPaymentAllocationsResult | null;
  refundPaymentAllocationsRefundId: string | null;
  refundPaymentAllocationsLoading: boolean;
  refundPaymentAllocationsError: string | null;
  refundPaymentAllocationHistory: RefundPaymentAllocationHistoryResponseDto | null;
  refundPaymentAllocationHistoryRefundId: string | null;
  refundPaymentAllocationHistoryLoading: boolean;
  refundPaymentAllocationHistoryError: string | null;
}

const initialState: RefundPaymentAllocationState = {
  refundPaymentAllocations: null,
  refundPaymentAllocationsRefundId: null,
  refundPaymentAllocationsLoading: false,
  refundPaymentAllocationsError: null,
  refundPaymentAllocationHistory: null,
  refundPaymentAllocationHistoryRefundId: null,
  refundPaymentAllocationHistoryLoading: false,
  refundPaymentAllocationHistoryError: null,
};

const refundPaymentAllocationSlice = createSlice({
  name: 'refundPaymentAllocation',
  initialState,
  reducers: {
    clearRefundPaymentAllocations: (state) => {
      state.refundPaymentAllocations = null;
      state.refundPaymentAllocationsRefundId = null;
      state.refundPaymentAllocationsLoading = false;
      state.refundPaymentAllocationsError = null;
      state.refundPaymentAllocationHistory = null;
      state.refundPaymentAllocationHistoryRefundId = null;
      state.refundPaymentAllocationHistoryLoading = false;
      state.refundPaymentAllocationHistoryError = null;
    },
    clearRefundPaymentAllocationHistory: (state) => {
      state.refundPaymentAllocationHistory = null;
      state.refundPaymentAllocationHistoryRefundId = null;
      state.refundPaymentAllocationHistoryLoading = false;
      state.refundPaymentAllocationHistoryError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRefundPaymentAllocations.pending, (state, action) => {
        state.refundPaymentAllocationsRefundId = action.meta.arg.refundPaymentId.trim();
        state.refundPaymentAllocations = null;
        state.refundPaymentAllocationsLoading = true;
        state.refundPaymentAllocationsError = null;
      })
      .addCase(fetchRefundPaymentAllocations.fulfilled, (state, action) => {
        if (action.meta.arg.refundPaymentId.trim() !== state.refundPaymentAllocationsRefundId) {
          return;
        }
        state.refundPaymentAllocationsLoading = false;
        state.refundPaymentAllocations = action.payload;
      })
      .addCase(fetchRefundPaymentAllocations.rejected, (state, action) => {
        if (action.meta.arg.refundPaymentId.trim() !== state.refundPaymentAllocationsRefundId) {
          return;
        }
        state.refundPaymentAllocationsLoading = false;
        state.refundPaymentAllocations = null;
        state.refundPaymentAllocationsError =
          (action.payload as string) ?? PAYMENT_GRID.ERRORS.LOAD_FAILED;
      })
      .addCase(fetchRefundPaymentAllocationHistory.pending, (state, action) => {
        state.refundPaymentAllocationHistoryRefundId = action.meta.arg.trim();
        state.refundPaymentAllocationHistory = null;
        state.refundPaymentAllocationHistoryLoading = true;
        state.refundPaymentAllocationHistoryError = null;
      })
      .addCase(fetchRefundPaymentAllocationHistory.fulfilled, (state, action) => {
        if (action.meta.arg.trim() !== state.refundPaymentAllocationHistoryRefundId) {
          return;
        }
        state.refundPaymentAllocationHistoryLoading = false;
        state.refundPaymentAllocationHistory = action.payload;
      })
      .addCase(fetchRefundPaymentAllocationHistory.rejected, (state, action) => {
        if (action.meta.arg.trim() !== state.refundPaymentAllocationHistoryRefundId) {
          return;
        }
        state.refundPaymentAllocationHistoryLoading = false;
        state.refundPaymentAllocationHistory = null;
        state.refundPaymentAllocationHistoryError =
          (action.payload as string) ?? PAYMENT_GRID.ERRORS.LOAD_FAILED;
      });
  },
});

export const { clearRefundPaymentAllocations, clearRefundPaymentAllocationHistory } =
  refundPaymentAllocationSlice.actions;

export const selectRefundPaymentAllocationsState = (state: RootState) => ({
  view: state.refundPaymentAllocation.refundPaymentAllocations,
  loading: state.refundPaymentAllocation.refundPaymentAllocationsLoading,
  error: state.refundPaymentAllocation.refundPaymentAllocationsError,
});

export const selectRefundPaymentAllocationHistoryState = (state: RootState) => ({
  view: state.refundPaymentAllocation.refundPaymentAllocationHistory,
  loading: state.refundPaymentAllocation.refundPaymentAllocationHistoryLoading,
  error: state.refundPaymentAllocation.refundPaymentAllocationHistoryError,
});

export default refundPaymentAllocationSlice.reducer;
