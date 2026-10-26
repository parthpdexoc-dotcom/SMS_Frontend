import React, { useMemo } from 'react';
import { BUSINESS_TYPE } from '@/constants/strings';
import { BusinessTypeResponse } from '@/types/businessType';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { upsertBusinessTypeThunk } from '@/store/slices/businessTypeSlice';
import { ShortLongStatusForm } from '@/components/smsmolecules/ShortLongStatusForm';

export interface SMSBusinessTypeFormProps {
  initialData?: BusinessTypeResponse | null;
  onSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
}

export const SMSBusinessTypeForm: React.FC<SMSBusinessTypeFormProps> = ({
  initialData,
  onSuccess,
  onCancel,
  className = '',
}) => {
  const isEditMode = Boolean(initialData?.businessTypeID);
  const dispatch = useAppDispatch();
  const { isLoading, error: reduxError } = useAppSelector((state) => state.businessType);

  const initialValues = useMemo(() => {
    return initialData
      ? {
          short: initialData.businessTypeShort || '',
          long: initialData.businessTypeLong || '',
          isActive: initialData.businessTypeStatus ?? true,
          extras: {},
        }
      : undefined;
  }, [initialData?.businessTypeShort, initialData?.businessTypeLong, initialData?.businessTypeStatus]);

  return (
    <ShortLongStatusForm
      className={className}
      isEditMode={isEditMode}
      isLoading={isLoading}
      reduxError={reduxError}
      strings={{
        FORM: {
          TITLE: BUSINESS_TYPE.FORM.TITLE,
          TITLE_PLACEHOLDER: BUSINESS_TYPE.FORM.TITLE_PLACEHOLDER,
          DESCRIPTION: BUSINESS_TYPE.FORM.DESCRIPTION,
          DESCRIPTION_PLACEHOLDER: BUSINESS_TYPE.FORM.DESCRIPTION_PLACEHOLDER,
          IS_ACTIVE: BUSINESS_TYPE.FORM.IS_ACTIVE,
          CANCEL_BUTTON: BUSINESS_TYPE.FORM.CANCEL_BUTTON,
          SUBMIT_BUTTON: BUSINESS_TYPE.FORM.SUBMIT_BUTTON,
          SUBMITTING: BUSINESS_TYPE.FORM.SUBMITTING,
        },
        ERRORS: {
          TITLE_REQUIRED: BUSINESS_TYPE.ERRORS.TITLE_REQUIRED,
          DESCRIPTION_REQUIRED: BUSINESS_TYPE.ERRORS.DESCRIPTION_REQUIRED,
        },
        SUCCESS: {
          ADDED: BUSINESS_TYPE.SUCCESS.ADDED,
          UPDATED: BUSINESS_TYPE.SUCCESS.UPDATED,
        },
        BUTTON: {
          UPDATE: BUSINESS_TYPE.BUTTON.UPDATE,
          UPDATING: BUSINESS_TYPE.BUTTON.UPDATING,
        },
      }}
      initialValues={initialValues}
      onSubmit={async (values) => {
        const businessTypeID = initialData?.businessTypeID;
        const payload = {
          businessTypeShort: values.short,
          businessTypeLong: values.long,
          businessTypeStatus: values.isActive,
        };

        if (isEditMode && businessTypeID) {
          await dispatch(upsertBusinessTypeThunk({ businessTypeID, ...payload })).unwrap();
          return;
        }

        await dispatch(upsertBusinessTypeThunk(payload)).unwrap();
      }}
      onSuccess={onSuccess}
      onCancel={onCancel}
      showAuditInfo={true}
      auditData={initialData ? {
        createdBy: initialData.createdBy || undefined,
        createdDate: initialData.createdDate || undefined,
        editedBy: initialData.editedBy || undefined,
        editedDate: initialData.editedDate || undefined,
      } : undefined}
    />
  );
};


