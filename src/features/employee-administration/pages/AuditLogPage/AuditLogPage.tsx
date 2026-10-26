import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import type { SelectChangeEvent } from '@mui/material/Select';
import Typography from '@mui/material/Typography';
import { SMSBox, SMSButton, SMSDatePicker, SMSDropdown, SMSGrid, SMSIcon, SMSIconButton } from '@/components/smsatoms';
import { SMSDataTableWrapper, SMSModal, type DataTableColumn } from '@/components/smsorganisms';
import { buildAvailableJobsLandingPathWithQuery } from '@/constants/availableJobsRouteTabs';
import { DEFAULT_TABLE_PAGE_SIZE, PAGE_GRID_MAX_BODY_HEIGHT } from '@/constants/tablePagination';
import { DASHBOARD, REQUESTER } from '@/constants/strings';
import { usePagination } from '@/hooks/usePagination';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { useDebounce } from '@/hooks/useDebounceSearch';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { isSuperUserSession, usesDepartmentScopedAuditList } from '@/utils/roleMenuContributions';
import { showToast } from '@/store/slices/toastSlice';
import { fetchAuditHistory, searchAuditHistoryThunk } from '@/store/slices/auditHistorySlice';
import { AuditHistoryTable, getAuditDisplayNameFilterOptions } from '@/services/auditHistoryService';
import { formatDate } from '@/utils';
import type { AuditChangedField, AuditHistoryRow } from '@/utils/auditHistoryUtils';
import {
  formatAuditCellValue,
  formatAuditChangedOn,
  getAuditDisplayName,
} from '@/utils/auditHistoryUtils';
import { formatTimeToHHmm, getLocalTodayYyyyMmDd } from '@/utils/dateTimeUtils';
import { renderPostPositionStatusPill } from '@/utils/postPositionStatusPill';
import './AuditLogPage.css';

const L = DASHBOARD.AUDIT_LOG;

/** Old URL segments (…/post, …/closed-post-position) → canonical job-based paths. */
const LEGACY_AUDIT_SEGMENT_TO_CANONICAL: Record<string, string> = {
  post: 'job',
  'post-position': 'job-position',
  'closed-post-position': 'closed-job-position',
  'closed-post-position-equipment': 'closed-job-position-equipment',
};

/** Canonical route segment → `AuditHistoryTable`. Sidebar uses these paths. */
const TAB_ID_TO_TABLE: Record<string, AuditHistoryTable> = {
  requester: AuditHistoryTable.Requester,
  job: AuditHistoryTable.Post,
  request: AuditHistoryTable.Request,
  'request-schedule': AuditHistoryTable.RequestSchedule,
  'job-position': AuditHistoryTable.PostPosition,
  employee: AuditHistoryTable.Employee,
  placeholder: AuditHistoryTable.Placeholder,
  'email-template': AuditHistoryTable.EmailTemplate,
  'closed-job-position': AuditHistoryTable.ClosedPostPosition,
  'closed-job-position-equipment': AuditHistoryTable.ClosedPostPositionEquipment,
  payment: AuditHistoryTable.Payment,
  'payment-type': AuditHistoryTable.PaymentType,
  'payment-allocation': AuditHistoryTable.PaymentAllocation,
  invoice: AuditHistoryTable.Invoice,
  'invoice-detail': AuditHistoryTable.InvoiceDetail,
  'requester-ledger': AuditHistoryTable.RequesterLedger,
};

/** Page H1 + header icon per route; labels from `strings.ts` (`DASHBOARD.AUDIT_LOG`). */
const AUDIT_SECTION_HEADING: Record<string, string> = {
  requester: L.REQUESTER_LOG,
  job: L.POST_LOG,
  request: L.REQUEST_LOG,
  'request-schedule': L.REQUEST_SCHEDULE_LOG,
  'job-position': L.POST_POSITION_LOG,
  employee: L.EMPLOYEE_LOG,
  placeholder: L.PLACEHOLDER_LOG,
  'email-template': L.EMAIL_TEMPLATE_LOG,
  'closed-job-position': L.CLOSED_POST_POSITION_LOG,
  'closed-job-position-equipment': L.CLOSED_POST_POSITION_EQUIPMENT_LOG,
  payment: L.PAYMENT_LOG,
  'payment-type': L.PAYMENT_TYPE_LOG,
  'payment-allocation': L.PAYMENT_ALLOCATION_LOG,
  invoice: L.INVOICE_LOG,
  'invoice-detail': L.INVOICE_DETAIL_LOG,
  'requester-ledger': L.REQUESTER_LEDGER_LOG,
};

export const AuditLogPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const { auditHistory, isLoading: isLoadingAudit, totalItems: totalItemsFromStore } = useAppSelector((state) => state.auditHistory);
  const navigate = useNavigate();
  const { auditTable } = useParams<{ auditTable: string }>();
  const canonicalAuditSegment =
    auditTable != null && LEGACY_AUDIT_SEGMENT_TO_CANONICAL[auditTable]
      ? LEGACY_AUDIT_SEGMENT_TO_CANONICAL[auditTable]
      : auditTable;
  const pagination = usePagination({initialPage: 1, initialPageSize: DEFAULT_TABLE_PAGE_SIZE, totalItems: 0});
  const [urlFilters, , setSearchFilters] = useUrlFilters(['search']);
  const searchFromUrl = urlFilters.search ?? '';
  const [localSearch, setLocalSearch] = useState(searchFromUrl);
  const debouncedSearch = useDebounce(localSearch, 500);
  const [changesModalOpen, setChangesModalOpen] = useState(false);
  const [changesFields, setChangesFields] = useState<AuditChangedField[]>([]);
  const [filterEntityId, setFilterEntityId] = useState('');
  const [filterChangedOn, setFilterChangedOn] = useState('');
  const [filterOptions, setFilterOptions] = useState<{ value: string; label: string }[]>([]);
  const [filterOptionsLoading, setFilterOptionsLoading] = useState(false);
  const isTabSwitchingRef = useRef(false);
  const isClearingFiltersRef = useRef(false);

  const departmentAuditList = usesDepartmentScopedAuditList(user);
  const isSuperUser = isSuperUserSession(user);

  const tabId =
    canonicalAuditSegment != null && TAB_ID_TO_TABLE[canonicalAuditSegment] !== undefined
      ? canonicalAuditSegment
      : 'request';

  /** Department roles load every tab. Super user loads Email Templates only. */
  const canLoadAudit = departmentAuditList || (isSuperUser && tabId === 'email-template');

  const filterLabel = useMemo(() => {
    if (tabId === 'requester') return L.FILTER_BY_REQUESTER;
    if (tabId === 'request' || tabId === 'request-schedule') return L.FILTER_BY_REQUEST;
    if (tabId === 'job') return L.FILTER_BY_POST;
    if (tabId === 'placeholder') return L.FILTER_BY_PLACEHOLDER;
    if (tabId === 'email-template') return L.FILTER_BY_EMAIL_TEMPLATE;
    if (
      tabId === 'employee' ||
      tabId === 'job-position' ||
      tabId === 'closed-job-position' ||
      tabId === 'closed-job-position-equipment'
    ) {
      return L.FILTER_BY_EMPLOYEE;
    }
    return L.FILTER_BY_NAME;
  }, [tabId]);

  const filterAllLabel = useMemo(() => {
    if (tabId === 'requester') return L.FILTER_ALL_REQUESTERS;
    if (tabId === 'request' || tabId === 'request-schedule') return L.FILTER_ALL_REQUESTS;
    if (tabId === 'job') return L.FILTER_ALL_POSTS;
    if (tabId === 'placeholder') return L.FILTER_ALL_PLACEHOLDERS;
    if (tabId === 'email-template') return L.FILTER_ALL_EMAIL_TEMPLATES;
    if (
      tabId === 'employee' ||
      tabId === 'job-position' ||
      tabId === 'closed-job-position' ||
      tabId === 'closed-job-position-equipment'
    ) {
      return L.FILTER_ALL_EMPLOYEES;
    }
    return L.FILTER_ALL;
  }, [tabId]);

  useEffect(() => {
    if (
      auditTable != null &&
      LEGACY_AUDIT_SEGMENT_TO_CANONICAL[auditTable] != null
    ) {
      navigate(`/audit-log/${LEGACY_AUDIT_SEGMENT_TO_CANONICAL[auditTable]}`, { replace: true });
    }
  }, [auditTable, navigate]);

  useEffect(() => {
    if (
      auditTable != null &&
      TAB_ID_TO_TABLE[auditTable] === undefined &&
      LEGACY_AUDIT_SEGMENT_TO_CANONICAL[auditTable] == null
    ) {
      navigate('/audit-log/request', { replace: true });
    }
  }, [auditTable, navigate]);

  const selectedTable = TAB_ID_TO_TABLE[tabId] ?? AuditHistoryTable.Request;

  const prevTabRef = useRef(tabId);
  useEffect(() => {
    if (prevTabRef.current !== tabId) {
      prevTabRef.current = tabId;

      // Mark tab switching so debounce/URL sync does not re-apply the previous section's search.
      isTabSwitchingRef.current = true;

      setFilterEntityId('');
      setFilterChangedOn('');
      setLocalSearch('');
      setSearchFilters({ search: undefined });
      pagination.setPageSize(DEFAULT_TABLE_PAGE_SIZE);
      pagination.goToFirstPage();

      // Section change always loads via GET /Audit/getall/{table} (table enum in path).
      // Uses the default size (not `pagination.pageSize`, which is still the previous
      // section's value here) so the fetched rows match the reset rows-per-page dropdown.
      if (canLoadAudit) {
        void dispatch(
          fetchAuditHistory({
            table: selectedTable,
            pagination: { page: 1, pageSize: DEFAULT_TABLE_PAGE_SIZE },
          })
        );
      }

      setTimeout(() => {
        isTabSwitchingRef.current = false;
      }, 600);
    }
  }, [
    tabId,
    selectedTable,
    canLoadAudit,
    dispatch,
    pagination.setPageSize,
    pagination.goToFirstPage,
    setSearchFilters,
  ]);

  useEffect(() => {
    pagination.setCurrentPage(1);
  }, [filterEntityId, filterChangedOn, pagination.setCurrentPage]);

  useEffect(() => {
    // ✅ Only sync from URL if tab has NOT changed
    if (prevTabRef.current === tabId) {
      setLocalSearch(searchFromUrl);
    }
  }, [searchFromUrl, tabId]);

  useEffect(() => {
    // ❌ Prevent restoring old search during tab switch or filter clear
    if (isTabSwitchingRef.current || isClearingFiltersRef.current) return;
    // Wait until debounced value matches the input so stale search is not re-applied after Clear
    if (localSearch.trim() !== debouncedSearch.trim()) return;

    if (debouncedSearch !== searchFromUrl) {
      pagination.goToFirstPage();
      setSearchFilters({
        search: debouncedSearch === '' ? undefined : debouncedSearch,
      });
    }
  }, [debouncedSearch, searchFromUrl, localSearch, pagination, setSearchFilters]);

  const auditFilterDropdownOptions = useMemo(
    () => [{ value: '', label: filterAllLabel }, ...filterOptions],
    [filterAllLabel, filterOptions]
  );

  const handleClearFilters = useCallback(() => {
    isClearingFiltersRef.current = true;
    setFilterEntityId('');
    setFilterChangedOn('');
    setLocalSearch('');
    setSearchFilters({ search: undefined });
    pagination.goToFirstPage();

    dispatch(
      fetchAuditHistory({
        table: selectedTable,
        pagination: { page: 1, pageSize: pagination.pageSize },
      })
    );

    setTimeout(() => {
      isClearingFiltersRef.current = false;
    }, 600);
  }, [
    dispatch,
    selectedTable,
    pagination.pageSize,
    pagination.goToFirstPage,
    setSearchFilters,
  ]);

  const auditTableToolbar = useMemo(
    () => (
      <SMSBox className="audit-log-page__toolbar-filters">
        {canLoadAudit ? (
          <SMSDropdown
            key={tabId}
            label={filterLabel}
            options={auditFilterDropdownOptions}
            value={filterEntityId}
            onChange={(e: SelectChangeEvent<unknown>) =>
              setFilterEntityId(String(e.target.value ?? ''))
            }
            placeholder={filterAllLabel}
            clearable
            disabled={filterOptionsLoading}
            fullWidth={false}
            size="small"
            sx={{ marginTop: 0, minWidth: { xs: '100%', sm: 280 }, maxWidth: 420 }}
          />
        ) : null}
        <SMSBox className="audit-log-page__toolbar-filters__date">
          <SMSDatePicker
            label={L.FILTER_CHANGED_ON}
            id={`audit-log-changed-on-${tabId}`}
            value={filterChangedOn}
            onChange={setFilterChangedOn}
            maxDate={getLocalTodayYyyyMmDd()}
          />
        </SMSBox>
        <SMSBox className="audit-log-page__toolbar-filters__clear">
          <SMSButton allowWhenSuspended onClick={handleClearFilters}>
            {L.CLEAR_FILTERS}
          </SMSButton>
        </SMSBox>
      </SMSBox>
    ),
    [
      canLoadAudit,
      filterLabel,
      filterAllLabel,
      auditFilterDropdownOptions,
      filterEntityId,
      filterOptionsLoading,
      tabId,
      filterChangedOn,
      handleClearFilters,
    ]
  );

  useEffect(() => {
    if (!canLoadAudit) {
      setFilterOptions([]);
      setFilterOptionsLoading(false);
      return;
    }
    let cancelled = false;
    setFilterOptionsLoading(true);
    void (async () => {
      try {
        // Common for all audit screens: options from `/Audit/getall/{table}` Displayname.
        const opts = await getAuditDisplayNameFilterOptions(selectedTable);
        if (cancelled) return;
        setFilterOptions(opts);
      } catch {
        if (!cancelled) {
          setFilterOptions([]);
          dispatch(showToast(L.FILTER_OPTIONS_LOAD_FAILED, 'error'));
        }
      } finally {
        if (!cancelled) setFilterOptionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canLoadAudit, selectedTable, dispatch]);

  const refetchList = useCallback(() => {
    if (!canLoadAudit) {
      return;
    }
    if (isTabSwitchingRef.current || isClearingFiltersRef.current) {
      return;
    }

    const typedSearch = debouncedSearch.trim();
    const selectedId = filterEntityId.trim();
    // Email templates filter by EmailTemplateID. Other tables send the display name as searchTerm.
    const entityIdFilter = tabId === 'email-template' ? selectedId : '';
    const searchTerm = typedSearch || (entityIdFilter ? '' : selectedId);
    const pageParam = {
      page: pagination.currentPage,
      pageSize: pagination.pageSize,
      ...(filterChangedOn.trim() ? { changedOn: filterChangedOn.trim() } : {}),
    };
    const entityFilter = entityIdFilter ? { filterEntityId: entityIdFilter } : {};

    if (searchTerm.length > 0) {
      dispatch(
        searchAuditHistoryThunk({
          table: selectedTable,
          searchTerm,
          pagination: pageParam,
          ...entityFilter,
        })
      );
    } else {
      dispatch(
        fetchAuditHistory({
          table: selectedTable,
          pagination: pageParam,
          ...entityFilter,
        })
      );
    }
  }, [
    dispatch,
    canLoadAudit,
    selectedTable,
    pagination.currentPage,
    pagination.pageSize,
    filterEntityId,
    filterChangedOn,
    debouncedSearch,
    tabId,
  ]);

  useEffect(() => {
    void refetchList();
  }, [refetchList]);

  useEffect(() => {
    pagination.setTotalItems(totalItemsFromStore);
  }, [totalItemsFromStore, pagination.setTotalItems]);

  const pageHeading = AUDIT_SECTION_HEADING[tabId] ?? L.REQUEST_LOG;
  const isClosedPostPositionAudit = tabId === 'closed-job-position';

  const openChangesModal = useCallback((fields: AuditChangedField[]) => {
    setChangesFields(fields);
    setChangesModalOpen(true);
  }, []);

  const renderChangesButton = useCallback(
    (row: AuditHistoryRow) => (
      <div className="sms-myhistory-style-actions">
        <SMSIconButton
          size="small"
          tone="primary"
          allowWhenSuspended
          title={REQUESTER.AUDIT.VIEW_CHANGES}
          aria-label={REQUESTER.AUDIT.VIEW_CHANGES}
          onClick={(e) => {
            e.stopPropagation();
            openChangesModal(row.ChangedFields);
          }}
        >
          <SMSIcon name="eye" size="sm" />
        </SMSIconButton>
      </div>
    ),
    [openChangesModal]
  );

  const formatAuditDateCell = useCallback((value: unknown): string => {
    if (value == null || String(value).trim() === '') return '-';
    return formatDate(String(value)) || '-';
  }, []);

  const formatAuditTimeCell = useCallback((value: unknown): string => {
    if (value == null || String(value).trim() === '') return '-';
    return formatTimeToHHmm(String(value)) || String(value).trim() || '-';
  }, []);

  const columns: DataTableColumn<AuditHistoryRow>[] = useMemo(() => {
    if (isClosedPostPositionAudit) {
      return [
        {
          key: 'EmployeeName',
          label: L.COLUMN_EMPLOYEE_NAME,
          render: (_value, row) => row.EmployeeName?.trim() || getAuditDisplayName(row),
        },
        {
          key: 'Date',
          label: L.COLUMN_DATE,
          render: (_value, row) => formatAuditDateCell(row.Date),
        },
        {
          key: 'StartTime',
          label: L.COLUMN_START_TIME,
          render: (_value, row) => formatAuditTimeCell(row.StartTime),
        },
        {
          key: 'EndTime',
          label: L.COLUMN_END_TIME,
          render: (_value, row) => formatAuditTimeCell(row.EndTime),
        },
        {
          key: 'HoursWorked',
          label: L.COLUMN_HOURS_WORKED,
          render: (_value, row) => row.HoursWorked?.trim() || '-',
        },
        {
          key: 'HoursRequired',
          label: L.COLUMN_HOURS_REQUIRED,
          render: (_value, row) => row.HoursRequired?.trim() || '-',
        },
        {
          key: 'JobTitle',
          label: L.COLUMN_JOB_TITLE,
          render: (_value, row) => row.JobTitle?.trim() || '-',
        },
        {
          key: 'Type',
          label: L.COLUMN_TYPE,
          render: (_value, row) => row.Type?.trim() || '-',
        },
        {
          key: 'Action',
          label: L.COLUMN_ACTION,
          noClamp: true,
          render: (value) => <>{renderPostPositionStatusPill(value, 'audit')}</>,
        },
        {
          key: 'ChangedOn',
          label: L.COLUMN_CHANGED_ON,
          align: 'right',
          render: (value) => formatAuditChangedOn(value),
        },
        {
          key: 'auditChangedFields',
          label: L.COLUMN_CHANGES,
          align: 'center',
          render: (_value, row) => renderChangesButton(row),
        },
      ];
    }

    return [
      {
        key: 'auditDisplayName',
        label: REQUESTER.AUDIT.COLUMN_REQUEST_NAME,
        render: (_value, row) => getAuditDisplayName(row),
      },
      {
        key: 'ChangedOn',
        label: L.COLUMN_CHANGED_ON,
        render: (value) => formatAuditChangedOn(value),
      },
      {
        key: 'Action',
        label: L.COLUMN_ACTION,
        render: (value) => <>{renderPostPositionStatusPill(value, 'audit')}</>,
      },
      {
        key: 'auditChangedFields',
        label: REQUESTER.AUDIT.COLUMN_CHANGES,
        render: (_value, row) => renderChangesButton(row),
      },
    ];
  }, [
    isClosedPostPositionAudit,
    formatAuditDateCell,
    formatAuditTimeCell,
    renderChangesButton,
  ]);

  const changesColumns: DataTableColumn<AuditChangedField>[] = useMemo(
    () => [
      {
        key: 'property',
        label: REQUESTER.AUDIT.COLUMN_FIELD_NAME,
        render: (value) => (value != null && String(value) !== '' ? String(value) : '-'),
      },
      {
        key: 'old',
        label: REQUESTER.AUDIT.COLUMN_OLD_VALUES,
        render: (_value, row) => formatAuditCellValue(row.old, row.property),
      },
      {
        key: 'new',
        label: REQUESTER.AUDIT.COLUMN_NEW_VALUES,
        render: (_value, row) => formatAuditCellValue(row.new, row.property),
      },
    ],
    []
  );

  if (isSuperUser && tabId !== 'email-template') {
    return <Navigate to="/audit-log/email-template" replace />;
  }
  if (!isSuperUser && !departmentAuditList) {
    return <Navigate to={buildAvailableJobsLandingPathWithQuery()} replace />;
  }

  return (
    <>
      <SMSGrid container spacing={2} className="audit-log-page">
        <SMSGrid item xs={12}>
          <SMSBox className="audit-log-page__header">
            <Typography variant="h4" component="h1" className="audit-log-page__title">
              {pageHeading}
            </Typography>
          </SMSBox>
        </SMSGrid>

        <SMSGrid item xs={12}>
          <SMSDataTableWrapper<AuditHistoryRow>
            data={auditHistory}
            columns={columns}
            loading={isLoadingAudit}
            toolbar={auditTableToolbar}
            renderEmptyAsTable={canLoadAudit}
            getRowKey={(row) =>
              row.AuditId != null
                ? `audit-${row.AuditId}`
                : `${row.EntityId}-${row.Action}-${row.ChangedOn}-${row.CorrelationId}-${getAuditDisplayName(row)}`
            }
            searchable
            searchPlaceholder={
              isClosedPostPositionAudit ? L.SEARCH_BY_JOB : L.SEARCH_BY_DISPLAY_NAME
            }
            searchValue={localSearch}
            onSearchChange={setLocalSearch}
            searchableColumns={
              isClosedPostPositionAudit
                ? ['EmployeeName', 'JobTitle', 'Displayname']
                : ['Displayname']
            }
            responsiveMode="auto"
            tableClassName={
              isClosedPostPositionAudit
                ? 'audit-log-page__data-table audit-log-page__data-table--closed-job-position'
                : 'audit-log-page__data-table'
            }
            maxBodyHeight={PAGE_GRID_MAX_BODY_HEIGHT}
            emptyMessage={L.NO_DATA}
            pagination={{
              serverSide: true,
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
        </SMSGrid>
      </SMSGrid>

      <SMSModal
        open={changesModalOpen}
        onClose={() => {
          setChangesModalOpen(false);
          setChangesFields([]);
        }}
        title={REQUESTER.AUDIT.CHANGES_MODAL_TITLE}
        size="large"
      >
        <SMSGrid container spacing={2}>
          <SMSGrid item xs={12}>
            <SMSBox className="audit-log-page__changes-table">
              <SMSDataTableWrapper<AuditChangedField>
                data={changesFields}
                columns={changesColumns}
                searchable={false}
                responsiveMode="table"
                maxBodyHeight="min(55vh, 440px)"
                emptyMessage={REQUESTER.TABLE.NO_DATA}
              />
            </SMSBox>
          </SMSGrid>
        </SMSGrid>
      </SMSModal>
    </>
  );
};
