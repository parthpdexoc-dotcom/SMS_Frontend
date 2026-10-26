import React from 'react';
import { SMSIconButton, type SMSIconButtonProps } from '@/components/smsatoms';

export interface WorkspaceIconButtonProps extends SMSIconButtonProps {
  /** Destructive actions use existing danger tone (red already in theme). */
  danger?: boolean;
}

/**
 * Lightweight icon control for Daily Workspace actions (edit, clone, transfer, etc.).
 * Plain (no border/fill) so chips and labels stay visually primary.
 */
export const WorkspaceIconButton: React.FC<WorkspaceIconButtonProps> = ({
  danger = false,
  variant = 'plain',
  tone,
  className = '',
  size = 'small',
  ...props
}) => (
  <SMSIconButton
    size={size}
    variant={variant}
    tone={tone ?? (danger ? 'error' : 'default')}
    className={`dw-icon-btn ${className}`.trim()}
    {...props}
  />
);
