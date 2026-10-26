import type { NotificationRecipient } from '@/types/notification';

export interface SMSEmailRecipientFieldProps {
  label: string;
  required?: boolean;
  addRecipientsLabel: string;
  selected: NotificationRecipient[];
  onAdd: () => void;
  onRemove: (employeeId: string) => void;
  /** Locks the field: hides chip remove buttons and disables the add button. */
  disabled?: boolean;
  className?: string;
}
