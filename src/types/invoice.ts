import type { RequestResponse } from '@/types/request';
import type { InvoicePaymentSlateInput } from '@/types/paymentModalSlate';

/** Logo in invoice detail response (base64 image). */
export interface InvoiceLogoDto {
  contentType?: string | null;
  base64?: string | null;
}

/** Response from GET invoice details: items + optional logo. */
export interface InvoiceDetailsResponseDto {
  items: InvoiceDetailDto[];
  logo?: InvoiceLogoDto | null;
  /** True when any line has financial impact other than None (computed on backend). */
  isUpdated?: boolean;
}

/** One row returned by GET view-original (minimal fields for the invoice table). */
export type ViewOriginalInvoiceLineItemDto = Pick<
  InvoiceDetailDto,
  | 'invoiceDetailID'
  | 'jobId'
  | 'jobName'
  | 'jobDate'
  | 'jobTime'
  | 'workEndTime'
  | 'postStartTime'
  | 'postLength'
  | 'financialImpactType'
  | 'officerName'
  | 'rate'
  | 'officerRate'
  | 'specialRate'
  | 'hours'
  | 'vehicleFeeAmount'
  | 'equipmentFeeAmount'
  | 'totalAmount'
>;

/** Response from GET view-original: slim line items + invoice header totals (no bill-from/to). */
export interface ViewOriginalInvoiceDetailsResponseDto {
  items: ViewOriginalInvoiceLineItemDto[];
  officerHourlyTotal?: number | null;
  officerFeesTotal?: number | null;
  agencyFeesTotal?: number | null;
  vehicleFeesTotal?: number | null;
  equipmentFeesTotal?: number | null;
  total?: number | null;
  paymentsApplied?: number | null;
  balanceDue?: number | null;
}

/** Response from GET /InvoiceDetail/view-previous (read-only, no DB changes). */
export interface ViewPreviousInvoiceDetailResponseDto {
  item?: InvoiceDetailDto;
  canViewPrevious?: boolean;
  CanViewPrevious?: boolean;
  anchorInvoiceDetailId?: string | number;
  AnchorInvoiceDetailId?: string | number;
  Item?: InvoiceDetailDto;
}

/** Invoice line item; supports both legacy and new API field names. */
export interface InvoiceDetailDto {
  invoiceDetailID?: string | number;
  invoicesID?: string | number;
  /** Some APIs return "closePostPositionID" (without trailing 'd'). */
  closePostPositionID?: string | null;
  closedPostPositionId?: string | null;
  jobId?: string | null;
  jobName?: string | null;
  /** API returns jobDate; also supports dateTime for backward compatibility */
  jobDate?: string | null;
  jobTime?: string | null;
  /** Closed job end time from API (TimeOnly); preview has it on the line, saved invoice may nest it under closedPostPosition. */
  workEndTime?: string | null;
  /** Post/shift start (TimeOnly); used with postLength when workEndTime is absent */
  postStartTime?: string | null;
  /** Post/shift length in minutes (same semantics as Post.postLength) */
  postLength?: number | null;
  /** API returns officerName; also supports officer for backward compatibility */
  officerName?: string | null;
  officer?: string | null;
  rate?: number | null;
  /** Base officer hourly rate before alcohol/event special rate is added. */
  officerRate?: number | null;
  /** Officer special rate when alcohol was served/consumed (from invoice detail API). */
  specialRate?: number | null;
  hours?: number | null;
  /** When true, billed hours reflect minimum hours due rather than hours worked. */
  isMinimumDue?: boolean | null;
  /** API returns feesAmount; also supports fees for backward compatibility */
  feesAmount?: number | null;
  fees?: number | null;
  /** Optional vehicle and equipment fee amounts per line item */
  vehicleFeeAmount?: number | null;
  equipmentFeeAmount?: number | null;
  /** Backend VehicleOwnedByType (see {@link VehicleOwnedByType}). */
  vehicleOwnedBy?: number | string | null;
  /** From GET /InvoiceDetail/invoice/{id} line items */
  payableDirectlyTo?: string | null;
  isPayableToOfficer?: boolean | null;
  /** API returns totalAmount; also supports total for backward compatibility */
  totalAmount?: number | null;
  total?: number | null;
  /** Indicates invoice was generated for the linked closed post position. */
  isInvoiced?: boolean | null;
  /** Financial impact from ClosedPostPosition: 0=None, 1=Debit, 2=Credit, 3=Modified */
  financialImpactType?: number | null;
  /** Populated on view-previous responses: anchor invoice detail ID from the request. */
  currentInvoiceDetailId?: string | number | null;
  CurrentInvoiceDetailId?: string | number | null;
  /** Some APIs return this computed field directly on invoice details rows. */
  closedPostFinancialImpactType?: number | null;
  createdDate?: string | null;
  editedDate?: string | null;
  /** Optional expanded closed-post-position payload returned by API */
  closedPostPosition?: {
    closedPostPositionID?: string | null;
    closedPostPositionId?: string | null;
    workEndTime?: string | null;
    WorkEndTime?: string | null;
    isInvoiced?: boolean | null;
    IsInvoiced?: boolean | null;
    financialImpactType?: number | null;
    FinancialImpactType?: number | null;
  } | null;
}

/** Display row for invoice grid (InvoiceList) */
export interface InvoiceRow {
  invoicesID: string | number;
  invoiceNo: string;
  invoiceDate: string;
  startDate: string;
  endDate: string;
  dueDate: string;
  customer: string;
  total: string;
  paid: string;
  balanceDue: string;
}

/** One requester row from POST /Invoice/requester-invoice-counts */
export interface RequesterInvoiceCountItem {
  requesterId: string;
  requesterName: string;
  invoicesCount: number;
  hasUnpaidInvoice?: boolean;
}

export interface RequesterInvoiceCountsParams {
  page?: number;
  pageSize?: number;
  /** Requester dropdown filter — POST body `requesterId`. */
  requesterId?: string | null;
  /** Search field — POST body `searchTerm`. */
  searchTerm?: string | null;
  isPaid?: boolean | null;
  /** Due-date range in days (30, 60, or 90) — POST body `dueDateRangeDays`. */
  dueDateRangeDays?: InvoiceDueDateRange | null;
}

export interface RequesterInvoiceCountsResponse {
  data: RequesterInvoiceCountItem[];
  totalRecords: number;
  page?: number;
  pageSize?: number;
  sortDirection?: string;
}

/** Cached invoices for an expanded requester (GET /Invoice/by-requester). */
export interface RequesterInvoicesCacheEntry {
  data: InvoiceDto[];
  totalRecords: number;
  page: number;
  pageSize: number;
  loading: boolean;
  error: string | null;
}

export interface InvoiceDto {
  invoicesID: string | number;
  invoiceNo?: string | null;
  dateCreated?: string | null;
  dueDate?: string | null;
  jobPositionStartDate?: string | null;
  jobPositionEndDate?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  billingFromName?: string | null;
  billingFromAddress?: string | null;
  billingFromPhoneNumber?: string | null;
  billingFromEmail?: string | null;
  billingFromContact?: string | null;
  billingToName?: string | null;
  billingToAddress?: string | null;
  billingToPhoneNumber?: string | null;
  billingToEmail?: string | null;
  billingToContact?: string | null;
  officerHourlyTotal?: number | null;
  officerFeesTotal?: number | null;
  agencyFeesTotal?: number | null;
  vehicleFeesTotal?: number | null;
  equipmentFeesTotal?: number | null;
  total?: number | null;
  paymentsApplied?: number | null;
  balanceDue?: number | null;
  /** Whether the invoice has been fully paid (from GET /Invoice/by-requester). */
  isPaid?: boolean | null;
  requesterID?: string | null;
  requesterName?: string | null;
  invoiceDetails?: InvoiceDetailDto[] | null;
  /**
   * Post/shift length in minutes (invoice-level; used when line items omit postLength).
   * Backend may also send PostLength (PascalCase).
   */ 
  postLength?: number | null;
  jobTime?: string | null;
  /** From department invoice configuration / request invoice data */
  payableDirectlyTo?: string | null;
  isPayableToOfficer?: boolean | null;
}

/** One row in GET /Invoice/{invoicesId}/payment-information → paymentHistory */
export interface InvoicePaymentHistoryItemDto {
  paymentAllocationID?: string | null;
  invoicesID?: string | null;
  paymentID?: string | null;
  paymentNumber?: string | null;
  amountApplied?: number | null;
  allocationDate?: string | null;
  paymentTypeId?: string | null;
  paymentTypeName?: string | null;
  referenceNumber?: string | null;
  paymentDate?: string | null;
  transactionType?: number | null;
  createdBy?: string | null;
  editedBy?: string | null;
  reason?: string | null;
}

/** GET /Invoice/{invoicesId}/payment-information */
export interface InvoicePaymentInformationDto {
  invoice: InvoiceDto;
  paymentHistory: InvoicePaymentHistoryItemDto[];
  availableBalance: number;
  /** Total payments applied to this invoice. */
  paymentApplied: number;
  remainingDue: number;
}

/** GET /Invoice/{invoiceId}/payment-summary — one row per payment (net applied on invoice). */
export interface InvoicePaymentSourceSummaryDto {
  paymentId: string;
  paymentNumber?: string | null;
  paymentDate?: string | null;
  paymentTypeId?: string | null;
  paymentTypeName?: string | null;
  referenceNumber?: string | null;
  /** Original payment amount from the payment record. */
  paymentAmount?: number | null;
  paidAmount: number;
}

export interface InvoicePaymentSummaryDto {
  invoiceId: string;
  total: number;
  paidAmount: number;
  balanceDue: number;
  payments: InvoicePaymentSourceSummaryDto[];
}

/** POST /PaymentAllocation/invoice-refund */
export interface InvoiceRefundAllocationItemDto {
  paymentId: string;
  amount: number;
}

export interface InvoiceRefundAllocationsDto {
  invoiceId: string;
  requiredRefundAmount: number;
  payments: InvoiceRefundAllocationItemDto[];
}

export interface RefundPaymentAllocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceId: string;
  refundRequired: number;
  /** Explanation from the backend 409 refund-required response. */
  refundMessage: string;
  onAfterRefund: () => void | Promise<void>;
  title?: string;
  afterRefundFailedMessage?: string;
}

import type { InvoiceConflictEditPayload } from '@/types/invoiceConflict';

export interface InvoiceRefundRequired {
  message: string;
  refundRequired: number;
  invoiceId?: string;
  postPositionId?: string;
  closedPostPositionId?: string;
  editPayload?: InvoiceConflictEditPayload;
}

export type InvoiceRefundActionResult =
  | { success: true }
  | { success: false; refund: InvoiceRefundRequired };

export class InvoiceRefundRequiredError extends Error {
  readonly refundRequired: number;
  readonly postPositionId?: string;
  readonly invoiceId?: string;
  readonly closedPostPositionId?: string;
  readonly editPayload?: InvoiceConflictEditPayload;

  constructor(refund: InvoiceRefundRequired) {
    super(refund.message);
    this.name = 'InvoiceRefundRequiredError';
    this.refundRequired = refund.refundRequired;
    this.postPositionId = refund.postPositionId;
    this.invoiceId = refund.invoiceId;
    this.closedPostPositionId = refund.closedPostPositionId;
    this.editPayload = refund.editPayload;
  }

  toFailure(overrides?: Partial<InvoiceRefundRequired>): Extract<InvoiceRefundActionResult, { success: false }> {
    return {
      success: false,
      refund: {
        message: this.message,
        refundRequired: this.refundRequired,
        invoiceId: this.invoiceId,
        postPositionId: this.postPositionId,
        closedPostPositionId: this.closedPostPositionId,
        editPayload: this.editPayload,
        ...overrides,
      },
    };
  }
}

export interface InvoicePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Loads GET /Invoice/{invoiceId}/payment-summary when the modal opens. */
  invoicesId?: string | null;
  /** Invoice header fields for the summary view without loading payment-information. */
  invoiceHeader?: Pick<
    InvoicePaymentSlateInput,
    'invoiceNo' | 'billingToName' | 'dateCreated' | 'dueDate'
  >;
  /** View-only: no discard actions on the payment summary. */
  readOnly?: boolean;
  /** Overrides modal title when provided. */
  title?: string;
  onViewInvoice?: () => void;
  /** Opens payment flow when amount remaining is greater than zero. */
  onPayment?: () => void;
  onPaymentSaved?: () => void;
}

import type { InvoiceModifyConflictState } from '@/utils/invoiceModifyConflict';

export interface InvoicePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  request?: RequestResponse;
  /** Requester-level invoice flow: choose one or more requests before searching. */
  requestOptions?: RequestResponse[];
  /** When provided, display this invoice directly (no fetch). Used from invoice grid View Details. */
  invoice?: InvoiceDto | null;
  /** Refreshes invoice list/header after modify, undo, refund, or generate. */
  onInvoiceUpdated?: () => Promise<void> | void;
  /** Called when user clicks "Generate Invoice". Optional for now; can trigger API or download. */
  onGenerateInvoice?: () => void;
  /** Closed-job edit/unclose 409: auto modify mode, highlight line, open refund allocation. */
  modifyConflict?: InvoiceModifyConflictState | null;
  /** Clears conflict handoff state after refund + optional pending job action completes. */
  onModifyConflictHandled?: () => void;
  /** Where Back should go after redirecting to Payment History from preview. */
  paymentReturnPath?: string;
  /** Location state to restore when returning via paymentReturnPath. */
  paymentReturnState?: unknown;
}

import type { PaginationParams } from '@/utils/paginationUtils';

export type InvoiceIsPaidFilter = 'all' | '1' | '0';

/** Due-date range filter values (days) accepted by invoice requester APIs. */
export type InvoiceDueDateRange = 30 | 60 | 90;

export type InvoiceDueDateRangeFilter = 'all' | `${InvoiceDueDateRange}`;

export const toInvoiceDueDateRangeParam = (
  filter: InvoiceDueDateRangeFilter
): InvoiceDueDateRange | undefined => {
  if (filter === 'all') return undefined;
  const days = Number(filter);
  return days === 30 || days === 60 || days === 90 ? days : undefined;
};

export interface InvoiceSearchParams extends PaginationParams {
  requesterId?: string | null;
  searchTerm?: string;
  /** true = paid, false = unpaid; omit for all invoices */
  isPaid?: boolean;
  /** Due-date range in days (30, 60, or 90). */
  dueDateRangeDays?: InvoiceDueDateRange | null;
}

/** Backend FinancialImpactType: None = 0, Debit = 1, Credit = 2, Modified = 3 (manual UI edit). */
export const INVOICE_DETAIL_FINANCIAL_IMPACT = {
  NONE: 0,
  DEBIT: 1,
  CREDIT: 2,
  MODIFIED: 3,
} as const;

export const getInvoiceDetailFinancialImpactType = (row: InvoiceDetailDto): number => {
  const rowExt = row as InvoiceDetailDto & { FinancialImpactType?: number | null };
  const closed = row.closedPostPosition;
  const closedExt = closed as { FinancialImpactType?: number | null } | null | undefined;

  return (
    row.financialImpactType ??
    rowExt.FinancialImpactType ??
    row.closedPostFinancialImpactType ??
    closed?.financialImpactType ??
    closedExt?.FinancialImpactType ??
    INVOICE_DETAIL_FINANCIAL_IMPACT.NONE
  );
};

/** workEndTime on the line (preview), else closedPostPosition.workEndTime (saved invoice detail). */
export const getInvoiceLineEndTimeRaw = (row: InvoiceDetailDto): string | null => {
  const rowExt = row as InvoiceDetailDto & { WorkEndTime?: string | null };
  const fromRow = row.workEndTime ?? rowExt.WorkEndTime ?? null;
  if (fromRow) return fromRow;

  const closed = row.closedPostPosition;
  const closedExt = closed as { WorkEndTime?: string | null } | null | undefined;
  return closed?.workEndTime ?? closedExt?.WorkEndTime ?? null;
};

export const invoiceDetailsHasModifiedLines = (items: InvoiceDetailDto[]): boolean =>
  items.some(
    (row) => getInvoiceDetailFinancialImpactType(row) === INVOICE_DETAIL_FINANCIAL_IMPACT.MODIFIED
  );

export const getInvoiceIsPaid = (invoice: InvoiceDto): boolean | null => {
  const ext = invoice as InvoiceDto & { IsPaid?: boolean | null };
  if (invoice.isPaid != null) return invoice.isPaid;
  if (ext.IsPaid != null) return ext.IsPaid;
  return null;
};

/** Backend VehicleOwnedByType. */
export enum VehicleOwnedByType {
  /** City owned vehicle. */
  City = 1,
  /** Employee owned vehicle. */
  Employee = 2,
  /** Other ownership. */
  Other = 3,
}

/** Invoice payable summary layout variant. */
export enum InvoicePayableSplitVariant {
  /** City owned vehicle, payable to officer. */
  City = 1,
  /** Employee owned vehicle, payable to officer. */
  Employee = 2,
  /** Employee and city owned vehicles on the same invoice, payable to officer. */
  Mixed = 3,
  /** City owned vehicle, not payable to officer. */
  CityDirect = 4,
}

export const getInvoiceDetailVehicleOwnedBy = (row: InvoiceDetailDto): number | null => {
  const rowExt = row as InvoiceDetailDto & { VehicleOwnedBy?: number | string | null };
  const raw = row.vehicleOwnedBy ?? rowExt.VehicleOwnedBy;
  if (raw == null || String(raw).trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

export const getInvoiceDetailVehicleFeeAmount = (row: InvoiceDetailDto): number => {
  const rowExt = row as InvoiceDetailDto & { VehicleFeeAmount?: number | null };
  const raw = row.vehicleFeeAmount ?? rowExt.VehicleFeeAmount;
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
};

const sumLineFeesByVehicleOwnedBy = (
  lineItems: InvoiceDetailDto[],
  ownedBy: VehicleOwnedByType,
  getAmount: (row: InvoiceDetailDto) => number
): number =>
  lineItems
    .filter((row) => getInvoiceDetailVehicleOwnedBy(row) === ownedBy)
    .reduce((acc, row) => acc + getAmount(row), 0);

export const getInvoiceIsPayableToOfficerFlag = (invoice: InvoiceDto): boolean => {
  const ext = invoice as InvoiceDto & { IsPayableToOfficer?: boolean | null };
  const raw: unknown = invoice.isPayableToOfficer ?? ext.IsPayableToOfficer;
  return raw === true || raw === 'true' || raw === 1 || raw === '1';
};

export const getInvoiceDetailIsPayableToOfficer = (row: InvoiceDetailDto): boolean => {
  const ext = row as InvoiceDetailDto & { IsPayableToOfficer?: boolean | null };
  const raw: unknown = row.isPayableToOfficer ?? ext.IsPayableToOfficer;
  return raw === true || raw === 'true' || raw === 1 || raw === '1';
};

export const getInvoicePayableDirectlyToLabel = (invoice: InvoiceDto): string => {
  const ext = invoice as InvoiceDto & { PayableDirectlyTo?: string | null };
  return (invoice.payableDirectlyTo ?? ext.PayableDirectlyTo ?? '').trim();
};

export const getInvoiceDetailPayableDirectlyTo = (row: InvoiceDetailDto): string => {
  const ext = row as InvoiceDetailDto & { PayableDirectlyTo?: string | null };
  return (row.payableDirectlyTo ?? ext.PayableDirectlyTo ?? '').trim();
};

const invoiceDetailHasIsPayableToOfficer = (row: InvoiceDetailDto): boolean => {
  const ext = row as InvoiceDetailDto & { IsPayableToOfficer?: boolean | null };
  return row.isPayableToOfficer != null || ext.IsPayableToOfficer != null;
};

/** Prefer line items (GET /InvoiceDetail/invoice) when present; invoice header may omit or stale these fields. */
export const resolveInvoiceIsPayableToOfficer = (
  invoice: InvoiceDto,
  lineItems: InvoiceDetailDto[]
): boolean => {
  const rowWithFlag = lineItems.find(invoiceDetailHasIsPayableToOfficer);
  if (rowWithFlag) {
    return getInvoiceDetailIsPayableToOfficer(rowWithFlag);
  }
  return getInvoiceIsPayableToOfficerFlag(invoice);
};

/** Prefer line items (GET /InvoiceDetail/invoice) when present; invoice header may omit these fields. */
export const resolveInvoicePayableDirectlyToLabel = (
  invoice: InvoiceDto,
  lineItems: InvoiceDetailDto[]
): string => {
  for (const row of lineItems) {
    const label = getInvoiceDetailPayableDirectlyTo(row);
    if (label) return label;
  }
  return getInvoicePayableDirectlyToLabel(invoice);
};

export const invoiceHasEmployeeOwnedVehicle = (lineItems: InvoiceDetailDto[]): boolean =>
  lineItems.some((row) => getInvoiceDetailVehicleOwnedBy(row) === VehicleOwnedByType.Employee);

export const invoiceHasCityOwnedVehicle = (lineItems: InvoiceDetailDto[]): boolean =>
  lineItems.some((row) => getInvoiceDetailVehicleOwnedBy(row) === VehicleOwnedByType.City);

/** True when no line item has vehicleOwnedBy (closed post position has no vehicle). */
export const invoiceHasNoVehicle = (lineItems: InvoiceDetailDto[]): boolean =>
  !lineItems.some((row) => getInvoiceDetailVehicleOwnedBy(row) != null);

/** True when line items include both employee- and city-owned vehicles. */
export const invoiceHasMixedEmployeeAndCityVehicle = (lineItems: InvoiceDetailDto[]): boolean =>
  invoiceHasEmployeeOwnedVehicle(lineItems) && invoiceHasCityOwnedVehicle(lineItems);

/** True when line items disagree on vehicleOwnedBy (e.g. one City, one Employee). */
export const invoiceHasMixedVehicleOwnedBy = (lineItems: InvoiceDetailDto[]): boolean => {
  const ownedByTypes = new Set<number>();
  for (const row of lineItems) {
    const ownedBy = getInvoiceDetailVehicleOwnedBy(row);
    if (ownedBy != null) ownedByTypes.add(ownedBy);
  }
  return ownedByTypes.size > 1;
};

export const getInvoicePayableSplitVariant = (
  invoice: InvoiceDto,
  lineItems: InvoiceDetailDto[]
): InvoicePayableSplitVariant | null => {
  const isPayableToOfficer = resolveInvoiceIsPayableToOfficer(invoice, lineItems);

  if (invoiceHasMixedEmployeeAndCityVehicle(lineItems) && isPayableToOfficer) {
    return InvoicePayableSplitVariant.Mixed;
  }

  if (invoiceHasMixedVehicleOwnedBy(lineItems)) return null;

  const hasEmployeeVehicle = invoiceHasEmployeeOwnedVehicle(lineItems);
  const hasCityVehicle = invoiceHasCityOwnedVehicle(lineItems);

  if (isPayableToOfficer && hasEmployeeVehicle) return InvoicePayableSplitVariant.Employee;
  if (isPayableToOfficer && (hasCityVehicle || invoiceHasNoVehicle(lineItems))) {
    return InvoicePayableSplitVariant.City;
  }
  if (!isPayableToOfficer && hasCityVehicle) return InvoicePayableSplitVariant.CityDirect;
  return null;
};

export type InvoiceSummarySource = Pick<
  InvoiceDto,
  | 'officerHourlyTotal'
  | 'officerFeesTotal'
  | 'agencyFeesTotal'
  | 'vehicleFeesTotal'
  | 'equipmentFeesTotal'
  | 'total'
  | 'paymentsApplied'
  | 'balanceDue'
>;

export interface InvoicePayableSplitSummaryResult {
  variant: InvoicePayableSplitVariant;
  payableDirectlyTo: string;
  officerHourlyTotal: number;
  vehicleFeesTotal: number;
  equipmentFeesTotal: number;
  officerFeesTotal: number;
  agencyFeesTotal: number;
  /** Employee-owned vehicle fees (Mixed variant). */
  employeeVehicleFeesTotal?: number;
  /** City-owned vehicle fees (Mixed variant). */
  cityVehicleFeesTotal?: number;
  totalPayableToOfficer: number | null;
  totalPayableDirectlyTo: number;
  grandTotal: number;
  paymentsApplied: number;
  balanceDue: number;
  /** When true, hide vehicle fee row in direct-payable section (no vehicle + payable to officer). Equipment fees still show when non-zero. */
  hideVehicleAndEquipmentFees?: boolean;
}

/** Prefer line items that include payable fields (invoice detail API or request-data). */
export const getLineItemsForPayableSplit = (
  displayLineItems: InvoiceDetailDto[],
  payableLineItems?: InvoiceDetailDto[]
): InvoiceDetailDto[] => {
  if (payableLineItems?.length) return payableLineItems;
  return displayLineItems;
};

export const buildInvoicePayableSplitSummary = (
  invoice: InvoiceDto,
  lineItems: InvoiceDetailDto[],
  summarySource: InvoiceSummarySource
): InvoicePayableSplitSummaryResult | null => {
  const variant = getInvoicePayableSplitVariant(invoice, lineItems);
  if (!variant) return null;

  const officerHourlyTotal = summarySource.officerHourlyTotal ?? 0;
  const vehicleFeesTotal = summarySource.vehicleFeesTotal ?? 0;
  const equipmentFeesTotal = summarySource.equipmentFeesTotal ?? 0;
  const officerFeesTotal = summarySource.officerFeesTotal ?? 0;
  const agencyFeesTotal = summarySource.agencyFeesTotal ?? 0;
  const payableDirectlyTo = resolveInvoicePayableDirectlyToLabel(invoice, lineItems);
  const hideVehicleAndEquipmentFees =
    variant === InvoicePayableSplitVariant.City && invoiceHasNoVehicle(lineItems);

  const base = {
    variant,
    payableDirectlyTo,
    officerHourlyTotal,
    vehicleFeesTotal,
    equipmentFeesTotal,
    officerFeesTotal,
    agencyFeesTotal,
    paymentsApplied: summarySource.paymentsApplied ?? 0,
    hideVehicleAndEquipmentFees,
  };

  const withTotals = (
    totalPayableToOfficer: number | null,
    totalPayableDirectlyTo: number,
    mixedFees?: Pick<
      InvoicePayableSplitSummaryResult,
      'employeeVehicleFeesTotal' | 'cityVehicleFeesTotal'
    >
  ): InvoicePayableSplitSummaryResult => {
    const grandTotal =
      summarySource.total ??
      (totalPayableToOfficer ?? 0) + totalPayableDirectlyTo;
    return {
      ...base,
      ...mixedFees,
      totalPayableToOfficer,
      totalPayableDirectlyTo,
      grandTotal,
      balanceDue:
        summarySource.balanceDue ?? grandTotal - (summarySource.paymentsApplied ?? 0),
    };
  };

  if (variant === InvoicePayableSplitVariant.Employee) {
    return withTotals(
      officerHourlyTotal + vehicleFeesTotal + equipmentFeesTotal,
      officerFeesTotal + agencyFeesTotal
    );
  }

  if (variant === InvoicePayableSplitVariant.Mixed) {
    const employeeVehicleFeesTotal = sumLineFeesByVehicleOwnedBy(
      lineItems,
      VehicleOwnedByType.Employee,
      getInvoiceDetailVehicleFeeAmount
    );
    const cityVehicleFeesTotal = sumLineFeesByVehicleOwnedBy(
      lineItems,
      VehicleOwnedByType.City,
      getInvoiceDetailVehicleFeeAmount
    );
    return withTotals(
      officerHourlyTotal + employeeVehicleFeesTotal,
      cityVehicleFeesTotal + officerFeesTotal + agencyFeesTotal + equipmentFeesTotal,
      {
        employeeVehicleFeesTotal,
        cityVehicleFeesTotal,
      }
    );
  }

  const totalPayableDirectlyTo =
    vehicleFeesTotal + officerFeesTotal + agencyFeesTotal + equipmentFeesTotal;

  if (variant === InvoicePayableSplitVariant.CityDirect) {
    return withTotals(null, totalPayableDirectlyTo);
  }

  return withTotals(officerHourlyTotal, totalPayableDirectlyTo);
};

/** Invoice amounts from API may include up to 3 decimal places (e.g. vehicleFeeAmount). */
export const INVOICE_AMOUNT_DECIMALS = 3;

const truncateInvoiceAmount = (value: number, decimals: number): number => {
  if (!Number.isFinite(value) || decimals < 0) return value;
  const factor = 10 ** decimals;
  return Math.trunc(value * factor) / factor;
};

/** Formats invoice currency for display (up to 3 decimals, truncates — no round-up). */
export const formatMileageCharge = (
  value: number | null | undefined,
  fallback = ''
): string => {
  if (value == null || !Number.isFinite(value)) return fallback;
  const normalized = truncateInvoiceAmount(value, INVOICE_AMOUNT_DECIMALS);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: INVOICE_AMOUNT_DECIMALS,
  }).format(normalized);
};

/** Matches backend GetUpdatedDateTime: EditedDate ?? CreatedDate. */