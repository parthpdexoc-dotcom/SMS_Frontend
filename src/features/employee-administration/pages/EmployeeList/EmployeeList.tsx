import {
  SMSButton,
  SMSIcon,
  SMSIconButton,
  SMSSegmentedStatusFilter,
} from '@/components/smsatoms';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { useDebounce } from '@/hooks/useDebounceSearch';
import { PAGE_GRID_MAX_BODY_HEIGHT } from '@/constants/tablePagination';
import { EMPLOYEE, REQUESTER, SEARCH } from '@/constants/strings';
import { EmployeeResponse } from '@/types/employee';
import type { DepartmentAdminResponse } from '@/types/departmentAdmin';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchAllEmployees, searchEmployeesThunk, removeEmployee } from '@/store/slices/employeeSlice';
import { fetchAdminTypes } from '@/store/slices/adminTypeSlice';
import { fetchActiveEmployeeTypes } from '@/store/slices/employeeTypeSlice';
import { getDepartmentAdmins } from '@/services/departmentAdminService';
import type { SelectChangeEvent } from '@mui/material/Select';
import { Box, Stack, Typography } from '@mui/material';
import { SMSDropdown } from '@/components/smsatoms/SMSDropdown/SMSDropdown';
import { SearchFilter } from '@/components/smsmolecules/SearchFilter';
import type { DataTableColumn } from '@/components/smsorganisms';
import { SMSAuditHistoryModal, SMSDataTableWrapper } from '@/components/smsorganisms';
import { usePagination } from '@/hooks/usePagination';
import { SMSConfirmDialog } from '@/components/smsmolecules';
import { SMSModal as Modal } from '@/components/smsorganisms';
import { SMSDepartmentAdminForm } from '@/components/smsmolecules/SMSDepartmentAdminForm';
import { hasRole, UserRoleType } from '@/types/userRole';
import { formatLastNameCommaFirstName, formatPhoneNumber } from '@/utils';
import { AuditHistoryTable, getAuditHistory } from '@/services/auditHistoryService';
import type { AuditHistoryRow } from '@/utils/auditHistoryUtils';
import { showToast } from '@/store/slices/toastSlice';
import { openEmployeeImpersonationTab } from '@/services/authService';
import './EmployeeList.css';

export interface EmployeeListProps {
  className?: string;
}

type StatusFilter = 'active' | 'inactive' | null;

export const EmployeeList: React.FC<EmployeeListProps> = ({ className = '' }) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { employees, isLoading, totalItems: employeeTotalFromApi } = useAppSelector((state) => state.employee);
  const { adminTypes } = useAppSelector((state) => state.adminType);
  const { activeEmployeeTypes } = useAppSelector((state) => state.employeeType);
  const { user } = useAppSelector((state) => state.auth);
  const isIAAdmin = hasRole(user?.roles, UserRoleType.IAAdmin);
  // View-only (hide Add/Action) only when IAAdmin and no other role that can edit employees
  const canEditEmployees =
    user?.isSuperUser === true ||
    hasRole(user?.roles, UserRoleType.SuperUser) ||
    hasRole(user?.roles, UserRoleType.HRAdmin) ||
    hasRole(user?.roles, UserRoleType.Operator) ||
    hasRole(user?.roles, UserRoleType.DepartmentAdmin);
  const viewOnlyEmployeeList = isIAAdmin && !canEditEmployees;
  const isSuperUser = user?.isSuperUser === true || hasRole(user?.roles, UserRoleType.SuperUser);

  const [employeeUrlFilters, , setEmployeeFilters] = useUrlFilters(['search', 'employeeTypeId', 'departmentId']);
  const employeeSearchFromUrl = employeeUrlFilters.search ?? '';
  const employeeTypeIdFromUrl = employeeUrlFilters.employeeTypeId ?? '';
  const departmentScopeId = (employeeUrlFilters.departmentId ?? '').trim();
  const [localSearch, setLocalSearch] = useState(employeeSearchFromUrl);
  const debouncedSearch = useDebounce(localSearch, 500);

  const [deletingItem, setDeletingItem] = useState<EmployeeResponse | null>(null);
  const [viewHistorySelection, setViewHistorySelection] = useState<{ employeeID: string; snapshotName: string } | null>(null);
  const [viewHistoryAuditStartDate, setViewHistoryAuditStartDate] = useState('');
  const [viewHistoryAuditEndDate, setViewHistoryAuditEndDate] = useState('');
  const [viewHistoryAuditPage, setViewHistoryAuditPage] = useState(1);
  const [viewHistoryAuditPageSize, setViewHistoryAuditPageSize] = useState(10);
  const [viewHistoryAuditRows, setViewHistoryAuditRows] = useState<AuditHistoryRow[]>([]);
  const [viewHistoryAuditTotalItems, setViewHistoryAuditTotalItems] = useState(0);
  const [viewHistoryAuditLoading, setViewHistoryAuditLoading] = useState(false);
  const [employeeAdminModalOpen, setEmployeeAdminModalOpen] = useState(false);
  const [selectedEmployeeForAdmin, setSelectedEmployeeForAdmin] = useState<EmployeeResponse | null>(null);
  const [departmentAdminsLookup, setDepartmentAdminsLookup] = useState<DepartmentAdminResponse[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');

  const [selectedEmployeeTypeId, setSelectedEmployeeTypeId] = useState<string>(employeeTypeIdFromUrl);
  const viewHistoryModalOpen = viewHistorySelection !== null;

  // Remove client-side filtering since it's now handled by the backend API
  const employeesFilteredByApproval = useMemo(
    () => employees,
    [employees]
  );

  const viewHistoryModalTitle = useMemo(() => {
    if (!viewHistorySelection) return EMPLOYEE.BUTTON.VIEW_HISTORY;
    const row = employees.find((e) => String(e.employeeID) === String(viewHistorySelection.employeeID));
    const display = row
      ? (formatLastNameCommaFirstName(row.firstName, row.lastName, '') || row.username || String(row.employeeID))
      : viewHistorySelection.snapshotName;
    return display
      ? REQUESTER.AUDIT.HISTORY_MODAL_TITLE.replace('{name}', display)
      : EMPLOYEE.BUTTON.VIEW_HISTORY;
  }, [employees, viewHistorySelection]);

  const pagination = usePagination();

  const departmentIdForActiveTypes = departmentScopeId || user?.departmentID;

  useEffect(() => {
    dispatch(fetchActiveEmployeeTypes(departmentIdForActiveTypes));
  }, [dispatch, departmentIdForActiveTypes]);

  const refetchEmployees = useCallback(() => {
    const searchTerm = debouncedSearch.trim();
    const hasSearchFilters = searchTerm.length > 0 || !!selectedEmployeeTypeId;

    const params = {
      page: pagination.currentPage,
      pageSize: pagination.pageSize,
      searchTerm: searchTerm || undefined,
      employeeTypeId: selectedEmployeeTypeId || undefined,
      ...(departmentScopeId ? { departmentId: departmentScopeId } : {}),
    };

    // Convert statusFilter to isactive parameter for API
    const isactive = statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined;

    if (hasSearchFilters) {
      dispatch(searchEmployeesThunk({ params, isactive }));
    } else {
      dispatch(fetchAllEmployees({ params, isactive }));
    }
  }, [
    dispatch,
    debouncedSearch,
    selectedEmployeeTypeId,
    pagination.currentPage,
    pagination.pageSize,
    statusFilter,
    departmentScopeId,
  ]);

  useEffect(() => {
    refetchEmployees();
  }, [refetchEmployees]);

  useEffect(() => {
    dispatch(fetchAdminTypes({ page: 1, pageSize: 1000 }));
  }, [dispatch]);

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
        departmentId: departmentScopeId || undefined,
      });
    }
  }, [
    debouncedSearch,
    employeeSearchFromUrl,
    pagination,
    setEmployeeFilters,
    selectedEmployeeTypeId,
    departmentScopeId,
  ]);

  useEffect(() => {
    pagination.goToFirstPage();
  }, [departmentScopeId, pagination.goToFirstPage]);

  const refetchDepartmentAdminsLookup = useCallback(() => {
    getDepartmentAdmins({ page: 1, pageSize: 5000 })
      .then((list) => setDepartmentAdminsLookup(list))
      .catch(() => setDepartmentAdminsLookup([]));
  }, []);

  useEffect(() => {
    refetchDepartmentAdminsLookup();
  }, [refetchDepartmentAdminsLookup]);

  // Fetch function for employee history data
  const fetchEmployeeHistory = () => {
    const employeeId = viewHistorySelection?.employeeID?.trim();
    if (!employeeId) {
      setViewHistoryAuditRows([]);
      setViewHistoryAuditTotalItems(0);
      setViewHistoryAuditLoading(false);
      return;
    }

    let cancelled = false;
    setViewHistoryAuditLoading(true);
    void getAuditHistory(AuditHistoryTable.Employee, employeeId, {
      page: viewHistoryAuditPage,
      pageSize: viewHistoryAuditPageSize,
      sortBy: 'ChangedOn',
      sortDirection: 'desc',
      ...(viewHistoryAuditStartDate.trim() ? { startDate: viewHistoryAuditStartDate.trim() } : {}),
      ...(viewHistoryAuditEndDate.trim() ? { endDate: viewHistoryAuditEndDate.trim() } : {}),
    })
      .then((result) => {
        if (cancelled) return;
        setViewHistoryAuditRows(result.data ?? []);
        setViewHistoryAuditTotalItems(result.totalRecords ?? 0);
      })
      .catch(() => {
        if (cancelled) return;
        setViewHistoryAuditRows([]);
        setViewHistoryAuditTotalItems(0);
        dispatch(showToast('Failed to load employee audit history.', 'error'));
      })
      .finally(() => {
        if (cancelled) return;
        setViewHistoryAuditLoading(false);
      });

    return () => {
      cancelled = true;
    };
  };

  useEffect(() => {
    fetchEmployeeHistory();
  }, [viewHistorySelection?.employeeID, viewHistoryAuditPage, viewHistoryAuditPageSize]);

  useEffect(() => {
    const total = viewHistoryAuditTotalItems;
    const maxPage = Math.max(1, Math.ceil(total / viewHistoryAuditPageSize) || 1);
    if (viewHistoryAuditPage > maxPage) {
      setViewHistoryAuditPage(maxPage);
    }
  }, [viewHistoryAuditTotalItems, viewHistoryAuditPageSize, viewHistoryAuditPage]);

  const viewHistoryAuditPagination = useMemo(
    () => ({
      currentPage: viewHistoryAuditPage,
      pageSize: viewHistoryAuditPageSize,
      totalItems: viewHistoryAuditTotalItems,
      serverSide: true,
      onPageChange: (page: number) => setViewHistoryAuditPage(page),
      onPageSizeChange: (newSize: number) => {
        setViewHistoryAuditPageSize(newSize);
        setViewHistoryAuditPage(1);
      },
    }),
    [viewHistoryAuditPage, viewHistoryAuditPageSize, viewHistoryAuditTotalItems]
  );

  const handleAdd = () => {
    navigate('/personnel/employee/add');
  };

  const handleEdit = (item: EmployeeResponse) => {
    navigate(`/personnel/employee/edit/${item.employeeID}`);
  };

  const handleDelete = (item: EmployeeResponse) => {
    setDeletingItem(item);
  };

  const [impersonatingEmployeeId, setImpersonatingEmployeeId] = useState<string | null>(null);
  const [isDeletingEmployee, setIsDeletingEmployee] = useState(false);

  const handleOpenEmployeeLogin = useCallback(async (row: EmployeeResponse) => {
    if (impersonatingEmployeeId) return;
    setImpersonatingEmployeeId(row.employeeID);
    try {
      await openEmployeeImpersonationTab(row.employeeID);
    } catch (err) {
      const message = typeof err === 'string' ? err : err instanceof Error ? err.message : 'Login failed';
      dispatch(showToast(message, 'error'));
    } finally {
      setImpersonatingEmployeeId(null);
    }
  }, [dispatch, impersonatingEmployeeId]);

  const handleConfirmDelete = async () => {
    if (deletingItem && !isDeletingEmployee) {
      setIsDeletingEmployee(true);
      try {
        const fullName =
          formatLastNameCommaFirstName(deletingItem.firstName, deletingItem.lastName) ||
          deletingItem.username ||
          '';
        await dispatch(
          removeEmployee({
            id: deletingItem.employeeID,
            name: fullName || 'this employee',
          })
        ).unwrap();
        refetchEmployees();
      } catch (error) {
        console.error('Failed to delete employee:', error);
      } finally {
        setIsDeletingEmployee(false);
        setDeletingItem(null);
      }
    }
  };

  // Map (employeeID, departmentID) -> admin type display names for AdminType column
  const employeeAdminTypesMap = useMemo(() => {
    const map = new Map<string, string[]>();
    const list = departmentAdminsLookup || [];
    const adminTypesList = adminTypes ?? [];
    for (const d of list) {
      const empId = (d.employeeID ?? '').trim();
      const deptId = (d.departmentID ?? '').trim();
      if (!empId) continue;
      const key = `${empId}|${deptId}`;
      const label =
        (d.adminTypeName && d.adminTypeName.trim()) ||
        adminTypesList.find((t) => (t.adminTypeID ?? '').trim() === (d.adminTypeID ?? '').trim())?.adminTypeShort ||
        adminTypesList.find((t) => (t.adminTypeID ?? '').trim() === (d.adminTypeID ?? '').trim())?.adminTypeLong ||
        (d.adminTypeID ?? '').trim() ||
        '';
      if (!label) continue;
      const existing = map.get(key) ?? [];
      if (!existing.includes(label)) existing.push(label);
      map.set(key, existing);
    }
    return map;
  }, [departmentAdminsLookup, adminTypes]);

  
  const employeeTypeSelectOptions = useMemo(
    () =>
      (activeEmployeeTypes || []).map((type) => ({
        value: type.employeeTypeID,
        label: type.employeeTypeShort ?? String(type.employeeTypeID),
      })),
    [activeEmployeeTypes]
  );

  const columns: DataTableColumn<EmployeeResponse>[] = useMemo(() => [
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
      key: 'primaryPhone',
      label: EMPLOYEE.TABLE.COLUMNS.PHONE,
      render: (_value, row) => {
        const formatted = row.primaryPhone ? formatPhoneNumber(row.primaryPhone) : '';
        return formatted || '-';
      },
    },
    {
      key: 'adminType',
      label: EMPLOYEE.TABLE.COLUMNS.ADMIN_TYPE,
      render: (_value, row) => {
        const key = `${(row.employeeID ?? '').trim()}|${(row.departmentID ?? '').trim()}`;
        const labels = employeeAdminTypesMap.get(key) ?? [];
        if (labels.length === 0) {
          return (
            <Typography component="span" variant="body2" className="employee-list__admin-type-empty">
              -
            </Typography>
          );
        }
        return (
          <Stack direction="row" flexWrap="wrap" className="employee-list__admin-type-container" useFlexGap>
            {labels.map((label, idx) => (
              <Box
                component="span"
                key={`${key}-${idx}-${label}`}
                className="admin-type-badge"
                title={label}
              >
                {label}
              </Box>
            ))}
          </Stack>
        );
      },
    },
    ...(!viewOnlyEmployeeList && isSuperUser
      ? [
          {
            key: 'actions',
            label: EMPLOYEE.TABLE.COLUMNS.ACTION,
            render: (_value: unknown, row: EmployeeResponse) => (
              <SMSButton
                size="small"
                color="primary"
                loading={impersonatingEmployeeId === row.employeeID}
                disabled={isLoading || !!impersonatingEmployeeId}
                onClick={() => void handleOpenEmployeeLogin(row)}
                aria-label={EMPLOYEE.BUTTON.LOGIN_AS_EMPLOYEE}
              >
                {EMPLOYEE.BUTTON.LOGIN_AS_EMPLOYEE}
              </SMSButton>
            ),
          },
        ]
      : []),
    ...(!viewOnlyEmployeeList && !isSuperUser
      ? [
          {
            key: 'actions',
            label: EMPLOYEE.TABLE.COLUMNS.ACTION,
            render: (_value: unknown, row: EmployeeResponse) => (
              <Stack
                direction="row"
                className="employee-list__actions data-table__cell--no-clamp"
                alignItems="center"
                justifyContent="center"
                useFlexGap
                sx={{ flexWrap: 'nowrap', minHeight: 32 }}
              >
                <SMSIconButton
                  tone="secondary"
                  size="small"
                  onClick={() =>
                    setViewHistorySelection({
                      employeeID: String(row.employeeID ?? ''),
                      snapshotName:
                        formatLastNameCommaFirstName(row.firstName, row.lastName, '') ||
                        row.username ||
                        String(row.employeeID ?? ''),
                    })
                  }
                  title={EMPLOYEE.BUTTON.VIEW_HISTORY}
                  aria-label={EMPLOYEE.BUTTON.VIEW_HISTORY}
                  className="employee-list__icon-btn"
                >
                  <SMSIcon name="history" size="sm" />
                </SMSIconButton>
                <SMSIconButton
                  tone="secondary"
                  size="small"
                  onClick={() => {
                    setSelectedEmployeeForAdmin(row);
                    setEmployeeAdminModalOpen(true);
                  }}
                  title={EMPLOYEE.MENU.EMPLOYEE_ADMIN}
                  aria-label={EMPLOYEE.MENU.EMPLOYEE_ADMIN}
                  className="employee-list__icon-btn"
                >
                  <SMSIcon name="description" size="sm" />
                </SMSIconButton>
                <SMSIconButton
                  tone="primary"
                  size="small"
                  onClick={() => handleEdit(row)}
                  title={EMPLOYEE.BUTTON.EDIT}
                  aria-label={EMPLOYEE.BUTTON.EDIT}
                  className="employee-list__icon-btn"
                >
                  <SMSIcon name="edit" size="sm" />
                </SMSIconButton>
                <SMSIconButton
                  tone="error"
                  size="small"
                  onClick={() => handleDelete(row)}
                  title={EMPLOYEE.BUTTON.DELETE}
                  aria-label={EMPLOYEE.BUTTON.DELETE}
                  className="employee-list__icon-btn"
                >
                  <SMSIcon name="delete" size="sm" />
                </SMSIconButton>
              </Stack>
            ),
          },
        ]
      : []),
  ], [
    viewOnlyEmployeeList,
    isSuperUser,
    isLoading,
    employeeAdminTypesMap,
    handleEdit,
    handleDelete,
    handleOpenEmployeeLogin,
  ]);

  return (
    <Box component="main" className={`employee-list ${className}`}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" className="employee-list__header">
        <Stack direction="row" alignItems="center" spacing={1.5} useFlexGap>
          {departmentScopeId ? (
            <button
              type="button"
              onClick={() => navigate('/admin/department')}
              className="form-page__back-button"
            >
              <SMSIcon name="arrowLeft" size="md" />
            </button>
          ) : null}
          <Typography variant="h4" component="h1" className="employee-list__title">
            {EMPLOYEE.TABLE.TITLE}
          </Typography>
        </Stack>
        {!viewOnlyEmployeeList && !isSuperUser && (
          <SMSButton
            onClick={handleAdd}
            disabled={isLoading}
            startIcon={<SMSIcon name="plus" size="sm" />}
          >
            {EMPLOYEE.BUTTON.ADD_NEW}
          </SMSButton>
        )}
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
            <Box className="employee-list__type-filter">
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
                    departmentId: departmentScopeId || undefined,
                  });
                }}
                placeholder={EMPLOYEE.FORM.EMPLOYEE_TYPE_PLACEHOLDER}
                clearable
                disabled={isLoading}
                fullWidth
                sx={{ minWidth: 220 }}
              />
            </Box>
          </Stack>
          <SMSSegmentedStatusFilter
            className="employee-list__status-filters"
            value={statusFilter}
            onChange={(value) => {
              setStatusFilter(value);
              pagination.goToFirstPage();
            }}
            activeLabel={EMPLOYEE.TABLE.FILTERS.ACTIVE}
            inactiveLabel={EMPLOYEE.TABLE.FILTERS.INACTIVE}
            allowClear
            ariaLabel="Status filter"
          />
        </Stack>

        <SMSDataTableWrapper
          data={employeesFilteredByApproval}
          columns={columns}
          loading={isLoading}
          emptyMessage={EMPLOYEE.TABLE.NO_DATA}
          searchable={false}
          maxBodyHeight={PAGE_GRID_MAX_BODY_HEIGHT}
          responsiveMode="auto"
          responsiveAutoMeasure="container"
          responsiveAutoMaxWidthPx={600}
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

      {/* Department Admin from Employee grid: employee fixed, admin types multi-select */}
      <Modal
        isOpen={employeeAdminModalOpen}
        onClose={() => {
          setEmployeeAdminModalOpen(false);
          setSelectedEmployeeForAdmin(null);
        }}
        title={EMPLOYEE.MENU.EMPLOYEE_ADMIN}
        size="small"
      >
        {selectedEmployeeForAdmin && (
          <SMSDepartmentAdminForm
            initialData={{
              employeeID: selectedEmployeeForAdmin.employeeID,
              departmentID: selectedEmployeeForAdmin.departmentID ?? '',
            }}
            fixedEmployeeID={selectedEmployeeForAdmin.employeeID}
            disableEmployee
            adminTypeMultiSelect
            onSuccess={() => {
              refetchDepartmentAdminsLookup();
              setEmployeeAdminModalOpen(false);
              setSelectedEmployeeForAdmin(null);
            }}
            onCancel={() => {
              setEmployeeAdminModalOpen(false);
              setSelectedEmployeeForAdmin(null);
            }}
          />
        )}
      </Modal>

      {/* Delete Confirmation */}
      <SMSConfirmDialog
        open={!!deletingItem}
        title={EMPLOYEE.CONFIRM.DELETE_TITLE}
        message={EMPLOYEE.CONFIRM.DELETE_MESSAGE}
        confirmText={EMPLOYEE.CONFIRM.DELETE_CONFIRM}
        cancelText={EMPLOYEE.CONFIRM.DELETE_CANCEL}
        loading={isDeletingEmployee}
        onConfirm={handleConfirmDelete}
        onClose={() => !isDeletingEmployee && setDeletingItem(null)}
        variant="error"
      />

      <SMSAuditHistoryModal
        open={viewHistoryModalOpen}
        onClose={() => {
          setViewHistorySelection(null);
          setViewHistoryAuditStartDate('');
          setViewHistoryAuditEndDate('');
          setViewHistoryAuditPage(1);
          setViewHistoryAuditPageSize(10);
          setViewHistoryAuditTotalItems(0);
        }}
        title={viewHistoryModalTitle}
        rows={viewHistoryAuditRows}
        loading={viewHistoryAuditLoading}
        emptyMessage={EMPLOYEE.TABLE.NO_DATA}
        startDate={viewHistoryAuditStartDate}
        endDate={viewHistoryAuditEndDate}
        onStartDateChange={setViewHistoryAuditStartDate}
        onEndDateChange={setViewHistoryAuditEndDate}
        onApplyFilter={() => {
          const start = viewHistoryAuditStartDate.trim();
          const end = viewHistoryAuditEndDate.trim();
          if (start && end && start > end) {
            dispatch(showToast(REQUESTER.AUDIT.DATE_RANGE_INVALID, 'error'));
            return;
          }
          setViewHistoryAuditPage(1);
          fetchEmployeeHistory();
        }}
        pagination={viewHistoryAuditPagination}
      />
    </Box>
  );
};

