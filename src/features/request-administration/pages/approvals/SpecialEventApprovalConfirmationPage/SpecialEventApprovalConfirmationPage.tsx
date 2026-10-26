import React from 'react';
import { SMSApprovalConfirmationPage } from '@/components/smsorganisms';

export const SpecialEventApprovalConfirmationPage: React.FC = () => (
  <SMSApprovalConfirmationPage
    title="Special Event Approval Recorded"
    subtitle="Your special event approval decision has been recorded successfully."
    body="Thank you. Your decision for this special event request has been saved. You may now close this window or return to the main dashboard."
  />
);

