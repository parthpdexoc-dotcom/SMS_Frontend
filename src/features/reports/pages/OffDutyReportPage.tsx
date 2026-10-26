import React from 'react';
import { ReportsPageShell } from '@/features/reports/components/ReportsPageShell';
import { MENU_ITEMS } from '@/constants/strings';

export const OffDutyReportPage: React.FC = () => (
  <ReportsPageShell title={MENU_ITEMS.OFF_DUTY_REPORT} />
);
