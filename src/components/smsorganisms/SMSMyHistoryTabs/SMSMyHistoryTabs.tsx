import React, { useCallback, useMemo, useState } from 'react';
import './SMSMyHistoryTabs.css';
import { SMSTabOption, SMSTabs } from '@/components/smsatoms/SMSTabs';
import { HISTORY_SUB_TAB_ID, type HistorySubTabId } from './SMSMyHistorySubTabTypes';
import { SMSMyHistoryClosedJobsTab } from './SMSMyHistoryClosedJobsTab';
import { SMSMyHistoryCancelledJobsTab } from './SMSMyHistoryCancelledJobsTab';
import { SMSMyHistoryDeclinedJobsTab } from './SMSMyHistoryDeclinedJobsTab';
import { SMSMyHistoryFailedTransactionsTab } from './SMSMyHistoryFailedTransactionsTab';

const SUB_TAB_ITEMS: SMSTabOption[] = [
  { id: HISTORY_SUB_TAB_ID.CLOSED, label: 'Closed Jobs', icon: 'block' },
  { id: HISTORY_SUB_TAB_ID.CANCELLED, label: 'Cancelled Jobs', icon: 'cancel' },
  { id: HISTORY_SUB_TAB_ID.DECLINED_JOB, label: 'Declined Jobs', icon: 'thumb_down' },
  { id: HISTORY_SUB_TAB_ID.FAILED_TRANSACTIONS, label: 'Failed Transactions', icon: 'error' },
];

export interface SMSMyHistoryTabsProps {
  /** Optional: view history for a specific employee (e.g. supervisor view). */
  employeeId?: string;
  /** Optional: override employee display name in Close/Split forms. */
  employeeNameOverride?: string;
}

export const SMSMyHistoryTabs: React.FC<SMSMyHistoryTabsProps> = ({
  employeeId,
  employeeNameOverride,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<HistorySubTabId>(HISTORY_SUB_TAB_ID.CLOSED);

  const handleSubTabChange = useCallback((id: string) => {
    if (Object.values(HISTORY_SUB_TAB_ID).includes(id as HistorySubTabId)) {
      setActiveSubTab(id as HistorySubTabId);
    }
  }, []);

  const underTitleContent = useMemo(
    () => (
      <div className="my-history-tabs">
        <SMSTabs
          options={SUB_TAB_ITEMS}
          value={activeSubTab}
          onChange={handleSubTabChange}
        />
      </div>
    ),
    [activeSubTab, handleSubTabChange]
  );

  switch (activeSubTab) {
    case HISTORY_SUB_TAB_ID.CLOSED:
      return (
        <SMSMyHistoryClosedJobsTab
          underTitleContent={underTitleContent}
          employeeId={employeeId}
          employeeNameOverride={employeeNameOverride}
        />
      );
    case HISTORY_SUB_TAB_ID.CANCELLED:
      return (
        <SMSMyHistoryCancelledJobsTab
          underTitleContent={underTitleContent}
          employeeId={employeeId}
          employeeNameOverride={employeeNameOverride}
        />
      );
    case HISTORY_SUB_TAB_ID.DECLINED_JOB:
      return (
        <SMSMyHistoryDeclinedJobsTab
          underTitleContent={underTitleContent}
          employeeId={employeeId}
          employeeNameOverride={employeeNameOverride}
        />
      );
    case HISTORY_SUB_TAB_ID.FAILED_TRANSACTIONS:
      return (
        <SMSMyHistoryFailedTransactionsTab
          underTitleContent={underTitleContent}
          employeeId={employeeId}
          employeeNameOverride={employeeNameOverride}
        />
      );
    default:
      return null;
  }
};
