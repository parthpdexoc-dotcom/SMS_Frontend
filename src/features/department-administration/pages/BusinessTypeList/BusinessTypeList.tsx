import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { usePagination } from '@/hooks/usePagination';
import { useMasterDataListStatusPagedParams } from '@/hooks/useMasterDataListStatusPagedParams';
import { useDebounce } from '@/hooks/useDebounceSearch';
import { BUSINESS_TYPE } from '@/constants/strings';
import { BusinessTypeResponse } from '@/types/businessType';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchBusinessTypes, removeBusinessType, searchBusinessTypesThunk } from '@/store/slices/businessTypeSlice';
import { SMSBusinessTypeForm } from '@/components/smsmolecules/SMSBusinessTypeForm';
import { SMSMasterDataShortLongStatusList } from '@/components/smsorganisms';

const BASE = '/admin/business-type';

export interface BusinessTypeListProps {
  className?: string;
}

export const BusinessTypeList: React.FC<BusinessTypeListProps> = ({ className = '' }) => {
  const dispatch = useAppDispatch();
  const { businessTypes, isLoading, totalItems: totalItemsFromStore } = useAppSelector((state) => state.businessType);
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
      dispatch(searchBusinessTypesThunk(params));
    } else {
      dispatch(fetchBusinessTypes(params));
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
    <SMSMasterDataShortLongStatusList<BusinessTypeResponse>
      className={className}
      getId={(r) => r.businessTypeID}
      openModal={openModal}
      onOpenAdd={() => navigate(`${BASE}/add`)}
      onOpenEdit={(id) => navigate(`${BASE}/edit/${id}`)}
      onModalClose={() => navigate(BASE)}
      strings={{
        TITLE: BUSINESS_TYPE.TITLE,
        EDIT_TITLE: BUSINESS_TYPE.EDIT_TITLE,
        TABLE: {
          TITLE: BUSINESS_TYPE.TABLE.TITLE,
          NO_DATA: BUSINESS_TYPE.TABLE.NO_DATA,
          FILTERS: BUSINESS_TYPE.TABLE.FILTERS,
          COLUMNS: {
            TITLE: BUSINESS_TYPE.TABLE.COLUMNS.TITLE,
            DESCRIPTION: BUSINESS_TYPE.TABLE.COLUMNS.DESCRIPTION,
            STATUS: BUSINESS_TYPE.TABLE.COLUMNS.STATUS,
            CREATED_BY: BUSINESS_TYPE.TABLE.COLUMNS.CREATED_BY,
            EDITED_BY: BUSINESS_TYPE.TABLE.COLUMNS.EDITED_BY,
            ACTION: BUSINESS_TYPE.TABLE.COLUMNS.ACTION,
          },
        },
        BUTTON: {
          ADD_NEW: BUSINESS_TYPE.BUTTON.ADD_NEW,
          EDIT: BUSINESS_TYPE.BUTTON.EDIT,
          DELETE: BUSINESS_TYPE.BUTTON.DELETE,
        },
        CONFIRM: {
          DELETE_TITLE: BUSINESS_TYPE.CONFIRM.DELETE_TITLE,
          DELETE_MESSAGE: BUSINESS_TYPE.CONFIRM.DELETE_MESSAGE,
          DELETE_CONFIRM: BUSINESS_TYPE.CONFIRM.DELETE_CONFIRM,
          DELETE_CANCEL: BUSINESS_TYPE.CONFIRM.DELETE_CANCEL,
        },
      }}
      controlledStatusFilter={statusFilter}
      onControlledStatusFilterChange={handleStatusFilterChange}
      items={businessTypes}
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
          removeBusinessType({
            id: row.businessTypeID,
            name:
              (row.businessTypeShort ?? row.businessTypeLong ?? '').trim() ||
              'this business type',
          })
        ).unwrap();
      }}
      FormComponent={SMSBusinessTypeForm}
      getShort={(r) => r.businessTypeShort}
      getLong={(r) => r.businessTypeLong}
      getStatus={(r) => Boolean(r.businessTypeStatus)}
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


