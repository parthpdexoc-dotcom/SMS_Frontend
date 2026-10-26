import React from 'react';
import { AVAILABLE_POST } from '@/constants/strings';
import { PostPositionByStatusList } from '@/components/smsmolecules/PostPositionByStatusList';
import { PostPositionStatus } from '@/types/postPosition';

export interface SMSJobReadyToCloseListProps {
  employeeId?: string;
  employeeNameOverride?: string;
  title?: string;
  underTitleContent?: React.ReactNode;
}

export const SMSJobReadyToCloseList: React.FC<SMSJobReadyToCloseListProps> = ({
  employeeId,
  employeeNameOverride,
  title = AVAILABLE_POST.TAB_TITLES.CLOSE_POST,
  underTitleContent,
}) => {
  return (
    <PostPositionByStatusList
      statusEnum={PostPositionStatus.Assigned}
      isOngoing={true}
      title={title}
      underTitleContent={underTitleContent}
      employeeId={employeeId}
      employeeNameOverride={employeeNameOverride}
    />
  );
};

export default SMSJobReadyToCloseList;
