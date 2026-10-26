import React from 'react';
import {
  InvoicePaymentModal,
  PaymentDetailModal,
  PaymentVoidReasonConfirmDialog,
  RefundPaymentDetailModal,
  RecordRefundModal,
  SettlePendingInvoicesModal,
  SMSConfirmDialog,
} from '@/components/smsmolecules';
import { PAYMENT_GRID } from '@/constants/strings';
import type { RequesterPaymentPageModalsProps } from '@/types/requesterPaymentPage';
import { REQUESTER_INVOICE_TABLE, S } from './constants';

export const RequesterPaymentPageModals: React.FC<RequesterPaymentPageModalsProps> = ({
  displayName,
  saving,
  allocationConflictOpen,
  allocationConflictMessage,
  onConfirmAllocationConflict,
  onCancelAllocationConflict,
  settleModalOpen,
  settleModalKey,
  settleModalTitle,
  settleMode,
  isReadjustSettle,
  createPaymentPhase,
  paymentEntry,
  paymentEntryErrors,
  onPaymentEntryChange,
  onSaveNewPayment,
  paymentTypeOptions,
  paymentTypesLoading,
  settlePaymentInfo,
  settleTotalPayment,
  readjustConflict,
  readjustAllocationsLoading,
  readjustAllocationsError,
  readjustSubmitError,
  onClearReadjustSubmitError,
  readjustEnableAllocationEditing,
  readjustAppliedAmount,
  readjustAdjustAmount,
  readjustPaymentFields,
  onReadjustPaymentFieldsChange,
  readjustHasPaymentDetailsEdit,
  isEditingReadjustAmount,
  onReadjustAdjustAmountChange,
  onToggleReadjustAmountEdit,
  onCloseReadjustAmountEdit,
  onVoidAllocation,
  voidingPaymentAllocationId,
  skippedAllocationIds,
  unpaidInvoicesLoading,
  unpaidInvoicesError,
  unpaidInvoicesSubmitting,
  paymentUsedBefore,
  paymentRefundedBefore,
  readjustInvoiceRows,
  unpaidInvoiceRows,
  settlePagination,
  onCloseSettleModal,
  onSubmitSettlement,
  paymentDetailOpen,
  paymentDetailLoading,
  paymentDetailError,
  activePaymentInfo,
  paymentDetailAmount,
  paymentDetailApplied,
  paymentDetailRefunded,
  paymentDetailAvailable,
  paymentDetailColumns,
  paymentDetailRows,
  paymentDetailPagination,
  onClosePaymentDetail,
  paymentInfoInvoiceId,
  onCloseInvoicePayment,
  recordRefundModalOpen,
  refundablePayments,
  refundablePaymentsLoading,
  refundablePaymentsError,
  refundablePaymentColumns,
  refundablePaymentsPagination,
  totalEscrowAvailable,
  refundAmount,
  selectedRefundCount,
  refundEntry,
  refundEntryErrors,
  refundSubmitting,
  onRefundEntryChange,
  onCloseRecordRefundModal,
  onSubmitRefund,
  refundDetailOpen,
  refundDetailLoading,
  refundDetailError,
  activeRefundPaymentId,
  activeRefundInfo,
  refundDetailAmount,
  refundDetailColumns,
  refundDetailRows,
  refundDetailPagination,
  onCloseRefundDetail,
  deletingPaymentRow,
  deletingRefundRow,
  deleteSubmitting,
  onDeletePaymentConfirm,
  onDeletePaymentCancel,
  onDeleteRefundConfirm,
  onDeleteRefundCancel,
  voidingRefundAllocationRow,
  voidRefundAllocationSubmitting,
  onVoidRefundAllocationConfirm,
  onVoidRefundAllocationCancel,
}) => {
  const paymentInvoiceHeader = paymentInfoInvoiceId
    ? paymentDetailRows.find((row) => row.invoiceId?.trim() === paymentInfoInvoiceId.trim())
    : undefined;

  return (
  <>
    <SMSConfirmDialog
      open={allocationConflictOpen}
      onClose={onCancelAllocationConflict}
      onConfirm={onConfirmAllocationConflict}
      title={S.ADJUST_CONFLICT.TITLE}
      message={allocationConflictMessage || S.ADJUST_CONFLICT.MESSAGE}
      confirmText={S.ADJUST_CONFLICT.CONFIRM}
      cancelText={S.ADJUST_CONFLICT.CANCEL}
      variant="warning"
      confirmButtonColor="primary"
    />

    <SettlePendingInvoicesModal
      key={settleModalKey}
      isOpen={settleModalOpen}
      onClose={onCloseSettleModal}
      mode={settleMode}
      title={settleModalTitle}
      paymentInfo={settlePaymentInfo}
      createPhase={createPaymentPhase}
      paymentEntry={paymentEntry}
      onPaymentEntryChange={onPaymentEntryChange}
      paymentEntryErrors={paymentEntryErrors}
      onSaveNewPayment={onSaveNewPayment}
      paymentTypeOptions={paymentTypeOptions}
      paymentTypesLoading={paymentTypesLoading}
      loading={
        (isReadjustSettle && readjustAllocationsLoading) ||
        (createPaymentPhase !== 'entry' && !isReadjustSettle && unpaidInvoicesLoading)
      }
      error={
        settleModalOpen && createPaymentPhase !== 'entry'
          ? isReadjustSettle
            ? readjustAllocationsError
            : unpaidInvoicesError
          : null
      }
      submitting={
        createPaymentPhase === 'entry' ? saving : isReadjustSettle ? saving : unpaidInvoicesSubmitting
      }
      totalPayment={settleTotalPayment}
      oldPaymentAmount={isReadjustSettle ? readjustConflict?.oldPaymentAmount : undefined}
      paymentUsedBefore={paymentUsedBefore}
      paymentRefundedBefore={paymentRefundedBefore}
      invoiceRows={isReadjustSettle ? readjustInvoiceRows : unpaidInvoiceRows}
      pagination={settlePagination}
      onSubmit={onSubmitSettlement}
      readjustAppliedAmount={readjustAppliedAmount}
      readjustAdjustAmount={readjustAdjustAmount}
      readjustPaymentFields={readjustPaymentFields}
      onReadjustPaymentFieldsChange={onReadjustPaymentFieldsChange}
      readjustHasPaymentDetailsEdit={readjustHasPaymentDetailsEdit}
      isEditingReadjustAmount={isEditingReadjustAmount}
      onReadjustAdjustAmountChange={onReadjustAdjustAmountChange}
      onToggleReadjustAmountEdit={onToggleReadjustAmountEdit}
      onCloseReadjustAmountEdit={onCloseReadjustAmountEdit}
      onVoidAllocation={onVoidAllocation}
      voidingPaymentAllocationId={voidingPaymentAllocationId}
      skippedAllocationIds={skippedAllocationIds}
      submitError={isReadjustSettle ? readjustSubmitError : null}
      onClearSubmitError={onClearReadjustSubmitError}
      enableAllocationEditing={isReadjustSettle ? readjustEnableAllocationEditing : false}
    />

    <PaymentDetailModal
      isOpen={paymentDetailOpen}
      onClose={onClosePaymentDetail}
      paymentInfo={activePaymentInfo}
      totalPayment={paymentDetailAmount}
      paymentUsed={paymentDetailApplied}
      refundedAmount={paymentDetailRefunded}
      availableBalance={paymentDetailAvailable}
      loading={paymentDetailLoading}
      error={paymentDetailError}
      columns={paymentDetailColumns}
      data={paymentDetailRows}
      emptyMessage={REQUESTER_INVOICE_TABLE.NO_INVOICES}
      pagination={paymentDetailPagination}
    />

    <InvoicePaymentModal
      isOpen={paymentInfoInvoiceId != null}
      invoicesId={paymentInfoInvoiceId}
      invoiceHeader={
        paymentInvoiceHeader
          ? {
              invoiceNo: paymentInvoiceHeader.invoiceNo,
              dateCreated: paymentInvoiceHeader.invoiceDate,
            }
          : undefined
      }
      readOnly
      title={PAYMENT_GRID.REQUESTER_INVOICE_DETAILS.ALLOCATION_MODAL_TITLE}
      onClose={onCloseInvoicePayment}
    />

    <RecordRefundModal
      isOpen={recordRefundModalOpen}
      onClose={onCloseRecordRefundModal}
      requesterName={displayName}
      payments={refundablePayments}
      loading={refundablePaymentsLoading}
      error={refundablePaymentsError}
      columns={refundablePaymentColumns}
      pagination={refundablePaymentsPagination}
      refundAmount={refundAmount}
      selectedCount={selectedRefundCount}
      totalEscrowAvailable={totalEscrowAvailable}
      value={refundEntry}
      onChange={onRefundEntryChange}
      errors={refundEntryErrors}
      submitting={refundSubmitting}
      onSubmit={onSubmitRefund}
      paymentTypeOptions={paymentTypeOptions}
      paymentTypesLoading={paymentTypesLoading}
    />

    <RefundPaymentDetailModal
      isOpen={refundDetailOpen}
      onClose={onCloseRefundDetail}
      refundPaymentId={activeRefundPaymentId}
      paymentInfo={activeRefundInfo}
      totalRefund={refundDetailAmount}
      loading={refundDetailLoading}
      error={refundDetailError}
      columns={refundDetailColumns}
      data={refundDetailRows}
      pagination={refundDetailPagination}
    />

    <PaymentVoidReasonConfirmDialog
      open={deletingPaymentRow != null}
      title={S.CONFIRM_DELETE_PAYMENT.TITLE}
      message={S.CONFIRM_DELETE_PAYMENT.MESSAGE}
      confirmText={S.CONFIRM_DELETE_PAYMENT.CONFIRM}
      cancelText={S.CONFIRM_DELETE_PAYMENT.CANCEL}
      variant="error"
      loading={deleteSubmitting}
      onClose={onDeletePaymentCancel}
      onConfirm={onDeletePaymentConfirm}
      reasonLabel={S.CONFIRM_DELETE_PAYMENT.REASON_LABEL}
    />

    <PaymentVoidReasonConfirmDialog
      open={deletingRefundRow != null}
      title={S.CONFIRM_DELETE_REFUND.TITLE}
      message={S.CONFIRM_DELETE_REFUND.MESSAGE}
      confirmText={S.CONFIRM_DELETE_REFUND.CONFIRM}
      cancelText={S.CONFIRM_DELETE_REFUND.CANCEL}
      variant="error"
      loading={deleteSubmitting}
      onClose={onDeleteRefundCancel}
      onConfirm={onDeleteRefundConfirm}
      reasonLabel={S.CONFIRM_DELETE_REFUND.REASON_LABEL}
    />

    <PaymentVoidReasonConfirmDialog
      open={voidingRefundAllocationRow != null}
      title={S.CONFIRM_VOID_REFUND_ALLOCATION.TITLE}
      message={S.CONFIRM_VOID_REFUND_ALLOCATION.MESSAGE}
      confirmText={S.CONFIRM_VOID_REFUND_ALLOCATION.CONFIRM}
      cancelText={S.CONFIRM_VOID_REFUND_ALLOCATION.CANCEL}
      variant="error"
      loading={voidRefundAllocationSubmitting}
      onClose={onVoidRefundAllocationCancel}
      onConfirm={onVoidRefundAllocationConfirm}
      reasonLabel={S.CONFIRM_VOID_REFUND_ALLOCATION.REASON_LABEL}
    />
  </>
  );
};
