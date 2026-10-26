import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePagination } from '@/hooks/usePagination';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  adjustRequesterPaymentThunk,
  updatePaymentAllocationAmountThunk,
  allocatePaymentThunk,
  createRequesterPaymentThunk,
  deletePaymentThunk,
  fetchPaymentDetail,
  fetchPaymentReviewAllocations,
  fetchPaymentUnpaidInvoices,
  fetchRequesterPaymentSummary,
  fetchRequesterRefundablePayments,
  clearPaymentReviewAllocations,
  isPaymentAdjustAllocationConflictReject,
  selectPaymentDetailState,
  selectPaymentReviewAllocationsState,
  selectPaymentUnpaidInvoicesState,
  selectPaymentsListState,
  selectRequesterPaymentSummaryState,
  selectRequesterRefundablePaymentsState,
} from '@/store/slices/paymentSlice';
import {
  allocateRefundPaymentThunk,
  deleteRefundPaymentThunk,
  fetchRequesterRefundSummary,
  selectRefundPaymentSavingState,
  selectRequesterRefundSummaryState,
} from '@/store/slices/refundPaymentSlice';
import {
  fetchRefundPaymentAllocations,
  clearRefundPaymentAllocations,
  selectRefundPaymentAllocationsState,
  voidRefundPaymentAllocationThunk,
} from '@/store/slices/refundPaymentAllocationSlice';
import {
  selectVoidingPaymentAllocationId,
  voidPaymentWithReasonThunk,
} from '@/store/slices/paymentAllocationSlice';
import { unwrapPagedList } from '@/services/textPlainJson';
import {
  type CreatePaymentPhase,
  type PaymentAdjustAllocationConflictDto,
  type PaymentAdjustAllocationItemDto,
  type PaymentDto,
  type PaymentReviewAllocationsResponseDto,
  type PaymentReviewAllocationsResult,
  type ReadjustPaymentFields,
  type PaymentEntryFormState,
  type PaymentModalPaymentInfo,
  type RefundPaymentAllocationDetailDto,
  type RequesterPaymentRowDto,
  type RequesterRefundPaymentRowDto,
  type SettlePendingInvoiceRow,
  type SettlePendingInvoicesModalMode,
  type SettlePendingInvoicesModalSubmitPayload,
} from '@/types/payment';
import { formatDateToYYYYMMDD } from '@/utils/dateTimeUtils';
import { PAYMENT_GRID } from '@/constants/strings';
import {
  S,
  emptyRequesterSummary,
  emptyRequesterRefundSummary,
  getDefaultPaymentDateRange,
} from './constants';
import { toServerPagination } from './paginationUtils';
import {
  buildPaymentDetailColumns,
  buildRefundablePaymentSelectColumns,
  buildRefundPaymentDetailColumns,
  buildRequesterPaymentColumns,
  buildRequesterRefundPaymentColumns,
} from './paymentTableColumns';
import { fetchPaymentTypes } from '@/store/slices/paymentTypeSlice';
import type { SMSDropdownOption } from '@/components/smsatoms';

import type {
  RequesterPaymentPageModalsProps,
  UseRequesterPaymentPageOptions,
} from '@/types/requesterPaymentPage';

const trimConflictId = (value?: string | null): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const resolveRowPaymentId = (row: RequesterPaymentRowDto): string | undefined =>
  trimConflictId(row.paymentId) ??
  trimConflictId((row as { paymentID?: string | null }).paymentID);

const getEscrowAmount = (row: RequesterPaymentRowDto): number => row.availableAmount ?? 0;

const buildReadjustInvoiceRows = (
  conflict: PaymentAdjustAllocationConflictDto
): SettlePendingInvoiceRow[] =>
  conflict.allocations.flatMap((allocation) => {
    const invoiceId = allocation.invoiceId?.trim();
    const paymentAllocationId = allocation.paymentAllocationId?.trim();
    const amountApplied = allocation.amountApplied ?? 0;
    if (!invoiceId || !paymentAllocationId || amountApplied <= 0) return [];

    return [
      {
        invoiceId,
        paymentAllocationId,
        allocationDate: allocation.allocationDate,
        invoiceAmount: allocation.invoiceAmount,
        invoiceNo: allocation.invoiceNo?.trim() || undefined,
        invoiceDate: allocation.invoiceDate || allocation.paymentDate || undefined,
        dueDate: allocation.dueDate,
        dueAmount: amountApplied,
        paidAmount: amountApplied,
        balanceDue: allocation.balanceDue,
      },
    ];
  });

const conflictToPaymentInfo = (
  conflict: PaymentAdjustAllocationConflictDto,
  requesterName?: string | null
): PaymentModalPaymentInfo => ({
  paymentNumber: conflict.paymentNumber,
  paymentDate: conflict.paymentDate,
  paymentTypeId: conflict.paymentTypeId,
  paymentTypeName: conflict.paymentTypeName,
  referenceNumber: conflict.referenceNumber,
  requesterName: requesterName?.trim() || undefined,
});

const mapReviewAllocationsToConflict = (
  review: PaymentReviewAllocationsResponseDto | PaymentReviewAllocationsResult
): PaymentAdjustAllocationConflictDto => {
  const paymentId = review.paymentId?.trim() ?? '';
  const amount = review.amount ?? 0;
  const { data: allocations } = unwrapPagedList(review.allocations);
  return {
    message: '',
    paymentId,
    oldPaymentAmount: amount,
    newPaymentAmount: amount,
    paymentNumber: review.paymentNumber ?? undefined,
    paymentDate: review.paymentDate,
    referenceNumber: review.referenceNumber,
    paymentTypeId: review.paymentTypeId ?? undefined,
    paymentTypeName: review.paymentTypeName ?? undefined,
    amount,
    appliedAmount: review.appliedAmount ?? 0,
    refundedAmount: review.refundedAmount ?? 0,
    availableAmount: review.availableAmount ?? Math.max(0, amount - (review.appliedAmount ?? 0)),
    allocations,
  };
};

const defaultPaymentEntryForm = (paymentTypeId = ''): PaymentEntryFormState => ({
  paymentDate: formatDateToYYYYMMDD(new Date()),
  amount: '',
  paymentTypeId,
  referenceNumber: '',
});

const parseEntryAmount = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const paymentDtoToInfo = (
  payment: PaymentDto,
  requesterName: string
): PaymentModalPaymentInfo => {
  const paymentNumberRaw = (payment as { paymentNumber?: string | number | null }).paymentNumber;
  return {
    paymentNumber: paymentNumberRaw == null ? undefined : String(paymentNumberRaw),
    paymentDate: payment.paymentDate,
    paymentTypeId: payment.paymentTypeId,
    paymentTypeName: payment.paymentTypeName,
    referenceNumber: payment.referenceNumber,
    requesterName,
  };
};

type AdjustFormFields = ReadjustPaymentFields;

const defaultReadjustPaymentFields = (paymentTypeId = ''): ReadjustPaymentFields => ({
  paymentDate: formatDateToYYYYMMDD(new Date()),
  paymentTypeId,
  referenceNumber: '',
});

const conflictToAdjustForm = (conflict: PaymentAdjustAllocationConflictDto): ReadjustPaymentFields => ({
  paymentDate: conflict.paymentDate
    ? formatDateToYYYYMMDD(new Date(conflict.paymentDate))
    : formatDateToYYYYMMDD(new Date()),
  paymentTypeId: conflict.paymentTypeId?.trim() ?? '',
  referenceNumber: conflict.referenceNumber?.trim() ?? '',
});

const resolveRowRefundPaymentId = (row: RequesterRefundPaymentRowDto): string | undefined =>
  trimConflictId(row.refundPaymentId) ??
  trimConflictId((row as { refundPaymentID?: string | null }).refundPaymentID);

export function useRequesterPaymentPage({ requesterId, requesterName }: UseRequesterPaymentPageOptions) {
  const dispatch = useAppDispatch();
  const { requesters } = useAppSelector((state) => state.requester);
  const { summary: summaryView, loading, error } = useAppSelector(selectRequesterPaymentSummaryState);
  const {
    summary: refundableSummaryView,
    loading: refundablePaymentsLoading,
    error: refundablePaymentsError,
  } = useAppSelector(selectRequesterRefundablePaymentsState);
  const {
    summary: refundSummaryView,
    loading: refundLoading,
    error: refundError,
  } = useAppSelector(selectRequesterRefundSummaryState);
  const {
    view: refundPaymentAllocationsView,
    loading: refundDetailLoading,
    error: refundDetailError,
  } = useAppSelector(selectRefundPaymentAllocationsState);
  const {
    view: unpaidInvoicesView,
    loading: unpaidInvoicesLoading,
    error: unpaidInvoicesError,
    submitting: unpaidInvoicesSubmitting,
  } = useAppSelector(selectPaymentUnpaidInvoicesState);
  const { view: paymentDetailView, loading: paymentDetailLoading, error: paymentDetailError } =
    useAppSelector(selectPaymentDetailState);
  const { saving } = useAppSelector(selectPaymentsListState);
  const { saving: refundSubmitting } = useAppSelector(selectRefundPaymentSavingState);
  const {
    view: paymentReviewAllocationsView,
    loading: readjustAllocationsLoading,
    error: readjustAllocationsError,
  } = useAppSelector(selectPaymentReviewAllocationsState);
  const voidingPaymentAllocationId = useAppSelector(selectVoidingPaymentAllocationId);
  const { paymentTypes, isLoading: paymentTypesLoading } = useAppSelector((state) => state.paymentType);

  const paymentTypeOptions: SMSDropdownOption[] = useMemo(
    () => paymentTypes.map((pt) => ({ value: pt.paymentTypeId, label: pt.name })),
    [paymentTypes]
  );

  const defaultPaymentTypeId = useMemo(() => {
    const preferred = paymentTypes.find((pt) => pt.isDefault) ?? paymentTypes[0];
    return preferred?.paymentTypeId ?? '';
  }, [paymentTypes]);

  useEffect(() => {
    void dispatch(fetchPaymentTypes({ page: 1, pageSize: 1000, sortBy: 'name', sortDirection: 'asc' }));
  }, [dispatch]);

  const displayName =
    requesterName?.trim() ||
    requesters.find((r) => String(r.requesterID) === requesterId)?.name?.trim() ||
    S.REQUESTER_FALLBACK;

  const initialDateRange = useMemo(() => getDefaultPaymentDateRange(), []);
  const [startDate, setStartDate] = useState(initialDateRange.startDate);
  const [endDate, setEndDate] = useState(initialDateRange.endDate);
  const [datePickerKey, setDatePickerKey] = useState(0);
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [settleMode, setSettleMode] = useState<SettlePendingInvoicesModalMode>('pending');
  const [createPaymentPhase, setCreatePaymentPhase] = useState<CreatePaymentPhase | null>(null);
  const [paymentEntry, setPaymentEntry] = useState<PaymentEntryFormState>(() =>
    defaultPaymentEntryForm()
  );
  const [paymentEntryErrors, setPaymentEntryErrors] = useState<
    Partial<Record<keyof PaymentEntryFormState, string>>
  >({});
  const [createdPaymentInfo, setCreatedPaymentInfo] = useState<PaymentModalPaymentInfo | null>(
    null
  );
  const [readjustConflict, setReadjustConflict] =
    useState<PaymentAdjustAllocationConflictDto | null>(null);
  const [readjustPaymentInfo, setReadjustPaymentInfo] = useState<PaymentModalPaymentInfo | null>(
    null
  );
  const [readjustAdjustAmount, setReadjustAdjustAmount] = useState('');
  const [readjustPaymentFields, setReadjustPaymentFields] = useState<ReadjustPaymentFields>(
    defaultReadjustPaymentFields
  );
  const [skippedAllocationIds, setSkippedAllocationIds] = useState<string[]>([]);
  const [isEditingReadjustAmount, setIsEditingReadjustAmount] = useState(false);
  const [paymentDetailOpen, setPaymentDetailOpen] = useState(false);
  const [paymentInfoInvoiceId, setPaymentInfoInvoiceId] = useState<string | null>(null);
  const [activePaymentId, setActivePaymentId] = useState<string | null>(null);
  const [formResetToken, setFormResetToken] = useState(0);
  const [allocationConflictOpen, setAllocationConflictOpen] = useState(false);
  const [allocationConflictMessage, setAllocationConflictMessage] = useState('');
  const [readjustSubmitError, setReadjustSubmitError] = useState<string | null>(null);
  const [readjustEnableAllocationEditing, setReadjustEnableAllocationEditing] = useState(false);
  const [recordRefundModalOpen, setRecordRefundModalOpen] = useState(false);
  const [selectedRefundPayments, setSelectedRefundPayments] = useState<Map<string, number>>(
    () => new Map()
  );
  const [refundEntry, setRefundEntry] = useState<PaymentEntryFormState>(defaultPaymentEntryForm);
  const [refundEntryErrors, setRefundEntryErrors] = useState<
    Partial<Record<keyof PaymentEntryFormState, string>>
  >({});
  const [historyTab, setHistoryTab] = useState<'payment' | 'refund'>('payment');
  const [refundDetailOpen, setRefundDetailOpen] = useState(false);
  const [activeRefundPaymentId, setActiveRefundPaymentId] = useState<string | null>(null);
  const pendingAdjustPaymentRef = useRef<AdjustFormFields | null>(null);

  const pagination = usePagination({ initialPage: 1, totalItems: 0 });
  const refundPagination = usePagination({ initialPage: 1, totalItems: 0 });
  const refundablePaymentsPagination = usePagination({
    initialPage: 1,
    totalItems: 0,
  });
  const unpaidInvoicesPagination = usePagination({
    initialPage: 1,
    totalItems: 0,
  });
  const paymentDetailPagination = usePagination({
    initialPage: 1,
    totalItems: 0,
  });
  const readjustAllocationsPagination = usePagination({
    initialPage: 1,
    totalItems: 0,
  });
  const refundDetailPagination = usePagination({
    initialPage: 1,
    totalItems: 0,
  });

  const effectiveStartDate = startDate.trim() || null;
  const effectiveEndDate = endDate.trim() || null;
  const payments = summaryView?.payments ?? [];
  const summary = summaryView ?? emptyRequesterSummary(requesterId);
  const refunds = refundSummaryView?.refunds ?? [];
  const refundSummary = refundSummaryView ?? emptyRequesterRefundSummary(requesterId);
  const refundablePayments = refundableSummaryView?.payments ?? [];
  const totalEscrowAvailable =
    refundableSummaryView?.totalAvailableAmount ??
    refundableSummaryView?.requesterAvailableAmount ??
    0;
  const isReadjustSettle = settleMode === 'readjust';

  const activePaymentRow = useMemo(
    () =>
      payments.find((p) => resolveRowPaymentId(p) === activePaymentId?.trim()) ?? null,
    [activePaymentId, payments]
  );

  const activeReadjustConflict = useMemo((): PaymentAdjustAllocationConflictDto | null => {
    const activeId = activePaymentId?.trim();
    if (!activeId || !isReadjustSettle) return null;

    const conflictId = trimConflictId(readjustConflict?.paymentId);
    if (readjustConflict && conflictId === activeId) return readjustConflict;

    const viewId = trimConflictId(paymentReviewAllocationsView?.paymentId);
    if (paymentReviewAllocationsView && viewId === activeId) {
      return mapReviewAllocationsToConflict(paymentReviewAllocationsView);
    }

    return null;
  }, [
    activePaymentId,
    isReadjustSettle,
    paymentReviewAllocationsView,
    readjustConflict,
  ]);

  const activePaymentInfo = useMemo((): PaymentModalPaymentInfo | null => {
    if (!activePaymentRow) return null;
    return {
      paymentNumber: activePaymentRow.paymentNumber,
      paymentDate: activePaymentRow.paymentDate,
      paymentTypeId: activePaymentRow.paymentTypeId,
      paymentTypeName: activePaymentRow.paymentTypeName,
      referenceNumber: activePaymentRow.referenceNumber,
      requesterName: displayName,
    };
  }, [activePaymentRow, displayName]);

  const settlePaymentInfo =
    createPaymentPhase === 'entry'
      ? { requesterName: displayName }
      : createdPaymentInfo ?? readjustPaymentInfo ?? activePaymentInfo;
  const readjustInvoiceRows = useMemo(() => {
    if (readjustAllocationsLoading) return [];
    const activeId = activePaymentId?.trim();
    const viewId = trimConflictId(paymentReviewAllocationsView?.paymentId);
    if (paymentReviewAllocationsView && viewId === activeId) {
      return buildReadjustInvoiceRows(mapReviewAllocationsToConflict(paymentReviewAllocationsView));
    }
    return activeReadjustConflict ? buildReadjustInvoiceRows(activeReadjustConflict) : [];
  }, [
    activePaymentId,
    activeReadjustConflict,
    paymentReviewAllocationsView,
    readjustAllocationsLoading,
  ]);

  const settleTotalPayment = useMemo(() => {
    if (isReadjustSettle && activeReadjustConflict) return activeReadjustConflict.newPaymentAmount;
    if (createPaymentPhase === 'apply') {
      const entryAmount = parseEntryAmount(paymentEntry.amount);
      return unpaidInvoicesView?.amount ?? entryAmount ?? activePaymentRow?.amount ?? 0;
    }
    return unpaidInvoicesView?.amount ?? activePaymentRow?.amount ?? 0;
  }, [
    activePaymentRow?.amount,
    createPaymentPhase,
    isReadjustSettle,
    paymentEntry.amount,
    activeReadjustConflict,
    unpaidInvoicesView?.amount,
  ]);

  const requesterOptions = useMemo(
    () => [{ value: requesterId, label: displayName }],
    [displayName, requesterId]
  );

  const summaryQuery = useMemo(
    () => ({
      requesterId: requesterId.trim(),
      startDate: effectiveStartDate,
      endDate: effectiveEndDate,
      page: pagination.currentPage,
      pageSize: pagination.pageSize,
    }),
    [
      effectiveEndDate,
      effectiveStartDate,
      pagination.currentPage,
      pagination.pageSize,
      requesterId,
    ]
  );

  const refundSummaryQuery = useMemo(
    () => ({
      requesterId: requesterId.trim(),
      startDate: effectiveStartDate,
      endDate: effectiveEndDate,
      page: refundPagination.currentPage,
      pageSize: refundPagination.pageSize,
    }),
    [
      effectiveEndDate,
      effectiveStartDate,
      refundPagination.currentPage,
      refundPagination.pageSize,
      requesterId,
    ]
  );

  const refundablePaymentsQuery = useMemo(
    () => ({
      requesterId: requesterId.trim(),
      page: refundablePaymentsPagination.currentPage,
      pageSize: refundablePaymentsPagination.pageSize,
    }),
    [refundablePaymentsPagination.currentPage, refundablePaymentsPagination.pageSize, requesterId]
  );

  const openAllocationConflict = useCallback((message: string, adjustForm?: AdjustFormFields) => {
    if (adjustForm) pendingAdjustPaymentRef.current = adjustForm;
    setReadjustSubmitError(null);
    setAllocationConflictMessage(message || S.ADJUST_CONFLICT.MESSAGE);
    setAllocationConflictOpen(true);
  }, []);

  useEffect(() => {
    pagination.setTotalItems(summary.totalRecords || payments.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payments.length, summary.totalRecords]);

  useEffect(() => {
    refundPagination.setTotalItems(refundSummary.totalRecords || refunds.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refunds.length, refundSummary.totalRecords]);

  useEffect(() => {
    refundablePaymentsPagination.setTotalItems(
      refundableSummaryView?.totalRecords || refundablePayments.length
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refundablePayments.length, refundableSummaryView?.totalRecords]);

  useEffect(() => {
    unpaidInvoicesPagination.setTotalItems(unpaidInvoicesView?.totalRecords ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unpaidInvoicesView?.totalRecords]);

  useEffect(() => {
    paymentDetailPagination.setTotalItems(paymentDetailView?.totalRecords ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentDetailView?.totalRecords]);

  useEffect(() => {
    readjustAllocationsPagination.setTotalItems(paymentReviewAllocationsView?.totalRecords ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentReviewAllocationsView?.totalRecords]);

  useEffect(() => {
    refundDetailPagination.setTotalItems(refundPaymentAllocationsView?.totalRecords ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refundPaymentAllocationsView?.totalRecords]);

  const settlePagination = useMemo(() => {
    const base = isReadjustSettle
      ? toServerPagination(readjustAllocationsPagination)
      : toServerPagination(unpaidInvoicesPagination);
    const totalRecords = isReadjustSettle
      ? paymentReviewAllocationsView?.totalRecords
      : unpaidInvoicesView?.totalRecords;
    return {
      ...base,
      totalItems: totalRecords ?? base.totalItems,
    };
  }, [
    isReadjustSettle,
    paymentReviewAllocationsView?.totalRecords,
    readjustAllocationsPagination.currentPage,
    readjustAllocationsPagination.pageSize,
    readjustAllocationsPagination.totalItems,
    unpaidInvoicesView?.totalRecords,
    unpaidInvoicesPagination.currentPage,
    unpaidInvoicesPagination.pageSize,
    unpaidInvoicesPagination.totalItems,
  ]);

  useEffect(() => {
    if (!requesterId.trim()) return;
    void dispatch(fetchRequesterPaymentSummary(summaryQuery));
  }, [dispatch, requesterId, summaryQuery]);

  useEffect(() => {
    if (!requesterId.trim()) return;
    void dispatch(fetchRequesterRefundSummary(refundSummaryQuery));
  }, [dispatch, refundSummaryQuery, requesterId]);

  useEffect(() => {
    if (!requesterId.trim() || !recordRefundModalOpen) return;
    void dispatch(fetchRequesterRefundablePayments(refundablePaymentsQuery));
  }, [dispatch, recordRefundModalOpen, refundablePaymentsQuery, requesterId]);

  useEffect(() => {
    const paymentId = activePaymentId?.trim();
    if (!settleModalOpen || isReadjustSettle || !paymentId || !requesterId.trim()) return;
    void dispatch(
      fetchPaymentUnpaidInvoices({
        paymentId,
        requesterId: requesterId.trim(),
        page: unpaidInvoicesPagination.currentPage,
        pageSize: unpaidInvoicesPagination.pageSize,
      })
    );
  }, [
    activePaymentId,
    dispatch,
    isReadjustSettle,
    requesterId,
    settleModalOpen,
    unpaidInvoicesPagination.currentPage,
    unpaidInvoicesPagination.pageSize,
  ]);

  useEffect(() => {
    const paymentId = activePaymentId?.trim();
    if (!settleModalOpen || !isReadjustSettle || !paymentId) return;
    void dispatch(
      fetchPaymentReviewAllocations({
        paymentId,
        page: readjustAllocationsPagination.currentPage,
        pageSize: readjustAllocationsPagination.pageSize,
      })
    );
  }, [
    activePaymentId,
    dispatch,
    isReadjustSettle,
    readjustAllocationsPagination.currentPage,
    readjustAllocationsPagination.pageSize,
    settleModalOpen,
  ]);

  const applyReviewAllocationsToReadjustState = useCallback(
    (review: PaymentReviewAllocationsResult) => {
      const conflict = mapReviewAllocationsToConflict(review);
      const adjustForm = conflictToAdjustForm(conflict);
      setReadjustConflict(conflict);
      setReadjustPaymentInfo(conflictToPaymentInfo(conflict, displayName));
      setReadjustAdjustAmount(Number(conflict.newPaymentAmount).toFixed(2));
      setReadjustPaymentFields(adjustForm);
      setIsEditingReadjustAmount(false);
      pendingAdjustPaymentRef.current = adjustForm;
    },
    [displayName]
  );

  useEffect(() => {
    const activeId = activePaymentId?.trim();
    if (!isReadjustSettle || !activeId || !paymentReviewAllocationsView) return;

    const viewPaymentId = trimConflictId(paymentReviewAllocationsView.paymentId);
    if (viewPaymentId !== activeId) return;

    applyReviewAllocationsToReadjustState(paymentReviewAllocationsView);
  }, [
    activePaymentId,
    applyReviewAllocationsToReadjustState,
    isReadjustSettle,
    paymentReviewAllocationsView,
  ]);

  useEffect(() => {
    const paymentId = activePaymentId?.trim();
    if (!paymentDetailOpen || !paymentId) return;
    void dispatch(
      fetchPaymentDetail({
        paymentId,
        page: paymentDetailPagination.currentPage,
        pageSize: paymentDetailPagination.pageSize,
      })
    );
  }, [
    activePaymentId,
    dispatch,
    paymentDetailOpen,
    paymentDetailPagination.currentPage,
    paymentDetailPagination.pageSize,
  ]);

  useEffect(() => {
    const refundPaymentId = activeRefundPaymentId?.trim();
    if (!refundDetailOpen || !refundPaymentId) return;
    void dispatch(
      fetchRefundPaymentAllocations({
        refundPaymentId,
        page: refundDetailPagination.currentPage,
        pageSize: refundDetailPagination.pageSize,
      })
    );
  }, [
    activeRefundPaymentId,
    dispatch,
    refundDetailOpen,
    refundDetailPagination.currentPage,
    refundDetailPagination.pageSize,
  ]);

  const refreshPayments = useCallback(async () => {
    await Promise.all([
      dispatch(fetchRequesterPaymentSummary(summaryQuery)).unwrap(),
      dispatch(fetchRequesterRefundSummary(refundSummaryQuery)).unwrap(),
    ]);
  }, [dispatch, refundSummaryQuery, summaryQuery]);

  const resetSettleState = useCallback(() => {
    dispatch(clearPaymentReviewAllocations());
    setSettleMode('pending');
    setCreatePaymentPhase(null);
    setPaymentEntry(defaultPaymentEntryForm(defaultPaymentTypeId));
    setPaymentEntryErrors({});
    setCreatedPaymentInfo(null);
    setReadjustConflict(null);
    setReadjustPaymentInfo(null);
    setReadjustAdjustAmount('');
    setReadjustPaymentFields(defaultReadjustPaymentFields(defaultPaymentTypeId));
    setIsEditingReadjustAmount(false);
    setSkippedAllocationIds([]);
    setReadjustSubmitError(null);
    setReadjustEnableAllocationEditing(false);
    pendingAdjustPaymentRef.current = null;
  }, [defaultPaymentTypeId, dispatch]);

  const clearReadjustSubmitError = useCallback(() => {
    setReadjustSubmitError(null);
  }, []);

  const handleCloseSettleModal = useCallback(() => {
    setSettleModalOpen(false);
    setActivePaymentId(null);
    resetSettleState();
  }, [resetSettleState]);

  const handleView = useCallback(
    (row: RequesterPaymentRowDto) => {
      const paymentId = resolveRowPaymentId(row);
      if (!paymentId) return;
      paymentDetailPagination.goToFirstPage();
      setActivePaymentId(paymentId);
      setPaymentDetailOpen(true);
    },
    [paymentDetailPagination]
  );

  const handleViewRefund = useCallback(
    (row: RequesterRefundPaymentRowDto) => {
      const refundPaymentId = resolveRowRefundPaymentId(row);
      if (!refundPaymentId) return;
      refundDetailPagination.goToFirstPage();
      setActiveRefundPaymentId(refundPaymentId);
      setRefundDetailOpen(true);
    },
    [refundDetailPagination]
  );

  const handleCloseRefundDetail = useCallback(() => {
    setRefundDetailOpen(false);
    setActiveRefundPaymentId(null);
    dispatch(clearRefundPaymentAllocations());
  }, [dispatch]);

  const handleSettle = useCallback(
    (row: RequesterPaymentRowDto) => {
      const paymentId = resolveRowPaymentId(row);
      if (!paymentId || !requesterId.trim()) return;
      resetSettleState();
      unpaidInvoicesPagination.goToFirstPage();
      setActivePaymentId(paymentId);
      setSettleModalOpen(true);
    },
    [requesterId, resetSettleState, unpaidInvoicesPagination]
  );

  const handleOpenRecordPayment = useCallback(() => {
    resetSettleState();
    setActivePaymentId(null);
    setCreatePaymentPhase('entry');
    setPaymentEntry(defaultPaymentEntryForm(defaultPaymentTypeId));
    setPaymentEntryErrors(
      paymentTypeOptions.length > 0
        ? {}
        : { paymentTypeId: PAYMENT_GRID.ERRORS.PAYMENT_TYPE_REQUIRED }
    );
    setSettleMode('pending');
    setSettleModalOpen(true);
  }, [defaultPaymentTypeId, paymentTypeOptions.length, resetSettleState]);

  const clearRefundSelection = useCallback(() => {
    setSelectedRefundPayments(new Map());
  }, []);

  const handleHistoryTabChange = useCallback((nextTab: string) => {
    if (nextTab !== 'payment' && nextTab !== 'refund') return;
    setHistoryTab(nextTab);
  }, []);

  const handleOpenRecordRefund = useCallback(() => {
    clearRefundSelection();
    setRefundEntry(defaultPaymentEntryForm(defaultPaymentTypeId));
    setRefundEntryErrors(
      paymentTypeOptions.length > 0
        ? {}
        : { paymentTypeId: PAYMENT_GRID.ERRORS.PAYMENT_TYPE_REQUIRED }
    );
    refundablePaymentsPagination.goToFirstPage();
    setRecordRefundModalOpen(true);
  }, [clearRefundSelection, defaultPaymentTypeId, paymentTypeOptions.length, refundablePaymentsPagination]);

  const handleCloseRecordRefundModal = useCallback(() => {
    setRecordRefundModalOpen(false);
    clearRefundSelection();
  }, [clearRefundSelection]);

  const handleToggleRefundRow = useCallback((row: RequesterPaymentRowDto, selected: boolean) => {
    const paymentId = resolveRowPaymentId(row);
    if (!paymentId) return;
    setSelectedRefundPayments((prev) => {
      const next = new Map(prev);
      if (selected) next.set(paymentId, getEscrowAmount(row));
      else next.delete(paymentId);
      return next;
    });
  }, []);

  const handleToggleAllRefundOnPage = useCallback(
    (rows: RequesterPaymentRowDto[], selected: boolean) => {
      setSelectedRefundPayments((prev) => {
        const next = new Map(prev);
        for (const row of rows) {
          const paymentId = resolveRowPaymentId(row);
          if (!paymentId) continue;
          if (selected) next.set(paymentId, getEscrowAmount(row));
          else next.delete(paymentId);
        }
        return next;
      });
    },
    []
  );

  const selectedRefundPaymentIds = useMemo(
    () => new Set(selectedRefundPayments.keys()),
    [selectedRefundPayments]
  );

  const refundAmount = useMemo(
    () => Array.from(selectedRefundPayments.values()).reduce((sum, amount) => sum + amount, 0),
    [selectedRefundPayments]
  );

  const handleRefundEntryChange = useCallback((patch: Partial<PaymentEntryFormState>) => {
    setRefundEntry((prev) => ({ ...prev, ...patch }));
    setRefundEntryErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(patch) as (keyof PaymentEntryFormState)[]) {
        if (next[key]) delete next[key];
      }
      return next;
    });
  }, []);

  const handleSubmitRefund = useCallback(async (): Promise<boolean> => {
    const nextErrors: Partial<Record<keyof PaymentEntryFormState, string>> = {};
    if (!refundEntry.paymentDate.trim()) {
      nextErrors.paymentDate = PAYMENT_GRID.ERRORS.DATE_REQUIRED;
    }
    if (refundAmount <= 0) {
      nextErrors.amount = PAYMENT_GRID.ERRORS.AMOUNT_INVALID;
    }
    if (!refundEntry.paymentTypeId.trim() || paymentTypeOptions.length === 0) {
      nextErrors.paymentTypeId = PAYMENT_GRID.ERRORS.PAYMENT_TYPE_REQUIRED;
    }
    if (Object.keys(nextErrors).length > 0) {
      setRefundEntryErrors(nextErrors);
      return false;
    }
    if (!requesterId.trim() || selectedRefundPayments.size === 0) return false;

    try {
      await dispatch(
        allocateRefundPaymentThunk({
          requesterID: requesterId.trim(),
          paymentDate: refundEntry.paymentDate,
          paymentTypeId: refundEntry.paymentTypeId,
          referenceNumber: refundEntry.referenceNumber.trim() || null,
          payments: Array.from(selectedRefundPayments.entries()).map(([paymentId, amount]) => ({
            paymentId,
            amount,
          })),
        })
      ).unwrap();

      setRecordRefundModalOpen(false);
      clearRefundSelection();
      await refreshPayments();
      return true;
    } catch {
      return false;
    }
  }, [
    clearRefundSelection,
    dispatch,
    refundAmount,
    refundEntry,
    paymentTypeOptions.length,
    refreshPayments,
    requesterId,
    selectedRefundPayments,
  ]);

  const handlePaymentEntryChange = useCallback((patch: Partial<PaymentEntryFormState>) => {
    setPaymentEntry((prev) => ({ ...prev, ...patch }));
    setPaymentEntryErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(patch) as (keyof PaymentEntryFormState)[]) {
        if (next[key]) delete next[key];
      }
      return next;
    });
  }, []);

  const handleSaveNewPayment = useCallback(async (): Promise<boolean> => {
    const nextErrors: Partial<Record<keyof PaymentEntryFormState, string>> = {};
    if (!paymentEntry.paymentDate.trim()) {
      nextErrors.paymentDate = PAYMENT_GRID.ERRORS.DATE_REQUIRED;
    }
    const parsedAmount = parseEntryAmount(paymentEntry.amount);
    if (parsedAmount == null || parsedAmount <= 0) {
      nextErrors.amount = PAYMENT_GRID.ERRORS.AMOUNT_INVALID;
    }
    if (!paymentEntry.paymentTypeId.trim() || paymentTypeOptions.length === 0) {
      nextErrors.paymentTypeId = PAYMENT_GRID.ERRORS.PAYMENT_TYPE_REQUIRED;
    }
    if (Object.keys(nextErrors).length > 0) {
      setPaymentEntryErrors(nextErrors);
      return false;
    }

    if (!requesterId.trim()) return false;

    try {
      const created = await dispatch(
        createRequesterPaymentThunk({
          requesterID: requesterId.trim(),
          amount: parsedAmount ?? 0,
          paymentDate: paymentEntry.paymentDate,
          paymentTypeId: paymentEntry.paymentTypeId,
          referenceNumber: paymentEntry.referenceNumber.trim() || null,
        })
      ).unwrap();

      const paymentId = created.paymentID?.trim();
      if (!paymentId) return false;

      setFormResetToken((t) => t + 1);
      setCreatedPaymentInfo(paymentDtoToInfo(created, displayName));
      setActivePaymentId(paymentId);
      setCreatePaymentPhase('apply');
      unpaidInvoicesPagination.goToFirstPage();
      await refreshPayments();
      return true;
    } catch {
      return false;
    }
  }, [
    dispatch,
    displayName,
    paymentEntry,
    paymentTypeOptions.length,
    refreshPayments,
    requesterId,
    unpaidInvoicesPagination,
  ]);

  const handleEditPayment = useCallback(
    (row: RequesterPaymentRowDto) => {
      const paymentId = resolveRowPaymentId(row);
      if (!paymentId || !requesterId.trim()) return;

      dispatch(clearPaymentReviewAllocations());
      resetSettleState();
      readjustAllocationsPagination.goToFirstPage();
      setActivePaymentId(paymentId);
      setSettleMode('readjust');
      setSettleModalOpen(true);
    },
    [dispatch, readjustAllocationsPagination, requesterId, resetSettleState]
  );

  const readjustHasPaymentDetailsEdit = useMemo(() => {
    if (!activeReadjustConflict) return false;
    const saved = conflictToAdjustForm(activeReadjustConflict);
    return (
      saved.paymentDate !== readjustPaymentFields.paymentDate ||
      saved.paymentTypeId !== readjustPaymentFields.paymentTypeId ||
      saved.referenceNumber !== readjustPaymentFields.referenceNumber.trim()
    );
  }, [activeReadjustConflict, readjustPaymentFields]);

  const handleReadjustPaymentFieldsChange = useCallback((patch: Partial<ReadjustPaymentFields>) => {
    setReadjustPaymentFields((prev) => {
      const next = { ...prev, ...patch };
      pendingAdjustPaymentRef.current = next;
      return next;
    });
  }, []);

  const handleReadjustAdjustAmountChange = useCallback((value: string) => {
    setReadjustAdjustAmount(value);
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed) && parsed > 0) {
      setReadjustConflict((prev) =>
        prev ? { ...prev, newPaymentAmount: parsed } : prev
      );
    }
  }, []);

  const handleToggleReadjustAmountEdit = useCallback(() => {
    setIsEditingReadjustAmount((prev) => !prev);
  }, []);

  const handleCloseReadjustAmountEdit = useCallback(() => {
    setIsEditingReadjustAmount(false);
  }, []);

  const handleVoidAllocation = useCallback(
    async (paymentAllocationId: string, reason: string) => {
      const trimmedId = paymentAllocationId.trim();
      const trimmedReason = reason.trim();
      if (!trimmedId || !trimmedReason) return;
      await dispatch(
        voidPaymentWithReasonThunk({
          scope: 'allocation',
          paymentAllocationId: trimmedId,
          reason: trimmedReason,
        })
      ).unwrap();
      await refreshPayments();
      const paymentId = activePaymentId?.trim();
      if (!paymentId) return;
      const review = await dispatch(
        fetchPaymentReviewAllocations({
          paymentId,
          page: readjustAllocationsPagination.currentPage,
          pageSize: readjustAllocationsPagination.pageSize,
        })
      ).unwrap();

      if (review.allocations.length === 0) {
        handleCloseSettleModal();
        return;
      }

      applyReviewAllocationsToReadjustState(review);
    },
    [
      activePaymentId,
      applyReviewAllocationsToReadjustState,
      dispatch,
      handleCloseSettleModal,
      readjustAllocationsPagination.currentPage,
      readjustAllocationsPagination.pageSize,
      refreshPayments,
    ]
  );

  const handleConfirmAllocationConflict = useCallback(() => {
    setAllocationConflictOpen(false);

    const parsedAmount = Number(readjustAdjustAmount.trim());
    if (Number.isFinite(parsedAmount) && parsedAmount > 0) {
      setReadjustConflict((prev) =>
        prev ? { ...prev, newPaymentAmount: parsedAmount } : prev
      );
    }

    setIsEditingReadjustAmount(false);
    setReadjustEnableAllocationEditing(true);
  }, [readjustAdjustAmount]);

  const handleCancelAllocationConflict = useCallback(() => {
    setAllocationConflictOpen(false);
    setReadjustEnableAllocationEditing(false);
    const oldAmount = activeReadjustConflict?.oldPaymentAmount;
    if (activeReadjustConflict != null && oldAmount != null) {
      setReadjustAdjustAmount(Number(oldAmount).toFixed(2));
      setReadjustConflict({ ...activeReadjustConflict, newPaymentAmount: oldAmount });
    }
  }, [activeReadjustConflict]);

  const handleSubmitSettlement = useCallback(
    async (payload: SettlePendingInvoicesModalSubmitPayload): Promise<boolean> => {
      const paymentId = activePaymentId?.trim();
      if (!paymentId) return false;

      if (isReadjustSettle && activeReadjustConflict) {
        const adjustForm = pendingAdjustPaymentRef.current;
        if (!adjustForm) return false;

        const allocations: PaymentAdjustAllocationItemDto[] = payload.invoices
          .map((invoice) => {
            const paymentAllocationId = invoice.paymentAllocationId?.trim();
            const invoiceId = invoice.invoiceId?.trim();
            if (!paymentAllocationId || !invoiceId) return null;
            return {
              paymentAllocationId,
              invoiceId,
              amount: invoice.amount,
            };
          })
          .filter((row): row is PaymentAdjustAllocationItemDto => row != null);

        const paymentAmountEdited =
          payload.paymentAmountEdited ??
          Math.abs(
            activeReadjustConflict.newPaymentAmount - activeReadjustConflict.oldPaymentAmount
          ) > 0.001;
        const paymentDetailsEdited =
          payload.paymentDetailsEdited ??
          (() => {
            const saved = conflictToAdjustForm(activeReadjustConflict);
            return (
              saved.paymentDate !== adjustForm.paymentDate ||
              saved.paymentTypeId !== adjustForm.paymentTypeId ||
              saved.referenceNumber !== (adjustForm.referenceNumber ?? '').trim()
            );
          })();
        const allocationAmountEdited = payload.allocationAmountEdited ?? allocations.length > 0;

        if (!paymentAmountEdited && !paymentDetailsEdited && allocations.length === 0) return false;

        if (paymentAmountEdited || paymentDetailsEdited) {
          const result = await dispatch(
            adjustRequesterPaymentThunk({
              paymentId,
              paymentAmount: activeReadjustConflict.newPaymentAmount,
              paymentDate: adjustForm.paymentDate,
              paymentTypeId: adjustForm.paymentTypeId,
              referenceNumber: adjustForm.referenceNumber.trim() || null,
              allocations: allocationAmountEdited ? allocations : [],
            })
          );

          if (adjustRequesterPaymentThunk.rejected.match(result)) {
            if (isPaymentAdjustAllocationConflictReject(result.payload)) {
              openAllocationConflict(result.payload.message, adjustForm);
            } else if (typeof result.payload === 'string' && result.payload.trim()) {
              setReadjustSubmitError(result.payload);
            }
            return false;
          }

          const adjustSkippedIds = adjustRequesterPaymentThunk.fulfilled.match(result)
            ? (result.payload.skippedAllocationIds ?? [])
            : [];
          setFormResetToken((t) => t + 1);
          await refreshPayments();
          const reviewAfterAdjust = await dispatch(
            fetchPaymentReviewAllocations({
              paymentId,
              page: readjustAllocationsPagination.currentPage,
              pageSize: readjustAllocationsPagination.pageSize,
            })
          ).unwrap();
          applyReviewAllocationsToReadjustState(reviewAfterAdjust);
          if (adjustSkippedIds.length > 0) {
            setSkippedAllocationIds(adjustSkippedIds);
            return false;
          }
        } else {
          const result = await dispatch(
            updatePaymentAllocationAmountThunk({
              paymentId,
              allocations,
            })
          );

          if (updatePaymentAllocationAmountThunk.rejected.match(result)) {
            if (typeof result.payload === 'string' && result.payload.trim()) {
              setReadjustSubmitError(result.payload);
            }
            return false;
          }

          const updateSkippedIds = updatePaymentAllocationAmountThunk.fulfilled.match(result)
            ? (result.payload.skippedAllocationIds ?? [])
            : [];
          setFormResetToken((t) => t + 1);
          await refreshPayments();
          const reviewAfterUpdate = await dispatch(
            fetchPaymentReviewAllocations({
              paymentId,
              page: readjustAllocationsPagination.currentPage,
              pageSize: readjustAllocationsPagination.pageSize,
            })
          ).unwrap();
          applyReviewAllocationsToReadjustState(reviewAfterUpdate);
          if (updateSkippedIds.length > 0) {
            setSkippedAllocationIds(updateSkippedIds);
            return false;
          }
        }

        handleCloseSettleModal();
        return true;
      }

      if (payload.invoices.length === 0) return false;

      if (!requesterId.trim()) return false;

      try {
        await dispatch(
          allocatePaymentThunk({
            paymentId,
            requesterId: requesterId.trim(),
            allocationDate: payload.allocationDate,
            invoices: payload.invoices,
          })
        ).unwrap();

        await Promise.all([
          dispatch(
            fetchPaymentUnpaidInvoices({
              paymentId,
              requesterId: requesterId.trim(),
              page: unpaidInvoicesPagination.currentPage,
              pageSize: unpaidInvoicesPagination.pageSize,
            })
          ).unwrap(),
          dispatch(fetchRequesterPaymentSummary(summaryQuery)).unwrap(),
        ]);
        return true;
      } catch {
        return false;
      }
    },
    [
      activePaymentId,
      applyReviewAllocationsToReadjustState,
      dispatch,
      handleCloseSettleModal,
      activeReadjustConflict,
      isReadjustSettle,
      openAllocationConflict,
      readjustAllocationsPagination.currentPage,
      readjustAllocationsPagination.pageSize,
      refreshPayments,
      requesterId,
      summaryQuery,
      unpaidInvoicesPagination.currentPage,
      unpaidInvoicesPagination.pageSize,
    ]
  );

  const clearDateFilters = useCallback(() => {
    setStartDate('');
    setEndDate('');
    setDatePickerKey((key) => key + 1);
    pagination.goToFirstPage();
    refundPagination.goToFirstPage();
  }, [pagination, refundPagination]);

  const [deletingPaymentRow, setDeletingPaymentRow] = useState<RequesterPaymentRowDto | null>(null);
  const [deletingRefundRow, setDeletingRefundRow] = useState<RequesterRefundPaymentRowDto | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const handleDeletePaymentClick = useCallback((row: RequesterPaymentRowDto) => {
    setDeletingPaymentRow(row);
  }, []);

  const handleDeleteRefundClick = useCallback((row: RequesterRefundPaymentRowDto) => {
    setDeletingRefundRow(row);
  }, []);

  const handleCancelDeletePayment = useCallback(() => {
    setDeletingPaymentRow(null);
  }, []);

  const handleCancelDeleteRefund = useCallback(() => {
    setDeletingRefundRow(null);
  }, []);

  const handleConfirmDeletePayment = useCallback(
    async (reason: string) => {
      const paymentId = resolveRowPaymentId(deletingPaymentRow!);
      if (!paymentId || !reason.trim()) return;
      setDeleteSubmitting(true);
      try {
        await dispatch(deletePaymentThunk({ paymentId, reason })).unwrap();
        setDeletingPaymentRow(null);
        await refreshPayments();
      } catch {
        // toast shown by thunk
      } finally {
        setDeleteSubmitting(false);
      }
    },
    [deletingPaymentRow, dispatch, refreshPayments]
  );

  const handleConfirmDeleteRefund = useCallback(
    async (reason: string) => {
      const refundPaymentId = deletingRefundRow?.refundPaymentId?.trim();
      if (!refundPaymentId || !reason.trim()) return;
      setDeleteSubmitting(true);
      try {
        await dispatch(deleteRefundPaymentThunk({ refundPaymentId, reason })).unwrap();
        setDeletingRefundRow(null);
        await refreshPayments();
      } catch {
        // toast shown by thunk
      } finally {
        setDeleteSubmitting(false);
      }
    },
    [deletingRefundRow, dispatch, refreshPayments]
  );

  const [voidingRefundAllocationRow, setVoidingRefundAllocationRow] =
    useState<RefundPaymentAllocationDetailDto | null>(null);
  const [voidRefundAllocationSubmitting, setVoidRefundAllocationSubmitting] = useState(false);

  const handleVoidRefundAllocationClick = useCallback(
    (row: RefundPaymentAllocationDetailDto) => {
      setVoidingRefundAllocationRow(row);
    },
    []
  );

  const handleCancelVoidRefundAllocation = useCallback(() => {
    setVoidingRefundAllocationRow(null);
  }, []);

  const handleConfirmVoidRefundAllocation = useCallback(
    async (reason: string) => {
      const allocationId = voidingRefundAllocationRow?.refundPaymentAllocationID?.trim();
      if (!allocationId || !reason.trim()) return;
      setVoidRefundAllocationSubmitting(true);
      try {
        await dispatch(
          voidRefundPaymentAllocationThunk({ refundPaymentAllocationId: allocationId, reason })
        ).unwrap();
        setVoidingRefundAllocationRow(null);
        if (activeRefundPaymentId) {
          dispatch(
            fetchRefundPaymentAllocations({
              refundPaymentId: activeRefundPaymentId,
              page: refundDetailPagination.currentPage,
              pageSize: refundDetailPagination.pageSize,
            })
          );
        }
        await refreshPayments();
      } catch {
        // toast shown by thunk
      } finally {
        setVoidRefundAllocationSubmitting(false);
      }
    },
    [voidingRefundAllocationRow, activeRefundPaymentId, refundDetailPagination, dispatch, refreshPayments]
  );

  const columns = useMemo(
    () =>
      buildRequesterPaymentColumns({
        onView: handleView,
        onEdit: handleEditPayment,
        onSettle: handleSettle,
        onDelete: handleDeletePaymentClick,
      }),
    [handleDeletePaymentClick, handleEditPayment, handleSettle, handleView]
  );

  const refundablePaymentColumns = useMemo(
    () =>
      buildRefundablePaymentSelectColumns(
        selectedRefundPaymentIds,
        handleToggleRefundRow,
        handleToggleAllRefundOnPage,
        refundablePayments
      ),
    [
      handleToggleAllRefundOnPage,
      handleToggleRefundRow,
      refundablePayments,
      selectedRefundPaymentIds,
    ]
  );

  const paymentDetailColumns = useMemo(
    () => buildPaymentDetailColumns((invoiceId) => setPaymentInfoInvoiceId(invoiceId)),
    []
  );

  const refundColumns = useMemo(
    () => buildRequesterRefundPaymentColumns(handleViewRefund, handleDeleteRefundClick),
    [handleDeleteRefundClick, handleViewRefund]
  );

  const refundDetailColumns = useMemo(
    () => buildRefundPaymentDetailColumns(handleVoidRefundAllocationClick),
    [handleVoidRefundAllocationClick]
  );

  const activeRefundRow = useMemo(
    () =>
      refunds.find((row) => resolveRowRefundPaymentId(row) === activeRefundPaymentId?.trim()) ??
      null,
    [activeRefundPaymentId, refunds]
  );

  const activeRefundInfo = useMemo((): PaymentModalPaymentInfo | null => {
    if (refundPaymentAllocationsView) {
      return {
        paymentNumber: refundPaymentAllocationsView.refundPaymentNumber ?? undefined,
        paymentDate: refundPaymentAllocationsView.paymentDate,
        paymentTypeId: refundPaymentAllocationsView.paymentTypeId,
        paymentTypeName: refundPaymentAllocationsView.paymentTypeName,
        referenceNumber: refundPaymentAllocationsView.referenceNumber,
        requesterName: displayName,
      };
    }

    if (!activeRefundRow) return null;
    return {
      paymentNumber: activeRefundRow.refundPaymentNumber ?? undefined,
      paymentDate: activeRefundRow.paymentDate,
      paymentTypeId: activeRefundRow.paymentTypeId,
      paymentTypeName: activeRefundRow.paymentTypeName,
      referenceNumber: activeRefundRow.referenceNumber,
      requesterName: displayName,
    };
  }, [activeRefundRow, displayName, refundPaymentAllocationsView]);

  const settleModalTitle = useMemo(() => {
    if (createPaymentPhase === 'entry') return S.FORM_TITLE;
    if (createPaymentPhase === 'apply') return PAYMENT_GRID.SETTLE_PENDING_INVOICES.TITLE;
    if (isReadjustSettle) return PAYMENT_GRID.SETTLE_PENDING_INVOICES.READJUST_TITLE;
    return undefined;
  }, [createPaymentPhase, isReadjustSettle]);

  const modalsProps: RequesterPaymentPageModalsProps = {
    displayName,
    requesterId,
    requesterOptions,
    saving,
    allocationConflictOpen,
    allocationConflictMessage,
    onConfirmAllocationConflict: handleConfirmAllocationConflict,
    onCancelAllocationConflict: handleCancelAllocationConflict,
    settleModalOpen,
    settleModalTitle,
    settleMode,
    isReadjustSettle,
    createPaymentPhase,
    paymentEntry,
    paymentEntryErrors,
    onPaymentEntryChange: handlePaymentEntryChange,
    onSaveNewPayment: handleSaveNewPayment,
    paymentTypeOptions,
    paymentTypesLoading,
    settlePaymentInfo,
    settleTotalPayment,
    readjustConflict: activeReadjustConflict,
    settleModalKey: `${activePaymentId ?? 'closed'}-${formResetToken}`,
    readjustAllocationsLoading,
    readjustAllocationsError,
    readjustSubmitError,
    onClearReadjustSubmitError: clearReadjustSubmitError,
    readjustEnableAllocationEditing,
    readjustAppliedAmount: activeReadjustConflict?.appliedAmount ?? 0,
    readjustAdjustAmount,
    readjustPaymentFields,
    onReadjustPaymentFieldsChange: handleReadjustPaymentFieldsChange,
    readjustHasPaymentDetailsEdit,
    isEditingReadjustAmount,
    onReadjustAdjustAmountChange: handleReadjustAdjustAmountChange,
    onToggleReadjustAmountEdit: handleToggleReadjustAmountEdit,
    onCloseReadjustAmountEdit: handleCloseReadjustAmountEdit,
    onVoidAllocation: handleVoidAllocation,
    voidingPaymentAllocationId,
    skippedAllocationIds,
    unpaidInvoicesLoading,
    unpaidInvoicesError,
    unpaidInvoicesSubmitting,
    paymentUsedBefore: isReadjustSettle ? 0 : (unpaidInvoicesView?.appliedAmount ?? 0),
    paymentRefundedBefore: isReadjustSettle
      ? (paymentReviewAllocationsView?.refundedAmount ?? activeReadjustConflict?.refundedAmount ?? 0)
      : (unpaidInvoicesView?.refundedAmount ?? 0),
    readjustInvoiceRows,
    unpaidInvoiceRows: unpaidInvoicesLoading ? [] : (unpaidInvoicesView?.invoices ?? []),
    settlePagination,
    onCloseSettleModal: handleCloseSettleModal,
    onSubmitSettlement: handleSubmitSettlement,
    paymentDetailOpen,
    paymentDetailLoading,
    paymentDetailError,
    activePaymentInfo,
    paymentDetailAmount: paymentDetailView?.amount ?? 0,
    paymentDetailApplied: paymentDetailView?.appliedAmount ?? 0,
    paymentDetailRefunded: paymentDetailView?.refundedAmount ?? 0,
    paymentDetailAvailable: paymentDetailView?.availableAmount ?? 0,
    paymentDetailColumns,
    paymentDetailRows: paymentDetailView?.invoices ?? [],
    paymentDetailPagination: toServerPagination(paymentDetailPagination),
    onClosePaymentDetail: () => setPaymentDetailOpen(false),
    paymentInfoInvoiceId,
    onCloseInvoicePayment: () => setPaymentInfoInvoiceId(null),
    recordRefundModalOpen,
    refundablePayments,
    refundablePaymentsLoading,
    refundablePaymentsError,
    refundablePaymentColumns,
    refundablePaymentsPagination: toServerPagination(refundablePaymentsPagination),
    totalEscrowAvailable,
    refundAmount,
    selectedRefundCount: selectedRefundPayments.size,
    refundEntry,
    refundEntryErrors,
    refundSubmitting,
    onRefundEntryChange: handleRefundEntryChange,
    onCloseRecordRefundModal: handleCloseRecordRefundModal,
    onSubmitRefund: handleSubmitRefund,
    refundDetailOpen,
    refundDetailLoading,
    refundDetailError,
    activeRefundPaymentId,
    activeRefundInfo,
    refundDetailAmount: refundPaymentAllocationsView?.amount ?? activeRefundRow?.amount ?? 0,
    refundDetailColumns,
    refundDetailRows: refundPaymentAllocationsView?.allocations ?? [],
    refundDetailPagination: toServerPagination(refundDetailPagination),
    onCloseRefundDetail: handleCloseRefundDetail,
    deletingPaymentRow,
    deletingRefundRow,
    deleteSubmitting,
    onDeletePaymentConfirm: handleConfirmDeletePayment,
    onDeletePaymentCancel: handleCancelDeletePayment,
    onDeleteRefundConfirm: handleConfirmDeleteRefund,
    onDeleteRefundCancel: handleCancelDeleteRefund,
    voidingRefundAllocationRow,
    voidRefundAllocationSubmitting,
    onVoidRefundAllocationConfirm: handleConfirmVoidRefundAllocation,
    onVoidRefundAllocationCancel: handleCancelVoidRefundAllocation,
  };

  return {
    displayName,
    requesterOptions,
    summary,
    payments,
    loading,
    error,
    columns,
    refunds,
    refundSummary,
    refundLoading,
    refundError,
    refundColumns,
    historyTab,
    onHistoryTabChange: handleHistoryTabChange,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    datePickerKey,
    clearDateFilters,
    pagination,
    refundPagination,
    handleOpenRecordPayment,
    handleOpenRecordRefund,
    recordRefundModalOpen,
    selectedRefundCount: selectedRefundPayments.size,
    refundAmount,
    modalsProps,
  };
}
