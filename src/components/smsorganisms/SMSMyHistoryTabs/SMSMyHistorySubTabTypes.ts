import type React from 'react';

export const HISTORY_SUB_TAB_ID = {
  CLOSED: 'closed',
  CANCELLED: 'cancelled',
  DECLINED_JOB: 'declined-job',
  FAILED_TRANSACTIONS: 'failed-transactions',
} as const;

export type HistorySubTabId =
  (typeof HISTORY_SUB_TAB_ID)[keyof typeof HISTORY_SUB_TAB_ID];

export interface SMSMyHistorySubTabSharedProps {
  underTitleContent: React.ReactNode;
  employeeId?: string;
  employeeNameOverride?: string;
}
