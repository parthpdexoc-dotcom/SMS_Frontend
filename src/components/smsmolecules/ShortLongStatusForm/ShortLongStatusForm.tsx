import React, { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { SMSFormContainer, type FormFieldConfig } from '@/components/smsmolecules/SMSFormContainer';

export interface ShortLongStatusFormStrings {
  FORM: {
    TITLE: string;
    TITLE_PLACEHOLDER: string;
    DESCRIPTION: string;
    DESCRIPTION_PLACEHOLDER: string;
    IS_ACTIVE: string;
    CANCEL_BUTTON: string;
    SUBMIT_BUTTON: string;
    SUBMITTING: string;
  };
  ERRORS: {
    TITLE_REQUIRED: string;
    DESCRIPTION_REQUIRED: string;
  };
  SUCCESS: {
    ADDED: string;
    UPDATED: string;
  };
  BUTTON: {
    UPDATE: string;
    UPDATING: string;
  };
}

export interface ShortLongStatusFormValues {
  short: string;
  long: string;
  isActive: boolean;
  extras: Record<string, any>;
}

export type ExtraFieldType = 'text' | 'email' | 'tel' | 'password' | 'select' | 'checkbox' | 'number';

export interface ExtraField {
  key: string;
  label: string;
  type: ExtraFieldType;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  showOnlyOnCreate?: boolean; // For fields like password that only show when creating new records
  disabled?: boolean | ((isEditMode: boolean) => boolean); // For fields that should be disabled in edit mode
  /** When 'half', field is shown side-by-side with the next half-width field in a single row */
  layout?: 'full' | 'half';
  /** When true, label and input are shown side by side (inline) instead of stacked */
  labelInline?: boolean;
  /** Optional prefix shown inside the input (e.g. "$" for currency) */
  prefix?: string;
  /** Format type for the input (e.g. "currency" - same as Post form) */
  formatType?: 'phone' | 'zip' | 'currency' | 'date';
  /** Transform value before storing (e.g. currency: parse to number, same as Post form) */
  onChangeTransform?: (value: string) => any;
  /** Custom validation: return error message or undefined */
  customValidate?: (value: any) => string | undefined;
}

export interface ShortLongStatusFormProps {
  initialValues?: Partial<ShortLongStatusFormValues> | null;
  isEditMode?: boolean;
  isLoading?: boolean;
  reduxError?: string | null;
  strings: ShortLongStatusFormStrings;
  extraCheckboxes?: Array<{ key: string; label: string }>;
  extraFields?: ExtraField[];
  onSubmit: (values: ShortLongStatusFormValues) => Promise<void>;
  onSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
  showAuditInfo?: boolean;
  auditData?: {
    createdBy?: string;
    createdDate?: string | Date;
    editedBy?: string;
    editedDate?: string | Date;
  };
  /**
   * Optional flags to hide the built-in short/long fields.
   * When hidden, validation for those fields is skipped.
   * This is useful for forms that rely entirely on dropdowns or extras.
   */
  hideShortField?: boolean;
  hideLongField?: boolean;
  /**
   * Optional flag to hide the built-in "Is Active" checkbox.
   * When hidden, the underlying `isActive` value is still respected from
   * initial values; the user just can't change it from this form.
   */
  hideIsActiveCheckbox?: boolean;
  /** Inserted after standard fields, before audit/actions */
  additionalContent?: ReactNode;
  /** Inserted after Description (long field), before pay rate / extra fields */
  contentAfterDescription?: ReactNode;
  /** When true, all fields and submit are disabled (e.g. system-seeded master rows). */
  disabled?: boolean;
}

const DEFAULT_VALUES: ShortLongStatusFormValues = {
  short: '',
  long: '',
  isActive: true,
  extras: {},
};



// const areEqual = (a: ShortLongStatusFormValues, b: ShortLongStatusFormValues): boolean => {
//   const aa = normalizeForCompare(a);
//   const bb = normalizeForCompare(b);
//   if (aa.short !== bb.short) return false;
//   if (aa.long !== bb.long) return false;
//   if (aa.isActive !== bb.isActive) return false;
//   const aKeys = Object.keys(aa.extras);
//   const bKeys = Object.keys(bb.extras);
//   if (aKeys.length !== bKeys.length) return false;
//   for (const k of aKeys) {
//     if (aa.extras[k] !== bb.extras[k]) return false;
//   }
//   return true;
// };

export const ShortLongStatusForm: React.FC<ShortLongStatusFormProps> = ({
  initialValues,
  isEditMode = false,
  isLoading = false,
  reduxError,
  strings,
  extraCheckboxes = [],
  extraFields = [],
  onSubmit,
  onSuccess,
  onCancel,
  showAuditInfo = false,
  auditData,
  hideShortField = false,
  hideLongField = false,
  hideIsActiveCheckbox = false,
  additionalContent,
  contentAfterDescription,
  disabled = false,
}) => {
  const mergedInitial = useMemo<ShortLongStatusFormValues>(() => {
    return {
      ...DEFAULT_VALUES,
      ...((initialValues || {}) as Partial<ShortLongStatusFormValues>),
      extras: {
        ...(DEFAULT_VALUES.extras || {}),
        ...(((initialValues?.extras || {}) as Record<string, boolean>) || {}),
      },
    };
  }, [initialValues]);

  const [formData, setFormData] = useState<ShortLongStatusFormValues>(mergedInitial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [, setSubmitError] = useState<string | null>(null);
  const [, setSubmitSuccess] = useState(false);
  const initialSnapshotRef = useRef<ShortLongStatusFormValues>(mergedInitial);

  useEffect(() => {
    setFormData(mergedInitial);
    setErrors({});
    setSubmitError(null);
    setSubmitSuccess(false);
    initialSnapshotRef.current = mergedInitial;
  }, [mergedInitial]);


  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!hideShortField) {
      if (!formData.short.trim()) {
        newErrors.short = strings.ERRORS.TITLE_REQUIRED;
      } else if (formData.short.length > 50) {
        newErrors.short = 'Short name cannot exceed 50 characters';
      }
    }

    if (!hideLongField) {
      if (!formData.long.trim()) {
        newErrors.long = strings.ERRORS.DESCRIPTION_REQUIRED;
      } else if (formData.long.length > 1000) {
        newErrors.long = 'Description cannot exceed 1000 characters';
      }
    }

    // Validate extra fields
    extraFields.forEach((field) => {
      if (!field.required) return;
      // Skip validation for fields that should only show on create when in edit mode
      if (field.showOnlyOnCreate && isEditMode) return;

      const value = formData.extras[field.key];

      if (field.type === 'checkbox') {
        if (!Boolean(value)) {
          newErrors[field.key] = `${field.label} is required`;
        }
      } else {
        const stringValue = String(value ?? '').trim();
        if (!stringValue && value !== 0) {
          newErrors[field.key] = `${field.label} is required`;
        } else if (field.type === 'text' && stringValue.length > 100) {
          newErrors[field.key] = `${field.label} cannot exceed 100 characters`;
        }
        if (!newErrors[field.key] && field.customValidate) {
          const customError = field.customValidate(value);
          if (customError) newErrors[field.key] = customError;
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(false);

    if (!validateForm()) return;

    try {
      await onSubmit({
        short: formData.short.trim(),
        long: formData.long.trim(),
        isActive: formData.isActive,
        extras: formData.extras,
      });

      setSubmitSuccess(true);

      // Update the initial snapshot to reflect the current successful state
      // This ensures the form is no longer considered "dirty" after successful update
      initialSnapshotRef.current = {
        short: formData.short.trim(),
        long: formData.long.trim(),
        isActive: formData.isActive,
        extras: formData.extras,
      };

      setTimeout(() => {
        if (!isEditMode) {
          setFormData((prev) => ({
            ...prev,
            short: '',
            long: '',
            isActive: true,
          }));
          // Reset the initial snapshot for create mode
          initialSnapshotRef.current = DEFAULT_VALUES;
        }
        setSubmitSuccess(false);
        setSubmitError(null);
        // Small delay to ensure Redux state has updated
        setTimeout(() => {
          onSuccess?.();
        }, 50);
      }, 1500);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : reduxError || (isEditMode ? 'Failed to update' : 'Failed to add')
      );
    }
  };

  const handleChange = (field: 'short' | 'long' | 'isActive', value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value } as ShortLongStatusFormValues));
    if (field === 'short' && errors.short) setErrors((prev) => ({ ...prev, [field]: '' }));
    if (field === 'long' && errors.long) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleExtraToggle = (key: string, value: boolean) => {
    // Special coupling logic for EmployeeType checkboxes:
    // - When "isSupervisor" is checked, force "isEligible" to true and disable it.
    // - When "isSupervisor" is unchecked, also uncheck "isEligible" and re-enable it.
    // - When "isEligible" is toggled directly, it behaves independently.
    if (key === 'isSupervisor') {
      setFormData((prev) => ({
        ...prev,
        extras: {
          ...prev.extras,
          isSupervisor: value,
          isEligible: value ? true : false,
        },
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      extras: { ...prev.extras, [key]: value },
    }));
  };

  const handleExtraChange = (key: string, value: any) => {
    const field = extraFields.find((f) => f.key === key);
    const valueToStore = field?.onChangeTransform && typeof value === 'string'
      ? field.onChangeTransform(value)
      : value;
    setFormData((prev) => ({
      ...prev,
      extras: { ...prev.extras, [key]: valueToStore },
    }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  // Build form fields configuration
  const formFields = useMemo<FormFieldConfig[]>(() => {
    const fields: FormFieldConfig[] = [];

    // Short field (Title)
    if (!hideShortField) {
      fields.push({
        type: 'text',
        name: 'short',
        label: strings.FORM.TITLE,
        placeholder: strings.FORM.TITLE_PLACEHOLDER,
        value: formData.short,
        onChange: (value: string) => handleChange('short', value),
        error: errors.short,
        required: true,
        maxLength: 50,
        disabled: disabled || undefined,
      });
    }

    // Long field (Description)
    if (!hideLongField) {
      fields.push({
        type: 'textarea',
        name: 'long',
        label: strings.FORM.DESCRIPTION,
        placeholder: strings.FORM.DESCRIPTION_PLACEHOLDER,
        value: formData.long,
        onChange: (value: string) => handleChange('long', value),
        error: errors.long,
        required: true,
        rows: 4,
        maxLength: 1000,
        disabled: disabled || undefined,
      });
    }

    // Extra fields
    extraFields.forEach((field) => {
      if (field.showOnlyOnCreate && isEditMode) return;

      const rawValue = formData.extras[field.key];

      fields.push({
        type: field.type === 'tel' ? 'tel' : field.type,
        name: field.key,
        label: field.label,
        placeholder: field.placeholder,
        value: rawValue ?? '',
        onChange: (value: any) => handleExtraChange(field.key, value),
        error: errors[field.key],
        required: field.required,
        disabled: disabled || field.disabled,
        options: field.options,
        layout: field.layout,
        formatType: field.formatType,
        onChangeTransform: field.onChangeTransform,
        customValidate: field.customValidate,
        maxLength: field.type === 'text' ? 100 : undefined,
      });
    });

    // Extra checkboxes
    extraCheckboxes.forEach((cb) => {
      fields.push({
        type: 'checkbox',
        name: cb.key,
        label: cb.label,
        value: Boolean(formData.extras[cb.key]),
        onChange: (checked: boolean) => handleExtraToggle(cb.key, checked),
        layout: 'half',
        // When supervisor is checked, lock "isEligible" on and make it read-only
        disabled: disabled || (cb.key === 'isEligible' && Boolean(formData.extras.isSupervisor)),
      });
    });

    // Is Active switch
    if (!hideIsActiveCheckbox) {
      fields.push({
        type: 'switch',
        name: 'isActive',
        label: strings.FORM.IS_ACTIVE,
        value: formData.isActive,
        onChange: (checked: boolean) => handleChange('isActive', checked),
        disabled: disabled || undefined,
      });
    }

    return fields;
  }, [
    hideShortField,
    hideLongField,
    hideIsActiveCheckbox,
    formData,
    errors,
    extraFields,
    extraCheckboxes,
    isEditMode,
    strings,
    handleChange,
    handleExtraChange,
    handleExtraToggle,
    disabled,
  ]);

  const headFieldCount =
    (!hideShortField ? 1 : 0) + (!hideLongField ? 1 : 0);
  const splitForDescriptionSlot = Boolean(contentAfterDescription) && headFieldCount > 0;
  const fieldsTop = splitForDescriptionSlot ? formFields.slice(0, headFieldCount) : formFields;
  const fieldsBottom = splitForDescriptionSlot ? formFields.slice(headFieldCount) : undefined;

  const submitText = isLoading
    ? isEditMode
      ? strings.BUTTON.UPDATING
      : strings.FORM.SUBMITTING
    : isEditMode
      ? strings.BUTTON.UPDATE
      : strings.FORM.SUBMIT_BUTTON;

  // Build values object for form fields
  const formValues = useMemo(() => {
    return {
      short: formData.short,
      long: formData.long,
      isActive: formData.isActive,
      ...formData.extras,
    };
  }, [formData]);

  return (
    <SMSFormContainer
      onSubmit={handleSubmit}
      onCancel={onCancel}
      fields={fieldsBottom ? fieldsTop : formFields}
      fieldsBottom={fieldsBottom}
      betweenFieldsContent={splitForDescriptionSlot ? contentAfterDescription : undefined}
      values={formValues}
      showAuditInfo={showAuditInfo}
      auditData={auditData}
      isEditMode={isEditMode}
      submitText={submitText}
      cancelText={strings.FORM.CANCEL_BUTTON}
      isLoading={isLoading}
      disabled={disabled}
      additionalContent={additionalContent}
    />
  );
};


