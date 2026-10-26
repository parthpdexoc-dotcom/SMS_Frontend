import React, { useMemo } from 'react';
import { RESPONSE_AREA } from '@/constants/strings';
import { ResponseAreaResponse } from '@/types/responseArea';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { createResponseAreaThunk, updateResponseAreaThunk } from '@/store/slices/responseAreaSlice';
import { ShortLongStatusForm } from '@/components/smsmolecules/ShortLongStatusForm';

/** Keys in form extras (aligned with BusinessType pattern; ResponseArea needs departmentID and ID for edit) */
const EXTRA_DEPARTMENT_RESPONSE_AREA_ID = 'departmentResponseAreaID';
const EXTRA_DEPARTMENT_ID = 'departmentID';

/** Get response area ID from row (handles both responseAreaID and departmentResponseAreaID from API) */
function getResponseAreaIdFromRow(row: ResponseAreaResponse | null | undefined): string {
  if (!row) return '';
  const id = (row as ResponseAreaResponse & { departmentResponseAreaID?: string }).responseAreaID
    ?? (row as ResponseAreaResponse & { departmentResponseAreaID?: string }).departmentResponseAreaID;
  return id != null ? String(id).trim() : '';
}

export interface ResponseAreaFormProps {
  initialData?: ResponseAreaResponse | null;
  onSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
}

export const ResponseAreaForm: React.FC<ResponseAreaFormProps> = ({
  initialData,
  onSuccess,
  onCancel,
  className = '',
}) => {
  const dispatch = useAppDispatch();
  const { isLoading, error: reduxError } = useAppSelector((state) => state.responseArea);
  const user = useAppSelector((state) => state.auth.user);

  const isEditMode = Boolean(initialData && getResponseAreaIdFromRow(initialData));

  // Same pattern as BusinessType: initialData => edit values; else default values for Add (create UI)
  const initialValues = useMemo(() => {
    if (initialData) {
      return {
        short: initialData.responseAreaShort || '',
        long: initialData.responseAreaLong || '',
        isActive: initialData.responseAreaStatus ?? true,
        extras: {
          [EXTRA_DEPARTMENT_RESPONSE_AREA_ID]: getResponseAreaIdFromRow(initialData),
          [EXTRA_DEPARTMENT_ID]: initialData.departmentID || user?.departmentID || '',
        },
      };
    }
    return {
      short: '',
      long: '',
      isActive: true,
      extras: {
        [EXTRA_DEPARTMENT_RESPONSE_AREA_ID]: '',
        [EXTRA_DEPARTMENT_ID]: user?.departmentID || '',
      },
    };
  }, [
    initialData?.responseAreaID,
    (initialData as any)?.departmentResponseAreaID,
    initialData?.responseAreaShort,
    initialData?.responseAreaLong,
    initialData?.responseAreaStatus,
    initialData?.departmentID,
    user?.departmentID,
  ]);

  return (
    <ShortLongStatusForm
      className={className}
      isEditMode={isEditMode}
      isLoading={isLoading}
      reduxError={reduxError}
      strings={{
        FORM: {
          TITLE: RESPONSE_AREA.FORM.TITLE,
          TITLE_PLACEHOLDER: RESPONSE_AREA.FORM.TITLE_PLACEHOLDER,
          DESCRIPTION: RESPONSE_AREA.FORM.DESCRIPTION,
          DESCRIPTION_PLACEHOLDER: RESPONSE_AREA.FORM.DESCRIPTION_PLACEHOLDER,
          IS_ACTIVE: RESPONSE_AREA.FORM.IS_ACTIVE,
          CANCEL_BUTTON: RESPONSE_AREA.FORM.CANCEL_BUTTON,
          SUBMIT_BUTTON: RESPONSE_AREA.FORM.SUBMIT_BUTTON,
          SUBMITTING: RESPONSE_AREA.FORM.SUBMITTING,
        },
        ERRORS: {
          TITLE_REQUIRED: RESPONSE_AREA.ERRORS.TITLE_REQUIRED,
          DESCRIPTION_REQUIRED: RESPONSE_AREA.ERRORS.DESCRIPTION_REQUIRED,
        },
        SUCCESS: {
          ADDED: RESPONSE_AREA.SUCCESS.RESPONSE_AREA_ADDED,
          UPDATED: RESPONSE_AREA.SUCCESS.RESPONSE_AREA_UPDATED,
        },
        BUTTON: {
          UPDATE: RESPONSE_AREA.BUTTON.UPDATE,
          UPDATING: RESPONSE_AREA.BUTTON.UPDATING,
        },
      }}
      initialValues={initialValues}
      onSubmit={async (values) => {
        // Prefer form state (extras) so ID is never lost; fallback to initialData
        const responseAreaID = (String(values.extras?.[EXTRA_DEPARTMENT_RESPONSE_AREA_ID] ?? '')).trim()
          || getResponseAreaIdFromRow(initialData ?? undefined);
        const departmentID = (values.extras?.[EXTRA_DEPARTMENT_ID] ?? user?.departmentID ?? '') as string;

        const basePayload = {
          departmentID,
          responseAreaShort: values.short.trim(),
          responseAreaLong: values.long.trim(),
          responseAreaStatus: values.isActive,
        };

        if (isEditMode) {
          if (!responseAreaID) {
            throw new Error('Update attempted without ResponseArea ID');
          }
          const updatePayload = { responseAreaID, ...basePayload };
          if (process.env.NODE_ENV === 'development') {
            console.log('Submitting ResponseArea (update):', { isEditMode: true, responseAreaID: updatePayload.responseAreaID });
          }
          await dispatch(updateResponseAreaThunk(updatePayload)).unwrap();
          return;
        }

        if (process.env.NODE_ENV === 'development') {
          console.log('Submitting ResponseArea (create):', { isEditMode: false });
        }
        await dispatch(createResponseAreaThunk(basePayload)).unwrap();
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

