import React from 'react';
import { SMSBox, SMSTypography, SMSStack, SMSButton, SMSIcon } from '@/components/smsatoms';
import { useTheme } from '@mui/material/styles';

export interface SMSErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryText?: string;
}

export const SMSErrorState: React.FC<SMSErrorStateProps> = ({
  title = 'Error',
  message,
  onRetry,
  retryText = 'Try Again',
}) => {
  const theme = useTheme();

  return (
    <SMSBox
      sx={{
        padding: 3,
        backgroundColor: theme.palette.error.light,
        border: `1px solid ${theme.palette.error.main}`,
        borderRadius: '6px',
        margin: 2,
      }}
    >
      <SMSStack spacing={2} alignItems="flex-start">
        <SMSStack direction="row" spacing={1} alignItems="center">
          <SMSIcon name="error" size="md" color={theme.palette.error.dark} />
          <SMSTypography variant="h6" sx={{ color: theme.palette.error.dark, fontWeight: 600 }}>
            {title}
          </SMSTypography>
        </SMSStack>
        <SMSTypography variant="body2" sx={{ color: theme.palette.error.dark }}>
          {message}
        </SMSTypography>
        {onRetry && (
          <SMSButton
            variant="outlined"
            color="error"
            onClick={onRetry}
          >
            {retryText}
          </SMSButton>
        )}
      </SMSStack>
    </SMSBox>
  );
};

export default SMSErrorState;

