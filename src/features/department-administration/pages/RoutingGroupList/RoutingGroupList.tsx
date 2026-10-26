import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { usePagination } from '@/hooks/usePagination';
import { useMasterDataListStatusPagedParams } from '@/hooks/useMasterDataListStatusPagedParams';
import { useDebounce } from '@/hooks/useDebounceSearch';
import { ROUTING_GROUP } from '@/constants/strings';
import { RoutingGroupResponse } from '@/types/routingGroup';
import { ApprovalType } from '@/types/vehicleApproval';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchRoutingGroups, removeRoutingGroup, searchRoutingGroupsThunk } from '@/store/slices/routingGroupSlice';
import { RoutingGroupForm } from '@/components/smsmolecules/RoutingGroupForm';
import { SMSMasterDataShortLongStatusList } from '@/components/smsorganisms';

const BASE = '/admin/routing-group';

export interface RoutingGroupListProps {
  className?: string;
}

export const RoutingGroupList: React.FC<RoutingGroupListProps> = ({ className = '' }) => {
  const dispatch = useAppDispatch();
  const { routingGroups, isLoading, totalItems: totalItemsFromStore } = useAppSelector((state) => state.routingGroup);
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
      dispatch(searchRoutingGroupsThunk(params));
    } else {
      dispatch(fetchRoutingGroups(params));
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
    <SMSMasterDataShortLongStatusList<RoutingGroupResponse>
      className={className}
      getId={(r) => r.routingGroupId}
      openModal={openModal}
      onOpenAdd={() => navigate(`${BASE}/add`)}
      onOpenEdit={(id) => navigate(`${BASE}/edit/${id}`)}
      onModalClose={() => navigate(BASE)}
      strings={{
        TITLE: ROUTING_GROUP.TITLE,
        EDIT_TITLE: ROUTING_GROUP.EDIT_TITLE,
        TABLE: {
          TITLE: ROUTING_GROUP.TABLE.TITLE,
          NO_DATA: ROUTING_GROUP.TABLE.NO_DATA,
          FILTERS: ROUTING_GROUP.TABLE.FILTERS,
          COLUMNS: {
            TITLE: ROUTING_GROUP.TABLE.COLUMNS.TITLE,
            DESCRIPTION: ROUTING_GROUP.TABLE.COLUMNS.DESCRIPTION,
            STATUS: ROUTING_GROUP.TABLE.COLUMNS.STATUS,
            CREATED_BY: ROUTING_GROUP.TABLE.COLUMNS.CREATED_BY,
            EDITED_BY: ROUTING_GROUP.TABLE.COLUMNS.EDITED_BY,
            ACTION: ROUTING_GROUP.TABLE.COLUMNS.ACTION,
          },
        },
        BUTTON: {
          ADD_NEW: ROUTING_GROUP.BUTTON.ADD_NEW,
          EDIT: ROUTING_GROUP.BUTTON.EDIT,
          DELETE: ROUTING_GROUP.BUTTON.DELETE,
        },
        CONFIRM: {
          DELETE_TITLE: ROUTING_GROUP.CONFIRM.DELETE_TITLE,
          DELETE_MESSAGE: ROUTING_GROUP.CONFIRM.DELETE_MESSAGE,
          DELETE_CONFIRM: ROUTING_GROUP.CONFIRM.DELETE_CONFIRM,
          DELETE_CANCEL: ROUTING_GROUP.CONFIRM.DELETE_CANCEL,
        },
      }}
      items={routingGroups}
      loading={isLoading}
      controlledStatusFilter={statusFilter}
      onControlledStatusFilterChange={handleStatusFilterChange}
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
          removeRoutingGroup({
            id: row.routingGroupId,
            name:
              (row.approverShort ?? row.approverLong ?? '').trim() ||
              'this routing group',
          })
        ).unwrap();
      }}
      FormComponent={RoutingGroupForm}
      getShort={(r) => r.approverShort || ''}
      getLong={(r) => r.approverLong || ''}
      getStatus={(r) => Boolean(r.approverStatus)}
      getCreatedBy={(r) => r.createdBy}
      getCreatedDate={(r) => r.createdDate}
      getEditedBy={(r) => r.editedBy}
      getEditedDate={(r) => r.editedDate}
      extraColumns={[
        {
          key: 'approvalType',
          label: ROUTING_GROUP.TABLE.COLUMNS.APPROVAL_TYPE,
          render: (_value: unknown, row: RoutingGroupResponse) =>
            row.approvalType === null || row.approvalType === undefined
              ? ROUTING_GROUP.FORM.APPROVAL_TYPE_NONE
              : row.approvalType === ApprovalType.VehicleApproval
                ? ROUTING_GROUP.FORM.APPROVAL_TYPE_VEHICLE
                : row.approvalType === ApprovalType.PremitApproval
                  ? ROUTING_GROUP.FORM.APPROVAL_TYPE_PERMIT
                  : ROUTING_GROUP.FORM.APPROVAL_TYPE_SPECIAL_EVENT,
          mutedWhenInactive: true,
        },
        {
          key: 'approverEmail',
          label: ROUTING_GROUP.TABLE.COLUMNS.EMAIL,
          render: (_value: string | null) => _value || '-',
          mutedWhenInactive: true,
        },
      ]}
      showAuditColumns={false}
      searchValue={localSearch}
      onSearchChange={setLocalSearch}
    />
  );
};
