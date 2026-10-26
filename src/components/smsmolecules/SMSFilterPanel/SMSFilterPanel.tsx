import React from 'react';
import { SMSCard, SMSStack, SMSTypography } from '@/components/smsatoms';

export interface SMSFilterPanelProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export const SMSFilterPanel: React.FC<SMSFilterPanelProps> = ({
  title,
  children,
  className,
}) => {
  return (
    <SMSCard className={className} sx={{ padding: { xs: 2, md: 3 }, marginBottom: 3 }}>
      <SMSStack spacing={3}>
        {title && (
          <SMSTypography variant="h6" component="h3" sx={{ fontWeight: 600 }}>
            {title}
          </SMSTypography>
        )}
        {children}
      </SMSStack>
    </SMSCard>
  );
};

export default SMSFilterPanel;

