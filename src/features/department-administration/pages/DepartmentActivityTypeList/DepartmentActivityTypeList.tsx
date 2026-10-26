import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { usePagination } from '@/hooks/usePagination';
import { useMasterDataListStatusPagedParams } from '@/hooks/useMasterDataListStatusPagedParams';
import { useDebounce } from '@/hooks/useDebounceSearch';
import { DEPARTMENT_ACTIVITY_TYPE } from '@/constants/strings';
import { DepartmentActivityTypeResponse } from '@/types/departmentActivityType';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  fetchDepartmentActivityTypes,
  isMasterDepartmentActivityType,
  removeDepartmentActivityType,
  searchDepartmentActivityTypesThunk,
} from '@/store/slices/departmentActivityTypeSlice';
import { SMSDepartmentActivityTypeForm } from '@/components/smsmolecules/SMSDepartmentActivityTypeForm';
import { SMSMasterDataShortLongStatusList } from '@/components/smsorganisms';

const BASE = '/employee/department-activity-type';

export interface DepartmentActivityTypeListProps {
  className?: string;
}

export const DepartmentActivityTypeList: React.FC<DepartmentActivityTypeListProps> = ({
  className = '',
}) => {
  const dispatch = useAppDispatch();
  const { activityTypes, isLoading, totalItems: totalItemsFromStore } = useAppSelector(
    (state) => state.departmentActivityType
  );
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
      dispatch(searchDepartmentActivityTypesThunk(params));
    } else {
      dispatch(fetchDepartmentActivityTypes(params));
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
    if (editId && location.pathname.startsWith(`${BASE}/edit/`)) {
      const row = activityTypes.find((r) => r.departmentActivityTypeId === editId);
      if (row && isMasterDepartmentActivityType(row)) return null;
      return editId;
    }
    return null;
  }, [location.pathname, editId, activityTypes]);

  useEffect(() => {
    if (!editId || !location.pathname.startsWith(`${BASE}/edit/`)) return;
    const row = activityTypes.find((r) => r.departmentActivityTypeId === editId);
    if (row && isMasterDepartmentActivityType(row)) {
      navigate(BASE, { replace: true });
    }
  }, [editId, location.pathname, activityTypes, navigate]);

  return (
    <SMSMasterDataShortLongStatusList<DepartmentActivityTypeResponse>
      className={className}
      getId={(r) => r.departmentActivityTypeId}
      openModal={openModal}
      onOpenAdd={() => navigate(`${BASE}/add`)}
      onOpenEdit={(id) => {
        const row = activityTypes.find((r) => r.departmentActivityTypeId === id);
        if (row && isMasterDepartmentActivityType(row)) return;
        navigate(`${BASE}/edit/${id}`);
      }}
      onModalClose={() => navigate(BASE)}
      strings={{
        TITLE: DEPARTMENT_ACTIVITY_TYPE.TITLE,
        EDIT_TITLE: DEPARTMENT_ACTIVITY_TYPE.EDIT_TITLE,
        TABLE: {
          TITLE: DEPARTMENT_ACTIVITY_TYPE.TABLE.TITLE,
          NO_DATA: DEPARTMENT_ACTIVITY_TYPE.TABLE.NO_DATA,
          FILTERS: DEPARTMENT_ACTIVITY_TYPE.TABLE.FILTERS,
          COLUMNS: {
            TITLE: DEPARTMENT_ACTIVITY_TYPE.TABLE.COLUMNS.TITLE,
            DESCRIPTION: DEPARTMENT_ACTIVITY_TYPE.TABLE.COLUMNS.DESCRIPTION,
            STATUS: DEPARTMENT_ACTIVITY_TYPE.TABLE.COLUMNS.STATUS,
            CREATED_BY: DEPARTMENT_ACTIVITY_TYPE.TABLE.COLUMNS.CREATED_BY,
            EDITED_BY: DEPARTMENT_ACTIVITY_TYPE.TABLE.COLUMNS.EDITED_BY,
            ACTION: DEPARTMENT_ACTIVITY_TYPE.TABLE.COLUMNS.ACTION,
          },
        },
        BUTTON: {
          ADD_NEW: DEPARTMENT_ACTIVITY_TYPE.BUTTON.ADD_NEW,
          EDIT: DEPARTMENT_ACTIVITY_TYPE.BUTTON.EDIT,
          DELETE: DEPARTMENT_ACTIVITY_TYPE.BUTTON.DELETE,
        },
        CONFIRM: {
          DELETE_TITLE: DEPARTMENT_ACTIVITY_TYPE.CONFIRM.DELETE_TITLE,
          DELETE_MESSAGE: DEPARTMENT_ACTIVITY_TYPE.CONFIRM.DELETE_MESSAGE,
          DELETE_CONFIRM: DEPARTMENT_ACTIVITY_TYPE.CONFIRM.DELETE_CONFIRM,
          DELETE_CANCEL: DEPARTMENT_ACTIVITY_TYPE.CONFIRM.DELETE_CANCEL,
        },
      }}
      controlledStatusFilter={statusFilter}
      onControlledStatusFilterChange={handleStatusFilterChange}
      items={activityTypes}
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
        if (isMasterDepartmentActivityType(row)) return;
        await dispatch(
          removeDepartmentActivityType({
            id: row.departmentActivityTypeId,
            name:
              (row.activityTypeShort ?? row.activityTypeLong ?? '').trim() ||
              'this department activity type',
          })
        ).unwrap();
      }}
      FormComponent={SMSDepartmentActivityTypeForm}
      getShort={(r) => r.activityTypeShort}
      getLong={(r) => r.activityTypeLong}
      getStatus={(r) => Boolean(r.activityTypeStatus)}
      getCreatedBy={(r) => r.createdBy}
      getCreatedDate={(r) => r.createdDate}
      getEditedBy={(r) => r.editedBy}
      getEditedDate={(r) => r.editedDate}
      isRowReadOnly={isMasterDepartmentActivityType}
      showAuditColumns={false}
      searchValue={localSearch}
      onSearchChange={setLocalSearch}
    />
  );
};


