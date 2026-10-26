import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box } from '@mui/material';
import { SMSBox, SMSChip } from '@/components/smsatoms';
import { SMSDataTableWrapper, type DataTableColumn } from '@/components/smsorganisms';
import { useDebounce } from '@/hooks/useDebounceSearch';
import { ReportsPageShell } from '@/features/reports/components/ReportsPageShell';
import { MENU_ITEMS, OFFICER_WORKING_PAGE, WATCH_COMMANDER_REPORT_PAGE } from '@/constants/strings';
import { usePagination } from '@/hooks/usePagination';
import {
  OfficerScheduleStatus,
  type OfficerScheduledAssignmentDto,
} from '@/types/officerScheduledAssignmentDto';
import { formatDateShort, parseLocalDateFromString } from '@/utils';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchOfficerScheduleOverview } from '@/store/slices/officerScheduleOverviewSlice';
import './OfficerWorkingPage.css';

type OfficerWorkingTableRow = OfficerScheduledAssignmentDto & { rowKey: string };

function cellText(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '-';
  return value;
}

function cellNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return String(value);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  const formatted = formatDateShort(value);
  return formatted || value;
}

function formatDateWithWeekday(value: string | null | undefined): string {
  if (!value) return '-';
  const parsed = parseLocalDateFromString(value);
  if (!parsed) return formatDate(value);
  const day = parsed.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  return `${day}\n${formatDateShort(value)}`;
}

function statusDisplay(status: OfficerScheduleStatus): string {
  switch (status) {
    case OfficerScheduleStatus.RecentlyEnded:
      return 'Ended';
    case OfficerScheduleStatus.CurrentlyWorking:
      return 'Working';
    case OfficerScheduleStatus.Upcoming:
      return 'Upcoming';
    default:
      return 'Unknown';
  }
}

function statusChipSx(status: OfficerScheduleStatus) {
  const base = {
    width: 124,
    justifyContent: 'center',
    borderWidth: 1,
    fontWeight: 600,
  } as const;
  switch (status) {
    case OfficerScheduleStatus.CurrentlyWorking:
      return { ...base, bgcolor: '#EAF3DE', color: '#3B6D11', borderColor: '#639922' };
    case OfficerScheduleStatus.Upcoming:
      return { ...base, bgcolor: '#E6F1FB', color: '#185FA5', borderColor: '#378ADD' };
    case OfficerScheduleStatus.RecentlyEnded:
      return { ...base, bgcolor: '#FAEEDA', color: '#854F0B', borderColor: '#BA7517' };
    default:
      return { ...base, bgcolor: 'grey.200', color: 'text.primary', borderColor: 'grey.400' };
  }
}

export const OfficerWorkingPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const pagination = usePagination({ initialPage: 1, totalItems: 0 });
  const { rows, totalRecords, isLoading, error } = useAppSelector(
    (state) => state.officerScheduleOverview
  );
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 500);

  const fetchRows = useCallback(() => {
    void dispatch(
      fetchOfficerScheduleOverview({
        searchTerm: debouncedSearch.trim() || undefined,
        pagination: {
          page: pagination.currentPage,
          pageSize: pagination.pageSize,
        },
      })
    );
  }, [debouncedSearch, dispatch, pagination.currentPage, pagination.pageSize]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  useEffect(() => {
    pagination.goToFirstPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset page when server search changes
  }, [debouncedSearch]);

  useEffect(() => {
    pagination.setTotalItems(totalRecords);
  }, [pagination, totalRecords]);

  const tableData: OfficerWorkingTableRow[] = useMemo(
    () =>
      rows.map((r, i) => ({
        ...r,
        rowKey: [r.payroll, r.employeeName, r.dateOfWork, r.startTime, String(i)].filter(Boolean).join('|'),
      })),
    [rows]
  );

  const columns: DataTableColumn<OfficerWorkingTableRow>[] = useMemo(() => {
    const C = WATCH_COMMANDER_REPORT_PAGE.TABLE.COLUMNS;
    const OC = OFFICER_WORKING_PAGE.TABLE.COLUMNS;
    return [
      {
        key: 'dateOfWork',
        label: C.DATE,
        render: (_v, r) =>
          r.dateOfWork ? (
            <SMSBox sx={{ whiteSpace: 'pre-line', lineHeight: 1.2 }}>
              {formatDateWithWeekday(r.dateOfWork)}
            </SMSBox>
          ) : (
            '-'
          ),
      },
      { key: 'startTime', label: C.START_TIME, render: (_v, r) => cellText(r.startTime) },
      { key: 'endTime', label: C.END_TIME, render: (_v, r) => cellText(r.endTime) },
      { key: 'hoursWorked', label: C.HOURS, render: (_v, r) => cellNumber(r.hoursWorked) },
      { key: 'jobTitle', label: OC.JOB_TITLE, render: (_v, r) => cellText(r.jobTitle) },
      { key: 'employeeName', label: C.OFFICER_NAME, render: (_v, r) => cellText(r.employeeName) },
      { key: 'payroll', label: C.PAYROLL, render: (_v, r) => cellText(r.payroll) },
      { key: 'callSign', label: C.CALL_SIGN, render: (_v, r) => cellText(r.callSign) },
      { key: 'employeeType', label: C.OFFICER_TYPE, render: (_v, r) => cellText(r.employeeType) },
      {
        key: 'scheduleState',
        label: OC.STATUS,
        align: 'center',
        noClamp: true,
        render: (_v, r) => (
          <SMSChip
            label={statusDisplay(r.status)}
            size="small"
            variant="outlined"
            sx={statusChipSx(r.status)}
          />
        ),
      },
    ];
  }, []);

  return (
    <ReportsPageShell
      title={MENU_ITEMS.OFFICER_WORKING}
      subtitle={OFFICER_WORKING_PAGE.SUBTITLE}
      className="officer-working-page"
    >
      <Box className="requester-list__table">
        <SMSDataTableWrapper<OfficerWorkingTableRow>
          columns={columns}
          data={tableData}
          responsiveMode="table"
          loading={isLoading}
          error={error}
          emptyMessage={OFFICER_WORKING_PAGE.TABLE.NO_DATA}
          onRetry={() => {
            fetchRows();
          }}
          embedded
          searchable
          searchAppliedOnServer
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder={OFFICER_WORKING_PAGE.SEARCH_PLACEHOLDER}
          showHeaderWhenEmpty
          renderEmptyAsTable
          maxBodyHeight="calc(100vh - 420px)"
          getRowKey={(row) => row.rowKey}
          pagination={{
            serverSide: true,
            currentPage: pagination.currentPage,
            pageSize: pagination.pageSize,
            totalItems: pagination.totalItems,
            onPageChange: pagination.goToPage,
            onPageSizeChange: (newPageSize) => {
              pagination.setPageSize(newPageSize);
              pagination.goToFirstPage();
            },
          }}
        />
      </Box>
    </ReportsPageShell>
  );
};
