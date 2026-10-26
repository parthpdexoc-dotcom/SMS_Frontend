import React, { useMemo } from 'react';
import { StatisticSlate } from '@/components/smsmolecules/StatisticSlate';
import { formatPaymentCurrency } from '@/utils/paymentFormat';
import { S } from './constants';

export interface RequesterStatementSummaryGridProps {
  openingBalance?: number | null;
  totalInvoices?: number | null;
  totalPayment?: number | null;
  outstandingInvoices?: number | null;
}

export const RequesterStatementSummaryGrid: React.FC<RequesterStatementSummaryGridProps> = ({
  openingBalance,
  totalInvoices,
  totalPayment,
  outstandingInvoices,
}) => {
  const items = useMemo(
    () => [
      {
        key: 'openingBalance',
        label: S.SUMMARY.OPENING_BALANCE,
        labelTooltip: S.SUMMARY.OPENING_BALANCE_TOOLTIP,
        value: formatPaymentCurrency(openingBalance ?? 0),
      },
      {
        key: 'totalInvoices',
        label: S.SUMMARY.TOTAL_INVOICES,
        labelTooltip: S.SUMMARY.TOTAL_INVOICES_TOOLTIP,
        value: formatPaymentCurrency(totalInvoices ?? 0),
        valueTone: 'due' as const,
      },
      {
        key: 'totalPayment',
        label: S.SUMMARY.TOTAL_PAYMENT,
        labelTooltip: S.SUMMARY.TOTAL_PAYMENT_TOOLTIP,
        value: formatPaymentCurrency(totalPayment ?? 0),
        valueTone: 'paid' as const,
      },
      {
        key: 'outstandingInvoices',
        label: S.SUMMARY.OUTSTANDING_INVOICES,
        labelTooltip: S.SUMMARY.OUTSTANDING_INVOICES_TOOLTIP,
        value: formatPaymentCurrency(outstandingInvoices ?? 0),
      },
    ],
    [openingBalance, totalInvoices, totalPayment, outstandingInvoices]
  );

  return (
    <StatisticSlate
      className="requester-statement-page__summary"
      gridTemplateColumns={{
        xs: '1fr',
        sm: 'repeat(2, minmax(0, 1fr))',
        md: 'repeat(4, minmax(0, 1fr))',
      }}
      items={items}
    />
  );
};
