import React from 'react';

export type WorkspaceStatusPillVariant = 'neutral' | 'assigned';

export interface WorkspaceStatusPillProps {
  children: React.ReactNode;
  variant?: WorkspaceStatusPillVariant;
  className?: string;
}

/** Filled status pill — green for assigned, gray for everything else. */
export const WorkspaceStatusPill: React.FC<WorkspaceStatusPillProps> = ({
  children,
  variant = 'neutral',
  className = '',
}) => (
  <span className={`dw-status-pill dw-status-pill--${variant} ${className}`.trim()}>{children}</span>
);
