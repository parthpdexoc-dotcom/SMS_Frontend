import React, { useCallback } from 'react';
import {
  SMSDialog,
  SMSDialogContent,
  SMSStandardDialogHeader,
} from '@/components/smsatoms';
import { PaymentAddForm } from '@/components/smsmolecules/PaymentAddForm/PaymentAddForm';
import { PAYMENT_GRID } from '@/constants/strings';
import type { PaymentAddFormProps, PaymentAddModalProps } from '@/types/payment';
import './PaymentAddModal.css';

export const PaymentAddModal: React.FC<PaymentAddModalProps> = ({
  isOpen,
  onClose,
  mode = 'create',
  initialValues,
  formResetToken = 0,
  title,
  onSave,
  ...formProps
}) => {
  const handleSave = useCallback<PaymentAddFormProps['onSave']>(
    async (payload) => {
      const saved = await onSave(payload);
      if (saved) {
        onClose();
      }
    },
    [onClose, onSave]
  );

  return (
    <SMSDialog open={isOpen} onClose={onClose} maxWidth="md" fullWidth className="payment-add-modal">
      <SMSStandardDialogHeader
        title={title ?? PAYMENT_GRID.ADD_NEW_PAYMENT}
        onClose={onClose}
        showCloseButton
      />
      <SMSDialogContent className="payment-add-modal__content">
        <PaymentAddForm
          key={
            isOpen
              ? `payment-form-${mode}-${initialValues?.paymentId ?? 'new'}-${formResetToken}`
              : 'payment-form-closed'
          }
          mode={mode}
          initialValues={initialValues}
          initialRequesterId={formProps.initialRequesterId}
          onCancel={onClose}
          onSave={handleSave}
          {...formProps}
        />
      </SMSDialogContent>
    </SMSDialog>
  );
};
