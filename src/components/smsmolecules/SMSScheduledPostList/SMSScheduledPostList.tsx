import React from 'react';
import { AVAILABLE_POST } from '@/constants/strings';
import { PostPositionByStatusList } from '@/components/smsmolecules/PostPositionByStatusList';
import { PostPositionStatus } from '@/types/postPosition';

export interface SMSScheduledPostListProps {
  employeeId?: string;
  employeeNameOverride?: string;
  title?: string;
  underTitleContent?: React.ReactNode;
}

export const SMSScheduledPostList: React.FC<SMSScheduledPostListProps> = ({
  employeeId,
  employeeNameOverride,
  title = AVAILABLE_POST.TAB_TITLES.SCHEDULED_POST,
  underTitleContent,
}) => {
  return (
    <PostPositionByStatusList
      statusEnum={PostPositionStatus.Assigned}
      isOngoing={false}
      title={title}
      underTitleContent={underTitleContent}
      employeeId={employeeId}
      employeeNameOverride={employeeNameOverride}
    />
  );
};

export default SMSScheduledPostList;
