import React, { useCallback, useMemo, useState } from 'react';
import Tooltip from '@mui/material/Tooltip';
import {
  SMSButton,
  SMSChip,
  SMSDialog,
  SMSDialogActions,
  SMSDialogContent,
  SMSIcon,
  SMSIconButton,
  SMSStandardDialogHeader,
  SMSTypography,
} from '@/components/smsatoms';
import { SMSDataTableWrapper, type DataTableColumn } from '@/components/smsorganisms';
import { PaymentReasonViewModal } from '@/components/smsmolecules/PaymentReasonViewModal';
import { INVOICE_GRID, PAYMENT_GRID } from '@/constants/strings';
import {
  RefundPaymentAllocationTransactionType,
  type RefundPaymentAllocationDetailDto,
} from '@/types/payment';
import { formatDateShort } from '@/utils';
import { formatPaymentCurrency } from '@/utils/paymentFormat';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  clearRefundPaymentAllocationHistory,
  fetchRefundPaymentAllocationHistory,
  selectRefundPaymentAllocationHistoryState,
} from '@/store/slices/refundPaymentAllocationSlice';
import '@/components/smsmolecules/InvoicePaymentModal/InvoicePaymentModal.css';

const DETAIL = PAYMENT_GRID.REFUND_DETAIL;
const PLACEHOLDER = INVOICE_GRID.EMPTY_PLACEHOLDER;

const paymentTypeLabel = (paymentTypeName?: string | null): string =>
  paymentTypeName?.trim() || '—';

const transactionTypeLabel = (transactionType?: number | null): string => {
  switch (transactionType) {
    case RefundPaymentAllocationTransactionType.Debit:
      return INVOICE_GRID.PAYMENT.TRANSACTION_TYPES.DEBIT;
    case RefundPaymentAllocationTransactionType.Credit:
      return INVOICE_GRID.PAYMENT.TRANSACTION_TYPES.CREDIT;
    case RefundPaymentAllocationTransactionType.Discard:
      return INVOICE_GRID.PAYMENT.TRANSACTION_TYPES.DISCARD;
    default:
      return '—';
  }
};

const resolveProcessedBy = (row: {
  createdBy?: string | null;
  editedBy?: string | null;
}): string => {
  const value = (row.editedBy?.trim() ? row.editedBy : row.createdBy)?.trim();
  return value || PLACEHOLDER;
};

export interface FullRefundAllocationHistoryProps {
  refundPaymentId?: string | null;
  disabled?: boolean;
}

export const FullRefundAllocationHistory: React.FC<FullRefundAllocationHistoryProps> = ({
  refundPaymentId,
  disabled = false,
}) => {
  const dispatch = useAppDispatch();
  const [isOpen, setIsOpen] = useState(false);
  const [viewReason, setViewReason] = useState<string | null>(null);
  const { view, loading, error } = useAppSelector(selectRefundPaymentAllocationHistoryState);

  const trimmedId = refundPaymentId?.trim() ?? '';
  const historyReady = !loading && Boolean(trimmedId && view?.refundPaymentId === trimmedId);

  const handleOpen = useCallback(() => {
    if (!trimmedId) return;
    setIsOpen(true);
    if (view?.refundPaymentId !== trimmedId) {
      void dispatch(fetchRefundPaymentAllocationHistory(trimmedId));
    }
  }, [dispatch, trimmedId, view?.refundPaymentId]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setViewReason(null);
    dispatch(clearRefundPaymentAllocationHistory());
  }, [dispatch]);

  const columns: DataTableColumn<RefundPaymentAllocationDetailDto>[] = useMemo(
    () => [
      {
        key: 'paymentNumber',
        label: INVOICE_GRID.PAYMENT.TABLE.PAYMENT_NUMBER,
        render: (_v, row) => row.paymentNumber?.trim() || PLACEHOLDER,
      },
      {
        key: 'date',
        label: INVOICE_GRID.PAYMENT.TABLE.DATE,
        render: (_v, row) => {
          const dateSource = row.paymentDate ?? row.allocationDate;
          return dateSource ? formatDateShort(dateSource) : PLACEHOLDER;
        },
      },
      {
        key: 'transactionType',
        label: INVOICE_GRID.PAYMENT.TABLE.TRANSACTION,
        noClamp: true,
        align: 'center',
        render: (_v, row) => {
          const label = transactionTypeLabel(row.transactionType);
          if (label === '—') return PLACEHOLDER;
          const chipClassName =
            row.transactionType === RefundPaymentAllocationTransactionType.Discard
              ? 'invoice-payment-modal__transaction-chip--discard'
              : row.transactionType === RefundPaymentAllocationTransactionType.Credit
                ? 'invoice-payment-modal__transaction-chip--credit'
                : row.transactionType === RefundPaymentAllocationTransactionType.Debit
                  ? 'invoice-payment-modal__transaction-chip--debit'
                  : undefined;
          if (!chipClassName) return PLACEHOLDER;
          return (
            <SMSChip label={label} size="small" variant="outlined" className={chipClassName} />
          );
        },
      },
      {
        key: 'amount',
        label: INVOICE_GRID.PAYMENT.TABLE.AMOUNT,
        render: (_v, row) => formatPaymentCurrency(row.amountApplied ?? 0),
      },
      {
        key: 'method',
        label: INVOICE_GRID.PAYMENT.TABLE.METHOD,
        render: (_v, row) =>
          paymentTypeLabel(row.paymentTypeName) || PLACEHOLDER,
      },
      {
        key: 'processedBy',
        label: INVOICE_GRID.PAYMENT.TABLE.PROCESSED_BY,
        render: (_v, row) => {
          const name = resolveProcessedBy(row);
          if (name === PLACEHOLDER) return PLACEHOLDER;
          return (
            <Tooltip title={name} placement="top" arrow describeChild>
              <span className="invoice-payment-modal__processed-by">{name}</span>
            </Tooltip>
          );
        },
      },
      {
        key: 'reason',
        label: INVOICE_GRID.PAYMENT.TABLE.REASON,
        align: 'center',
        noClamp: true,
        render: (_v, row) => {
          const trimmed = row.reason?.trim();
          if (!trimmed) return PLACEHOLDER;
          return (
            <SMSIconButton
              size="small"
              tone="primary"
              allowWhenSuspended
              onClick={(e) => {
                e.stopPropagation();
                setViewReason(trimmed);
              }}
              title={INVOICE_GRID.PAYMENT.TABLE.VIEW_REASON}
              aria-label={INVOICE_GRID.PAYMENT.TABLE.VIEW_REASON}
              className="invoice-payment-modal__view-reason-btn"
            >
              <SMSIcon name="eye" size="sm" />
            </SMSIconButton>
          );
        },
      },
    ],
    []
  );

  return (
    <>
      <SMSButton
        size="small"
        variant="outlined"
        onClick={handleOpen}
        disabled={disabled || !trimmedId}
        allowWhenSuspended
      >
        {DETAIL.FULL_REFUND_HISTORY}
      </SMSButton>

      <SMSDialog open={isOpen} onClose={handleClose} maxWidth="lg" fullWidth>
        <SMSStandardDialogHeader
          title={DETAIL.ALLOCATION_HISTORY_TITLE}
          onClose={handleClose}
          showCloseButton
        />
        <SMSDialogContent>
          {error ? (
            <SMSTypography color="error" variant="body2" role="alert">
              {error}
            </SMSTypography>
          ) : null}
          <SMSDataTableWrapper
            embedded
            columns={columns}
            data={historyReady ? view?.allocationHistory ?? [] : []}
            loading={loading}
            emptyMessage={DETAIL.NO_ALLOCATION_HISTORY}
            showHeaderWhenEmpty
            renderEmptyAsTable
            tableClassName="invoice-payment-modal__history-table"
            getRowKey={(row) =>
              row.refundPaymentAllocationID?.trim() ||
              `${row.paymentID ?? ''}-${row.allocationDate ?? ''}-${row.transactionType ?? ''}`
            }
          />
        </SMSDialogContent>
        <SMSDialogActions>
          <SMSButton variant="outlined" onClick={handleClose} allowWhenSuspended>
            {DETAIL.CLOSE}
          </SMSButton>
        </SMSDialogActions>
      </SMSDialog>

      <PaymentReasonViewModal
        isOpen={viewReason != null}
        onClose={() => setViewReason(null)}
        reason={viewReason}
      />
    </>
  );
};
