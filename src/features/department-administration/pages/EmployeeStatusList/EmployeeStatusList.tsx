import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { usePagination } from '@/hooks/usePagination';
import { useMasterDataListStatusPagedParams } from '@/hooks/useMasterDataListStatusPagedParams';
import { useDebounce } from '@/hooks/useDebounceSearch';
import { EMPLOYEE_STATUS } from '@/constants/strings';
import { EmployeeStatusResponse } from '@/types/employeeStatus';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchEmployeeStatuses, removeEmployeeStatus, searchEmployeeStatusesThunk } from '@/store/slices/employeeStatusSlice';
import { SMSEmployeeStatusForm } from '@/components/smsmolecules/SMSEmployeeStatusForm';
import { SMSMasterDataShortLongStatusList } from '@/components/smsorganisms';

const BASE = '/admin/employee-status';

export interface EmployeeStatusListProps {
  className?: string;
}

export const EmployeeStatusList: React.FC<EmployeeStatusListProps> = ({ className = '' }) => {
  const dispatch = useAppDispatch();
  const { employeeStatuses, isLoading, totalItems: totalItemsFromStore } = useAppSelector((state) => state.employeeStatus);
  const pagination = usePagination();
  const { statusFilter, handleStatusFilterChange, isActiveParam } = useMasterDataListStatusPagedParams(pagination);
  const location = useLocation();
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id?: string }>();
  const [urlFilters, , setSearchFilters] = useUrlFilters(['search']);
  const searchFromUrl = urlFilters.search ?? '';
  const [localSearch, setLocalSearch] = useState(searchFromUrl);
  const debouncedSearch = useDebounce(localSearch, 500);

  const refetchList = useCallback(() => {
    const searchTerm = debouncedSearch.trim();
    const params = {
      page: pagination.currentPage,
      pageSize: pagination.pageSize,
      ...(isActiveParam !== undefined ? { isActive: isActiveParam } : {}),
      ...(searchTerm ? { searchTerm } : {}),
    };
    if (searchTerm.length > 0) {
      dispatch(searchEmployeeStatusesThunk(params));
    } else {
      dispatch(fetchEmployeeStatuses(params));
    }
  }, [dispatch, pagination.currentPage, pagination.pageSize, isActiveParam, debouncedSearch]);

  useEffect(() => {
    refetchList();
  }, [refetchList]);

  useEffect(() => {
    pagination.setTotalItems(totalItemsFromStore);
  }, [totalItemsFromStore, pagination.setTotalItems]);

  useEffect(() => {
    setLocalSearch(searchFromUrl);
  }, [searchFromUrl]);

  useEffect(() => {
    if (debouncedSearch !== searchFromUrl) {
      pagination.goToFirstPage();
      setSearchFilters({ search: debouncedSearch === '' ? undefined : debouncedSearch });
    }
  }, [debouncedSearch, searchFromUrl, pagination, setSearchFilters]);

  const openModal = useMemo((): 'add' | string | null => {
    if (location.pathname === `${BASE}/add`) return 'add';
    if (editId && location.pathname.startsWith(`${BASE}/edit/`)) return editId;
    return null;
  }, [location.pathname, editId]);

  return (
    <SMSMasterDataShortLongStatusList<EmployeeStatusResponse>
      className={className}
      getId={(r) => r.employeeStatusID}
      openModal={openModal}
      onOpenAdd={() => navigate(`${BASE}/add`)}
      onOpenEdit={(id) => navigate(`${BASE}/edit/${id}`)}
      onModalClose={() => navigate(BASE)}
      strings={{
        TITLE: EMPLOYEE_STATUS.TITLE,
        EDIT_TITLE: EMPLOYEE_STATUS.EDIT_TITLE,
        TABLE: {
          TITLE: EMPLOYEE_STATUS.TABLE.TITLE,
          NO_DATA: EMPLOYEE_STATUS.TABLE.NO_DATA,
          FILTERS: EMPLOYEE_STATUS.TABLE.FILTERS,
          COLUMNS: {
            TITLE: EMPLOYEE_STATUS.TABLE.COLUMNS.TITLE,
            DESCRIPTION: EMPLOYEE_STATUS.TABLE.COLUMNS.DESCRIPTION,
            STATUS: EMPLOYEE_STATUS.TABLE.COLUMNS.STATUS,
            CREATED_BY: EMPLOYEE_STATUS.TABLE.COLUMNS.CREATED_BY,
            EDITED_BY: EMPLOYEE_STATUS.TABLE.COLUMNS.EDITED_BY,
            ACTION: EMPLOYEE_STATUS.TABLE.COLUMNS.ACTION,
          },
        },
        BUTTON: {
          ADD_NEW: EMPLOYEE_STATUS.BUTTON.ADD_NEW,
          EDIT: EMPLOYEE_STATUS.BUTTON.EDIT,
          DELETE: EMPLOYEE_STATUS.BUTTON.DELETE,
        },
        CONFIRM: {
          DELETE_TITLE: EMPLOYEE_STATUS.CONFIRM.DELETE_TITLE,
          DELETE_MESSAGE: EMPLOYEE_STATUS.CONFIRM.DELETE_MESSAGE,
          DELETE_CONFIRM: EMPLOYEE_STATUS.CONFIRM.DELETE_CONFIRM,
          DELETE_CANCEL: EMPLOYEE_STATUS.CONFIRM.DELETE_CANCEL,
        },
      }}
      controlledStatusFilter={statusFilter}
      onControlledStatusFilterChange={handleStatusFilterChange}
      items={employeeStatuses}
      loading={isLoading}
      onRefresh={refetchList}
      serverPagination={{
        totalItems: pagination.totalItems,
        currentPage: pagination.currentPage,
        pageSize: pagination.pageSize,
        onPageChange: (page) => pagination.goToPage(page),
        onPageSizeChange: (newPageSize) => {
          pagination.setPageSize(newPageSize);
          pagination.goToFirstPage();
        },
      }}
      onDelete={async (row) => {
        await dispatch(
          removeEmployeeStatus({
            id: row.employeeStatusID,
            name:
              (row.statusShort ?? row.statusLong ?? '').trim() ||
              'this employee status',
          })
        ).unwrap();
      }}
      FormComponent={SMSEmployeeStatusForm}
      getShort={(r) => r.statusShort}
      getLong={(r) => r.statusLong}
      getStatus={(r) => Boolean(r.status)}
      getCreatedBy={(r) => r.createdBy}
      getCreatedDate={(r) => r.createdDate}
      getEditedBy={(r) => r.editedBy}
      getEditedDate={(r) => r.editedDate}
      showAuditColumns={false}
      searchValue={localSearch}
      onSearchChange={setLocalSearch}
    />
  );
};


