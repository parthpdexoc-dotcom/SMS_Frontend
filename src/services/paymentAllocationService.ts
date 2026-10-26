import { apiPost } from '@/utils/apiClient';
import { expectOkReadText, parseJsonText } from '@/services/textPlainJson';
import type {
  InvoicePaymentSummaryDto,
  InvoiceRefundAllocationsDto,
} from '@/types/invoice';
import type {
  PaymentAllocateResponseDto,
  PaymentAllocationUpdateResultDto,
  PaymentUpdateAllocationAmountDto,
} from '@/types/payment';

/** POST /PaymentAllocation/{paymentAllocationId}/void — void one allocation and return payment balances. */
export const voidPaymentAllocation = async (
  paymentAllocationId: string,
  reason: string
): Promise<PaymentAllocateResponseDto> => {
  const id = encodeURIComponent(paymentAllocationId.trim());
  const response = await apiPost(
    `/PaymentAllocation/${id}/void`,
    { reason: reason.trim() },
    { headers: { 'Content-Type': 'application/json', accept: '*/*' } }
  );
  const text = await expectOkReadText(response, 'Failed to void payment allocation.');
  return parseJsonText<PaymentAllocateResponseDto>(text);
};

/** POST /PaymentAllocation/update-amount — updates changed allocation amounts only. */
export const updatePaymentAllocationAmount = async (
  payload: PaymentUpdateAllocationAmountDto
): Promise<PaymentAllocationUpdateResultDto> => {
  const response = await apiPost('/PaymentAllocation/update-amount', payload, {
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
  });
  const text = await expectOkReadText(response, '');
  return parseJsonText<PaymentAllocationUpdateResultDto>(text);
};

/** POST /PaymentAllocation/invoice-refund — credit allocations before unclose. */
export const applyInvoiceRefundAllocations = async (
  payload: InvoiceRefundAllocationsDto
): Promise<InvoicePaymentSummaryDto> => {
  const response = await apiPost('/PaymentAllocation/invoice-refund', payload, {
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
  });
  const text = await expectOkReadText(response, 'Failed to apply invoice refund allocations.');
  return parseJsonText<InvoicePaymentSummaryDto>(text);
};
