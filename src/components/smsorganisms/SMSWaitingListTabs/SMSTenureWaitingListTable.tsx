import React, { useMemo, useCallback, useState } from 'react';
import { SMSDataTableWrapper, type DataTableColumn } from '@/components/smsorganisms';
import { SMSBox, SMSButton, SMSIcon, SMSIconButton, SMSStack } from '@/components/smsatoms';
import { POST_POSITION, WAITING_LIST } from '@/constants/strings';
import { formatDateWithDayOfWeek, formatPostGridDurationCell, getPostGridTimeColumns, isSuspendedEmployeeActive } from '@/utils';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { ReleaseAs } from '@/types/request';
import {
  setPagination,
  cancelTenureWaitingPositionThunk,
  fetchTenureDetailForModal,
  closeTenureDetailModal,
  downloadTenureDetailFileThunk,
  waitingListTabKeyFromReleaseAs,
} from '@/store/slices/tenureWaitingPositionSlice';
import type { EmployeePostListingItem } from '@/types/employeePostListingItem';
import { PostPositionStatus } from '@/types/postPosition';
import { WaitingListSubTab } from '@/types/waitingListSubTab';
import '@/components/smsmolecules/PostPositionByStatusList/PostPositionByStatusList.css';
import '@/components/smsorganisms/SMSAvailablePostList/SMSAvailablePostList.css';
import { SMSPostInformationModal } from '@/components/smsorganisms';
import { SMSViewDetailsEquipmentSection } from '@/components/smsmolecules/SMSViewDetailsEquipmentSection/SMSViewDetailsEquipmentSection';
import { SMSConfirmDialog } from '@/components/smsmolecules';
import type { SMSPostInformationModalSelectedPost } from '@/components/smsorganisms/SMSPostInformationModal/SMSPostInformationModal';

function isWaitingListSpecialEventRow(row: EmployeePostListingItem): boolean {
  return (
    row.postPositionStatus === PostPositionStatus.SpecialEvent || row.isSpecialEvent === true
  );
}

export interface SMSTenureWaitingListTableProps {
  tab?: WaitingListSubTab;
}

export const SMSTenureWaitingListTable: React.FC<SMSTenureWaitingListTableProps> = ({
  tab = WaitingListSubTab.TenureBased,
}) => {
  const dispatch = useAppDispatch();
  const [pendingCancelRow, setPendingCancelRow] = useState<EmployeePostListingItem | null>(null);
  /**
   * Tab → `listReleaseAs` (`TenureBased` vs `General`) drives POST my-tenure-waiting-positions body:
   * tenure `[1]`, general `[0,2,3,4,5]`. Redux does not filter the list client-side after fetch.
   */
  const listReleaseAs = tab === WaitingListSubTab.TenureBased ? ReleaseAs.TenureBased : ReleaseAs.General;
  const tabKey = waitingListTabKeyFromReleaseAs(listReleaseAs);
  const { list, pagination, isViewWLHistory } = useAppSelector(
    (state) => state.tenureWaitingPosition.byTab[tabKey]
  );
  const {
    loading,
    cancellingId,
    selectedRow,
    detailModalOpen,
    detailPostData,
    requestData,
    requesterData,
    requestFiles,
    loadingDetails,
    specialEventJobDetailsMessage,
    latestPostNoteFromDetails,
    detailModalEquipmentRaw,
    viewDetailsShowVehicle,
    viewDetailsShowEquipment,
  } = useAppSelector((state) => state.tenureWaitingPosition);
  const user = useAppSelector((state) => state.auth.user);
  const isSuspendedActive = isSuspendedEmployeeActive(user);
  const handleViewDetails = useCallback(
    (row: EmployeePostListingItem) => {
      dispatch(fetchTenureDetailForModal(row));
    },
    [dispatch]
  );

  const handleCloseDetailModal = useCallback(() => {
    dispatch(closeTenureDetailModal());
  }, [dispatch]);

  const handleCancel = useCallback(
    (row: EmployeePostListingItem) => {
      const id = row.waitingPostPositionId;
      if (!id) return;
      dispatch(
        cancelTenureWaitingPositionThunk({
          waitingPostPositionId: id,
          pagination: {
            currentPage: pagination.currentPage,
            pageSize: pagination.pageSize,
            totalItems: pagination.totalItems,
          },
          listReleaseAs,
          isViewWLHistory,
        })
      );
    },
    [dispatch, pagination, listReleaseAs, isViewWLHistory]
  );
  const closeCancelDialog = useCallback(() => {
    if (pendingCancelRow && cancellingId === pendingCancelRow.waitingPostPositionId) return;
    setPendingCancelRow(null);
  }, [pendingCancelRow, cancellingId]);

  const handlePageChange = useCallback(
    (page: number) => {
      dispatch(setPagination({ releaseAs: listReleaseAs, currentPage: page }));
    },
    [dispatch, listReleaseAs]
  );

  const handlePageSizeChange = useCallback(
    (size: number) => {
      dispatch(setPagination({ releaseAs: listReleaseAs, pageSize: size, currentPage: 1 }));
    },
    [dispatch, listReleaseAs]
  );

  const listStr = POST_POSITION.BY_STATUS_LIST;
  const colStr = listStr.COLUMNS;
  const btnStr = listStr.BUTTONS;

  const timeColumns = useMemo(() => {
    const base = getPostGridTimeColumns<EmployeePostListingItem>();
    return base.map((col) =>
      col.key === 'lengthOfWork'
        ? {
            ...col,
            render: (_value: unknown, row: EmployeePostListingItem): React.ReactNode => {
              if (row.postPositionStatus === PostPositionStatus.SpecialEvent) {
                return '-';
              }
              const rawLen =
                row.postLength ?? (row as EmployeePostListingItem & { lengthOfWork?: number | null }).lengthOfWork;
              if (rawLen != null && !Number.isNaN(Number(rawLen)) && Number(rawLen) === 1) {
                return '-';
              }
              return formatPostGridDurationCell(row);
            },
          }
        : col
    );
  }, []);

  const detailModalEquipmentExtra = useMemo(() => {
    if (!detailModalOpen || !selectedRow) return null;
    if (
      detailModalEquipmentRaw.length === 0 &&
      !viewDetailsShowVehicle &&
      !viewDetailsShowEquipment
    ) {
      return null;
    }
    return (
      <SMSViewDetailsEquipmentSection
        equipmentRaw={detailModalEquipmentRaw}
        rootShowVehicle={viewDetailsShowVehicle}
        rootShowEquipment={viewDetailsShowEquipment}
        postPositionDetails={null}
      />
    );
  }, [
    detailModalOpen,
    selectedRow,
    detailModalEquipmentRaw,
    viewDetailsShowVehicle,
    viewDetailsShowEquipment,
  ]);

  const columns: DataTableColumn<EmployeePostListingItem>[] = useMemo(
    (): DataTableColumn<EmployeePostListingItem>[] => [
      {
        key: 'startDate',
        label: colStr.DATE,
        render: (_value: unknown, row: EmployeePostListingItem): React.ReactNode =>
          row.startDate ? (
            <SMSBox sx={{ whiteSpace: 'pre-line', lineHeight: 1.2 }}>
              {formatDateWithDayOfWeek(row.startDate, row.dayOfWeek)}
            </SMSBox>
          ) : '---',
      },
      ...timeColumns,
      {
        key: 'title',
        label: colStr.TITLE,
        render: (_value: unknown, row: EmployeePostListingItem): React.ReactNode => {
          if (row.postPositionStatus === PostPositionStatus.SpecialEvent) {
            const requestTitle = row.requestTitle?.trim() ?? '';
            return requestTitle || '---';
          }
          const title = (row as any).title?.trim() ?? row.postTitle?.trim() ?? '';
          return title || '---';
        },
      },
      {
        key: 'type',
        label: 'Type',
        render: (_value: unknown, row: EmployeePostListingItem): React.ReactNode => {
          if (row.postPositionStatus === PostPositionStatus.SpecialEvent) return WAITING_LIST.SPECIAL_JOB;
          if (tab === WaitingListSubTab.TenureBased) return WAITING_LIST.TENURE_BASED;
          return WAITING_LIST.GENERAL;
        },
      },
      {
        key: 'action',
        label: colStr.ACTION,
        render: (_value: unknown, row: EmployeePostListingItem): React.ReactNode => (
          <div className="post-position-by-status-list__actions">
            <SMSStack direction="row" spacing={0.5} justifyContent="center" alignItems="center">
              <SMSIconButton
                size="small"
                tone="primary"
                allowWhenSuspended
                aria-label={btnStr.VIEW_DETAILS}
                title={btnStr.VIEW_DETAILS}
                onClick={() => handleViewDetails(row)}
              >
                <SMSIcon name="eye" size="sm" />
              </SMSIconButton>
              <SMSButton
                aria-label={btnStr.CANCEL_POST}
                title={btnStr.CANCEL_POST}
                onClick={() => setPendingCancelRow(row)}
                disabled={isSuspendedActive || cancellingId === row.waitingPostPositionId}
              >
                {btnStr.CANCEL_POST}
              </SMSButton>
            </SMSStack>
          </div>
        ),
      },
    ],
    [colStr, listStr, btnStr, handleViewDetails, cancellingId, tab, isSuspendedActive, timeColumns]
  );

  const detailStr = POST_POSITION.DETAIL_MODAL;

  const selectedIsSpecialEvent = selectedRow != null && isWaitingListSpecialEventRow(selectedRow);

  const tenureDetailModalProps = useMemo((): {
    selectedPost: SMSPostInformationModalSelectedPost;
    showTotalPositions: boolean;
    showAvailablePositions: boolean;
  } | null => {
    if (!selectedRow) return null;
    const row = selectedRow;
    const isGeneralWaitingRow =
      row.releaseAs !== ReleaseAs.TenureBased && !isWaitingListSpecialEventRow(row);

    if (isGeneralWaitingRow) {
      const selectedPost: SMSPostInformationModalSelectedPost = {
        postID: row.postID,
        postTitle: row.postTitle?.trim() ? row.postTitle : '-',
        startTime: row.startTime,
        postLength: row.postLength,
        startDate: row.startDate,
        postLocation: row.postLocation,
        postDescription: undefined,
        postNotes: '',
        totalPositions: row.totalPositions,
        availablePositions: row.availablePositions ?? null,
        isSpecialEvent: false,
      };
      return {
        selectedPost,
        showTotalPositions: true,
        showAvailablePositions: row.availablePositions != null,
      };
    }

    const special = isWaitingListSpecialEventRow(row);
    const selectedPost: SMSPostInformationModalSelectedPost = {
      postID: row.postID,
      postTitle: special ? '' : row.postTitle?.trim() ? row.postTitle : '-',
      startTime: row.startTime,
      postLength: row.postLength,
      startDate: row.startDate,
      postLocation: row.postLocation,
      postDescription: undefined,
      postNotes: '',
      totalPositions: row.totalPositions,
      availablePositions: special ? row.totalPositions : row.availablePositions ?? null,
      isSpecialEvent: special,
    };
    return {
      selectedPost,
      showTotalPositions: false,
      showAvailablePositions: false,
    };
  }, [selectedRow]);

  return (
    <>
      <div className="post-position-by-status-list__table" data-post-cols={columns.length}>
        <SMSDataTableWrapper
          columns={columns}
          data={list}
          loading={loading}
          emptyMessage={WAITING_LIST.NO_DATA}
          maxBodyHeight="calc(100vh - 360px)"
          pagination={{
            currentPage: pagination.currentPage,
            pageSize: pagination.pageSize,
            totalItems: pagination.totalItems,
            serverSide: true,
            onPageChange: handlePageChange,
            onPageSizeChange: handlePageSizeChange,
          }}
        />
      </div>

      {selectedRow && tenureDetailModalProps && (
        <SMSPostInformationModal
          open={detailModalOpen}
          onClose={handleCloseDetailModal}
          isLoading={loadingDetails}
          title={detailStr.TITLE}
          preferPostPositionFields
          specialEventMode={
            selectedIsSpecialEvent || Boolean(specialEventJobDetailsMessage?.trim())
          }
          selectedPost={tenureDetailModalProps.selectedPost}
          showTotalPositions={tenureDetailModalProps.showTotalPositions}
          showAvailablePositions={tenureDetailModalProps.showAvailablePositions}
          requestData={requestData}
          requesterData={requesterData}
          postData={detailPostData}
          requireLatestNoteConfirmation={true}
          specialEventJobDetailsMessage={specialEventJobDetailsMessage}
          latestPostNoteFromDetails={latestPostNoteFromDetails}
          requestFiles={requestFiles}
          extraContent={detailModalEquipmentExtra}
          onDownloadFile={(file) => {
            const requestID = requestData?.requestID;
            const requesterID = requestData?.requesterID;
            if (!requestID || !requesterID) return;
            dispatch(
              downloadTenureDetailFileThunk({
                requesterID,
                requestID,
                fileUploadedId: file.fileUploadedId,
                fileName: file.fileName,
              })
            );
          }}
        />
      )}

      <SMSConfirmDialog
        open={!!pendingCancelRow}
        onClose={closeCancelDialog}
        title={listStr.CANCEL_CONFIRMATION.WAITING_TITLE ?? listStr.CANCEL_CONFIRMATION.TITLE}
        message={listStr.CANCEL_CONFIRMATION.WAITING_MESSAGE ?? listStr.CANCEL_CONFIRMATION.MESSAGE}
        confirmText={listStr.CANCEL_CONFIRMATION.CONFIRM_BUTTON}
        cancelText={listStr.CANCEL_CONFIRMATION.CANCEL_BUTTON}
        onConfirm={() => {
          if (!pendingCancelRow) return;
          const row = pendingCancelRow;
          setPendingCancelRow(null);
          handleCancel(row);
        }}
        variant="default"
      />
    </>
  );
};
