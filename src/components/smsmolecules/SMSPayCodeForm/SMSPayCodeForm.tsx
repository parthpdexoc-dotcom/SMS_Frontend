import React, { useMemo } from 'react';
import { PAY_CODE } from '@/constants/strings';
import { PayCodeResponse } from '@/types/payCode';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { upsertPayCodeThunk } from '@/store/slices/payCodeSlice';
import { ShortLongStatusForm } from '@/components/smsmolecules/ShortLongStatusForm';

export interface SMSPayCodeFormProps {
  initialData?: PayCodeResponse | null;
  onSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
}

export const SMSPayCodeForm: React.FC<SMSPayCodeFormProps> = ({
  initialData,
  onSuccess,
  onCancel,
  className = '',
}) => {
  const isEditMode = Boolean(initialData?.payCodeID);
  const dispatch = useAppDispatch();
  const { isLoading, error: reduxError } = useAppSelector((state) => state.payCode);

  const initialValues = useMemo(() => {
    return initialData
      ? {
          short: initialData.payCodeValue || '',
          long: initialData.payCodeDescription || '',
          // Use actual status from PayCode data
          isActive: Boolean(initialData.payCodeStatus),
          extras: {},
        }
      : {
          short: '',
          long: '',
          isActive: true,
          extras: {},
        };
  }, [initialData?.payCodeValue, initialData?.payCodeDescription, initialData?.payCodeStatus]);

  return (
    <ShortLongStatusForm
      className={className}
      isEditMode={isEditMode}
      isLoading={isLoading}
      reduxError={reduxError}
      strings={{
        FORM: {
          TITLE: PAY_CODE.FORM.TITLE,
          TITLE_PLACEHOLDER: PAY_CODE.FORM.TITLE_PLACEHOLDER,
          DESCRIPTION: PAY_CODE.FORM.DESCRIPTION,
          DESCRIPTION_PLACEHOLDER: PAY_CODE.FORM.DESCRIPTION_PLACEHOLDER,
          IS_ACTIVE: PAY_CODE.FORM.IS_ACTIVE,
          CANCEL_BUTTON: PAY_CODE.FORM.CANCEL_BUTTON,
          SUBMIT_BUTTON: PAY_CODE.FORM.SUBMIT_BUTTON,
          SUBMITTING: PAY_CODE.FORM.SUBMITTING,
        },
        ERRORS: {
          TITLE_REQUIRED: PAY_CODE.ERRORS.TITLE_REQUIRED,
          DESCRIPTION_REQUIRED: PAY_CODE.ERRORS.DESCRIPTION_REQUIRED,
        },
        SUCCESS: {
          ADDED: PAY_CODE.SUCCESS.ADDED,
          UPDATED: PAY_CODE.SUCCESS.UPDATED,
        },
        BUTTON: {
          UPDATE: PAY_CODE.BUTTON.UPDATE,
          UPDATING: PAY_CODE.BUTTON.UPDATING,
        },
      }}
      initialValues={initialValues}
      onSubmit={async (values) => {
        const payCodeID = initialData?.payCodeID;
        const payload = {
          payCodeValue: values.short,
          payCodeDescription: values.long,
          // Use the actual status from form
          payCodeStatus: values.isActive,
        };

        if (isEditMode && payCodeID) {
          await dispatch(upsertPayCodeThunk({ payCodeID, ...payload })).unwrap();
          return;
        }

        await dispatch(upsertPayCodeThunk(payload)).unwrap();
      }}
      onSuccess={onSuccess}
      onCancel={onCancel}
      showAuditInfo={true}
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

