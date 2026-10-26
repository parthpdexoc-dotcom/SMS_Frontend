import type { ReactNode } from 'react';
import type { StatisticValueTone } from '@/types/statisticSlate';

export interface PaymentModalSlateField {
  key: string;
  label: string;
  /** Shown on label hover when provided. */
  labelTooltip?: string;
  value: ReactNode;
  sub?: ReactNode;
  valueTone?: StatisticValueTone;
  /** Shows an edit icon beside the value (e.g. payment amount on review screen). */
  showEditIcon?: boolean;
  onEditClick?: () => void;
  editAriaLabel?: string;
}

export interface PaymentModalSlateProps {
  metaFields?: PaymentModalSlateField[];
  stats: PaymentModalSlateField[];
  /** Second summary row shown when adjusting payment amount. */
  secondaryStats?: PaymentModalSlateField[];
  metaAriaLabel?: string;
  statsAriaLabel?: string;
  secondaryStatsAriaLabel?: string;
}

export interface InvoicePaymentSlateInput {
  invoiceNo?: string | null;
  billingToName?: string | null;
  dateCreated?: string | null;
  dueDate?: string | null;
  invoiceTotal: number;
  amountPaid: number;
  amountRemaining: number;
}

export interface PaymentModalSummaryStatsInput {
  totalPayment: number;
  paymentUsed: number;
  invoiceDueTotal: number;
  /** Refund allocation total for this payment. */
  refundedAmount?: number;
  /** Escrow / available balance (omit to derive from total − used − refunded). */
  availableBalance?: number;
  /** When applying to invoices, pass balance after current selection. */
  remainingAvailableBalance?: number;
}
