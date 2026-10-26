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
  buildPaymentModalSummaryStats,
} from '@/components/smsmolecules/PaymentModalSlate';
import { SMSDataTableWrapper } from '@/components/smsorganisms';
import { PAYMENT_GRID } from '@/constants/strings';
import type {
  PaymentDetailModalComponentProps,
  PaymentDetailInvoiceDto,
} from '@/types/payment';
import '@/components/smsmolecules/SettlePendingInvoicesModal/SettlePendingInvoicesModal.css';

const DETAIL = PAYMENT_GRID.PAYMENT_DETAIL;
const SLATE_STATS = PAYMENT_GRID.MODAL_SLATE_STATS;

export const PaymentDetailModal: React.FC<PaymentDetailModalComponentProps> = ({
  isOpen,
  onClose,
  title = DETAIL.TITLE,
  totalPayment = 0,
  paymentUsed = 0,
  refundedAmount = 0,
  invoiceDueTotal,
  loading = false,
  error = null,
  columns,
  data,
  emptyMessage,
  pagination,
  availableBalance,
  paymentInfo,
}) => {
  const computedInvoiceDueTotal = useMemo(
    () =>
      invoiceDueTotal ??
      data.reduce((sum, row) => sum + (row.dueAmount ?? 0), 0),
    [data, invoiceDueTotal]
  );

  const resolvedAvailableBalance =
    availableBalance ?? Math.max(0, totalPayment - paymentUsed - refundedAmount);

  const slateMetaFields = useMemo(
    () => (paymentInfo ? buildPaymentInfoMetaFields(paymentInfo) : undefined),
    [paymentInfo]
  );

  const slateStats = useMemo(
    () =>
      buildPaymentModalSummaryStats(
        {
          totalPayment,
          paymentUsed,
          refundedAmount,
          invoiceDueTotal: computedInvoiceDueTotal,
          availableBalance: resolvedAvailableBalance,
        },
        SLATE_STATS
      ),
    [computedInvoiceDueTotal, paymentUsed, refundedAmount, resolvedAvailableBalance, totalPayment]
  );

  return (
    <SMSDialog
      open={isOpen}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      className="settle-pending-invoices-modal"
    >
      <SMSStandardDialogHeader title={title} onClose={onClose} showCloseButton />
      <SMSDialogContent className="settle-pending-invoices-modal__content">
        <PaymentModalSlate metaFields={slateMetaFields} stats={slateStats} />

        {error ? (
          <SMSTypography color="error" variant="body2" role="alert">
            {error}
          </SMSTypography>
        ) : null}

        <SMSTypography
          id="payment-detail-settled-invoices-title"
          component="h2"
          variant="h5"
          className="payment-modal__section-title"
        >
          {DETAIL.SETTLED_INVOICES_TITLE}
        </SMSTypography>

        <div
          className="settle-pending-invoices-modal__table-wrap"
          aria-labelledby="payment-detail-settled-invoices-title"
        >
          <SMSDataTableWrapper<PaymentDetailInvoiceDto>
            embedded
            columns={columns}
            data={data}
            loading={loading}
            getRowKey={(row) => row.invoiceId?.trim() ?? row.invoiceNo?.trim() ?? ''}
            tableClassName="settle-pending-invoices-modal__data-table"
            showHeaderWhenEmpty
            renderEmptyAsTable
            emptyMessage={emptyMessage}
            pagination={pagination}
          />
        </div>
      </SMSDialogContent>
      <SMSDialogActions className="settle-pending-invoices-modal__actions">
        <SMSButton variant="outlined" onClick={onClose} allowWhenSuspended>
          {PAYMENT_GRID.REQUESTER_INVOICE_DETAILS.CLOSE}
        </SMSButton>
      </SMSDialogActions>
    </SMSDialog>
  );
};
