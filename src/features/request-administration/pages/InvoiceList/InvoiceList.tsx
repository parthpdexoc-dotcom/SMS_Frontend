import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import type { SelectChangeEvent } from '@mui/material/Select';
import { Box, Skeleton, Stack } from '@mui/material';
import {
  SMSBox,
  SMSButton,
  SMSDollar,
  SMSDropdown,
  SMSIcon,
  SMSIconButton,
  SMSPagination,
  SMSTextField,
  type SMSDropdownOption,
} from '@/components/smsatoms';
import { SMSConfirmDialog } from '@/components/smsmolecules';
import { SMSDataTableWrapper, type DataTableColumn } from '@/components/smsorganisms';
import { usePagination } from '@/hooks/usePagination';
import { useDebounce } from '@/hooks/useDebounceSearch';
import {
  INVOICE_GRID,
  PAYMENT_GRID,
  REQUESTER_GRID_MENU,
  REQUESTER_STATEMENT_GRID,
} from '@/constants/strings';
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants/tablePagination';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  deleteInvoiceThunk,
  fetchInvoiceByIdThunk,
  fetchInvoicesByProjectNumber,
  fetchInvoicesByRequesterId,
  fetchRequesterInvoiceCounts,
} from '@/store/slices/invoiceSlice';
import { fetchRequesters } from '@/store/slices/requesterSlice';
import { InvoicePaymentModal, InvoicePreviewModal } from '@/components/smsmolecules';
import {
  getInvoiceIsPaid,
  toInvoiceDueDateRangeParam,
  type InvoiceDto,
  type InvoiceDueDateRangeFilter,
  type InvoiceIsPaidFilter,
  type InvoiceRow,
} from '@/types/invoice';
import type { RequesterResponse } from '@/types/requester';
import { getInvoiceById, getInvoicePaymentInformation } from '@/services/invoiceService';
import { formatCurrency, formatDateShort } from '@/utils';
import { getRequestProjectNumber } from '@/utils/requestInvoiceUtils';
import { buildRequesterScopedAdminRoute, navigateAdminBack } from '@/utils/requesterAdminNavigation';
import type { InvoiceListLocationState, InvoiceModifyConflictState } from '@/utils/invoiceModifyConflict';
import './InvoiceList.css';

const toInvoiceRow = (inv: InvoiceDto): InvoiceRow => {
  const isPaid = getInvoiceIsPaid(inv);
  const startDate = inv.startDate ?? inv.jobPositionStartDate ?? null;
  const endDate = inv.endDate ?? inv.jobPositionEndDate ?? null;
  return {
    invoicesID: inv.invoicesID,
    invoiceNo: inv.invoiceNo ?? '',
    invoiceDate: inv.dateCreated ? formatDateShort(inv.dateCreated) : '',
    startDate: startDate ? formatDateShort(startDate) : '',
    endDate: endDate ? formatDateShort(endDate) : '',
    dueDate: inv.dueDate ? formatDateShort(inv.dueDate) : '',
    customer: inv.billingToName ?? inv.requesterName ?? '',
    total: formatCurrency(inv.total),
    paid:
      isPaid === true
        ? INVOICE_GRID.TABLE.COLUMNS.PAID_YES
        : isPaid === false
          ? INVOICE_GRID.TABLE.COLUMNS.PAID_NO
          : '',
    balanceDue: inv.balanceDue != null ? formatCurrency(inv.balanceDue) : '',
  };
};

const buildInvoiceColumns = (
  handlers: {
    onViewDetails: (row: InvoiceRow) => void;
    onViewPayment: (row: InvoiceRow) => void;
    onDelete: (row: InvoiceRow) => void;
  },
  options?: { includeCustomer?: boolean }
): DataTableColumn<InvoiceRow>[] => {
  const { includeCustomer = false } = options ?? {};
  const columns: DataTableColumn<InvoiceRow>[] = [
    {
      key: 'invoiceNo',
      label: INVOICE_GRID.TABLE.COLUMNS.INVOICE_NO,
      render: (_value, row) => row.invoiceNo || INVOICE_GRID.EMPTY_PLACEHOLDER,
    },
    {
      key: 'invoiceDate',
      label: INVOICE_GRID.TABLE.COLUMNS.INVOICE_DATE,
      render: (_value, row) => row.invoiceDate || '-',
    },
    {
      key: 'startDate',
      label: INVOICE_GRID.TABLE.COLUMNS.START_DATE,
      render: (_value, row) => row.startDate || INVOICE_GRID.EMPTY_PLACEHOLDER,
    },
    {
      key: 'endDate',
      label: INVOICE_GRID.TABLE.COLUMNS.END_DATE,
      render: (_value, row) => row.endDate || INVOICE_GRID.EMPTY_PLACEHOLDER,
    },
    {
      key: 'dueDate',
      label: INVOICE_GRID.TABLE.COLUMNS.DUE_DATE,
      render: (_value, row) => row.dueDate || INVOICE_GRID.EMPTY_PLACEHOLDER,
    },
  ];

  if (includeCustomer) {
    columns.push({
      key: 'customer',
      label: INVOICE_GRID.TABLE.COLUMNS.CUSTOMER,
      render: (_value, row) => row.customer || '-',
    });
  }

  columns.push(
    {
      key: 'total',
      label: INVOICE_GRID.TABLE.COLUMNS.TOTAL,
      align: 'left',
      render: (_value, row) => row.total || INVOICE_GRID.EMPTY_PLACEHOLDER,
    },
    {
      key: 'paid',
      label: INVOICE_GRID.TABLE.COLUMNS.PAID,
      align: 'left',
      render: (_value, row) => row.paid || INVOICE_GRID.EMPTY_PLACEHOLDER,
    },
    {
      key: 'balanceDue',
      label: INVOICE_GRID.TABLE.COLUMNS.BALANCE_DUE,
      align: 'left',
      render: (_value, row) => row.balanceDue || '-',
    },
    {
      key: 'action',
      label: INVOICE_GRID.TABLE.COLUMNS.ACTION,
      render: (_value, row) => (
        <Stack direction="row" alignItems="center" spacing={0.5} useFlexGap>
          <SMSIconButton
            size="small"
            tone="primary"
            allowWhenSuspended
            onClick={(e) => {
              e.stopPropagation();
              handlers.onViewDetails(row);
            }}
            title={INVOICE_GRID.TABLE.VIEW_DETAILS}
            aria-label={INVOICE_GRID.TABLE.VIEW_DETAILS}
            sx={{ borderRadius: 1 }}
          >
            <SMSIcon name="eye" size="sm" />
          </SMSIconButton>
          <SMSDollar
            label={INVOICE_GRID.TABLE.VIEW_PAYMENT}
            tone="secondary"
            allowWhenSuspended
            onClick={(e) => {
              e.stopPropagation();
              handlers.onViewPayment(row);
            }}
            sx={{ borderRadius: 1 }}
          />
          <SMSIconButton
            size="small"
            tone="error"
            allowWhenSuspended
            onClick={(e) => {
              e.stopPropagation();
              handlers.onDelete(row);
            }}
            title={INVOICE_GRID.TABLE.DELETE}
            aria-label={INVOICE_GRID.TABLE.DELETE}
            sx={{ borderRadius: 1 }}
          >
            <SMSIcon name="delete" size="sm" />
          </SMSIconButton>
        </Stack>
      ),
    }
  );

  return columns;
};

export const InvoiceList: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    requesterInvoiceCounts,
    requesterInvoiceCountsTotal,
    requesterInvoiceCountsLoading,
    invoicesByRequesterId,
    requestInvoices,
    requestInvoicesProjectNumber,
    requestInvoicesLoading,
    isDeleting,
  } = useAppSelector((state) => ({
    requesterInvoiceCounts: state.invoice.requesterInvoiceCounts,
    requesterInvoiceCountsTotal: state.invoice.requesterInvoiceCountsTotal,
    requesterInvoiceCountsLoading: state.invoice.requesterInvoiceCountsLoading,
    invoicesByRequesterId: state.invoice.invoicesByRequesterId,
    requestInvoices: state.invoice.requestInvoices,
    requestInvoicesProjectNumber: state.invoice.requestInvoicesProjectNumber,
    requestInvoicesLoading: state.invoice.requestInvoicesLoading,
    isDeleting: state.invoice.isDeleting,
  }));
  const { requesters } = useAppSelector((state) => state.requester);
  const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false);
  const [invoicePreviewOpen, setInvoicePreviewOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentInvoiceId, setPaymentInvoiceId] = useState<string | null>(null);
  const [paymentInvoiceHeader, setPaymentInvoiceHeader] = useState<{
    invoiceNo?: string | null;
    billingToName?: string | null;
    dateCreated?: string | null;
    dueDate?: string | null;
  } | null>(null);
  const [paymentInvoiceRequesterId, setPaymentInvoiceRequesterId] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDto | null>(null);
  const [modifyConflict, setModifyConflict] = useState<InvoiceModifyConflictState | null>(null);
  const modifyConflictConsumedRef = React.useRef(false);
  const locationState = location.state as InvoiceListLocationState | null;
  const requestContext = locationState?.request ?? null;
  const returnTab = locationState?.returnTab ?? 'daily';
  const returnPath = locationState?.returnPath;
  const projectNumber = getRequestProjectNumber(requestContext);
  /** Request-scoped only when opened from Daily Administration (returnTab + request in state). */
  const isRequestScoped = !!(requestContext && projectNumber && locationState?.returnTab);
  const requestTitle = requestContext?.title?.trim() || requestContext?.requestID || '';
  const currentListPath = `${location.pathname}${location.search}`;
  /** Restore request-scoped invoice list when returning from Payment (not Daily Administration). */
  const requestScopedPaymentReturn = useMemo((): { path: string; state: InvoiceListLocationState } | null => {
    if (!isRequestScoped || !requestContext) return null;
    return {
      path: INVOICE_GRID.INVOICE_LIST_PATH,
      state: {
        request: requestContext,
        returnTab,
        returnPath,
      },
    };
  }, [isRequestScoped, requestContext, returnPath, returnTab]);
  /** Pre-select requester only when explicitly passed (manage requesters menu / modify-conflict), not from daily-admin drill-in. */
  const explicitRequesterId = useMemo(() => {
    if (isRequestScoped) return undefined;
    const fromState = locationState?.requesterId?.trim();
    const fromQuery = searchParams.get('requesterId')?.trim();
    return fromState || fromQuery || undefined;
  }, [isRequestScoped, locationState?.requesterId, searchParams]);
  const [selectedRequesterId, setSelectedRequesterId] = useState<string | undefined>(undefined);
  const [selectedIsPaidFilter, setSelectedIsPaidFilter] = useState<InvoiceIsPaidFilter>('all');
  const [selectedDueDateRangeFilter, setSelectedDueDateRangeFilter] =
    useState<InvoiceDueDateRangeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRequesterIds, setExpandedRequesterIds] = useState<string[]>([]);
  const [deletingInvoice, setDeletingInvoice] = useState<InvoiceRow | null>(null);
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const pagination = usePagination({
    initialPage: 1,
    initialPageSize: DEFAULT_TABLE_PAGE_SIZE,
    totalItems: 0,
  });

  useEffect(() => {
    if (isRequestScoped) return;
    void dispatch(fetchRequesters({ page: 1, pageSize: 10000, sortBy: 'name', sortDirection: 'asc' }));
  }, [dispatch, isRequestScoped]);

  useEffect(() => {
    const conflict = locationState?.modifyConflict;
    if (!conflict?.invoiceId?.trim() || modifyConflictConsumedRef.current) return;

    modifyConflictConsumedRef.current = true;

    void (async () => {
      const invoiceId = conflict.invoiceId.trim();
      let invoice: InvoiceDto | null = null;

      try {
        invoice = await getInvoiceById(invoiceId);
      } catch {
        try {
          const paymentInfo = await getInvoicePaymentInformation(invoiceId);
          invoice = paymentInfo.invoice ?? null;
        } catch {
          modifyConflictConsumedRef.current = false;
          return;
        }
      }

      if (!invoice) {
        modifyConflictConsumedRef.current = false;
        return;
      }

      if (conflict.requesterId) {
        setSelectedRequesterId(conflict.requesterId);
      }
      setModifyConflict(conflict);
      setSelectedInvoice(invoice);
      setInvoicePreviewOpen(true);

      navigate(`${location.pathname}${location.search}`, {
        replace: true,
        state: conflict.requesterId ? { requesterId: conflict.requesterId } : null,
      });
    })();
  }, [location.pathname, location.search, locationState?.modifyConflict, navigate]);

  useEffect(() => {
    if (isRequestScoped) return;
    setSelectedRequesterId(explicitRequesterId);
  }, [explicitRequesterId, isRequestScoped, location.key]);

  useLayoutEffect(() => {
    if (!isRequestScoped) return;
    pagination.goToFirstPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchQuery, isRequestScoped, projectNumber]);

  const isPaidQueryParam: boolean | undefined =
    selectedIsPaidFilter === '1' ? true : selectedIsPaidFilter === '0' ? false : undefined;
  const dueDateRangeQueryParam = toInvoiceDueDateRangeParam(selectedDueDateRangeFilter);

  const loadAdminRequesterCounts = useCallback(
    (page: number, pageSize: number) => {
      setExpandedRequesterIds([]);
      const searchTerm = debouncedSearchQuery.trim();
      void dispatch(
        fetchRequesterInvoiceCounts({
          page,
          pageSize,
          requesterId: selectedRequesterId?.trim() || null,
          searchTerm: searchTerm || null,
          isPaid: isPaidQueryParam ?? null,
          dueDateRangeDays: dueDateRangeQueryParam ?? null,
        })
      );
    },
    [
      debouncedSearchQuery,
      dispatch,
      dueDateRangeQueryParam,
      isPaidQueryParam,
      selectedRequesterId,
    ]
  );

  const loadRequesterInvoices = useCallback(
    (requesterId: string, page = 1, pageSize = DEFAULT_TABLE_PAGE_SIZE) => {
      const id = requesterId.trim();
      if (!id) return;
      const searchTerm = debouncedSearchQuery.trim();
      void dispatch(
        fetchInvoicesByRequesterId({
          requesterId: id,
          page,
          pageSize,
          ...(isPaidQueryParam != null ? { isPaid: isPaidQueryParam } : {}),
          ...(searchTerm ? { searchTerm } : {}),
          ...(dueDateRangeQueryParam != null ? { dueDateRangeDays: dueDateRangeQueryParam } : {}),
        })
      );
    },
    [debouncedSearchQuery, dispatch, dueDateRangeQueryParam, isPaidQueryParam]
  );

  useEffect(() => {
    if (isRequestScoped) return;
    pagination.goToFirstPage();
    loadAdminRequesterCounts(1, pagination.pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchQuery, isRequestScoped, selectedDueDateRangeFilter, selectedIsPaidFilter, selectedRequesterId]);

  useEffect(() => {
    if (isRequestScoped && projectNumber) {
      void dispatch(fetchInvoicesByProjectNumber(projectNumber));
    }
  }, [dispatch, isRequestScoped, projectNumber]);

  useEffect(() => {
    if (!isRequestScoped) return;
    setInvoicePreviewOpen(false);
    setSelectedInvoice(null);
    setCreateInvoiceOpen(false);
    setPaymentModalOpen(false);
    setPaymentInvoiceId(null);
    setPaymentInvoiceRequesterId(null);
  }, [isRequestScoped, projectNumber]);

  const requestScopedInvoices = useMemo(() => {
    if (!isRequestScoped || !projectNumber) return [];
    if (requestInvoicesProjectNumber !== projectNumber) return [];
    return requestInvoices;
  }, [isRequestScoped, projectNumber, requestInvoices, requestInvoicesProjectNumber]);

  const filteredRequestInvoices = useMemo(() => {
    if (!isRequestScoped) return [];
    const q = debouncedSearchQuery.trim().toLowerCase();
    if (!q) return requestScopedInvoices;
    return requestScopedInvoices.filter((inv) => {
      const invoiceNo = (inv.invoiceNo ?? '').toLowerCase();
      const customer = (inv.billingToName ?? '').toLowerCase();
      return invoiceNo.includes(q) || customer.includes(q);
    });
  }, [debouncedSearchQuery, isRequestScoped, requestScopedInvoices]);

  useEffect(() => {
    if (!isRequestScoped) return;
    pagination.setTotalItems(filteredRequestInvoices.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredRequestInvoices.length, isRequestScoped]);

  const pagedRequestInvoices = useMemo(() => {
    if (!isRequestScoped) return [];
    const start = (pagination.currentPage - 1) * pagination.pageSize;
    return filteredRequestInvoices.slice(start, start + pagination.pageSize);
  }, [filteredRequestInvoices, isRequestScoped, pagination.currentPage, pagination.pageSize]);

  const allAdminInvoices = useMemo(
    () => Object.values(invoicesByRequesterId).flatMap((entry) => entry.data),
    [invoicesByRequesterId]
  );

  /** Load invoices for expanded requesters (on open, or after counts refresh clears cache). */
  useEffect(() => {
    if (isRequestScoped || requesterInvoiceCountsLoading) return;
    for (const requesterId of expandedRequesterIds) {
      if (invoicesByRequesterId[requesterId]) continue;
      loadRequesterInvoices(requesterId);
    }
  }, [
    expandedRequesterIds,
    invoicesByRequesterId,
    isRequestScoped,
    loadRequesterInvoices,
    requesterInvoiceCountsLoading,
  ]);

  const activeInvoices = isRequestScoped ? pagedRequestInvoices : allAdminInvoices;
  const tableLoading = isRequestScoped ? requestInvoicesLoading : requesterInvoiceCountsLoading;

  useEffect(() => {
    if (!invoicePreviewOpen || !selectedInvoice?.invoicesID) return;
    const pool = isRequestScoped ? requestScopedInvoices : allAdminInvoices;
    const updated = pool.find(
      (inv) => String(inv.invoicesID) === String(selectedInvoice.invoicesID)
    );
    if (!updated) return;
    const totalsChanged =
      updated.total !== selectedInvoice.total ||
      updated.paymentsApplied !== selectedInvoice.paymentsApplied ||
      updated.balanceDue !== selectedInvoice.balanceDue ||
      updated.officerHourlyTotal !== selectedInvoice.officerHourlyTotal;
    if (totalsChanged) {
      setSelectedInvoice(updated);
    }
  }, [allAdminInvoices, requestScopedInvoices, invoicePreviewOpen, selectedInvoice, isRequestScoped]);

  const requesterSelectOptions: SMSDropdownOption[] = useMemo(
    () =>
      requesters.map((r) => ({
        value: r.requesterID,
        label: r.name ?? r.requesterID ?? '',
      })),
    [requesters]
  );

  const isPaidFilterOptions: SMSDropdownOption[] = useMemo(
    () => [
      { value: 'all', label: INVOICE_GRID.IS_PAID_FILTER.ALL },
      { value: '1', label: INVOICE_GRID.IS_PAID_FILTER.PAID },
      { value: '0', label: INVOICE_GRID.IS_PAID_FILTER.UNPAID },
    ],
    []
  );

  const dueDateRangeFilterOptions: SMSDropdownOption[] = useMemo(
    () => [
      { value: 'all', label: INVOICE_GRID.DUE_DATE_RANGE_FILTER.ALL },
      { value: '30', label: INVOICE_GRID.DUE_DATE_RANGE_FILTER.DAYS_30 },
      { value: '60', label: INVOICE_GRID.DUE_DATE_RANGE_FILTER.DAYS_60 },
      { value: '90', label: INVOICE_GRID.DUE_DATE_RANGE_FILTER.DAYS_90 },
    ],
    []
  );

  const selectedRequesterName = useMemo(
    () => requesters.find((r) => r.requesterID === selectedRequesterId)?.name ?? null,
    [requesters, selectedRequesterId]
  );

  const handleRequesterChange = useCallback(
    (e: SelectChangeEvent<unknown>) => {
      const value = String(e.target.value ?? '');
      setSelectedRequesterId(value || undefined);
      const next = new URLSearchParams(searchParams);
      if (value) {
        next.set('requesterId', value);
      } else {
        next.delete('requesterId');
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const handleIsPaidFilterChange = useCallback((e: SelectChangeEvent<unknown>) => {
    const value = String(e.target.value ?? 'all') as InvoiceIsPaidFilter;
    setSelectedIsPaidFilter(value === '1' || value === '0' ? value : 'all');
  }, []);

  const handleDueDateRangeFilterChange = useCallback((e: SelectChangeEvent<unknown>) => {
    const value = String(e.target.value ?? 'all');
    setSelectedDueDateRangeFilter(
      value === '30' || value === '60' || value === '90' ? value : 'all'
    );
  }, []);

  const handleViewDetails = useCallback(
    async (row: InvoiceRow) => {
      if (isRequestScoped) {
        const invoice =
          requestScopedInvoices.find((i) => String(i.invoicesID) === String(row.invoicesID)) ?? null;
        setSelectedInvoice(invoice);
        setInvoicePreviewOpen(true);
        return;
      }
      try {
        const invoice = await dispatch(fetchInvoiceByIdThunk(row.invoicesID)).unwrap();
        setSelectedInvoice(invoice);
        setInvoicePreviewOpen(true);
      } catch {
        // Toast shown by thunk
      }
    },
    [dispatch, isRequestScoped, requestScopedInvoices]
  );

  const handleViewPayment = useCallback(
    (row: InvoiceRow) => {
      const pool = isRequestScoped ? requestScopedInvoices : allAdminInvoices;
      const invoice = pool.find((i) => String(i.invoicesID) === String(row.invoicesID)) ?? null;
      setPaymentInvoiceHeader(
        invoice
          ? {
              invoiceNo: invoice.invoiceNo,
              billingToName: invoice.billingToName ?? invoice.requesterName,
              dateCreated: invoice.dateCreated,
              dueDate: invoice.dueDate,
            }
          : null
      );
      const requesterId =
        invoice?.requesterID?.trim() || selectedRequesterId?.trim() || null;
      setPaymentInvoiceRequesterId(requesterId);
      setPaymentInvoiceId(String(row.invoicesID));
      setPaymentModalOpen(true);
    },
    [allAdminInvoices, isRequestScoped, requestScopedInvoices, selectedRequesterId]
  );

  const handlePaymentFromModal = useCallback(() => {
    const requesterId = paymentInvoiceRequesterId?.trim();
    if (!requesterId) return;

    const requesterName = paymentInvoiceHeader?.billingToName?.trim() || undefined;
    const route = buildRequesterScopedAdminRoute(
      PAYMENT_GRID.REQUESTER_PAYMENT_PATH,
      { requesterID: requesterId, name: requesterName },
      requestScopedPaymentReturn
        ? {
            returnPath: requestScopedPaymentReturn.path,
            returnState: requestScopedPaymentReturn.state,
          }
        : { returnPath: currentListPath }
    );

    setPaymentModalOpen(false);
    setPaymentInvoiceId(null);
    setPaymentInvoiceHeader(null);
    setPaymentInvoiceRequesterId(null);
    navigate(route.path, { state: route.state });
  }, [
    currentListPath,
    navigate,
    paymentInvoiceHeader?.billingToName,
    paymentInvoiceRequesterId,
    requestScopedPaymentReturn,
  ]);

  const refreshInvoices = useCallback(() => {
    if (isRequestScoped && projectNumber) {
      void dispatch(fetchInvoicesByProjectNumber(projectNumber));
      return;
    }
    loadAdminRequesterCounts(pagination.currentPage, pagination.pageSize);
  }, [dispatch, isRequestScoped, loadAdminRequesterCounts, pagination.currentPage, pagination.pageSize, projectNumber]);

  const handleDeleteClick = useCallback((row: InvoiceRow) => {
    setDeletingInvoice(row);
  }, []);

  const handleDeleteCancel = useCallback(() => {
    setDeletingInvoice(null);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingInvoice) return;
    try {
      await dispatch(deleteInvoiceThunk(deletingInvoice.invoicesID)).unwrap();
      setDeletingInvoice(null);
      if (
        selectedInvoice &&
        String(selectedInvoice.invoicesID) === String(deletingInvoice.invoicesID)
      ) {
        setInvoicePreviewOpen(false);
        setSelectedInvoice(null);
      }
      refreshInvoices();
    } catch {
      // Toast shown by thunk
    }
  }, [deletingInvoice, dispatch, refreshInvoices, selectedInvoice]);

  const handleBack = useCallback(() => {
    if (isRequestScoped) {
      navigateAdminBack(navigate, returnPath ?? `/personnel/requester/${returnTab}`,
        `/personnel/requester/${returnTab}`
      );
      return;
    }
    navigateAdminBack(navigate, returnPath, INVOICE_GRID.REQUESTER_LIST_PATH);
  }, [isRequestScoped, navigate, returnPath, returnTab]);

  const handleCreateInvoice = useCallback(() => {
    if (!requestContext || !projectNumber) return;
    setCreateInvoiceOpen(true);
  }, [projectNumber, requestContext]);

  const toggleRequesterExpand = useCallback((requesterId: string) => {
    setExpandedRequesterIds((prev) =>
      prev.includes(requesterId) ? prev.filter((id) => id !== requesterId) : [...prev, requesterId]
    );
  }, []);

  const handleCollapseAll = useCallback(() => {
    setExpandedRequesterIds([]);
  }, []);

  const handleRequesterPayment = useCallback(
    (requester: RequesterResponse) => {
      const route = buildRequesterScopedAdminRoute(
        PAYMENT_GRID.REQUESTER_PAYMENT_PATH,
        requester,
        { returnPath: currentListPath }
      );
      navigate(route.path, { state: route.state });
    },
    [currentListPath, navigate]
  );

  const handleRequesterStatement = useCallback(
    (requester: RequesterResponse) => {
      const route = buildRequesterScopedAdminRoute(
        REQUESTER_STATEMENT_GRID.STATEMENT_LIST_PATH,
        requester,
        { returnPath: currentListPath }
      );
      navigate(route.path, { state: route.state });
    },
    [currentListPath, navigate]
  );

  const columnHandlers = useMemo(
    () => ({
      onViewDetails: handleViewDetails,
      onViewPayment: handleViewPayment,
      onDelete: handleDeleteClick,
    }),
    [handleDeleteClick, handleViewDetails, handleViewPayment]
  );

  const requestScopedColumns = useMemo(
    () => buildInvoiceColumns(columnHandlers, { includeCustomer: true }),
    [columnHandlers]
  );

  const groupedInvoiceColumns = useMemo(
    () => buildInvoiceColumns(columnHandlers, { includeCustomer: false }),
    [columnHandlers]
  );

  const requestScopedRows = useMemo(
    () => (activeInvoices as InvoiceDto[]).map(toInvoiceRow),
    [activeInvoices]
  );

  const renderRequesterSkeleton = useCallback(
    (keyPrefix: string) => (
      <SMSBox key={keyPrefix} className="hierarchical-requester-group">
        <SMSBox className="level-1-requester" data-expanded={false}>
          <SMSBox className="level-1-requester__header">
            <SMSBox className="level-1-requester__info" sx={{ width: '100%' }}>
              <Skeleton variant="circular" width={24} height={24} />
              <SMSBox className="level-1-requester__title-block" sx={{ width: '100%' }}>
                <Skeleton variant="text" width="32%" height={30} />
                <Skeleton variant="rounded" width={160} height={24} />
              </SMSBox>
            </SMSBox>
          </SMSBox>
        </SMSBox>
      </SMSBox>
    ),
    []
  );

  const pageTitle = isRequestScoped
    ? `${requestTitle} — ${INVOICE_GRID.REQUEST_SCOPE.TITLE}`
    : selectedRequesterId
      ? `${selectedRequesterName ?? selectedRequesterId} - ${INVOICE_GRID.TITLE}`
      : INVOICE_GRID.TITLE;

  const adminFiltersToolbar = (
    <Box className="invoice-list__filters-bar">
      <Box className="invoice-list__search-field">
        <SMSTextField
          label={INVOICE_GRID.GROUPED.SEARCH_LABEL}
          id="invoice-list-search"
          placeholder={INVOICE_GRID.GROUPED.SEARCH_PLACEHOLDER}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          fullWidth
        />
      </Box>
      <Box className="invoice-list__requester-dropdown">
        <SMSDropdown
          label={INVOICE_GRID.SELECT_REQUESTER}
          options={requesterSelectOptions}
          value={selectedRequesterId ?? ''}
          onChange={handleRequesterChange}
          clearable
          fullWidth
          sx={{ mt: 0 }}
        />
      </Box>
      <Box className="invoice-list__ispaid-dropdown">
        <SMSDropdown
          label={INVOICE_GRID.IS_PAID_FILTER.LABEL}
          options={isPaidFilterOptions}
          value={selectedIsPaidFilter}
          onChange={handleIsPaidFilterChange}
          fullWidth
          sx={{ mt: 0 }}
        />
      </Box>
      <Box className="invoice-list__duedate-dropdown">
        <SMSDropdown
          label={INVOICE_GRID.DUE_DATE_RANGE_FILTER.LABEL}
          options={dueDateRangeFilterOptions}
          value={selectedDueDateRangeFilter}
          onChange={handleDueDateRangeFilterChange}
          fullWidth
          sx={{ mt: 0 }}
        />
      </Box>
      <Box className="invoice-list__filters-actions">
        <SMSButton
          variant="outlined"
          allowWhenSuspended
          onClick={handleCollapseAll}
          leftIcon={<SMSIcon name="unfold_less" size="sm" />}
        >
          {INVOICE_GRID.GROUPED.COLLAPSE_ALL}
        </SMSButton>
      </Box>
    </Box>
  );

  return (
    <Box component="main" className="invoice-list requester-list">
      <Stack
        direction="row"
        alignItems="center"
        justifyContent={isRequestScoped ? 'space-between' : 'flex-start'}
        className={`requester-list__header invoice-list__header${isRequestScoped ? ' invoice-list__header--request-scoped' : ''}`}
        useFlexGap
      >
        <SMSIconButton
          type="button"
          onClick={handleBack}
          className="form-page__back-button"
          aria-label={
            isRequestScoped
              ? INVOICE_GRID.REQUEST_SCOPE.BACK_ARIA_LABEL
              : INVOICE_GRID.BACK_BUTTON_ARIA_LABEL
          }
        >
          <SMSIcon name="arrowLeft" size="md" />
        </SMSIconButton>
        <h1 className="invoice-list__title">{pageTitle}</h1>
        {isRequestScoped ? (
          <SMSButton
            className="invoice-list__create-invoice"
            onClick={handleCreateInvoice}
            disabled={!projectNumber}
            leftIcon={<SMSIcon name="add" size="sm" />}
          >
            {INVOICE_GRID.REQUEST_SCOPE.CREATE_INVOICE}
          </SMSButton>
        ) : null}
      </Stack>

      <Box className="requester-list__table">
        {isRequestScoped ? (
          <SMSDataTableWrapper<InvoiceRow>
            columns={requestScopedColumns}
            data={requestScopedRows}
            emptyMessage={INVOICE_GRID.TABLE.NO_DATA}
            loading={tableLoading}
            searchable
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            showHeaderWhenEmpty
            renderEmptyAsTable
            maxBodyHeight="calc(100vh - 360px)"
            pagination={{
              serverSide: false,
              currentPage: pagination.currentPage,
              pageSize: pagination.pageSize,
              totalItems: pagination.totalItems,
              onPageChange: (page) => pagination.goToPage(page),
              onPageSizeChange: (newPageSize) => {
                pagination.setPageSize(newPageSize);
                pagination.goToFirstPage();
              },
            }}
          />
        ) : (
          <Box className="invoice-list__grouped">
            {adminFiltersToolbar}
            <SMSBox className="hierarchical-view">
              {tableLoading ? (
                <SMSBox>
                  {Array.from({ length: 3 }).map((_, idx) =>
                    renderRequesterSkeleton(`invoice-loading-${idx}`)
                  )}
                </SMSBox>
              ) : requesterInvoiceCounts.length === 0 ? (
                <Box className="invoice-list__empty">{INVOICE_GRID.GROUPED.NO_GROUPS}</Box>
              ) : (
                requesterInvoiceCounts.map((group) => {
                  const groupKey = group.requesterId;
                  const isExpanded = expandedRequesterIds.includes(groupKey);
                  const invoiceCount = group.invoicesCount;
                  const invoicesCache = invoicesByRequesterId[groupKey];
                  const groupRows = (invoicesCache?.data ?? []).map(toInvoiceRow);
                  const invoicesLoading = !!invoicesCache?.loading;
                  const requester =
                    requesters.find((r) => r.requesterID === group.requesterId) ??
                    ({
                      requesterID: group.requesterId,
                      name: group.requesterName,
                    } as RequesterResponse);

                  return (
                    <SMSBox key={groupKey} className="hierarchical-requester-group">
                      <SMSBox className="level-1-requester" data-expanded={isExpanded}>
                        <SMSBox className="level-1-requester__header">
                          <SMSBox className="level-1-requester__info">
                            <SMSIconButton
                              className="level-1-requester__expand-btn"
                              tone="success"
                              allowWhenSuspended
                              onClick={() => toggleRequesterExpand(groupKey)}
                              size="small"
                              aria-label={
                                isExpanded
                                  ? INVOICE_GRID.GROUPED.COLLAPSE_REQUESTER
                                  : INVOICE_GRID.GROUPED.EXPAND_REQUESTER
                              }
                              title={isExpanded ? INVOICE_GRID.GROUPED.COLLAPSE_REQUESTER : INVOICE_GRID.GROUPED.EXPAND_REQUESTER}
                            >
                              <SMSIcon
                                name={isExpanded ? 'expand_more' : 'navigate_next'}
                                size="sm"
                              />
                            </SMSIconButton>
                            <SMSBox className="level-1-requester__title-block">
                              <h3 className="level-1-requester__name">{group.requesterName}</h3>
                              <SMSBox className="level-1-requester__badges">
                                <span className="badge badge--blue">
                                  {invoiceCount} {INVOICE_GRID.GROUPED.INVOICES_BADGE}
                                </span>
                              </SMSBox>
                            </SMSBox>
                          </SMSBox>
                          {requester?.requesterID ? (
                            <SMSBox className="level-1-requester__actions">
                              <SMSDollar
                                className="level-1-requester__icon-btn"
                                label={
                                  group.hasUnpaidInvoice
                                    ? INVOICE_GRID.GROUPED.UNPAID_INVOICE_TOOLTIP
                                    : REQUESTER_GRID_MENU.PAYMENT
                                }
                                tone={group.hasUnpaidInvoice ? 'error' : 'positive'}
                                onClick={() => handleRequesterPayment(requester)}
                              />
                              <SMSIconButton
                                className="level-1-requester__icon-btn"
                                tone="secondary"
                                allowWhenSuspended
                                onClick={() => handleRequesterStatement(requester)}
                                aria-label={INVOICE_GRID.GROUPED.STATEMENTS}
                                title={INVOICE_GRID.GROUPED.STATEMENTS}
                                size="small"
                              >
                                <SMSIcon name="description" size="sm" />
                              </SMSIconButton>
                            </SMSBox>
                          ) : null}
                        </SMSBox>

                        <SMSBox className="level-2-requests">
                          <SMSDataTableWrapper<InvoiceRow>
                            embedded
                            columns={groupedInvoiceColumns}
                            data={groupRows}
                            emptyMessage={INVOICE_GRID.TABLE.NO_DATA}
                            loading={invoicesLoading}
                            showHeaderWhenEmpty
                            renderEmptyAsTable
                            tableClassName="invoice-list__nested-table"
                            getRowKey={(row) => String(row.invoicesID)}
                            pagination={{
                              serverSide: true,
                              currentPage: invoicesCache?.page ?? 1,
                              pageSize: invoicesCache?.pageSize ?? DEFAULT_TABLE_PAGE_SIZE,
                              totalItems: invoicesCache?.totalRecords ?? 0,
                              onPageChange: (page) =>
                                loadRequesterInvoices(
                                  groupKey,
                                  page,
                                  invoicesCache?.pageSize ?? DEFAULT_TABLE_PAGE_SIZE
                                ),
                              onPageSizeChange: (newPageSize) =>
                                loadRequesterInvoices(groupKey, 1, newPageSize),
                            }}
                          />
                        </SMSBox>
                      </SMSBox>
                    </SMSBox>
                  );
                })
              )}
            </SMSBox>
            {!tableLoading && requesterInvoiceCountsTotal > 0 ? (
              <SMSPagination
                className="invoice-list__pagination sms-pagination"
                currentPage={pagination.currentPage}
                pageSize={pagination.pageSize}
                totalItems={requesterInvoiceCountsTotal}
                loading={requesterInvoiceCountsLoading}
                onPageChange={(page) => {
                  pagination.setCurrentPage(page);
                  loadAdminRequesterCounts(page, pagination.pageSize);
                }}
                onPageSizeChange={(size) => {
                  pagination.setPageSize(size);
                  loadAdminRequesterCounts(1, size);
                }}
              />
            ) : null}
          </Box>
        )}
      </Box>

      {isRequestScoped ? (
        <InvoicePreviewModal
          isOpen={createInvoiceOpen}
          request={requestContext}
          paymentReturnPath={requestScopedPaymentReturn?.path}
          paymentReturnState={requestScopedPaymentReturn?.state}
          onClose={() => setCreateInvoiceOpen(false)}
          onGenerateInvoice={() => {
            setCreateInvoiceOpen(false);
            refreshInvoices();
          }}
        />
      ) : null}

      <InvoicePreviewModal
        isOpen={invoicePreviewOpen}
        invoice={selectedInvoice}
        modifyConflict={modifyConflict}
        paymentReturnPath={
          requestScopedPaymentReturn?.path ?? `${location.pathname}${location.search}`
        }
        paymentReturnState={requestScopedPaymentReturn?.state}
        onModifyConflictHandled={() => setModifyConflict(null)}
        onInvoiceUpdated={refreshInvoices}
        onClose={() => {
          setInvoicePreviewOpen(false);
          setSelectedInvoice(null);
          setModifyConflict(null);
        }}
      />

      <InvoicePaymentModal
        isOpen={paymentModalOpen}
        invoicesId={paymentInvoiceId}
        onClose={() => {
          setPaymentModalOpen(false);
          setPaymentInvoiceId(null);
          setPaymentInvoiceHeader(null);
          setPaymentInvoiceRequesterId(null);
        }}
        invoiceHeader={paymentInvoiceHeader ?? undefined}
        onViewInvoice={() => {
          if (!paymentInvoiceId) return;
          void (async () => {
            try {
              const invoice = isRequestScoped
                ? requestScopedInvoices.find((i) => String(i.invoicesID) === paymentInvoiceId) ?? null
                : await dispatch(fetchInvoiceByIdThunk(paymentInvoiceId)).unwrap();
              setSelectedInvoice(invoice);
              setPaymentModalOpen(false);
              setPaymentInvoiceId(null);
              setPaymentInvoiceRequesterId(null);
              setInvoicePreviewOpen(true);
            } catch {
              // Toast shown by thunk
            }
          })();
        }}
        onPayment={paymentInvoiceRequesterId ? handlePaymentFromModal : undefined}
        onPaymentSaved={refreshInvoices}
      />

      <SMSConfirmDialog
        open={!!deletingInvoice}
        title={INVOICE_GRID.CONFIRM.DELETE_TITLE}
        message={
          deletingInvoice?.invoiceNo
            ? `${INVOICE_GRID.CONFIRM.DELETE_MESSAGE} (Invoice #${deletingInvoice.invoiceNo})`
            : INVOICE_GRID.CONFIRM.DELETE_MESSAGE
        }
        confirmText={INVOICE_GRID.CONFIRM.DELETE_CONFIRM}
        cancelText={INVOICE_GRID.CONFIRM.DELETE_CANCEL}
        onConfirm={handleDeleteConfirm}
        onClose={handleDeleteCancel}
        variant="error"
        loading={isDeleting}
      />
    </Box>
  );
};
