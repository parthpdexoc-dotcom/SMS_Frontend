import React, { useMemo } from 'react';
import { PAYMENT_TYPE_MASTER } from '@/constants/strings';
import { PaymentTypeResponse } from '@/types/paymentType';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { upsertPaymentTypeThunk } from '@/store/slices/paymentTypeSlice';
import { ShortLongStatusForm } from '@/components/smsmolecules/ShortLongStatusForm';

export interface PaymentTypeFormProps {
  initialData?: PaymentTypeResponse | null;
  onSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
}

export const PaymentTypeForm: React.FC<PaymentTypeFormProps> = ({
  initialData,
  onSuccess,
  onCancel,
  className = '',
}) => {
  const isEditMode = Boolean(initialData?.paymentTypeId);
  const dispatch = useAppDispatch();
  const { isLoading, error: reduxError } = useAppSelector((state) => state.paymentType);

  const initialValues = useMemo(() => {
    return initialData
      ? {
          short: initialData.name || '',
          long: '',
          isActive: initialData.isDefault ?? false,
          extras: {},
        }
      : {
          short: '',
          long: '',
          isActive: false,
          extras: {},
        };
  }, [initialData?.name, initialData?.isDefault]);

  return (
    <ShortLongStatusForm
      className={className}
      isEditMode={isEditMode}
      isLoading={isLoading}
      reduxError={reduxError}
      hideLongField
      strings={{
        FORM: {
          TITLE: PAYMENT_TYPE_MASTER.FORM.NAME,
          TITLE_PLACEHOLDER: PAYMENT_TYPE_MASTER.FORM.NAME_PLACEHOLDER,
          DESCRIPTION: '',
          DESCRIPTION_PLACEHOLDER: '',
          IS_ACTIVE: PAYMENT_TYPE_MASTER.FORM.IS_DEFAULT,
          CANCEL_BUTTON: PAYMENT_TYPE_MASTER.FORM.CANCEL_BUTTON,
          SUBMIT_BUTTON: PAYMENT_TYPE_MASTER.FORM.SUBMIT_BUTTON,
          SUBMITTING: PAYMENT_TYPE_MASTER.FORM.SUBMITTING,
        },
        ERRORS: {
          TITLE_REQUIRED: PAYMENT_TYPE_MASTER.ERRORS.NAME_REQUIRED,
          DESCRIPTION_REQUIRED: '',
        },
        SUCCESS: {
          ADDED: PAYMENT_TYPE_MASTER.SUCCESS.ADDED,
          UPDATED: PAYMENT_TYPE_MASTER.SUCCESS.UPDATED,
        },
        BUTTON: {
          UPDATE: PAYMENT_TYPE_MASTER.BUTTON.UPDATE,
          UPDATING: PAYMENT_TYPE_MASTER.BUTTON.UPDATING,
        },
      }}
      initialValues={initialValues}
      onSubmit={async (values) => {
        const paymentTypeId = initialData?.paymentTypeId;
        if (isEditMode && paymentTypeId) {
          await dispatch(
            upsertPaymentTypeThunk({
              paymentTypeId,
              name: values.short,
              isDefault: values.isActive,
            })
          ).unwrap();
          return;
        }
        await dispatch(
          upsertPaymentTypeThunk({
            name: values.short,
            isDefault: values.isActive,
          })
        ).unwrap();
      }}
      onSuccess={onSuccess}
      onCancel={onCancel}
      showAuditInfo
      auditData={
        initialData
          ? {
              createdBy: initialData.createdBy || undefined,
              createdDate: initialData.createdDate || undefined,
              editedBy: initialData.editedBy || undefined,
              editedDate: initialData.editedDate || undefined,
            }
          : undefined
      }
    />
  );
};
