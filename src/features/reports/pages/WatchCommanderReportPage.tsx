import Box from '@mui/material/Box';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SMSButton, SMSDatePicker } from '@/components/smsatoms';
import { SearchFilter } from '@/components/smsmolecules/SearchFilter';
import { SMSDataTableWrapper, type DataTableColumn } from '@/components/smsorganisms';
import { ReportsPageShell } from '@/features/reports/components/ReportsPageShell';
import {
  REPORT_LIST_FILTER,
  REPORT_LIST_FILTERS_CLASS,
  REPORT_LIST_TABLE_LAYOUT,
  reportListPagination,
  reportListTableClass,
} from '@/features/reports/reportListLayout';
import { MENU_ITEMS, WATCH_COMMANDER_REPORT_PAGE } from '@/constants/strings';
import { useDebounce } from '@/hooks/useDebounceSearch';
import { usePagination } from '@/hooks/usePagination';
import {
  downloadWatchCommanderReportExcel,
  getWatchCommanderReportRows,
} from '@/services/watchCommanderReportService';
import type { WatchCommanderReportRowDto } from '@/types/watchCommanderReportRowDto';
import { formatDateShort } from '@/utils';
import { buildReportListFilterQueryParams } from '@/utils/reportListFilterParams';
import { useAppDispatch } from '@/store/hooks';
import { showToast } from '@/store/slices/toastSlice';
import './WatchCommanderReportPage.css';

type WatchCommanderTableRow = WatchCommanderReportRowDto & { rowKey: string };

function formatRowDate(value: string | null | undefined): string {
  if (!value) return '-';
  const formatted = formatDateShort(value);
  return formatted || value;
}

function cellText(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '-';
  return value;
}

function cellNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return String(value);
}

/** Vehicle may be boolean (current API) or string (legacy). */
function cellVehicle(value: boolean | string | null | undefined): string {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'string') {
    const t = value.trim().toLowerCase();
    if (t === 'true' || t === 'yes' || t === '1') return 'Yes';
    if (t === 'false' || t === 'no' || t === '0') return 'No';
    return value;
  }
  return '-';
}

export const WatchCommanderReportPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const pagination = usePagination({ initialPage: 1, totalItems: 0 });

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 500);
  const [rows, setRows] = useState<WatchCommanderReportRowDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRows = useCallback(
    async (pageOverride?: number) => {
      setLoading(true);
      setError(null);
      const page = pageOverride ?? pagination.currentPage;
      const { pageSize } = pagination;
      try {
        const filterParams = buildReportListFilterQueryParams(appliedStartDate, appliedEndDate);
        const searchTerm = debouncedSearch.trim();
        const result = await getWatchCommanderReportRows({
          ...filterParams,
          ...(searchTerm ? { searchTerm } : {}),
          pagination: {
            page,
            pageSize,
          },
        });
        setRows(result.data);
        pagination.setTotalItems(result.totalRecords);
      } catch (e) {
        const message = e instanceof Error ? e.message : WATCH_COMMANDER_REPORT_PAGE.FETCH_ERROR;
        setError(message);
        setRows([]);
        pagination.setTotalItems(0);
        dispatch(showToast(WATCH_COMMANDER_REPORT_PAGE.FETCH_ERROR, 'error'));
      } finally {
        setLoading(false);
      }
    },
    [
      dispatch,
      appliedEndDate,
      appliedStartDate,
      debouncedSearch,
      pagination.currentPage,
      pagination.pageSize,
      pagination.setTotalItems,
    ]
  );

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  useEffect(() => {
    pagination.goToFirstPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset page when server search changes
  }, [debouncedSearch]);

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setStartDate('');
    setEndDate('');
    setAppliedStartDate('');
    setAppliedEndDate('');
    pagination.goToFirstPage();
  }, [pagination]);

  const handleGenerateExcel = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filterParams = buildReportListFilterQueryParams(startDate, endDate);
      const searchTerm = debouncedSearch.trim();
      await downloadWatchCommanderReportExcel({
        ...filterParams,
        ...(searchTerm ? { searchTerm } : {}),
      });
      dispatch(showToast(WATCH_COMMANDER_REPORT_PAGE.EXCEL_DOWNLOAD_SUCCESS, 'success'));
    } catch (e) {
      const message =
        e instanceof Error ? e.message : WATCH_COMMANDER_REPORT_PAGE.EXCEL_DOWNLOAD_ERROR;
      setError(message);
      dispatch(showToast(WATCH_COMMANDER_REPORT_PAGE.EXCEL_DOWNLOAD_ERROR, 'error'));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, dispatch, endDate, startDate]);

  const tableData: WatchCommanderTableRow[] = useMemo(
    () =>
      rows.map((r, i) => ({
        ...r,
        rowKey:
          [r.startDate, r.employeeName, r.startTime, String(i)].filter(Boolean).join('|') || String(i),
      })),
    [rows]
  );

  const columns: DataTableColumn<WatchCommanderTableRow>[] = useMemo(
    () => {
      const C = WATCH_COMMANDER_REPORT_PAGE.TABLE.COLUMNS;
      return [
        { key: 'startDate', label: C.DATE, render: (_v, r) => formatRowDate(r.startDate) },
        { key: 'startTime', label: C.START_TIME, render: (_v, r) => cellText(r.startTime) },
        { key: 'endTime', label: C.END_TIME, render: (_v, r) => cellText(r.endTime) },
        { key: 'hoursWorked', label: C.HOURS, render: (_v, r) => cellNumber(r.hoursWorked) },
        { key: 'employeeName', label: C.OFFICER_NAME, render: (_v, r) => cellText(r.employeeName) },
        { key: 'payroll', label: C.PAYROLL, render: (_v, r) => cellText(r.payroll) },
        { key: 'callSign', label: C.CALL_SIGN, render: (_v, r) => cellText(r.callSign) },
        { key: 'employeeType', label: C.OFFICER_TYPE, render: (_v, r) => cellText(r.employeeType) },
        { key: 'requester', label: C.CLIENT, render: (_v, r) => cellText(r.requester) },
        { key: 'requesterAddress', label: C.LOCATION, render: (_v, r) => cellText(r.requesterAddress) },
        { key: 'vehicle', label: C.VEHICLE, render: (_v, r) => cellVehicle(r.vehicle) },
      ];
    },
    []
  );

  const filterPanel = (
    <div className={REPORT_LIST_FILTERS_CLASS}>
      <Box sx={REPORT_LIST_FILTER.row}>
        <Box sx={REPORT_LIST_FILTER.fields}>
          <Box sx={REPORT_LIST_FILTER.search} className="data-table__search">
            <SearchFilter
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder={WATCH_COMMANDER_REPORT_PAGE.SEARCH_PLACEHOLDER}
            />
          </Box>
          <Box sx={REPORT_LIST_FILTER.field}>
            <SMSDatePicker
              id="watch-commander-report-start"
              label={WATCH_COMMANDER_REPORT_PAGE.START_DATE}
              value={startDate || undefined}
              onChange={setStartDate}
            />
          </Box>
          <Box sx={REPORT_LIST_FILTER.field}>
            <SMSDatePicker
              id="watch-commander-report-end"
              label={WATCH_COMMANDER_REPORT_PAGE.END_DATE}
              value={endDate || undefined}
              onChange={setEndDate}
            />
          </Box>
          <SMSButton
            variant="contained"
            allowWhenSuspended
            loading={loading}
            onClick={() => {
              setAppliedStartDate(startDate);
              setAppliedEndDate(endDate);
              pagination.goToFirstPage();
            }}
          >
            {WATCH_COMMANDER_REPORT_PAGE.APPLY}
          </SMSButton>
          <SMSButton
            variant="outlined"
            allowWhenSuspended
            onClick={() => {
              handleClearFilters();
            }}
          >
            {WATCH_COMMANDER_REPORT_PAGE.CLEAR_FILTERS}
          </SMSButton>
        </Box>
        <Box sx={REPORT_LIST_FILTER.generate}>
          <SMSButton
            variant="contained"
            allowWhenSuspended
            loading={loading}
            sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
            onClick={() => {
              void handleGenerateExcel();
            }}
          >
            {WATCH_COMMANDER_REPORT_PAGE.GENERATE_REPORT}
          </SMSButton>
        </Box>
      </Box>
    </div>
  );

  return (
    <ReportsPageShell
      title={MENU_ITEMS.WATCH_COMMANDER_REPORT}
      subtitle={WATCH_COMMANDER_REPORT_PAGE.SUBTITLE}
      className="watch-commander-report-page"
      fillViewport
    >
      {filterPanel}
      <SMSDataTableWrapper<WatchCommanderTableRow>
        columns={columns}
        data={tableData}
        tableClassName={reportListTableClass('watch-commander-report-data-table')}
        loading={loading}
        error={error}
        emptyMessage={WATCH_COMMANDER_REPORT_PAGE.TABLE.NO_DATA}
        onRetry={() => {
          void fetchRows(pagination.currentPage);
        }}
        {...REPORT_LIST_TABLE_LAYOUT}
        getRowKey={(row) => row.rowKey}
        pagination={reportListPagination(pagination)}
      />
    </ReportsPageShell>
  );
};
