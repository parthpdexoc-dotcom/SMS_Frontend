import React, { useMemo } from 'react';
import { StatisticSlate } from '@/components/smsmolecules/StatisticSlate';
import { formatPaymentCurrency } from '@/utils/paymentFormat';
import type { RequesterPaymentSummaryGridProps } from '@/types/requesterPaymentPage';
import { S } from './constants';

export const RequesterPaymentSummaryGrid: React.FC<RequesterPaymentSummaryGridProps> = ({
  totalAmount,
  totalInvoiceDueAmount,
  totalAppliedAmount,
  totalRefundedAmount,
  requesterAvailableAmount,
  totalAvailableAmount,
}) => {
  const items = useMemo(
    () => [
      {
        key: 'totalPayment',
        label: S.SUMMARY.TOTAL_PAYMENT,
        labelTooltip: S.SUMMARY.TOTAL_PAYMENT_TOOLTIP,
        value: formatPaymentCurrency(totalAmount ?? 0),
      },
      {
        key: 'remainingPayment',
        label: S.SUMMARY.REMAINING_PAYMENT,
        labelTooltip: S.SUMMARY.REMAINING_PAYMENT_TOOLTIP,
        value: formatPaymentCurrency(totalInvoiceDueAmount ?? 0),
        valueTone: 'remaining' as const,
      },
      {
        key: 'totalPaid',
        label: S.SUMMARY.TOTAL_PAID,
        labelTooltip: S.SUMMARY.TOTAL_PAID_TOOLTIP,
        value: formatPaymentCurrency(totalAppliedAmount ?? 0),
        valueTone: 'paid' as const,
      },
      {
        key: 'totalRefunded',
        label: S.SUMMARY.TOTAL_REFUNDED,
        labelTooltip: S.SUMMARY.TOTAL_REFUNDED_TOOLTIP,
        value: formatPaymentCurrency(totalRefundedAmount ?? 0),
        valueTone: totalRefundedAmount != null && totalRefundedAmount > 0.001 ? ('due' as const) : undefined,
      },
      {
        key: 'availableBalance',
        label: S.SUMMARY.AVAILABLE_BALANCE,
        labelTooltip: S.SUMMARY.AVAILABLE_BALANCE_TOOLTIP,
        value: formatPaymentCurrency(requesterAvailableAmount ?? totalAvailableAmount ?? 0),
      },
    ],
    [
      totalAmount,
      totalAppliedAmount,
      totalRefundedAmount,
      totalAvailableAmount,
      totalInvoiceDueAmount,
      requesterAvailableAmount,
    ]
  );

  return (
    <StatisticSlate
      className="requester-payment-page__summary"
      gridTemplateColumns={{
        xs: '1fr',
        sm: 'repeat(2, minmax(0, 1fr))',
        md: 'repeat(5, minmax(0, 1fr))',
      }}
      items={items}
    />
  );
};
