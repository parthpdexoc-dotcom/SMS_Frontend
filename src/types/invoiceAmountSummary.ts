import type { ReactNode } from 'react';

export interface InvoiceAmountSummaryRow {
  key: string;
  label: string;
  value: ReactNode;
  variant?: 'default' | 'total' | 'error';
}

export interface InvoiceAmountSummaryBoxProps {
  /** Optional heading shown at the top of the summary box. */
  title?: string;
  rows: InvoiceAmountSummaryRow[];
}
