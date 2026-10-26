import { SMSButton } from '@/components/smsatoms';
import { buildAvailableJobsLandingPathWithQuery } from '@/constants/availableJobsRouteTabs';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SMSFormPage } from '@/components/smsorganisms';

export interface SMSApprovalConfirmationPageProps {
  title: string;
  subtitle: string;
  body: string;
}

export const SMSApprovalConfirmationPage: React.FC<SMSApprovalConfirmationPageProps> = ({
  title,
  subtitle,
  body,
}) => {
  const navigate = useNavigate();

  return (
    <SMSFormPage title={title} subtitle={subtitle} hideBackButton>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
          alignItems: 'flex-start',
        }}
      >
        <p style={{ margin: 0 }}>{body}</p>
        <SMSButton onClick={() => navigate(buildAvailableJobsLandingPathWithQuery())} type="button">
          Back to Available Jobs
        </SMSButton>
      </div>
    </SMSFormPage>
  );
};
