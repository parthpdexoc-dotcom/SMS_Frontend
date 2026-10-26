import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { PAYMENT_GRID } from '@/constants/strings';
import { updatePaymentAllocationAmount } from '@/services/paymentAllocationService';
import {
  adjustPaymentAllocations,
  allocatePayment,
  createRequesterPayment,
  deletePayment,
  getAllPayments,
  getPaymentDetail,
  getPaymentReviewAllocations,
  getPaymentUnpaidInvoices,
  getRequesterPaymentSummary,
  getRequesterRefundablePayments,
} from '@/services/paymentService';
import {
  getErrorMessageFromErrorResponse,
  getErrorMessagesFromResult,
  isSuccessResultFailure,
  parseJsonText,
  unwrapPagedList,
} from '@/services/textPlainJson';
import { combineDateAndTime } from '@/utils/dateTimeUtils';
import type {
  AdjustRequesterPaymentArgs,
  UpdatePaymentAllocationAmountArgs,
  CreateRequesterPaymentPayload,
  PaymentAdjustAllocationsDto,
  PaymentAdjustAllocationConflictAllocationDto,
  AllocationSubmitResult,
  PaymentAllocationUpdateResultDto,
  PaymentAllocateDto,
  PaymentAllocateResponseDto,
  PaymentDetailResult,
  PaymentDto,
  PaymentGridRow,
  PaymentReviewAllocationsResult,
  PaymentUnpaidInvoicesResult,
  RequesterPaymentSummaryResult,
} from '@/types/payment';
import { formatDateShort } from '@/utils';
import { showToast } from './toastSlice';
import {
  voidPaymentWithReasonThunk,
  type VoidPaymentWithReasonResult,
} from './paymentAllocationSlice';
import type { RootState } from '@/store';

const trimPaymentId = (value?: string | null): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const trimAllocationId = (value?: string | null): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

/** Patch only server-backed balances and drop the voided row — not a full review reload. */
const applyVoidAllocationBalances = (
  review: PaymentReviewAllocationsResult,
  result: Extract<VoidPaymentWithReasonResult, { scope: 'allocation' }>
): PaymentReviewAllocationsResult => {
  const voidedId = result.paymentAllocationId.trim();
  const { data } = result;
  const allocations = review.allocations.filter((allocation) => {
    const id =
      trimAllocationId(allocation.paymentAllocationId) ??
      trimAllocationId(allocation.paymentAllocationID);
    return id !== voidedId;
  });
  return {
    ...review,
    amount: data.amount ?? review.amount ?? 0,
    appliedAmount: data.totalPaid ?? review.appliedAmount ?? 0,
    availableAmount: data.remainingBalance ?? review.availableAmount ?? 0,
    allocations,
    totalRecords: Math.max(0, review.totalRecords - 1),
  };
};

const PAYMENT_GRID_PLACEHOLDER = PAYMENT_GRID.EMPTY_PLACEHOLDER;

const paymentTypeLabel = (paymentTypeName?: string | null): string =>
  paymentTypeName?.trim() || '—';

const mapPaymentsToGridRows = (
  payments: PaymentDto[],
  requesterNames: Map<string, string>
): PaymentGridRow[] =>
  payments
    .filter((payment) => payment.paymentID)
    .map((payment): PaymentGridRow => {
      const paymentId = payment.paymentID ? String(payment.paymentID) : '';
      const requesterId = String(payment.requesterID ?? '');
      const amountPaid = payment.amount ?? 0;

      return {
        id: paymentId || String(amountPaid),
        paymentId: paymentId || undefined,
        requesterId,
        requesterName: requesterNames.get(requesterId) || PAYMENT_GRID_PLACEHOLDER,
        date: payment.paymentDate ? formatDateShort(payment.paymentDate) : PAYMENT_GRID_PLACEHOLDER,
        amountPaid,
        paymentTypeId: payment.paymentTypeId,
        paymentTypeLabel: paymentTypeLabel(payment.paymentTypeName),
        referenceNumber: (payment.referenceNumber ?? '').trim() || PAYMENT_GRID_PLACEHOLDER,
      };
    })
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

/** Thunk reject payload when POST /Payment/adjust-allocations returns HTTP 409. */
export type PaymentAdjustAllocationConflictReject = {
  kind: 'allocationConflict';
  status: 409;
  message: string;
};

export const isPaymentAdjustAllocationConflictReject = (
  value: unknown
): value is PaymentAdjustAllocationConflictReject =>
  typeof value === 'object' &&
  value != null &&
  (value as PaymentAdjustAllocationConflictReject).kind === 'allocationConflict' &&
  (value as PaymentAdjustAllocationConflictReject).status === 409;

const trimConflictId = (value?: string | null): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const getSkippedAllocationIds = (
  update?: PaymentAllocationUpdateResultDto | null
): string[] =>
  (update?.skippedAllocations ?? [])
    .map(
      (row) =>
        trimAllocationId(row.paymentAllocationId) ?? trimAllocationId(row.paymentAllocationID)
    )
    .filter((id): id is string => Boolean(id));

const parseAdjustAllocationUpdate = (
  parsed: Record<string, unknown>
): PaymentAllocationUpdateResultDto | undefined => {
  const raw = parsed.allocationUpdate ?? parsed.AllocationUpdate;
  if (!raw || typeof raw !== 'object') return undefined;
  const record = raw as Record<string, unknown>;
  return {
    skippedAllocations: (record.skippedAllocations ??
      record.SkippedAllocations) as PaymentAllocationUpdateResultDto['skippedAllocations'],
    messages: (record.messages ?? record.Messages) as string[] | undefined,
  };
};

const normalizeConflictAllocation = (
  raw: PaymentAdjustAllocationConflictAllocationDto
): PaymentAdjustAllocationConflictAllocationDto => ({
  paymentAllocationId:
    trimConflictId(raw.paymentAllocationId) ?? trimConflictId(raw.paymentAllocationID),
  invoiceId: trimConflictId(raw.invoiceId) ?? trimConflictId(raw.invoicesID),
  invoiceAmount:
    raw.invoiceAmount ?? (raw as { InvoiceAmount?: number }).InvoiceAmount,
  amountApplied: raw.amountApplied,
  balanceDue: raw.balanceDue ?? (raw as { BalanceDue?: number }).BalanceDue,
  allocationDate: raw.allocationDate,
  invoiceNo: raw.invoiceNo,
  invoiceDate: raw.invoiceDate,
  dueDate: raw.dueDate,
  paymentNumber: raw.paymentNumber,
  paymentDate: raw.paymentDate,
  referenceNumber: raw.referenceNumber,
});

const assertAdjustAllocationsResponse = (response: Response, text: string): void => {
  let parsed: unknown = null;
  if (text.trim()) {
    try {
      parsed = parseJsonText<unknown>(text);
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    throw new Error(getErrorMessageFromErrorResponse(text, ''));
  }

  const parsedRecord =
    parsed != null && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  if (parsedRecord && isSuccessResultFailure(parsedRecord, response.ok)) {
    throw new Error(getErrorMessagesFromResult(parsedRecord).join('\n'));
  }
};

interface PaymentState {
  payments: PaymentDto[];
  paymentsLoading: boolean;
  paymentsError: string | null;
  isSavingPayment: boolean;
  requesterPaymentSummary: RequesterPaymentSummaryResult | null;
  requesterPaymentSummaryLoading: boolean;
  requesterPaymentSummaryError: string | null;
  requesterRefundablePayments: RequesterPaymentSummaryResult | null;
  requesterRefundablePaymentsLoading: boolean;
  requesterRefundablePaymentsError: string | null;
  paymentUnpaidInvoices: PaymentUnpaidInvoicesResult | null;
  paymentUnpaidInvoicesLoading: boolean;
  paymentUnpaidInvoicesError: string | null;
  paymentAllocationSubmitting: boolean;
  paymentDetail: PaymentDetailResult | null;
  paymentDetailLoading: boolean;
  paymentDetailError: string | null;
  paymentReviewAllocations: PaymentReviewAllocationsResult | null;
  paymentReviewAllocationsPaymentId: string | null;
  paymentReviewAllocationsLoading: boolean;
  paymentReviewAllocationsError: string | null;
}

const initialState: PaymentState = {
  payments: [],
  paymentsLoading: false,
  paymentsError: null,
  isSavingPayment: false,
  requesterPaymentSummary: null,
  requesterPaymentSummaryLoading: false,
  requesterPaymentSummaryError: null,
  requesterRefundablePayments: null,
  requesterRefundablePaymentsLoading: false,
  requesterRefundablePaymentsError: null,
  paymentUnpaidInvoices: null,
  paymentUnpaidInvoicesLoading: false,
  paymentUnpaidInvoicesError: null,
  paymentAllocationSubmitting: false,
  paymentDetail: null,
  paymentDetailLoading: false,
  paymentDetailError: null,
  paymentReviewAllocations: null,
  paymentReviewAllocationsPaymentId: null,
  paymentReviewAllocationsLoading: false,
  paymentReviewAllocationsError: null,
};

export const fetchPayments = createAsyncThunk(
  'payment/fetchPayments',
  async (_, { rejectWithValue, dispatch }) => {
    try {
      return await getAllPayments();
    } catch (error) {
      const message = error instanceof Error ? error.message : PAYMENT_GRID.ERRORS.LOAD_FAILED;
      dispatch(showToast(PAYMENT_GRID.ERRORS.LOAD_FAILED, 'error'));
      return rejectWithValue(message);
    }
  }
);

export const createRequesterPaymentThunk = createAsyncThunk(
  'payment/createRequesterPayment',
  async (payload: CreateRequesterPaymentPayload, { rejectWithValue, dispatch }) => {
    try {
      const created = await createRequesterPayment(payload);
      dispatch(showToast(PAYMENT_GRID.TOAST.SAVE_SUCCESS, 'success'));
      return created;
    } catch (error) {
      const message = error instanceof Error ? error.message : PAYMENT_GRID.ERRORS.SAVE_FAILED;
      dispatch(showToast(message, 'error'));
      return rejectWithValue(message);
    }
  }
);

export const updatePaymentAllocationAmountThunk = createAsyncThunk(
  'payment/updatePaymentAllocationAmount',
  async (payload: UpdatePaymentAllocationAmountArgs, { rejectWithValue, dispatch }) => {
    try {
      const result = await updatePaymentAllocationAmount({
        paymentId: payload.paymentId.trim(),
        allocations: payload.allocations,
      });
      if (result.messages?.length) {
        dispatch(showToast(result.messages.join('\n'), 'warning'));
      } else {
        dispatch(showToast(PAYMENT_GRID.TOAST.UPDATE_SUCCESS, 'success'));
      }
      return {
        paymentId: payload.paymentId,
        skippedAllocationIds: getSkippedAllocationIds(result),
      } satisfies AllocationSubmitResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      return rejectWithValue(message);
    }
  }
);

export const adjustRequesterPaymentThunk = createAsyncThunk(
  'payment/adjustRequesterPayment',
  async (payload: AdjustRequesterPaymentArgs, { rejectWithValue, dispatch }) => {
    try {
      const body: PaymentAdjustAllocationsDto = {
        paymentId: payload.paymentId.trim(),
        paymentAmount: payload.paymentAmount,
        paymentDate:
          combineDateAndTime(payload.paymentDate.trim(), '12:00') ?? new Date().toISOString(),
        referenceNumber: (payload.referenceNumber ?? '').trim() || null,
        paymentTypeId: payload.paymentTypeId,
        allocations: payload.allocations,
      };
      const { response, text } = await adjustPaymentAllocations(body);

      if (response.status === 409) {
        return rejectWithValue({
          kind: 'allocationConflict',
          status: 409,
          message: getErrorMessageFromErrorResponse(text, ''),
        } satisfies PaymentAdjustAllocationConflictReject);
      }

      if (!response.ok) {
        return rejectWithValue(getErrorMessageFromErrorResponse(text, ''));
      }

      const parsed =
        text.trim() !== ''
          ? (parseJsonText<Record<string, unknown>>(text) as Record<string, unknown>)
          : {};
      assertAdjustAllocationsResponse(response, text);
      const allocationUpdate = parseAdjustAllocationUpdate(parsed);
      if (allocationUpdate?.messages?.length) {
        dispatch(showToast(allocationUpdate.messages.join('\n'), 'warning'));
      } else {
        dispatch(showToast(PAYMENT_GRID.TOAST.UPDATE_SUCCESS, 'success'));
      }
      return {
        paymentId: payload.paymentId,
        skippedAllocationIds: getSkippedAllocationIds(allocationUpdate),
      } satisfies AllocationSubmitResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      return rejectWithValue(message);
    }
  }
);

export interface FetchRequesterPaymentSummaryArgs {
  requesterId: string;
  startDate?: string | null;
  endDate?: string | null;
  page: number;
  pageSize: number;
}

export const fetchRequesterPaymentSummary = createAsyncThunk(
  'payment/fetchRequesterPaymentSummary',
  async (
    { requesterId, startDate, endDate, page, pageSize }: FetchRequesterPaymentSummaryArgs,
    { rejectWithValue }
  ) => {
    try {
      const dto = await getRequesterPaymentSummary(requesterId, startDate, endDate, page, pageSize);
      const { data: payments, totalRecords } = unwrapPagedList(dto.payments);
      return { ...dto, payments, totalRecords };
    } catch (error) {
      const message = error instanceof Error ? error.message : PAYMENT_GRID.ERRORS.LOAD_FAILED;
      return rejectWithValue(message);
    }
  }
);

export interface FetchRequesterRefundablePaymentsArgs {
  requesterId: string;
  page: number;
  pageSize: number;
}

export const fetchRequesterRefundablePayments = createAsyncThunk(
  'payment/fetchRequesterRefundablePayments',
  async (
    { requesterId, page, pageSize }: FetchRequesterRefundablePaymentsArgs,
    { rejectWithValue }
  ) => {
    try {
      const dto = await getRequesterRefundablePayments(requesterId, page, pageSize);
      const { data: payments, totalRecords } = unwrapPagedList(dto.payments);
      return { ...dto, payments, totalRecords };
    } catch (error) {
      const message = error instanceof Error ? error.message : PAYMENT_GRID.ERRORS.LOAD_FAILED;
      return rejectWithValue(message);
    }
  }
);

export interface FetchPaymentUnpaidInvoicesArgs {
  paymentId: string;
  requesterId: string;
  page: number;
  pageSize: number;
}

export const fetchPaymentUnpaidInvoices = createAsyncThunk(
  'payment/fetchPaymentUnpaidInvoices',
  async (
    { paymentId, requesterId, page, pageSize }: FetchPaymentUnpaidInvoicesArgs,
    { rejectWithValue }
  ) => {
    try {
      const dto = await getPaymentUnpaidInvoices(paymentId, requesterId, page, pageSize);
      const { data: invoices, totalRecords } = unwrapPagedList(dto.invoices);
      return { ...dto, invoices, totalRecords };
    } catch (error) {
      const message = error instanceof Error ? error.message : PAYMENT_GRID.ERRORS.LOAD_FAILED;
      return rejectWithValue(message);
    }
  }
);

export interface FetchPaymentDetailArgs {
  paymentId: string;
  page: number;
  pageSize: number;
  /** When true, result is for edit/readjust only — does not update view modal state. */
  forAllocations?: boolean;
}

export const fetchPaymentDetail = createAsyncThunk(
  'payment/fetchPaymentDetail',
  async ({ paymentId, page, pageSize }: FetchPaymentDetailArgs, { rejectWithValue }) => {
    try {
      const dto = await getPaymentDetail(paymentId, page, pageSize);
      const { data: invoices, totalRecords } = unwrapPagedList(dto.invoices);
      return { ...dto, invoices, totalRecords };
    } catch (error) {
      const message = error instanceof Error ? error.message : PAYMENT_GRID.ERRORS.LOAD_FAILED;
      return rejectWithValue(message);
    }
  }
);

export interface FetchPaymentReviewAllocationsArgs {
  paymentId: string;
  page: number;
  pageSize: number;
}

export const fetchPaymentReviewAllocations = createAsyncThunk(
  'payment/fetchPaymentReviewAllocations',
  async (
    { paymentId, page, pageSize }: FetchPaymentReviewAllocationsArgs,
    { rejectWithValue, dispatch }
  ) => {
    try {
      const dto = await getPaymentReviewAllocations(paymentId, page, pageSize);
      const { data: allocations, totalRecords } = unwrapPagedList(dto.allocations);
      return {
        ...dto,
        paymentId: trimPaymentId(dto.paymentId) ?? paymentId.trim(),
        allocations: allocations.map(normalizeConflictAllocation),
        totalRecords,
      } satisfies PaymentReviewAllocationsResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : PAYMENT_GRID.ERRORS.LOAD_FAILED;
      dispatch(showToast(message, 'error'));
      return rejectWithValue(message);
    }
  }
);

export const allocatePaymentThunk = createAsyncThunk(
  'payment/allocatePayment',
  async (payload: PaymentAllocateDto, { rejectWithValue, dispatch }) => {
    try {
      const result = await allocatePayment(payload);
      dispatch(showToast(PAYMENT_GRID.TOAST.ALLOCATE_SUCCESS, 'success'));
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to allocate payment.';
      dispatch(showToast(message, 'error'));
      return rejectWithValue(message);
    }
  }
);

export const deletePaymentThunk = createAsyncThunk(
  'payment/deletePayment',
  async (
    { paymentId, reason }: { paymentId: string; reason: string },
    { rejectWithValue, dispatch }
  ) => {
    try {
      await deletePayment(paymentId, reason);
      dispatch(showToast(PAYMENT_GRID.TOAST.DELETE_SUCCESS, 'success'));
      return { paymentId };
    } catch (error) {
      const message = error instanceof Error ? error.message : PAYMENT_GRID.ERRORS.DELETE_FAILED;
      dispatch(showToast(message, 'error'));
      return rejectWithValue(message);
    }
  }
);

const paymentSlice = createSlice({
  name: 'payment',
  initialState,
  reducers: {
    clearPaymentReviewAllocations: (state) => {
      state.paymentReviewAllocations = null;
      state.paymentReviewAllocationsPaymentId = null;
      state.paymentReviewAllocationsLoading = false;
      state.paymentReviewAllocationsError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPayments.pending, (state) => {
        state.paymentsLoading = true;
        state.paymentsError = null;
      })
      .addCase(fetchPayments.fulfilled, (state, action) => {
        state.paymentsLoading = false;
        state.payments = action.payload;
      })
      .addCase(fetchPayments.rejected, (state, action) => {
        state.paymentsLoading = false;
        state.paymentsError = (action.payload as string) ?? PAYMENT_GRID.ERRORS.LOAD_FAILED;
        state.payments = [];
      })
      .addCase(createRequesterPaymentThunk.pending, (state) => {
        state.isSavingPayment = true;
      })
      .addCase(createRequesterPaymentThunk.fulfilled, (state, action) => {
        state.isSavingPayment = false;
        const paymentId = action.payload.paymentID ? String(action.payload.paymentID) : '';
        if (!paymentId) return;
        const index = state.payments.findIndex((p) => String(p.paymentID) === paymentId);
        if (index >= 0) {
          state.payments[index] = action.payload;
        } else {
          state.payments.unshift(action.payload);
        }
      })
      .addCase(createRequesterPaymentThunk.rejected, (state) => {
        state.isSavingPayment = false;
      })
      .addCase(adjustRequesterPaymentThunk.pending, (state) => {
        state.isSavingPayment = true;
      })
      .addCase(adjustRequesterPaymentThunk.fulfilled, (state) => {
        state.isSavingPayment = false;
      })
      .addCase(adjustRequesterPaymentThunk.rejected, (state) => {
        state.isSavingPayment = false;
      })
      .addCase(updatePaymentAllocationAmountThunk.pending, (state) => {
        state.isSavingPayment = true;
      })
      .addCase(updatePaymentAllocationAmountThunk.fulfilled, (state) => {
        state.isSavingPayment = false;
      })
      .addCase(updatePaymentAllocationAmountThunk.rejected, (state) => {
        state.isSavingPayment = false;
      })
      .addCase(fetchRequesterPaymentSummary.pending, (state) => {
        state.requesterPaymentSummaryLoading = true;
        state.requesterPaymentSummaryError = null;
      })
      .addCase(fetchRequesterPaymentSummary.fulfilled, (state, action) => {
        state.requesterPaymentSummaryLoading = false;
        state.requesterPaymentSummary = action.payload;
      })
      .addCase(fetchRequesterPaymentSummary.rejected, (state, action) => {
        state.requesterPaymentSummaryLoading = false;
        state.requesterPaymentSummary = null;
        state.requesterPaymentSummaryError =
          (action.payload as string) ?? PAYMENT_GRID.ERRORS.LOAD_FAILED;
      })
      .addCase(fetchRequesterRefundablePayments.pending, (state) => {
        state.requesterRefundablePaymentsLoading = true;
        state.requesterRefundablePaymentsError = null;
      })
      .addCase(fetchRequesterRefundablePayments.fulfilled, (state, action) => {
        state.requesterRefundablePaymentsLoading = false;
        state.requesterRefundablePayments = action.payload;
      })
      .addCase(fetchRequesterRefundablePayments.rejected, (state, action) => {
        state.requesterRefundablePaymentsLoading = false;
        state.requesterRefundablePayments = null;
        state.requesterRefundablePaymentsError =
          (action.payload as string) ?? PAYMENT_GRID.ERRORS.LOAD_FAILED;
      })
      .addCase(fetchPaymentUnpaidInvoices.pending, (state) => {
        state.paymentUnpaidInvoicesLoading = true;
        state.paymentUnpaidInvoicesError = null;
      })
      .addCase(fetchPaymentUnpaidInvoices.fulfilled, (state, action) => {
        state.paymentUnpaidInvoicesLoading = false;
        state.paymentUnpaidInvoices = action.payload;
      })
      .addCase(fetchPaymentUnpaidInvoices.rejected, (state, action) => {
        state.paymentUnpaidInvoicesLoading = false;
        state.paymentUnpaidInvoices = null;
        state.paymentUnpaidInvoicesError =
          (action.payload as string) ?? PAYMENT_GRID.ERRORS.LOAD_FAILED;
      })
      .addCase(fetchPaymentDetail.pending, (state, action) => {
        if (action.meta.arg.forAllocations) return;
        state.paymentDetailLoading = true;
        state.paymentDetailError = null;
      })
      .addCase(fetchPaymentDetail.fulfilled, (state, action) => {
        if (action.meta.arg.forAllocations) return;
        state.paymentDetailLoading = false;
        state.paymentDetail = action.payload;
      })
      .addCase(fetchPaymentDetail.rejected, (state, action) => {
        if (action.meta.arg.forAllocations) return;
        state.paymentDetailLoading = false;
        state.paymentDetail = null;
        state.paymentDetailError = (action.payload as string) ?? PAYMENT_GRID.ERRORS.LOAD_FAILED;
      })
      .addCase(fetchPaymentReviewAllocations.pending, (state, action) => {
        state.paymentReviewAllocationsPaymentId = action.meta.arg.paymentId.trim();
        state.paymentReviewAllocations = null;
        state.paymentReviewAllocationsLoading = true;
        state.paymentReviewAllocationsError = null;
      })
      .addCase(fetchPaymentReviewAllocations.fulfilled, (state, action) => {
        if (
          action.meta.arg.paymentId.trim() !== state.paymentReviewAllocationsPaymentId
        ) {
          return;
        }
        state.paymentReviewAllocationsLoading = false;
        state.paymentReviewAllocations = action.payload;
      })
      .addCase(fetchPaymentReviewAllocations.rejected, (state, action) => {
        if (
          action.meta.arg.paymentId.trim() !== state.paymentReviewAllocationsPaymentId
        ) {
          return;
        }
        state.paymentReviewAllocationsLoading = false;
        state.paymentReviewAllocations = null;
        state.paymentReviewAllocationsError =
          (action.payload as string) ?? PAYMENT_GRID.ERRORS.LOAD_FAILED;
      })
      .addCase(allocatePaymentThunk.pending, (state) => {
        state.paymentAllocationSubmitting = true;
      })
      .addCase(allocatePaymentThunk.fulfilled, (state, action) => {
        state.paymentAllocationSubmitting = false;
        const result = action.payload as PaymentAllocateResponseDto;
        if (!state.paymentUnpaidInvoices) return;
        const nextApplied = result.totalPaid ?? state.paymentUnpaidInvoices.appliedAmount;
        const nextAvailable = result.remainingBalance ?? state.paymentUnpaidInvoices.availableAmount;
        state.paymentUnpaidInvoices = {
          ...state.paymentUnpaidInvoices,
          appliedAmount: nextApplied,
          availableAmount: nextAvailable,
        };
      })
      .addCase(allocatePaymentThunk.rejected, (state) => {
        state.paymentAllocationSubmitting = false;
      })
      .addCase(voidPaymentWithReasonThunk.fulfilled, (state, action) => {
        if (action.payload.scope !== 'allocation') return;
        if (!state.paymentReviewAllocations) return;
        state.paymentReviewAllocations = applyVoidAllocationBalances(
          state.paymentReviewAllocations,
          action.payload
        );
      });
  },
});

export const { clearPaymentReviewAllocations } = paymentSlice.actions;

export const selectPaymentsListState = (state: RootState) => ({
  payments: state.payment.payments,
  loading: state.payment.paymentsLoading,
  saving: state.payment.isSavingPayment,
});

/** Payments list grid rows (DTOs + requester names from requester slice). */
export const selectPaymentGridRows = (state: RootState): PaymentGridRow[] => {
  const requesterNameById = new Map<string, string>();
  for (const r of state.requester.requesters) {
    requesterNameById.set(String(r.requesterID), (r.name ?? r.requesterID ?? '').trim());
  }
  return mapPaymentsToGridRows(state.payment.payments, requesterNameById);
};

export const selectRequesterPaymentSummaryState = (state: RootState) => ({
  summary: state.payment.requesterPaymentSummary,
  loading: state.payment.requesterPaymentSummaryLoading,
  error: state.payment.requesterPaymentSummaryError,
});

export const selectRequesterRefundablePaymentsState = (state: RootState) => ({
  summary: state.payment.requesterRefundablePayments,
  loading: state.payment.requesterRefundablePaymentsLoading,
  error: state.payment.requesterRefundablePaymentsError,
});

export const selectPaymentUnpaidInvoicesState = (state: RootState) => ({
  view: state.payment.paymentUnpaidInvoices,
  loading: state.payment.paymentUnpaidInvoicesLoading,
  error: state.payment.paymentUnpaidInvoicesError,
  submitting: state.payment.paymentAllocationSubmitting,
});

export const selectPaymentDetailState = (state: RootState) => ({
  view: state.payment.paymentDetail,
  loading: state.payment.paymentDetailLoading,
  error: state.payment.paymentDetailError,
});

export const selectPaymentReviewAllocationsState = (state: RootState) => ({
  view: state.payment.paymentReviewAllocations,
  loading: state.payment.paymentReviewAllocationsLoading,
  error: state.payment.paymentReviewAllocationsError,
});

export default paymentSlice.reducer;
