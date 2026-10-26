import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { INVOICE_GRID, PAYMENT_GRID } from '@/constants/strings';
import { getInvoicePaymentSummary, voidInvoicePayment } from '@/services/invoiceService';
import { voidPaymentAllocation } from '@/services/paymentAllocationService';
import type { InvoicePaymentInformationDto, InvoicePaymentSummaryDto } from '@/types/invoice';
import type { PaymentAllocateResponseDto } from '@/types/payment';
import { showToast } from './toastSlice';
import type { RootState } from '@/store';

type VoidPaymentWithReasonArgs =
  | { scope: 'allocation'; paymentAllocationId: string; reason: string }
  | { scope: 'invoicePayment'; invoicesId: string; paymentId: string; reason: string };

export type VoidPaymentWithReasonResult =
  | { scope: 'allocation'; paymentAllocationId: string; data: PaymentAllocateResponseDto }
  | {
      scope: 'invoicePayment';
      invoicesId: string;
      data: InvoicePaymentInformationDto;
      summary: InvoicePaymentSummaryDto;
    };

const voidErrors = PAYMENT_GRID.SETTLE_PENDING_INVOICES.VOID_ALLOCATION.ERRORS;
const voidToast = PAYMENT_GRID.SETTLE_PENDING_INVOICES.VOID_ALLOCATION.TOAST;

export const voidPaymentWithReasonThunk = createAsyncThunk(
  'paymentAllocation/voidWithReason',
  async (args: VoidPaymentWithReasonArgs, { rejectWithValue, dispatch }) => {
    const trimmedReason = args.reason.trim();
    if (!trimmedReason) {
      return rejectWithValue(voidErrors.MISSING_REASON);
    }

    if (args.scope === 'allocation') {
      const paymentAllocationId = args.paymentAllocationId.trim();
      if (!paymentAllocationId) {
        return rejectWithValue(voidErrors.MISSING_ID);
      }
      try {
        const data = await voidPaymentAllocation(paymentAllocationId, trimmedReason);
        dispatch(showToast(voidToast.SUCCESS, 'success'));
        return {
          scope: 'allocation',
          paymentAllocationId,
          data,
        } satisfies VoidPaymentWithReasonResult;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : voidErrors.FAILED;
        dispatch(showToast(message, 'error'));
        return rejectWithValue(message);
      }
    }

    const invoicesId = args.invoicesId.trim();
    const paymentId = args.paymentId.trim();
    if (!invoicesId || !paymentId) {
      return rejectWithValue(INVOICE_GRID.PAYMENT.ERRORS.DISCARD_FAILED);
    }
    try {
      const data = await voidInvoicePayment(invoicesId, paymentId, trimmedReason);
      const summary = await getInvoicePaymentSummary(invoicesId);
      dispatch(showToast(INVOICE_GRID.PAYMENT.TOAST.DISCARD_SUCCESS, 'success'));
      return {
        scope: 'invoicePayment',
        invoicesId,
        data,
        summary,
      } satisfies VoidPaymentWithReasonResult;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : INVOICE_GRID.PAYMENT.ERRORS.DISCARD_FAILED;
      dispatch(showToast(message, 'error'));
      return rejectWithValue(message);
    }
  }
);

interface PaymentAllocationState {
  voidingPaymentAllocationId: string | null;
  voidingInvoicePaymentId: string | null;
}

const initialState: PaymentAllocationState = {
  voidingPaymentAllocationId: null,
  voidingInvoicePaymentId: null,
};

const paymentAllocationSlice = createSlice({
  name: 'paymentAllocation',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(voidPaymentWithReasonThunk.pending, (state, action) => {
        const args = action.meta.arg;
        if (args.scope === 'allocation') {
          state.voidingPaymentAllocationId = args.paymentAllocationId.trim() || null;
          state.voidingInvoicePaymentId = null;
          return;
        }
        state.voidingInvoicePaymentId = args.paymentId.trim() || null;
        state.voidingPaymentAllocationId = null;
      })
      .addCase(voidPaymentWithReasonThunk.fulfilled, (state) => {
        state.voidingPaymentAllocationId = null;
        state.voidingInvoicePaymentId = null;
      })
      .addCase(voidPaymentWithReasonThunk.rejected, (state) => {
        state.voidingPaymentAllocationId = null;
        state.voidingInvoicePaymentId = null;
      });
  },
});

export const selectVoidingPaymentAllocationId = (state: RootState): string | null =>
  state.paymentAllocation.voidingPaymentAllocationId;

export default paymentAllocationSlice.reducer;
