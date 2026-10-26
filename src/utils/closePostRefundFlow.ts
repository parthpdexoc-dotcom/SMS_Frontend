import type { InvoiceRefundActionResult } from '@/types/invoice';
import type {
  ClosePostRefundFlowState,
  ClosePostRefundPendingClose,
  UnclosePostRefundFlowState,
} from '@/components/smsmolecules/ClosePostRefundDialogs';

/** Maps an unwrapped close thunk result to refund modal state (same pattern as modify/undo invoice). */
export function closeRefundFlowFromResult(
  result: InvoiceRefundActionResult,
  pendingClose: ClosePostRefundPendingClose
): ClosePostRefundFlowState | null {
  if (result.success) return null;

  const invoiceId = result.refund.invoiceId?.trim();
  if (!invoiceId) return null;

  return {
    refundRequired: result.refund.refundRequired,
    refundMessage: result.refund.message,
    invoiceId,
    pendingClose,
  };
}

/** Maps an unwrapped unclose thunk result to refund modal state (refund before unclose). */
export function uncloseRefundFlowFromResult(
  result: InvoiceRefundActionResult,
  postPositionId: string
): UnclosePostRefundFlowState | null {
  if (result.success) return null;

  const invoiceId = result.refund.invoiceId?.trim();
  if (!invoiceId) return null;

  const normalizedPostPositionId =
    result.refund.postPositionId?.trim() || postPositionId.trim();
  if (!normalizedPostPositionId) return null;

  return {
    refundRequired: result.refund.refundRequired,
    refundMessage: result.refund.message,
    invoiceId,
    postPositionId: normalizedPostPositionId,
  };
}
