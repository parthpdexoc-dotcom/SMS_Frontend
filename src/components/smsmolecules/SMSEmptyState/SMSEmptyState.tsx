import React from 'react';
import { SMSTypography, SMSBox, SMSIcon } from '@/components/smsatoms';
import { useTheme } from '@mui/material/styles';

export interface SMSEmptyStateProps {
  icon?: string;
  title: string;
  message: string;
  action?: React.ReactNode;
  maxWidth?: number | string;
  /** Override message text color (e.g. 'error.main' for red highlight). */
  messageColor?: string;
}

export const SMSEmptyState: React.FC<SMSEmptyStateProps> = ({
  icon = 'calendar',
  title,
  message,
  action,
  maxWidth = 600,
  messageColor,
}) => {
  const theme = useTheme();

  return (
    <SMSBox
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: { xs: 4, md: 6 },
        minHeight: { xs: '300px', md: '400px' },
        maxWidth,
        margin: '0 auto',
        textAlign: 'center',
      }}
    >
      <SMSBox
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: { xs: 64, md: 80 },
          height: { xs: 64, md: 80 },
          borderRadius: '50%',
          backgroundColor: theme.palette.action.hover,
          marginBottom: 3,
          color: theme.palette.text.secondary,
        }}
      >
        <SMSIcon name={icon} size="xl" />
      </SMSBox>
      <SMSTypography
        variant="h5"
        component="h3"
        sx={{
          fontWeight: 600,
          color: theme.palette.text.primary,
          marginBottom: 1.5,
        }}
      >
        {title}
      </SMSTypography>
      <SMSTypography
        variant="body1"
        color={messageColor || 'text.secondary'}
        sx={{
          maxWidth: '500px',
          lineHeight: 1.6,
          marginBottom: action ? 2 : 0,
          ...(messageColor ? { fontWeight: 500 } : {}),
        }}
      >
        {message}
      </SMSTypography>
      {action && (
        <SMSBox sx={{ marginTop: 2 }}>
          {action}
        </SMSBox>
      )}
    </SMSBox>
  );
};

export default SMSEmptyState;

