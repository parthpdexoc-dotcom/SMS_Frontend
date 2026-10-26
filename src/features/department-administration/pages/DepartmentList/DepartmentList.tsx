import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { usePagination } from '@/hooks/usePagination';
import { useNavigate } from 'react-router-dom';
import { Menu, MenuItem } from '@mui/material';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { useDebounce } from '@/hooks/useDebounceSearch';
import { SMSButton, SMSIcon, SMSIconButton, SMSBox, SMSStack, SMSTypography } from '@/components/smsatoms';
import { SMSModal as Modal, SMSDataTableWrapper } from '@/components/smsorganisms';
import { SearchFilter } from '@/components/smsmolecules/SearchFilter';
import type { DataTableColumn } from '@/components/smsorganisms';
import { SMSAlert, SMSConfirmDialog, SMSStatusBadge, SMSGeneratePayrollModal } from '@/components/smsmolecules';
import { SMSDepartmentAdminForm } from '@/components/smsmolecules/SMSDepartmentAdminForm';
import { PAGE_GRID_MAX_BODY_HEIGHT } from '@/constants/tablePagination';
import { DEPARTMENT, SEARCH } from '@/constants/strings';
import { DepartmentResponse } from '@/types/department';
import { UserRoleType, hasRole } from '@/types/userRole';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchDepartments, removeDepartment, searchDepartmentsThunk } from '@/store/slices/departmentSlice';
import { fetchAdminTypes } from '@/store/slices/adminTypeSlice';
import { fetchEmployees } from '@/store/slices/employeeSlice';
import { formatPhoneNumber } from '@/utils';
import './DepartmentList.css';

export interface DepartmentListProps {
  className?: string;
}

const DepartmentRowActionMenu: React.FC<{ row: DepartmentResponse; isSuperUser: boolean }> = ({ row, isSuperUser }) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const navigate = useNavigate();
  const open = Boolean(anchorEl);
  const handleClose = () => setAnchorEl(null);

  const handleAction = (path: string, state?: { departmentId?: string; departmentName?: string }) => {
    navigate(path, state ? { state } : undefined);
    handleClose();
  };
  
  return (
    <>
      <SMSIconButton
        type="button"
        size="small"
        tone="secondary"
        className="department-list__icon-btn department-list__more-button"
        onClick={(e) => {
          e.stopPropagation();
          setAnchorEl(e.currentTarget);
        }}
        aria-label="More actions"
        title="More actions"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <SMSIcon name="more_vert" size="sm" />
      </SMSIconButton>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ className: 'department-row-action-menu__paper' }}
      >
        <MenuItem
          onClick={() => handleAction(`/admin/department-configuration/${row.departmentID}`)}
          className="department-row-action-menu__item"
        >
          {DEPARTMENT.MENU.CONFIGURATION}
        </MenuItem>
        {isSuperUser && (
          <MenuItem
            onClick={() =>
              handleAction(
                `/personnel/employee?departmentId=${encodeURIComponent(row.departmentID)}`
              )
            }
            className="department-row-action-menu__item"
          >
            {DEPARTMENT.MENU.EMPLOYEES_LIST_DEPARTMENT_WISE}
          </MenuItem>
        )}
        {!isSuperUser && (
          <>
            <MenuItem
              onClick={() =>
                handleAction(`/admin/department-defined-fields/${row.departmentID}`, {
                  departmentId: row.departmentID,
                  departmentName: row.departmentName,
                })
              }
              className="department-row-action-menu__item"
            >
              {DEPARTMENT.MENU.DEFINED_FIELDS}
            </MenuItem>
            <MenuItem
              onClick={() =>
                handleAction(`/admin/department-policy/${row.departmentID}`, {
                  departmentId: row.departmentID,
                  departmentName: row.departmentName,
                })
              }
              className="department-row-action-menu__item"
            >
              {DEPARTMENT.MENU.POLICY}
            </MenuItem>
            <MenuItem
              onClick={() => handleAction(`/admin/department-invoice-config/${row.departmentID}`)}
              className="department-row-action-menu__item"
            >
              {DEPARTMENT.MENU.INVOICE_CONFIG}
            </MenuItem>
          </>
        )}
      </Menu>
    </>
  );
};

export const DepartmentList: React.FC<DepartmentListProps> = ({
  className = '',
}) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const isSuperUser = user?.isSuperUser === true || hasRole(user?.roles, UserRoleType.SuperUser);
  const { departments, isLoading, error: listError, totalItems: departmentTotalFromApi } = useAppSelector(
    (state) => state.department
  );
  const pagination = usePagination();
  const [departmentUrlFilters, , setDepartmentFilters] = useUrlFilters(['search']);
  const departmentSearchFromUrl = departmentUrlFilters.search ?? '';
  const [localSearch, setLocalSearch] = useState(departmentSearchFromUrl);
  const debouncedSearch = useDebounce(localSearch, 500);

  const [deletingItem, setDeletingItem] = useState<DepartmentResponse | null>(null);
  const [departmentAdminPopupDepartment, setDepartmentAdminPopupDepartment] = useState<DepartmentResponse | null>(null);
  const [payrollDepartment, setPayrollDepartment] = useState<DepartmentResponse | null>(null);

  const refetchDepartments = useCallback(() => {
    const searchTerm = debouncedSearch.trim();
    const params = {
      page: pagination.currentPage,
      pageSize: pagination.pageSize,
      ...(searchTerm ? { searchTerm } : {}),
    };
    if (searchTerm.length > 0) {
      dispatch(searchDepartmentsThunk(params));
    } else {
      dispatch(fetchDepartments(params));
    }
  }, [dispatch, pagination.currentPage, pagination.pageSize, debouncedSearch]);

  useEffect(() => {
    refetchDepartments();
  }, [refetchDepartments]);

  useEffect(() => {
    pagination.setTotalItems(departmentTotalFromApi);
  }, [departmentTotalFromApi, pagination.setTotalItems]);

  useEffect(() => {
    setLocalSearch(departmentSearchFromUrl);
  }, [departmentSearchFromUrl]);

  useEffect(() => {
    if (debouncedSearch !== departmentSearchFromUrl) {
      pagination.goToFirstPage();
      setDepartmentFilters({ search: debouncedSearch === '' ? undefined : debouncedSearch });
    }
  }, [debouncedSearch, departmentSearchFromUrl, pagination, setDepartmentFilters]);

  useEffect(() => {
    if (departmentAdminPopupDepartment) {
      dispatch(fetchAdminTypes({ page: 1, pageSize: 1000 }));
      dispatch(fetchEmployees({ page: 1, pageSize: 1000 }));
    }
  }, [departmentAdminPopupDepartment, dispatch]);

  const handleAdd = () => {
    navigate('/admin/department/add');
  };

  const handleEdit = useCallback(
    (item: DepartmentResponse) => {
      navigate(`/admin/department/edit/${item.departmentID}`);
    },
    [navigate]
  );

  const handleDelete = useCallback((item: DepartmentResponse) => {
    setDeletingItem(item);
  }, []);

  const handleConfirmDelete = async () => {
    if (deletingItem) {
      try {
        await dispatch(
          removeDepartment({
            id: deletingItem.departmentID,
            name: (deletingItem.departmentName ?? '').trim() || 'this department',
          })
        ).unwrap();
        refetchDepartments();
      } catch (error) {
        console.error('Failed to delete department:', error);
      }
      setDeletingItem(null);
    }
  };

  const columns: DataTableColumn<DepartmentResponse>[] = useMemo(() => [
    {
      key: 'departmentCode',
      label: DEPARTMENT.TABLE.COLUMNS.DEPARTMENT_CODE,
      render: (_value, row) => row.departmentCode || '-',
    },
    {
      key: 'departmentName',
      label: DEPARTMENT.TABLE.COLUMNS.DEPARTMENT_NAME,
      render: (_value, row) => row.departmentName || '-',
    },
    {
      key: 'address',
      label: DEPARTMENT.TABLE.COLUMNS.ADDRESS,
      render: (_value, row) => row.address || '-',
    },
    {
      key: 'city',
      label: DEPARTMENT.TABLE.COLUMNS.CITY,
      render: (_value, row) => row.city || '-',
    },
    {
      key: 'state',
      label: DEPARTMENT.TABLE.COLUMNS.STATE,
      render: (_value, row) => row.state || '-',
    },
    {
      key: 'phone',
      label: DEPARTMENT.TABLE.COLUMNS.PHONE,
      render: (_value, row) => {
        const formatted = row.phone ? formatPhoneNumber(row.phone) : '';
        return formatted || '-';
      },
    },
    {
      key: 'email',
      label: DEPARTMENT.TABLE.COLUMNS.EMAIL,
      render: (_value, row) => row.email || '-',
    },
    {
      key: 'active',
      label: DEPARTMENT.TABLE.COLUMNS.STATUS,
      render: (_value, row) => (
        <div className="department-list__status-container">
          <SMSStatusBadge
            label={row.active ? 'Active' : 'Inactive'}
            variant={row.active ? 'success' : 'error'}
            size="small"
          />
        </div>
      ),
    },
    {
      key: 'actions',
      label: DEPARTMENT.TABLE.COLUMNS.ACTION,
      render: (_value, row) => (
        <div className="department-list__actions data-table__cell--no-clamp">
          <SMSIconButton
            size="small"
            tone="secondary"
            onClick={() => setDepartmentAdminPopupDepartment(row)}
            title={DEPARTMENT.MENU.DEPARTMENT_ADMIN}
            aria-label={DEPARTMENT.MENU.DEPARTMENT_ADMIN}
            className="department-list__icon-btn"
          >
            <SMSIcon name="description" size="sm" />
          </SMSIconButton>
          <SMSIconButton
            onClick={() => handleEdit(row)}
            title={DEPARTMENT.BUTTON.EDIT}
            aria-label={DEPARTMENT.BUTTON.EDIT}
            size="small"
            tone="primary"
            className="department-list__icon-btn"
          >
            <SMSIcon name="edit" size="sm" />
          </SMSIconButton>
          <SMSIconButton
            size="small"
            tone="primary"
            onClick={() => setPayrollDepartment(row)}
            title="Generate Payroll"
            aria-label="Generate Payroll"
            className="department-list__icon-btn"
          >
            <SMSIcon name="receipt_long" size="sm" />
          </SMSIconButton>
          <SMSIconButton
            size="small"
            tone="error"
            onClick={() => handleDelete(row)}
            title={DEPARTMENT.BUTTON.DELETE}
            aria-label={DEPARTMENT.BUTTON.DELETE}
            className="department-list__icon-btn"
          >
            <SMSIcon name="delete" size="sm" />
          </SMSIconButton>
          <DepartmentRowActionMenu row={row} isSuperUser={isSuperUser} />
        </div>
      ),
    },
  ], [handleDelete, handleEdit, isSuperUser]);

  return (
    <SMSBox className={`department-list ${className}`}>
      <SMSStack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        spacing={2}
        className="department-list__header"
      >
        <SMSTypography variant="h4" component="h1" className="department-list__title">
          {DEPARTMENT.TABLE.TITLE}
        </SMSTypography>
        <SMSButton
          onClick={handleAdd}
          disabled={isLoading}
          className="department-list__add-button"
          leftIcon={<SMSIcon name="add" size="sm" />}
        >
          {DEPARTMENT.BUTTON.ADD_NEW}
        </SMSButton>
      </SMSStack>

      <SMSBox className="department-list__table">
        {listError && departments.length > 0 && (
          <SMSBox className="department-list__fetch-error">
            <SMSAlert variant="error" message={listError} />
          </SMSBox>
        )}

        <div className="department-list__toolbar data-table__toolbar">
          <div className="data-table__search department-list__search">
            <SearchFilter
              value={localSearch}
              onChange={setLocalSearch}
              placeholder={SEARCH.PLACEHOLDER_TABLE}
            />
          </div>
        </div>

        <SMSDataTableWrapper<DepartmentResponse>
          className="department-list__sms-datatable"
          columns={columns}
          data={departments}
          loading={isLoading}
          error={listError && departments.length === 0 ? listError : null}
          onRetry={departments.length === 0 ? refetchDepartments : undefined}
          emptyMessage={DEPARTMENT.TABLE.NO_DATA}
          emptyTitle={DEPARTMENT.TABLE.TITLE}
          emptyIcon="list"
          showHeaderWhenEmpty
          maxBodyHeight={PAGE_GRID_MAX_BODY_HEIGHT}
          responsiveMode="table"
          getRowKey={(row) => row.departmentID}
          pagination={{
            currentPage: pagination.currentPage,
            pageSize: pagination.pageSize,
            totalItems: pagination.totalItems,
            serverSide: true,
            onPageChange: (page) => pagination.goToPage(page),
            onPageSizeChange: (newPageSize) => {
              pagination.setPageSize(newPageSize);
              pagination.goToFirstPage();
            },
          }}
        />
      </SMSBox>

      {/* Department Admin popup */}
      <Modal
        open={!!departmentAdminPopupDepartment}
        onClose={() => setDepartmentAdminPopupDepartment(null)}
        title={DEPARTMENT.MENU.IA_ADMIN}
        size="small"
      >
        {departmentAdminPopupDepartment && (
          <SMSDepartmentAdminForm
            departmentId={
              departmentAdminPopupDepartment.departmentID ??
              (departmentAdminPopupDepartment as unknown as { DepartmentID?: string }).DepartmentID
            }
            initialData={{
              departmentID:
                departmentAdminPopupDepartment.departmentID ??
                (departmentAdminPopupDepartment as unknown as { DepartmentID?: string }).DepartmentID,
            }}
            fixedAdminTypeShort="IA Admin"
            disableAdminType
            onSuccess={() => setDepartmentAdminPopupDepartment(null)}
            onCancel={() => setDepartmentAdminPopupDepartment(null)}
          />
        )}
      </Modal>

      <SMSConfirmDialog
        open={!!deletingItem}
        title={DEPARTMENT.CONFIRM.DELETE_TITLE}
        message={DEPARTMENT.CONFIRM.DELETE_MESSAGE}
        confirmText={DEPARTMENT.CONFIRM.DELETE_CONFIRM}
        cancelText={DEPARTMENT.CONFIRM.DELETE_CANCEL}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeletingItem(null)}
        variant="error"
      />

      <SMSGeneratePayrollModal
        open={!!payrollDepartment}
        onClose={() => setPayrollDepartment(null)}
        departmentId={payrollDepartment?.departmentID}
        departmentName={payrollDepartment?.departmentName}
      />
    </SMSBox>
  );
};



