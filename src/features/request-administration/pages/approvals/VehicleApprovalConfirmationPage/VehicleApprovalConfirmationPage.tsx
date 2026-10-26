import React from 'react';
import { useLocation } from 'react-router-dom';
import { SMSApprovalConfirmationPage } from '@/components/smsorganisms';
import { APPROVAL_CONFIRMATION } from '@/constants/strings';

export const VehicleApprovalConfirmationPage: React.FC = () => {
  const { pathname } = useLocation();
  const isPermit = pathname.includes('/admin/permit-approval');
  return (
    <SMSApprovalConfirmationPage
      title={isPermit ? APPROVAL_CONFIRMATION.PERMIT.TITLE : APPROVAL_CONFIRMATION.VEHICLE.TITLE}
      subtitle={APPROVAL_CONFIRMATION.COMMON_SUBTITLE}
      body={
        isPermit
          ? APPROVAL_CONFIRMATION.PERMIT.BODY
          : APPROVAL_CONFIRMATION.VEHICLE.BODY
      }
    />
  );
};

