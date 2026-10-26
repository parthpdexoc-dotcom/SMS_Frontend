import React, { useMemo } from 'react';
import { DEPARTMENT_ACTIVITY_TYPE } from '@/constants/strings';
import { DepartmentActivityTypeResponse } from '@/types/departmentActivityType';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { upsertDepartmentActivityTypeThunk, isMasterDepartmentActivityType } from '@/store/slices/departmentActivityTypeSlice';
import { ShortLongStatusForm } from '@/components/smsmolecules/ShortLongStatusForm';

export interface SMSDepartmentActivityTypeFormProps {
  initialData?: DepartmentActivityTypeResponse | null;
  onSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
}

export const SMSDepartmentActivityTypeForm: React.FC<SMSDepartmentActivityTypeFormProps> = ({
  initialData,
  onSuccess,
  onCancel,
  className = '',
}) => {
  const isEditMode = Boolean(initialData?.departmentActivityTypeId);
  const isMasterRow = Boolean(initialData && isMasterDepartmentActivityType(initialData));
  const dispatch = useAppDispatch();
  const { isLoading, error: reduxError } = useAppSelector((state) => state.departmentActivityType);

  const initialValues = useMemo(() => {
    return initialData
      ? {
          short: initialData.activityTypeShort || '',
          long: initialData.activityTypeLong || '',
          isActive: initialData.activityTypeStatus ?? true,
        }
      : undefined;
  }, [initialData?.activityTypeShort, initialData?.activityTypeLong, initialData?.activityTypeStatus]);

  return (
    <ShortLongStatusForm
      className={className}
      isEditMode={isEditMode}
      isLoading={isLoading}
      reduxError={reduxError}
      disabled={isMasterRow}
      strings={{
        FORM: {
          TITLE: DEPARTMENT_ACTIVITY_TYPE.FORM.TITLE,
          TITLE_PLACEHOLDER: DEPARTMENT_ACTIVITY_TYPE.FORM.TITLE_PLACEHOLDER,
          DESCRIPTION: DEPARTMENT_ACTIVITY_TYPE.FORM.DESCRIPTION,
          DESCRIPTION_PLACEHOLDER: DEPARTMENT_ACTIVITY_TYPE.FORM.DESCRIPTION_PLACEHOLDER,
          IS_ACTIVE: DEPARTMENT_ACTIVITY_TYPE.FORM.IS_ACTIVE,
          CANCEL_BUTTON: DEPARTMENT_ACTIVITY_TYPE.FORM.CANCEL_BUTTON,
          SUBMIT_BUTTON: DEPARTMENT_ACTIVITY_TYPE.FORM.SUBMIT_BUTTON,
          SUBMITTING: DEPARTMENT_ACTIVITY_TYPE.FORM.SUBMITTING,
        },
        ERRORS: {
          TITLE_REQUIRED: DEPARTMENT_ACTIVITY_TYPE.ERRORS.TITLE_REQUIRED,
          DESCRIPTION_REQUIRED: DEPARTMENT_ACTIVITY_TYPE.ERRORS.DESCRIPTION_REQUIRED,
        },
        SUCCESS: {
          ADDED: DEPARTMENT_ACTIVITY_TYPE.SUCCESS.ADDED,
          UPDATED: DEPARTMENT_ACTIVITY_TYPE.SUCCESS.UPDATED,
        },
        BUTTON: {
          UPDATE: DEPARTMENT_ACTIVITY_TYPE.BUTTON.UPDATE,
          UPDATING: DEPARTMENT_ACTIVITY_TYPE.BUTTON.UPDATING,
        },
      }}
      initialValues={initialValues}
      onSubmit={async (values) => {
        if (isMasterRow) return;
        const departmentActivityTypeId = initialData?.departmentActivityTypeId;
        const payload = {
          activityTypeShort: values.short,
          activityTypeLong: values.long,
          activityTypeStatus: values.isActive,
        };

        if (isEditMode && departmentActivityTypeId) {
          await dispatch(upsertDepartmentActivityTypeThunk({ departmentActivityTypeId, ...payload })).unwrap();
          return;
        }

        await dispatch(upsertDepartmentActivityTypeThunk(payload)).unwrap();
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


