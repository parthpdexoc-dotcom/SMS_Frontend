import type { InvoiceDto } from '@/types/invoice';

export interface RequesterInvoiceDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  requesterId?: string;
  requesterName?: string;
  /** Reserved for when settlement is wired to the API. */
  onSettled?: () => void;
}

export type RequesterInvoiceSettlementStatus = 'paid' | 'unpaid';

export interface RequesterInvoiceTableRow {
  invoicesId: string;
  invoiceNo: string;
  invoiceDate: string;
  invoiceAmount: number;
  paid: number;
  remaining: number;
  status: RequesterInvoiceSettlementStatus;
  invoice: InvoiceDto;
}

export interface RequesterInvoiceDetailsSummary {
  totalInvoices: number;
  totalInvoiceAmount: number;
  totalPaid: number;
  totalRemaining: number;
  availablePaymentBalance: number;
}

export interface RequesterInvoiceDetailsView {
  requesterId: string;
  requesterName: string;
  summary: RequesterInvoiceDetailsSummary;
  invoices: RequesterInvoiceTableRow[];
}

/** Summary from GET /Invoice/by-requester/details */
export interface RequesterInvoiceDetailsApiSummary {
  requesterName?: string | null;
  totalInvoices: number;
  totalInvoiceAmount: number;
  totalPaid: number;
  totalRemaining: number;
  availableBalance: number;
}

/** Response from GET /Invoice/by-requester/details */
export interface RequesterInvoiceDetailsApiResponse {
  summary: RequesterInvoiceDetailsApiSummary;
  invoices: {
    totalRecords: number;
    data: InvoiceDto[];
  };
}
