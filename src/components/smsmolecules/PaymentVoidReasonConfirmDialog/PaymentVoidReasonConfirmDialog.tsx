import React, { useCallback, useEffect, useState } from 'react';
import { SMSTextArea } from '@/components/smsatoms';
import { SMSConfirmDialog } from '@/components/smsmolecules/SMSConfirmDialog';
import { PAYMENT_GRID } from '@/constants/strings';

const D = PAYMENT_GRID.VOID_REASON_DIALOG;

export type PaymentVoidReasonConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText?: string;
  variant?: 'warning' | 'error';
  loading?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
  reasonLabel?: string;
  reasonMaxLength?: number;
  minRows?: number;
};

export const PaymentVoidReasonConfirmDialog: React.FC<PaymentVoidReasonConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmText,
  cancelText = D.CANCEL,
  variant = 'warning',
  loading = false,
  onClose,
  onConfirm,
  reasonLabel = D.REASON_LABEL,
  reasonMaxLength = D.REASON_MAX_LENGTH,
  minRows = D.MIN_ROWS,
}) => {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) {
      setReason('');
    }
  }, [open]);

  const handleClose = useCallback(() => {
    setReason('');
    onClose();
  }, [onClose]);

  const handleConfirm = useCallback(() => {
    void onConfirm(reason.trim());
  }, [onConfirm, reason]);

  const trimmedReason = reason.trim();

  return (
    <SMSConfirmDialog
      open={open}
      title={title}
      message={message}
      confirmText={confirmText}
      cancelText={cancelText}
      onConfirm={handleConfirm}
      onClose={handleClose}
      variant={variant}
      loading={loading}
      confirmDisabled={!trimmedReason}
    >
      <SMSTextArea
        label={reasonLabel}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        fullWidth
        minRows={minRows}
        inputProps={{ maxLength: reasonMaxLength }}
        disabled={loading}
      />
    </SMSConfirmDialog>
  );
};
