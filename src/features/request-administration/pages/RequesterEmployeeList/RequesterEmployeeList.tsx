import { SMSButton, SMSIcon, SMSIconButton } from '@/components/smsatoms';
import React, { useState, useMemo, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { SMSConfirmDialog } from '@/components/smsmolecules';
import { SMSDataTableWrapper, SMSModal as Modal } from '@/components/smsorganisms';
import {
  RequesterEmployeeForm,
  type RequesterEmployeeFormMode,
} from '@/components/smsmolecules/RequesterEmployeeForm';
import { usePagination } from '@/hooks/usePagination';
import {
  fetchRequesterEmployeeList,
  removeRequesterEmployee,
} from '@/store/slices/requesterEmployeeSlice';
import { fetchRequesterManagerList } from '@/store/slices/requesterManagerSlice';
import type {
  RequesterEmployee,
  RequesterEmployeeListProps,
  RequesterEmployeeDisplayRow,
} from '@/types/requesterEmployee';
import { REQUESTER_EMPLOYEE } from '@/constants/strings';
import { formatLastNameCommaFirstName } from '@/utils';
import './RequesterEmployeeList.css';

export const RequesterEmployeeList: React.FC<RequesterEmployeeListProps> = ({
  className = '',
}) => {
  const dispatch = useAppDispatch();
  const { list: items, isLoading, error: listError } = useAppSelector(
    (state) => state.requesterEmployee
  );
  const { list: requesterManagers } = useAppSelector((state) => state.requesterManager);
  const { employees } = useAppSelector((state) => state.employee);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<RequesterEmployeeFormMode>('create');
  const [editingRow, setEditingRow] = useState<RequesterEmployee | null>(null);
  const [deletingRow, setDeletingRow] = useState<RequesterEmployee | null>(null);

  useEffect(() => {
    dispatch(fetchRequesterEmployeeList({ page: 1, pageSize: 1000 }));
    dispatch(fetchRequesterEmployeeList({ page: 1, pageSize: 1000 }));
    dispatch(fetchRequesterManagerList());
  }, [dispatch]);

  const pagination = usePagination({
    initialPage: 1,
    initialPageSize: REQUESTER_EMPLOYEE.DEFAULT_PAGE_SIZE,
    totalItems: items.length,
  });


  const tableData = useMemo<RequesterEmployeeDisplayRow[]>(() => {
    return items.map((r: any) => {  // Cast to any to access employeeName from API response
      // Resolve Manager Name: find the requester-manager link, then the manager's employee record for display name
      const requesterManager = requesterManagers.find((m) => m.requesterManagerID === r.requesterManagerID);
      const managerEmployee = requesterManager
        ? employees.find((e) => e.employeeID === requesterManager.employeeID)
        : null;
      const managerDisplayName =
        (managerEmployee
          ? formatLastNameCommaFirstName(managerEmployee.firstName, managerEmployee.lastName)
          : '') ||
        r.requesterManagerID ||
        REQUESTER_EMPLOYEE.TABLE.FALLBACK_NAME;

      // Resolve Employee Name - look up from employees list or use from API response
      const employee = employees.find((e) => e.employeeID === r.employeeID);
      const employeeDisplayName =
        r.employeeName ||
        (employee
          ? formatLastNameCommaFirstName(employee.firstName, employee.lastName)
          : '') ||
        r.employeeID;

      const badgeNumber = employee?.badgeNumber || '';
      const employeeType = employee?.employeeType || '';

      return {
        ...r,
        managerName: managerDisplayName,
        employeeName: employeeDisplayName,
        badgeNumber,
        employeeType,
        __raw: r,
      };
    });
  }, [items, requesterManagers, employees]);

  const handleAddClick = () => {
    setEditingRow(null);
    setModalMode('create');
    setIsModalOpen(true);
  };

  const handleEditClick = (row: RequesterEmployee) => {
    setEditingRow(row);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingRow(null);
    setModalMode('create');
  };

  const handleFormSuccess = () => {
    dispatch(fetchRequesterEmployeeList({ page: 1, pageSize: 1000 }));
    setIsModalOpen(false);
    setEditingRow(null);
  };

  const handleDeleteClick = (row: RequesterEmployee) => setDeletingRow(row);

  const handleDeleteConfirm = async () => {
    if (!deletingRow) return;
    try {
      await dispatch(removeRequesterEmployee(deletingRow.requesterEmployeeID)).unwrap();
      dispatch(fetchRequesterEmployeeList({ page: 1, pageSize: 1000 }));
    } catch {
      // Error in slice
    } finally {
      setDeletingRow(null);
    }
  };

  const handleDeleteCancel = () => setDeletingRow(null);

  const searchableColumns = useMemo(
    () => ['managerName', 'employeeName'] as (keyof RequesterEmployeeDisplayRow)[],
    []
  );

  const getModalTitle = () => {
    return modalMode === 'create'
      ? REQUESTER_EMPLOYEE.TITLE
      : REQUESTER_EMPLOYEE.EDIT_TITLE;
  };

  const tableColumns = useMemo(
    () => [
      {
        key: 'managerName',
        label: REQUESTER_EMPLOYEE.TABLE.COLUMNS.MANAGER_NAME,
        render: (_: unknown, row: RequesterEmployeeDisplayRow) =>
          String(row.managerName ?? REQUESTER_EMPLOYEE.TABLE.FALLBACK_NAME),
      },
      {
        key: 'employeeName',
        label: REQUESTER_EMPLOYEE.TABLE.COLUMNS.EMPLOYEE_NAME,
        render: (_: unknown, row: RequesterEmployeeDisplayRow) => (
          String(row.employeeName ?? REQUESTER_EMPLOYEE.TABLE.FALLBACK_NAME)
        ),
      },
      {
        key: 'badgeNumber',
        label: REQUESTER_EMPLOYEE.TABLE.COLUMNS.BADGE_NUMBER,
        render: (_: unknown, row: RequesterEmployeeDisplayRow) =>
          row.badgeNumber && row.badgeNumber.trim().length > 0 ? row.badgeNumber : '-',
      },
      {
        key: 'employeeType',
        label: REQUESTER_EMPLOYEE.TABLE.COLUMNS.EMPLOYEE_TYPE,
        render: (_: unknown, row: RequesterEmployeeDisplayRow) =>
          row.employeeType && row.employeeType.trim().length > 0 ? row.employeeType : '-',
      },
      {
        key: 'preferred',
        label: REQUESTER_EMPLOYEE.TABLE.COLUMNS.PREFERRED,
        render: (_: unknown, row: RequesterEmployeeDisplayRow) =>
          row.isPreferred ? REQUESTER_EMPLOYEE.TABLE.LABELS.YES : REQUESTER_EMPLOYEE.TABLE.LABELS.NO,
      },
      {
        key: 'action',
        label: REQUESTER_EMPLOYEE.TABLE.COLUMNS.ACTION,
        render: (_: unknown, row: RequesterEmployeeDisplayRow) => (
          <div className="requester-employee-list__actions">
            <SMSIconButton
              size="small"
              tone="primary"
              onClick={() => handleEditClick(row.__raw)}
              className="requester-employee-list__edit-button"
              title={REQUESTER_EMPLOYEE.BUTTON.EDIT}
              aria-label={REQUESTER_EMPLOYEE.BUTTON.EDIT}
            >
              <SMSIcon name="edit" size="sm" />
            </SMSIconButton>
            <SMSButton color="error"
              onClick={() => handleDeleteClick(row.__raw)}
              className="requester-employee-list__delete-button"
              title={REQUESTER_EMPLOYEE.BUTTON.REMOVE}
              aria-label={REQUESTER_EMPLOYEE.BUTTON.REMOVE}
            >
              <SMSIcon name="delete" size="sm" />
            </SMSButton>
          </div>
        ),
      },
    ],
    []
  );

  return (
    <div className={`requester-employee-list requester-employee-list--page ${className}`}>
      <div className="requester-employee-list__header">
        <h1 className="requester-employee-list__title">
          {REQUESTER_EMPLOYEE.TABLE.TITLE}
        </h1>
        <SMSButton
          onClick={handleAddClick}
          className="requester-employee-list__add-button"
        >
          <SMSIcon name="plus" size="sm" />
          {REQUESTER_EMPLOYEE.BUTTON.ADD_NEW}
        </SMSButton>
      </div>

      {listError && (
        <div className="requester-employee-list__error" role="alert">
          {listError}
        </div>
      )}

      <SMSDataTableWrapper<RequesterEmployeeDisplayRow>
        columns={tableColumns as any}
        data={tableData}
        emptyMessage={REQUESTER_EMPLOYEE.TABLE.NO_DATA}
        loading={isLoading}
        showHeaderWhenEmpty
        renderEmptyAsTable
        tableClassName="requester-employee-list__table"
        searchable
        searchableColumns={searchableColumns}
        maxBodyHeight="max(320px, calc(100vh - 360px))"
        pagination={{
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

      <Modal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        title={getModalTitle()}
        size="large"
      >
        <RequesterEmployeeForm
          mode={modalMode}
          initialData={editingRow}
          onSuccess={handleFormSuccess}
          onCancel={handleModalClose}
        />
      </Modal>

      <SMSConfirmDialog
        open={!!deletingRow}
        title={REQUESTER_EMPLOYEE.CONFIRM.DELETE_TITLE}
        message={REQUESTER_EMPLOYEE.CONFIRM.DELETE_MESSAGE}
        confirmText={REQUESTER_EMPLOYEE.CONFIRM.DELETE_CONFIRM}
        cancelText={REQUESTER_EMPLOYEE.CONFIRM.DELETE_CANCEL}
        onConfirm={handleDeleteConfirm}
        onClose={handleDeleteCancel}
        variant="error"
        loading={false}
      />
    </div>
  );
};
