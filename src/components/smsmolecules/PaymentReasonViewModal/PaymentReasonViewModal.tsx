import React from 'react';
import { SMSModal } from '@/components/smsorganisms';
import { SMSBox, SMSButton, SMSStack, SMSTextArea } from '@/components/smsatoms';
import { INVOICE_GRID, PAYMENT_GRID } from '@/constants/strings';
import './PaymentReasonViewModal.css';

const D = PAYMENT_GRID.VOID_REASON_DIALOG;

export type PaymentReasonViewModalProps = {
  isOpen: boolean;
  onClose: () => void;
  reason: string | null;
  title?: string;
  closeText?: string;
  reasonLabel?: string;
  minRows?: number;
};

export const PaymentReasonViewModal: React.FC<PaymentReasonViewModalProps> = ({
  isOpen,
  onClose,
  reason,
  title = INVOICE_GRID.PAYMENT.TABLE.VIEW_REASON_TITLE,
  closeText = INVOICE_GRID.PAYMENT.CLOSE,
  reasonLabel = D.REASON_LABEL,
  minRows = D.MIN_ROWS,
}) => (
  <SMSModal
    isOpen={isOpen}
    onClose={onClose}
    title={title}
    size="lg-xl"
    fullWidth
    className="payment-reason-view-modal"
    contentClassName="payment-reason-view-modal__content"
    actions={
      <SMSButton variant="outlined" onClick={onClose} allowWhenSuspended>
        {closeText}
      </SMSButton>
    }
  >
    <SMSStack spacing={2}>
      <SMSBox className="payment-reason-view-modal__field">
        <SMSTextArea
          label={reasonLabel}
          value={reason ?? ''}
          fullWidth
          minRows={minRows}
          inputProps={{ readOnly: true }}
        />
      </SMSBox>
    </SMSStack>
  </SMSModal>
);
