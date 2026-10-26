export interface NotificationHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  requestId?: string;
  postId?: string;
  postPositionId?: string;
  requesterId?: string;
  title?: string;
}
