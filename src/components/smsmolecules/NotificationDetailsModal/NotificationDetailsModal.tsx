import React, { useEffect } from 'react';
import { SMSModal as Modal } from '@/components/smsorganisms';
import { SMSIcon, SMSIconButton, SMSLoader } from '@/components/smsatoms';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchNotificationHistoryDetailThunk } from '@/store/slices/notificationSlice';
import { showToast } from '@/store/slices/toastSlice';
import { downloadRequestFile } from '@/services/fileUploadService';
import type {
  NotificationHistoryAttachment,
  NotificationHistoryRecipient,
} from '@/types/notification';
import { REQUESTER } from '@/constants/strings';
import { formatDateTime } from '@/utils';
import type { NotificationDetailsModalProps } from './NotificationDetailsModal.types';
import './NotificationDetailsModal.css';

const str = REQUESTER.NOTIFICATION_HISTORY;

const formatFileSize = (size?: number) => {
  if (!size) return '';
  if (size < 1024) return `${size} B`;
  return `${Math.round(size / 1024)} KB`;
};

const recipientLabel = (item: NotificationHistoryRecipient) => {
  const name = item.employeeName?.trim();
  const email = item.email?.trim();
  if (name && email) return `${name} (${email})`;
  return name || email || '—';
};

const recipientSectionLabel = (label: string, count: number) => `${label} (${count}):`;

const RecipientSection: React.FC<{
  label: string;
  recipients: NotificationHistoryRecipient[];
}> = ({ label, recipients }) => (
  <div className="notification-details-modal__section">
    <div className="notification-details-modal__label">{label}</div>
    {recipients.length > 0 ? (
      <ul className="notification-details-modal__list">
        {recipients.map((item, index) => (
          <li key={`${item.email ?? item.employeeName ?? label}-${index}`}>{recipientLabel(item)}</li>
        ))}
      </ul>
    ) : null}
  </div>
);

export const NotificationDetailsModal: React.FC<NotificationDetailsModalProps> = ({
  isOpen,
  onClose,
  notificationHistoryId,
  requestId,
  requesterId,
}) => {
  const dispatch = useAppDispatch();
  const { historyDetail, isLoadingHistoryDetail } = useAppSelector((state) => state.notification);

  useEffect(() => {
    if (!isOpen || !notificationHistoryId) return;
    void dispatch(fetchNotificationHistoryDetailThunk(notificationHistoryId));
  }, [dispatch, isOpen, notificationHistoryId]);

  const renderContent = () => {
    if (isLoadingHistoryDetail) {
      return <SMSLoader />;
    }

    if (!historyDetail) {
      return <div className="notification-details-modal__value">{str.EMPTY}</div>;
    }

    const toList = historyDetail.to ?? [];
    const ccList = historyDetail.cc ?? [];
    const bccList = historyDetail.bcc ?? [];
    const attachments = historyDetail.attachments ?? [];

    return (
      <div className="notification-details-modal">
        <div className="notification-details-modal__section">
          <div className="notification-details-modal__label">{str.SUBJECT}</div>
          <div className="notification-details-modal__value">{historyDetail.subject ?? '—'}</div>
        </div>
        <div className="notification-details-modal__section">
          <div className="notification-details-modal__label">{str.SENT_BY}</div>
          <div className="notification-details-modal__value">{historyDetail.sentBy ?? '—'}</div>
        </div>
        <div className="notification-details-modal__section">
          <div className="notification-details-modal__label">{str.SENT_ON}</div>
          <div className="notification-details-modal__value">
            {historyDetail.sentAt ? formatDateTime(historyDetail.sentAt) : '—'}
          </div>
        </div>

        <RecipientSection label={recipientSectionLabel(str.TO, toList.length)} recipients={toList} />
        <RecipientSection label={recipientSectionLabel(str.CC, ccList.length)} recipients={ccList} />
        <RecipientSection label={recipientSectionLabel(str.BCC, bccList.length)} recipients={bccList} />

        <div className="notification-details-modal__section">
          <div className="notification-details-modal__label">{str.MESSAGE}</div>
          <div className="notification-details-modal__message">{historyDetail.body ?? '—'}</div>
        </div>

        {attachments.length > 0 && (
          <div className="notification-details-modal__section">
            <div className="notification-details-modal__label">
              {str.ATTACHMENT} ({attachments.length})
            </div>
            {attachments.map((file: NotificationHistoryAttachment, index) => (
              <div key={`${file.fileName ?? 'file'}-${index}`} className="notification-details-modal__attachment">
                <SMSIcon name="document" size="sm" className="notification-details-modal__attachment-icon" />
                <div className="notification-details-modal__attachment-info">
                  <span className="notification-details-modal__attachment-name">{file.fileName ?? '—'}</span>
                  <span className="notification-details-modal__attachment-size">
                    {formatFileSize(file.fileSizeBytes)}
                  </span>
                </div>
                {file.fileUploadedId && requesterId && requestId ? (
                  <SMSIconButton
                    tone="primary"
                    size="small"
                    aria-label={str.DOWNLOAD}
                    className="notification-details-modal__download"
                    onClick={() => {
                      void downloadRequestFile(
                        requesterId,
                        requestId,
                        file.fileUploadedId!,
                        file.fileName ?? 'download'
                      ).catch(() => {
                        dispatch(showToast(str.DOWNLOAD_ERROR, 'error'));
                      });
                    }}
                  >
                    <SMSIcon name="download" size="sm" />
                  </SMSIconButton>
                ) : (
                  <span className="notification-details-modal__download notification-details-modal__download--disabled">
                    <SMSIcon name="download" size="sm" />
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={str.DETAILS_TITLE} size="md" fullWidth>
      {renderContent()}
    </Modal>
  );
};
