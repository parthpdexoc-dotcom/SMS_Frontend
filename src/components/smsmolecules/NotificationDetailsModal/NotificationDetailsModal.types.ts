export interface NotificationDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notificationHistoryId: string;
  requestId?: string;
  requesterId?: string;
}
