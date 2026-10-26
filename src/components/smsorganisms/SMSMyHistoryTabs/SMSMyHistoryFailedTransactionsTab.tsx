import React from 'react';
import { AVAILABLE_POST } from '@/constants/strings';
import { SMSFailedTransactionsList } from '@/components/smsorganisms/SMSFailedTransactionsList/SMSFailedTransactionsList';
import type { SMSMyHistorySubTabSharedProps } from './SMSMyHistorySubTabTypes';

export const SMSMyHistoryFailedTransactionsTab: React.FC<SMSMyHistorySubTabSharedProps> = ({
  underTitleContent,
  employeeId,
}) => {
  return (
    <div className="post-position-by-status-list">
      <div className="post-position-by-status-list__header">
        <h2 className="post-position-by-status-list__title">
          {AVAILABLE_POST.TAB_TITLES.MY_HISTORY}
        </h2>
        <div className="post-position-by-status-list__under-title">
          {underTitleContent}
        </div>
      </div>
      <SMSFailedTransactionsList key={employeeId ?? '__self'} employeeId={employeeId} />
    </div>
  );
};

