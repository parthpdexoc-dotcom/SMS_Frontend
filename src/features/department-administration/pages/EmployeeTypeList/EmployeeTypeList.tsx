import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { usePagination } from '@/hooks/usePagination';
import { useMasterDataListStatusPagedParams } from '@/hooks/useMasterDataListStatusPagedParams';
import { useDebounce } from '@/hooks/useDebounceSearch';
import { EMPLOYEE_TYPE } from '@/constants/strings';
import { EmployeeTypeResponse } from '@/types/employeeType';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchEmployeeTypes, removeEmployeeType, searchEmployeeTypesThunk, updateEmployeeTypeRankThunk } from '@/store/slices/employeeTypeSlice';
import { showToast } from '@/store/slices/toastSlice';
import { isSuspendedEmployeeActive } from '@/utils';
import { EmployeeTypeForm } from '@/components/smsmolecules/EmployeeTypeForm';
import { SMSMasterDataShortLongStatusList } from '@/components/smsorganisms';
import './EmployeeTypeList.css';

const BASE = '/employee/employee-type';

export interface EmployeeTypeListProps {
  className?: string;
}

export const EmployeeTypeList: React.FC<EmployeeTypeListProps> = ({ className = '' }) => {
  const dispatch = useAppDispatch();
  const { employeeTypes, isLoading, totalItems: totalItemsFromStore } = useAppSelector((state) => state.employeeType);
  const user = useAppSelector((state) => state.auth.user);
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
      sortBy: 'rank',
      sortDirection: 'asc' as const,
      ...(isActiveParam !== undefined ? { isActive: isActiveParam } : {}),
      ...(searchTerm ? { searchTerm } : {}),
    };
    if (searchTerm.length > 0) {
      dispatch(searchEmployeeTypesThunk(params));
    } else {
      dispatch(fetchEmployeeTypes(params));
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
    <SMSMasterDataShortLongStatusList<EmployeeTypeResponse>
      className={`employee-type-list ${className}`.trim()}
      openModal={openModal}
      onOpenAdd={() => navigate(`${BASE}/add`)}
      onOpenEdit={(id) => navigate(`${BASE}/edit/${id}`)}
      onModalClose={() => navigate(BASE)}
      strings={{
        TITLE: EMPLOYEE_TYPE.TITLE,
        EDIT_TITLE: EMPLOYEE_TYPE.EDIT_TITLE,
        TABLE: {
          TITLE: EMPLOYEE_TYPE.TABLE.TITLE,
          NO_DATA: EMPLOYEE_TYPE.TABLE.NO_DATA,
          FILTERS: EMPLOYEE_TYPE.TABLE.FILTERS,
          COLUMNS: {
            TITLE: EMPLOYEE_TYPE.TABLE.COLUMNS.TITLE,
            DESCRIPTION: EMPLOYEE_TYPE.TABLE.COLUMNS.DESCRIPTION,
            STATUS: EMPLOYEE_TYPE.TABLE.COLUMNS.STATUS,
            CREATED_BY: EMPLOYEE_TYPE.TABLE.COLUMNS.CREATED_BY,
            EDITED_BY: EMPLOYEE_TYPE.TABLE.COLUMNS.EDITED_BY,
            ACTION: EMPLOYEE_TYPE.TABLE.COLUMNS.ACTION,
          },
        },
        BUTTON: {
          ADD_NEW: EMPLOYEE_TYPE.BUTTON.ADD_NEW,
          EDIT: EMPLOYEE_TYPE.BUTTON.EDIT,
          DELETE: EMPLOYEE_TYPE.BUTTON.DELETE,
        },
        CONFIRM: {
          DELETE_TITLE: EMPLOYEE_TYPE.CONFIRM.DELETE_TITLE,
          DELETE_MESSAGE: EMPLOYEE_TYPE.CONFIRM.DELETE_MESSAGE,
          DELETE_CONFIRM: EMPLOYEE_TYPE.CONFIRM.DELETE_CONFIRM,
          DELETE_CANCEL: EMPLOYEE_TYPE.CONFIRM.DELETE_CANCEL,
        },
      }}
      controlledStatusFilter={statusFilter}
      onControlledStatusFilterChange={handleStatusFilterChange}
      items={employeeTypes}
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
          removeEmployeeType({
            id: row.employeeTypeID,
            name:
              (row.employeeTypeShort ?? row.employeeTypeLong ?? '').trim() ||
              'this employee type',
          })
        ).unwrap();
      }}
      onMoveUp={async (row, newRank, opts) => {
        try {
          await dispatch(
            updateEmployeeTypeRankThunk({
              employeeTypeID: row.employeeTypeID,
              rank: newRank,
              ...(opts?.atDisplayRow != null ? { atDisplayRow: opts.atDisplayRow } : {}),
            })
          ).unwrap();
          const batchTotal = opts?.batchTotal;
          const isLast =
            batchTotal == null || opts?.batchIndex === batchTotal - 1;
          if (isLast) {
            dispatch(showToast('Employee type rank updated successfully', 'success'));
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to update employee type rank';
          dispatch(showToast(errorMessage, 'error'));
          throw error;
        }
      }}
      onMoveDown={async (row, newRank) => {
        try {
          await dispatch(updateEmployeeTypeRankThunk({ employeeTypeID: row.employeeTypeID, rank: newRank })).unwrap();
          dispatch(showToast('Employee type rank updated successfully', 'success'));
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to update employee type rank';
          dispatch(showToast(errorMessage, 'error'));
          throw error; // Re-throw to prevent refresh on error
        }
      }}
      getId={(r) => r.employeeTypeID}
      getReorderRank={(r) => Number(r.rank ?? 0)}
      FormComponent={EmployeeTypeForm}
      getShort={(r) => r.employeeTypeShort}
      getLong={(r) => r.employeeTypeLong}
      getStatus={(r) => Boolean(r.employeeTypeActive)}
      getCreatedBy={(r) => r.createdBy}
      getCreatedDate={(r) => r.createdDate}
      getEditedBy={(r) => r.editedBy}
      getEditedDate={(r) => r.editedDate}
      showAuditColumns={false}
      extraColumns={[
        {
          key: 'rank',
          label: 'Rank',
          render: (value) => {
            // Display the actual rank number from the API
            return value != null ? String(value) : '';
          },
        },
      ]}
      searchValue={localSearch}
      onSearchChange={setLocalSearch}
      sortableDragDisabled={isSuspendedEmployeeActive(user)}
    />
  );
};


