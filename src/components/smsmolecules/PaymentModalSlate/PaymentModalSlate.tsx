import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import React from 'react';
import { SMSCard, SMSIcon, SMSTypography } from '@/components/smsatoms';
import { STATISTIC_LABEL_SX } from '@/components/smsatoms/SMSStatisticCard';
import { INVOICE_GRID, PAYMENT_GRID } from '@/constants/strings';
import type { PaymentModalPaymentInfo } from '@/types/payment';
import type {
  InvoicePaymentSlateInput,
  PaymentModalSlateField,
  PaymentModalSlateProps,
  PaymentModalSummaryStatsInput,
} from '@/types/paymentModalSlate';
import { formatDateShort } from '@/utils';
import { formatPaymentCurrency } from '@/utils/paymentFormat';
import './PaymentModalSlate.css';

const COL = PAYMENT_GRID.REQUESTER_PAYMENT_PAGE.TABLE.COLUMNS;
const PLACEHOLDER = PAYMENT_GRID.EMPTY_PLACEHOLDER;

const paymentTypeLabel = (paymentTypeName?: string | null): string =>
  paymentTypeName?.trim() || '—';

const COMPACT_LABEL_SX = {
  ...STATISTIC_LABEL_SX,
  fontSize: '0.625rem',
  lineHeight: 1.15,
} as const;

const SlateLabel: React.FC<{ label: string; tooltip?: string }> = ({ label, tooltip }) => {
  const typography = (
    <SMSTypography variant="caption" color="text.secondary" sx={COMPACT_LABEL_SX} component="div">
      {label}
    </SMSTypography>
  );

  if (!tooltip) return typography;

  return (
    <Tooltip title={tooltip} placement="top" arrow describeChild>
      <span className="payment-modal-slate__label-tooltip-target" tabIndex={0} aria-label={tooltip}>
        {typography}
      </span>
    </Tooltip>
  );
};

const slateValueColor = (valueTone: PaymentModalSlateField['valueTone']) => {
  if (valueTone === 'due') return 'error' as const;
  if (valueTone === 'paid') return 'success' as const;
  if (valueTone === 'remaining') return 'warning' as const;
  return undefined;
};

const SlateCell: React.FC<PaymentModalSlateField> = ({
  label,
  labelTooltip,
  value,
  sub,
  valueTone = 'default',
  showEditIcon = false,
  onEditClick,
  editAriaLabel,
}) => (
  <div className="payment-modal-slate__cell">
    <SlateLabel label={label} tooltip={labelTooltip} />
    <div className="payment-modal-slate__value-row">
      {typeof value === 'string' || typeof value === 'number' ? (
        <SMSTypography
          component="div"
          color={slateValueColor(valueTone)}
          className={`payment-modal-slate__value payment-modal-slate__value--${valueTone}`}
        >
          {value}
        </SMSTypography>
      ) : (
        <div className={`payment-modal-slate__value payment-modal-slate__value--${valueTone}`}>{value}</div>
      )}
      {showEditIcon && onEditClick ? (
        <IconButton
          type="button"
          size="small"
          className="payment-modal-slate__edit-btn"
          onClick={onEditClick}
          aria-label={editAriaLabel ?? 'Edit'}
        >
          <SMSIcon name="edit" size="sm" />
        </IconButton>
      ) : null}
    </div>
    {sub ? (
      <SMSTypography variant="body2" color="text.secondary" className="payment-modal-slate__sub" title={String(sub)}>
        {sub}
      </SMSTypography>
    ) : null}
  </div>
);

const SlateStatsRow: React.FC<{
  stats: PaymentModalSlateField[];
  ariaLabel: string;
  className?: string;
}> = ({ stats, ariaLabel, className }) => (
  <div
    className={className ?? 'payment-modal-slate__row payment-modal-slate__row--summary'}
    role="group"
    aria-label={ariaLabel}
    style={{ '--slate-cols': stats.length } as React.CSSProperties}
  >
    {stats.map(({ key, ...field }) => (
      <SlateCell key={key} {...field} />
    ))}
  </div>
);

export const buildInvoicePaymentMetaFields = (
  input: InvoicePaymentSlateInput
): PaymentModalSlateField[] => {
  const P = INVOICE_GRID.PAYMENT;
  const ph = INVOICE_GRID.EMPTY_PLACEHOLDER;
  return [
    {
      key: 'invoiceNo',
      label: P.INVOICE_NUMBER,
      value: input.invoiceNo?.trim() || ph,
      sub: input.billingToName?.trim() || undefined,
    },
    {
      key: 'invoiceDate',
      label: P.INVOICE_DATE,
      value: input.dateCreated ? formatDateShort(input.dateCreated) : ph,
    },
    {
      key: 'dueDate',
      label: P.DUE_DATE,
      value: input.dueDate ? formatDateShort(input.dueDate) : ph,
      valueTone: 'due',
    },
  ];
};

export const buildInvoicePaymentStats = (
  input: InvoicePaymentSlateInput,
  formatAmount: (value: number) => React.ReactNode
): PaymentModalSlateField[] => {
  const S = INVOICE_GRID.PAYMENT.SUMMARY;
  return [
    { key: 'total', label: S.INVOICE_TOTAL, value: formatAmount(input.invoiceTotal) },
    {
      key: 'paid',
      label: S.PAID,
      value: formatAmount(input.amountPaid),
      valueTone: 'paid',
    },
    {
      key: 'remaining',
      label: S.INVOICE_DUE,
      value: formatAmount(input.amountRemaining),
      valueTone: input.amountRemaining > 0.001 ? 'due' : 'default',
    },
  ];
};

export const buildPaymentInfoMetaFields = (
  paymentInfo: PaymentModalPaymentInfo
): PaymentModalSlateField[] => {
  const paymentNumber =
    paymentInfo.paymentNumber != null && String(paymentInfo.paymentNumber).trim() !== ''
      ? String(paymentInfo.paymentNumber)
      : PLACEHOLDER;
  const paymentDate = paymentInfo.paymentDate
    ? formatDateShort(paymentInfo.paymentDate)
    : PLACEHOLDER;
  const paymentType =
    paymentTypeLabel(paymentInfo.paymentTypeName) || PLACEHOLDER;
  const referenceNumber = paymentInfo.referenceNumber?.trim() || PLACEHOLDER;
  const requesterSubtext = paymentInfo.requesterName?.trim() || null;

  return [
    {
      key: 'paymentNumber',
      label: COL.PAYMENT_NUMBER,
      value: paymentNumber,
      sub: requesterSubtext,
    },
    { key: 'paymentDate', label: COL.DATE, value: paymentDate },
    { key: 'paymentType', label: COL.PAYMENT_TYPE, value: paymentType },
    { key: 'referenceNumber', label: COL.REFERENCE_NUMBER, value: referenceNumber },
  ];
};

const MODAL_SLATE = PAYMENT_GRID.MODAL_SLATE_STATS;

export type PaymentModalSummaryStatsLabels = {
  TOTAL_PAYMENT: string;
  TOTAL_PAYMENT_TOOLTIP?: string;
  TOTAL_PAID: string;
  TOTAL_PAID_TOOLTIP?: string;
  TOTAL_REFUNDED: string;
  TOTAL_REFUNDED_TOOLTIP?: string;
  AVAILABLE_BALANCE: string;
  AVAILABLE_BALANCE_TOOLTIP?: string;
};

/** Shared payment stat row for Payment Detail and Apply Payment modals. */
export const buildPaymentModalSummaryStats = (
  input: PaymentModalSummaryStatsInput,
  labels: PaymentModalSummaryStatsLabels = MODAL_SLATE
): PaymentModalSlateField[] => {
  const refundedAmount = input.refundedAmount ?? 0;
  const available =
    input.remainingAvailableBalance ??
    input.availableBalance ??
    Math.max(0, input.totalPayment - input.paymentUsed - refundedAmount);

  return [
    {
      key: 'totalPayment',
      label: labels.TOTAL_PAYMENT,
      labelTooltip: labels.TOTAL_PAYMENT_TOOLTIP,
      value: formatPaymentCurrency(input.totalPayment),
    },
    {
      key: 'totalPaymentUsed',
      label: labels.TOTAL_PAID,
      labelTooltip: labels.TOTAL_PAID_TOOLTIP,
      value: formatPaymentCurrency(input.paymentUsed),
      valueTone: 'due',
    },
    {
      key: 'refundedAmount',
      label: labels.TOTAL_REFUNDED,
      labelTooltip: labels.TOTAL_REFUNDED_TOOLTIP,
      value: formatPaymentCurrency(refundedAmount),
      valueTone: refundedAmount > 0.001 ? 'due' : 'default',
    },
    {
      key: 'availableBalance',
      label: labels.AVAILABLE_BALANCE,
      labelTooltip: labels.AVAILABLE_BALANCE_TOOLTIP,
      value: formatPaymentCurrency(available),
      valueTone: available < -0.001 ? 'due' : available > 0.001 ? 'paid' : 'default',
    },
  ];
};

export const PaymentModalSlate: React.FC<PaymentModalSlateProps> = ({
  metaFields,
  stats,
  secondaryStats,
  metaAriaLabel = 'Details',
  statsAriaLabel = 'Amounts',
  secondaryStatsAriaLabel = 'Adjusted amounts',
}) => {
  const metaColCount = metaFields?.length ?? 0;

  return (
    <SMSCard variant="outlined" padding="none" className="payment-modal-slate">
      {metaFields && metaFields.length > 0 ? (
        <div
          className="payment-modal-slate__row payment-modal-slate__row--meta"
          role="group"
          aria-label={metaAriaLabel}
          style={{ '--slate-cols': metaColCount } as React.CSSProperties}
        >
          {metaFields.map(({ key, ...field }) => (
            <SlateCell key={key} {...field} />
          ))}
        </div>
      ) : null}

      <SlateStatsRow stats={stats} ariaLabel={statsAriaLabel} />

      {secondaryStats && secondaryStats.length > 0 ? (
        <SlateStatsRow
          stats={secondaryStats}
          ariaLabel={secondaryStatsAriaLabel}
          className="payment-modal-slate__row payment-modal-slate__row--summary payment-modal-slate__row--adjusted"
        />
      ) : null}
    </SMSCard>
  );
};
