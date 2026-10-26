import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants/tablePagination';
import {
  deleteInvoice,
  getAllInvoices,
  getInvoiceById,
  getInvoicesByProjectNumber,
  getRequesterInvoiceCounts,
  generateInvoice,
  getInvoiceDetailsByInvoicesId,
  getInvoicePaymentInformation,
  getInvoicePaymentSummary,
  getRequesterInvoiceDetails,
  getViewOriginalInvoiceDetailsByInvoiceId,
  getViewPreviousInvoiceDetails,
  undoInvoiceModification,
  updateInvoiceDetails,
  type GetAllInvoicesParams,
  type GenerateInvoiceParams,
} from '@/services/invoiceService';
import type {
  InvoiceDetailDto,
  InvoiceDto,
  InvoiceLogoDto,
  InvoicePaymentHistoryItemDto,
  InvoicePaymentInformationDto,
  InvoicePaymentSourceSummaryDto,
  InvoicePaymentSummaryDto,
  InvoiceSearchParams,
  RequesterInvoiceCountItem,
  RequesterInvoiceCountsParams,
  RequesterInvoicesCacheEntry,
  ViewOriginalInvoiceDetailsResponseDto,
} from '@/types/invoice';
import type { RequesterInvoiceDetailsApiResponse } from '@/types/requesterInvoiceDetails';
import { showToast } from './toastSlice';
import { INVOICE_GRID, PAYMENT_GRID } from '@/constants/strings';
import type { RootState } from '@/store';
import { apiGet } from '@/utils/apiClient';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';
import { expectOkReadText, parsePagedListJson } from '@/services/textPlainJson';
import { applyInvoiceRefundAllocations } from '@/services/paymentAllocationService';
import { voidPaymentWithReasonThunk } from './paymentAllocationSlice';
import {
  InvoiceRefundRequiredError,
  type InvoiceRefundActionResult,
  type InvoiceRefundAllocationsDto,
} from '@/types/invoice';

interface InvoiceState {
  invoices: InvoiceDto[];
  totalRecords: number;
  /** Requester headers for admin Requester Invoice page (counts only). */
  requesterInvoiceCounts: RequesterInvoiceCountItem[];
  requesterInvoiceCountsTotal: number;
  requesterInvoiceCountsLoading: boolean;
  requesterInvoiceCountsError: string | null;
  /** Invoices loaded per requester when an accordion is expanded. */
  invoicesByRequesterId: Record<string, RequesterInvoicesCacheEntry>;
  /** Invoices for a single project number (Daily Admin → project number). */
  requestInvoices: InvoiceDto[];
  requestInvoicesProjectNumber: string | null;
  requestInvoicesLoading: boolean;
  requestInvoicesError: string | null;
  currentInvoice: InvoiceDto | null;
  isLoading: boolean;
  isGenerating: boolean;
  isDeleting: boolean;
  error: string | null;
  viewOriginalDetails: ViewOriginalInvoiceDetailsResponseDto | null;
  viewOriginalLoading: boolean;
  viewOriginalError: string | null;
  viewPreviousItems: InvoiceDetailDto[] | null;
  viewPreviousLoading: boolean;
  viewPreviousError: string | null;
  invoiceDetailsItems: InvoiceDetailDto[];
  invoiceDetailsLogo: InvoiceLogoDto | null;
  invoiceDetailsLoading: boolean;
  invoiceDetailsError: string | null;
  invoiceDetailsIsUpdated: boolean;
  isModifyingInvoice: boolean;
  isUndoingModification: boolean;
  requesterInvoiceDetails: RequesterInvoiceDetailsApiResponse | null;
  requesterInvoiceDetailsLoading: boolean;
  requesterInvoiceDetailsError: string | null;
  requesterInvoiceDetailsRequesterId: string | null;
  invoicePayment: InvoicePaymentState;
  invoicePaymentSummary: InvoicePaymentSummaryState;
}

interface InvoicePaymentSummaryState {
  invoiceId: string | null;
  total: number;
  paidAmount: number;
  balanceDue: number;
  payments: InvoicePaymentSourceSummaryDto[];
  loading: boolean;
  submitting: boolean;
  error: string | null;
}

const initialInvoicePaymentSummary: InvoicePaymentSummaryState = {
  invoiceId: null,
  total: 0,
  paidAmount: 0,
  balanceDue: 0,
  payments: [],
  loading: false,
  submitting: false,
  error: null,
};

const applyInvoicePaymentSummaryDto = (
  state: InvoicePaymentSummaryState,
  invoiceId: string,
  dto: InvoicePaymentSummaryDto
) => {
  state.invoiceId = invoiceId;
  state.total = dto.total ?? 0;
  state.paidAmount = dto.paidAmount ?? 0;
  state.balanceDue = dto.balanceDue ?? 0;
  state.payments = dto.payments ?? [];
  state.error = null;
};

interface InvoicePaymentState {
  invoicesId: string | null;
  invoice: InvoiceDto | null;
  paymentHistory: InvoicePaymentHistoryItemDto[];
  remainingDue: number;
  paymentApplied: number;
  availableBalance: number;
  loading: boolean;
  discarding: boolean;
  error: string | null;
}

const initialInvoicePayment: InvoicePaymentState = {
  invoicesId: null,
  invoice: null,
  paymentHistory: [],
  remainingDue: 0,
  paymentApplied: 0,
  availableBalance: 0,
  loading: false,
  discarding: false,
  error: null,
};

const applyInvoicePaymentDto = (
  state: InvoicePaymentState,
  invoicesId: string,
  dto: InvoicePaymentInformationDto
) => {
  state.invoicesId = invoicesId;
  state.invoice = dto.invoice;
  state.paymentHistory = dto.paymentHistory ?? [];
  state.remainingDue = Math.max(0, dto.remainingDue ?? 0);
  state.paymentApplied = Math.max(0, dto.paymentApplied ?? dto.invoice?.paymentsApplied ?? 0);
  state.availableBalance = Math.max(0, dto.availableBalance ?? 0);
  state.error = null;
};

const initialState: InvoiceState = {
  invoices: [],
  totalRecords: 0,
  requesterInvoiceCounts: [],
  requesterInvoiceCountsTotal: 0,
  requesterInvoiceCountsLoading: false,
  requesterInvoiceCountsError: null,
  invoicesByRequesterId: {},
  requestInvoices: [],
  requestInvoicesProjectNumber: null,
  requestInvoicesLoading: false,
  requestInvoicesError: null,
  currentInvoice: null,
  isLoading: false,
  isGenerating: false,
  isDeleting: false,
  error: null,
  viewOriginalDetails: null,
  viewOriginalLoading: false,
  viewOriginalError: null,
  viewPreviousItems: null,
  viewPreviousLoading: false,
  viewPreviousError: null,
  invoiceDetailsItems: [],
  invoiceDetailsLogo: null,
  invoiceDetailsLoading: false,
  invoiceDetailsError: null,
  invoiceDetailsIsUpdated: false,
  isModifyingInvoice: false,
  isUndoingModification: false,
  requesterInvoiceDetails: null,
  requesterInvoiceDetailsLoading: false,
  requesterInvoiceDetailsError: null,
  requesterInvoiceDetailsRequesterId: null,
  invoicePayment: initialInvoicePayment,
  invoicePaymentSummary: initialInvoicePaymentSummary,
};

export const fetchRequesterInvoiceCounts = createAsyncThunk(
  'invoice/fetchRequesterInvoiceCounts',
  async (params: RequesterInvoiceCountsParams | undefined, { rejectWithValue, dispatch }) => {
    try {
      return await getRequesterInvoiceCounts(params);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to fetch requester invoice counts';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export interface FetchInvoicesByRequesterIdParams {
  requesterId: string;
  page?: number;
  pageSize?: number;
  isPaid?: boolean;
  /** Same searchTerm used by requester-invoice-counts when set. */
  searchTerm?: string | null;
  /** Same dueDateRangeDays used by requester-invoice-counts when set. */
  dueDateRangeDays?: number | null;
}

export const fetchInvoicesByRequesterId = createAsyncThunk(
  'invoice/fetchInvoicesByRequesterId',
  async (params: FetchInvoicesByRequesterIdParams, { rejectWithValue, dispatch }) => {
    const requesterId = params.requesterId.trim();
    const searchTerm = params.searchTerm?.trim() || null;
    const dueDateRangeDays = params.dueDateRangeDays ?? null;
    try {
      const { data, totalRecords } = await getAllInvoices({
        requesterId,
        page: params.page ?? 1,
        pageSize: params.pageSize ?? DEFAULT_TABLE_PAGE_SIZE,
        ...(params.isPaid != null ? { isPaid: params.isPaid } : {}),
        ...(searchTerm ? { searchTerm } : {}),
        ...(dueDateRangeDays != null ? { dueDateRangeDays } : {}),
      });
      return { requesterId, data, totalRecords };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to fetch invoices for requester';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue({ requesterId, message: errorMessage });
    }
  }
);

export const fetchInvoiceByIdThunk = createAsyncThunk(
  'invoice/fetchInvoiceById',
  async (invoicesId: string | number, { rejectWithValue, dispatch }) => {
    try {
      return await getInvoiceById(invoicesId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch invoice';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchInvoices = createAsyncThunk(
  'invoice/fetchInvoices',
  async (params: GetAllInvoicesParams | undefined, { rejectWithValue, dispatch }) => {
    try {
      const { data, totalRecords } = await getAllInvoices(params);
      return { data, totalRecords };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch invoices';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchInvoicesByProjectNumber = createAsyncThunk(
  'invoice/fetchInvoicesByProjectNumber',
  async (projectNumber: string, { rejectWithValue }) => {
    try {
      const data = await getInvoicesByProjectNumber(projectNumber);
      return { projectNumber: projectNumber.trim(), data };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to fetch invoices for project number';
      return rejectWithValue(errorMessage);
    }
  }
);

export const searchInvoicesThunk = createAsyncThunk(
  'invoice/searchInvoices',
  async (params: InvoiceSearchParams | undefined, { rejectWithValue, dispatch }) => {
    try {
      const queryParams = buildPaginationQueryParams(params);
      const searchTerm = params?.searchTerm?.trim();
      if (searchTerm) queryParams.append('searchTerm', searchTerm);
      const requesterId = params?.requesterId?.trim();
      if (requesterId) queryParams.append('requesterId', requesterId);
      if (params?.isPaid != null) {
        queryParams.append('isPaid', String(params.isPaid));
      }
      const endpoint = `/Invoice/search${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await apiGet(endpoint);
      const responseText = await expectOkReadText(response, 'Failed to search invoices');
      const { data, totalRecords } = parsePagedListJson(responseText, (row) => row as unknown as InvoiceDto);
      return { data, totalRecords };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to search invoices';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const deleteInvoiceThunk = createAsyncThunk(
  'invoice/deleteInvoice',
  async (invoicesId: string | number, { rejectWithValue, dispatch }) => {
    try {
      await deleteInvoice(invoicesId);
      dispatch(showToast('Invoice deleted successfully.', 'success'));
      return invoicesId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete invoice';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const generateInvoiceThunk = createAsyncThunk<
  InvoiceDto,
  GenerateInvoiceParams,
  { rejectValue: string }
>('invoice/generateInvoice', async (payload, { dispatch, rejectWithValue }) => {
  try {
    const result = await generateInvoice(payload);
    dispatch(showToast('Invoice generated successfully.', 'success'));
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate invoice.';
    dispatch(showToast(message, 'error'));
    return rejectWithValue(message);
  }
});

export const fetchInvoiceDetailsByInvoiceIdThunk = createAsyncThunk(
  'invoice/fetchInvoiceDetailsByInvoiceId',
  async (invoicesId: string, { rejectWithValue }) => {
    try {
      return await getInvoiceDetailsByInvoicesId(invoicesId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load invoice details.';
      return rejectWithValue(message);
    }
  }
);

export const fetchViewOriginalInvoiceDetailsThunk = createAsyncThunk<
  ViewOriginalInvoiceDetailsResponseDto,
  string,
  { rejectValue: string }
>('invoice/fetchViewOriginalDetails', async (invoicesId, { dispatch, rejectWithValue }) => {
  try {
    return await getViewOriginalInvoiceDetailsByInvoiceId(invoicesId);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load original invoice lines.';
    dispatch(showToast(message, 'error'));
    return rejectWithValue(message);
  }
});

export const fetchViewPreviousInvoiceDetailsThunk = createAsyncThunk<
  InvoiceDetailDto[],
  { invoicesId: string; currentInvoice: InvoiceDetailDto[] },
  { rejectValue: string }
>('invoice/fetchViewPreviousDetails', async ({ invoicesId, currentInvoice }, { dispatch, rejectWithValue }) => {
  try {
    const previousRows = await getViewPreviousInvoiceDetails(invoicesId);
    const previousByCurrentId = new Map<string, InvoiceDetailDto>();

    for (const row of previousRows) {
      const anchorId = row.currentInvoiceDetailId ?? row.CurrentInvoiceDetailId;
      if (anchorId != null) {
        previousByCurrentId.set(String(anchorId), row);
      }
    }

    const hasLoadedPrevious = currentInvoice.some(
      (anchor) =>
        anchor.invoiceDetailID != null &&
        previousByCurrentId.has(String(anchor.invoiceDetailID))
    );

    if (!hasLoadedPrevious) {
      throw new Error('Failed to load previous version.');
    }

    return currentInvoice.map((anchor) => {
      const anchorId = anchor.invoiceDetailID;
      if (anchorId == null) return anchor;
      return previousByCurrentId.get(String(anchorId)) ?? anchor;
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : INVOICE_GRID.TOAST.PREVIOUS_VERSION_FAILED;
    dispatch(showToast(message, 'error'));
    return rejectWithValue(message);
  }
});

export const modifyInvoiceDetailsThunk = createAsyncThunk<
  InvoiceRefundActionResult,
  { invoicesId: string; updates: InvoiceDetailDto[] },
  { rejectValue: string }
>('invoice/modifyInvoiceDetails', async ({ invoicesId, updates }, { dispatch, rejectWithValue }) => {
  try {
    if (updates.some((row) => row.invoiceDetailID == null)) {
      throw new Error('Missing invoice line item ID.');
    }

    await updateInvoiceDetails(updates);
    await dispatch(fetchInvoiceDetailsByInvoiceIdThunk(invoicesId)).unwrap();
    dispatch(showToast(INVOICE_GRID.TOAST.MODIFY_SUCCESS, 'success'));
    return { success: true };
  } catch (error) {
    if (error instanceof InvoiceRefundRequiredError) {
      return error.toFailure();
    }
    const message = error instanceof Error ? error.message : INVOICE_GRID.TOAST.MODIFY_FAILED;
    dispatch(showToast(message, 'error'));
    return rejectWithValue(message);
  }
});

export const undoInvoiceModificationThunk = createAsyncThunk<
  InvoiceRefundActionResult,
  string,
  { rejectValue: string }
>('invoice/undoInvoiceModification', async (invoicesId, { dispatch, rejectWithValue }) => {
  try {
    await undoInvoiceModification(invoicesId);
    dispatch(clearViewOriginalInvoiceDetails());
    dispatch(clearViewPreviousInvoiceDetails());
    await dispatch(fetchInvoiceDetailsByInvoiceIdThunk(invoicesId)).unwrap();
    dispatch(showToast(INVOICE_GRID.TOAST.UNDO_MODIFICATION_SUCCESS, 'success'));
    return { success: true };
  } catch (error) {
    if (error instanceof InvoiceRefundRequiredError) {
      return error.toFailure({ invoiceId: error.invoiceId ?? invoicesId });
    }
    const message =
      error instanceof Error ? error.message : INVOICE_GRID.TOAST.UNDO_MODIFICATION_FAILED;
    dispatch(showToast(message, 'error'));
    return rejectWithValue(message);
  }
});

export interface FetchRequesterInvoiceDetailsArgs {
  requesterId: string;
  requesterName?: string;
}

export const fetchRequesterInvoiceDetails = createAsyncThunk(
  'invoice/fetchRequesterInvoiceDetails',
  async ({ requesterId }: FetchRequesterInvoiceDetailsArgs, { rejectWithValue }) => {
    try {
      const trimmedRequesterId = requesterId.trim();
      if (!trimmedRequesterId) {
        throw new Error(PAYMENT_GRID.REQUESTER_INVOICE_DETAILS.ERRORS.REQUESTER_REQUIRED);
      }
      return await getRequesterInvoiceDetails(trimmedRequesterId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : PAYMENT_GRID.REQUESTER_INVOICE_DETAILS.ERRORS.LOAD_FAILED;
      return rejectWithValue(message);
    }
  }
);

export const fetchInvoicePaymentInformation = createAsyncThunk(
  'invoice/fetchInvoicePaymentInformation',
  async (invoicesId: string, { rejectWithValue, dispatch }) => {
    const trimmed = invoicesId.trim();
    if (!trimmed) {
      return rejectWithValue(INVOICE_GRID.PAYMENT.ERRORS.LOAD_FAILED);
    }
    try {
      return { invoicesId: trimmed, data: await getInvoicePaymentInformation(trimmed) };
    } catch (error) {
      const message = error instanceof Error ? error.message : INVOICE_GRID.PAYMENT.ERRORS.LOAD_FAILED;
      dispatch(showToast(INVOICE_GRID.PAYMENT.ERRORS.LOAD_FAILED, 'error'));
      return rejectWithValue(message);
    }
  }
);

export const fetchInvoicePaymentSummary = createAsyncThunk(
  'invoice/fetchInvoicePaymentSummary',
  async (invoiceId: string, { rejectWithValue, dispatch }) => {
    const trimmed = invoiceId.trim();
    if (!trimmed) {
      return rejectWithValue(INVOICE_GRID.PAYMENT.REFUND_PAYMENT_ALLOCATION.MISSING_INVOICE);
    }
    try {
      return { invoiceId: trimmed, data: await getInvoicePaymentSummary(trimmed) };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : INVOICE_GRID.PAYMENT.REFUND_PAYMENT_ALLOCATION.MISSING_INVOICE;
      dispatch(showToast(message, 'error'));
      return rejectWithValue(message);
    }
  }
);

export const applyInvoiceRefundAllocationsThunk = createAsyncThunk(
  'invoice/applyInvoiceRefundAllocations',
  async (payload: InvoiceRefundAllocationsDto, { rejectWithValue, dispatch }) => {
    const trimmedInvoiceId = payload.invoiceId.trim();
    if (!trimmedInvoiceId) {
      return rejectWithValue(INVOICE_GRID.PAYMENT.REFUND_PAYMENT_ALLOCATION.MISSING_INVOICE);
    }
    try {
      const data = await applyInvoiceRefundAllocations({
        ...payload,
        invoiceId: trimmedInvoiceId,
      });
      return { invoiceId: trimmedInvoiceId, data };
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : INVOICE_GRID.PAYMENT.REFUND_PAYMENT_ALLOCATION.REFUND_FAILED;
      dispatch(showToast(message, 'error'));
      return rejectWithValue(message);
    }
  }
);

const invoiceSlice = createSlice({
  name: 'invoice',
  initialState,
  reducers: {
    clearRequesterInvoiceDetails(state) {
      state.requesterInvoiceDetails = null;
      state.requesterInvoiceDetailsLoading = false;
      state.requesterInvoiceDetailsError = null;
      state.requesterInvoiceDetailsRequesterId = null;
    },
    clearInvoicePayment(state) {
      state.invoicePayment = { ...initialInvoicePayment };
    },
    clearInvoicePaymentSummary(state) {
      state.invoicePaymentSummary = { ...initialInvoicePaymentSummary };
    },
    clearViewOriginalInvoiceDetails: (state) => {
      state.viewOriginalDetails = null;
      state.viewOriginalLoading = false;
      state.viewOriginalError = null;
    },
    clearViewPreviousInvoiceDetails: (state) => {
      state.viewPreviousItems = null;
      state.viewPreviousLoading = false;
      state.viewPreviousError = null;
    },
    clearInvoicePreviewDetails: (state) => {
      state.invoiceDetailsItems = [];
      state.invoiceDetailsLogo = null;
      state.invoiceDetailsLoading = false;
      state.invoiceDetailsError = null;
      state.invoiceDetailsIsUpdated = false;
      state.viewOriginalDetails = null;
      state.viewOriginalLoading = false;
      state.viewOriginalError = null;
      state.viewPreviousItems = null;
      state.viewPreviousLoading = false;
      state.viewPreviousError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchInvoices.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchInvoices.fulfilled, (state, action) => {
        state.isLoading = false;
        state.invoices = action.payload.data ?? [];
        state.totalRecords = action.payload.totalRecords ?? 0;
        state.error = null;
      })
      .addCase(fetchInvoices.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchRequesterInvoiceCounts.pending, (state) => {
        state.requesterInvoiceCountsLoading = true;
        state.requesterInvoiceCountsError = null;
      })
      .addCase(fetchRequesterInvoiceCounts.fulfilled, (state, action) => {
        state.requesterInvoiceCountsLoading = false;
        state.requesterInvoiceCounts = action.payload.data ?? [];
        state.requesterInvoiceCountsTotal = action.payload.totalRecords ?? 0;
        state.requesterInvoiceCountsError = null;
        state.invoicesByRequesterId = {};
      })
      .addCase(fetchRequesterInvoiceCounts.rejected, (state, action) => {
        state.requesterInvoiceCountsLoading = false;
        state.requesterInvoiceCountsError = action.payload as string;
        state.requesterInvoiceCounts = [];
        state.requesterInvoiceCountsTotal = 0;
        state.invoicesByRequesterId = {};
      })
      .addCase(fetchInvoicesByRequesterId.pending, (state, action) => {
        const requesterId = action.meta.arg.requesterId.trim();
        const page = action.meta.arg.page ?? 1;
        const pageSize = action.meta.arg.pageSize ?? DEFAULT_TABLE_PAGE_SIZE;
        const prev = state.invoicesByRequesterId[requesterId];
        state.invoicesByRequesterId[requesterId] = {
          data: prev?.data ?? [],
          totalRecords: prev?.totalRecords ?? 0,
          page,
          pageSize,
          loading: true,
          error: null,
        };
      })
      .addCase(fetchInvoicesByRequesterId.fulfilled, (state, action) => {
        const { requesterId, data, totalRecords } = action.payload;
        const page = action.meta.arg.page ?? 1;
        const pageSize = action.meta.arg.pageSize ?? DEFAULT_TABLE_PAGE_SIZE;
        state.invoicesByRequesterId[requesterId] = {
          data: data ?? [],
          totalRecords: totalRecords ?? 0,
          page,
          pageSize,
          loading: false,
          error: null,
        };
      })
      .addCase(fetchInvoicesByRequesterId.rejected, (state, action) => {
        const payload = action.payload as { requesterId?: string; message?: string } | undefined;
        const requesterId =
          payload?.requesterId?.trim() || action.meta.arg.requesterId.trim();
        const page = action.meta.arg.page ?? 1;
        const pageSize = action.meta.arg.pageSize ?? DEFAULT_TABLE_PAGE_SIZE;
        state.invoicesByRequesterId[requesterId] = {
          data: [],
          totalRecords: 0,
          page,
          pageSize,
          loading: false,
          error: payload?.message ?? 'Failed to fetch invoices for requester',
        };
      })
      .addCase(fetchInvoiceByIdThunk.fulfilled, (state, action) => {
        state.currentInvoice = action.payload;
        state.error = null;
      })
      .addCase(fetchInvoicesByProjectNumber.pending, (state, action) => {
        state.requestInvoicesLoading = true;
        state.requestInvoicesError = null;
        state.requestInvoices = [];
        state.requestInvoicesProjectNumber = String(action.meta.arg ?? '').trim() || null;
      })
      .addCase(fetchInvoicesByProjectNumber.fulfilled, (state, action) => {
        const requestedPn = String(action.meta.arg ?? '').trim();
        if (requestedPn && action.payload.projectNumber !== requestedPn) {
          return;
        }
        state.requestInvoicesLoading = false;
        state.requestInvoicesProjectNumber = action.payload.projectNumber;
        state.requestInvoices = action.payload.data ?? [];
        state.requestInvoicesError = null;
      })
      .addCase(fetchInvoicesByProjectNumber.rejected, (state, action) => {
        state.requestInvoicesLoading = false;
        state.requestInvoicesError = action.payload as string;
        state.requestInvoices = [];
        state.requestInvoicesProjectNumber = String(action.meta.arg ?? '').trim() || null;
      })
      .addCase(searchInvoicesThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(searchInvoicesThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.invoices = action.payload.data ?? [];
        state.totalRecords = action.payload.totalRecords ?? 0;
        state.error = null;
      })
      .addCase(searchInvoicesThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(generateInvoiceThunk.pending, (state) => {
        state.isGenerating = true;
        state.error = null;
      })
      .addCase(generateInvoiceThunk.fulfilled, (state, action) => {
        state.isGenerating = false;
        state.currentInvoice = action.payload;
        state.error = null;
      })
      .addCase(generateInvoiceThunk.rejected, (state, action) => {
        state.isGenerating = false;
        state.error = action.payload ?? 'Failed to generate invoice.';
      })
      .addCase(deleteInvoiceThunk.pending, (state) => {
        state.isDeleting = true;
        state.error = null;
      })
      .addCase(deleteInvoiceThunk.fulfilled, (state, action) => {
        state.isDeleting = false;
        const deletedId = String(action.payload);
        state.invoices = state.invoices.filter((inv) => String(inv.invoicesID) !== deletedId);
        state.requestInvoices = state.requestInvoices.filter(
          (inv) => String(inv.invoicesID) !== deletedId
        );
        state.totalRecords = Math.max(0, state.totalRecords - 1);
        for (const requesterId of Object.keys(state.invoicesByRequesterId)) {
          const entry = state.invoicesByRequesterId[requesterId];
          const nextData = entry.data.filter((inv) => String(inv.invoicesID) !== deletedId);
          if (nextData.length !== entry.data.length) {
            state.invoicesByRequesterId[requesterId] = {
              ...entry,
              data: nextData,
              totalRecords: Math.max(0, entry.totalRecords - 1),
            };
            const countRow = state.requesterInvoiceCounts.find(
              (row) => row.requesterId === requesterId
            );
            if (countRow) {
              countRow.invoicesCount = Math.max(0, countRow.invoicesCount - 1);
            }
          }
        }
        if (state.currentInvoice && String(state.currentInvoice.invoicesID) === deletedId) {
          state.currentInvoice = null;
        }
        state.error = null;
      })
      .addCase(deleteInvoiceThunk.rejected, (state, action) => {
        state.isDeleting = false;
        state.error = action.payload as string;
      })
      .addCase(fetchViewOriginalInvoiceDetailsThunk.pending, (state) => {
        state.viewOriginalLoading = true;
        state.viewOriginalError = null;
      })
      .addCase(fetchViewOriginalInvoiceDetailsThunk.fulfilled, (state, action) => {
        state.viewOriginalLoading = false;
        state.viewOriginalDetails = action.payload;
        state.viewOriginalError = null;
      })
      .addCase(fetchViewOriginalInvoiceDetailsThunk.rejected, (state, action) => {
        state.viewOriginalLoading = false;
        state.viewOriginalError = (action.payload as string) ?? 'Failed to load original invoice lines.';
      })
      .addCase(fetchViewPreviousInvoiceDetailsThunk.pending, (state) => {
        state.viewPreviousLoading = true;
        state.viewPreviousError = null;
      })
      .addCase(fetchViewPreviousInvoiceDetailsThunk.fulfilled, (state, action) => {
        state.viewPreviousLoading = false;
        state.viewPreviousItems = action.payload;
        state.viewPreviousError = null;
      })
      .addCase(fetchViewPreviousInvoiceDetailsThunk.rejected, (state, action) => {
        state.viewPreviousLoading = false;
        state.viewPreviousError =
          (action.payload as string) ?? INVOICE_GRID.TOAST.PREVIOUS_VERSION_FAILED;
      })
      .addCase(fetchInvoiceDetailsByInvoiceIdThunk.pending, (state) => {
        state.invoiceDetailsLoading = true;
        state.invoiceDetailsError = null;
        state.invoiceDetailsIsUpdated = false;
      })
      .addCase(fetchInvoiceDetailsByInvoiceIdThunk.fulfilled, (state, action) => {
        state.invoiceDetailsLoading = false;
        state.invoiceDetailsItems = action.payload.items ?? [];
        state.invoiceDetailsLogo = action.payload.logo ?? null;
        state.invoiceDetailsIsUpdated = action.payload.isUpdated ?? false;
        state.invoiceDetailsError = null;
      })
      .addCase(fetchInvoiceDetailsByInvoiceIdThunk.rejected, (state, action) => {
        state.invoiceDetailsLoading = false;
        state.invoiceDetailsItems = [];
        state.invoiceDetailsLogo = null;
        state.invoiceDetailsIsUpdated = false;
        state.invoiceDetailsError = (action.payload as string) ?? 'Failed to load invoice details.';
      })
      .addCase(modifyInvoiceDetailsThunk.pending, (state) => {
        state.isModifyingInvoice = true;
      })
      .addCase(modifyInvoiceDetailsThunk.fulfilled, (state) => {
        state.isModifyingInvoice = false;
      })
      .addCase(modifyInvoiceDetailsThunk.rejected, (state) => {
        state.isModifyingInvoice = false;
      })
      .addCase(undoInvoiceModificationThunk.pending, (state) => {
        state.isUndoingModification = true;
      })
      .addCase(undoInvoiceModificationThunk.fulfilled, (state) => {
        state.isUndoingModification = false;
      })
      .addCase(undoInvoiceModificationThunk.rejected, (state) => {
        state.isUndoingModification = false;
      })
      .addCase(fetchRequesterInvoiceDetails.pending, (state, action) => {
        state.requesterInvoiceDetailsLoading = true;
        state.requesterInvoiceDetailsError = null;
        state.requesterInvoiceDetailsRequesterId = action.meta.arg.requesterId.trim();
      })
      .addCase(fetchRequesterInvoiceDetails.fulfilled, (state, action) => {
        state.requesterInvoiceDetailsLoading = false;
        state.requesterInvoiceDetails = action.payload;
      })
      .addCase(fetchRequesterInvoiceDetails.rejected, (state, action) => {
        state.requesterInvoiceDetailsLoading = false;
        state.requesterInvoiceDetails = null;
        state.requesterInvoiceDetailsError =
          (action.payload as string) ?? PAYMENT_GRID.REQUESTER_INVOICE_DETAILS.ERRORS.LOAD_FAILED;
      })
      .addCase(fetchInvoicePaymentInformation.pending, (state) => {
        state.invoicePayment.loading = true;
        state.invoicePayment.error = null;
      })
      .addCase(fetchInvoicePaymentInformation.fulfilled, (state, action) => {
        state.invoicePayment.loading = false;
        applyInvoicePaymentDto(state.invoicePayment, action.payload.invoicesId, action.payload.data);
      })
      .addCase(fetchInvoicePaymentInformation.rejected, (state, action) => {
        state.invoicePayment.loading = false;
        state.invoicePayment.error = (action.payload as string) ?? INVOICE_GRID.PAYMENT.ERRORS.LOAD_FAILED;
        state.invoicePayment.invoice = null;
        state.invoicePayment.paymentHistory = [];
        state.invoicePayment.remainingDue = 0;
        state.invoicePayment.paymentApplied = 0;
        state.invoicePayment.availableBalance = 0;
      })
      .addCase(voidPaymentWithReasonThunk.pending, (state, action) => {
        if (action.meta.arg.scope === 'invoicePayment') {
          state.invoicePayment.discarding = true;
        }
      })
      .addCase(voidPaymentWithReasonThunk.fulfilled, (state, action) => {
        if (action.payload.scope !== 'invoicePayment') return;
        state.invoicePayment.discarding = false;
        applyInvoicePaymentDto(state.invoicePayment, action.payload.invoicesId, action.payload.data);
        applyInvoicePaymentSummaryDto(
          state.invoicePaymentSummary,
          action.payload.invoicesId,
          action.payload.summary
        );
      })
      .addCase(voidPaymentWithReasonThunk.rejected, (state, action) => {
        if (action.meta.arg.scope === 'invoicePayment') {
          state.invoicePayment.discarding = false;
        }
      })
      .addCase(fetchInvoicePaymentSummary.pending, (state) => {
        state.invoicePaymentSummary.loading = true;
        state.invoicePaymentSummary.error = null;
      })
      .addCase(fetchInvoicePaymentSummary.fulfilled, (state, action) => {
        state.invoicePaymentSummary.loading = false;
        applyInvoicePaymentSummaryDto(
          state.invoicePaymentSummary,
          action.payload.invoiceId,
          action.payload.data
        );
      })
      .addCase(fetchInvoicePaymentSummary.rejected, (state, action) => {
        state.invoicePaymentSummary.loading = false;
        state.invoicePaymentSummary.error =
          (action.payload as string) ?? INVOICE_GRID.PAYMENT.REFUND_PAYMENT_ALLOCATION.MISSING_INVOICE;
        state.invoicePaymentSummary.invoiceId = null;
        state.invoicePaymentSummary.total = 0;
        state.invoicePaymentSummary.paidAmount = 0;
        state.invoicePaymentSummary.balanceDue = 0;
        state.invoicePaymentSummary.payments = [];
      })
      .addCase(applyInvoiceRefundAllocationsThunk.pending, (state) => {
        state.invoicePaymentSummary.submitting = true;
        state.invoicePaymentSummary.error = null;
      })
      .addCase(applyInvoiceRefundAllocationsThunk.fulfilled, (state, action) => {
        state.invoicePaymentSummary.submitting = false;
        applyInvoicePaymentSummaryDto(
          state.invoicePaymentSummary,
          action.payload.invoiceId,
          action.payload.data
        );
      })
      .addCase(applyInvoiceRefundAllocationsThunk.rejected, (state, action) => {
        state.invoicePaymentSummary.submitting = false;
        state.invoicePaymentSummary.error =
          (action.payload as string) ?? INVOICE_GRID.PAYMENT.REFUND_PAYMENT_ALLOCATION.REFUND_FAILED;
      });
  },
});

export const {
  clearRequesterInvoiceDetails,
  clearInvoicePayment,
  clearInvoicePaymentSummary,
  clearViewOriginalInvoiceDetails,
  clearViewPreviousInvoiceDetails,
  clearInvoicePreviewDetails,
} = invoiceSlice.actions;

export const selectRequesterInvoiceDetailsState = (state: RootState) => ({
  view: state.invoice.requesterInvoiceDetails,
  loading: state.invoice.requesterInvoiceDetailsLoading,
  error: state.invoice.requesterInvoiceDetailsError,
});

export const selectInvoicePaymentState = (state: RootState) => state.invoice.invoicePayment;

export const selectInvoicePaymentSummaryState = (state: RootState) => state.invoice.invoicePaymentSummary;

export default invoiceSlice.reducer;
