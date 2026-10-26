import React from 'react';
import { SMSMyHistoryTabs } from '@/components/smsorganisms';

export interface SMSMyHistoryListProps {
  employeeId?: string;
  employeeNameOverride?: string;
}

export const SMSMyHistoryList: React.FC<SMSMyHistoryListProps> = ({
  employeeId,
  employeeNameOverride,
}) => {
  return (
    <SMSMyHistoryTabs
      employeeId={employeeId}
      employeeNameOverride={employeeNameOverride}
    />
  );
};

export default SMSMyHistoryList;
