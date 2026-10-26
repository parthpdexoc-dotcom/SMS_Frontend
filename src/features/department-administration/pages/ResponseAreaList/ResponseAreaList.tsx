import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { usePagination } from '@/hooks/usePagination';
import { useMasterDataListStatusPagedParams } from '@/hooks/useMasterDataListStatusPagedParams';
import { useDebounce } from '@/hooks/useDebounceSearch';
import { RESPONSE_AREA } from '@/constants/strings';
import { ResponseAreaResponse } from '@/types/responseArea';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchResponseAreas, removeResponseArea, searchResponseAreasThunk } from '@/store/slices/responseAreaSlice';
import { ResponseAreaForm } from '@/components/smsmolecules/ResponseAreaForm';
import { SMSMasterDataShortLongStatusList } from '@/components/smsorganisms';

const BASE = '/employee/response-area';

export interface ResponseAreaListProps {
  className?: string;
}

export const ResponseAreaList: React.FC<ResponseAreaListProps> = ({ className = '' }) => {
  const dispatch = useAppDispatch();
  const { responseAreas, isLoading: isLoadingResponseAreas, totalItems: totalItemsFromStore } = useAppSelector(
    (state) => state.responseArea
  );
  const location = useLocation();
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id?: string }>();
  const [urlFilters, , setSearchFilters] = useUrlFilters(['search']);
  const searchFromUrl = urlFilters.search ?? '';
  const [localSearch, setLocalSearch] = useState(searchFromUrl);
  const debouncedSearch = useDebounce(localSearch, 500);
  const pagination = usePagination();
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
      dispatch(searchResponseAreasThunk(params));
    } else {
      dispatch(fetchResponseAreas(params));
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
    <SMSMasterDataShortLongStatusList<ResponseAreaResponse>
      className={className}
      openModal={openModal}
      onOpenAdd={() => navigate(`${BASE}/add`)}
      onOpenEdit={(id) => navigate(`${BASE}/edit/${id}`)}
      onModalClose={() => navigate(BASE)}
      strings={{
        TITLE: RESPONSE_AREA.TITLE,
        EDIT_TITLE: RESPONSE_AREA.EDIT_TITLE,
        TABLE: {
          TITLE: RESPONSE_AREA.TABLE.TITLE,
          NO_DATA: RESPONSE_AREA.TABLE.NO_DATA,
          FILTERS: RESPONSE_AREA.TABLE.FILTERS,
          COLUMNS: {
            TITLE: RESPONSE_AREA.TABLE.COLUMNS.TITLE,
            DESCRIPTION: RESPONSE_AREA.TABLE.COLUMNS.DESCRIPTION,
            STATUS: RESPONSE_AREA.TABLE.COLUMNS.STATUS,
            CREATED_BY: RESPONSE_AREA.TABLE.COLUMNS.CREATED_BY,
            EDITED_BY: RESPONSE_AREA.TABLE.COLUMNS.EDITED_BY,
            ACTION: RESPONSE_AREA.TABLE.COLUMNS.ACTION,
          },
        },
        BUTTON: {
          ADD_NEW: RESPONSE_AREA.BUTTON.ADD_NEW,
          EDIT: RESPONSE_AREA.BUTTON.EDIT,
          DELETE: RESPONSE_AREA.BUTTON.DELETE,
        },
        CONFIRM: {
          DELETE_TITLE: RESPONSE_AREA.CONFIRM.DELETE_TITLE,
          DELETE_MESSAGE: RESPONSE_AREA.CONFIRM.DELETE_MESSAGE,
          DELETE_CONFIRM: RESPONSE_AREA.CONFIRM.DELETE_CONFIRM,
          DELETE_CANCEL: RESPONSE_AREA.CONFIRM.DELETE_CANCEL,
        },
      }}
      items={responseAreas}
      loading={isLoadingResponseAreas}
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
      controlledStatusFilter={statusFilter}
      onControlledStatusFilterChange={handleStatusFilterChange}
      onDelete={async (row) => {
        await dispatch(
          removeResponseArea({
            id: row.responseAreaID,
            name:
              (row.responseAreaShort ?? row.responseAreaLong ?? '').trim() ||
              'this response area',
          })
        ).unwrap();
      }}
      FormComponent={ResponseAreaForm}
      getId={(r) => r.responseAreaID}
      getShort={(r) => r.responseAreaShort}
      getLong={(r) => r.responseAreaLong}
      getStatus={(r) => Boolean(r.responseAreaStatus)}
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
