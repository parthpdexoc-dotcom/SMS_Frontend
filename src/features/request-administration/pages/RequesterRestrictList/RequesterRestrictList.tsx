import { SMSButton, SMSIcon, SMSIconButton } from '@/components/smsatoms';
import React, { useMemo, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SMSDataTableWrapper, SMSModal as Modal } from '@/components/smsorganisms';
import { RequesterRestrictForm, type RequesterRestrictFormMode } from '@/components/smsmolecules/RequesterRestrictForm';
import { RequesterRestrict, RequesterOption, EmployeeOption } from '@/types/requesterRestrict';
import { REQUESTER_RESTRICT } from '@/constants/strings';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchRequesterRestrictedList, setPagination } from '@/store/slices/requesterRestrictedSlice';
import { fetchRequesterOptionsThunk } from '@/store/slices/requesterSlice';
import { getAvailableRestrictEmployeeOptions } from '@/services/requesterRestrictedService';
import { formatDateShort } from '@/utils';
import './RequesterRestrictList.css';


export interface RequesterRestrictListProps {
  className?: string;
}

type DisplayRow = RequesterRestrict & { __raw: RequesterRestrict };

const REQUESTER_LIST_PATH = '/personnel/requester/manage';

export const RequesterRestrictList: React.FC<RequesterRestrictListProps> = ({ className = '' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const { requesterRestrictedList, isLoading, totalItems, currentPage, pageSize } = useAppSelector((state) => state.requesterRestricted);
  const rawRequesterOptions = useAppSelector((state) => state.requester.requesterOptions);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<RequesterRestrictFormMode>('create');
  const [editingRow, setEditingRow] = useState<RequesterRestrict | null>(null);
  const [employeeOptions, setEmployeeOptions] = useState<EmployeeOption[]>([]);
  const [isLoadingEmployeeOptions, setIsLoadingEmployeeOptions] = useState(false);

  const loadEmployeeOptions = async (requesterId: string) => {
    if (!requesterId.trim()) {
      setEmployeeOptions([]);
      return;
    }
    setIsLoadingEmployeeOptions(true);
    try {
      const options = await getAvailableRestrictEmployeeOptions({ requesterId });
      setEmployeeOptions(
        options.map((opt) => ({ value: String(opt.id), label: opt.label }))
      );
    } catch {
      setEmployeeOptions([]);
    } finally {
      setIsLoadingEmployeeOptions(false);
    }
  };

  const lockedRequesterID =
    (location.state as { requesterId?: string } | null)?.requesterId ?? null;

  useEffect(() => {
    dispatch(fetchRequesterRestrictedList({
      page: currentPage,
      pageSize,
      ...(lockedRequesterID ? { requesterId: lockedRequesterID } : {}),
    }));
  }, [dispatch, lockedRequesterID, currentPage, pageSize]);

  useEffect(() => {
    dispatch(fetchRequesterOptionsThunk({}));
  }, [dispatch]);

  const requesterOptions: RequesterOption[] = useMemo(() => {
    return rawRequesterOptions.map((opt) => ({
      value: String(opt.id),
      label: opt.label || 'Unknown Requester',
    }));
  }, [rawRequesterOptions]);

  const lockedRequesterName = useMemo(() => {
    if (!lockedRequesterID) return undefined;
    return requesterOptions.find((o) => o.value === lockedRequesterID)?.label;
  }, [lockedRequesterID, requesterOptions]);

  const tableData = useMemo<DisplayRow[]>(() => requesterRestrictedList.map((r) => ({ ...r, __raw: r })), [requesterRestrictedList]);

  const handlePageChange = (page: number) => {
    dispatch(setPagination({ page }));
  };

  const handlePageSizeChange = (newPageSize: number) => {
    dispatch(setPagination({ pageSize: newPageSize, page: 1 }));
  };

  const handleAddClick = () => {
    // If user came from RequesterList, prefill + lock the requester.
    if (lockedRequesterID) {
      setEditingRow({
        requesterRestrictID: '',
        requesterID: lockedRequesterID,
        requesterName: lockedRequesterName ?? '',
        employeeID: '',
        employeeName: '',
        effectiveStartDate: '',
        effectiveEndDate: '',
        isCurrent: true,
        createdDate: null,
        createdUserID: null,
        createdBy: null,
        editedDate: null,
        editedUserID: null,
        editedBy: null,
      });
    } else {
      setEditingRow(null);
    }
    setModalMode('create');
    setIsModalOpen(true);
    if (lockedRequesterID) {
      void loadEmployeeOptions(lockedRequesterID);
    } else {
      setEmployeeOptions([]);
    }
  };

  const handleEditClick = (row: RequesterRestrict) => {
    setEditingRow(row);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingRow(null);
    setModalMode('create');
    setEmployeeOptions([]);
  };

  const handleFormSuccess = () => {
    dispatch(fetchRequesterRestrictedList({
      page: currentPage,
      pageSize,
      ...(lockedRequesterID ? { requesterId: lockedRequesterID } : {}),
    }));
    setIsModalOpen(false);
    setEditingRow(null);
  };

  const searchableColumns = useMemo(
    () =>
      [
        'requesterName',
        'employeeName',
        'effectiveStartDate',
        'effectiveEndDate',
        'isCurrent',
      ] as (keyof DisplayRow)[],
    []
  );

  
  // Check if EffectiveEndDate is expired (less than today's date)
  const isEffectiveEndDateExpired = (effectiveEndDate: string | null | undefined): boolean => {
    if (!effectiveEndDate) return false;
    const endDate = new Date(effectiveEndDate);
    if (Number.isNaN(endDate.getTime())) return false;
    
    // Compare only date part (ignore time)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);
    
    return endDate < today;
  };

  const getModalTitle = () => {
    return modalMode === 'create' ? REQUESTER_RESTRICT.TITLE : REQUESTER_RESTRICT.EDIT_TITLE;
  };

  const tableColumns = useMemo(
    () => [
      {
        key: 'requesterName',
        label: REQUESTER_RESTRICT.TABLE.COLUMNS.REQUESTER,
        render: (_: unknown, row: DisplayRow) =>
          String(row.requesterName || row.requesterID || '-'),
      },
      {
        key: 'employeeName',
        label: REQUESTER_RESTRICT.TABLE.COLUMNS.EMPLOYEE,
        render: (_: unknown, row: DisplayRow) =>
          String(row.employeeName || row.employeeID || '-'),
      },
      { 
        key: 'effectiveStartDate',
        label: REQUESTER_RESTRICT.TABLE.COLUMNS.START_DATE,
        render: (value: unknown) => {
          const dateStr = value as string;
          return dateStr ? formatDateShort(dateStr) : '-';
        },
      },
      {
        key: 'effectiveEndDate',
        label: REQUESTER_RESTRICT.TABLE.COLUMNS.END_DATE,
        render: (value: unknown) => {
          const dateStr = value as string;
          return dateStr ? formatDateShort(dateStr) : '-';
        },
      },
      {
        key: 'action',
        label: REQUESTER_RESTRICT.TABLE.COLUMNS.ACTION,
        render: (_: unknown, row: DisplayRow) => {
          const isExpired = isEffectiveEndDateExpired(row.__raw.effectiveEndDate);
          return (
            <div className="requester-restrict-list__actions">
              <SMSIconButton
                size="small"
                tone="primary"
                onClick={() => handleEditClick(row.__raw)}
                disabled={isExpired}
                className="requester-restrict-list__edit-button"
                title={isExpired ? REQUESTER_RESTRICT.BUTTON.EDIT_DISABLED_TOOLTIP : REQUESTER_RESTRICT.BUTTON.EDIT}
                aria-label={isExpired ? REQUESTER_RESTRICT.BUTTON.EDIT_DISABLED_TOOLTIP : REQUESTER_RESTRICT.BUTTON.EDIT}
              >
                <SMSIcon name="edit" size="sm" />
              </SMSIconButton>
            </div>
          );
        },
      },
    ],
    []
  );

  return (
    <div className={`requester-restrict-list skills-list ${className}`}>
      <div className="requester-restrict-list__header">
        <button
          type="button"
          onClick={() => navigate(REQUESTER_LIST_PATH)}
          className="requester-restrict-list__back-button"
          aria-label="Back to Requester List"
        >
          <SMSIcon name="arrowLeft" size="md" />
        </button>
        <h1 className="requester-restrict-list__title">
          {REQUESTER_RESTRICT.TABLE.TITLE}
        </h1>
        <SMSButton
          onClick={handleAddClick}
          className="requester-restrict-list__add-button"
        >
          <SMSIcon name="plus" size="sm" />
          {REQUESTER_RESTRICT.BUTTON.ADD_NEW}
        </SMSButton>
      </div>

      <SMSDataTableWrapper<DisplayRow>
        columns={tableColumns as any}
        data={tableData}
        emptyMessage={REQUESTER_RESTRICT.TABLE.NO_DATA}
        loading={isLoading}
        tableClassName="requester-restrict-list__table"
        searchable
        searchableColumns={searchableColumns}
        renderEmptyAsTable
        maxBodyHeight="max(320px, calc(100vh - 360px))"
        pagination={{
          currentPage,
          pageSize,
          totalItems,
          onPageChange: handlePageChange,
          onPageSizeChange: handlePageSizeChange,
        }}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        title={getModalTitle()}
        size="large"
      >
        <RequesterRestrictForm
          mode={modalMode}
          initialData={editingRow}
          requesterOptions={requesterOptions}
          employeeOptions={employeeOptions}
          isLoadingEmployeeOptions={isLoadingEmployeeOptions}
          onRequesterIdChange={loadEmployeeOptions}
          lockedRequesterID={lockedRequesterID ?? undefined}
          lockedRequesterName={lockedRequesterName}
          onSuccess={handleFormSuccess}
          onCancel={handleModalClose}
        />
      </Modal>
    </div>
  );
};
