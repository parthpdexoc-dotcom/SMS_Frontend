import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SMSButton, SMSDatePicker, SMSSwitch } from '@/components/smsatoms';
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
import { ARCHIVED_REPORTS_PAGE, EMPLOYEE_ASSIGNMENT_FILTERS, MENU_ITEMS } from '@/constants/strings';
import { useDebounce } from '@/hooks/useDebounceSearch';
import { usePagination } from '@/hooks/usePagination';
import { downloadArchivedReportExcel, getArchivedReportRows } from '@/services/archivedReportService';
import type { ReportRowDto } from '@/types/reportRowDto';
import { formatCurrency, formatDateShort } from '@/utils';
import { buildReportListFilterQueryParams } from '@/utils/reportListFilterParams';
import { useAppDispatch } from '@/store/hooks';
import { showToast } from '@/store/slices/toastSlice';
import './ArchivedReportsPage.css';

type ArchivedReportTableRow = ReportRowDto & { rowKey: string };

function formatPostDay(value: string | null | undefined): string {
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
function cellCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return formatCurrency(value, '-');
}
function cellBool(value: boolean | null | undefined): string {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return '-';
}
function cellInvoice(value: string | boolean | null | undefined): string {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  if (value === null || value === undefined) return 'No';
  const trimmed = String(value).trim();
  if (trimmed === '-' || trimmed === '' || trimmed.toLowerCase() === 'false' || trimmed.toLowerCase() === 'no') return 'No';
  if (trimmed.toLowerCase() === 'true' || trimmed.toLowerCase() === 'yes') return 'Yes';
  return trimmed;
}

export const ArchivedReportsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const pagination = usePagination({ initialPage: 1, totalItems: 0 });

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isPlaceholder, setIsPlaceholder] = useState(false);
  /** Last values sent to the API (Apply only); pagination uses these without re-fetching on draft edits. */
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');
  const [appliedIsPlaceholder, setAppliedIsPlaceholder] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 500);
  const [rows, setRows] = useState<ReportRowDto[]>([]);
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
        const result = await getArchivedReportRows({
          ...filterParams,
          ...(searchTerm ? { searchTerm } : {}),
          ...(appliedIsPlaceholder ? { isPlaceholder: true } : {}),
          pagination: { page, pageSize },
        });
        setRows(result.data);
        pagination.setTotalItems(result.totalRecords);
      } catch (e) {
        const message = e instanceof Error ? e.message : ARCHIVED_REPORTS_PAGE.FETCH_ERROR;
        setError(message);
        setRows([]);
        pagination.setTotalItems(0);
        dispatch(showToast(ARCHIVED_REPORTS_PAGE.FETCH_ERROR, 'error'));
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- depend on pagination fields, not the object reference
    [
      dispatch,
      appliedEndDate,
      appliedStartDate,
      appliedIsPlaceholder,
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
    setIsPlaceholder(false);
    setAppliedIsPlaceholder(false);
    pagination.goToFirstPage();
  }, [pagination]);

  const handleGenerateExcel = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filterParams = buildReportListFilterQueryParams(appliedStartDate, appliedEndDate);
      const searchTerm = debouncedSearch.trim();
      await downloadArchivedReportExcel({
        ...filterParams,
        ...(searchTerm ? { searchTerm } : {}),
        ...(appliedIsPlaceholder ? { isPlaceholder: true } : {}),
      });
      dispatch(showToast(ARCHIVED_REPORTS_PAGE.EXCEL_DOWNLOAD_SUCCESS, 'success'));
    } catch (e) {
      const message =
        e instanceof Error ? e.message : ARCHIVED_REPORTS_PAGE.EXCEL_DOWNLOAD_ERROR;
      setError(message);
      dispatch(showToast(ARCHIVED_REPORTS_PAGE.EXCEL_DOWNLOAD_ERROR, 'error'));
    } finally {
      setLoading(false);
    }
  }, [appliedEndDate, appliedIsPlaceholder, appliedStartDate, debouncedSearch, dispatch]);

  const tableData: ArchivedReportTableRow[] = useMemo(
    () =>
      rows.map((r, i) => ({
        ...r,
        rowKey: [r.postCode, r.requestCode, r.postDay, i].filter(Boolean).join('|') || String(i),
      })),
    [rows]
  );

  const columns: DataTableColumn<ArchivedReportTableRow>[] = useMemo(
    () => {
      const C = ARCHIVED_REPORTS_PAGE.TABLE.COLUMNS;
      return [
        { key: 'employeeCode', label: C.OFFICER_ID, render: (_v, r) => cellText(r.employeeCode) },
        { key: 'employeeName', label: C.OFFICER, render: (_v, r) => cellText(r.employeeName) },
        { key: 'payroll', label: C.PAYROLL, render: (_v, r) => cellText(r.payroll) },
        { key: 'pvt', label: C.PVT, render: (_v, r) => cellText(r.pvt) },
        { key: 'requestCode', label: C.JOB_ID, render: (_v, r) => cellText(r.requestCode) },
        { key: 'postCode', label: C.SHIFT_ID, render: (_v, r) => cellText(r.postCode) },
        { key: 'hoursWorked', label: C.HOURS_WORKED, render: (_v, r) => cellNumber(r.hoursWorked) },
        { key: 'postDay', label: C.SHIFT_DAY, render: (_v, r) => formatPostDay(r.postDay) },
        { key: 'pteao', label: C.PTEAO, render: (_v, r) => cellText(r.ptaeo) },
        { key: 'payCode', label: C.PAY_CODE, render: (_v, r) => cellText(r.payCode) },
        { key: 'comments', label: C.COMMENTS, render: (_v, r) => cellText(r.comments) },
        { key: 'requesterName', label: C.EMPLOYER_NAME, render: (_v, r) => cellText(r.requesterName) },
        { key: 'requesterAddress', label: C.EMPLOYER_ADDRESS, render: (_v, r) => cellText(r.requesterAddress) },
        { key: 'startTime', label: C.START_TIME, render: (_v, r) => cellText(r.startTime) },
        { key: 'hoursRequired', label: C.HOURS_REQUIRED, render: (_v, r) => cellNumber(r.hoursRequired) },
        { key: 'responseArea', label: C.RESPONSE_AREA, render: (_v, r) => cellText(r.responseArea) },
        { key: 'requestAddress', label: C.JOB_ADDRESS, render: (_v, r) => cellText(r.requestAddress) },
        { key: 'callSign', label: C.CALL_SIGN, render: (_v, r) => cellText(r.callSign) },
        { key: 'vehicle', label: C.VEHICLE, render: (_v, r) => cellText(r.vehicle) },
        { key: 'onDuty', label: C.ON_DUTY, render: (_v, r) => cellBool(r.onDuty) },
        { key: 'postFor', label: C.SHIFT_FOR, render: (_v, r) => cellText(r.postFor) },
        { key: 'postPayRate', label: C.POST_PAY_RATE, render: (_v, r) => cellCurrency(r.postPayRate) },
        { key: 'empHrlyRate', label: C.EMP_HRLY_RATE, render: (_v, r) => cellCurrency(r.empHrlyRate) },
        { key: 'ldrPc116', label: C.LDR_PC116, render: (_v, r) => cellCurrency(r.ldrPc116) },
        { key: 'ldrPc103', label: C.LDR_PC103, render: (_v, r) => cellCurrency(r.ldrPc103) },
        { key: 'ldrPc102', label: C.LDR_PC102, render: (_v, r) => cellCurrency(r.ldrPc102) },
        { key: 'pc102', label: C.PC102, render: (_v, r) => cellCurrency(r.pc102) },
        { key: 'pc102Rate', label: C.PC102_RATE, render: (_v, r) => cellCurrency(r.pc102Rate) },
        { key: 'vehicleNumber', label: C.VEH_NUMBER, render: (_v, r) => cellText(r.vehicleNumber) },
        { key: 'vehicleHrs', label: C.VEH_HRS, render: (_v, r) => cellNumber(r.vehicleHrs) },
        { key: 'requestName', label: C.JOB_NAME, render: (_v, r) => cellText(r.requestName) },
        { key: 'agency', label: C.AGENCY, render: (_v, r) => cellText(r.agency) },
        { key: 'closedBy', label: C.CLOSED_BY, render: (_v, r) => cellText(r.closedBy) },
        { key: 'invoice', label: C.INVOICE, render: (_v, r) => cellInvoice(r.invoice) },
        { key: 'isPlaceholder', label: C.IS_PLACEHOLDER, render: (_v, r) => cellText(r.isPlaceholder) },
        { key: 'isClosed', label: C.IS_CLOSED, render: (_v, r) => cellText(r.isClosed) },
        // { key: 'vehicleClosedHours', label: C.VEHICLE_CLOSED_HOURS, render: (_v, r) => cellNumber(r.vehicleClosedHours) },
        { key: 'personalRank', label: C.PERSONAL_RANK, render: (_v, r) => cellText(r.personalRank) },
        { key: 'shiftRank', label: C.SHIFT_RANK, render: (_v, r) => cellText(r.shiftRank) },
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
              placeholder={ARCHIVED_REPORTS_PAGE.SEARCH_PLACEHOLDER}
            />
          </Box>
          <Box sx={REPORT_LIST_FILTER.field}>
            <SMSDatePicker
              id="archived-report-start"
              label={ARCHIVED_REPORTS_PAGE.START_DATE}
              value={startDate || undefined}
              onChange={setStartDate}
            />
          </Box>
          <Box sx={REPORT_LIST_FILTER.field}>
            <SMSDatePicker
              id="archived-report-end"
              label={ARCHIVED_REPORTS_PAGE.END_DATE}
              value={endDate || undefined}
              onChange={setEndDate}
            />
          </Box>
          <SMSButton
            variant="contained"
            allowWhenSuspended
            loading={loading}
            sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
            onClick={() => {
              setAppliedStartDate(startDate);
              setAppliedEndDate(endDate);
              setAppliedIsPlaceholder(isPlaceholder);
              pagination.goToFirstPage();
            }}
          >
            {ARCHIVED_REPORTS_PAGE.APPLY}
          </SMSButton>
          <SMSButton
            variant="outlined"
            allowWhenSuspended
            onClick={() => {
              handleClearFilters();
            }}
          >
            {ARCHIVED_REPORTS_PAGE.CLEAR_FILTERS}
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
            {ARCHIVED_REPORTS_PAGE.GENERATE_REPORT}
          </SMSButton>
        </Box>
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          mt: 1.5,
          flexWrap: 'wrap',
        }}
      >
        <Typography
          variant="body2"
          sx={{
            fontWeight: 500,
            color: 'text.secondary',
            fontSize: '0.875rem',
            userSelect: 'none',
          }}
        >
          {EMPLOYEE_ASSIGNMENT_FILTERS.SHOW_PLACEHOLDERS_LABEL}
        </Typography>
        <Tooltip title={EMPLOYEE_ASSIGNMENT_FILTERS.PLACEHOLDER_TOOLTIP} arrow placement="top">
          <InfoOutlinedIcon
            sx={{
              fontSize: 18,
              color: 'text.secondary',
              cursor: 'pointer',
              '&:hover': { color: 'primary.main' },
            }}
          />
        </Tooltip>
        <SMSSwitch
          checked={isPlaceholder}
          onChange={(e) => {
            const checked = e.target.checked;
            setIsPlaceholder(checked);
            setAppliedIsPlaceholder(checked);
            pagination.goToFirstPage();
          }}
        />
      </Box>
    </div>
  );

  return (
    <ReportsPageShell
      title={MENU_ITEMS.ARCHIVED_REPORTS}
      subtitle={ARCHIVED_REPORTS_PAGE.SUBTITLE}
      className="archived-reports-page"
      fillViewport
    >
      {filterPanel}
      <SMSDataTableWrapper<ArchivedReportTableRow>
        columns={columns}
        data={tableData}
        tableClassName={reportListTableClass('archived-reports-data-table')}
        loading={loading}
        error={error}
        emptyMessage={ARCHIVED_REPORTS_PAGE.TABLE.NO_DATA}
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
