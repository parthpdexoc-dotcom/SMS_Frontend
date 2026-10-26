import React, { useEffect, useMemo } from 'react';
import { usePagination } from '@/hooks/usePagination';
import { SMSPostInformationModal } from '@/components/smsorganisms';
import { SMSStack, SMSBox, SMSIconButton, SMSIcon, SMSTypography, SMSCard } from '@/components/smsatoms';
import { SMSDataTableWrapper } from '@/components/smsorganisms/SMSDataTableWrapper/SMSDataTableWrapper';
import type { DataTableColumn } from '@/components/smsorganisms';
import type { SearchModel } from '@/types/availablePost';
import type { EmployeePostListingItem } from '@/types/employeePostListingItem';
import { AVAILABLE_POST, POST_GRID_COLUMNS } from '@/constants/strings';
import { formatDateShort, getPostGridTimeColumns } from '@/utils';
import { ReleaseAs } from '@/types/request';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  clearWaitingList,
  closeWaitingListDetails,
  fetchWaitingListPosts,
  fetchWaitingListPostDetails,
  openWaitingListDetails,
  setWaitingListMessage,
} from '@/store/slices/availablePostSlice';

export interface SMSWaitingListModalProps {
  open: boolean;
  onClose: () => void;
  searchModel: SearchModel;
}

export const SMSWaitingListModal: React.FC<SMSWaitingListModalProps> = ({
  open,
  onClose,
  searchModel,
}) => {
  const dispatch = useAppDispatch();
  const modalPagination = usePagination();
  const {
    waitingListPosts,
    waitingListTotalRecords,
    isWaitingListLoading,
    waitingListMessage,
    waitingListDetailsOpen,
    waitingListSelectedPost,
    isWaitingListDetailsLoading,
    waitingListDetailsMessage,
    waitingListRequest,
    waitingListRequester,
    waitingListPost,
    waitingListFiles,
  } = useAppSelector((s) => s.availablePost);

  useEffect(() => {
    if (!open) return;

    if (searchModel.releaseAs === ReleaseAs.Cancelled) {
      dispatch(clearWaitingList());
      dispatch(setWaitingListMessage(AVAILABLE_POST.LIST.WAITING_LIST_CANCELLED_UNAVAILABLE));
      return;
    }

    modalPagination.goToFirstPage();
    dispatch(
      fetchWaitingListPosts({
        searchModel,
        pagination: { page: 1, pageSize: modalPagination.pageSize },
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    dispatch,
    searchModel.startDate,
    searchModel.numberOfDays,
    searchModel.releaseAs,
    searchModel.managedGeneralIncludesPreferred,
  ]);

  useEffect(() => {
    if (!open) return;
    modalPagination.setTotalItems(waitingListTotalRecords);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, waitingListTotalRecords]);

  const columns: DataTableColumn<EmployeePostListingItem>[] = useMemo(
    () => [
      {
        key: 'startDate',
        label: POST_GRID_COLUMNS.DATE,
        render: (value) => (value ? formatDateShort(value as string) : '-'),
      },
      ...getPostGridTimeColumns<EmployeePostListingItem>(),
      {
        key: 'postTitle',
        label: POST_GRID_COLUMNS.TITLE,
      },
      {
        key: 'availablePositions',
        label: 'Available',
        render: (_value, row) => `${row.availablePositions ?? 0}/${row.totalPositions}`,
      },
      {
        key: 'details',
        label: '',
        align: 'center',
        render: (_value, row) => (
          <SMSIconButton
            allowWhenSuspended
            aria-label={AVAILABLE_POST.LIST.ICON_ACTIONS.VIEW_DETAILS_ARIA}
            onClick={() => {
              dispatch(openWaitingListDetails(row));
              dispatch(fetchWaitingListPostDetails(row));
            }}
            size="small"
            type="button"
          >
            <SMSIcon name="eye" size="sm" />
          </SMSIconButton>
        ),
      },
    ],
    [dispatch]
  );

  if (!open) return null;

  return (
    <SMSStack spacing={2}>
      <SMSCard sx={{ p: 2 }}>
        <SMSStack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
          <SMSStack direction="row" alignItems="center" spacing={1}>
            <SMSIcon name="list" size="sm" />
            <SMSTypography variant="h6">{AVAILABLE_POST.TABS.WAITING_LIST}</SMSTypography>
          </SMSStack>

          <SMSIconButton
            allowWhenSuspended
            aria-label="Close waiting list"
            onClick={onClose}
            size="small"
          >
            <SMSIcon name="close" size="sm" />
          </SMSIconButton>
        </SMSStack>

        <SMSBox sx={{ mt: 2 }}>
          <SMSDataTableWrapper<EmployeePostListingItem>
            columns={columns}
            data={waitingListPosts}
            loading={isWaitingListLoading}
            error={null}
            emptyTitle={AVAILABLE_POST.TABS.WAITING_LIST}
            emptyMessage={waitingListMessage ?? ''}
            emptyIcon="list"
            maxBodyHeight="min(60vh, 520px)"
            showHeaderWhenEmpty={true}
            pagination={{
              serverSide: true,
              currentPage: modalPagination.currentPage,
              pageSize: modalPagination.pageSize,
              totalItems: modalPagination.totalItems,
              onPageChange: (page) => {
                modalPagination.goToPage(page);
                dispatch(
                  fetchWaitingListPosts({
                    searchModel,
                    pagination: { page, pageSize: modalPagination.pageSize },
                  })
                );
              },
              onPageSizeChange: (newPageSize) => {
                modalPagination.setPageSize(newPageSize);
                modalPagination.goToFirstPage();
                dispatch(
                  fetchWaitingListPosts({
                    searchModel,
                    pagination: { page: 1, pageSize: newPageSize },
                  })
                );
              },
            }}
          />
        </SMSBox>
      </SMSCard>
      {waitingListSelectedPost && (
        <SMSPostInformationModal
          open={waitingListDetailsOpen}
          onClose={() => dispatch(closeWaitingListDetails())}
          title={AVAILABLE_POST.DETAILS.TITLE}
          isLoading={isWaitingListDetailsLoading}
          preferPostPositionFields
          statusMessage={!isWaitingListDetailsLoading ? waitingListDetailsMessage : null}
          selectedPost={{
            postID: waitingListSelectedPost.postID,
            postTitle: waitingListSelectedPost.postTitle,
            startTime: waitingListSelectedPost.startTime,
            postEndTime: waitingListSelectedPost.postEndTime ?? waitingListPost?.postEndTime ?? null,
            postLength: waitingListSelectedPost.postLength,
            startDate: waitingListSelectedPost.startDate,
            postLocation: waitingListPost?.postLocation ?? waitingListSelectedPost.postLocation,
            postDescription: waitingListPost?.postDescription,
            postNotes: waitingListPost?.postNotes,
            totalPositions: waitingListPost?.totalPostPositions ?? waitingListSelectedPost.totalPositions,
            availablePositions: waitingListSelectedPost.availablePositions,
            isSpecialEvent: waitingListSelectedPost.isSpecialEvent,
          }}
          requestData={waitingListRequest}
          requesterData={waitingListRequester}
          postData={waitingListPost}
          requestFiles={waitingListFiles}
          showEndTime={false}
          showTotalPositions={true}
        />
      )}
    </SMSStack>
  );
};

export default SMSWaitingListModal;

