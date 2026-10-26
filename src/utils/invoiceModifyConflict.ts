import type { NavigateFunction } from 'react-router-dom';
import type { ClosePostRefundPendingClose } from '@/components/smsmolecules/ClosePostRefundDialogs';
import { INVOICE_GRID } from '@/constants/strings';
import type { InvoiceDetailDto } from '@/types/invoice';
import type { RequestResponse } from '@/types/request';
import {
  buildConflictInvoiceLineEdits,
  getConflictClosedPostPositionIds,
  type InvoiceConflictEditPayload,
} from '@/types/invoiceConflict';

export type { InvoiceConflictEditPayload, ConflictInvoiceLineEdits } from '@/types/invoiceConflict';
export { buildConflictInvoiceLineEdits, readInvoiceLineFeeAmount } from '@/types/invoiceConflict';

export type PendingCloseJobAction =
  | { kind: 'editClose'; closeArgs: ClosePostRefundPendingClose }
  | { kind: 'unclose'; postPositionId: string };

export interface InvoiceModifyConflictState {
  invoiceId: string;
  closedPostPositionId?: string;
  editPayload?: InvoiceConflictEditPayload;
  requesterId?: string;
  /** Original close/unclose request to retry after invoice modify succeeds. */
  pendingAction?: PendingCloseJobAction;
}

export type InvoiceListLocationState = {
  requesterId?: string;
  modifyConflict?: InvoiceModifyConflictState;
  /** Daily Administration → project number */
  request?: RequestResponse;
  returnTab?: string;
  /** Prior screen (e.g. `/personnel/requester/daily`) for Back navigation. */
  returnPath?: string;
};

export const navigateToInvoiceModifyConflict = (
  navigate: NavigateFunction,
  conflict: InvoiceModifyConflictState
): void => {
  navigate(INVOICE_GRID.INVOICE_LIST_PATH, {
    state: {
      ...(conflict.requesterId ? { requesterId: conflict.requesterId } : {}),
      modifyConflict: conflict,
    },
  });
};

export const invoiceLineMatchesModifyConflict = (
  row: InvoiceDetailDto,
  closedPostPositionId?: string
): boolean => {
  const target = closedPostPositionId?.trim();
  if (!target) return false;

  const rowId = String(
    row.closePostPositionID ??
      row.closedPostPositionId ??
      row.closedPostPosition?.closedPostPositionID ??
      row.closedPostPosition?.closedPostPositionId ??
      ''
  ).trim();

  return rowId.length > 0 && rowId.toLowerCase() === target.toLowerCase();
};

export const findInvoiceLineIndexForConflict = (
  lineItems: InvoiceDetailDto[],
  closedPostPositionId?: string,
  editPayload?: InvoiceConflictEditPayload
): number => {
  for (const id of getConflictClosedPostPositionIds(closedPostPositionId, editPayload)) {
    const index = lineItems.findIndex((row) => invoiceLineMatchesModifyConflict(row, id));
    if (index >= 0) return index;
  }
  return -1;
};

export const applyConflictEditPayloadToEditedRows = (
  lineItems: InvoiceDetailDto[],
  baseEdits: Record<
    string,
    { rate: string; hours: string; vehicleFeeAmount: string; equipmentFeeAmount: string }
  >,
  getLineKey: (row: InvoiceDetailDto, index: number) => string,
  closedPostPositionId?: string,
  editPayload?: InvoiceConflictEditPayload
): Record<string, { rate: string; hours: string; vehicleFeeAmount: string; equipmentFeeAmount: string }> => {
  if (!editPayload) return baseEdits;

  const lineIndex = findInvoiceLineIndexForConflict(lineItems, closedPostPositionId, editPayload);
  if (lineIndex < 0) return baseEdits;

  const rowKey = getLineKey(lineItems[lineIndex], lineIndex);
  return {
    ...baseEdits,
    [rowKey]: buildConflictInvoiceLineEdits(lineItems[lineIndex], editPayload),
  };
};
