import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { usePagination } from '@/hooks/usePagination';
import { useMasterDataListStatusPagedParams } from '@/hooks/useMasterDataListStatusPagedParams';
import { useDebounce } from '@/hooks/useDebounceSearch';
import { EQUIPMENT_TYPE } from '@/constants/strings';
import { EquipmentTypeResponse } from '@/types/equipmentType';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchEquipmentTypes, removeEquipmentType, searchEquipmentTypesThunk } from '@/store/slices/equipmentTypeSlice';
import { EquipmentTypeForm } from '@/components/smsmolecules/EquipmentTypeForm';
import { SMSMasterDataShortLongStatusList } from '@/components/smsorganisms';

const BASE = '/admin/equipment-type';

export interface EquipmentTypeListProps {
  className?: string;
}

export const EquipmentTypeList: React.FC<EquipmentTypeListProps> = ({ className = '' }) => {
  const dispatch = useAppDispatch();
  const { equipmentTypes, isLoading, totalItems: totalItemsFromStore } = useAppSelector((state) => state.equipmentType);
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
      dispatch(searchEquipmentTypesThunk(params));
    } else {
      dispatch(fetchEquipmentTypes(params));
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
    <SMSMasterDataShortLongStatusList<EquipmentTypeResponse>
      className={className}
      getId={(r) => r.equipementTypeID}
      openModal={openModal}
      onOpenAdd={() => navigate(`${BASE}/add`)}
      onOpenEdit={(id) => navigate(`${BASE}/edit/${id}`)}
      onModalClose={() => navigate(BASE)}
      strings={{
        TITLE: EQUIPMENT_TYPE.TITLE,
        EDIT_TITLE: EQUIPMENT_TYPE.EDIT_TITLE,
        TABLE: {
          TITLE: EQUIPMENT_TYPE.TABLE.TITLE,
          NO_DATA: EQUIPMENT_TYPE.TABLE.NO_DATA,
          FILTERS: EQUIPMENT_TYPE.TABLE.FILTERS,
          COLUMNS: {
            TITLE: EQUIPMENT_TYPE.TABLE.COLUMNS.TITLE,
            DESCRIPTION: EQUIPMENT_TYPE.TABLE.COLUMNS.DESCRIPTION,
            STATUS: EQUIPMENT_TYPE.TABLE.COLUMNS.STATUS,
            CREATED_BY: EQUIPMENT_TYPE.TABLE.COLUMNS.CREATED_BY,
            EDITED_BY: EQUIPMENT_TYPE.TABLE.COLUMNS.EDITED_BY,
            ACTION: EQUIPMENT_TYPE.TABLE.COLUMNS.ACTION,
          },
        },
        BUTTON: {
          ADD_NEW: EQUIPMENT_TYPE.BUTTON.ADD_NEW,
          EDIT: EQUIPMENT_TYPE.BUTTON.EDIT,
          DELETE: EQUIPMENT_TYPE.BUTTON.DELETE,
        },
        CONFIRM: {
          DELETE_TITLE: EQUIPMENT_TYPE.CONFIRM.DELETE_TITLE,
          DELETE_MESSAGE: EQUIPMENT_TYPE.CONFIRM.DELETE_MESSAGE,
          DELETE_CONFIRM: EQUIPMENT_TYPE.CONFIRM.DELETE_CONFIRM,
          DELETE_CANCEL: EQUIPMENT_TYPE.CONFIRM.DELETE_CANCEL,
        },
      }}
      controlledStatusFilter={statusFilter}
      onControlledStatusFilterChange={handleStatusFilterChange}
      items={equipmentTypes}
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
          removeEquipmentType({ id: row.equipementTypeID, name: row.equipementTypeShort })
        ).unwrap();
      }}
      FormComponent={EquipmentTypeForm}
      getShort={(r) => r.equipementTypeShort}
      getLong={(r) => r.equipementTypeLong}
      getStatus={(r) => Boolean(r.equipementTypeStatus)}
      getCreatedBy={(r) => r.createdBy}
      getCreatedDate={(r) => r.createdDate}
      getEditedBy={(r) => r.editedBy}
      getEditedDate={(r) => r.editedDate}
      extraColumns={[
        {
          key: 'isVehicle',
          label: EQUIPMENT_TYPE.TABLE.COLUMNS.IS_VEHICLE,
          render: (_value: unknown, row: EquipmentTypeResponse) => (row.isVehicle ? 'Yes' : 'No'),
          mutedWhenInactive: true,
        },
      ]}
      showAuditColumns={false}
      searchValue={localSearch}
      onSearchChange={setLocalSearch}
    />
  );
};


