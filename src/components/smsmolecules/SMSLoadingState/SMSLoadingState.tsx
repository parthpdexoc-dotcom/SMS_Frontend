import React from 'react';
import { SMSBox, SMSLoader, SMSTypography, SMSStack } from '@/components/smsatoms';

export interface SMSLoadingStateProps {
  message?: string;
  fullHeight?: boolean;
}

export const SMSLoadingState: React.FC<SMSLoadingStateProps> = ({
  message = 'Loading...',
  fullHeight = false,
}) => {
  return (
    <SMSBox
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: { xs: 4, md: 6 },
        minHeight: fullHeight ? { xs: '300px', md: '400px' } : 'auto',
      }}
    >
      <SMSStack spacing={2} alignItems="center">
        <SMSLoader size={40} loadingText={false} />
        <SMSTypography variant="body1" color="text.secondary">
          {message}
        </SMSTypography>
      </SMSStack>
    </SMSBox>
  );
};

export default SMSLoadingState;

