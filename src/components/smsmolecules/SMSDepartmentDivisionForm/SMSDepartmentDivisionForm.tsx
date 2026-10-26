import React, { useMemo } from 'react';
import { DEPARTMENT_DIVISION } from '@/constants/strings';
import { DepartmentDivisionResponse } from '@/types/departmentDivision';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { upsertDepartmentDivisionThunk } from '@/store/slices/departmentDivisionsSlice';
import { ShortLongStatusForm } from '@/components/smsmolecules/ShortLongStatusForm';

export interface SMSDepartmentDivisionFormProps {
  initialData?: DepartmentDivisionResponse | null;
  onSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
}

export const SMSDepartmentDivisionForm: React.FC<SMSDepartmentDivisionFormProps> = ({
  initialData,
  onSuccess,
  onCancel,
  className = '',
}) => {
  const isEditMode = Boolean(initialData?.divisionID);
  const dispatch = useAppDispatch();
  const { isLoading, error: reduxError } = useAppSelector((state) => state.departmentDivisions);

  const initialValues = useMemo(() => {
    return initialData
      ? {
          short: initialData.divisionShort || '',
          long: initialData.divisionLong || '',
          isActive: initialData.divisionActive ?? true,
          extras: {},
        }
      : undefined;
  }, [initialData?.divisionShort, initialData?.divisionLong, initialData?.divisionActive]);

  return (
    <ShortLongStatusForm
      className={className}
      isEditMode={isEditMode}
      isLoading={isLoading}
      reduxError={reduxError}
      strings={{
        FORM: {
          TITLE: DEPARTMENT_DIVISION.FORM.TITLE,
          TITLE_PLACEHOLDER: DEPARTMENT_DIVISION.FORM.TITLE_PLACEHOLDER,
          DESCRIPTION: DEPARTMENT_DIVISION.FORM.DESCRIPTION,
          DESCRIPTION_PLACEHOLDER: DEPARTMENT_DIVISION.FORM.DESCRIPTION_PLACEHOLDER,
          IS_ACTIVE: DEPARTMENT_DIVISION.FORM.IS_ACTIVE,
          CANCEL_BUTTON: DEPARTMENT_DIVISION.FORM.CANCEL_BUTTON,
          SUBMIT_BUTTON: DEPARTMENT_DIVISION.FORM.SUBMIT_BUTTON,
          SUBMITTING: DEPARTMENT_DIVISION.FORM.SUBMITTING,
        },
        ERRORS: {
          TITLE_REQUIRED: DEPARTMENT_DIVISION.ERRORS.TITLE_REQUIRED,
          DESCRIPTION_REQUIRED: DEPARTMENT_DIVISION.ERRORS.DESCRIPTION_REQUIRED,
        },
        SUCCESS: {
          ADDED: DEPARTMENT_DIVISION.SUCCESS.ADDED,
          UPDATED: DEPARTMENT_DIVISION.SUCCESS.UPDATED,
        },
        BUTTON: {
          UPDATE: DEPARTMENT_DIVISION.BUTTON.UPDATE,
          UPDATING: DEPARTMENT_DIVISION.BUTTON.UPDATING,
        },
      }}
      initialValues={initialValues}
      onSubmit={async (values) => {
        const divisionID = initialData?.divisionID;
        const payload = {
          divisionShort: values.short,
          divisionLong: values.long,
          divisionActive: values.isActive,
        };

        if (isEditMode && divisionID) {
          await dispatch(upsertDepartmentDivisionThunk({ divisionID, ...payload })).unwrap();
          return;
        }

        await dispatch(upsertDepartmentDivisionThunk(payload)).unwrap();
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


