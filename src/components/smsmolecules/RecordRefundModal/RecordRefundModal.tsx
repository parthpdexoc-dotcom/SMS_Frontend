import React, { useMemo } from 'react';
import {
  SMSBox,
  SMSButton,
  SMSDialog,
  SMSDialogActions,
  SMSDialogContent,
  SMSLoader,
  SMSStandardDialogHeader,
  SMSTypography,
} from '@/components/smsatoms';
import { EditablePaymentSlate } from '@/components/smsmolecules/EditablePaymentSlate';
import { InvoiceAmountSummaryBox } from '@/components/smsmolecules/InvoiceAmountSummaryBox';
import { PaymentModalSlate } from '@/components/smsmolecules/PaymentModalSlate';
import { SMSDataTableWrapper } from '@/components/smsorganisms';
import { PAYMENT_GRID } from '@/constants/strings';
import type { RecordRefundModalProps } from '@/types/payment';
import { formatPaymentCurrency } from '@/utils/paymentFormat';
import './RecordRefundModal.css';

const R = PAYMENT_GRID.REQUESTER_PAYMENT_PAGE.REFUND;
const COMMON = PAYMENT_GRID.SETTLE_PENDING_INVOICES;

export const RecordRefundModal: React.FC<RecordRefundModalProps> = ({
  isOpen,
  onClose,
  requesterName,
  payments,
  loading,
  error,
  columns,
  pagination,
  refundAmount,
  selectedCount,
  totalEscrowAvailable,
  value,
  onChange,
  errors = {},
  submitting = false,
  onSubmit,
  paymentTypeOptions = [],
  paymentTypesLoading = false,
}) => {
  const canSubmit = useMemo(() => {
    if (submitting || refundAmount <= 0 || selectedCount === 0) return false;
    return Boolean(value.paymentDate.trim());
  }, [refundAmount, selectedCount, submitting, value.paymentDate]);

  const slateStats = useMemo(
    () => [
      {
        key: 'totalEscrow',
        label: R.SLATE.TOTAL_ESCROW,
        labelTooltip: R.SLATE.TOTAL_ESCROW_TOOLTIP,
        value: formatPaymentCurrency(totalEscrowAvailable),
        valueTone: totalEscrowAvailable > 0.001 ? ('paid' as const) : ('default' as const),
      },
      {
        key: 'refundAmount',
        label: R.SLATE.SELECTED_REFUND,
        labelTooltip: R.SLATE.SELECTED_REFUND_TOOLTIP,
        value: formatPaymentCurrency(refundAmount),
        valueTone: refundAmount > 0.001 ? ('due' as const) : ('default' as const),
      },
      {
        key: 'selectedCount',
        label: R.SLATE.SELECTED_COUNT,
        value: String(selectedCount),
      },
    ],
    [refundAmount, selectedCount, totalEscrowAvailable]
  );

  const summaryRows = useMemo(
    () => [
      {
        key: 'escrow',
        label: R.SUMMARY.TOTAL_ESCROW,
        value: formatPaymentCurrency(refundAmount),
      },
      {
        key: 'refund',
        label: R.SUMMARY.REFUND_AMOUNT,
        value: formatPaymentCurrency(refundAmount),
        variant: refundAmount > 0.001 ? ('error' as const) : ('default' as const),
      },
      {
        key: 'count',
        label: R.SUMMARY.SELECTED,
        value: String(selectedCount),
      },
    ],
    [refundAmount, selectedCount]
  );

  return (
    <SMSDialog
      open={isOpen}
      onClose={onClose}
      maxWidth={false}
      scroll="body"
      fullWidth
      className="record-refund-modal"
    >
      <SMSStandardDialogHeader title={R.MODAL_TITLE} onClose={onClose} showCloseButton />
      <SMSDialogContent className="record-refund-modal__content">
        <PaymentModalSlate stats={slateStats} statsAriaLabel={R.MODAL_TITLE} />

        <EditablePaymentSlate
          requesterName={requesterName}
          value={{
            ...value,
            amount: refundAmount.toFixed(2),
          }}
          onChange={onChange}
          errors={errors}
          disabled={submitting}
          amountReadOnly
          amountLabel={R.AMOUNT_LABEL}
          paymentTypeOptions={paymentTypeOptions}
          paymentTypesLoading={paymentTypesLoading}
        />

        <SMSTypography variant="body2" color="text.secondary" className="record-refund-modal__hint">
          {R.SELECT_PAYMENTS_HINT}
        </SMSTypography>

        {loading ? (
          <SMSBox sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 192 }}>
            <SMSLoader />
          </SMSBox>
        ) : error ? (
          <SMSTypography variant="body2" color="error">
            {error}
          </SMSTypography>
        ) : (
          <SMSDataTableWrapper
            embedded
            columns={columns}
            data={payments}
            getRowKey={(row) => row.paymentId?.trim() || String(row.paymentNumber ?? '')}
            showHeaderWhenEmpty
            renderEmptyAsTable
            emptyMessage={R.TABLE.NO_DATA}
            tableClassName="record-refund-modal__data-table"
            pagination={pagination}
          />
        )}

        <InvoiceAmountSummaryBox rows={summaryRows} />
      </SMSDialogContent>
      <SMSDialogActions className="record-refund-modal__actions">
        <SMSButton variant="outlined" onClick={onClose} disabled={submitting} allowWhenSuspended>
          {COMMON.CANCEL}
        </SMSButton>
        <SMSButton
          color="success"
          onClick={() => void onSubmit()}
          disabled={!canSubmit}
          allowWhenSuspended
        >
          {R.SAVE}
        </SMSButton>
      </SMSDialogActions>
    </SMSDialog>
  );
};
