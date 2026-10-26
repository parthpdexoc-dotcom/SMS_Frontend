import React from 'react';
import { AVAILABLE_POST } from '@/constants/strings';
import { PostPositionStatus } from '@/types/postPosition';
import { PostPositionByStatusList } from '@/components/smsmolecules/PostPositionByStatusList';
import type { SMSMyHistorySubTabSharedProps } from './SMSMyHistorySubTabTypes';

export const SMSMyHistoryDeclinedJobsTab: React.FC<SMSMyHistorySubTabSharedProps> = ({
  underTitleContent,
  employeeId,
  employeeNameOverride,
}) => {
  return (
    <PostPositionByStatusList
      statusEnum={PostPositionStatus.Declined}
      isOngoing={false}
      title={AVAILABLE_POST.TAB_TITLES.MY_HISTORY}
      underTitleContent={underTitleContent}
      employeeId={employeeId}
      employeeNameOverride={employeeNameOverride}
    />
  );
};

