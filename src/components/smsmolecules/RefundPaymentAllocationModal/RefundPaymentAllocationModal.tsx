import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SMSModal as Modal, SMSDataTableWrapper, type DataTableColumn } from '@/components/smsorganisms';
import { SMSBox, SMSButton, SMSLoader, SMSStack, SMSTextField, SMSTypography } from '@/components/smsatoms';
import { InvoiceAmountSummaryBox } from '@/components/smsmolecules/InvoiceAmountSummaryBox';
import { PaymentModalSlate } from '@/components/smsmolecules/PaymentModalSlate';
import { INVOICE_GRID } from '@/constants/strings';
import type { RefundPaymentAllocationModalProps } from '@/types/invoice';
import { formatDateShort } from '@/utils';
import { formatPaymentCurrency } from '@/utils/paymentFormat';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  applyInvoiceRefundAllocationsThunk,
  clearInvoicePaymentSummary,
  fetchInvoicePaymentSummary,
  selectInvoicePaymentSummaryState,
} from '@/store/slices/invoiceSlice';
import { showToast } from '@/store/slices/toastSlice';
import './RefundPaymentAllocationModal.css';

const R = INVOICE_GRID.PAYMENT.REFUND_PAYMENT_ALLOCATION;
const EMPTY = INVOICE_GRID.EMPTY_PLACEHOLDER;

const paymentTypeLabel = (paymentTypeName?: string | null): string =>
  paymentTypeName?.trim() || EMPTY;

const parseAmount = (value: string): number => {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const amountsMatch = (assigned: number, required: number): boolean =>
  Math.abs(assigned - required) <= 0.001;

/**
 * Slate totals for refund allocation while an invoice modify/close is pending.
 * `refundRequired` is the overpayment vs the new invoice total (paid − new total).
 */
const computeProjectedRefundSlateTotals = (
  paidAmount: number,
  refundRequired: number,
  assignedRefund: number
): { invoiceTotal: number; paid: number; balanceDue: number } => {
  const invoiceTotal = Math.max(0, paidAmount - refundRequired);
  const paid = Math.max(0, paidAmount - assignedRefund);
  const balanceDue = Math.max(0, paid - invoiceTotal);
  return { invoiceTotal, paid, balanceDue };
};

type RefundRow = {
  paymentId: string;
  paymentNumber?: string | null;
  paymentDate?: string | null;
  paymentAmount: number;
  paymentTypeName?: string | null;
  referenceNumber?: string | null;
  paidOnInvoice: number;
  refundAmount: string;
};

export const RefundPaymentAllocationModal: React.FC<RefundPaymentAllocationModalProps> = ({
  isOpen,
  onClose,
  invoiceId,
  refundRequired,
  refundMessage,
  onAfterRefund,
  title = R.MODAL_TITLE,
  afterRefundFailedMessage = R.AFTER_REFUND_FAILED,
}) => {
  const dispatch = useAppDispatch();
  const { paidAmount, payments, loading, submitting, error } = useAppSelector(
    selectInvoicePaymentSummaryState
  );
  const [refundAmounts, setRefundAmounts] = useState<Record<string, string>>({});
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      dispatch(clearInvoicePaymentSummary());
      setRefundAmounts({});
      return;
    }
    void dispatch(fetchInvoicePaymentSummary(invoiceId));
  }, [dispatch, invoiceId, isOpen]);

  useEffect(() => {
    if (!isOpen || payments.length === 0) return;
    setRefundAmounts(
      Object.fromEntries(payments.map((payment) => [payment.paymentId, '0']))
    );
  }, [isOpen, payments]);

  const rows = useMemo<RefundRow[]>(
    () =>
      payments.map((payment) => ({
        paymentId: payment.paymentId,
        paymentNumber: payment.paymentNumber,
        paymentDate: payment.paymentDate,
        paymentAmount: payment.paymentAmount ?? payment.paidAmount,
        paymentTypeName: payment.paymentTypeName,
        referenceNumber: payment.referenceNumber,
        paidOnInvoice: payment.paidAmount,
        refundAmount: refundAmounts[payment.paymentId] ?? '0',
      })),
    [payments, refundAmounts]
  );

  const assignedRefund = useMemo(
    () => rows.reduce((sum, row) => sum + parseAmount(row.refundAmount), 0),
    [rows]
  );

  const remainingRefund = Math.max(0, refundRequired - assignedRefund);
  const isRefundMatched = amountsMatch(assignedRefund, refundRequired);

  const projectedSlateTotals = useMemo(
    () => computeProjectedRefundSlateTotals(paidAmount, refundRequired, assignedRefund),
    [assignedRefund, paidAmount, refundRequired]
  );

  const updateRefundAmount = useCallback((paymentId: string, value: string, maxAmount: number) => {
    const parsed = parseAmount(value);
    const nextValue = parsed > maxAmount ? maxAmount.toFixed(2) : value;
    setRefundAmounts((prev) => ({
      ...prev,
      [paymentId]: nextValue,
    }));
  }, []);

  const handleClose = useCallback(() => {
    dispatch(clearInvoicePaymentSummary());
    onClose();
  }, [dispatch, onClose]);

  const columns = useMemo<DataTableColumn<RefundRow>[]>(
    () => [
      {
        key: 'paymentNumber',
        label: R.TABLE.PAYMENT_NUMBER,
        render: (_v, row) => row.paymentNumber?.trim() || EMPTY,
      },
      {
        key: 'paymentDate',
        label: R.TABLE.DATE,
        render: (_v, row) => (row.paymentDate ? formatDateShort(row.paymentDate) : EMPTY),
      },
      {
        key: 'paymentAmount',
        label: R.TABLE.PAYMENT_AMOUNT,
        render: (_v, row) => formatPaymentCurrency(row.paymentAmount),
      },
      {
        key: 'paymentType',
        label: R.TABLE.PAYMENT_TYPE,
        render: (_v, row) => paymentTypeLabel(row.paymentTypeName),
      },
      {
        key: 'referenceNumber',
        label: R.TABLE.REFERENCE_NUMBER,
        render: (_v, row) => row.referenceNumber?.trim() || EMPTY,
      },
      {
        key: 'paidOnInvoice',
        label: R.TABLE.PAID_ON_INVOICE,
        render: (_v, row) => formatPaymentCurrency(row.paidOnInvoice),
      },
      {
        key: 'refundAmount',
        label: R.TABLE.REFUND_AMOUNT,
        noClamp: true,
        render: (_v, row) => (
          <SMSTextField
            className="refund-payment-allocation-modal__refund-input"
            size="small"
            type="number"
            inputProps={{ min: 0, max: row.paidOnInvoice, step: '0.01', inputMode: 'decimal' }}
            value={row.refundAmount}
            onChange={(e) => updateRefundAmount(row.paymentId, e.target.value, row.paidOnInvoice)}
            disabled={loading || submitting || completing}
          />
        ),
      },
    ],
    [completing, loading, submitting, updateRefundAmount]
  );

  const slateStats = useMemo(
    () => [
      {
        key: 'total',
        label: INVOICE_GRID.PAYMENT.SUMMARY.INVOICE_TOTAL,
        value: formatPaymentCurrency(projectedSlateTotals.invoiceTotal),
      },
      {
        key: 'paid',
        label: INVOICE_GRID.PAYMENT.SUMMARY.PAID,
        value: formatPaymentCurrency(projectedSlateTotals.paid),
        valueTone: 'paid' as const,
      },
      {
        key: 'due',
        label: INVOICE_GRID.PAYMENT.SUMMARY.INVOICE_DUE,
        value: formatPaymentCurrency(projectedSlateTotals.balanceDue),
        valueTone: 'remaining' as const,
      },
      {
        key: 'refund',
        label: R.REQUIRED_REFUND,
        value: formatPaymentCurrency(refundRequired),
        valueTone: 'due' as const,
      },
    ],
    [projectedSlateTotals.balanceDue, projectedSlateTotals.invoiceTotal, projectedSlateTotals.paid, refundRequired]
  );

  const summaryRows = useMemo(
    () => [
      { key: 'required', label: R.REQUIRED_REFUND, value: formatPaymentCurrency(refundRequired) },
      { key: 'assigned', label: R.REFUND_ASSIGNED, value: formatPaymentCurrency(assignedRefund) },
      {
        key: 'remaining',
        label: R.REFUND_REMAINING,
        value: formatPaymentCurrency(remainingRefund),
        variant: isRefundMatched ? ('default' as const) : ('error' as const),
      },
    ],
    [assignedRefund, isRefundMatched, refundRequired, remainingRefund]
  );

  const handleContinue = useCallback(async () => {
    if (!isRefundMatched || submitting || completing) return;

    const allocations = rows
      .map((row) => ({
        paymentId: row.paymentId,
        amount: parseAmount(row.refundAmount),
      }))
      .filter((item) => item.amount > 0);

    try {
      await dispatch(
        applyInvoiceRefundAllocationsThunk({
          invoiceId,
          requiredRefundAmount: refundRequired,
          payments: allocations,
        })
      ).unwrap();
    } catch {
      return;
    }

    setCompleting(true);
    try {
      await onAfterRefund();
      dispatch(clearInvoicePaymentSummary());
      onClose();
    } catch (err) {
      const message =
        err instanceof Error && err.message.trim() ? err.message : afterRefundFailedMessage;
      dispatch(showToast(message, 'error'));
    } finally {
      setCompleting(false);
    }
  }, [
    afterRefundFailedMessage,
    completing,
    dispatch,
    invoiceId,
    isRefundMatched,
    onAfterRefund,
    onClose,
    refundRequired,
    rows,
    submitting,
  ]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      size="lg"
      fullWidth
      className="refund-payment-allocation-modal"
      actions={
        <SMSStack direction="row" spacing={1} justifyContent="flex-end" useFlexGap>
          <SMSButton variant="outlined" onClick={handleClose} disabled={loading || submitting || completing} allowWhenSuspended>
            {R.CLOSE}
          </SMSButton>
          <SMSButton
            variant="contained"
            onClick={() => void handleContinue()}
            disabled={loading || submitting || completing || !isRefundMatched || rows.length === 0}
            allowWhenSuspended
          >
            {R.CONTINUE}
          </SMSButton>
        </SMSStack>
      }
    >
      {loading ? (
        <SMSBox sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 192 }}>
          <SMSLoader />
        </SMSBox>
      ) : error ? (
        <SMSTypography variant="body2" color="error">
          {error}
        </SMSTypography>
      ) : (
        <SMSStack spacing={2}>
          <PaymentModalSlate stats={slateStats} statsAriaLabel={title} />

          <SMSStack spacing={1}>
            <SMSTypography variant="h5" component="h2" className="payment-modal__section-title">
              {INVOICE_GRID.PAYMENT.PAYMENT_HISTORY}
            </SMSTypography>
            <SMSTypography variant="body2" color="error" className="refund-payment-allocation-modal__hint">
              {refundMessage}
            </SMSTypography>
            {rows.length > 0 ? (
              <SMSDataTableWrapper<RefundRow>
                embedded
                columns={columns}
                data={rows}
                getRowKey={(row) => row.paymentId}
                showHeaderWhenEmpty
                renderEmptyAsTable
                tableClassName="invoice-payment-modal__history-table refund-payment-allocation-modal__history-table"
                emptyMessage={R.NO_PAYMENTS}
              />
            ) : (
              <SMSTypography variant="body2" color="text.secondary">
                {R.NO_PAYMENTS}
              </SMSTypography>
            )}
          </SMSStack>

          <InvoiceAmountSummaryBox rows={summaryRows} />
        </SMSStack>
      )}
    </Modal>
  );
};
