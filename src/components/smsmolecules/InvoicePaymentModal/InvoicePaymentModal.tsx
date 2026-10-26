import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Stack } from '@mui/material';
import Tooltip from '@mui/material/Tooltip';
import { SMSModal as Modal, SMSDataTableWrapper, type DataTableColumn } from '@/components/smsorganisms';
import { SMSBox, SMSButton, SMSChip, SMSIcon, SMSIconButton, SMSLoader, SMSStack, SMSTypography } from '@/components/smsatoms';
import {
  PaymentModalSlate,
  buildInvoicePaymentMetaFields,
  buildInvoicePaymentStats,
} from '@/components/smsmolecules/PaymentModalSlate';
import { PaymentVoidReasonConfirmDialog } from '@/components/smsmolecules/PaymentVoidReasonConfirmDialog';
import { PaymentReasonViewModal } from '@/components/smsmolecules/PaymentReasonViewModal';
import { INVOICE_GRID, PAYMENT_GRID } from '@/constants/strings';
import type {
  InvoicePaymentHistoryItemDto,
  InvoicePaymentModalProps,
  InvoicePaymentSourceSummaryDto,
} from '@/types/invoice';
import { PaymentAllocationTransactionType } from '@/types/payment';
import { formatDateShort } from '@/utils';
import { formatPaymentCurrency } from '@/utils/paymentFormat';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  clearInvoicePayment,
  clearInvoicePaymentSummary,
  fetchInvoicePaymentInformation,
  fetchInvoicePaymentSummary,
  selectInvoicePaymentState,
  selectInvoicePaymentSummaryState,
} from '@/store/slices/invoiceSlice';
import { voidPaymentWithReasonThunk } from '@/store/slices/paymentAllocationSlice';
import { showToast } from '@/store/slices/toastSlice';
import './InvoicePaymentModal.css';

const paymentTypeLabel = (paymentTypeName?: string | null): string =>
  paymentTypeName?.trim() || '—';

const paymentAllocationTransactionTypeLabel = (transactionType?: number | null): string => {
  switch (transactionType) {
    case PaymentAllocationTransactionType.Debit:
      return INVOICE_GRID.PAYMENT.TRANSACTION_TYPES.DEBIT;
    case PaymentAllocationTransactionType.Credit:
      return INVOICE_GRID.PAYMENT.TRANSACTION_TYPES.CREDIT;
    case PaymentAllocationTransactionType.Discard:
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
  return value || INVOICE_GRID.EMPTY_PLACEHOLDER;
};

const processedByCell = (name: string) => {
  if (!name || name === INVOICE_GRID.EMPTY_PLACEHOLDER) {
    return INVOICE_GRID.EMPTY_PLACEHOLDER;
  }

  return (
    <Tooltip title={name} placement="top" arrow describeChild>
      <span className="invoice-payment-modal__processed-by">{name}</span>
    </Tooltip>
  );
};

export const InvoicePaymentModal: React.FC<InvoicePaymentModalProps> = ({
  isOpen,
  onClose,
  invoicesId,
  invoiceHeader,
  readOnly = false,
  title: titleOverride,
  onViewInvoice,
  onPayment,
  onPaymentSaved,
}) => {
  const dispatch = useAppDispatch();
  const {
    invoicesId: loadedPaymentInfoId,
    invoice: paymentInfoInvoice,
    paymentHistory: history,
    loading: paymentInfoLoading,
    discarding,
  } = useAppSelector(selectInvoicePaymentState);
  const {
    invoiceId: summaryInvoiceId,
    total: summaryTotal,
    paidAmount: summaryPaidAmount,
    balanceDue: summaryBalanceDue,
    payments: summaryPayments,
    loading: summaryLoading,
  } = useAppSelector(selectInvoicePaymentSummaryState);
  const [showFullPaymentHistory, setShowFullPaymentHistory] = useState(false);
  const [discardConfirmRow, setDiscardConfirmRow] = useState<InvoicePaymentSourceSummaryDto | null>(
    null
  );
  const [viewPaymentHistoryReason, setViewPaymentHistoryReason] = useState<string | null>(null);

  const trimmedInvoiceId = invoicesId?.trim() ?? '';
  const summaryReady = !summaryLoading && Boolean(trimmedInvoiceId && summaryInvoiceId === trimmedInvoiceId);
  const invoiceTotal = summaryTotal;
  const paymentApplied = summaryPaidAmount;
  const balanceDue = summaryBalanceDue;
  const isInvoiceSettled = balanceDue <= 0.001;

  useEffect(() => {
    if (!isOpen) {
      dispatch(clearInvoicePayment());
      dispatch(clearInvoicePaymentSummary());
      setShowFullPaymentHistory(false);
      setDiscardConfirmRow(null);
      setViewPaymentHistoryReason(null);
      return;
    }
    if (!trimmedInvoiceId) return;
    void dispatch(fetchInvoicePaymentSummary(trimmedInvoiceId));
  }, [dispatch, isOpen, trimmedInvoiceId]);

  const handleDiscardConfirm = useCallback(
    async (reason: string) => {
      if (!trimmedInvoiceId || !discardConfirmRow?.paymentId?.trim()) {
        dispatch(showToast(INVOICE_GRID.PAYMENT.ERRORS.DISCARD_FAILED, 'error'));
        return;
      }
      try {
        await dispatch(
          voidPaymentWithReasonThunk({
            scope: 'invoicePayment',
            invoicesId: trimmedInvoiceId,
            paymentId: discardConfirmRow.paymentId.trim(),
            reason,
          })
        ).unwrap();
        setDiscardConfirmRow(null);
        onPaymentSaved?.();
      } catch {
        // Toast handled in thunk
      }
    },
    [discardConfirmRow, dispatch, onPaymentSaved, trimmedInvoiceId]
  );

  const paymentSummaryColumns: DataTableColumn<InvoicePaymentSourceSummaryDto>[] = useMemo(
    () => [
      {
        key: 'paymentNumber',
        label: INVOICE_GRID.PAYMENT.TABLE.PAYMENT_NUMBER,
        render: (_v, row) =>
          row.paymentNumber != null && String(row.paymentNumber).trim() !== ''
            ? String(row.paymentNumber)
            : INVOICE_GRID.EMPTY_PLACEHOLDER,
      },
      {
        key: 'paymentDate',
        label: INVOICE_GRID.PAYMENT.TABLE.DATE,
        render: (_v, row) =>
          row.paymentDate ? formatDateShort(row.paymentDate) : INVOICE_GRID.EMPTY_PLACEHOLDER,
      },
      {
        key: 'paidAmount',
        label: INVOICE_GRID.PAYMENT.TABLE.AMOUNT,
        render: (_v, row) => formatPaymentCurrency(row.paidAmount),
      },
      {
        key: 'paymentType',
        label: INVOICE_GRID.PAYMENT.TABLE.METHOD,
        render: (_v, row) =>
          paymentTypeLabel(
            (row as { paymentTypeName?: string | null }).paymentTypeName
          ) || INVOICE_GRID.EMPTY_PLACEHOLDER,
      },
      {
        key: 'referenceNumber',
        label: INVOICE_GRID.PAYMENT.TABLE.REFERENCE_NUMBER,
        render: (_v, row) => row.referenceNumber?.trim() || INVOICE_GRID.EMPTY_PLACEHOLDER,
      },
      ...(readOnly
        ? []
        : [
            {
              key: 'paymentSummaryAction',
              label: INVOICE_GRID.PAYMENT.TABLE.ACTION,
              align: 'right' as const,
              noClamp: true,
              render: (_v: unknown, row: InvoicePaymentSourceSummaryDto) => {
                if (!row.paymentId?.trim()) {
                  return '—';
                }
                return (
                  <SMSButton
                    size="small"
                    variant="outlined"
                    color="error"
                    disabled={summaryLoading || discarding}
                    onClick={() => setDiscardConfirmRow(row)}
                    allowWhenSuspended
                  >
                    {INVOICE_GRID.PAYMENT.TABLE.DISCARD}
                  </SMSButton>
                );
              },
            },
          ]),
    ],
    [discarding, readOnly, summaryLoading]
  );

  const renderPaymentHistoryReasonCell = useCallback((reason?: string | null) => {
    const trimmed = reason?.trim();
    if (!trimmed) return INVOICE_GRID.EMPTY_PLACEHOLDER;

    return (
      <SMSIconButton
        size="small"
        tone="primary"
        allowWhenSuspended
        onClick={(e) => {
          e.stopPropagation();
          setViewPaymentHistoryReason(trimmed);
        }}
        title={INVOICE_GRID.PAYMENT.TABLE.VIEW_REASON}
        aria-label={INVOICE_GRID.PAYMENT.TABLE.VIEW_REASON}
        className="invoice-payment-modal__view-reason-btn"
      >
        <SMSIcon name="eye" size="sm" />
      </SMSIconButton>
    );
  }, []);

  const paymentHistoryColumns: DataTableColumn<InvoicePaymentHistoryItemDto>[] = useMemo(
    () => [
      {
        key: 'paymentNumber',
        label: INVOICE_GRID.PAYMENT.TABLE.PAYMENT_NUMBER,
        render: (_v, row) =>
          row.paymentNumber != null && String(row.paymentNumber).trim() !== ''
            ? String(row.paymentNumber)
            : INVOICE_GRID.EMPTY_PLACEHOLDER,
      },
      {
        key: 'date',
        label: INVOICE_GRID.PAYMENT.TABLE.DATE,
        render: (_v, row) => {
          const dateSource = row.paymentDate ?? row.allocationDate;
          return dateSource ? formatDateShort(dateSource) : INVOICE_GRID.EMPTY_PLACEHOLDER;
        },
      },
      {
        key: 'transactionType',
        label: INVOICE_GRID.PAYMENT.TABLE.TRANSACTION,
        noClamp: true,
        align: 'center',
        render: (_v, row) => {
          const label = paymentAllocationTransactionTypeLabel(row.transactionType);
          if (label === '—') {
            return INVOICE_GRID.EMPTY_PLACEHOLDER;
          }
          const chipClassName =
            row.transactionType === PaymentAllocationTransactionType.Discard
              ? 'invoice-payment-modal__transaction-chip--discard'
              : row.transactionType === PaymentAllocationTransactionType.Credit
                ? 'invoice-payment-modal__transaction-chip--credit'
                : row.transactionType === PaymentAllocationTransactionType.Debit
                  ? 'invoice-payment-modal__transaction-chip--debit'
                  : undefined;
          if (!chipClassName) {
            return INVOICE_GRID.EMPTY_PLACEHOLDER;
          }
          return (
            <SMSChip label={label} size="small" variant="outlined" className={chipClassName} />
          );
        },
      },
      {
        key: 'amount',
        label: INVOICE_GRID.PAYMENT.TABLE.AMOUNT,
        render: (_v, row) => formatPaymentCurrency(row.amountApplied),
      },
      {
        key: 'method',
        label: INVOICE_GRID.PAYMENT.TABLE.METHOD,
        render: (_v, row) =>
          paymentTypeLabel(
            (row as { paymentTypeName?: string | null }).paymentTypeName
          ) || INVOICE_GRID.EMPTY_PLACEHOLDER,
      },
      {
        key: 'processedBy',
        label: INVOICE_GRID.PAYMENT.TABLE.PROCESSED_BY,
        render: (_v, row) => processedByCell(resolveProcessedBy(row)),
      },
      {
        key: 'reason',
        label: INVOICE_GRID.PAYMENT.TABLE.REASON,
        align: 'center',
        noClamp: true,
        render: (_v, row) => renderPaymentHistoryReasonCell(row.reason),
      },
    ],
    [renderPaymentHistoryReasonCell]
  );

  const showPaidHeaderBadge = summaryReady && isInvoiceSettled;
  const dialogTitle = titleOverride ?? INVOICE_GRID.PAYMENT.TITLE;

  const handleFullPaymentHistoryClick = useCallback(() => {
    if (showFullPaymentHistory) {
      setShowFullPaymentHistory(false);
      return;
    }
    if (!trimmedInvoiceId) return;
    if (loadedPaymentInfoId !== trimmedInvoiceId) {
      void dispatch(fetchInvoicePaymentInformation(trimmedInvoiceId));
    }
    setShowFullPaymentHistory(true);
  }, [dispatch, loadedPaymentInfoId, showFullPaymentHistory, trimmedInvoiceId]);

  const showPaymentButton = !readOnly && summaryReady && !isInvoiceSettled && Boolean(onPayment);

  const headerActions = (
    <Stack direction="row" alignItems="center" spacing={1} useFlexGap flexWrap="wrap">
      {onViewInvoice ? (
        <SMSButton
          size="small"
          variant="outlined"
          onClick={onViewInvoice}
          disabled={discarding}
          allowWhenSuspended
        >
          {INVOICE_GRID.PAYMENT.VIEW_INVOICE}
        </SMSButton>
      ) : null}
      <SMSButton
        size="small"
        variant="outlined"
        onClick={handleFullPaymentHistoryClick}
        disabled={discarding || !summaryReady}
        allowWhenSuspended
      >
        {showFullPaymentHistory
          ? INVOICE_GRID.PAYMENT.BACK_TO_PAYMENT_SUMMARY
          : INVOICE_GRID.PAYMENT.FULL_PAYMENT_HISTORY}
      </SMSButton>
      {showPaymentButton ? (
        <SMSButton
          size="small"
          variant="contained"
          onClick={onPayment}
          disabled={discarding}
          allowWhenSuspended
        >
          {INVOICE_GRID.PAYMENT.PAYMENT}
        </SMSButton>
      ) : null}
      {showPaidHeaderBadge ? (
        <SMSChip
          label={INVOICE_GRID.PAYMENT.SETTLED}
          size="small"
          variant="outlined"
          className="invoice-payment-modal__header-paid-chip"
        />
      ) : null}
    </Stack>
  );

  const modalActions = (
    <Stack direction="row" spacing={1} justifyContent="flex-end" useFlexGap>
      <SMSButton variant="outlined" onClick={onClose} disabled={discarding} allowWhenSuspended>
        {INVOICE_GRID.PAYMENT.CLOSE}
      </SMSButton>
    </Stack>
  );

  const slateInput = useMemo(() => {
    if (!summaryReady) return null;
    return {
      invoiceNo: paymentInfoInvoice?.invoiceNo ?? invoiceHeader?.invoiceNo,
      billingToName: paymentInfoInvoice?.billingToName ?? invoiceHeader?.billingToName,
      dateCreated: paymentInfoInvoice?.dateCreated ?? invoiceHeader?.dateCreated,
      dueDate: paymentInfoInvoice?.dueDate ?? invoiceHeader?.dueDate,
      invoiceTotal,
      amountPaid: paymentApplied,
      amountRemaining: balanceDue,
    };
  }, [
    balanceDue,
    invoiceHeader,
    invoiceTotal,
    paymentApplied,
    paymentInfoInvoice,
    summaryReady,
  ]);

  const slateMetaFields = useMemo(
    () => (slateInput ? buildInvoicePaymentMetaFields(slateInput) : undefined),
    [slateInput]
  );

  const slateStats = useMemo(
    () => (slateInput ? buildInvoicePaymentStats(slateInput, formatPaymentCurrency) : []),
    [slateInput]
  );

  const sectionTitle = showFullPaymentHistory
    ? INVOICE_GRID.PAYMENT.PAYMENT_HISTORY
    : INVOICE_GRID.PAYMENT.PAYMENT_SUMMARY;

  const emptyMessage = readOnly
    ? PAYMENT_GRID.REQUESTER_INVOICE_DETAILS.ALLOCATION_EMPTY
    : INVOICE_GRID.PAYMENT.TABLE.NO_PAYMENTS;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={dialogTitle}
        size="xl"
        fullWidth
        className="invoice-payment-modal"
        headerActions={headerActions}
        actions={modalActions}
      >
        {summaryLoading ? (
          <SMSBox sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 192 }}>
            <SMSLoader />
          </SMSBox>
        ) : !summaryReady ? null : (
          <SMSStack spacing={2}>
            <PaymentModalSlate
              metaFields={slateMetaFields}
              stats={slateStats}
              metaAriaLabel={INVOICE_GRID.PAYMENT.TITLE}
              statsAriaLabel={INVOICE_GRID.PAYMENT.SUMMARY.INVOICE_TOTAL}
            />

            <SMSStack spacing={1}>
              <SMSTypography
                variant="h5"
                component="h2"
                className="payment-modal__section-title"
              >
                {sectionTitle}
              </SMSTypography>
              {showFullPaymentHistory ? (
                paymentInfoLoading ? (
                  <SMSBox sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 120 }}>
                    <SMSLoader />
                  </SMSBox>
                ) : history.length > 0 ? (
                  <SMSDataTableWrapper<InvoicePaymentHistoryItemDto>
                    embedded
                    columns={paymentHistoryColumns}
                    data={history}
                    getRowKey={(row) =>
                      String(row.paymentAllocationID ?? row.paymentID ?? row.amountApplied ?? '')
                    }
                    showHeaderWhenEmpty
                    renderEmptyAsTable
                    tableClassName="invoice-payment-modal__history-table"
                    emptyMessage={emptyMessage}
                  />
                ) : (
                  <SMSTypography variant="body2" color="text.secondary">
                    {emptyMessage}
                  </SMSTypography>
                )
              ) : summaryPayments.length > 0 ? (
                <SMSDataTableWrapper<InvoicePaymentSourceSummaryDto>
                  embedded
                  columns={paymentSummaryColumns}
                  data={summaryPayments}
                  getRowKey={(row) => row.paymentId}
                  showHeaderWhenEmpty
                  renderEmptyAsTable
                  tableClassName="invoice-payment-modal__history-table"
                  emptyMessage={emptyMessage}
                />
              ) : (
                <SMSTypography variant="body2" color="text.secondary">
                  {emptyMessage}
                </SMSTypography>
              )}
            </SMSStack>
          </SMSStack>
        )}
      </Modal>

      <PaymentVoidReasonConfirmDialog
        open={discardConfirmRow != null}
        title={INVOICE_GRID.PAYMENT.CONFIRM_DISCARD.TITLE}
        message={INVOICE_GRID.PAYMENT.CONFIRM_DISCARD.MESSAGE}
        confirmText={INVOICE_GRID.PAYMENT.CONFIRM_DISCARD.CONFIRM}
        cancelText={INVOICE_GRID.PAYMENT.CONFIRM_DISCARD.CANCEL}
        onConfirm={handleDiscardConfirm}
        onClose={() => setDiscardConfirmRow(null)}
        variant="error"
        loading={discarding}
      />

      <PaymentReasonViewModal
        isOpen={viewPaymentHistoryReason != null}
        onClose={() => setViewPaymentHistoryReason(null)}
        reason={viewPaymentHistoryReason}
      />
    </>
  );
};
