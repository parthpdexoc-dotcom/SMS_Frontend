import { SMSIcon } from '@/components/smsatoms';
import React from 'react';
import { Alert, AlertTitle } from '@mui/material';

export type SMSAlertVariant = 'success' | 'error' | 'warning' | 'info';

export interface SMSAlertProps {
  variant: SMSAlertVariant;
  title?: string;
  message?: string;
  onClose?: () => void;
  icon?: string;
  action?: React.ReactNode;
  severity?: 'success' | 'error' | 'warning' | 'info';
}

export const SMSAlert: React.FC<SMSAlertProps> = ({
  variant,
  title,
  message,
  onClose,
  icon,
  action,
  severity,
}) => {
  // TODO: Implement alert component with proper styling and icon support
  const alertSeverity = severity || variant;

  return (
    <Alert
      severity={alertSeverity}
      onClose={onClose}
      icon={icon ? <SMSIcon name={icon} size="sm" /> : undefined}
      action={action}
    >
      {title && <AlertTitle>{title}</AlertTitle>}
      {message}
    </Alert>
  );
};

export default SMSAlert;

