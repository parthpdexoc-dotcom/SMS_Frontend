import type { ReactElement } from 'react';

/** Custom SVG icons used when Material Symbols are not a good fit. */
export const CUSTOM_SVG_ICONS: Record<string, ReactElement> = {
  /**
   * Assigned History — assignment list + history clock.
   * Used on Daily Admin Status column when history mode is off.
   */
  assigned_history: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M8.5 3.75h7c.69 0 1.25.56 1.25 1.25v1.1h.75A1.75 1.75 0 0 1 19.25 7.85v5.4a6.25 6.25 0 1 0-8.9 5.65H8.5A1.75 1.75 0 0 1 6.75 17.15V5A1.25 1.25 0 0 1 8.5 3.75Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M9.75 4.35h4.5v.95a.75.75 0 0 1-.75.75h-3a.75.75 0 0 1-.75-.75v-.95Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M9.25 9.25h5.5M9.25 12h3.75"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="16.75" cy="16.75" r="4.1" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M16.75 14.85v2.05l1.35.9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),

  /**
   * Current Assigned — person with check badge.
   * Used on Daily Admin Status column when history mode is on.
   */
  current_assigned: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <circle cx="10" cy="8" r="3.1" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M4.75 18.25c.7-2.85 2.95-4.5 5.25-4.5 1.05 0 2.05.35 2.9.95"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="17.25" cy="16.5" r="4" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M15.55 16.55l1.15 1.15 2.2-2.35"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
};
