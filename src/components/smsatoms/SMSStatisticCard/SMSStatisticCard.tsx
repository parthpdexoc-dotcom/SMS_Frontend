import Tooltip from '@mui/material/Tooltip';
import React from 'react';
import { SMSCard } from '../SMSCard';
import { SMSStack } from '../SMSStack';
import { SMSTypography } from '../SMSTypography';
import type { StatisticCardProps, StatisticValueTone } from '@/types/statisticSlate';
import './SMSStatisticCard.css';

export const STATISTIC_LABEL_SX = {
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  fontWeight: 600,
  fontSize: '0.6875rem',
  lineHeight: 1.2,
} as const;

const STATISTIC_VALUE_SX = {
  fontSize: '1.125rem',
  fontWeight: 700,
  lineHeight: 1.25,
  fontVariantNumeric: 'tabular-nums',
} as const;

const VALUE_COLOR: Record<StatisticValueTone, string | undefined> = {
  default: 'text.primary',
  paid: 'success.main',
  remaining: 'warning.main',
  due: 'error.main',
};

const StatLabel: React.FC<{ label: string; tooltip?: string }> = ({ label, tooltip }) => {
  const typography = (
    <SMSTypography variant="caption" color="text.secondary" sx={STATISTIC_LABEL_SX}>
      {label}
    </SMSTypography>
  );

  if (!tooltip) return typography;

  return (
    <Tooltip title={tooltip} placement="top" arrow describeChild>
      <span className="sms-statistic-card__label-tooltip-target" tabIndex={0} aria-label={tooltip}>
        {typography}
      </span>
    </Tooltip>
  );
};

/** Single statistic card (label + value). */
export const SMSStatisticCard: React.FC<StatisticCardProps> = ({
  label,
  labelTooltip,
  value,
  sub,
  valueTone = 'default',
}) => (
  <SMSCard variant="outlined" padding="sm" sx={{ height: '100%' }}>
    <SMSStack spacing={0.5}>
      <StatLabel label={label} tooltip={labelTooltip} />
      <SMSTypography component="p" sx={{ ...STATISTIC_VALUE_SX, color: VALUE_COLOR[valueTone], m: 0 }}>
        {value}
      </SMSTypography>
      {sub ? (
        <SMSTypography variant="body2" color="primary" fontWeight={600} sx={{ fontSize: '0.8125rem' }}>
          {sub}
        </SMSTypography>
      ) : null}
    </SMSStack>
  </SMSCard>
);
