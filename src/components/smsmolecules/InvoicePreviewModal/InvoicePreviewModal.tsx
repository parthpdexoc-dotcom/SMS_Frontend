import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SMSModal as Modal } from '@/components/smsorganisms';
import { SMSDatePicker, SMSBox, SMSLoader, SMSMultiSelectDropdown, SMSIcon } from '@/components/smsatoms';
import { SMSPrintAction, SMSConfirmDialog, RefundPaymentAllocationModal } from '@/components/smsmolecules';
import { formatDateToYYYYMMDD, formatTimeToHHmm } from '@/utils/dateTimeUtils';
import { formatCurrency, formatPhoneNumber, formatDateShort } from '@/utils';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  generateInvoiceThunk,
  fetchInvoiceDetailsByInvoiceIdThunk,
  fetchViewOriginalInvoiceDetailsThunk,
  fetchViewPreviousInvoiceDetailsThunk,
  clearViewOriginalInvoiceDetails,
  clearViewPreviousInvoiceDetails,
  clearInvoicePreviewDetails,
  modifyInvoiceDetailsThunk,
  undoInvoiceModificationThunk,
} from '@/store/slices/invoiceSlice';
import {
  closePostPositionWithEquipmentThunk,
  unclosePostPositionThunk,
} from '@/store/slices/postPositionSlice';
import { showToast } from '@/store/slices/toastSlice';
import {
  applyConflictEditPayloadToEditedRows,
  findInvoiceLineIndexForConflict,
  invoiceLineMatchesModifyConflict,
  readInvoiceLineFeeAmount,
  type InvoiceModifyConflictState,
} from '@/utils/invoiceModifyConflict';
import './InvoicePreviewModal.css';
import { InvoiceDocumentSummary } from './InvoiceDocumentSummary';
import type { RequestResponse } from '@/types/request';
import {
  getInvoiceLineEndTimeRaw,
  invoiceDetailsHasModifiedLines,
  formatMileageCharge,
  type InvoiceDto,
  type InvoiceDetailDto,
  type InvoicePreviewModalProps,
} from '@/types/invoice';
import { getRequestInvoiceData } from '@/services/requestService';
import { buildCombinedProjectNumber } from '@/utils/requestInvoiceUtils';
import { INVOICE_GRID, PAYMENT_GRID } from '@/constants/strings';
import { buildRequesterScopedAdminRoute } from '@/utils/requesterAdminNavigation';
// import { formatDateShort } from '@/utils';

/** Stable default so `requestOptions = []` does not create a new array every render. */
const EMPTY_REQUEST_OPTIONS: ReadonlyArray<RequestResponse> = [];
const EMPTY_SELECTED_REQUESTS: RequestResponse[] = [];

const toDisplayDate = (value?: string | null) => {
  if (!value) return '-';
  const trimmed = value.trim();
  if (!trimmed) return '-';
  return trimmed.includes('T') ? trimmed.split('T')[0] : trimmed;
};

const renderInvoiceRateWithSpecial = (
  officerRate: number | null | undefined,
  specialRate: number
): React.ReactNode => (
  <span className="invoice-document__rate-breakdown">
    {formatCurrency(officerRate, '-')} + {formatCurrency(specialRate, '-')}
    <span className="invoice-document__special-rate-asterisk">*</span>
  </span>
);

const renderInvoiceHours = (hours: number | null | undefined, isMinimumDue?: boolean | null): React.ReactNode => {
  const display = hours ?? '-';
  if (!isMinimumDue) return display;
  return (
    <>
      {display}
      <span className="invoice-document__special-rate-asterisk">*</span>
    </>
  );
};

const formatRequestDateLabel = (value?: string | null): string => {
  if (!value?.trim()) return '-';
  return formatDateShort(value) || '-';
};

const getRequestOptionLabel = (req: RequestResponse): string => {
  const title = req.title?.trim() || req.requestID;
  const start = formatRequestDateLabel(req.startDate);
  const end = formatRequestDateLabel(req.endDate);
  const dates = start !== '-' || end !== '-' ? ` (${start} - ${end})` : '';
  return `${title}${dates}`;
};

const uniqueNonEmpty = (values: Array<string | null | undefined>): string[] =>
  Array.from(new Set(values.map((v) => (v ?? '').trim()).filter(Boolean)));

type EditableInvoiceLineFields = {
  rate: string;
  hours: string;
  vehicleFeeAmount: string;
  equipmentFeeAmount: string;
};

const formatNumericInput = (value?: number | null): string => {
  if (value === null || value === undefined) return '';
  return String(value);
};

const parseNumericInput = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const calcLineTotal = (
  rate: number | null,
  hours: number | null,
  vehicleFeeAmount: number | null,
  equipmentFeeAmount: number | null
): number | null => {
  if (rate === null && hours === null && vehicleFeeAmount === null && equipmentFeeAmount === null) {
    return null;
  }
  return (rate ?? 0) * (hours ?? 0) + (vehicleFeeAmount ?? 0) + (equipmentFeeAmount ?? 0);
};

const getInvoiceLineKey = (row: InvoiceDetailDto, index: number): string =>
  row.invoiceDetailID != null ? String(row.invoiceDetailID) : `row-${index}`;

const buildInitialEditedRows = (
  items: InvoiceDetailDto[]
): Record<string, EditableInvoiceLineFields> =>
  items.reduce<Record<string, EditableInvoiceLineFields>>((acc, row, index) => {
    const rowKey = getInvoiceLineKey(row, index);
    acc[rowKey] = {
      rate: formatNumericInput(row.rate),
      hours: formatNumericInput(row.hours),
      vehicleFeeAmount: formatNumericInput(
        readInvoiceLineFeeAmount(row, 'vehicleFeeAmount', 'VehicleFeeAmount')
      ),
      equipmentFeeAmount: formatNumericInput(
        readInvoiceLineFeeAmount(row, 'equipmentFeeAmount', 'EquipmentFeeAmount')
      ),
    };
    return acc;
  }, {});

/** Same row state as Modify Invoice, with optional conflict `editPayload` pre-filled on the matching line. */
const buildModifyEditedRows = (
  items: InvoiceDetailDto[],
  modifyConflict?: InvoiceModifyConflictState | null
): Record<string, EditableInvoiceLineFields> => {
  const initial = buildInitialEditedRows(items);
  if (!modifyConflict?.editPayload) return initial;

  return applyConflictEditPayloadToEditedRows(
    items,
    initial,
    getInvoiceLineKey,
    modifyConflict.closedPostPositionId,
    modifyConflict.editPayload
  );
};

const rowEditsChanged = (row: InvoiceDetailDto, edits: EditableInvoiceLineFields): boolean =>
  parseNumericInput(edits.rate) !== (row.rate ?? null) ||
  parseNumericInput(edits.hours) !== (row.hours ?? null) ||
  parseNumericInput(edits.vehicleFeeAmount) !==
    readInvoiceLineFeeAmount(row, 'vehicleFeeAmount', 'VehicleFeeAmount') ||
  parseNumericInput(edits.equipmentFeeAmount) !==
    readInvoiceLineFeeAmount(row, 'equipmentFeeAmount', 'EquipmentFeeAmount');

const buildInvoiceDetailUpdatePayload = (
  row: InvoiceDetailDto,
  edits: EditableInvoiceLineFields,
  invoicesId: string | number
): InvoiceDetailDto => {
  const rate = parseNumericInput(edits.rate);
  const hours = parseNumericInput(edits.hours);
  const vehicleFeeAmount = parseNumericInput(edits.vehicleFeeAmount);
  const equipmentFeeAmount = parseNumericInput(edits.equipmentFeeAmount);
  const totalAmount = calcLineTotal(rate, hours, vehicleFeeAmount, equipmentFeeAmount);

  return {
    ...row,
    invoiceDetailID: row.invoiceDetailID,
    invoicesID: row.invoicesID ?? invoicesId,
    rate,
    hours,
    vehicleFeeAmount,
    equipmentFeeAmount,
    totalAmount,
    total: totalAmount,
  };
};

type InvoiceSearchPayload = {
  projectNumber: string | string[];
  startDate: string;
  endDate: string;
};

const toDateOnly = (value?: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // If a jobTime comes in, drop time portion.
  return trimmed.includes('T') ? trimmed.split('T')[0] : trimmed;
};

const formatInvoiceLineItemDate = (value?: string | null): string => {
  if (!value?.trim()) return '-';

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(toDateOnly(value) ?? '');
  if (!match) return '-';

  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

/** Returns yesterday's date in YYYY-MM-DD (end date cannot be today or future). */
const getYesterdayDateString = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return formatDateToYYYYMMDD(d);
};

/** Earliest YYYY-MM-DD among the given values (ignores null/empty). */
const earliestDateString = (...values: Array<string | null | undefined>): string | undefined => {
  const valid = values.map((v) => toDateOnly(v)).filter(Boolean) as string[];
  if (valid.length === 0) return undefined;
  return valid.sort()[0];
};

/** Latest YYYY-MM-DD among the given values (ignores null/empty). */
const latestDateString = (...values: Array<string | null | undefined>): string | undefined => {
  const valid = values.map((v) => toDateOnly(v)).filter(Boolean) as string[];
  if (valid.length === 0) return undefined;
  return valid.sort()[valid.length - 1];
};

export const InvoicePreviewModal: React.FC<InvoicePreviewModalProps> = ({
  isOpen,
  onClose,
  onGenerateInvoice,
  onInvoiceUpdated,
  request,
  requestOptions = EMPTY_REQUEST_OPTIONS,
  invoice: invoiceProp,
  modifyConflict = null,
  onModifyConflictHandled,
  paymentReturnPath,
  paymentReturnState,
}) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const viewOriginalDetails = useAppSelector((s) => s.invoice.viewOriginalDetails);
  const viewOriginalLoading = useAppSelector((s) => s.invoice.viewOriginalLoading);
  const viewOriginalError = useAppSelector((s) => s.invoice.viewOriginalError);
  const viewPreviousItems = useAppSelector((s) => s.invoice.viewPreviousItems);
  const viewPreviousLoading = useAppSelector((s) => s.invoice.viewPreviousLoading);
  const viewPreviousError = useAppSelector((s) => s.invoice.viewPreviousError);
  const invoiceListItems = useAppSelector((s) => s.invoice.invoices);
  const invoiceDetailsItems = useAppSelector((s) => s.invoice.invoiceDetailsItems);
  const invoiceLogo = useAppSelector((s) => s.invoice.invoiceDetailsLogo);
  const detailsLoading = useAppSelector((s) => s.invoice.invoiceDetailsLoading);
  const detailsError = useAppSelector((s) => s.invoice.invoiceDetailsError);
  const invoiceDetailsIsUpdated = useAppSelector((s) => s.invoice.invoiceDetailsIsUpdated);
  const currentInvoiceFromStore = useAppSelector((s) => s.invoice.currentInvoice);
  const isModifyingInvoice = useAppSelector((s) => s.invoice.isModifyingInvoice);
  const isUndoingModification = useAppSelector((s) => s.invoice.isUndoingModification);
  const isGeneratingInvoice = useAppSelector((s) => s.invoice.isGenerating);
  const isRequesterInvoiceFlow = requestOptions.length > 0;
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [errorNote, setErrorNote] = React.useState<string | null>(null);
  const [errorExpanded, setErrorExpanded] = React.useState(true);
  const [fetchedInvoice, setFetchedInvoice] = React.useState<InvoiceDto | null>(null);
  const [searchStartDate, setSearchStartDate] = React.useState<string | null>(() => {
    const start = toDateOnly(request?.startDate);
    const yesterday = getYesterdayDateString();
    return start && start > yesterday ? yesterday : start;
  });
  const [searchEndDate, setSearchEndDate] = React.useState<string | null>(() => {
    const end = toDateOnly(request?.endDate);
    const yesterday = getYesterdayDateString();
    return end && end > yesterday ? yesterday : end;
  });
  const [hasSearched, setHasSearched] = React.useState(false);
  /** Incremented on each Search click so the search effect re-runs every time (not only when hasSearched flips to true). */
  const [searchTrigger, setSearchTrigger] = React.useState(0);
  const [selectedRequestIds, setSelectedRequestIds] = React.useState<(string | number)[]>([]);
  const [searchPayload, setSearchPayload] = React.useState<InvoiceSearchPayload | null>(null);
  const [editedRows, setEditedRows] = React.useState<Record<string, EditableInvoiceLineFields>>({});
  const [isModifyMode, setIsModifyMode] = React.useState(false);
  const [undoModificationOpen, setUndoModificationOpen] = React.useState(false);
  const [modifyRefundFlow, setModifyRefundFlow] = React.useState<{
    refundRequired: number;
    refundMessage: string;
    invoiceId: string;
    pendingUpdates: InvoiceDetailDto[];
  } | null>(null);
  const [modifyRefundModalOpen, setModifyRefundModalOpen] = React.useState(false);
  const [undoRefundFlow, setUndoRefundFlow] = React.useState<{
    refundRequired: number;
    refundMessage: string;
    invoiceId: string;
  } | null>(null);
  const [undoRefundModalOpen, setUndoRefundModalOpen] = React.useState(false);
  const conflictSetupRef = React.useRef(false);
  const highlightRowRef = React.useRef<HTMLTableRowElement | null>(null);
  const invoiceDetailsLoadedForRef = React.useRef<string | null>(null);

  const refundStrings = INVOICE_GRID.PAYMENT.REFUND_PAYMENT_ALLOCATION;

  const invoiceHeader = React.useMemo(() => {
    if (!invoiceProp) return null;
    const invoiceFromByRequester = invoiceListItems.find(
      (item) => String(item.invoicesID) === String(invoiceProp.invoicesID)
    );
    if (invoiceFromByRequester) {
      return invoiceFromByRequester;
    }
    if (
      currentInvoiceFromStore &&
      String(currentInvoiceFromStore.invoicesID) === String(invoiceProp.invoicesID)
    ) {
      return currentInvoiceFromStore;
    }
    return invoiceProp;
  }, [invoiceProp, invoiceListItems, currentInvoiceFromStore]);

  // When invoice is passed directly (from invoice grid), use it; otherwise fetch from request
  const invoice = invoiceHeader ?? invoiceProp ?? fetchedInvoice;
  /** Read-only snapshot views — not the live editable invoice. */
  const isShowingReadOnlySnapshot =
    (invoiceDetailsIsUpdated && (viewOriginalDetails != null || viewOriginalLoading)) ||
    viewPreviousItems != null ||
    viewPreviousLoading;
  const isInvoiceEditMode = Boolean(invoiceProp) && !isShowingReadOnlySnapshot;
  const showViewOriginalToggle = Boolean(invoiceProp) && invoiceDetailsIsUpdated && !viewPreviousItems;
  const showViewCurrentToggle = Boolean(invoiceProp) && viewPreviousItems != null;
  const hasModifiedInvoiceLines = invoiceDetailsHasModifiedLines(invoiceDetailsItems);
  /** Previous Version: one step back from the live invoice only (not v2, v1, etc.). */
  const showPreviousVersionButton =
    Boolean(invoiceProp) &&
    !viewOriginalDetails &&
    !viewPreviousItems &&
    !isModifyMode &&
    !viewOriginalLoading &&
    hasModifiedInvoiceLines &&
    invoiceDetailsItems.length > 0;
  const showUndoModificationButton =
    Boolean(invoiceProp) &&
    !viewOriginalDetails &&
    !viewPreviousItems &&
    !isModifyMode &&
    !viewOriginalLoading &&
    hasModifiedInvoiceLines;

  // Reset modal state when popup is closed so reopening shows a fresh state (no stale search results)
  React.useEffect(() => {
    if (!isOpen) {
      dispatch(clearInvoicePreviewDetails());
      setFetchedInvoice(null);
      setHasSearched(false);
      setIsLoading(false);
      setSearchTrigger(0);
      setError(null);
      setErrorNote(null);
      setSelectedRequestIds([]);
      setSearchPayload(null);
      setEditedRows({});
      setIsModifyMode(false);
      setUndoModificationOpen(false);
      setModifyRefundFlow(null);
      setModifyRefundModalOpen(false);
      setUndoRefundFlow(null);
      setUndoRefundModalOpen(false);
      conflictSetupRef.current = false;
      highlightRowRef.current = null;
      invoiceDetailsLoadedForRef.current = null;
    }
  }, [isOpen, dispatch]);

  React.useEffect(() => {
    if (!isOpen || !isRequesterInvoiceFlow) return;
    setSelectedRequestIds([]);
  }, [isOpen, isRequesterInvoiceFlow]);

  React.useEffect(() => {
    if (!invoiceDetailsIsUpdated && viewOriginalDetails) {
      dispatch(clearViewOriginalInvoiceDetails());
    }
  }, [invoiceDetailsIsUpdated, viewOriginalDetails, dispatch]);

  const selectedRequests = React.useMemo(() => {
    if (!isRequesterInvoiceFlow) return EMPTY_SELECTED_REQUESTS;
    const selected = new Set(selectedRequestIds.map(String));
    return requestOptions.filter((req) => selected.has(String(req.requestID)));
  }, [isRequesterInvoiceFlow, requestOptions, selectedRequestIds]);

  const effectiveRequest = isRequesterInvoiceFlow ? selectedRequests[0] : request;

  /**
   * Calendar bounds from the active request(s):
   * - Single request (row invoice or one multi-select): that request's start/end
   * - Multiple selected requests: earliest start → latest end
   */
  const requestDateBounds = React.useMemo(() => {
    const sources = isRequesterInvoiceFlow
      ? selectedRequests
      : request
        ? [request]
        : EMPTY_SELECTED_REQUESTS;
    if (sources.length === 0) {
      return { min: undefined as string | undefined, max: undefined as string | undefined };
    }
    const starts = sources.map((req) => toDateOnly(req.startDate)).filter(Boolean) as string[];
    const ends = sources.map((req) => toDateOnly(req.endDate)).filter(Boolean) as string[];
    return {
      min: starts.length > 0 ? starts.sort()[0] : undefined,
      max: ends.length > 0 ? ends.sort()[ends.length - 1] : undefined,
    };
  }, [isRequesterInvoiceFlow, selectedRequests, request]);

  /**
   * Selectable max for the calendars: never after yesterday, and never after the request end when known.
   */
  const calendarMaxDate = React.useMemo(
    () => earliestDateString(requestDateBounds.max, getYesterdayDateString()) ?? getYesterdayDateString(),
    [requestDateBounds.max]
  );

  React.useEffect(() => {
    setErrorExpanded(true);
  }, [error]);

  // Grid View Details: load line items once when the invoice preview opens (not on refund-modal close).
  React.useEffect(() => {
    if (!isOpen || !invoiceProp?.invoicesID) {
      if (!isOpen) {
        invoiceDetailsLoadedForRef.current = null;
      }
      return;
    }
    const invoicesId = String(invoiceProp.invoicesID);
    if (invoiceDetailsLoadedForRef.current === invoicesId) return;
    invoiceDetailsLoadedForRef.current = invoicesId;
    dispatch(clearViewOriginalInvoiceDetails());
    dispatch(clearViewPreviousInvoiceDetails());
    void dispatch(fetchInvoiceDetailsByInvoiceIdThunk(invoicesId));
  }, [isOpen, invoiceProp?.invoicesID, dispatch]);

  React.useEffect(() => {
    if (invoiceProp != null) {
      setFetchedInvoice(null);
      setError(null);
      setErrorNote(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      if (!isOpen || !hasSearched || !searchPayload) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      setErrorNote(null);
      try {
        const result = await getRequestInvoiceData(searchPayload);
        if (cancelled) return;
        setFetchedInvoice(result.invoice);
        const warning = result.errorMessages.join('\n');
        if (result.errorMessages.length > 0) {
          setErrorNote(INVOICE_GRID.ERRORS.EXCLUDED_FROM_INVOICE);
        }
        if (!result.invoice) {
          setError(warning || 'No invoice data found for this request.');
        } else if (warning) {
          setError(warning);
        }
      } catch (e: unknown) {
        if (cancelled) return;
        setError((e as Error)?.message ?? 'Failed to load invoice data.');
        setErrorNote(null);
        setFetchedInvoice(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    invoiceProp,
    hasSearched,
    searchPayload,
    searchTrigger,
  ]);

  // Initialize search dates when the modal opens or the selected request(s) change — not on every render.
  const selectedRequestIdsKey = selectedRequestIds.map(String).join(',');
  React.useEffect(() => {
    if (!isOpen || invoiceProp) return;
    const yesterday = getYesterdayDateString();
    const clampToYesterday = (value?: string | null): string | null => {
      const dateOnly = toDateOnly(value);
      if (!dateOnly) return null;
      return dateOnly > yesterday ? yesterday : dateOnly;
    };
    if (isRequesterInvoiceFlow) {
      if (selectedRequestIds.length === 0) {
        setSearchStartDate(null);
        setSearchEndDate(null);
        return;
      }
      const starts = selectedRequests.map((req) => toDateOnly(req.startDate)).filter(Boolean) as string[];
      const ends = selectedRequests.map((req) => toDateOnly(req.endDate)).filter(Boolean) as string[];
      const sortedStarts = starts.sort();
      const sortedEnds = ends.sort();
      setSearchStartDate(sortedStarts.length > 0 ? clampToYesterday(sortedStarts[0]) : null);
      setSearchEndDate(sortedEnds.length > 0 ? clampToYesterday(sortedEnds[sortedEnds.length - 1]) : null);
      return;
    }
    setSearchStartDate(clampToYesterday(request?.startDate));
    setSearchEndDate(clampToYesterday(request?.endDate));
  }, [
    isOpen,
    invoiceProp,
    isRequesterInvoiceFlow,
    selectedRequestIdsKey,
    selectedRequestIds.length,
    request?.requestID,
    request?.startDate,
    request?.endDate,
  ]);

  // Keep start <= end when the user adjusts either date.
  React.useEffect(() => {
    if (searchStartDate && searchEndDate && searchStartDate > searchEndDate) {
      setSearchEndDate(searchStartDate);
    }
  }, [searchStartDate, searchEndDate]);

  const handleSearchClick = React.useCallback(() => {
    if (isRequesterInvoiceFlow && selectedRequests.length === 0) {
      setFetchedInvoice(null);
      setHasSearched(true);
      setSearchPayload(null);
      setError('Select at least one request.');
      setErrorNote(null);
      return;
    }

    const selectedProjectNumbers = uniqueNonEmpty(
      (isRequesterInvoiceFlow ? selectedRequests : [request]).map(buildCombinedProjectNumber)
    );
    const projectNumber = isRequesterInvoiceFlow
      ? selectedProjectNumbers
      : selectedProjectNumbers[0] ?? buildCombinedProjectNumber(request);
    const startDate = searchStartDate ?? effectiveRequest?.startDate ?? null;
    const endDate = searchEndDate ?? effectiveRequest?.endDate ?? null;

    if ((Array.isArray(projectNumber) ? projectNumber.length === 0 : !projectNumber) || !startDate || !endDate) {
      setFetchedInvoice(null);
      setHasSearched(true);
      setSearchPayload(null);
      setError('Missing project number or date range for invoice.');
      setErrorNote(null);
      return;
    }

    setError(null);
    setErrorNote(null);
    setFetchedInvoice(null);
    setHasSearched(true);
    setSearchPayload({ projectNumber, startDate, endDate });
    setSearchTrigger((t) => t + 1);
  }, [isRequesterInvoiceFlow, selectedRequests, request, searchStartDate, effectiveRequest, searchEndDate]);

  const lineItems: InvoiceDetailDto[] = React.useMemo(
    () =>
      invoiceProp
        ? (viewOriginalDetails != null
            ? (viewOriginalDetails.items as InvoiceDetailDto[])
            : viewPreviousItems ?? invoiceDetailsItems)
        : (invoice?.invoiceDetails ?? []),
    [invoiceProp, viewOriginalDetails, viewPreviousItems, invoiceDetailsItems, invoice?.invoiceDetails]
  );

  const showModifyInvoiceButton = isInvoiceEditMode && !isModifyMode && lineItems.length > 0;

  const hasSpecialRateRows = React.useMemo(
    () => lineItems.some((row) => row.specialRate != null),
    [lineItems]
  );

  const hasMinimumDueRows = React.useMemo(
    () => lineItems.some((row) => row.isMinimumDue === true),
    [lineItems]
  );

  const invoiceFootnotes = React.useMemo(() => {
    const notes: Array<{ id: string; text: string }> = [];
    if (hasSpecialRateRows) {
      notes.push({ id: 'special-rate', text: INVOICE_GRID.PREVIEW.SPECIAL_RATE_FOOTNOTE });
    }
    if (hasMinimumDueRows) {
      notes.push({ id: 'minimum-due', text: INVOICE_GRID.PREVIEW.MINIMUM_DUE_HOURS_FOOTNOTE });
    }
    return notes;
  }, [hasSpecialRateRows, hasMinimumDueRows]);

  React.useEffect(() => {
    if (modifyConflict) return;
    setIsModifyMode(false);
    setEditedRows({});
  }, [lineItems, viewOriginalDetails, viewPreviousItems, modifyConflict]);

  React.useEffect(() => {
    if (!isOpen || !modifyConflict) return;
    if (!invoiceProp?.invoicesID || detailsLoading || lineItems.length === 0) return;
    if (conflictSetupRef.current) return;

    conflictSetupRef.current = true;
    setIsModifyMode(true);
    setEditedRows(buildModifyEditedRows(lineItems, modifyConflict));
  }, [isOpen, modifyConflict, invoiceProp?.invoicesID, detailsLoading, lineItems]);

  React.useEffect(() => {
    if (!isModifyMode || !modifyConflict?.closedPostPositionId || !highlightRowRef.current) return;
    highlightRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [isModifyMode, lineItems, modifyConflict?.closedPostPositionId]);

  const displayLineItems = React.useMemo(() => {
    if (!isModifyMode) return lineItems;

    return lineItems.map((row, index) => {
      const rowKey = getInvoiceLineKey(row, index);
      const edits = editedRows[rowKey];
      if (!edits) return row;

      const rate = parseNumericInput(edits.rate);
      const hours = parseNumericInput(edits.hours);
      const vehicleFeeAmount = parseNumericInput(edits.vehicleFeeAmount);
      const equipmentFeeAmount = parseNumericInput(edits.equipmentFeeAmount);
      const totalAmount = calcLineTotal(rate, hours, vehicleFeeAmount, equipmentFeeAmount);

      return {
        ...row,
        rate,
        hours,
        vehicleFeeAmount,
        equipmentFeeAmount,
        totalAmount,
        total: totalAmount,
      };
    });
  }, [isModifyMode, lineItems, editedRows]);

  const hasModifyChanges = React.useMemo(() => {
    if (!isModifyMode) return false;

    return lineItems.some((row, index) => {
      const edits = editedRows[getInvoiceLineKey(row, index)];
      return edits != null && rowEditsChanged(row, edits);
    });
  }, [isModifyMode, lineItems, editedRows]);

  const hasConflictModifySetup = React.useMemo(() => {
    if (!modifyConflict?.editPayload || lineItems.length === 0) return false;
    return (
      findInvoiceLineIndexForConflict(
        lineItems,
        modifyConflict.closedPostPositionId,
        modifyConflict.editPayload
      ) >= 0
    );
  }, [lineItems, modifyConflict]);

  const canSaveInvoiceInModifyMode =
    hasModifyChanges || (Boolean(modifyConflict?.pendingAction) && hasConflictModifySetup);

  const hasPendingChanges =
    (isModifyMode && (hasModifyChanges || hasConflictModifySetup)) || viewPreviousItems != null;

  /** Totals for summary: original API when viewing original, otherwise invoice header from grid. */
  const summaryTotals = React.useMemo(() => {
    if (!invoice) return null;
    if (!viewOriginalDetails) return invoice;
    return {
      officerHourlyTotal: viewOriginalDetails.officerHourlyTotal ?? invoice.officerHourlyTotal,
      officerFeesTotal: viewOriginalDetails.officerFeesTotal ?? invoice.officerFeesTotal,
      agencyFeesTotal: viewOriginalDetails.agencyFeesTotal ?? invoice.agencyFeesTotal,
      vehicleFeesTotal: viewOriginalDetails.vehicleFeesTotal ?? invoice.vehicleFeesTotal,
      equipmentFeesTotal: viewOriginalDetails.equipmentFeesTotal ?? invoice.equipmentFeesTotal,
      total: viewOriginalDetails.total ?? invoice.total,
      paymentsApplied: viewOriginalDetails.paymentsApplied ?? invoice.paymentsApplied,
      balanceDue: viewOriginalDetails.balanceDue ?? invoice.balanceDue,
    };
  }, [invoice, viewOriginalDetails]);

  const summarySource = React.useMemo(() => {
    if (!hasPendingChanges || !summaryTotals) return summaryTotals;

    const officerHourlyTotal = displayLineItems.reduce(
      (acc, row) => acc + (row.rate ?? 0) * (row.hours ?? 0),
      0
    );
    const vehicleFeesTotal = displayLineItems.reduce(
      (acc, row) => acc + (row.vehicleFeeAmount ?? 0),
      0
    );
    const equipmentFeesTotal = displayLineItems.reduce(
      (acc, row) => acc + (row.equipmentFeeAmount ?? 0),
      0
    );
    const officerFeesTotal = summaryTotals.officerFeesTotal ?? 0;
    const agencyFeesTotal = summaryTotals.agencyFeesTotal ?? 0;
    const total =
      officerHourlyTotal + vehicleFeesTotal + equipmentFeesTotal + officerFeesTotal + agencyFeesTotal;
    const paymentsApplied = summaryTotals.paymentsApplied ?? 0;

    return {
      ...summaryTotals,
      officerHourlyTotal,
      vehicleFeesTotal,
      equipmentFeesTotal,
      total,
      balanceDue: total - paymentsApplied,
    };
  }, [hasPendingChanges, summaryTotals, displayLineItems]);

  /** Invoice page uses GET /InvoiceDetail/invoice line items for payable split fields. */
  const payableLineItems = React.useMemo(() => {
    if (invoiceProp && invoiceDetailsItems.length > 0) return invoiceDetailsItems;
    if (!invoiceProp && invoice?.invoiceDetails?.length) return invoice.invoiceDetails;
    return undefined;
  }, [invoiceProp, invoiceDetailsItems, invoice?.invoiceDetails]);

  const generatePreviewInvoice = React.useCallback(async (): Promise<boolean> => {
    if (!invoice || (!request && selectedRequests.length === 0)) return false;

    const selectedProjectNumbers = uniqueNonEmpty(
      (isRequesterInvoiceFlow ? selectedRequests : [request]).map(buildCombinedProjectNumber)
    );
    if (selectedProjectNumbers.length === 0) return false;
    const projectNumber = isRequesterInvoiceFlow ? selectedProjectNumbers : selectedProjectNumbers[0];

    const start = (searchStartDate ?? '').trim();
    const end = (searchEndDate ?? '').trim();
    if (!start || !end) return false;

    try {
      await dispatch(
        generateInvoiceThunk({
          projectNumber,
          startDate: start,
          endDate: end,
        })
      ).unwrap();
      return true;
    } catch {
      // Error toast is handled in the thunk via showToast
      return false;
    }
  }, [dispatch, invoice, request, selectedRequests, isRequesterInvoiceFlow, searchStartDate, searchEndDate]);

  const handleGenerateInvoice = React.useCallback(async () => {
    const generated = await generatePreviewInvoice();
    if (generated) {
      onGenerateInvoice?.();
    }
  }, [generatePreviewInvoice, onGenerateInvoice]);

  const handleLineFieldChange = React.useCallback(
    (rowKey: string, field: keyof EditableInvoiceLineFields, value: string) => {
      setEditedRows((prev) => ({
        ...prev,
        [rowKey]: {
          ...(prev[rowKey] ?? {
            rate: '',
            hours: '',
            vehicleFeeAmount: '',
            equipmentFeeAmount: '',
          }),
          [field]: value,
        },
      }));
    },
    []
  );

  const handleStartModifyMode = React.useCallback(() => {
    setIsModifyMode(true);
    setEditedRows(buildModifyEditedRows(lineItems, modifyConflict));
  }, [lineItems, modifyConflict]);

  const handleCancelModifyMode = React.useCallback(() => {
    setIsModifyMode(false);
    setEditedRows({});
  }, []);

  const syncInvoiceDetailsAfterRefund = React.useCallback(
    async (invoicesId: string) => {
      invoiceDetailsLoadedForRef.current = invoicesId;
      await dispatch(fetchInvoiceDetailsByInvoiceIdThunk(invoicesId)).unwrap();
      onInvoiceUpdated?.();
    },
    [dispatch, onInvoiceUpdated]
  );

  const handleDismissModifyRefundFlow = React.useCallback(() => {
    setModifyRefundModalOpen(false);
  }, []);

  const handleDismissUndoRefundFlow = React.useCallback(() => {
    setUndoRefundModalOpen(false);
  }, []);

  const retryPendingCloseJob = React.useCallback(async (): Promise<boolean> => {
    const pending = modifyConflict?.pendingAction;
    if (!pending) return true;

    if (pending.kind === 'editClose') {
      const result = await dispatch(closePostPositionWithEquipmentThunk(pending.closeArgs)).unwrap();
      if (!result.success) {
        dispatch(
          showToast(
            result.refund.message?.trim() || refundStrings.CLOSE_AFTER_REFUND_FAILED,
            'error'
          )
        );
        return false;
      }
      dispatch(showToast('Close assignment saved', 'success'));
    } else {
      const result = await dispatch(unclosePostPositionThunk(pending.postPositionId)).unwrap();
      if (!result.success) {
        dispatch(
          showToast(
            result.refund.message?.trim() || 'Failed to unclose job position',
            'error'
          )
        );
        return false;
      }
      dispatch(showToast('Job position unclosed successfully', 'success'));
    }

    onModifyConflictHandled?.();
    return true;
  }, [dispatch, modifyConflict?.pendingAction, onModifyConflictHandled, refundStrings.CLOSE_AFTER_REFUND_FAILED]);

  React.useEffect(() => {
    if (!modifyRefundModalOpen) {
      setModifyRefundFlow(null);
    }
  }, [modifyRefundModalOpen]);

  React.useEffect(() => {
    if (!undoRefundModalOpen) {
      setUndoRefundFlow(null);
    }
  }, [undoRefundModalOpen]);

  const handleSaveAllRows = React.useCallback(async () => {
    if (!invoiceProp?.invoicesID || !canSaveInvoiceInModifyMode) return;

    const updates = lineItems
      .map((row, index) => {
        const rowKey = getInvoiceLineKey(row, index);
        const edits = editedRows[rowKey];
        if (!edits || row.invoiceDetailID == null) return null;
        return buildInvoiceDetailUpdatePayload(row, edits, invoiceProp.invoicesID);
      })
      .filter((payload): payload is InvoiceDetailDto => payload != null);

    if (updates.length === 0) return;

    const invoicesId = String(invoiceProp.invoicesID);
    try {
      const result = await dispatch(modifyInvoiceDetailsThunk({ invoicesId, updates })).unwrap();
      if (!result.success) {
        setModifyRefundFlow({
          refundRequired: result.refund.refundRequired,
          refundMessage: result.refund.message,
          invoiceId: result.refund.invoiceId ?? invoicesId,
          pendingUpdates: updates,
        });
        setModifyRefundModalOpen(true);
        return;
      }
      onInvoiceUpdated?.();
      setIsModifyMode(false);
      setEditedRows({});
      const closeRetried = await retryPendingCloseJob();
      if (!closeRetried) return;
    } catch {
      // Error toast handled in thunk
    }
  }, [
    canSaveInvoiceInModifyMode,
    dispatch,
    editedRows,
    invoiceProp?.invoicesID,
    lineItems,
    onInvoiceUpdated,
    retryPendingCloseJob,
  ]);

  const handleViewPreviousVersion = React.useCallback(() => {
    if (!invoiceProp?.invoicesID) return;

    handleCancelModifyMode();
    dispatch(clearViewOriginalInvoiceDetails());
    void dispatch(
      fetchViewPreviousInvoiceDetailsThunk({
        invoicesId: String(invoiceProp.invoicesID),
        currentInvoice: invoiceDetailsItems,
      })
    );
  }, [dispatch, handleCancelModifyMode, invoiceDetailsItems, invoiceProp?.invoicesID]);

  const handleUndoModificationConfirm = React.useCallback(async () => {
    if (!invoiceProp?.invoicesID) return;

    handleCancelModifyMode();
    const invoicesId = String(invoiceProp.invoicesID);
    try {
      const result = await dispatch(undoInvoiceModificationThunk(invoicesId)).unwrap();
      if (!result.success) {
        setUndoModificationOpen(false);
        setUndoRefundFlow({
          refundRequired: result.refund.refundRequired,
          refundMessage: result.refund.message,
          invoiceId: result.refund.invoiceId ?? invoicesId,
        });
        setUndoRefundModalOpen(true);
        return;
      }
      setUndoModificationOpen(false);
      await Promise.resolve(onInvoiceUpdated?.());
    } catch {
      // Error toast handled in thunk
    }
  }, [dispatch, handleCancelModifyMode, invoiceProp?.invoicesID, onInvoiceUpdated]);

  const showGenerateButton = Boolean(onGenerateInvoice);

  const isGridInvoiceFlow = Boolean(invoiceProp);
  const previewRequesterId = React.useMemo(() => {
    const fromInvoice = invoice?.requesterID?.trim();
    if (fromInvoice) return fromInvoice;
    if (isRequesterInvoiceFlow) {
      const fromSelected = selectedRequests.find((r) => r.requesterID?.trim())?.requesterID?.trim();
      if (fromSelected) return fromSelected;
    }
    return effectiveRequest?.requesterID?.trim() ?? request?.requesterID?.trim() ?? '';
  }, [
    invoice?.requesterID,
    isRequesterInvoiceFlow,
    selectedRequests,
    effectiveRequest?.requesterID,
    request?.requesterID,
  ]);
  const invoicePayableTotal =
    displayLineItems.length > 0
      ? displayLineItems.reduce(
          (sum, row) => sum + (Number(row.totalAmount ?? row.total) || 0),
          0
        )
      : (summarySource?.total ?? 0);
  const showPaymentButton =
    Boolean(invoice) &&
    !isLoading &&
    !isModifyMode &&
    Boolean(previewRequesterId) &&
    (isGridInvoiceFlow || hasSearched) &&
    invoicePayableTotal > 0;
  const handleGoToPaymentHistory = React.useCallback(async () => {
    if (!previewRequesterId) return;

    if (!isGridInvoiceFlow) {
      const generated = await generatePreviewInvoice();
      if (!generated) return;
      onGenerateInvoice?.();
    }

    const requesterName = invoice?.billingToName?.trim() || undefined;
    const route = buildRequesterScopedAdminRoute(
      PAYMENT_GRID.REQUESTER_PAYMENT_PATH,
      { requesterID: previewRequesterId, name: requesterName },
      paymentReturnPath
        ? { returnPath: paymentReturnPath, returnState: paymentReturnState }
        : undefined
    );
    navigate(route.path, { state: route.state });
  }, [
    generatePreviewInvoice,
    invoice?.billingToName,
    isGridInvoiceFlow,
    navigate,
    onGenerateInvoice,
    paymentReturnPath,
    paymentReturnState,
    previewRequesterId,
  ]);
  const canPrintInvoice =
    Boolean(invoice) &&
    !isLoading &&
    !(isGridInvoiceFlow && detailsLoading) &&
    !isModifyMode &&
    (!isGridInvoiceFlow || viewPreviousItems == null);
  const showHeaderActions = showGenerateButton || canPrintInvoice || isGridInvoiceFlow || showPaymentButton;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={invoiceProp ? 'Invoice' : 'Invoice Preview'}
      size="xl"
      fullWidth
      className="invoice-preview-modal"
      showCloseButton
      headerActions={
        showHeaderActions ? (
          <div className="invoice-preview__header-actions">
            {isGridInvoiceFlow && (
              <>
                {showModifyInvoiceButton && (
                  <button
                    type="button"
                    className="invoice-preview__btn invoice-preview__btn--secondary"
                    onClick={handleStartModifyMode}
                    disabled={
                      !invoice ||
                      detailsLoading ||
                      viewOriginalLoading ||
                      isModifyingInvoice ||
                      isUndoingModification
                    }
                  >
                    {INVOICE_GRID.PREVIEW.MODIFY_INVOICE}
                  </button>
                )}
                {isModifyMode && (
                  <>
                    {canSaveInvoiceInModifyMode && (
                      <button
                        type="button"
                        className="invoice-preview__btn invoice-preview__btn--primary"
                        onClick={() => void handleSaveAllRows()}
                        disabled={
                          !invoice ||
                          detailsLoading ||
                          isModifyingInvoice ||
                          isUndoingModification
                        }
                      >
                        {INVOICE_GRID.PREVIEW.SAVE_INVOICE}
                      </button>
                    )}
                    <button
                      type="button"
                      className="invoice-preview__btn invoice-preview__btn--secondary"
                      onClick={handleCancelModifyMode}
                      disabled={isModifyingInvoice || isUndoingModification}
                    >
                      {INVOICE_GRID.PREVIEW.CANCEL_MODIFY}
                    </button>
                  </>
                )}
                {showPreviousVersionButton && (
                  <button
                    type="button"
                    className="invoice-preview__btn invoice-preview__btn--secondary invoice-preview__btn--previous-version"
                    onClick={handleViewPreviousVersion}
                    disabled={
                      !invoice ||
                      detailsLoading ||
                      viewOriginalLoading ||
                      viewPreviousLoading ||
                      isModifyingInvoice ||
                      isUndoingModification
                    }
                    title={INVOICE_GRID.PREVIEW.PREVIOUS_VERSION}
                    aria-label={INVOICE_GRID.PREVIEW.PREVIOUS_VERSION}
                    aria-busy={viewPreviousLoading}
                  >
                    <SMSIcon name="history" size="sm" className="invoice-preview__previous-version-icon" />
                    {INVOICE_GRID.PREVIEW.PREVIOUS_VERSION}
                  </button>
                )}
                {showUndoModificationButton && (
                  <button
                    type="button"
                    className="invoice-preview__btn invoice-preview__btn--secondary"
                    onClick={() => setUndoModificationOpen(true)}
                    disabled={
                      !invoice ||
                      detailsLoading ||
                      viewOriginalLoading ||
                      viewPreviousLoading ||
                      isModifyingInvoice ||
                      isUndoingModification
                    }
                    aria-busy={isUndoingModification}
                  >
                    {INVOICE_GRID.PREVIEW.UNDO_MODIFICATION}
                  </button>
                )}
                {showViewCurrentToggle && (
                  <button
                    type="button"
                    className="invoice-preview__btn invoice-preview__btn--secondary invoice-preview__btn--view-toggle"
                    onClick={() => dispatch(clearViewPreviousInvoiceDetails())}
                    disabled={!invoice || detailsLoading || viewPreviousLoading}
                  >
                    {INVOICE_GRID.PREVIEW.VIEW_CURRENT_INVOICE}
                  </button>
                )}
                {showViewOriginalToggle && (
                  <button
                    type="button"
                    className="invoice-preview__btn invoice-preview__btn--secondary invoice-preview__btn--view-toggle"
                    onClick={() => {
                      if (!invoiceProp?.invoicesID) return;
                      if (viewOriginalDetails) {
                        dispatch(clearViewOriginalInvoiceDetails());
                      } else {
                        handleCancelModifyMode();
                        dispatch(clearViewPreviousInvoiceDetails());
                        void dispatch(fetchViewOriginalInvoiceDetailsThunk(String(invoiceProp.invoicesID)));
                      }
                    }}
                    disabled={
                      !invoice ||
                      detailsLoading ||
                      viewOriginalLoading ||
                      viewPreviousLoading ||
                      isModifyMode ||
                      isModifyingInvoice
                    }
                    aria-busy={viewOriginalLoading}
                  >
                    {viewOriginalDetails
                      ? INVOICE_GRID.PREVIEW.VIEW_UPDATED_INVOICE
                      : INVOICE_GRID.PREVIEW.VIEW_ORIGINAL_INVOICE}
                  </button>
                )}
              </>
            )}
            {showPaymentButton && (
              <button
                type="button"
                className="invoice-preview__btn invoice-preview__btn--secondary"
                onClick={() => void handleGoToPaymentHistory()}
                disabled={
                  isLoading ||
                  isGeneratingInvoice ||
                  !!error ||
                  !invoice ||
                  (isGridInvoiceFlow && detailsLoading)
                }
              >
                {INVOICE_GRID.PREVIEW.PAYMENT}
              </button>
            )}
            {canPrintInvoice && (
              <SMSPrintAction
                targetSelector=".invoice-document"
                documentTitle="Invoice"
                label={INVOICE_GRID.PREVIEW.PRINT_INVOICE}
                disabled={
                  !invoice ||
                  isLoading ||
                  (!!invoiceProp && detailsLoading) ||
                  viewOriginalLoading ||
                  viewPreviousLoading ||
                  isModifyMode
                }
              />
            )}
            {showGenerateButton && (
              <button
                type="button"
                className="invoice-preview__btn invoice-preview__btn--primary"
                onClick={() => void handleGenerateInvoice()}
                disabled={isLoading || isGeneratingInvoice || !!error || !invoice}
              >
                Generate Invoice
              </button>
            )}
          </div>
        ) : undefined
      }
    >
      <div className="invoice-preview">
        {!invoiceProp && (
          <div
            className={`invoice-preview__filters${
              isRequesterInvoiceFlow ? ' invoice-preview__filters--requester' : ''
            }`}
          >
            <div className="invoice-preview__filters-row">
              {isRequesterInvoiceFlow && (
                <div className="invoice-preview__filters-requests">
                  <SMSMultiSelectDropdown
                    label="Requests"
                    placeholder="Select requests"
                    options={requestOptions.map((req) => ({
                      value: req.requestID,
                      label: getRequestOptionLabel(req),
                      disabled: !buildCombinedProjectNumber(req),
                    }))}
                    value={selectedRequestIds}
                    onChange={setSelectedRequestIds}
                  />
                </div>
              )}
              <SMSDatePicker
                label="Start Date"
                value={searchStartDate ?? undefined}
                onChange={(value) => setSearchStartDate(value || null)}
                placeholder="Select start date"
                minDate={requestDateBounds.min}
                maxDate={earliestDateString(searchEndDate, calendarMaxDate)}
              />
              <SMSDatePicker
                label="End Date"
                value={searchEndDate ?? undefined}
                onChange={(value) => setSearchEndDate(value || null)}
                placeholder="Select end date"
                minDate={latestDateString(searchStartDate, requestDateBounds.min)}
                maxDate={calendarMaxDate}
              />
              <button
                type="button"
                className="invoice-preview__btn invoice-preview__btn--primary"
                onClick={handleSearchClick}
                disabled={isLoading}
              >
                Search
              </button>
            </div>
            {isRequesterInvoiceFlow && (
              <p className="invoice-preview__filters-hint">
                {requestOptions.length === 0
                  ? 'No requests available for this requester.'
                  : 'Select request(s) for invoice lookup.'}
              </p>
            )}
          </div>
        )}

        {isLoading && (
          <SMSBox className="invoice-preview__loader">
            <SMSLoader loadingText="Searching invoice data..." aria-label="Searching invoice data..." />
          </SMSBox>
        )}
        {!isLoading && !invoice && !error && !hasSearched && !invoiceProp && (
          <div className="invoice-preview__empty">
            <p>Set a date range and click Search to load invoice details.</p>
          </div>
        )}
        {!isLoading && error && (
          <div className={`invoice-preview__error${errorExpanded ? '' : ' invoice-preview__error--collapsed'}`}>
            <button
              type="button"
              className="invoice-preview__error-toggle"
              aria-expanded={errorExpanded}
              aria-label={
                errorExpanded ? INVOICE_GRID.ERRORS.COLLAPSE_MESSAGE : INVOICE_GRID.ERRORS.EXPAND_MESSAGE
              }
              onClick={() => setErrorExpanded((open) => !open)}
            >
              <SMSIcon
                name="chevron-right"
                size="sm"
                className={`invoice-preview__error-chevron${errorExpanded ? ' invoice-preview__error-chevron--open' : ''}`}
              />
              <span className="invoice-preview__error-summary">
                {INVOICE_GRID.ERRORS.LABEL}
                {errorNote && <span className="invoice-preview__error-note"> : {errorNote}</span>}
              </span>
            </button>
            {errorExpanded && (
              <ul className="invoice-preview__error-list">
                {error
                  .split('\n')
                  .map((line) => line.trim())
                  .filter(Boolean)
                  .map((line, index) => (
                    <li key={`${index}-${line}`}>{line}</li>
                  ))}
              </ul>
            )}
          </div>
        )}
        {invoiceProp && detailsLoading && (
          <SMSBox className="invoice-preview__loader">
            <SMSLoader loadingText="Loading invoice details..." aria-label="Loading invoice details..." />
          </SMSBox>
        )}
        {invoiceProp && !detailsLoading && detailsError && (
          <div style={{ padding: '1rem', color: '#b42318' }}>{detailsError}</div>
        )}
        {invoiceProp && !detailsLoading && !detailsError && viewOriginalError && (
          <div style={{ padding: '0.5rem 1rem', color: '#b42318' }}>{viewOriginalError}</div>
        )}
        {invoiceProp && !detailsLoading && !detailsError && viewPreviousError && (
          <div style={{ padding: '0.5rem 1rem', color: '#b42318' }}>{viewPreviousError}</div>
        )}
        {/* Only show invoice document when not fetching line items (grid View Details). */}
        {invoice && !(invoiceProp && detailsLoading) && (
        <div className="invoice-document">
          {invoiceProp && (
            <header className="invoice-document__header">
              <div className="invoice-document__header-left invoice-document__meta-item invoice-document__meta-item--invoice-no">
                <span className="invoice-document__label">Invoice #</span>
                <span className="invoice-document__value">{invoice?.invoiceNo ?? '-'}</span>
                {invoiceDetailsIsUpdated && (
                  <span
                    className={`invoice-document__updated-tag${viewOriginalDetails ? ' invoice-document__updated-tag--hidden' : ''}`}
                  >
                    Updated
                  </span>
                )}
              </div>
              <div className="invoice-document__header-center">
                {invoiceLogo?.base64 && invoiceLogo?.contentType ? (
                  <img
                    src={`data:${invoiceLogo.contentType};base64,${invoiceLogo.base64}`}
                    alt="Logo"
                    className="invoice-document__logo-img"
                  />
                ) : null}
              </div>
              <div className="invoice-document__header-right invoice-document__header-meta-row">
                <div className="invoice-document__meta-item">
                  <span className="invoice-document__label">Invoice Date</span>
                  <span className="invoice-document__value">{toDisplayDate(invoice?.dateCreated)}</span>
                </div>
                <div className="invoice-document__meta-item">
                  <span className="invoice-document__label">Due Date</span>
                  <span className="invoice-document__value">{toDisplayDate(invoice?.dueDate)}</span>
                </div>
              </div>
            </header>
          )}

          <div className="invoice-document__parties-and-table">
            <div className="invoice-document__parties">
              <section className="invoice-document__block">
                <h3 className="invoice-document__block-title">Bill From</h3>
                <p className="invoice-document__labeled-line">
                  <span className="invoice-document__line-label">Name:</span>
                  <span className="invoice-document__line-value">{invoice?.billingFromName ?? '-'}</span>
                </p>
                <p className="invoice-document__labeled-line">
                  <span className="invoice-document__line-label">Department Address:</span>
                  <span className="invoice-document__line-value">{invoice?.billingFromAddress ?? '-'}</span>
                </p>
                <p className="invoice-document__labeled-line">
                  <span className="invoice-document__line-label">Phone Number:</span>
                  <span className="invoice-document__line-value">{invoice?.billingFromPhoneNumber ? formatPhoneNumber(invoice.billingFromPhoneNumber) : '-'}</span>
                </p>
                <p className="invoice-document__labeled-line">
                  <span className="invoice-document__line-label">Email:</span>
                  <span className="invoice-document__line-value">{invoice?.billingFromEmail ?? '-'}</span>
                </p>
                <p className="invoice-document__labeled-line">
                  <span className="invoice-document__line-label">Contact:</span>
                  <span className="invoice-document__line-value">{invoice?.billingFromContact ?? '-'}</span>
                </p>
              </section>
              <section className="invoice-document__block">
                <h3 className="invoice-document__block-title">Bill To</h3>
                <p className="invoice-document__labeled-line">
                  <span className="invoice-document__line-label">Name:</span>
                  <span className="invoice-document__line-value">{invoice?.billingToName ?? '-'}</span>
                </p>
                <p className="invoice-document__labeled-line">
                  <span className="invoice-document__line-label">Business Address:</span>
                  <span className="invoice-document__line-value">{invoice?.billingToAddress ?? '-'}</span>
                </p>
                <p className="invoice-document__labeled-line">
                  <span className="invoice-document__line-label">Phone Number:</span>
                  <span className="invoice-document__line-value">{invoice?.billingToPhoneNumber ? formatPhoneNumber(invoice.billingToPhoneNumber) : '-'}</span>
                </p>
                <p className="invoice-document__labeled-line">
                  <span className="invoice-document__line-label">Email:</span>
                  <span className="invoice-document__line-value">{invoice?.billingToEmail ?? '-'}</span>
                </p>
                <p className="invoice-document__labeled-line">
                  <span className="invoice-document__line-label">Contact:</span>
                  <span className="invoice-document__line-value">{invoice?.billingToContact ?? '-'}</span>
                </p>
              </section>
            </div>

            <div
              className={`invoice-document__table-scroll${viewOriginalLoading || viewPreviousLoading ? ' invoice-document__table-scroll--loading' : ''}`}
            >
            <table className={`invoice-document__table invoice-document__table--line-items${isModifyMode ? ' invoice-document__table--editable' : ''}`}>
            <colgroup>
              <col className="invoice-document__col invoice-document__col--request-id" />
              <col className="invoice-document__col invoice-document__col--request-name" />
              <col className="invoice-document__col invoice-document__col--date-time" />
              <col className="invoice-document__col invoice-document__col--officer" />
              <col className="invoice-document__col invoice-document__col--rate" />
              <col className="invoice-document__col invoice-document__col--hours" />
              <col className="invoice-document__col invoice-document__col--vehicle" />
              <col className="invoice-document__col invoice-document__col--equipment" />
              <col className="invoice-document__col invoice-document__col--total" />
            </colgroup>
            <thead>
              <tr>
                <th>Request ID</th>
                <th>Request Name</th>
                <th>Date &amp; Time</th>
                <th>Officer</th>
                <th>Rate</th>
                <th>Hours</th>
                <th>Vehicle Fee</th>
                <th>Equipment Fee</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((row: InvoiceDetailDto, i: number) => {
                const displayRow = displayLineItems[i] ?? row;
                const rawDate = row.jobDate ?? row.jobTime ?? null;
                const formattedDate = formatInvoiceLineItemDate(rawDate);
                const timeRaw: string | null = row.jobTime ?? null;
                const formattedTime = timeRaw ? formatTimeToHHmm(timeRaw) : '';
                const endTimeRaw = getInvoiceLineEndTimeRaw(row);
                const endTimeFormatted = endTimeRaw ? formatTimeToHHmm(endTimeRaw) || endTimeRaw.trim() : '';
                const rowTotalAmount = displayRow.totalAmount ?? displayRow.total ?? null;
                const rowKey = getInvoiceLineKey(row, i);
                const rowEdits = editedRows[rowKey];
                const renderEditableNumberCell = (
                  field: keyof EditableInvoiceLineFields,
                  displayValue: number | null | undefined,
                  ariaLabel: string
                ) => {
                  if (!isModifyMode) {
                    if (field === 'vehicleFeeAmount' || field === 'equipmentFeeAmount') {
                      return formatMileageCharge(displayValue, '-');
                    }
                    return field === 'rate'
                      ? formatCurrency(displayValue, '-')
                      : (displayValue ?? '-');
                  }

                  return (
                    <input
                      type="number"
                      className="invoice-document__edit-input"
                      value={rowEdits?.[field] ?? formatNumericInput(displayValue)}
                      onChange={(event) => handleLineFieldChange(rowKey, field, event.target.value)}
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      aria-label={ariaLabel}
                      disabled={isModifyingInvoice || isUndoingModification}
                    />
                  );
                };

                const isHighlighted = invoiceLineMatchesModifyConflict(
                  row,
                  modifyConflict?.closedPostPositionId
                );

                return (
                  <tr
                    key={row.invoiceDetailID ?? i}
                    className={
                      isHighlighted ? 'invoice-document__line-row--highlighted' : undefined
                    }
                    ref={(el) => {
                      if (isHighlighted) highlightRowRef.current = el;
                    }}
                  >
                    <td>{row.jobId ?? '-'}</td>
                    <td>{row.jobName ?? '-'}</td>
                    <td>
                      <div className="invoice-document__date-time-cell">
                        <span className="invoice-document__date-time-date">{formattedDate}</span>
                        {formattedTime ? (
                          <span className="invoice-document__date-time-time-line">
                            <span className="invoice-document__date-time-label">Time:</span>{' '}
                            <span className="invoice-document__date-time-value">
                              {formattedTime} – {endTimeFormatted || 'N/A'}
                            </span>
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td>{row.officerName ?? row.officer ?? '-'}</td>
                    <td>
                      <div className="invoice-document__rate-cell">
                        {row.specialRate != null && !isModifyMode
                          ? renderInvoiceRateWithSpecial(displayRow.officerRate, row.specialRate)
                          : renderEditableNumberCell('rate', displayRow.rate, 'Rate')}
                      </div>
                    </td>
                    <td>
                      {!isModifyMode
                        ? renderInvoiceHours(displayRow.hours, row.isMinimumDue)
                        : renderEditableNumberCell('hours', displayRow.hours, 'Hours')}
                    </td>
                    <td>{renderEditableNumberCell('vehicleFeeAmount', displayRow.vehicleFeeAmount, 'Vehicle fee')}</td>
                    <td>{renderEditableNumberCell('equipmentFeeAmount', displayRow.equipmentFeeAmount, 'Equipment fee')}</td>
                    <td>{formatMileageCharge(rowTotalAmount, '-')}</td>
                  </tr>
                );
              })}
              {(lineItems.length === 0) && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center' }}>No line items</td>
                </tr>
              )}
            </tbody>
          </table>
            </div>
          </div>

          <div className="invoice-document__summary-section">
            <InvoiceDocumentSummary
              invoice={invoice}
              displayLineItems={lineItems}
              payableLineItems={payableLineItems}
              summarySource={summarySource}
            />
            {invoiceFootnotes.length > 0 ? (
              <div className="invoice-document__footnotes" role="note" aria-label="Invoice footnotes">
                {invoiceFootnotes.map((footnote) => (
                  <p key={footnote.id} className="invoice-document__footnote">
                    {footnote.text}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        )}
      </div>

      <SMSConfirmDialog
        open={undoModificationOpen}
        title={INVOICE_GRID.UNDO_MODIFICATION.TITLE}
        message={INVOICE_GRID.UNDO_MODIFICATION.MESSAGE}
        confirmText={INVOICE_GRID.UNDO_MODIFICATION.CONFIRM}
        cancelText={INVOICE_GRID.UNDO_MODIFICATION.CANCEL}
        onConfirm={() => void handleUndoModificationConfirm()}
        onClose={() => setUndoModificationOpen(false)}
        variant="error"
        loading={isUndoingModification}
      />

      {modifyRefundFlow ? (
        <RefundPaymentAllocationModal
          isOpen={modifyRefundModalOpen}
          onClose={handleDismissModifyRefundFlow}
          invoiceId={modifyRefundFlow.invoiceId}
          refundRequired={modifyRefundFlow.refundRequired}
          refundMessage={modifyRefundFlow.refundMessage}
          afterRefundFailedMessage={refundStrings.MODIFY_AFTER_REFUND_FAILED}
          onAfterRefund={async () => {
            const invoicesId = String(invoiceProp?.invoicesID ?? modifyRefundFlow.invoiceId);
            const result = await dispatch(
              modifyInvoiceDetailsThunk({
                invoicesId,
                updates: modifyRefundFlow.pendingUpdates,
              })
            ).unwrap();
            if (!result.success) {
              throw new Error(refundStrings.MODIFY_AFTER_REFUND_FAILED);
            }
            await syncInvoiceDetailsAfterRefund(invoicesId);
            setIsModifyMode(false);
            setEditedRows({});
            setModifyRefundModalOpen(false);
            const closeRetried = await retryPendingCloseJob();
            if (!closeRetried) {
              throw new Error(refundStrings.CLOSE_AFTER_REFUND_FAILED);
            }
          }}
        />
      ) : null}

      {undoRefundFlow ? (
        <RefundPaymentAllocationModal
          isOpen={undoRefundModalOpen}
          onClose={handleDismissUndoRefundFlow}
          invoiceId={undoRefundFlow.invoiceId}
          refundRequired={undoRefundFlow.refundRequired}
          refundMessage={undoRefundFlow.refundMessage}
          afterRefundFailedMessage={refundStrings.UNDO_AFTER_REFUND_FAILED}
          onAfterRefund={async () => {
            const invoicesId = String(invoiceProp?.invoicesID ?? undoRefundFlow.invoiceId);
            const result = await dispatch(undoInvoiceModificationThunk(invoicesId)).unwrap();
            if (!result.success) {
              throw new Error(refundStrings.UNDO_AFTER_REFUND_FAILED);
            }
            await syncInvoiceDetailsAfterRefund(invoicesId);
            setUndoRefundModalOpen(false);
          }}
        />
      ) : null}
    </Modal>
  );
};
