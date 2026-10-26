import React, { useEffect, useMemo, useState } from 'react';
import { SMSModal as Modal, SMSDataTableWrapper, type DataTableColumn } from '@/components/smsorganisms';
import { SMSIcon, SMSIconButton } from '@/components/smsatoms';
import { NotificationDetailsModal } from '@/components/smsmolecules/NotificationDetailsModal';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  clearNotificationHistory,
  fetchNotificationHistoryThunk,
} from '@/store/slices/notificationSlice';
import type { NotificationHistoryListItem } from '@/types/notification';
import { REQUESTER } from '@/constants/strings';
import { formatDateShort, formatTime } from '@/utils';
import type { NotificationHistoryModalProps } from './NotificationHistoryModal.types';
import './NotificationHistoryModal.css';

const str = REQUESTER.NOTIFICATION_HISTORY;

export const NotificationHistoryModal: React.FC<NotificationHistoryModalProps> = ({
  isOpen,
  onClose,
  requestId,
  postId,
  postPositionId,
  requesterId,
  title,
}) => {
  const dispatch = useAppDispatch();
  const { historyList, historyTotalRecords, isLoadingHistory } = useAppSelector(
    (state) => state.notification
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      dispatch(clearNotificationHistory());
      setPage(1);
      setDetailId(null);
      return;
    }
    if (!requestId && !postId && !postPositionId) return;

    const historyParams = postPositionId
      ? { postPositionId, pagination: { page, pageSize } }
      : postId
        ? { postId, pagination: { page, pageSize } }
        : { requestId: requestId!, pagination: { page, pageSize } };
    void dispatch(fetchNotificationHistoryThunk(historyParams));
  }, [dispatch, isOpen, requestId, postId, postPositionId, page, pageSize]);

  const columns = useMemo<DataTableColumn<NotificationHistoryListItem>[]>(
    () => [
      { key: 'subject', label: str.SUBJECT, render: (_v, row) => row.subject ?? '—' },
      { key: 'sentBy', label: str.SENT_BY, render: (_v, row) => row.sentBy ?? '—' },
      {
        key: 'sentAt',
        label: str.SENT_ON,
        render: (_v, row) =>
          row.sentAt ? (
            <span className="notification-history-modal__sent-on">
              <span>{formatDateShort(row.sentAt)}</span>
              <span>{formatTime(row.sentAt)}</span>
            </span>
          ) : (
            '—'
          ),
      },
      { key: 'toCount', label: str.TO, render: (_v, row) => row.toCount ?? 0 },
      { key: 'ccCount', label: str.CC, render: (_v, row) => row.ccCount ?? 0 },
      { key: 'bccCount', label: str.BCC, render: (_v, row) => row.bccCount ?? 0 },
      {
        key: 'status',
        label: str.STATUS,
        render: (_v, row) => (
          <span className="notification-history-modal__status">{row.status ?? 'Sent'}</span>
        ),
      },
      {
        key: 'view',
        label: str.VIEW,
        render: (_v, row) => (
          <SMSIconButton
            tone="primary"
            size="small"
            aria-label={str.VIEW}
            onClick={(e) => {
              e.stopPropagation();
              setDetailId(row.notificationHistoryId);
            }}
          >
            <SMSIcon name="eye" size="sm" />
          </SMSIconButton>
        ),
      },
    ],
    []
  );

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={title?.trim() || str.TITLE}
        size="xl"
        fullWidth
        contentClassName="notification-history-modal__content"
      >
        <div className="notification-history-modal">
          <div className="notification-history-modal__heading">{str.TITLE}</div>
          <SMSDataTableWrapper<NotificationHistoryListItem>
            columns={columns}
            data={historyList}
            loading={isLoadingHistory}
            emptyMessage={str.EMPTY}
            searchable={false}
            embedded
            getRowKey={(row) => row.notificationHistoryId}
            pagination={{
              currentPage: page,
              pageSize,
              totalItems: historyTotalRecords,
              serverSide: true,
              onPageChange: setPage,
              onPageSizeChange: (size) => {
                setPageSize(size);
                setPage(1);
              },
            }}
          />
        </div>
      </Modal>

      <NotificationDetailsModal
        isOpen={detailId != null}
        onClose={() => setDetailId(null)}
        notificationHistoryId={detailId ?? ''}
        requestId={requestId}
        requesterId={requesterId}
      />
    </>
  );
};
