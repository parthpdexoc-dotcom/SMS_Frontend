import { apiGet, apiPost } from '@/utils/apiClient';
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants/tablePagination';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';
import { expectOkReadText, parseJsonText } from '@/services/textPlainJson';
import type { RefundPaymentAllocationHistoryResponseDto, RefundPaymentAllocationsResponseDto } from '@/types/payment';

/** GET /RefundPayment/{refundPaymentId}/allocations — refund allocation details. */
export const getRefundPaymentAllocations = async (
  refundPaymentId: string,
  page = 1,
  pageSize = DEFAULT_TABLE_PAGE_SIZE
): Promise<RefundPaymentAllocationsResponseDto> => {
  const queryParams = buildPaginationQueryParams({ page, pageSize });
  const response = await apiGet(
    `/RefundPayment/${encodeURIComponent(refundPaymentId.trim())}/allocations?${queryParams.toString()}`
  );
  const text = await expectOkReadText(response, 'Failed to load refund allocations.');
  return parseJsonText<RefundPaymentAllocationsResponseDto>(text);
};

/** GET /RefundPayment/{refundPaymentId}/allocation-history — full refund allocation history. */
export const getRefundPaymentAllocationHistory = async (
  refundPaymentId: string
): Promise<RefundPaymentAllocationHistoryResponseDto> => {
  const response = await apiGet(
    `/RefundPayment/${encodeURIComponent(refundPaymentId.trim())}/allocation-history`
  );
  const text = await expectOkReadText(response, 'Failed to load refund allocation history.');
  return parseJsonText<RefundPaymentAllocationHistoryResponseDto>(text);
};

/** POST /RefundPaymentAllocation/{id}/void — discard a single refund allocation with reason. */
export const voidRefundPaymentAllocation = async (
  refundPaymentAllocationId: string,
  reason: string
): Promise<void> => {
  const id = encodeURIComponent(refundPaymentAllocationId.trim());
  const response = await apiPost(
    `/RefundPaymentAllocation/${id}/void`,
    { reason: reason.trim() },
    { headers: { 'Content-Type': 'application/json', accept: '*/*' } }
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Failed to void refund allocation.');
  }
};
