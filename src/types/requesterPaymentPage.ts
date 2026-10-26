import type { DataTableColumn } from '@/components/smsorganisms';
import type {
  CreatePaymentPhase,
  PaymentAdjustAllocationConflictDto,
  PaymentDetailInvoiceDto,
  PaymentEntryFormState,
  PaymentFormRequesterOption,
  PaymentModalPaymentInfo,
  ReadjustPaymentFields,
  RefundPaymentAllocationDetailDto,
  RequesterPaymentRowDto,
  RequesterRefundPaymentRowDto,
  SettlePendingInvoiceRow,
  SettlePendingInvoicesModalMode,
  SettlePendingInvoicesModalPagination,
  SettlePendingInvoicesModalSubmitPayload,
} from '@/types/payment';

export interface RequesterPaymentPageProps {
  requesterId: string;
  requesterName?: string | null;
  returnPath?: string;
  returnState?: unknown;
}

export interface UseRequesterPaymentPageOptions {
  requesterId: string;
  requesterName?: string | null;
}

export interface RequesterPaymentColumnHandlers {
  onView: (row: RequesterPaymentRowDto) => void;
  onEdit: (row: RequesterPaymentRowDto) => void;
  onSettle: (row: RequesterPaymentRowDto) => void;
  onDelete: (row: RequesterPaymentRowDto) => void;
}

export interface RequesterPaymentSummaryGridProps {
  totalAmount?: number | null;
  totalInvoiceDueAmount?: number | null;
  totalAppliedAmount?: number | null;
  totalRefundedAmount?: number | null;
  requesterAvailableAmount?: number | null;
  totalAvailableAmount?: number | null;
}

export interface RequesterPaymentPageModalsProps {
  displayName: string;
  requesterId: string;
  requesterOptions: PaymentFormRequesterOption[];
  saving: boolean;
  allocationConflictOpen: boolean;
  allocationConflictMessage: string;
  onConfirmAllocationConflict: () => void;
  onCancelAllocationConflict: () => void;
  settleModalOpen: boolean;
  settleModalKey?: string;
  settleModalTitle?: string;
  settleMode: SettlePendingInvoicesModalMode;
  isReadjustSettle: boolean;
  createPaymentPhase: CreatePaymentPhase | null;
  paymentEntry: PaymentEntryFormState;
  paymentEntryErrors: Partial<Record<keyof PaymentEntryFormState, string>>;
  onPaymentEntryChange: (patch: Partial<PaymentEntryFormState>) => void;
  onSaveNewPayment: () => Promise<boolean>;
  paymentTypeOptions: import('@/components/smsatoms').SMSDropdownOption[];
  paymentTypesLoading: boolean;
  settlePaymentInfo: PaymentModalPaymentInfo | null;
  settleTotalPayment: number;
  readjustConflict: PaymentAdjustAllocationConflictDto | null;
  readjustAllocationsLoading: boolean;
  readjustAllocationsError: string | null;
  readjustSubmitError: string | null;
  onClearReadjustSubmitError: () => void;
  readjustEnableAllocationEditing: boolean;
  readjustAppliedAmount: number;
  readjustAdjustAmount: string;
  readjustPaymentFields: ReadjustPaymentFields;
  onReadjustPaymentFieldsChange: (patch: Partial<ReadjustPaymentFields>) => void;
  readjustHasPaymentDetailsEdit: boolean;
  isEditingReadjustAmount: boolean;
  onReadjustAdjustAmountChange: (value: string) => void;
  onToggleReadjustAmountEdit: () => void;
  onCloseReadjustAmountEdit: () => void;
  onVoidAllocation?: (paymentAllocationId: string, reason: string) => Promise<void> | void;
  voidingPaymentAllocationId?: string | null;
  skippedAllocationIds?: string[];
  unpaidInvoicesLoading: boolean;
  unpaidInvoicesError: string | null;
  unpaidInvoicesSubmitting: boolean;
  paymentUsedBefore: number;
  paymentRefundedBefore: number;
  readjustInvoiceRows: SettlePendingInvoiceRow[];
  unpaidInvoiceRows: SettlePendingInvoiceRow[];
  settlePagination?: SettlePendingInvoicesModalPagination;
  onCloseSettleModal: () => void;
  onSubmitSettlement: (
    payload: SettlePendingInvoicesModalSubmitPayload
  ) => Promise<boolean> | boolean;
  paymentDetailOpen: boolean;
  paymentDetailLoading: boolean;
  paymentDetailError: string | null;
  activePaymentInfo: PaymentModalPaymentInfo | null;
  paymentDetailAmount: number;
  paymentDetailApplied: number;
  paymentDetailRefunded: number;
  paymentDetailAvailable: number;
  paymentDetailColumns: DataTableColumn<PaymentDetailInvoiceDto>[];
  paymentDetailRows: PaymentDetailInvoiceDto[];
  paymentDetailPagination: SettlePendingInvoicesModalPagination;
  onClosePaymentDetail: () => void;
  paymentInfoInvoiceId: string | null;
  onCloseInvoicePayment: () => void;
  recordRefundModalOpen: boolean;
  refundablePayments: RequesterPaymentRowDto[];
  refundablePaymentsLoading: boolean;
  refundablePaymentsError: string | null;
  refundablePaymentColumns: DataTableColumn<RequesterPaymentRowDto>[];
  refundablePaymentsPagination: SettlePendingInvoicesModalPagination;
  totalEscrowAvailable: number;
  refundAmount: number;
  selectedRefundCount: number;
  refundEntry: PaymentEntryFormState;
  refundEntryErrors: Partial<Record<keyof PaymentEntryFormState, string>>;
  refundSubmitting: boolean;
  onRefundEntryChange: (patch: Partial<PaymentEntryFormState>) => void;
  onCloseRecordRefundModal: () => void;
  onSubmitRefund: () => Promise<boolean>;
  refundDetailOpen: boolean;
  refundDetailLoading: boolean;
  refundDetailError: string | null;
  activeRefundPaymentId: string | null;
  activeRefundInfo: PaymentModalPaymentInfo | null;
  refundDetailAmount: number;
  refundDetailColumns: DataTableColumn<RefundPaymentAllocationDetailDto>[];
  refundDetailRows: RefundPaymentAllocationDetailDto[];
  refundDetailPagination: SettlePendingInvoicesModalPagination;
  onCloseRefundDetail: () => void;
  deletingPaymentRow: RequesterPaymentRowDto | null;
  deletingRefundRow: RequesterRefundPaymentRowDto | null;
  deleteSubmitting: boolean;
  onDeletePaymentConfirm: (reason: string) => Promise<void> | void;
  onDeletePaymentCancel: () => void;
  onDeleteRefundConfirm: (reason: string) => Promise<void> | void;
  onDeleteRefundCancel: () => void;
  voidingRefundAllocationRow: RefundPaymentAllocationDetailDto | null;
  voidRefundAllocationSubmitting: boolean;
  onVoidRefundAllocationConfirm: (reason: string) => Promise<void> | void;
  onVoidRefundAllocationCancel: () => void;
}
