import React, { useCallback, useEffect, useState } from 'react';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { useDebounce } from '@/hooks/useDebounceSearch';
import { usePagination } from '@/hooks/usePagination';
import { useMasterDataListStatusPagedParams } from '@/hooks/useMasterDataListStatusPagedParams';
import { ADMIN_TYPE } from '@/constants/strings';
import { AdminTypeResponse } from '@/types/adminType';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  fetchAdminTypes,
  removeAdminType,
  searchAdminTypesThunk,
} from '@/store/slices/adminTypeSlice';
import { SMSAdminTypeCard } from '@/components/smsmolecules/SMSAdminTypeCard';
import { SMSMasterDataShortLongStatusList } from '@/components/smsorganisms';
import './AdminTypeList.css';

export interface AdminTypeListProps {
  className?: string;
}

export const AdminTypeList: React.FC<AdminTypeListProps> = ({
  className = '',
}) => {
  const dispatch = useAppDispatch();
  const { adminTypes, isLoading, totalItems: totalItemsFromStore } = useAppSelector((state) => state.adminType);
  const pagination = usePagination();
  const { statusFilter, handleStatusFilterChange, isActiveParam } = useMasterDataListStatusPagedParams(pagination);
  const [adminTypeUrlFilters, , setAdminTypeFilters] = useUrlFilters(['search']);
  const adminTypeSearchFromUrl = adminTypeUrlFilters.search ?? '';
  const [localSearch, setLocalSearch] = useState(adminTypeSearchFromUrl);
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
      dispatch(searchAdminTypesThunk(params));
    } else {
      dispatch(fetchAdminTypes(params));
    }
  }, [dispatch, pagination.currentPage, pagination.pageSize, isActiveParam, debouncedSearch]);

  useEffect(() => {
    refetchList();
  }, [refetchList]);

  useEffect(() => {
    pagination.setTotalItems(totalItemsFromStore);
  }, [totalItemsFromStore, pagination.setTotalItems]);

  useEffect(() => {
    setLocalSearch(adminTypeSearchFromUrl);
  }, [adminTypeSearchFromUrl]);

  useEffect(() => {
    if (debouncedSearch !== adminTypeSearchFromUrl) {
      pagination.goToFirstPage();
      setAdminTypeFilters({ search: debouncedSearch === '' ? undefined : debouncedSearch });
    }
  }, [debouncedSearch, adminTypeSearchFromUrl, pagination, setAdminTypeFilters]);

  return (
    <SMSMasterDataShortLongStatusList<AdminTypeResponse>
      className={`admin-type-list ${className}`.trim()}
      strings={{
        TITLE: ADMIN_TYPE.TITLE,
        EDIT_TITLE: ADMIN_TYPE.EDIT_TITLE,
        TABLE: {
          TITLE: ADMIN_TYPE.TABLE.TITLE,
          NO_DATA: ADMIN_TYPE.TABLE.NO_DATA,
          FILTERS: ADMIN_TYPE.TABLE.FILTERS,
          COLUMNS: {
            TITLE: ADMIN_TYPE.TABLE.COLUMNS.TITLE,
            DESCRIPTION: ADMIN_TYPE.TABLE.COLUMNS.DESCRIPTION,
            STATUS: ADMIN_TYPE.TABLE.COLUMNS.STATUS,
            CREATED_BY: ADMIN_TYPE.TABLE.COLUMNS.CREATED_BY,
            EDITED_BY: ADMIN_TYPE.TABLE.COLUMNS.EDITED_BY,
            ACTION: ADMIN_TYPE.TABLE.COLUMNS.ACTION,
          },
        },
        BUTTON: {
          ADD_NEW: ADMIN_TYPE.BUTTON.ADD_NEW,
          EDIT: ADMIN_TYPE.BUTTON.EDIT,
          DELETE: ADMIN_TYPE.BUTTON.DELETE,
        },
        CONFIRM: {
          DELETE_TITLE: ADMIN_TYPE.CONFIRM.DELETE_TITLE,
          DELETE_MESSAGE: ADMIN_TYPE.CONFIRM.DELETE_MESSAGE,
          DELETE_CONFIRM: ADMIN_TYPE.CONFIRM.DELETE_CONFIRM,
          DELETE_CANCEL: ADMIN_TYPE.CONFIRM.DELETE_CANCEL,
        },
      }}
      controlledStatusFilter={statusFilter}
      onControlledStatusFilterChange={handleStatusFilterChange}
      items={adminTypes}
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
          removeAdminType({
            id: row.adminTypeID,
            name:
              (row.adminTypeShort ?? row.adminTypeLong ?? '').trim() ||
              'this admin type',
          })
        ).unwrap();
      }}
      FormComponent={SMSAdminTypeCard}
      getShort={(r) => r.adminTypeShort}
      getLong={(r) => r.adminTypeLong}
      getStatus={(r) => Boolean(r.adminTypeStatus)}
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


