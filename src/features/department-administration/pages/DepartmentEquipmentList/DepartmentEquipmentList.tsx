import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { usePagination } from '@/hooks/usePagination';
import { useMasterDataListStatusPagedParams } from '@/hooks/useMasterDataListStatusPagedParams';
import { useDebounce } from '@/hooks/useDebounceSearch';
import { DEPARTMENT_EQUIPMENT } from '@/constants/strings';
import { DepartmentEquipmentResponse } from '@/types/departmentEquipment';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  fetchDepartmentEquipments,
  removeDepartmentEquipment,
  searchDepartmentEquipmentsThunk,
} from '@/store/slices/departmentEquipmentSlice';
import { fetchActiveEquipmentTypes } from '@/store/slices/equipmentTypeSlice';
import { SMSDepartmentEquipmentForm } from '@/components/smsmolecules/SMSDepartmentEquipmentForm';
import { SMSMasterDataShortLongStatusList } from '@/components/smsorganisms';
import { formatCurrency } from '@/utils/formatters';

const BASE = '/employee/department-equipment';

export interface DepartmentEquipmentListProps {
  className?: string;
}

export const DepartmentEquipmentList: React.FC<DepartmentEquipmentListProps> = ({
  className = '',
}) => {
  const dispatch = useAppDispatch();
  const { departmentEquipments, isLoading, totalItems: totalItemsFromStore } = useAppSelector(
    (state) => state.departmentEquipment
  );
  const pagination = usePagination();
  const { statusFilter, handleStatusFilterChange, isActiveParam } = useMasterDataListStatusPagedParams(pagination);
  const { activeEquipmentTypes } = useAppSelector((state) => state.equipmentType);
  const location = useLocation();
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id?: string }>();
  const [urlFilters, , setSearchFilters] = useUrlFilters(['search']);
  const searchFromUrl = urlFilters.search ?? '';
  const [localSearch, setLocalSearch] = useState(searchFromUrl);
  const debouncedSearch = useDebounce(localSearch, 500);

  const assignedEquipmentTypeIds = useMemo(
    () =>
      departmentEquipments
        .map((row) => String(row.equipmentTypeID ?? '').trim())
        .filter(Boolean),
    [departmentEquipments]
  );

  useEffect(() => {
    dispatch(fetchActiveEquipmentTypes(undefined));
  }, [dispatch]);

  const refetchList = useCallback(() => {
    const searchTerm = debouncedSearch.trim();
    const params = {
      page: pagination.currentPage,
      pageSize: pagination.pageSize,
      ...(isActiveParam !== undefined ? { isActive: isActiveParam } : {}),
      ...(searchTerm ? { searchTerm } : {}),
    };
    if (searchTerm.length > 0) {
      dispatch(searchDepartmentEquipmentsThunk(params));
    } else {
      dispatch(fetchDepartmentEquipments(params));
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

  const getEquipmentTypeName = (equipmentTypeID: string, fallbackFromRow?: string | null): string => {
    const equipmentType = activeEquipmentTypes.find((et) => et.equipementTypeID === equipmentTypeID);
    const fromLookup = equipmentType?.equipementTypeShort || equipmentType?.equipementTypeLong;
    const fromApi = typeof fallbackFromRow === 'string' ? fallbackFromRow.trim() : '';
    return fromLookup || fromApi || 'Unknown';
  };

  const DepartmentEquipmentFormWithFilter = useMemo(
    () =>
      function DepartmentEquipmentFormWithFilter(
        props: React.ComponentProps<typeof SMSDepartmentEquipmentForm>
      ) {
        return (
          <SMSDepartmentEquipmentForm
            {...props}
            assignedEquipmentTypeIds={assignedEquipmentTypeIds}
          />
        );
      },
    [assignedEquipmentTypeIds]
  );

  return (
    <SMSMasterDataShortLongStatusList<DepartmentEquipmentResponse>
      className={className}
      getId={(r) => r.departmentEquipmentID}
      openModal={openModal}
      onOpenAdd={() => navigate(`${BASE}/add`)}
      onOpenEdit={(id) => navigate(`${BASE}/edit/${id}`)}
      onModalClose={() => navigate(BASE)}
      strings={{
        TITLE: DEPARTMENT_EQUIPMENT.TITLE,
        EDIT_TITLE: DEPARTMENT_EQUIPMENT.EDIT_TITLE,
        TABLE: {
          TITLE: DEPARTMENT_EQUIPMENT.TABLE.TITLE,
          NO_DATA: DEPARTMENT_EQUIPMENT.TABLE.NO_DATA,
          FILTERS: DEPARTMENT_EQUIPMENT.TABLE.FILTERS,
          COLUMNS: {
            TITLE: DEPARTMENT_EQUIPMENT.TABLE.COLUMNS.EQUIPMENT_TYPE,
            DESCRIPTION: DEPARTMENT_EQUIPMENT.TABLE.COLUMNS.CHARGE,
            STATUS: DEPARTMENT_EQUIPMENT.TABLE.COLUMNS.STATUS,
            CREATED_BY: DEPARTMENT_EQUIPMENT.TABLE.COLUMNS.CREATED_BY,
            EDITED_BY: DEPARTMENT_EQUIPMENT.TABLE.COLUMNS.EDITED_BY,
            ACTION: DEPARTMENT_EQUIPMENT.TABLE.COLUMNS.ACTION,
          },
        },
        BUTTON: {
          ADD_NEW: DEPARTMENT_EQUIPMENT.BUTTON.ADD_NEW,
          EDIT: DEPARTMENT_EQUIPMENT.BUTTON.EDIT,
          DELETE: DEPARTMENT_EQUIPMENT.BUTTON.DELETE,
        },
        CONFIRM: {
          DELETE_TITLE: DEPARTMENT_EQUIPMENT.CONFIRM.DELETE_TITLE,
          DELETE_MESSAGE: DEPARTMENT_EQUIPMENT.CONFIRM.DELETE_MESSAGE,
          DELETE_CONFIRM: DEPARTMENT_EQUIPMENT.CONFIRM.DELETE_CONFIRM,
          DELETE_CANCEL: DEPARTMENT_EQUIPMENT.CONFIRM.DELETE_CANCEL,
        },
      }}
      controlledStatusFilter={statusFilter}
      onControlledStatusFilterChange={handleStatusFilterChange}
      extraColumns={[
        {
          key: 'isDefault',
          label: DEPARTMENT_EQUIPMENT.TABLE.COLUMNS.IS_DEFAULT,
          render: (value) => (
            <span className={value ? 'text-success' : 'text-muted'}>
              {value ? 'Yes' : 'No'}
            </span>
          ),
        },
      ]}
      items={departmentEquipments}
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
        const equipmentName = getEquipmentTypeName(row.equipmentTypeID, row.equipmentType);
        await dispatch(
          removeDepartmentEquipment({
            id: row.departmentEquipmentID,
            name: equipmentName || 'this department equipment',
          })
        ).unwrap();
      }}
      FormComponent={DepartmentEquipmentFormWithFilter}
      getShort={(r) => getEquipmentTypeName(r.equipmentTypeID, r.equipmentType)}
      getLong={(r) => formatCurrency(r.charge)}
      getStatus={(r) => Boolean(r.equipmentStatus)}
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

