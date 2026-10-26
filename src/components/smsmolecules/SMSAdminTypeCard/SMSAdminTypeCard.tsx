import React, { useMemo } from 'react';
import { ADMIN_TYPE } from '@/constants/strings';
import { AdminTypeResponse } from '@/types/adminType';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { createAdminTypeThunk, updateAdminTypeThunk } from '@/store/slices/adminTypeSlice';
import { ShortLongStatusForm } from '@/components/smsmolecules/ShortLongStatusForm';

export interface SMSAdminTypeCardProps {
  initialData?: AdminTypeResponse | null;
  onSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
}


export const SMSAdminTypeCard: React.FC<SMSAdminTypeCardProps> = ({
  initialData,
  onSuccess,
  onCancel,
  className = '',
}) => {
  const isEditMode = Boolean(initialData?.adminTypeID);
  const dispatch = useAppDispatch();
  const { isLoading, error: reduxError, adminTypes } = useAppSelector((state) => state.adminType);

  const parentOptions = useMemo(() => {
    const list = isEditMode && initialData?.adminTypeID
      ? adminTypes.filter((t) => t.adminTypeID !== initialData.adminTypeID)
      : adminTypes;
    return [
      { value: '', label: 'None' },
      ...list.map((t) => ({ value: t.adminTypeID, label: t.adminTypeShort })),
    ];
  }, [adminTypes, isEditMode, initialData?.adminTypeID]);

  const initialValues = {
    short: initialData?.adminTypeShort || '',
    long: initialData?.adminTypeLong || '',
    isActive: initialData?.adminTypeStatus ?? true,
    extras: {
      parentID: initialData?.parentID ?? '',
    },
  };

  return (
    <ShortLongStatusForm
      className={className}
      isEditMode={isEditMode}
      isLoading={isLoading}
      reduxError={reduxError}
      strings={{
        FORM: {
          TITLE: ADMIN_TYPE.FORM.TITLE,
          TITLE_PLACEHOLDER: ADMIN_TYPE.FORM.TITLE_PLACEHOLDER,
          DESCRIPTION: ADMIN_TYPE.FORM.DESCRIPTION,
          DESCRIPTION_PLACEHOLDER: ADMIN_TYPE.FORM.DESCRIPTION_PLACEHOLDER,
          IS_ACTIVE: ADMIN_TYPE.FORM.IS_ACTIVE,
          CANCEL_BUTTON: ADMIN_TYPE.FORM.CANCEL_BUTTON,
          SUBMIT_BUTTON: ADMIN_TYPE.FORM.SUBMIT_BUTTON,
          SUBMITTING: ADMIN_TYPE.FORM.SUBMITTING,
        },
        ERRORS: {
          TITLE_REQUIRED: ADMIN_TYPE.ERRORS.TITLE_REQUIRED,
          DESCRIPTION_REQUIRED: ADMIN_TYPE.ERRORS.DESCRIPTION_REQUIRED,
        },
        SUCCESS: {
          ADDED: ADMIN_TYPE.SUCCESS.ADDED,
          UPDATED: ADMIN_TYPE.SUCCESS.UPDATED,
        },
        BUTTON: {
          UPDATE: ADMIN_TYPE.BUTTON.UPDATE,
          UPDATING: ADMIN_TYPE.BUTTON.UPDATING,
        },
      }}
      extraFields={[
        {
          key: 'parentID',
          label: ADMIN_TYPE.FORM.PARENT,
          type: 'select',
          required: false,
          options: parentOptions,
          placeholder: 'Select parent admin type',
        },
      ]}
      initialValues={initialValues}
      onSubmit={async (values) => {
        const payload = {
          adminTypeShort: values.short,
          adminTypeLong: values.long,
          adminTypeStatus: values.isActive,
          isManagePost: isEditMode ? Boolean(initialData?.isManagePost) : false,
          parentID: values.extras?.parentID && String(values.extras.parentID).trim() !== '' ? String(values.extras.parentID) : null,
        };

        if (isEditMode && initialData?.adminTypeID) {
          await dispatch(
            updateAdminTypeThunk({
              adminTypeID: initialData.adminTypeID,
              ...payload,
            })
          ).unwrap();
        } else {
          await dispatch(createAdminTypeThunk(payload)).unwrap();
        }
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


