import React, { useEffect, useRef } from 'react';
import { SMSDialog, SMSDialogTitle, SMSDialogContent, SMSDialogActions, SMSButton, SMSTypography, SMSStack, SMSIcon, SMSLoader } from '@/components/smsatoms';
import { useTheme } from '@mui/material';
import type { ButtonProps } from '@mui/material/Button';

export interface SMSConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  children?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'warning' | 'error' | 'info' | 'success';
  /** When set, overrides the confirm button color (e.g. `primary` for an error-styled dialog where "Yes" proceeds). */
  confirmButtonColor?: ButtonProps['color'];
  icon?: string;
  loading?: boolean;
  loadingMessage?: string;
  confirmDisabled?: boolean;
  showCancel?: boolean;
  showConfirm?: boolean;
}

export const SMSConfirmDialog: React.FC<SMSConfirmDialogProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  children,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  confirmButtonColor,
  icon,
  loading = false,
  loadingMessage,
  confirmDisabled = false,
  showCancel = true,
  showConfirm = true,
}) => {
  const theme = useTheme();
  const destructiveByText = /delete|remove/i.test(`${confirmText} ${title}`);
  const isDestructive = variant === 'error' || destructiveByText;
  const resolvedIcon =
    icon ||
    (isDestructive
      ? 'error'
      : variant === 'warning'
      ? 'warning'
      : variant === 'success'
          ? 'check_circle'
          : 'info');

  const titleColor = isDestructive ? 'error.main' : variant === 'warning' ? 'warning.dark' : undefined;
  const iconColor = isDestructive
    ? theme.palette.error.main
    : variant === 'warning'
      ? theme.palette.warning.main
      : undefined;
  const [isProcessing, setIsProcessing] = React.useState(false);
  const confirmLockedRef = useRef(false);
  const isBusy = Boolean(loading || isProcessing);

  useEffect(() => {
    if (!open) {
      confirmLockedRef.current = false;
      setIsProcessing(false);
    }
  }, [open]);

  const handleConfirmClick = async () => {
    if (isBusy || confirmDisabled || confirmLockedRef.current) return;
    confirmLockedRef.current = true;
    setIsProcessing(true);
    try {
      const result: unknown = onConfirm();
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        await result;
      }
    } finally {
      if (open) {
        setIsProcessing(false);
      }
    }
  };

  return (
    <SMSDialog open={open} onClose={isBusy ? undefined : onClose} maxWidth="sm" fullWidth>
      <SMSDialogTitle>
        <SMSStack direction="row" spacing={1} alignItems="center">
          <SMSIcon name={resolvedIcon} size="sm" color={iconColor} />
          <SMSTypography variant="h5" color={titleColor}>
            {title}
          </SMSTypography>
        </SMSStack>
      </SMSDialogTitle>
      <SMSDialogContent>
        {isBusy ? (
          <SMSStack alignItems="center" sx={{ py: 2 }}>
            <SMSLoader
              size={28}
              loadingText={loadingMessage || message}
              aria-label={loadingMessage || message}
            />
          </SMSStack>
        ) : (
          <SMSStack spacing={2}>
            {message.trim() ? (
              <SMSTypography variant="body1">{message}</SMSTypography>
            ) : null}
            {children}
          </SMSStack>
        )}
      </SMSDialogContent>
      <SMSDialogActions>
        {showCancel && (
          <SMSButton
            allowWhenSuspended
            onClick={onClose}
            disabled={isBusy}
          >
            {cancelText}
          </SMSButton>
        )}
        {showConfirm && (
          <SMSButton
            color={
              confirmButtonColor ??
              (isDestructive ? 'error' : variant === 'warning' ? 'warning' : undefined)
            }
            loading={isBusy}
            onClick={handleConfirmClick}
            disabled={isBusy || confirmDisabled}
          >
            {confirmText}
          </SMSButton>
        )}
      </SMSDialogActions>
    </SMSDialog>
  );
};

export default SMSConfirmDialog;

