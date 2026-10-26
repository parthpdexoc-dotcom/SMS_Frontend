import { apiGet, apiPost } from '@/utils/apiClient';
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants/tablePagination';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';
import {
  expectOkReadText,
  parseJsonText,
  parsePagedListJson,
  readResponseOk,
} from '@/services/textPlainJson';
import type {
  PaymentAdjustAllocationsDto,
  PaymentAllocateDto,
  PaymentAllocateResponseDto,
  CreateRequesterPaymentPayload,
  PaymentDetailResponseDto,
  PaymentDto,
  PaymentReviewAllocationsResponseDto,
  PaymentUnpaidInvoicesResponseDto,
  RequesterPaymentSummaryResponseDto,
} from '@/types/payment';
import { coalesceKeyedRequest } from '@/utils/coalesceKeyedRequest';
import { combineDateAndTime } from '@/utils/dateTimeUtils';

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000';

/** GET /Payment — all payments for the payments grid. */
export const getAllPayments = (): Promise<PaymentDto[]> =>
  coalesceKeyedRequest('payment', 'getAll', async () => {
    const queryParams = buildPaginationQueryParams({ page: 1, pageSize: 10000 });
    const response = await apiGet(`/Payment?${queryParams.toString()}`);
    const text = await expectOkReadText(response, 'Failed to fetch payments');
    const { data } = parsePagedListJson(text, (row) => row as unknown as PaymentDto);
    return data;
  });

export const getRequesterPaymentSummary = async (
  requesterId: string,
  startDate?: string | null,
  endDate?: string | null,
  page = 1,
  pageSize = DEFAULT_TABLE_PAGE_SIZE
): Promise<RequesterPaymentSummaryResponseDto> => {
  const queryParams = buildPaginationQueryParams({ page, pageSize });
  queryParams.set('requesterId', requesterId.trim());
  const trimmedStartDate = startDate?.trim();
  const trimmedEndDate = endDate?.trim();
  if (trimmedStartDate) {
    queryParams.set('startDate', trimmedStartDate);
  }
  if (trimmedEndDate) {
    queryParams.set('endDate', trimmedEndDate);
  }

  const response = await apiGet(`/Payment/requester-payment-summary?${queryParams.toString()}`);
  const text = await expectOkReadText(response, 'Failed to load requester payments.');
  return parseJsonText<RequesterPaymentSummaryResponseDto>(text);
};

/** GET /Payment/requester-refundable-payments — payments with escrow balance available to refund. */
export const getRequesterRefundablePayments = async (
  requesterId: string,
  page = 1,
  pageSize = DEFAULT_TABLE_PAGE_SIZE
): Promise<RequesterPaymentSummaryResponseDto> => {
  const queryParams = buildPaginationQueryParams({ page, pageSize });
  queryParams.set('requesterId', requesterId.trim());

  const response = await apiGet(`/Payment/requester-refundable-payments?${queryParams.toString()}`);
  const text = await expectOkReadText(response, 'Failed to load refundable payments.');
  return parseJsonText<RequesterPaymentSummaryResponseDto>(text);
};

/** GET /Payment/{paymentId}/unpaid-invoices — payment-specific unpaid invoice list. */
export const getPaymentUnpaidInvoices = async (
  paymentId: string,
  requesterId: string,
  page = 1,
  pageSize = DEFAULT_TABLE_PAGE_SIZE
): Promise<PaymentUnpaidInvoicesResponseDto> => {
  const queryParams = buildPaginationQueryParams({ page, pageSize });
  queryParams.set('requesterId', requesterId.trim());
  const response = await apiGet(
    `/Payment/${encodeURIComponent(paymentId.trim())}/unpaid-invoices?${queryParams.toString()}`
  );
  const text = await expectOkReadText(response, 'Failed to load unpaid invoices for payment.');
  return parseJsonText<PaymentUnpaidInvoicesResponseDto>(text);
};

/** GET /Payment/{paymentId}/review-allocations — payment balances and active allocations for review. */
export const getPaymentReviewAllocations = async (
  paymentId: string,
  page = 1,
  pageSize = DEFAULT_TABLE_PAGE_SIZE
): Promise<PaymentReviewAllocationsResponseDto> => {
  const queryParams = buildPaginationQueryParams({ page, pageSize });
  const response = await apiGet(
    `/Payment/${encodeURIComponent(paymentId.trim())}/review-allocations?${queryParams.toString()}`
  );
  const text = await expectOkReadText(response, 'Failed to load payment allocations for review.');
  return parseJsonText<PaymentReviewAllocationsResponseDto>(text);
};

/** GET /Payment/{paymentId}/detail — read-only payment invoice details grid. */
export const getPaymentDetail = async (
  paymentId: string,
  page = 1,
  pageSize = DEFAULT_TABLE_PAGE_SIZE
): Promise<PaymentDetailResponseDto> => {
  const queryParams = buildPaginationQueryParams({ page, pageSize });
  const response = await apiGet(
    `/Payment/${encodeURIComponent(paymentId.trim())}/detail?${queryParams.toString()}`
  );
  const text = await expectOkReadText(response, 'Failed to load payment details.');
  return parseJsonText<PaymentDetailResponseDto>(text);
};

/** POST /Payment/allocate — allocate one payment to one or more invoices. */
export const allocatePayment = async (
  payload: PaymentAllocateDto
): Promise<PaymentAllocateResponseDto> => {
  const response = await apiPost('/Payment/allocate', payload, {
    headers: { 'Content-Type': 'application/json-patch+json', accept: '*/*' },
  });
  const text = await readResponseOk(response, 'Failed to allocate payment.');
  return parseJsonText<PaymentAllocateResponseDto>(text);
};

/** POST /Payment only — used by the payments list add form. */
export const createRequesterPayment = async (
  payload: CreateRequesterPaymentPayload
): Promise<PaymentDto> => {
  const paymentBody: PaymentDto = {
    paymentID: EMPTY_GUID,
    requesterID: payload.requesterID,
    amount: payload.amount,
    paymentDate: combineDateAndTime(payload.paymentDate.trim(), '12:00') ?? new Date().toISOString(),
    referenceNumber: (payload.referenceNumber ?? '').trim() || null,
    paymentTypeId: payload.paymentTypeId,
  };

  const paymentResponse = await apiPost('/Payment', paymentBody, {
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
  });
  const paymentText = await readResponseOk(paymentResponse, 'Failed to record payment');
  const created = parseJsonText<PaymentDto>(paymentText);
  if (!created.paymentID) {
    throw new Error('Payment was created but no payment ID was returned.');
  }

  return created;
};

/** POST /Payment/adjust-allocations */
export const adjustPaymentAllocations = async (
  payload: PaymentAdjustAllocationsDto
): Promise<{ response: Response; text: string }> => {
  const response = await apiPost('/Payment/adjust-allocations', payload, {
    headers: { 'Content-Type': 'application/json-patch+json', accept: 'text/plain' },
  });
  const text = await response.text();
  return { response, text };
};

/** POST /Payment/{paymentId}/delete — soft-delete payment with reason (ledger reversal). */
export const deletePayment = async (paymentId: string, reason: string): Promise<void> => {
  const id = encodeURIComponent(paymentId.trim());
  const response = await apiPost(
    `/Payment/${id}/delete`,
    { reason: reason.trim() },
    { headers: { 'Content-Type': 'application/json', accept: '*/*' } }
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Failed to delete payment.');
  }
};
