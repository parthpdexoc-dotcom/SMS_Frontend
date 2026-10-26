import type { CardProps } from '@mui/material/Card';
import React, { PropsWithChildren } from 'react';
import { SMSCard } from '@/components/smsatoms';
import { cn } from '@/utils';
import '../../department-administration/pages/Settings/Settings.css';

type ReportsPageShellProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  className?: string;
  cardSx?: CardProps['sx'];
  fillViewport?: boolean;
}>;

export const ReportsPageShell: React.FC<ReportsPageShellProps> = ({
  title,
  subtitle = 'Report content will be available here.',
  className,
  cardSx,
  fillViewport = false,
  children,
}) => (
  <div className={cn('settings', fillViewport && 'reports-list-page', className)}>
    <div className="settings__header">
      <h1 className="settings__title">{title}</h1>
      <p className="settings__subtitle">{subtitle}</p>
    </div>
    <SMSCard
      className="settings__card"
      sx={[{ p: 'var(--spacing-lg)' }, ...(cardSx != null ? [cardSx] : [])] as CardProps['sx']}
    >
      {fillViewport ? (
        <div className="reports-list-page__body">{children}</div>
      ) : (
        children ?? <p className="settings__section-description">This page is under construction.</p>
      )}
    </SMSCard>
  </div>
);