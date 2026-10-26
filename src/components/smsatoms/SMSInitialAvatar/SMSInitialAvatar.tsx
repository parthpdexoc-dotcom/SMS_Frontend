import React from 'react';
import './SMSInitialAvatar.css';

export type SMSInitialAvatarSize = 'sm' | 'md' | 'lg';

export interface SMSInitialAvatarProps {
  /** Display name / welcome line — used for accessibility and as fallback for the glyph. */
  displayName: string;
  /**
   * When set (e.g. last name), first alphanumeric of this string is shown; otherwise derived from `displayName`.
   */
  initialFrom?: string;
  size?: SMSInitialAvatarSize;
  className?: string;
  /**
   * Accessibility: when `true`, hides from assistive tech (e.g. inside a labeled button or next to duplicate text).
   * When `false`, exposes `aria-label` (use `ariaLabel` or falls back to displayName).
   */
  decorative?: boolean;
  'aria-label'?: string;
}

function initialFromDisplayName(label: string): string {
  const t = label.trim();
  if (!t) return '?';
  const m = t.match(/[A-Za-z0-9]/);
  return m ? m[0].toUpperCase() : '?';
}

export const SMSInitialAvatar: React.FC<SMSInitialAvatarProps> = ({
  displayName,
  initialFrom,
  size = 'md',
  className = '',
  decorative = false,
  'aria-label': ariaLabel,
}) => {
  const initialSource = initialFrom?.trim() ? initialFrom.trim() : displayName;
  const initial = initialFromDisplayName(initialSource);
  const label = ariaLabel ?? displayName;

  return (
    <span
      className={`sms-initial-avatar sms-initial-avatar--${size} ${className}`.trim()}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : label}
      role={decorative ? undefined : 'img'}
    >
      {initial}
    </span>
  );
};
