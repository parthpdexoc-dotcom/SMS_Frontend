import React from 'react';
import { SMSChip } from '@/components/smsatoms';

export type SMSStatusBadgeVariant = 'success' | 'error' | 'warning' | 'info' | 'default';

export interface SMSStatusBadgeProps {
  label: string;
  variant?: SMSStatusBadgeVariant;
  size?: 'small' | 'medium';
  icon?: string;
  iconPosition?: 'left' | 'right';
}

export const SMSStatusBadge: React.FC<SMSStatusBadgeProps> = ({
  label,
  variant = 'default',
  size = 'medium',
  icon,
}) => {
  // TODO: Implement status badge with proper color mapping based on variant
  const getColor = () => {
    switch (variant) {
      case 'success':
        return 'success';
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
        return 'info';
      default:
        return 'default';
    }
  };

  return (
    <SMSChip
      label={label}
      color={getColor()}
      size={size}
      icon={icon ? <span>{icon}</span> : undefined}
    />
  );
};

export default SMSStatusBadge;

