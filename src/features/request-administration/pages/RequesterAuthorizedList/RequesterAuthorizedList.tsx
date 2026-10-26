import React, { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { SMSConfirmDialog } from '@/components/smsmolecules';
import { SMSModal as Modal, SMSDataTableWrapper, type DataTableColumn } from '@/components/smsorganisms';
import { RequesterAuthorizedForm } from '@/components/smsmolecules/RequesterAuthorizedForm';
import { SearchFilter } from '@/components/smsmolecules/SearchFilter';
import {
  fetchRequesterAuthorizedList,
  createRequesterAuthorizedThunk,
  updateRequesterAuthorizedThunk,
  removeRequesterAuthorized,
  clearError,
  setPagination,
} from '@/store/slices/requesterAuthorizedSlice';
import { fetchRequesters } from '@/store/slices/requesterSlice';
import type { RequesterAuthorized, RequesterAuthorizedListProps, DisplayRequesterAuthorized } from '@/types/requesterAuthorized';
import { UserRoleType, hasRole } from '@/types/userRole';
import { PAGE_GRID_MAX_BODY_HEIGHT } from '@/constants/tablePagination';
import { REQUESTER_AUTHORIZED } from '@/constants/strings';
import { SMSButton, SMSIcon, SMSIconButton, SMSSegmentedStatusFilter } from '@/components/smsatoms';
import { Box, Stack } from '@mui/material';
import { useMasterDataListStatusPagedParams } from '@/hooks/useMasterDataListStatusPagedParams';
import { formatPhoneNumber } from '@/utils';
import './RequesterAuthorizedList.css';

export const RequesterAuthorizedList: React.FC<RequesterAuthorizedListProps> = ({ className = '' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const { list: items, isLoading, error, totalItems, currentPage, pageSize } = useAppSelector((state) => state.requesterAuthorized);
  const { requesters } = useAppSelector((state) => state.requester);
  const { user } = useAppSelector((state) => state.auth);
  const canAddRequesterAuthorized = hasRole(user?.roles, UserRoleType.DepartmentAdmin);

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [addFormInitialData, setAddFormInitialData] = useState<RequesterAuthorized | null>(null);
  const [deletingRow, setDeletingRow] = useState<RequesterAuthorized | null>(null);

  const { statusFilter, handleStatusFilterChange, isActiveParam } = useMasterDataListStatusPagedParams({ 
    currentPage, 
    pageSize, 
    goToFirstPage: () => dispatch(setPagination({ page: 1 }))
  });

  const requesterID =
    (location.state as { requesterId?: string } | null)?.requesterId ?? null;
  const requesterName = useMemo(() => {
    if (!requesterID) return undefined;
    return requesters.find((x) => x.requesterID === requesterID)?.name ?? undefined;
  }, [requesterID, requesters]);

  useEffect(() => {
    dispatch(fetchRequesterAuthorizedList({
      page: currentPage,
      pageSize,
      ...(requesterID ? { requesterId: requesterID } : {}),
      ...(isActiveParam !== undefined ? { isActive: isActiveParam } : {}),
    }));
    dispatch(fetchRequesters({ page: 1, pageSize: 500 }));
  }, [dispatch, requesterID, currentPage, pageSize, isActiveParam]);

  const requesterOptions = useMemo(() => {
    if (requesters.length === 0) return [];
    return requesters.map((r) => ({ value: r.requesterID, label: r.name || r.requesterID }));
  }, [requesters]);

  const itemsWithNames = useMemo<DisplayRequesterAuthorized[]>(() => {
    return items.map((r: RequesterAuthorized) => {
      const requesterName = requesters.find((req) => req.requesterID === r.requesterID)?.name ?? r.requesterID;
      return {
        ...r,
        requesterName,
      };
    });
  }, [items, requesters]);

  useEffect(() => {
    if (searchTerm) {
      // For search functionality, we'll need to implement server-side search
      // For now, reset to first page when searching
      dispatch(setPagination({ page: 1 }));
    }
  }, [searchTerm, dispatch]);

  const handlePageChange = (page: number) => {
    dispatch(setPagination({ page }));
  };

  const handlePageSizeChange = (newPageSize: number) => {
    dispatch(setPagination({ pageSize: newPageSize, page: 1 }));
  };

  const handleAddClick = () => {
    if (!canAddRequesterAuthorized) return;
    dispatch(clearError());
    if (requesterID) {
      setAddFormInitialData({
        requesterAuthorizedID: '',
        requesterID,
        firstName: '',
        lastName: '',
        primaryPhone: '',
        secondaryPhone: '',
        primaryEmail: '',
        secondaryEmail: '',
        status: 1,
        createdBy: null,
        editedBy: null,
        createdDate: null,
        editedDate: null,
      });
    } else {
      setAddFormInitialData(null);
    }
    setFormMode('create');
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setAddFormInitialData(null);
    dispatch(clearError());
  };

  const handleFormSuccess = async (data: RequesterAuthorized) => {
    try {
      dispatch(clearError());
      if (formMode === 'create') {
        await dispatch(
          createRequesterAuthorizedThunk({
            requesterID: data.requesterID,
            firstName: data.firstName,
            lastName: data.lastName,
            primaryPhone: data.primaryPhone,
            secondaryPhone: data.secondaryPhone,
            primaryEmail: data.primaryEmail,
            secondaryEmail: data.secondaryEmail,
            status: data.status,
          })
        ).unwrap();
      } else {
        await dispatch(
          updateRequesterAuthorizedThunk({
            requesterAuthorizedID: data.requesterAuthorizedID,
            requesterID: data.requesterID,
            firstName: data.firstName,
            lastName: data.lastName,
            primaryPhone: data.primaryPhone,
            secondaryPhone: data.secondaryPhone,
            primaryEmail: data.primaryEmail,
            secondaryEmail: data.secondaryEmail,
            status: data.status,
          })
        ).unwrap();
      }
      dispatch(fetchRequesterAuthorizedList({
        page: currentPage,
        pageSize,
        ...(requesterID ? { requesterId: requesterID } : {}),
        ...(isActiveParam !== undefined ? { isActive: isActiveParam } : {}),
      }));
      setIsModalOpen(false);
      setAddFormInitialData(null);
    } catch (error) {
      // Error is stored in Redux state and will be displayed in the form
      // Don't close modal so user can see the error
    }
  };

  const handleDeleteClick = (row: RequesterAuthorized) => setDeletingRow(row);
  const handleDeleteConfirm = async () => {
    if (!deletingRow) return;
    try {
      await dispatch(removeRequesterAuthorized(deletingRow.requesterAuthorizedID)).unwrap();
      setDeletingRow(null);
    } catch {
      // Error in slice
    }
  };
  const handleDeleteCancel = () => setDeletingRow(null);

  const handleEditClick = (row: DisplayRequesterAuthorized) => {
    dispatch(clearError());
    setFormMode('edit');
    setAddFormInitialData(row);
    setIsModalOpen(true);
  };

  
  const columns: DataTableColumn<DisplayRequesterAuthorized>[] = useMemo(() => [
    {
      key: 'fullName',
      label: REQUESTER_AUTHORIZED.TABLE.COLUMNS.FULL_NAME,
      render: (_value: unknown, row: DisplayRequesterAuthorized) => {
        const fullName = `${row.lastName || ''}, ${row.firstName || ''}`.trim();
        return fullName || '-';
      },
    },
    {
      key: 'primaryPhone',
      label: REQUESTER_AUTHORIZED.TABLE.COLUMNS.PRIMARY_PHONE,
      render: (_value: unknown, row: DisplayRequesterAuthorized) => {
        const formatted = row.primaryPhone ? formatPhoneNumber(row.primaryPhone) : '';
        return formatted || '-';
      },
    },
    {
      key: 'primaryEmail',
      label: REQUESTER_AUTHORIZED.TABLE.COLUMNS.PRIMARY_EMAIL,
      render: (_value: unknown, row: DisplayRequesterAuthorized) => row.primaryEmail || '-',
    },
    {
      key: 'status',
      label: 'Status',
      render: (_value: unknown, row: DisplayRequesterAuthorized) => {
        return row.status === 1 ? 'Active' : 'Inactive';
      },
    },
    ...(canAddRequesterAuthorized ? [
      {
        key: 'actions',
        label: REQUESTER_AUTHORIZED.TABLE.COLUMNS.ACTION,
        render: (_value: unknown, row: DisplayRequesterAuthorized) => (
          <Stack
            direction="row"
            className="requester-authorized-list__actions data-table__cell--no-clamp"
            alignItems="center"
            justifyContent="center"
            useFlexGap
            sx={{ flexWrap: 'nowrap', minHeight: 32 }}
          >
            <SMSIconButton
              tone="primary"
              size="small"
              onClick={() => handleEditClick(row)}
              title={REQUESTER_AUTHORIZED.BUTTON.EDIT}
              aria-label={REQUESTER_AUTHORIZED.BUTTON.EDIT}
              className="requester-authorized-list__icon-btn"
            >
              <SMSIcon name="edit" size="sm" />
            </SMSIconButton>
            <SMSIconButton
              tone="error"
              size="small"
              onClick={() => handleDeleteClick(row)}
              title={REQUESTER_AUTHORIZED.BUTTON.REMOVE}
              aria-label={REQUESTER_AUTHORIZED.BUTTON.REMOVE}
              className="requester-authorized-list__icon-btn"
            >
              <SMSIcon name="delete" size="sm" />
            </SMSIconButton>
          </Stack>
        ),
      },
    ] : []),
  ], [canAddRequesterAuthorized, handleEditClick, handleDeleteClick]);

  return (
    <div className={`requester-authorized-list requester-authorized-list--page ${className}`}>
      <div className="requester-authorized-list__header">
        <button
          type="button"
          onClick={() => navigate('/personnel/requester/manage')}
          className="requester-authorized-list__back-button"
          aria-label="Back to Requester List"
        >
          <SMSIcon name="arrowLeft" size="md" />
        </button>
        <h1 className="requester-authorized-list__title">
          {requesterName ? requesterName + ' - ' + REQUESTER_AUTHORIZED.TABLE.TITLE : REQUESTER_AUTHORIZED.TABLE.TITLE}
        </h1>
        {canAddRequesterAuthorized && (
          <SMSButton
            onClick={handleAddClick}
            className="requester-authorized-list__add-button"
          >
            <SMSIcon name="plus" size="sm" />
            {REQUESTER_AUTHORIZED.BUTTON.ADD_NEW}
          </SMSButton>
        )}
      </div>

      <Box className="requester-authorized-list__table">
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          flexWrap="wrap"
          alignItems={{ xs: 'stretch', sm: 'center' }}
          className="requester-authorized-list__filters-row data-table__toolbar"
          useFlexGap
          gap={{ xs: 2, sm: 1 }}
        >
          <Box className="data-table__search" sx={{ width: { xs: '100%', sm: 'auto' } }}>
            <SearchFilter
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder={REQUESTER_AUTHORIZED.SEARCH_PLACEHOLDER}
            />
          </Box>
          <SMSSegmentedStatusFilter
            value={statusFilter}
            onChange={handleStatusFilterChange}
            activeLabel="Active"
            inactiveLabel="Inactive"
            allowClear={true}
            showIcons={true}
            ariaLabel="Requester Authorized status filter"
          />
        </Stack>

        <SMSDataTableWrapper
          data={itemsWithNames}
          columns={columns}
          loading={isLoading}
          emptyMessage={REQUESTER_AUTHORIZED.TABLE.NO_DATA}
          searchable={false}
          maxBodyHeight={PAGE_GRID_MAX_BODY_HEIGHT}
          responsiveMode="auto"
          responsiveAutoMeasure="container"
          responsiveAutoMaxWidthPx={600}
          pagination={{
            currentPage,
            pageSize,
            totalItems,
            onPageChange: handlePageChange,
            onPageSizeChange: handlePageSizeChange,
          }}
        />
      </Box>

      <Modal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        title={formMode === 'create' ? REQUESTER_AUTHORIZED.TITLE : REQUESTER_AUTHORIZED.EDIT_TITLE}
        size="large"
      >
        {error && (
          <div className="requester-authorized-list__error" role="alert" style={{ marginBottom: '1rem', color: 'red' }}>
            {error}
          </div>
        )}
        <RequesterAuthorizedForm
          mode={formMode}
          initialData={addFormInitialData}
          requesterOptions={requesterOptions}
          requesterID={requesterID ?? undefined}
          requesterName={requesterName}
          onSuccess={handleFormSuccess}
          onCancel={handleModalClose}
        />
      </Modal>

      <SMSConfirmDialog
        open={!!deletingRow}
        title={REQUESTER_AUTHORIZED.CONFIRM.DELETE_TITLE}
        message={REQUESTER_AUTHORIZED.CONFIRM.DELETE_MESSAGE}
        confirmText={REQUESTER_AUTHORIZED.CONFIRM.DELETE_CONFIRM}
        cancelText={REQUESTER_AUTHORIZED.CONFIRM.DELETE_CANCEL}
        onConfirm={handleDeleteConfirm}
        onClose={handleDeleteCancel}
        variant="error"
        loading={false}
      />
    </div>
  );
};
