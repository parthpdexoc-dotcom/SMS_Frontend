import React from 'react';
import Badge from '@mui/material/Badge';
import { SMSIcon, SMSIconButton, type SMSIconButtonTone } from '@/components/smsatoms';
import './SMSBadgeIconButton.css';

export interface SMSBadgeIconButtonProps {
  icon: string;
  /** Shown on the badge; hidden when 0 or undefined. */
  badgeCount?: number;
  ariaLabel: string;
  title?: string;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  tone?: SMSIconButtonTone;
  size?: 'small' | 'medium' | 'large';
  className?: string;
  iconButtonClassName?: string;
  allowWhenSuspended?: boolean;
}

export const SMSBadgeIconButton: React.FC<SMSBadgeIconButtonProps> = ({
  icon,
  badgeCount,
  ariaLabel,
  title,
  onClick,
  tone = 'default',
  size = 'small',
  className = '',
  iconButtonClassName = '',
  allowWhenSuspended = false,
}) => {
  const rootClass = ['sms-badge-icon-button', className].filter(Boolean).join(' ');

  return (
    <Badge
      badgeContent={badgeCount || undefined}
      color="primary"
      overlap="circular"
      className={rootClass}
    >
      <SMSIconButton
        className={iconButtonClassName}
        tone={tone}
        size={size}
        allowWhenSuspended={allowWhenSuspended}
        onClick={onClick}
        aria-label={ariaLabel}
        title={title ?? ariaLabel}
      >
        <SMSIcon name={icon} size="sm" />
      </SMSIconButton>
    </Badge>
  );
};
