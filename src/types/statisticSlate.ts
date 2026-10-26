import type { ReactNode } from 'react';
import type { SxProps, Theme } from '@mui/material/styles';

export type StatisticValueTone = 'default' | 'paid' | 'remaining' | 'due';

export interface StatisticCardProps {
  label: string;
  /** Shown on label hover when provided. */
  labelTooltip?: string;
  value: ReactNode;
  sub?: ReactNode;
  valueTone?: StatisticValueTone;
}

export interface StatisticSlateItem extends StatisticCardProps {
  key: string;
}

export interface StatisticSlateProps {
  items: StatisticSlateItem[];
  className?: string;
  /** CSS grid `grid-template-columns` per breakpoint (uses flexible grid layout). */
  gridTemplateColumns?: {
    xs?: string;
    sm?: string;
    md?: string;
    lg?: string;
    xl?: string;
  };
  /** MUI 12-column grid when `gridTemplateColumns` is omitted. */
  columns?: {
    xs?: number;
    sm?: number;
    md?: number;
    lg?: number;
  };
  sx?: SxProps<Theme>;
}
