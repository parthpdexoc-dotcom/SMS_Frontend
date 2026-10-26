import React, { useState, useCallback, useMemo } from 'react';
import { SMSStack, SMSTypography, SMSSwitch } from '@/components/smsatoms';
import type {
  RequesterAuthorized,
  RequesterAuthorizedFormProps,
  DisplayRequesterAuthorized,
} from '@/types/requesterAuthorized';
import { REQUESTER_AUTHORIZED } from '@/constants/strings';
import { SMSFormContainer, type FormFieldConfig } from '@/components/smsmolecules/SMSFormContainer';
import { formatPhoneNumber, unformatPhoneNumber, validateEmail } from '@/utils';

const emptyItem = (): RequesterAuthorized => ({
  requesterAuthorizedID: '',
  requesterID: '',
  firstName: '',
  lastName: '',
  primaryPhone: '',
  secondaryPhone: '',
  primaryEmail: '',
  secondaryEmail: '',
  status: 1, // Active by default
  createdBy: null,
  editedBy: null,
  createdDate: null,
  editedDate: null,
});

export const RequesterAuthorizedForm: React.FC<RequesterAuthorizedFormProps> = ({
  mode = 'create',
  initialData,
  requesterOptions = [],
  requesterID: contextRequesterID,
  requesterName: contextRequesterName,
  onSuccess,
  onCancel,
  className = '',
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<RequesterAuthorized>(() =>
    initialData ? { ...emptyItem(), ...initialData } : emptyItem()
  );
  
  const update = useCallback(
    (field: keyof RequesterAuthorized, value: string | number | null) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      // Clear field error when user starts typing
      if (fieldErrors[field]) {
        setFieldErrors((prev) => ({ ...prev, [field]: '' }));
      }
    },
    [fieldErrors]
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
  };

  const validatePhone = (phone: string): boolean => {
    const phoneRegex = /^[\d\s\-\(\)]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    setFieldErrors({});
    
    const errors: Record<string, string> = {};
    
    // Basic validation
    if (!form.requesterID) {
      errors.requesterID = REQUESTER_AUTHORIZED.FORM.ERRORS.REQUESTER_REQUIRED;
    }
    if (!form.firstName?.trim()) {
      errors.firstName = REQUESTER_AUTHORIZED.FORM.ERRORS.FIRST_NAME_REQUIRED;
    }
    if (!form.lastName?.trim()) {
      errors.lastName = REQUESTER_AUTHORIZED.FORM.ERRORS.LAST_NAME_REQUIRED;
    }
    if (!form.primaryPhone?.trim()) {
      errors.primaryPhone = REQUESTER_AUTHORIZED.FORM.ERRORS.PRIMARY_PHONE_REQUIRED;
    } else if (!validatePhone(form.primaryPhone)) {
      errors.primaryPhone = REQUESTER_AUTHORIZED.FORM.ERRORS.PHONE_INVALID;
    }
    if (!form.primaryEmail?.trim()) {
      errors.primaryEmail = REQUESTER_AUTHORIZED.FORM.ERRORS.PRIMARY_EMAIL_REQUIRED;
    } else if (!validateEmail(form.primaryEmail)) {
      errors.primaryEmail = REQUESTER_AUTHORIZED.FORM.ERRORS.EMAIL_INVALID;
    }
    if (form.secondaryEmail && !validateEmail(form.secondaryEmail)) {
      errors.secondaryEmail = REQUESTER_AUTHORIZED.FORM.ERRORS.EMAIL_INVALID;
    }
    if (form.secondaryPhone && !validatePhone(form.secondaryPhone)) {
      errors.secondaryPhone = REQUESTER_AUTHORIZED.FORM.ERRORS.PHONE_INVALID;
    }
    
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setSubmitting(false);
      return;
    }

    try {
      const toSave: RequesterAuthorized = {
        ...form,
        requesterAuthorizedID: form.requesterAuthorizedID || (crypto.randomUUID?.() ?? `id-${Date.now()}`),
        primaryPhone: unformatPhoneNumber(form.primaryPhone || ''),
        secondaryPhone: unformatPhoneNumber(form.secondaryPhone || ''),
      };
      onSuccess?.(toSave);
    } finally {
      setSubmitting(false);
    }
  };

  const { FORM, BUTTON } = REQUESTER_AUTHORIZED;

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
      value: (initialData as DisplayRequesterAuthorized | undefined)?.requesterName ?? form.requesterID,
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

  const fields: FormFieldConfig[] = useMemo(
    () => [
      requesterField,
      {
        type: 'text',
        name: 'firstName',
        label: FORM.FIRST_NAME,
        value: form.firstName ?? '',
        onChange: (v) => update('firstName', String(v)),
        error: fieldErrors.firstName,
        required: true,
        disabled: submitting,
        layout: 'half',
      },
      {
        type: 'text',
        name: 'lastName',
        label: FORM.LAST_NAME,
        value: form.lastName ?? '',
        onChange: (v) => update('lastName', String(v)),
        error: fieldErrors.lastName,
        required: true,
        disabled: submitting,
        layout: 'half',
      },
      {
        type: 'text',
        name: 'primaryPhone',
        label: FORM.PRIMARY_PHONE,
        value: form.primaryPhone ?? '',
        onChange: (v) => update('primaryPhone', formatPhoneNumber(v)),
        error: fieldErrors.primaryPhone,
        required: true,
        disabled: submitting,
        layout: 'half',
      },
      {
        type: 'text',
        name: 'secondaryPhone',
        label: FORM.SECONDARY_PHONE,
        value: form.secondaryPhone ?? '',
        onChange: (v) => update('secondaryPhone', formatPhoneNumber(v)),
        error: fieldErrors.secondaryPhone,
        disabled: submitting,
        layout: 'half',
      },
      {
        type: 'text',
        name: 'primaryEmail',
        label: FORM.PRIMARY_EMAIL,
        value: form.primaryEmail ?? '',
        onChange: (v) => update('primaryEmail', String(v)),
        error: fieldErrors.primaryEmail,
        required: true,
        disabled: submitting,
        layout: 'half',
      },
      {
        type: 'text',
        name: 'secondaryEmail',
        label: FORM.SECONDARY_EMAIL,
        value: form.secondaryEmail ?? '',
        onChange: (v) => update('secondaryEmail', String(v)),
        error: fieldErrors.secondaryEmail,
        disabled: submitting,
        layout: 'half',
      },
          ],
    [requesterField, form, submitting, update, fieldErrors]
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
          <SMSSwitch
            label={FORM.STATUS}
            checked={form.status === 1}
            onChange={(e) => update('status', e.target.checked ? 1 : 0)}
            disabled={submitting}
          />
          {submitError && (
            <SMSTypography variant="body2" color="error">
              {submitError}
            </SMSTypography>
          )}
        </SMSStack>
      }
    />
  );
};
