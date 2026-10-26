import type { SendEmailContext } from '@/types/notification';

export type { SendEmailContext };

export interface SendEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  context: SendEmailContext | null;
}
