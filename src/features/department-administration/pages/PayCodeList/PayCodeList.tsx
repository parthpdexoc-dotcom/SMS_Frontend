import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { useDebounce } from '@/hooks/useDebounceSearch';
import { usePagination } from '@/hooks/usePagination';
import { useMasterDataListStatusPagedParams } from '@/hooks/useMasterDataListStatusPagedParams';
import { PAY_CODE } from '@/constants/strings';
import { PayCodeResponse } from '@/types/payCode';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchPayCodes, removePayCode, searchPayCodesThunk } from '@/store/slices/payCodeSlice';
import { SMSPayCodeForm } from '@/components/smsmolecules/SMSPayCodeForm/SMSPayCodeForm';
import { SMSMasterDataShortLongStatusList } from '@/components/smsorganisms';

const BASE = '/employee/pay-code';

export interface PayCodeListProps {
  className?: string;
}

export const PayCodeList: React.FC<PayCodeListProps> = ({ className = '' }) => {
  const dispatch = useAppDispatch();
  const { payCodes, isLoading, totalItems: totalItemsFromStore } = useAppSelector((state) => state.payCode);
  const pagination = usePagination();
  const location = useLocation();
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id?: string }>();
  const [urlFilters, , setSearchFilters] = useUrlFilters(['search']);
  const searchFromUrl = urlFilters.search ?? '';
  const [localSearch, setLocalSearch] = useState(searchFromUrl);
  const debouncedSearch = useDebounce(localSearch, 500);

  // Server-side status filtering using the same pattern as other lists
  const { statusFilter, handleStatusFilterChange, isActiveParam } = useMasterDataListStatusPagedParams(pagination);

  const refetchList = useCallback(() => {
    const searchTerm = debouncedSearch.trim();
    const params = {
      page: pagination.currentPage,
      pageSize: pagination.pageSize,
      ...(isActiveParam !== undefined ? { isActive: isActiveParam } : {}),
      ...(searchTerm ? { searchTerm } : {}),
    };
    if (searchTerm.length > 0) {
      dispatch(searchPayCodesThunk(params));
    } else {
      dispatch(fetchPayCodes(params));
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
    <SMSMasterDataShortLongStatusList<PayCodeResponse>
      className={className}
      getId={(r) => r.payCodeID}
      openModal={openModal}
      onOpenAdd={() => navigate(`${BASE}/add`)}
      onOpenEdit={(id) => navigate(`${BASE}/edit/${id}`)}
      onModalClose={() => navigate(BASE)}
      controlledStatusFilter={statusFilter}
      onControlledStatusFilterChange={handleStatusFilterChange}
      strings={{
        TITLE: PAY_CODE.TITLE,
        EDIT_TITLE: PAY_CODE.EDIT_TITLE,
        TABLE: {
          TITLE: PAY_CODE.TABLE.TITLE,
          NO_DATA: PAY_CODE.TABLE.NO_DATA,
          FILTERS: PAY_CODE.TABLE.FILTERS,
          COLUMNS: {
            TITLE: PAY_CODE.TABLE.COLUMNS.TITLE,
            DESCRIPTION: PAY_CODE.TABLE.COLUMNS.DESCRIPTION,
            STATUS: PAY_CODE.TABLE.COLUMNS.STATUS,
            CREATED_BY: PAY_CODE.TABLE.COLUMNS.CREATED_BY,
            EDITED_BY: PAY_CODE.TABLE.COLUMNS.EDITED_BY,
            ACTION: PAY_CODE.TABLE.COLUMNS.ACTION,
          },
        },
        BUTTON: {
          ADD_NEW: PAY_CODE.BUTTON.ADD_NEW,
          EDIT: PAY_CODE.BUTTON.EDIT,
          DELETE: PAY_CODE.BUTTON.DELETE,
        },
        CONFIRM: {
          DELETE_TITLE: PAY_CODE.CONFIRM.DELETE_TITLE,
          DELETE_MESSAGE: PAY_CODE.CONFIRM.DELETE_MESSAGE,
          DELETE_CONFIRM: PAY_CODE.CONFIRM.DELETE_CONFIRM,
          DELETE_CANCEL: PAY_CODE.CONFIRM.DELETE_CANCEL,
        },
      }}
      items={payCodes}
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
          removePayCode({
            id: row.payCodeID,
            name: (row.payCodeValue ?? row.payCodeDescription ?? '').trim() || 'this pay code',
          })
        ).unwrap();
      }}
      FormComponent={SMSPayCodeForm}
      getShort={(r) => r.payCodeValue}
      getLong={(r) => r.payCodeDescription}
      getStatus={(r) => Boolean(r.payCodeStatus)}
      getCreatedBy={(r) => r.createdBy}
      getCreatedDate={(r) => r.createdDate}
      getEditedBy={(r) => r.editedBy}
      getEditedDate={(r) => r.editedDate}
      showAuditColumns={false}
      showStatusColumn={true}
      enableStatusFilter={true}
      searchValue={localSearch}
      onSearchChange={setLocalSearch}
    />
  );
};

