import { apiDelete, apiGet, apiPost, apiPut } from '@/utils/apiClient';
import { expectOkReadText, parseJsonText, parseJsonTextArray, parsePagedListJson, readResponseOk, readResponseOkOrInvoiceRefund } from '@/services/textPlainJson';
import { buildPageParamBody, buildPaginationQueryParams } from '@/utils/paginationUtils';
import type {
  InvoiceDetailDto,
  InvoiceDto,
  InvoiceDetailsResponseDto,
  InvoicePaymentInformationDto,
  ViewOriginalInvoiceDetailsResponseDto,
  InvoicePaymentSummaryDto,
  InvoicePaymentSourceSummaryDto,
  RequesterInvoiceCountsParams,
  RequesterInvoiceCountsResponse,
} from '@/types/invoice';
import type { RequesterInvoiceDetailsApiResponse } from '@/types/requesterInvoiceDetails';

export interface GetAllInvoicesParams {
  /** Requester ID (Guid string) */
  requesterId?: string | null;
  /** true = paid, false = unpaid; omit for all invoices */
  isPaid?: boolean;
  /** Same searchTerm as POST /Invoice/requester-invoice-counts when set */
  searchTerm?: string | null;
  /** Due-date range in days (30, 60, or 90); same as requester-invoice-counts when set */
  dueDateRangeDays?: number | null;
  page?: number;
  pageSize?: number;
}

/**
 * Invoice API Service
 * GET /Invoice/by-requester — PagedList; optional requesterId, isPaid, searchTerm, page, pageSize.
 */
export const getAllInvoices = async (
  params?: GetAllInvoicesParams
): Promise<{ data: InvoiceDto[]; totalRecords: number }> => {
  const queryParams = buildPaginationQueryParams(
    params?.page != null || params?.pageSize != null
      ? { page: params.page, pageSize: params.pageSize }
      : undefined
  );
  if (params?.requesterId?.trim()) {
    queryParams.append('requesterId', params.requesterId.trim());
  }
  if (params?.isPaid != null) {
    queryParams.append('isPaid', String(params.isPaid));
  }
  const searchTerm = params?.searchTerm?.trim();
  if (searchTerm) {
    queryParams.append('searchTerm', searchTerm);
  }
  if (params?.dueDateRangeDays != null) {
    queryParams.append('dueDateRangeDays', String(params.dueDateRangeDays));
  }
  const queryString = queryParams.toString();
  const endpoint = queryString ? `/Invoice/by-requester?${queryString}` : '/Invoice/by-requester';

  const response = await apiGet(endpoint);
  const responseText = await expectOkReadText(response, 'Failed to fetch invoices');
  return parsePagedListJson(responseText, (row) => row as unknown as InvoiceDto);
};

/**
 * GET /Invoice/invoice-by-projectNumber?projectNumber= — invoices for a request project number.
 */
export const getInvoicesByProjectNumber = async (projectNumber: string): Promise<InvoiceDto[]> => {
  const pn = String(projectNumber).trim();
  if (!pn) return [];
  const params = new URLSearchParams({ projectNumber: pn });
  const response = await apiGet(`/Invoice/invoice-by-projectNumber?${params.toString()}`);
  const responseText = await response.text();
  if (response.status === 404) return [];
  if (!response.ok) {
    throw new Error(`Failed to fetch invoices for project number: ${response.status} ${responseText}`);
  }
  const parsed = parseJsonText<unknown>(responseText);
  if (Array.isArray(parsed)) return parsed as InvoiceDto[];
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    const arr = (obj.data ?? obj.Data ?? obj.items ?? obj.Items) as unknown;
    if (Array.isArray(arr)) return arr as InvoiceDto[];
  }
  return parseJsonTextArray<InvoiceDto>(responseText);
};

/**
 * POST /Invoice/requester-invoice-counts — requesters with invoice counts (admin list headers).
 */
export const getRequesterInvoiceCounts = async (
  params?: RequesterInvoiceCountsParams
): Promise<RequesterInvoiceCountsResponse> => {
  const body: Record<string, unknown> = {
    isPaid: params?.isPaid ?? null,
  };
  const pageParam = buildPageParamBody({
    page: params?.page,
    pageSize: params?.pageSize,
  });
  if (pageParam) body.pageParam = pageParam;

  const requesterId = params?.requesterId?.trim();
  if (requesterId) body.requesterId = requesterId;

  const searchTerm = params?.searchTerm?.trim();
  if (searchTerm) body.searchTerm = searchTerm;

  if (params?.dueDateRangeDays != null) {
    body.dueDateRangeDays = params.dueDateRangeDays;
  }

  const response = await apiPost('/Invoice/requester-invoice-counts', body, {
    headers: { 'Content-Type': 'application/json' },
  });
  const responseText = await expectOkReadText(response, 'Failed to fetch requester invoice counts');
  return parseJsonText<RequesterInvoiceCountsResponse>(responseText);
};

/**
 * GET /Invoice/{invoicesId} — invoice header for view/preview.
 */
export const getInvoiceById = async (invoicesId: string | number): Promise<InvoiceDto> => {
  const id = encodeURIComponent(String(invoicesId).trim());
  const response = await apiGet(`/Invoice/${id}`);
  const text = await expectOkReadText(response, 'Failed to fetch invoice');
  return parseJsonText<InvoiceDto>(text);
};

/**
 * GET /Invoice/by-requester/details — summary + invoice list for requester payment details modal.
 * @param isPaid optional filter; omit for all invoices
 */
export const getRequesterInvoiceDetails = async (
  requesterId: string,
  isPaid?: boolean
): Promise<RequesterInvoiceDetailsApiResponse> => {
  const params = new URLSearchParams();
  params.append('requesterId', requesterId.trim());
  if (isPaid != null) {
    params.append('isPaid', String(isPaid));
  }

  const response = await apiGet(`/Invoice/by-requester/details?${params.toString()}`);
  const responseText = await expectOkReadText(response, 'Failed to fetch requester invoice details');
  return parseJsonText<RequesterInvoiceDetailsApiResponse>(responseText);
};

/**
 * GET /Invoice/{invoicesId}/payment-information — invoice summary, payment history, balances.
 */
export const getInvoicePaymentInformation = async (
  invoicesId: string
): Promise<InvoicePaymentInformationDto> => {
  const id = encodeURIComponent(String(invoicesId).trim());
  const response = await apiGet(`/Invoice/${id}/payment-information`);
  const text = await expectOkReadText(response, 'Failed to fetch invoice payment information');
  return parseJsonText<InvoicePaymentInformationDto>(text);
};

const mapPaymentSourceSummary = (raw: Record<string, unknown>): InvoicePaymentSourceSummaryDto => ({
  paymentId: String(raw.paymentId ?? raw.paymentID ?? raw.PaymentId ?? raw.PaymentID ?? '').trim(),
  paymentNumber:
    (raw.paymentNumber ?? raw.PaymentNumber ?? null) as string | null | undefined,
  paymentDate: (raw.paymentDate ?? raw.PaymentDate ?? null) as string | null | undefined,
  paymentTypeId: (raw.paymentTypeId ?? raw.PaymentTypeID ?? raw.paymentTypeID ?? null) as
    | string
    | null
    | undefined,
  paymentTypeName: (raw.paymentTypeName ?? raw.PaymentTypeName ?? null) as
    | string
    | null
    | undefined,
  referenceNumber:
    (raw.referenceNumber ?? raw.ReferenceNumber ?? null) as string | null | undefined,
  paymentAmount:
    raw.paymentAmount != null || raw.PaymentAmount != null
      ? Number(raw.paymentAmount ?? raw.PaymentAmount)
      : null,
  paidAmount: Number(raw.paidAmount ?? raw.PaidAmount ?? raw.amountApplied ?? raw.AmountApplied ?? 0) || 0,
});

/**
 * GET /Invoice/{invoiceId}/payment-summary — totals and net applied amount per payment.
 */
export const getInvoicePaymentSummary = async (
  invoiceId: string
): Promise<InvoicePaymentSummaryDto> => {
  const id = encodeURIComponent(String(invoiceId).trim());
  const response = await apiGet(`/Invoice/${id}/payment-summary`);
  const text = await expectOkReadText(response, 'Failed to fetch invoice payment summary');
  const raw = parseJsonText<Record<string, unknown>>(text);
  const paymentsRaw = (raw.payments ?? raw.Payments ?? []) as Record<string, unknown>[];
  return {
    invoiceId: String(raw.invoiceId ?? raw.InvoiceId ?? raw.invoiceID ?? invoiceId).trim(),
    total: Number(raw.total ?? raw.Total ?? 0) || 0,
    paidAmount: Number(raw.paidAmount ?? raw.PaidAmount ?? 0) || 0,
    balanceDue: Number(raw.balanceDue ?? raw.BalanceDue ?? 0) || 0,
    payments: paymentsRaw.map(mapPaymentSourceSummary).filter((p) => p.paymentId),
  };
};

/**
 * POST /Invoice/{invoiceId}/payment/{paymentId}/void — void all allocations for this payment on the invoice.
 */
export const voidInvoicePayment = async (
  invoiceId: string,
  paymentId: string,
  reason: string
): Promise<InvoicePaymentInformationDto> => {
  const trimmedInvoiceId = String(invoiceId).trim();
  const trimmedPaymentId = String(paymentId).trim();
  const invoice = encodeURIComponent(trimmedInvoiceId);
  const payment = encodeURIComponent(trimmedPaymentId);
  const response = await apiPost(
    `/Invoice/${invoice}/payment/${payment}/void`,
    { reason: reason.trim() },
    { headers: { 'Content-Type': 'application/json', accept: '*/*' } }
  );
  const text = await expectOkReadText(response, 'Failed to discard payment');
  return parseJsonText<InvoicePaymentInformationDto>(text);
};

/**
 * Fetches invoice details (line items) and optional logo for a given invoice.
 * Backend returns { items, logo?, isUpdated }.
 * GET /InvoiceDetail/invoice/{invoicesId:guid}
 */
export const getInvoiceDetailsByInvoicesId = async (
  invoicesId: string | number
): Promise<InvoiceDetailsResponseDto> => {
  const id = encodeURIComponent(String(invoicesId));
  const response = await apiGet(`/InvoiceDetail/invoice/${id}`);
  const responseText = await expectOkReadText(response, 'Failed to fetch invoice details');
  return parseJsonText<InvoiceDetailsResponseDto>(responseText);
};

/**
 * Original billing lines only (financial impact none) with closed post work schedule; includes summary totals from the invoice header.
 * GET /InvoiceDetail/invoice/{invoicesId}/view-original
 */
export const getViewOriginalInvoiceDetailsByInvoiceId = async (
  invoicesId: string | number
): Promise<ViewOriginalInvoiceDetailsResponseDto> => {
  const id = encodeURIComponent(String(invoicesId));
  const response = await apiGet(`/InvoiceDetail/invoice/${id}/view-original`);
  const responseText = await expectOkReadText(response, 'Failed to fetch original invoice details');
  return parseJsonText<ViewOriginalInvoiceDetailsResponseDto>(responseText);
};

/**
 * Read-only prior versions for invoice lines (no database changes).
 * GET /InvoiceDetail/invoice/{invoicesId}/view-previous — returns InvoiceDetailDto[] with
 * currentInvoiceDetailId on each item (match to the current line).
 */
export const getViewPreviousInvoiceDetails = async (
  invoicesId: string | number
): Promise<InvoiceDetailDto[]> => {
  const id = encodeURIComponent(String(invoicesId).trim());
  const response = await apiGet(`/InvoiceDetail/invoice/${id}/view-previous`);
  const responseText = await expectOkReadText(response, 'Failed to load previous invoice lines');
  return parseJsonText<InvoiceDetailDto[]>(responseText);
};

export interface GenerateInvoiceParams {
  projectNumber: string | string[];
  startDate: string;
  endDate: string;
}

interface InvoiceSuccessResult {
  status?: number;
  message?: string;
  data?: InvoiceDto | InvoiceDto[] | null;
  Status?: number;
  Message?: string;
  Data?: InvoiceDto | InvoiceDto[] | null;
}

const HTTP_NOT_FOUND = 404;

export const generateInvoice = async (params: GenerateInvoiceParams): Promise<InvoiceDto> => {
  const { projectNumber, startDate, endDate } = params;

  const searchParams = new URLSearchParams({
    startDate,
    endDate,
  });
  const projectNumbers = Array.isArray(projectNumber) ? projectNumber : [projectNumber];
  projectNumbers.map((value) => value.trim()).filter(Boolean).forEach((value) => searchParams.append('projectNumber', value));

  const response = await apiPost(
    `/InvoiceDetail/generate-invoice?${searchParams.toString()}`,
    undefined
  );
  const text = await response.text();

  if (!text?.trim()) {
    throw new Error('No invoice data found for the given criteria.');
  }

  const parsed = parseJsonText<InvoiceSuccessResult>(text);
  const status = parsed.status ?? parsed.Status ?? (response.ok ? 200 : response.status);
  const message = (parsed.message ?? parsed.Message ?? '').trim();
  const data = parsed.data ?? parsed.Data ?? null;

  if (status === HTTP_NOT_FOUND || !response.ok) {
    throw new Error(message || 'No invoice data found for the given criteria.');
  }

  const invoice = Array.isArray(data) ? data[0] : data;
  if (!invoice) {
    throw new Error('No invoice data returned from server.');
  }

  return invoice;
};

/**
 * PUT /InvoiceDetail — batch update all line items for modify invoice.
 * When any row is edited, send every line item in the payload (including unchanged rows).
 */
export const updateInvoiceDetails = async (
  payload: InvoiceDetailDto[]
): Promise<InvoiceDetailDto[]> => {
  const response = await apiPut('/InvoiceDetail', payload);
  const responseText = await readResponseOkOrInvoiceRefund(response, 'Failed to update invoice');
  const parsed = parseJsonText<InvoiceDetailDto[]>(responseText);
  return Array.isArray(parsed) ? parsed : [];
};

/**
 * DELETE /InvoiceDetail — undo all invoice modifications (passes invoice ID only).
 */
export const undoInvoiceModification = async (invoicesId: string | number): Promise<void> => {
  const response = await apiDelete('/InvoiceDetail', {
    body: JSON.stringify(String(invoicesId)),
    headers: { accept: '*/*' },
  });
  await readResponseOkOrInvoiceRefund(response, 'Failed to undo invoice modification');
};

/**
 * DELETE /Invoice/{invoicesId}
 */
export const deleteInvoice = async (invoicesId: string | number): Promise<void> => {
  const id = encodeURIComponent(String(invoicesId));
  const response = await apiDelete(`/Invoice/${id}`, {
    headers: { accept: '*/*' },
  });
  await readResponseOk(response, 'Failed to delete invoice');
};
