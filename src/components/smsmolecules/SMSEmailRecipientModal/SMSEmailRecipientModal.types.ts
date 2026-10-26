export interface EmailRecipientItem {
  id: string;
  name: string;
  email: string;
  employeeNumber?: string;
  isPlaceholder?: boolean;
}

export interface EmailRecipientPaginationProps {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export interface SMSEmailRecipientModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipients: EmailRecipientItem[];
  selectedRecipients?: EmailRecipientItem[];
  onConfirm: (selected: EmailRecipientItem[]) => void;
  /** Name + email columns only (e.g. Cc/Bcc). Default shows officer columns. */
  nameEmailOnly?: boolean;
  serverSideSearch?: boolean;
  onSearchChange?: (query: string) => void;
  /** Server-side select all: fetches every recipient across all pages. */
  onSelectAll?: () => Promise<EmailRecipientItem[]>;
  pagination?: EmailRecipientPaginationProps;
  title?: string;
}
