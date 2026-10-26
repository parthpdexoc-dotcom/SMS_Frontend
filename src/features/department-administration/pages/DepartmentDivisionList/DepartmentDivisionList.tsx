import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { usePagination } from '@/hooks/usePagination';
import { useMasterDataListStatusPagedParams } from '@/hooks/useMasterDataListStatusPagedParams';
import { useDebounce } from '@/hooks/useDebounceSearch';
import { DEPARTMENT_DIVISION } from '@/constants/strings';
import { DepartmentDivisionResponse } from '@/types/departmentDivision';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  fetchDepartmentDivisions,
  removeDepartmentDivision,
  searchDepartmentDivisionsThunk,
} from '@/store/slices/departmentDivisionsSlice';
import { SMSDepartmentDivisionForm } from '@/components/smsmolecules/SMSDepartmentDivisionForm';
import { SMSMasterDataShortLongStatusList } from '@/components/smsorganisms';
import { hasRole, UserRoleType } from '@/types/userRole';

const BASE = '/employee/department-division';

export interface DepartmentDivisionListProps {
  className?: string;
}

export const DepartmentDivisionList: React.FC<DepartmentDivisionListProps> = ({ className = '' }) => {
  const dispatch = useAppDispatch();
  const { divisions, isLoading, totalItems: totalItemsFromStore } = useAppSelector((state) => state.departmentDivisions);
  const pagination = usePagination();
  const { statusFilter, handleStatusFilterChange, isActiveParam } = useMasterDataListStatusPagedParams(pagination);
  const { user } = useAppSelector((state) => state.auth);
  const isHRAdmin = hasRole(user?.roles, UserRoleType.HRAdmin);
  const location = useLocation();
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id?: string }>();
  const [urlFilters, , setSearchFilters] = useUrlFilters(['search']);
  const searchFromUrl = urlFilters.search ?? '';
  const [localSearch, setLocalSearch] = useState(searchFromUrl);
  const debouncedSearch = useDebounce(localSearch, 500);

  const refetchList = useCallback(() => {
    const searchTerm = debouncedSearch.trim();
    const paginationParams = {
      page: pagination.currentPage,
      pageSize: pagination.pageSize,
      ...(isActiveParam !== undefined ? { isActive: isActiveParam } : {}),
      ...(searchTerm ? { searchTerm } : {}),
    };
    if (searchTerm.length > 0) {
      dispatch(searchDepartmentDivisionsThunk({ pagination: paginationParams }));
    } else {
      dispatch(fetchDepartmentDivisions({ pagination: paginationParams }));
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
    <SMSMasterDataShortLongStatusList<DepartmentDivisionResponse>
      className={className}
      getId={(r) => r.divisionID}
      openModal={openModal}
      onOpenAdd={() => navigate(`${BASE}/add`)}
      onOpenEdit={(id) => navigate(`${BASE}/edit/${id}`)}
      onModalClose={() => navigate(BASE)}
      strings={{
        TITLE: DEPARTMENT_DIVISION.TITLE,
        EDIT_TITLE: DEPARTMENT_DIVISION.EDIT_TITLE,
        TABLE: {
          TITLE: DEPARTMENT_DIVISION.TABLE.TITLE,
          NO_DATA: DEPARTMENT_DIVISION.TABLE.NO_DATA,
          FILTERS: DEPARTMENT_DIVISION.TABLE.FILTERS,
          COLUMNS: {
            TITLE: DEPARTMENT_DIVISION.TABLE.COLUMNS.TITLE,
            DESCRIPTION: DEPARTMENT_DIVISION.TABLE.COLUMNS.DESCRIPTION,
            STATUS: DEPARTMENT_DIVISION.TABLE.COLUMNS.STATUS,
            CREATED_BY: DEPARTMENT_DIVISION.TABLE.COLUMNS.CREATED_BY,
            EDITED_BY: DEPARTMENT_DIVISION.TABLE.COLUMNS.EDITED_BY,
            ACTION: DEPARTMENT_DIVISION.TABLE.COLUMNS.ACTION,
          },
        },
        BUTTON: {
          ADD_NEW: DEPARTMENT_DIVISION.BUTTON.ADD_NEW,
          EDIT: DEPARTMENT_DIVISION.BUTTON.EDIT,
          DELETE: DEPARTMENT_DIVISION.BUTTON.DELETE,
        },
        CONFIRM: {
          DELETE_TITLE: DEPARTMENT_DIVISION.CONFIRM.DELETE_TITLE,
          DELETE_MESSAGE: DEPARTMENT_DIVISION.CONFIRM.DELETE_MESSAGE,
          DELETE_CONFIRM: DEPARTMENT_DIVISION.CONFIRM.DELETE_CONFIRM,
          DELETE_CANCEL: DEPARTMENT_DIVISION.CONFIRM.DELETE_CANCEL,
        },
      }}
      controlledStatusFilter={statusFilter}
      onControlledStatusFilterChange={handleStatusFilterChange}
      items={divisions}
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
          removeDepartmentDivision({
            id: row.divisionID,
            name:
              (row.divisionShort ?? row.divisionLong ?? '').trim() ||
              'this department division',
          })
        ).unwrap();
      }}
      FormComponent={SMSDepartmentDivisionForm}
      getShort={(r) => r.divisionShort}
      getLong={(r) => r.divisionLong}
      getStatus={(r) => Boolean(r.divisionActive)}
      getCreatedBy={(r) => r.createdBy}
      getCreatedDate={(r) => r.createdDate}
      getEditedBy={(r) => r.editedBy}
      getEditedDate={(r) => r.editedDate}
      showAuditColumns={false}
      readOnly={isHRAdmin}
      searchValue={localSearch}
      onSearchChange={setLocalSearch}
    />
  );
};


