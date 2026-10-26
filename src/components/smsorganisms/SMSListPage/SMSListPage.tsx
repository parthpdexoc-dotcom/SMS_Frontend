import React from 'react';
import { SMSPageLayout } from '../SMSPageLayout';
import { SMSFilterPanel } from '@/components/smsmolecules';
import { SMSStack, SMSTypography } from '@/components/smsatoms';

export interface SMSListPageProps {
  title?: string;
  filterPanel?: React.ReactNode;
  children: React.ReactNode;
  spacing?: number;
}

export const SMSListPage: React.FC<SMSListPageProps> = ({
  title,
  filterPanel,
  children,
  spacing = 3,
}) => {
  return (
    <SMSPageLayout spacing={spacing}>
      {title && (
        <SMSTypography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
          {title}
        </SMSTypography>
      )}
      {filterPanel && <SMSFilterPanel>{filterPanel}</SMSFilterPanel>}
      <SMSStack spacing={spacing} sx={{ flex: 1 }}>
        {children}
      </SMSStack>
    </SMSPageLayout>
  );
};

export default SMSListPage;

