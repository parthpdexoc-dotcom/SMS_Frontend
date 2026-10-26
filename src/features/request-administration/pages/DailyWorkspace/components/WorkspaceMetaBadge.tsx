import React from 'react';

export type WorkspaceMetaBadgeVariant = 'filled' | 'outline';

export interface WorkspaceMetaBadgeProps {
  children: React.ReactNode;
  variant?: WorkspaceMetaBadgeVariant;
  className?: string;
}

/** Secondary count / meta badge — filled neutral or outlined navy. */
export const WorkspaceMetaBadge: React.FC<WorkspaceMetaBadgeProps> = ({
  children,
  variant = 'filled',
  className = '',
}) => {
  const base = variant === 'outline' ? 'dw-outline-badge' : 'dw-meta-badge';
  return <span className={`${base} ${className}`.trim()}>{children}</span>;
};
