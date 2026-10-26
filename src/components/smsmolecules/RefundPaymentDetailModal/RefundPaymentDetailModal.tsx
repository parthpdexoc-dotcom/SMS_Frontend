import React, { useMemo } from 'react';
import {
  SMSButton,
  SMSDialog,
  SMSDialogActions,
  SMSDialogContent,
  SMSStandardDialogHeader,
  SMSTypography,
} from '@/components/smsatoms';
import {
  PaymentModalSlate,
  buildPaymentInfoMetaFields,
} from '@/components/smsmolecules/PaymentModalSlate';
import { FullRefundAllocationHistory } from '@/components/smsmolecules/FullRefundAllocationHistory';
import { SMSDataTableWrapper } from '@/components/smsorganisms';
import { PAYMENT_GRID } from '@/constants/strings';
import type { RefundPaymentDetailModalComponentProps } from '@/types/payment';
import { formatPaymentCurrency } from '@/utils/paymentFormat';
import '@/components/smsmolecules/SettlePendingInvoicesModal/SettlePendingInvoicesModal.css';

const DETAIL = PAYMENT_GRID.REFUND_DETAIL;

export const RefundPaymentDetailModal: React.FC<RefundPaymentDetailModalComponentProps> = ({
  isOpen,
  onClose,
  title = DETAIL.TITLE,
  refundPaymentId,
  totalRefund = 0,
  loading = false,
  error = null,
  columns,
  data,
  emptyMessage,
  pagination,
  paymentInfo,
}) => {
  const slateMetaFields = useMemo(
    () => (paymentInfo ? buildPaymentInfoMetaFields(paymentInfo) : undefined),
    [paymentInfo]
  );

  const slateStats = useMemo(
    () => [
      {
        key: 'totalRefund',
        label: DETAIL.TOTAL_REFUND,
        value: formatPaymentCurrency(totalRefund),
        valueTone: totalRefund > 0.001 ? ('due' as const) : ('default' as const),
      },
    ],
    [totalRefund]
  );

  return (
    <SMSDialog
      open={isOpen}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      className="settle-pending-invoices-modal"
    >
      <SMSStandardDialogHeader
        title={title}
        onClose={onClose}
        showCloseButton
        headerActions={
          <FullRefundAllocationHistory refundPaymentId={refundPaymentId} disabled={loading} />
        }
      />
      <SMSDialogContent className="settle-pending-invoices-modal__content">
        <PaymentModalSlate metaFields={slateMetaFields} stats={slateStats} />

        {error ? (
          <SMSTypography color="error" variant="body2" role="alert">
            {error}
          </SMSTypography>
        ) : null}

        <SMSTypography
          id="refund-payment-detail-allocations-title"
          component="h2"
          variant="h5"
          className="payment-modal__section-title"
        >
          {DETAIL.ALLOCATIONS_TITLE}
        </SMSTypography>

        <div
          className="settle-pending-invoices-modal__table-wrap"
          aria-labelledby="refund-payment-detail-allocations-title"
        >
          <SMSDataTableWrapper
            embedded
            columns={columns}
            data={data}
            getRowKey={(row) =>
              row.refundPaymentAllocationID?.trim() ||
              row.paymentID?.trim() ||
              `${row.paymentNumber ?? ''}-${row.amountApplied ?? 0}`
            }
            loading={loading}
            emptyMessage={emptyMessage ?? DETAIL.NO_ALLOCATIONS}
            showHeaderWhenEmpty
            renderEmptyAsTable
            tableClassName="invoice-payment-modal__history-table"
            pagination={pagination}
          />
        </div>
      </SMSDialogContent>
      <SMSDialogActions>
        <SMSButton variant="outlined" onClick={onClose} allowWhenSuspended>
          {DETAIL.CLOSE}
        </SMSButton>
      </SMSDialogActions>
    </SMSDialog>
  );
};
