import { SMSButton, SMSTabs, type SMSTabOption, SMSIcon } from '@/components/smsatoms';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { useNavigate, useParams } from 'react-router-dom';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { useDebounce } from '@/hooks/useDebounceSearch';
import { fetchEmployeesByRankFilter } from '@/store/slices/employeeSlice';
import { resetAvailableJobEntry } from '@/store/slices/availablePostSlice';
import { fetchActiveEmployeeTypes } from '@/store/slices/employeeTypeSlice';
import { EmployeeResponse } from '@/types/employee';
import { EMPLOYEE, MENU_ITEMS, AVAILABLE_POST, SEARCH } from '@/constants/strings';
import {  
  AVAILABLE_JOBS_ROUTE_TAB_ID,
  isEmployeePostsJobsTabId,
  type EmployeePostsJobsTabId,
} from '@/constants/availableJobsRouteTabs';
import { SMSAvailablePostList, SMSDataTableWrapper, type DataTableColumn } from '@/components/smsorganisms';
import { SMSScheduledPostList, SMSJobReadyToCloseList, SMSMyHistoryList } from '@/components/smsmolecules';
import { SearchFilter } from '@/components/smsmolecules/SearchFilter';
import { SMSDropdown } from '@/components/smsatoms/SMSDropdown/SMSDropdown';
import type { SelectChangeEvent } from '@mui/material/Select';
import { Box, Stack, Typography } from '@mui/material';
import { usePagination } from '@/hooks/usePagination';
import { formatLastNameCommaFirstName } from '@/utils';
import './EmployeePostsPage.css';

const TAB_ITEMS: SMSTabOption[] = [
  { id: AVAILABLE_JOBS_ROUTE_TAB_ID.AVAILABLE_JOB, label: AVAILABLE_POST.TABS.AVAILABLE_POST, icon: 'briefcase' },
  { id: AVAILABLE_JOBS_ROUTE_TAB_ID.SCHEDULED_JOB, label: AVAILABLE_POST.TABS.SCHEDULED_POST, icon: 'schedule' },
  { id: AVAILABLE_JOBS_ROUTE_TAB_ID.JOB_READY_TO_CLOSE, label: AVAILABLE_POST.TABS.CLOSE_POST, icon: 'check_circle' },
  { id: AVAILABLE_JOBS_ROUTE_TAB_ID.MY_HISTORY, label: AVAILABLE_POST.TABS.MY_HISTORY, icon: 'history' },
];

export const EmployeePostsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { employeeId: employeeIdFromPath } = useParams<{ employeeId?: string }>();
  const { employees, isLoading, totalItems: employeeTotalFromApi } = useAppSelector((state) => state.employee);
  const { activeEmployeeTypes } = useAppSelector((state) => state.employeeType);
  const { user } = useAppSelector((state) => state.auth);

  const [activeTab, setActiveTab] = useState<EmployeePostsJobsTabId>(
    AVAILABLE_JOBS_ROUTE_TAB_ID.AVAILABLE_JOB
  );

  // Available Job state is shared with the employee's own dashboard slice; reset it whenever
  // the supervisor opens the tab or switches employees so filters/rows never leak between views.
  useEffect(() => {
    if (activeTab === AVAILABLE_JOBS_ROUTE_TAB_ID.AVAILABLE_JOB && employeeIdFromPath) {
      dispatch(resetAvailableJobEntry());
    }
  }, [dispatch, activeTab, employeeIdFromPath]);

  const [employeeUrlFilters, , setEmployeeFilters] = useUrlFilters(['search', 'employeeTypeId']);
  const employeeSearchFromUrl = employeeUrlFilters.search ?? '';
  const employeeTypeIdFromUrl = employeeUrlFilters.employeeTypeId ?? '';
  const [localSearch, setLocalSearch] = useState(employeeSearchFromUrl);
  const debouncedSearch = useDebounce(localSearch, 500);

  const [selectedEmployeeTypeId, setSelectedEmployeeTypeId] = useState<string>(employeeTypeIdFromUrl);

  const pagination = usePagination();

  useEffect(() => {
    dispatch(fetchActiveEmployeeTypes(user?.departmentID));
  }, [dispatch, user?.departmentID]);

  const refetchEmployees = useCallback(() => {
    const searchTerm = debouncedSearch.trim();

    const params = {
      page: pagination.currentPage,
      pageSize: pagination.pageSize,
      ...(searchTerm && { searchTerm }),
      ...(selectedEmployeeTypeId && { employeeTypeId: selectedEmployeeTypeId }),
    };

    dispatch(fetchEmployeesByRankFilter({ params, isactive: true }));
  }, [
    dispatch,
    debouncedSearch,
    selectedEmployeeTypeId,
    pagination.currentPage,
    pagination.pageSize,
  ]);

  useEffect(() => {
    refetchEmployees();
  }, [refetchEmployees]);

  useEffect(() => {
    pagination.setTotalItems(employeeTotalFromApi);
  }, [employeeTotalFromApi, pagination.setTotalItems]);

  useEffect(() => {
    setLocalSearch(employeeSearchFromUrl);
  }, [employeeSearchFromUrl]);

  useEffect(() => {
    if (debouncedSearch !== employeeSearchFromUrl) {
      pagination.goToFirstPage();
      setEmployeeFilters({
        search: debouncedSearch === '' ? undefined : debouncedSearch,
        employeeTypeId: selectedEmployeeTypeId || undefined,
      });
    }
  }, [debouncedSearch, employeeSearchFromUrl, pagination, setEmployeeFilters, selectedEmployeeTypeId]);

  const eligibleEmployees = useMemo(() => employees || [], [employees]);

  const employeeTypeSelectOptions = useMemo(() => {
    return (activeEmployeeTypes || [])
      .map((type) => ({
        value: type.employeeTypeID,
        label: type.employeeTypeShort ?? String(type.employeeTypeID),
      }));
  }, [activeEmployeeTypes]);

  const selectedEmployee: EmployeeResponse | null = useMemo(
    () =>
      employeeIdFromPath
        ? eligibleEmployees.find((e) => e.employeeID === employeeIdFromPath) ?? null
        : null,
    [eligibleEmployees, employeeIdFromPath]
  );

  const columns: DataTableColumn<EmployeeResponse>[] = useMemo(
    () => [
      {
        key: 'fullName',
        label: EMPLOYEE.TABLE.COLUMNS.FULL_NAME,
        render: (_value, row) => formatLastNameCommaFirstName(row.firstName, row.lastName, '-'),
      },
      {
        key: 'badgeNumber',
        label: EMPLOYEE.TABLE.COLUMNS.BADGE_NUMBER,
        render: (_value, row) => row.badgeNumber || '-',
      },
      {
        key: 'employeeType',
        label: EMPLOYEE.TABLE.COLUMNS.TYPE,
        render: (_value, row) => row.employeeType || '-',
      },
      {
        key: 'primaryEmail',
        label: EMPLOYEE.TABLE.COLUMNS.EMAIL,
        render: (_value, row) => row.primaryEmail || '-',
      },
      {
        key: 'action',
        label: EMPLOYEE.TABLE.COLUMNS.ACTION,
        render: (_value, row) => (
          <SMSButton
            onClick={() => {
              navigate(`/personnel/employee-jobs/${row.employeeID}`);
            }}
            className="employee-posts-page__view-posts-button"
          >
            {EMPLOYEE.BUTTON.VIEW_JOBS}
          </SMSButton>
        ),
      },
    ],
    [navigate]
  );

  const handleTabChange = useCallback((tabId: string) => {
    if (isEmployeePostsJobsTabId(tabId)) {
      setActiveTab(tabId);
    }
  }, []);

  const employeeName = useMemo(() => {
    if (!selectedEmployee) return '';
    return (
      formatLastNameCommaFirstName(selectedEmployee.firstName, selectedEmployee.lastName) ||
      selectedEmployee.username ||
      ''
    );
  }, [selectedEmployee]);

  const tabContent = useMemo(() => {
    if (!selectedEmployee) return null;
    const employeeId = selectedEmployee.employeeID;
    switch (activeTab) {
      case AVAILABLE_JOBS_ROUTE_TAB_ID.AVAILABLE_JOB:
        return <SMSAvailablePostList key={employeeId} employeeId={employeeId} />;
      case AVAILABLE_JOBS_ROUTE_TAB_ID.SCHEDULED_JOB:
        return (
          <SMSScheduledPostList
            title={AVAILABLE_POST.TAB_TITLES.SCHEDULED_POST}
            employeeId={employeeId}
            employeeNameOverride={employeeName}
          />
        );
      case AVAILABLE_JOBS_ROUTE_TAB_ID.JOB_READY_TO_CLOSE:
        return (
          <SMSJobReadyToCloseList
            title={AVAILABLE_POST.TAB_TITLES.CLOSE_POST}
            employeeId={employeeId}
            employeeNameOverride={employeeName}
          />
        );
      case AVAILABLE_JOBS_ROUTE_TAB_ID.MY_HISTORY:
        return (
          <SMSMyHistoryList
            employeeId={employeeId}
            employeeNameOverride={employeeName}
          />
        );
      default:
        return null;
    }
  }, [activeTab, selectedEmployee, employeeName]);

  const isDetailMode = Boolean(employeeIdFromPath && selectedEmployee);

  if (isDetailMode && selectedEmployee) {
    return (
      <Box component="main" className="employee-list employee-posts-page">
        <Stack direction="row" alignItems="center" justifyContent="space-between" className="employee-list__header">
          <Stack direction="row" alignItems="center" className="employee-posts-page__header-left" useFlexGap>
            <button
              type="button"
              className="form-page__back-button"
              onClick={() => navigate('/personnel/employee-jobs')}
              aria-label={`Back to ${MENU_ITEMS.EMPLOYEE_POSTS}`}
            >
              <SMSIcon name="arrowLeft" size="md" />
            </button>
            <Typography variant="h4" component="h1" className="employee-list__title">
              {`${employeeName} - ${EMPLOYEE.POSTS_PAGE.DETAIL_TITLE_JOBS_SUFFIX}`}
            </Typography>
          </Stack>
        </Stack>
        <Box className="employee-posts-page__modal-content">
          <Box className="employee-posts-page__tabs-container">
            <SMSTabs
              options={TAB_ITEMS}
              value={activeTab}
              onChange={handleTabChange}
            />
          </Box>
          <Box className="employee-posts-page__tab-content">{tabContent}</Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box component="main" className="employee-list employee-posts-page">
      <Stack direction="row" alignItems="center" justifyContent="space-between" className="employee-list__header">
        <Typography variant="h4" component="h1" className="employee-list__title">
          {MENU_ITEMS.EMPLOYEE_POSTS}
        </Typography>
      </Stack>

      <Box className="employee-list__table">
        <Stack
          direction="row"
          flexWrap="wrap"
          alignItems="center"
          className="employee-list__filters-row data-table__toolbar"
          useFlexGap
        >
          <Stack direction="row" className="employee-list__filters-left" useFlexGap>
            <Box className="data-table__search">
              <SearchFilter
                value={localSearch}
                onChange={setLocalSearch}
                placeholder={SEARCH.PLACEHOLDER_TABLE}
              />
            </Box>
            <Box className="employee-list__type-filter employee-posts-page__type-filter">
              <SMSDropdown
                label={EMPLOYEE.FORM.EMPLOYEE_TYPE_PLACEHOLDER}
                options={employeeTypeSelectOptions}
                value={selectedEmployeeTypeId}
                onChange={(e: SelectChangeEvent<unknown>) => {
                  const value = String(e.target.value ?? '');
                  setSelectedEmployeeTypeId(value);
                  pagination.goToFirstPage();
                  setEmployeeFilters({
                    search: employeeSearchFromUrl || undefined,
                    employeeTypeId: value || undefined,
                  });
                }}
                placeholder={EMPLOYEE.FORM.EMPLOYEE_TYPE_PLACEHOLDER}
                clearable
                disabled={isLoading}
                fullWidth
                sx={{ minWidth: { xs: 0, sm: 200 }, width: '100%' }}
              />
            </Box>
          </Stack>
        </Stack>

        <SMSDataTableWrapper
          data={eligibleEmployees}
          columns={columns}
          loading={isLoading}
          emptyMessage={EMPLOYEE.TABLE.NO_DATA}
          searchable={false}
          maxBodyHeight="calc(100vh - 360px)"
          tableClassName="employee-posts-page__data-table"
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
      </Box>
    </Box>
  );
};
