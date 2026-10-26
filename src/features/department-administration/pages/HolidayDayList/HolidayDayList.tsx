import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { usePagination } from '@/hooks/usePagination';
import { useMasterDataListStatusPagedParams } from '@/hooks/useMasterDataListStatusPagedParams';
import { useDebounce } from '@/hooks/useDebounceSearch';
import { HOLIDAY_DAY } from '@/constants/holidayDayStrings';
import { HolidayDayListProps, HolidayDayResponse } from '@/types/holidayDay';
import { HolidayDayForm } from '@/components/smsmolecules/HolidayDayForm';
import { SMSMasterDataShortLongStatusList } from '@/components/smsorganisms';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchHolidayDays, removeHolidayDay, searchHolidayDaysThunk } from '@/store/slices/holidayDaySlice';
import { formatDateShort } from '@/utils';

const BASE = '/admin/holiday-day';

export const HolidayDayList: React.FC<HolidayDayListProps> = ({ className = '' }) => {
  const dispatch = useAppDispatch();
  const { holidayDays, isLoading, totalItems: totalItemsFromStore } = useAppSelector((state) => state.holidayDay);
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
      dispatch(searchHolidayDaysThunk(params));
    } else {
      dispatch(fetchHolidayDays(params));
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

  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '-';
    const dateValue = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    return formatDateShort(dateValue);
  };

  return (
    <SMSMasterDataShortLongStatusList<HolidayDayResponse>
      className={className}
      getId={(r) => r.holidayDayID}
      openModal={openModal}
      onOpenAdd={() => navigate(`${BASE}/add`)}
      onOpenEdit={(id) => navigate(`${BASE}/edit/${id}`)}
      onModalClose={() => navigate(BASE)}
      strings={{
        TITLE: HOLIDAY_DAY.TITLE,
        EDIT_TITLE: HOLIDAY_DAY.EDIT_TITLE,
        TABLE: {
          TITLE: HOLIDAY_DAY.TABLE.TITLE,
          NO_DATA: HOLIDAY_DAY.TABLE.NO_DATA,
          FILTERS: HOLIDAY_DAY.TABLE.FILTERS,
          COLUMNS: {
            TITLE: HOLIDAY_DAY.TABLE.COLUMNS.TITLE,
            DESCRIPTION: HOLIDAY_DAY.TABLE.COLUMNS.DESCRIPTION,
            STATUS: HOLIDAY_DAY.TABLE.COLUMNS.STATUS,
            CREATED_BY: HOLIDAY_DAY.TABLE.COLUMNS.CREATED_BY,
            EDITED_BY: HOLIDAY_DAY.TABLE.COLUMNS.EDITED_BY,
            ACTION: HOLIDAY_DAY.TABLE.COLUMNS.ACTION,
          },
        },
        BUTTON: {
          ADD_NEW: HOLIDAY_DAY.BUTTON.ADD_NEW,
          EDIT: HOLIDAY_DAY.BUTTON.EDIT,
          DELETE: HOLIDAY_DAY.BUTTON.DELETE,
        },
        CONFIRM: {
          DELETE_TITLE: HOLIDAY_DAY.CONFIRM.DELETE_TITLE,
          DELETE_MESSAGE: HOLIDAY_DAY.CONFIRM.DELETE_MESSAGE,
          DELETE_CONFIRM: HOLIDAY_DAY.CONFIRM.DELETE_CONFIRM,
          DELETE_CANCEL: HOLIDAY_DAY.CONFIRM.DELETE_CANCEL,
        },
      }}
      controlledStatusFilter={statusFilter}
      onControlledStatusFilterChange={handleStatusFilterChange}
      items={holidayDays}
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
          removeHolidayDay({
            id: row.holidayDayID,
            name: (row.name ?? '').trim() || 'this holiday day',
          })
        ).unwrap();
      }}
      FormComponent={HolidayDayForm}
      getShort={(r) => r.name ?? ''}
      getLong={(r) => formatDate(r.date)}
      getStatus={(r) => Boolean(r.isActive)}
      getCreatedBy={(r) => r.nameOfUserAddingRecord ?? null}
      getCreatedDate={(r) => r.recordAddedDateTimeStamp ?? null}
      getEditedBy={(r) => r.userNameEditingRecord ?? null}
      getEditedDate={(r) => r.editDate ?? null}
      extraColumns={[
        {
          key: 'isPremiumRate',
          label: HOLIDAY_DAY.TABLE.COLUMNS.IS_PREMIUM_RATE,
          render: (_value: unknown, row: HolidayDayResponse) =>
            row.isPremiumRate ? 'Yes' : 'No',
          mutedWhenInactive: true,
        },
        {
          key: 'payPremiumForEntireShift',
          label: HOLIDAY_DAY.TABLE.COLUMNS.PAY_PREMIUM_ENTIRE_SHIFT,
          render: (_value: unknown, row: HolidayDayResponse) =>
            row.payPremiumForEntireShift ? 'Yes' : 'No',
          mutedWhenInactive: true,
        },
      ]}
      showAuditColumns={false}
      searchValue={localSearch}
      onSearchChange={setLocalSearch}
    />
  );
};
