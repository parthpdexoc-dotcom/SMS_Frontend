import { apiGet, apiPost } from '@/utils/apiClient';
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants/tablePagination';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';
import { expectOkReadText, parseJsonText, readResponseOk } from '@/services/textPlainJson';
import type {
  RefundPaymentAllocateDto,
  RefundPaymentAllocatePayload,
  RefundPaymentAllocateResponseDto,
  RequesterRefundPaymentSummaryResponseDto,
} from '@/types/payment';
import { combineDateAndTime } from '@/utils/dateTimeUtils';

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000';

/** GET /RefundPayment/requester-refund-summary — requester refunds + summary for date range. */
export const getRequesterRefundSummary = async (
  requesterId: string,
  startDate?: string | null,
  endDate?: string | null,
  page = 1,
  pageSize = DEFAULT_TABLE_PAGE_SIZE
): Promise<RequesterRefundPaymentSummaryResponseDto> => {
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

  const response = await apiGet(`/RefundPayment/requester-refund-summary?${queryParams.toString()}`);
  const text = await expectOkReadText(response, 'Failed to load requester refunds.');
  return parseJsonText<RequesterRefundPaymentSummaryResponseDto>(text);
};

/** POST /RefundPayment/allocate — refund escrow from one or more payments. */
export const allocateRefundPayment = async (
  payload: RefundPaymentAllocatePayload
): Promise<RefundPaymentAllocateResponseDto> => {
  const totalAmount = payload.payments.reduce((sum, item) => sum + item.amount, 0);
  const body: RefundPaymentAllocateDto = {
    refundPayment: {
      refundPaymentID: EMPTY_GUID,
      requesterID: payload.requesterID.trim(),
      amount: totalAmount,
      paymentDate: combineDateAndTime(payload.paymentDate.trim(), '12:00') ?? new Date().toISOString(),
      referenceNumber: (payload.referenceNumber ?? '').trim() || null,
      paymentTypeId: payload.paymentTypeId,
    },
    payments: payload.payments.map((item) => ({
      paymentId: item.paymentId.trim(),
      amount: item.amount,
    })),
  };

  const response = await apiPost('/RefundPayment/allocate', body, {
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
  });
  const text = await readResponseOk(response, 'Failed to process refund.');
  return parseJsonText<RefundPaymentAllocateResponseDto>(text);
};

/** POST /RefundPayment/{refundPaymentId}/delete — soft-delete refund with reason (credits allocations, ledger). */
export const deleteRefundPayment = async (refundPaymentId: string, reason: string): Promise<void> => {
  const id = encodeURIComponent(refundPaymentId.trim());
  const response = await apiPost(
    `/RefundPayment/${id}/delete`,
    { reason: reason.trim() },
    { headers: { 'Content-Type': 'application/json', accept: '*/*' } }
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Failed to delete refund.');
  }
};
