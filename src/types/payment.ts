import type { DataTableColumn } from '@/components/smsorganisms';

export type { StatisticCardProps, StatisticValueTone } from '@/types/statisticSlate';

export interface PaymentDto {
  paymentID?: string | null;
  requesterID?: string | null;
  amount?: number | null;
  paymentDate?: string | null;
  referenceNumber?: string | null;
  paymentTypeId?: string | null;
  paymentTypeName?: string | null;
  CreatedBy?: string | null;
  EditedBy?: string | null;
}

/** Mirrors backend `PaymentAllocationTransactionType` enum. */
export enum PaymentAllocationTransactionType {
  Debit = 1,
  Credit = 2,
  Discard = 3,
}

/** Mirrors backend `RefundPaymentAllocationTransactionType` enum. */
export enum RefundPaymentAllocationTransactionType {
  Debit = 1,
  Credit = 2,
  Discard = 3,
}

/** Mirrors backend `InvoiceSettlementStatus` enum for payment allocation. */
export enum InvoiceSettlementStatus {
  PartiallyPaid = 1,
  Paid = 2,
}

/** Payload for the payments page add form. */
export interface CreateRequesterPaymentPayload {
  requesterID: string;
  amount: number;
  paymentDate: string;
  referenceNumber?: string | null;
  paymentTypeId: string;
}

/** Row for the payments list grid. */
export interface PaymentGridRow {
  id: string;
  paymentId?: string;
  requesterId: string;
  requesterName: string;
  date: string;
  amountPaid: number;
  paymentTypeId?: string | null;
  paymentTypeLabel: string;
  referenceNumber: string;
}

/** Raw payment row returned by requester summary endpoint. */
export interface RequesterPaymentRowDto {
  paymentId?: string | null;
  paymentNumber?: string | null;
  paymentDate?: string | null;
  amount?: number | null;
  paymentTypeId?: string | null;
  paymentTypeName?: string | null;
  allocationStatus?: number | null;
  appliedAmount?: number | null;
  refundedAmount?: number | null;
  availableAmount?: number | null;
  referenceNumber?: string | null;
  createdBy?: string | null;
  editedBy?: string | null;
}

/** Raw requester summary response from `/Payment/requester-payment-summary`. */
export interface RequesterPaymentSummaryResponseDto {
  requesterId?: string | null;
  totalAmount?: number | null;
  totalAppliedAmount?: number | null;
  totalRefundedAmount?: number | null;
  totalAvailableAmount?: number | null;
  totalInvoiceDueAmount?: number | null;
  requesterAvailableAmount?: number | null;
  payments?: RequesterPaymentRowDto[] | null;
}

export interface PaymentUnpaidInvoiceDto {
  invoiceId?: string | null;
  invoiceNo?: string | null;
  invoiceDate?: string | null;
  dueDate?: string | null;
  invoiceAmount?: number | null;
  paidAmount?: number | null;
  dueAmount?: number | null;
}

export interface PaymentUnpaidInvoicesResponseDto {
  requesterId?: string | null;
  totalInvoicesDueAmount?: number | null;
  invoices?: PaymentUnpaidInvoiceDto[] | null;
  paymentId?: string | null;
  amount?: number | null;
  appliedAmount?: number | null;
  refundedAmount?: number | null;
  availableAmount?: number | null;
}

/** `/Payment/requester-payment-summary` with payments list unwrapped for pagination. */
export type RequesterPaymentSummaryResult = RequesterPaymentSummaryResponseDto & {
  totalRecords: number;
  payments: RequesterPaymentRowDto[];
};

/** Raw refund row returned by requester refund summary endpoint. */
export interface RequesterRefundPaymentRowDto {
  refundPaymentId?: string | null;
  refundPaymentNumber?: string | null;
  paymentDate?: string | null;
  amount?: number | null;
  paymentTypeId?: string | null;
  paymentTypeName?: string | null;
  referenceNumber?: string | null;
  createdBy?: string | null;
  editedBy?: string | null;
  deletedBy?: string | null;
}

/** Raw requester refund summary response from `/RefundPayment/requester-refund-summary`. */
export interface RequesterRefundPaymentSummaryResponseDto {
  requesterId?: string | null;
  totalAmount?: number | null;
  refunds?: RequesterRefundPaymentRowDto[] | null;
}

/** `/RefundPayment/requester-refund-summary` with refunds list unwrapped for pagination. */
export type RequesterRefundPaymentSummaryResult = RequesterRefundPaymentSummaryResponseDto & {
  totalRecords: number;
  refunds: RequesterRefundPaymentRowDto[];
};

export interface RefundPaymentAllocationDetailDto {
  refundPaymentAllocationID?: string | null;
  paymentID?: string | null;
  paymentNumber?: string | null;
  paymentDate?: string | null;
  paymentTypeId?: string | null;
  paymentTypeName?: string | null;
  referenceNumber?: string | null;
  amountApplied?: number | null;
  allocationDate?: string | null;
  transactionType?: number | null;
  reason?: string | null;
  createdBy?: string | null;
  editedBy?: string | null;
}

/** GET /RefundPayment/{refundPaymentId}/allocation-history */
export interface RefundPaymentAllocationHistoryResponseDto {
  refundPaymentId?: string | null;
  refundPaymentNumber?: string | null;
  paymentDate?: string | null;
  amount?: number | null;
  paymentTypeId?: string | null;
  paymentTypeName?: string | null;
  referenceNumber?: string | null;
  allocationHistory?: RefundPaymentAllocationDetailDto[] | null;
}

/** `/RefundPayment/{refundPaymentId}/allocations` with allocations list unwrapped for pagination. */
export interface RefundPaymentAllocationsResponseDto {
  refundPaymentId?: string | null;
  refundPaymentNumber?: string | null;
  paymentDate?: string | null;
  amount?: number | null;
  paymentTypeId?: string | null;
  paymentTypeName?: string | null;
  referenceNumber?: string | null;
  allocations?: RefundPaymentAllocationDetailDto[] | null;
}

export type RefundPaymentAllocationsResult = RefundPaymentAllocationsResponseDto & {
  totalRecords: number;
  allocations: RefundPaymentAllocationDetailDto[];
};

export interface RefundPaymentDetailModalPagination {
  serverSide?: boolean;
  currentPage: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export interface RefundPaymentDetailModalComponentProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  refundPaymentId?: string | null;
  totalRefund?: number;
  loading?: boolean;
  error?: string | null;
  columns: DataTableColumn<RefundPaymentAllocationDetailDto>[];
  data: RefundPaymentAllocationDetailDto[];
  emptyMessage?: string;
  pagination?: RefundPaymentDetailModalPagination;
  paymentInfo?: PaymentModalPaymentInfo | null;
}

/** `/Payment/{paymentId}/unpaid-invoices` with invoices list unwrapped for pagination. */
export type PaymentUnpaidInvoicesResult = PaymentUnpaidInvoicesResponseDto & {
  totalRecords: number;
  invoices: PaymentUnpaidInvoiceDto[];
};

export interface PaymentAllocateInvoiceDto {
  invoiceId: string;
  applyFullAmount: boolean;
  amount: number;
}

export interface PaymentAllocateDto {
  paymentId: string;
  requesterId: string;
  allocationDate: string;
  invoices: PaymentAllocateInvoiceDto[];
}

export interface PaymentAllocateResponseDto {
  paymentId?: string | null;
  amount?: number | null;
  totalPaid?: number | null;
  remainingBalance?: number | null;
  invoiceIds?: string[] | null;
}

export interface PaymentDetailInvoiceDto {
  invoiceId?: string | null;
  invoiceNo?: string | null;
  invoiceDate?: string | null;
  invoiceAmount?: number | null;
  paidAmount?: number | null;
  dueAmount?: number | null;
  settlementStatus?: number | null;
  paymentAllocationId?: string | null;
}

export interface PaymentAdjustAllocationItemDto {
  paymentAllocationId: string;
  invoiceId: string;
  amount: number;
}

/** Request body for POST /PaymentAllocation/update-amount. */
export interface PaymentUpdateAllocationAmountDto {
  paymentId: string;
  allocations: PaymentAdjustAllocationItemDto[];
}

export interface PaymentAllocationUpdateResultDto {
  updated?: unknown[];
  skippedAllocations?: PaymentAdjustAllocationConflictAllocationDto[];
  messages?: string[];
}

/** Result returned from allocation adjust/update thunks when submit completes. */
export interface AllocationSubmitResult {
  paymentId: string;
  skippedAllocationIds: string[];
}

/** Args for update-amount when only allocation rows changed (payment amount unchanged). */
export interface UpdatePaymentAllocationAmountArgs {
  paymentId: string;
  allocations: PaymentAdjustAllocationItemDto[];
}

/** Request body for POST /Payment/adjust-allocations. */
export interface PaymentAdjustAllocationsDto {
  paymentId: string;
  paymentAmount: number;
  paymentDate: string;
  referenceNumber?: string | null;
  paymentTypeId: string;
  allocations: PaymentAdjustAllocationItemDto[];
}

/** Form values passed into adjust-allocations (date as YYYY-MM-DD). */
export interface AdjustRequesterPaymentArgs {
  paymentId: string;
  paymentAmount: number;
  paymentDate: string;
  paymentTypeId: string;
  referenceNumber?: string | null;
  allocations: PaymentAdjustAllocationItemDto[];
}

export interface PaymentDetailResponseDto {
  paymentId?: string | null;
  CreatedBy?: string | null;
  EditedBy?: string | null;
  amount?: number | null;
  appliedAmount?: number | null;
  refundedAmount?: number | null;
  availableAmount?: number | null;
  invoices?: PaymentDetailInvoiceDto[] | null;
}

/** `/Payment/{paymentId}/detail` with invoices list unwrapped for pagination. */
export type PaymentDetailResult = PaymentDetailResponseDto & {
  totalRecords: number;
  invoices: PaymentDetailInvoiceDto[];
};

/** Requester option for payment add form/modal dropdowns. */
export interface PaymentFormRequesterOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/** Payload from payment add form submit. */
export interface PaymentAddFormSavePayload {
  paymentId?: string;
  requesterID: string;
  amount: number;
  paymentDate: string;
  paymentTypeId: string;
  referenceNumber?: string | null;
}

export interface PaymentAddFormInitialValues {
  paymentId: string;
  paymentNumber?: string;
  requesterID: string;
  amount: number;
  paymentDate: string;
  paymentTypeId: string;
  referenceNumber?: string | null;
}

export interface PaymentAddFormProps {
  mode?: 'create' | 'edit';
  initialValues?: PaymentAddFormInitialValues;
  requesterOptions: PaymentFormRequesterOption[];
  requestersLoading?: boolean;
  saving?: boolean;
  initialRequesterId?: string;
  /** When true, requester is fixed (e.g. requester payment page); shows a read-only requester field. */
  lockRequester?: boolean;
  lockedRequesterLabel?: string;
  onCancel?: () => void;
  onSave: (payload: PaymentAddFormSavePayload) => void | Promise<void>;
}

export interface PaymentAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'create' | 'edit';
  initialValues?: PaymentAddFormInitialValues;
  requesterOptions: PaymentAddFormProps['requesterOptions'];
  requestersLoading?: boolean;
  saving?: boolean;
  initialRequesterId?: string;
  formResetToken?: number;
  title?: string;
  lockRequester?: PaymentAddFormProps['lockRequester'];
  lockedRequesterLabel?: PaymentAddFormProps['lockedRequesterLabel'];
  /** Return true when payment was saved successfully (modal will close). */
  onSave: (payload: PaymentAddFormSavePayload) => boolean | Promise<boolean>;
}


/** Invoice row for settle pending invoices modal. */
export interface SettlePendingInvoiceRow extends PaymentUnpaidInvoiceDto {
  paymentAllocationId?: string | null;
  /** When the payment was applied to this invoice (readjust / allocation rows). */
  allocationDate?: string | null;
  /** Remaining invoice balance (readjust / review allocations only). */
  balanceDue?: number | null;
}

export interface SettlePendingInvoicesModalSubmitInvoice {
  invoiceId: string;
  applyFullAmount: boolean;
  amount: number;
  paymentAllocationId?: string;
}

export interface ReadjustPaymentFields {
  paymentDate: string;
  paymentTypeId: string;
  referenceNumber: string;
}

export interface SettlePendingInvoicesModalSubmitPayload {
  invoices: SettlePendingInvoicesModalSubmitInvoice[];
  allocationDate: string;
  /** Readjust: true when the payment amount differs from the saved value. */
  paymentAmountEdited?: boolean;
  /** Readjust: true when payment date, method, or reference number changed. */
  paymentDetailsEdited?: boolean;
  /** Readjust: true when allocation row amounts differ from saved values. */
  allocationAmountEdited?: boolean;
}

/** Single allocation item in POST /Payment/adjust-allocations 409 response. */
export interface PaymentAdjustAllocationConflictAllocationDto {
  paymentAllocationId?: string;
  /** API may return `paymentAllocationID`. */
  paymentAllocationID?: string | null;
  invoiceId?: string;
  /** API may return `invoicesID`. */
  invoicesID?: string | null;
  invoiceAmount?: number;
  amountApplied?: number;
  balanceDue?: number;
  allocationDate?: string;
  invoiceNo?: string;
  invoiceDate?: string;
  dueDate?: string;
  paymentNumber?: string | null;
  paymentDate?: string;
  referenceNumber?: string | null;
  editSkipped?: boolean;
  editSkipMessage?: string | null;
}

export interface PaymentAdjustAllocationConflictDto {
  message: string;
  paymentId: string;
  oldPaymentAmount: number;
  newPaymentAmount: number;
  paymentNumber?: string | null;
  paymentDate?: string | null;
  referenceNumber?: string | null;
  paymentTypeId?: string | null;
  paymentTypeName?: string | null;
  amount?: number;
  appliedAmount?: number;
  refundedAmount?: number;
  availableAmount?: number;
  allocations: PaymentAdjustAllocationConflictAllocationDto[];
}

/** GET /Payment/{paymentId}/review-allocations — review screen payload (no old/new amounts). */
export interface PaymentReviewAllocationsResponseDto {
  paymentId?: string | null;
  paymentNumber?: string | null;
  paymentDate?: string | null;
  referenceNumber?: string | null;
  paymentTypeId?: string | null;
  paymentTypeName?: string | null;
  allocationStatus?: number | null;
  amount?: number | null;
  appliedAmount?: number | null;
  refundedAmount?: number | null;
  availableAmount?: number | null;
  allocations?:
    | PaymentAdjustAllocationConflictAllocationDto[]
    | {
        data?: PaymentAdjustAllocationConflictAllocationDto[] | null;
        Data?: PaymentAdjustAllocationConflictAllocationDto[] | null;
        totalRecords?: number;
        TotalRecords?: number;
      }
    | null;
}

/** `/Payment/{paymentId}/review-allocations` with allocations list unwrapped for pagination. */
export type PaymentReviewAllocationsResult = Omit<
  PaymentReviewAllocationsResponseDto,
  'allocations'
> & {
  totalRecords: number;
  allocations: PaymentAdjustAllocationConflictAllocationDto[];
};

export interface SettlePendingInvoicesModalPagination {
  serverSide?: boolean;
  currentPage: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (newPageSize: number) => void;
}

/** Payment metadata shown in settle / view modal slate (from list row or API). */
export interface PaymentModalPaymentInfo {
  paymentNumber?: string | null;
  paymentDate?: string | null;
  paymentTypeId?: string | null;
  paymentTypeName?: string | null;
  referenceNumber?: string | null;
  /** Shown under payment # (same as invoice modal billing name line). */
  requesterName?: string | null;
}

export interface PaymentDetailModalPagination {
  serverSide?: boolean;
  currentPage: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (newPageSize: number) => void;
}

export type SettlePendingInvoicesModalMode = 'pending' | 'readjust';

/** Create-payment flow inside settle modal: entry form, then apply to invoices. */
export type CreatePaymentPhase = 'entry' | 'apply';

export interface PaymentEntryFormState {
  paymentDate: string;
  amount: string;
  paymentTypeId: string;
  referenceNumber: string;
}

export interface SettlePendingInvoicesModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Override dialog title (e.g. readjust settled invoices). */
  title?: string;
  mode?: SettlePendingInvoicesModalMode;
  /** Payment number, date, type, and status for the slate payment info section. */
  paymentInfo?: PaymentModalPaymentInfo | null;
  /** Payment amount available for this settlement. */
  totalPayment?: number;
  /** Previous payment amount (readjust mode). */
  oldPaymentAmount?: number;
  /** Amount already applied from this payment before this settlement. */
  paymentUsedBefore?: number;
  /** Amount already refunded from this payment before this settlement. */
  paymentRefundedBefore?: number;
  /** Invoice rows to settle. */
  invoiceRows?: SettlePendingInvoiceRow[];
  /** Optional loading state while unpaid invoices are being fetched. */
  loading?: boolean;
  error?: string | null;
  submitting?: boolean;
  onSubmit?: (payload: SettlePendingInvoicesModalSubmitPayload) => Promise<boolean> | boolean;
  pagination?: SettlePendingInvoicesModalPagination;
  /** When set, modal records a new payment then applies it to invoices in one flow. */
  createPhase?: CreatePaymentPhase | null;
  paymentEntry?: PaymentEntryFormState;
  onPaymentEntryChange?: (patch: Partial<PaymentEntryFormState>) => void;
  paymentEntryErrors?: Partial<Record<keyof PaymentEntryFormState, string>>;
  onSaveNewPayment?: () => Promise<boolean> | boolean;
  /** Department payment type options for entry / readjust dropdowns. */
  paymentTypeOptions?: import('@/components/smsatoms').SMSDropdownOption[];
  paymentTypesLoading?: boolean;
  /** Review/edit payment: amount already applied to invoices. */
  readjustAppliedAmount?: number;
  readjustAdjustAmount?: string;
  readjustPaymentFields?: ReadjustPaymentFields;
  onReadjustPaymentFieldsChange?: (patch: Partial<ReadjustPaymentFields>) => void;
  readjustHasPaymentDetailsEdit?: boolean;
  isEditingReadjustAmount?: boolean;
  onReadjustAdjustAmountChange?: (value: string) => void;
  onToggleReadjustAmountEdit?: () => void;
  /** Closes payment-amount edit mode (e.g. when editing row allocations instead). */
  onCloseReadjustAmountEdit?: () => void;
  /** Voids a single allocation row (readjust / review allocations). */
  onVoidAllocation?: (paymentAllocationId: string, reason: string) => Promise<void> | void;
  /** Allocation row currently being voided (for per-row loading state). */
  voidingPaymentAllocationId?: string | null;
  /** Readjust rows skipped by the server on the last submit (highlighted, modal stays open). */
  skippedAllocationIds?: string[];
  /** Server validation error from the last readjust submit (inline banner, not a confirm dialog). */
  submitError?: string | null;
  onClearSubmitError?: () => void;
  /** Enables allocation row editing after user confirms a payment-amount conflict (HTTP 409). */
  enableAllocationEditing?: boolean;
}

export interface PaymentDetailModalComponentProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  totalPayment?: number;
  paymentUsed?: number;
  refundedAmount?: number;
  invoiceDueTotal?: number;
  availableBalance?: number;
  loading?: boolean;
  error?: string | null;
  columns: DataTableColumn<PaymentDetailInvoiceDto>[];
  data: PaymentDetailInvoiceDto[];
  emptyMessage?: string;
  pagination?: PaymentDetailModalPagination;
  paymentInfo?: PaymentModalPaymentInfo | null;
}

export interface RefundPaymentDto {
  refundPaymentID?: string | null;
  requesterID: string;
  amount: number;
  paymentDate: string;
  referenceNumber?: string | null;
  paymentTypeId: string;
}

export interface RefundPaymentAllocationItemDto {
  paymentId: string;
  amount: number;
}

export interface RefundPaymentAllocateDto {
  refundPayment: RefundPaymentDto;
  payments: RefundPaymentAllocationItemDto[];
}

export interface RefundPaymentAllocateResponseDto {
  refundPayment?: RefundPaymentDto | null;
  allocations?: unknown[] | null;
}

export interface RefundPaymentAllocatePayload {
  requesterID: string;
  paymentDate: string;
  paymentTypeId: string;
  referenceNumber?: string | null;
  payments: RefundPaymentAllocationItemDto[];
}

export interface RecordRefundModalProps {
  isOpen: boolean;
  onClose: () => void;
  requesterName: string;
  payments: RequesterPaymentRowDto[];
  loading: boolean;
  error: string | null;
  columns: import('@/components/smsorganisms').DataTableColumn<RequesterPaymentRowDto>[];
  pagination?: SettlePendingInvoicesModalPagination;
  refundAmount: number;
  selectedCount: number;
  totalEscrowAvailable: number;
  value: PaymentEntryFormState;
  onChange: (patch: Partial<PaymentEntryFormState>) => void;
  errors?: Partial<Record<keyof PaymentEntryFormState, string>>;
  submitting?: boolean;
  onSubmit: () => Promise<boolean> | boolean;
  paymentTypeOptions?: import('@/components/smsatoms').SMSDropdownOption[];
  paymentTypesLoading?: boolean;
}
