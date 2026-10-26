import React, { useState, useCallback, useMemo } from 'react';
import { SMSCheckbox, SMSStack, SMSTypography } from '@/components/smsatoms';
import type {
  RequesterManager,
  RequesterManagerFormProps,
  RequestManagerResponseDto,
  DisplayRequesterManager,
} from '@/types/requesterManager';
import { REQUESTER_MANAGER } from '@/constants/strings';
import { SMSFormContainer, type FormFieldConfig } from '@/components/smsmolecules/SMSFormContainer';

const emptyItem = (): RequesterManager => ({
  requesterManagerID: '',
  employeeID: '',
  requesterID: '',
  isShared: false,
  isRequestShared: false,
  isEmployeeShared: false,
  requesterEmployees: [],
  createdBy: null,
  editedBy: null,
  createdDate: null,
  editedDate: null,
});

export const RequesterManagerForm: React.FC<RequesterManagerFormProps> = ({
  mode = 'create',
  initialData,
  requesterOptions = [],
  employeeOptions = [],
  isLoadingEmployeeOptions = false,
  onRequesterIdChange,
  requesterID: contextRequesterID,
  requesterName: contextRequesterName,
  onSuccess,
  onCancel,
  className = '',
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [form, setForm] = useState<RequesterManager>(() =>
    initialData ? { ...emptyItem(), ...initialData } : emptyItem()
  );

  const update = useCallback(
    (field: keyof RequesterManager, value: string | null) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const isCreate = mode === 'create';
  const isEdit = mode === 'edit';
  const hasContextRequester = Boolean(contextRequesterID);

  React.useEffect(() => {
    if (!contextRequesterID) return;
    setForm((prev) => ({ ...prev, requesterID: contextRequesterID }));
  }, [contextRequesterID]);

  const handleRequesterChange = (value: string) => {
    update('requesterID', value);
    update('employeeID', '');
    onRequesterIdChange?.(value);
  };

  const handleManagerChange = (value: string) => {
    update('employeeID', value);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Basic validation (API requires requesterID + manager/employee ID)
      if (!form.requesterID) {
        setSubmitError(REQUESTER_MANAGER.FORM.ERRORS.REQUESTER_REQUIRED);
        return;
      }
      if (!form.employeeID) {
        setSubmitError(REQUESTER_MANAGER.FORM.ERRORS.MANAGER_REQUIRED);
        return;
      }
      if (form.isShared && !form.isRequestShared && !form.isEmployeeShared) {
        setSubmitError(REQUESTER_MANAGER.FORM.ERRORS.SHARED_SELECTION_REQUIRED);
        return;
      }
      const toSave: RequesterManager = {
        ...form,
        requesterManagerID: form.requesterManagerID || (crypto.randomUUID?.() ?? `id-${Date.now()}`),
      };
      onSuccess?.(toSave);
    } finally {
      setSubmitting(false);
    }
  };

  const { FORM, BUTTON } = REQUESTER_MANAGER;

  const requesterField: FormFieldConfig = useMemo(() => {
    if (hasContextRequester) {
      return {
        type: 'text',
        name: 'requester',
        label: FORM.REQUESTER,
        value: contextRequesterName ?? form.requesterID,
        disabled: true,
        layout: 'half',
      };
    }

    if (isCreate) {
      return {
        type: 'select',
        name: 'requesterID',
        label: FORM.REQUESTER,
        value: form.requesterID,
        onChange: (v) => handleRequesterChange(String(v)),
        placeholder: FORM.SELECT_REQUESTER,
        options: requesterOptions,
        required: true,
        disabled: submitting,
        layout: 'half',
      };
    }

    return {
      type: 'text',
      name: 'requester',
      label: FORM.REQUESTER,
      value: (initialData as DisplayRequesterManager | undefined)?.requesterName ?? form.requesterID,
      disabled: true,
      layout: 'half',
    };
  }, [
    FORM.REQUESTER,
    FORM.SELECT_REQUESTER,
    contextRequesterName,
    form.requesterID,
    hasContextRequester,
    handleRequesterChange,
    initialData,
    isCreate,
    requesterOptions,
    submitting,
  ]);

  const managerField: FormFieldConfig = useMemo(() => {
    if (isCreate) {
      return {
        type: 'select',
        name: 'employeeID',
        label: FORM.MANAGER,
        value: form.employeeID ?? '',
        onChange: (v) => handleManagerChange(String(v)),
        placeholder: isLoadingEmployeeOptions ? FORM.LOADING_MANAGERS : FORM.SELECT_EMPLOYEE,
        options: employeeOptions,
        required: true,
        disabled: submitting,
        layout: 'half',
      };
    }

    return {
      type: 'text',
      name: 'employeeName',
      label: FORM.MANAGER,
      value: (initialData as RequestManagerResponseDto | undefined)?.employeeName ?? form.employeeID ?? '',
      disabled: true,
      layout: 'half',
    };
  }, [
    FORM.LOADING_MANAGERS,
    FORM.MANAGER,
    FORM.SELECT_EMPLOYEE,
    employeeOptions,
    form.employeeID,
    handleManagerChange,
    initialData,
    isCreate,
    isLoadingEmployeeOptions,
    submitting,
  ]);

  const fields: FormFieldConfig[] = useMemo(
    () => [
      requesterField,
      managerField,
    ],
    [managerField, requesterField]
  );

  return (
    <SMSFormContainer
      className={className}
      onSubmit={() => handleSubmit()}
      onCancel={onCancel}
      fields={fields}
      isEditMode={isEdit}
      isLoading={submitting}
      submitText={BUTTON.SAVE}
      cancelText={BUTTON.CANCEL}
      showAuditInfo={isEdit && Boolean(form.createdBy || form.editedBy)}
      auditData={{
        createdBy: form.createdBy ?? undefined,
        createdDate: form.createdDate ?? undefined,
        editedBy: form.editedBy ?? undefined,
        editedDate: form.editedDate ?? undefined,
      }}
      additionalContent={
        <SMSStack spacing={2}>
          {submitError && (
            <SMSTypography variant="body2" color="error">
              {submitError}
            </SMSTypography>
          )}

          <SMSStack
            direction="row"
            spacing={3}
            sx={{
              flexWrap: 'nowrap',
              alignItems: 'center',
            }}
          >
            <SMSCheckbox
              label={FORM.IS_SHARED}
              checked={Boolean(form.isShared)}
              onChange={(checked) =>
                setForm((prev) => ({
                  ...prev,
                  isShared: Boolean(checked),
                  // If master toggle is off, clear backend shared flags.
                  isRequestShared: checked ? Boolean(prev.isRequestShared) : false,
                  isEmployeeShared: checked ? Boolean(prev.isEmployeeShared) : false,
                }))
              }
              inputProps={{ name: 'isShared' }}
            />

            {form.isShared && (
              <>
                <SMSCheckbox
                  label={FORM.IS_REQUEST_SHARED}
                  checked={Boolean(form.isRequestShared)}
                  onChange={(checked) =>
                    setForm((prev) => ({ ...prev, isRequestShared: Boolean(checked) }))
                  }
                  inputProps={{ name: 'isRequestShared' }}
                />
                <SMSCheckbox
                  label={FORM.IS_EMPLOYEE_SHARED}
                  checked={Boolean(form.isEmployeeShared)}
                  onChange={(checked) =>
                    setForm((prev) => ({ ...prev, isEmployeeShared: Boolean(checked) }))
                  }
                  inputProps={{ name: 'isEmployeeShared' }}
                />
              </>
            )}
          </SMSStack>
        </SMSStack>
      }
    />
  );
};
