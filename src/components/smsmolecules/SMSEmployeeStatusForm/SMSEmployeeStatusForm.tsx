import React, { useMemo } from 'react';
import { EMPLOYEE_STATUS } from '@/constants/strings';
import { EmployeeStatusResponse } from '@/types/employeeStatus';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { upsertEmployeeStatusThunk } from '@/store/slices/employeeStatusSlice';
import { ShortLongStatusForm } from '@/components/smsmolecules/ShortLongStatusForm';

export interface SMSEmployeeStatusFormProps {
  initialData?: EmployeeStatusResponse | null;
  onSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
}

export const SMSEmployeeStatusForm: React.FC<SMSEmployeeStatusFormProps> = ({
  initialData,
  onSuccess,
  onCancel,
  className = '',
}) => {
  const isEditMode = Boolean(initialData?.employeeStatusID);
  const dispatch = useAppDispatch();
  const { isLoading, error: reduxError } = useAppSelector((state) => state.employeeStatus);

  const initialValues = useMemo(() => {
    return initialData
      ? {
          short: initialData.statusShort || '',
          long: initialData.statusLong || '',
          isActive: initialData.status ?? true,
          extras: {},
        }
      : undefined;
  }, [initialData?.statusShort, initialData?.statusLong, initialData?.status]);

  return (
    <ShortLongStatusForm
      className={className}
      isEditMode={isEditMode}
      isLoading={isLoading}
      reduxError={reduxError}
      strings={{
        FORM: {
          TITLE: EMPLOYEE_STATUS.FORM.TITLE,
          TITLE_PLACEHOLDER: EMPLOYEE_STATUS.FORM.TITLE_PLACEHOLDER,
          DESCRIPTION: EMPLOYEE_STATUS.FORM.DESCRIPTION,
          DESCRIPTION_PLACEHOLDER: EMPLOYEE_STATUS.FORM.DESCRIPTION_PLACEHOLDER,
          IS_ACTIVE: EMPLOYEE_STATUS.FORM.IS_ACTIVE,
          CANCEL_BUTTON: EMPLOYEE_STATUS.FORM.CANCEL_BUTTON,
          SUBMIT_BUTTON: EMPLOYEE_STATUS.FORM.SUBMIT_BUTTON,
          SUBMITTING: EMPLOYEE_STATUS.FORM.SUBMITTING,
        },
        ERRORS: {
          TITLE_REQUIRED: EMPLOYEE_STATUS.ERRORS.TITLE_REQUIRED,
          DESCRIPTION_REQUIRED: EMPLOYEE_STATUS.ERRORS.DESCRIPTION_REQUIRED,
        },
        SUCCESS: {
          ADDED: EMPLOYEE_STATUS.SUCCESS.ADDED,
          UPDATED: EMPLOYEE_STATUS.SUCCESS.UPDATED,
        },
        BUTTON: {
          UPDATE: EMPLOYEE_STATUS.BUTTON.UPDATE,
          UPDATING: EMPLOYEE_STATUS.BUTTON.UPDATING,
        },
      }}
      initialValues={initialValues}
      onSubmit={async (values) => {
        const employeeStatusID = initialData?.employeeStatusID;
        const payload = {
          statusShort: values.short,
          statusLong: values.long,
          status: values.isActive,
        };

        if (isEditMode && employeeStatusID) {
          await dispatch(upsertEmployeeStatusThunk({ employeeStatusID, ...payload })).unwrap();
          return;
        }

        await dispatch(upsertEmployeeStatusThunk(payload)).unwrap();
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


