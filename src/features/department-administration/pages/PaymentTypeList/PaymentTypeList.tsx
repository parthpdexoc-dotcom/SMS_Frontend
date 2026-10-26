import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { usePagination } from '@/hooks/usePagination';
import { useDebounce } from '@/hooks/useDebounceSearch';
import { PAYMENT_TYPE_MASTER } from '@/constants/strings';
import { PaymentTypeResponse } from '@/types/paymentType';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  fetchPaymentTypes,
  removePaymentType,
  searchPaymentTypesThunk,
} from '@/store/slices/paymentTypeSlice';
import { PaymentTypeForm } from '@/components/smsmolecules/PaymentTypeForm';
import { SMSMasterDataShortLongStatusList } from '@/components/smsorganisms';

const BASE = '/admin/payment-type';

export interface PaymentTypeListProps {
  className?: string;
}

export const PaymentTypeList: React.FC<PaymentTypeListProps> = ({ className = '' }) => {
  const dispatch = useAppDispatch();
  const { paymentTypes, isLoading, totalItems: totalItemsFromStore } = useAppSelector(
    (state) => state.paymentType
  );
  const pagination = usePagination();
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
      ...(searchTerm ? { searchTerm } : {}),
    };

    if (searchTerm.length > 0) {
      dispatch(searchPaymentTypesThunk(params));
    } else {
      dispatch(fetchPaymentTypes(params));
    }
  }, [dispatch, pagination.currentPage, pagination.pageSize, debouncedSearch]);

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
    <SMSMasterDataShortLongStatusList<PaymentTypeResponse>
      className={className}
      getId={(r) => r.paymentTypeId}
      openModal={openModal}
      onOpenAdd={() => navigate(`${BASE}/add`)}
      onOpenEdit={(id) => navigate(`${BASE}/edit/${id}`)}
      onModalClose={() => navigate(BASE)}
      strings={{
        TITLE: PAYMENT_TYPE_MASTER.TITLE,
        EDIT_TITLE: PAYMENT_TYPE_MASTER.EDIT_TITLE,
        TABLE: {
          TITLE: PAYMENT_TYPE_MASTER.TABLE.TITLE,
          NO_DATA: PAYMENT_TYPE_MASTER.TABLE.NO_DATA,
          FILTERS: PAYMENT_TYPE_MASTER.TABLE.FILTERS,
          COLUMNS: {
            TITLE: PAYMENT_TYPE_MASTER.TABLE.COLUMNS.NAME,
            DESCRIPTION: PAYMENT_TYPE_MASTER.TABLE.COLUMNS.DESCRIPTION,
            STATUS: PAYMENT_TYPE_MASTER.TABLE.COLUMNS.DEFAULT,
            CREATED_BY: PAYMENT_TYPE_MASTER.TABLE.COLUMNS.CREATED_BY,
            EDITED_BY: PAYMENT_TYPE_MASTER.TABLE.COLUMNS.EDITED_BY,
            ACTION: PAYMENT_TYPE_MASTER.TABLE.COLUMNS.ACTION,
          },
        },
        BUTTON: {
          ADD_NEW: PAYMENT_TYPE_MASTER.BUTTON.ADD_NEW,
          EDIT: PAYMENT_TYPE_MASTER.BUTTON.EDIT,
          DELETE: PAYMENT_TYPE_MASTER.BUTTON.DELETE,
        },
        CONFIRM: {
          DELETE_TITLE: PAYMENT_TYPE_MASTER.CONFIRM.DELETE_TITLE,
          DELETE_MESSAGE: PAYMENT_TYPE_MASTER.CONFIRM.DELETE_MESSAGE,
          DELETE_CONFIRM: PAYMENT_TYPE_MASTER.CONFIRM.DELETE_CONFIRM,
          DELETE_CANCEL: PAYMENT_TYPE_MASTER.CONFIRM.DELETE_CANCEL,
        },
      }}
      enableStatusFilter={false}
      items={paymentTypes}
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
          removePaymentType({
            id: row.paymentTypeId,
            name: (row.name ?? '').trim() || 'this payment type',
          })
        ).unwrap();
      }}
      FormComponent={PaymentTypeForm}
      getShort={(r) => r.name}
      getLong={() => ''}
      getStatus={(r) => Boolean(r.isDefault)}
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
