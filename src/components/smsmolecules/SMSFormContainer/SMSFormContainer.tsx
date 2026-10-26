import React, { FormEvent, ReactNode } from 'react';
import { SMSForm, SMSStack, SMSBox, SMSTypography, SMSButton, SMSCurrencyInput } from '@/components/smsatoms';
import { SMSFormField, SMSFormFieldOption } from '../SMSFormField';
import { formatDate, formatTime } from '@/utils';

export interface AuditData {
  createdBy?: string;
  createdDate?: string | Date;
  editedBy?: string;
  editedDate?: string | Date;
}

export type FormFieldType = 'text' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'switch' | 'number' | 'email' | 'tel' | 'password' | 'date' | 'time';

export interface FormFieldConfig {
  /** Field type */
  type: FormFieldType;
  /** Field name/key */
  name: string;
  /** Field label */
  label: string;
  /** Field value */
  value?: any;
  /** Change handler */
  onChange?: (value: any) => void;
  /** Error message */
  error?: string;
  /** Helper text */
  helperText?: string;
  /** Is required */
  required?: boolean;
  /** Is disabled */
  disabled?: boolean | ((isEditMode: boolean) => boolean);
  /** Placeholder text */
  placeholder?: string;
  /** Options for select/radio */
  options?: SMSFormFieldOption[];
  /** Show only on create (hide in edit mode) */
  showOnlyOnCreate?: boolean;
  /** Layout: 'full' or 'half' width */
  layout?: 'full' | 'half';
  /** Number of rows for textarea */
  rows?: number;
  /** Max length */
  maxLength?: number;
  /** Format type (e.g., 'currency') */
  formatType?: 'phone' | 'zip' | 'currency' | 'date';
  /** Decimal places for currency fields (default 2). */
  decimalPlaces?: number;
  /** Transform value before storing */
  onChangeTransform?: (value: string) => any;
  /** Custom validation */
  customValidate?: (value: any) => string | undefined;
}

export interface SMSFormContainerProps {
  /** Form submission handler */
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
  /** Cancel button handler */
  onCancel?: () => void;
  /** Form content (fields, etc.) - use this OR fields prop */
  children?: ReactNode;
  /** Field configurations - use this OR children prop */
  fields?: FormFieldConfig[];
  /**
   * When provided with `fields`, renders a second field row after `betweenFieldsContent`.
   * Use case: custom block between title/description and the rest of the form.
   */
  fieldsBottom?: FormFieldConfig[];
  /** Rendered between `fields` and `fieldsBottom` when `fieldsBottom` is set */
  betweenFieldsContent?: ReactNode;
  /** Form values object (when using fields prop) */
  values?: Record<string, any>;
  /** Additional CSS class name */
  className?: string;
  /** Form spacing between fields */
  spacing?: number;
  /** Show audit information section */
  showAuditInfo?: boolean;
  /** Audit data to display */
  auditData?: AuditData;
  /** Is edit mode (affects audit info display and field visibility) */
  isEditMode?: boolean;
  /** Submit button text */
  submitText?: string;
  /** Cancel button text */
  cancelText?: string;
  /** Loading state */
  isLoading?: boolean;
  /** Disable submit button */
  disabled?: boolean;
  /** Submit button full width when no cancel button */
  submitFullWidth?: boolean;
  /** Rendered inside the form after configured fields (e.g. custom controls) */
  additionalContent?: ReactNode;
}

export const SMSFormContainer: React.FC<SMSFormContainerProps> = ({
  onSubmit,
  onCancel,
  children,
  fields,
  fieldsBottom,
  betweenFieldsContent,
  values = {},
  className = '',
  spacing = 3,
  showAuditInfo = false,
  auditData,
  isEditMode = false,
  submitText = 'Submit',
  cancelText = 'Cancel',
  isLoading = false,
  disabled = false,
  submitFullWidth = true,
  additionalContent,
}) => {
  const renderField = (field: FormFieldConfig) => {
    // Skip fields that should only show on create when in edit mode
    if (field.showOnlyOnCreate && isEditMode) {
      return null;
    }

    const rawCurrencyValue = values[field.name] ?? field.value;
    const fieldValue = values[field.name] ?? field.value ?? '';

    const isDisabled = typeof field.disabled === 'function'
      ? field.disabled(isEditMode)
      : (field.disabled ?? false);

    const fieldError = field.error;
    const isHalf = field.layout === 'half';
    const fieldWrapperSx = isHalf ? { flex: '1 1 calc(50% - 12px)', minWidth: 0 } : { flex: '1 1 100%', minWidth: 0 };

    if (field.formatType === 'currency') {
      const numericValue =
        rawCurrencyValue === '' || rawCurrencyValue == null || Number.isNaN(rawCurrencyValue)
          ? null
          : Number(rawCurrencyValue);

      return (
        <SMSBox key={field.name} sx={fieldWrapperSx}>
          <SMSCurrencyInput
            name={field.name}
            label={field.label}
            value={numericValue}
            onChange={(value) => {
              let nextValue: unknown = value;
              if (field.onChangeTransform) {
                nextValue = field.onChangeTransform(value as never);
              }
              field.onChange?.(nextValue);
            }}
            decimalPlaces={field.decimalPlaces}
            error={Boolean(fieldError)}
            helperText={field.helperText}
            required={field.required}
            disabled={isDisabled}
            placeholder={field.placeholder}
            fullWidth
          />
        </SMSBox>
      );
    }

    const handleFieldChange = (value: any) => {
      const transformedValue = field.onChangeTransform
        ? field.onChangeTransform(value)
        : value;
      field.onChange?.(transformedValue);
    };

    // Map field type to SMSFormField type
    const smsFieldType = field.type === 'tel' ? 'text' : field.type;

    // Handle textarea separately for rows prop
    if (field.type === 'textarea') {
      return (
        <SMSBox key={field.name} sx={fieldWrapperSx}>
          <SMSFormField
            type="textarea"
            name={field.name}
            label={field.label}
            value={fieldValue}
            onChange={handleFieldChange}
            error={fieldError}
            helperText={field.helperText}
            required={field.required}
            disabled={isDisabled}
            placeholder={field.placeholder}
            rows={field.rows || 4}
            maxLength={field.maxLength}
            fullWidth
          />
        </SMSBox>
      );
    }

    // Handle text fields with maxLength
    if (field.type === 'text' || field.type === 'email' || field.type === 'tel' || field.type === 'password' || field.type === 'number') {
      return (
        <SMSBox key={field.name} sx={fieldWrapperSx}>
          <SMSFormField
            type={smsFieldType}
            name={field.name}
            label={field.label}
            value={fieldValue}
            onChange={handleFieldChange}
            error={fieldError}
            helperText={field.helperText}
            required={field.required}
            disabled={isDisabled}
            placeholder={field.placeholder}
            maxLength={field.maxLength}
            fullWidth
          />
        </SMSBox>
      );
    }

    // Handle other field types (select, checkbox, etc.)
    return (
      <SMSBox key={field.name} sx={fieldWrapperSx}>
        <SMSFormField
          type={smsFieldType}
          name={field.name}
          label={field.label}
          value={fieldValue}
          onChange={handleFieldChange}
          error={fieldError}
          helperText={field.helperText}
          required={field.required}
          disabled={isDisabled}
          placeholder={field.placeholder}
          options={field.options}
          fullWidth
        />
      </SMSBox>
    );
  };

  return (
    <SMSBox 
      className={className} 
      sx={{ 
        width: '100%',
        backgroundColor: 'transparent',
        borderRadius: 1,
        p: 0,
      }}
    >
      <SMSForm onSubmit={onSubmit} noValidate>
        <SMSStack spacing={spacing}>
          {/* Render fields from configuration OR children */}
          {fields && fieldsBottom ? (
            <SMSStack spacing={spacing} sx={{ width: '100%' }}>
              <SMSBox
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 3,
                }}
              >
                {fields.map(renderField)}
              </SMSBox>
              {betweenFieldsContent}
              <SMSBox
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 3,
                }}
              >
                {fieldsBottom.map(renderField)}
              </SMSBox>
            </SMSStack>
          ) : fields ? (
            <SMSBox
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 3,
              }}
            >
              {fields.map(renderField)}
            </SMSBox>
          ) : (
            children
          )}

          {additionalContent}

          {/* Audit Information Section */}
          {showAuditInfo && isEditMode && auditData && (
            <SMSBox
              sx={{
                mt: 3,
                p: 2,
                bgcolor: 'rgba(0, 0, 0, 0.02)',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
              }}
            >
              <SMSStack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <SMSStack direction="row" spacing={0.5} alignItems="center">
                  <SMSTypography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                    Created By:
                  </SMSTypography>
                  <SMSTypography variant="body2" sx={{ color: 'text.primary' }}>
                    {auditData.createdBy || ''}
                    {auditData.createdDate && (
                      <SMSTypography
                        component="span"
                        variant="body2"
                        sx={{ 
                          color: 'text.secondary',
                          fontSize: '0.8125rem', 
                          ml: 0.5,
                          fontWeight: 400,
                        }}
                        title={`${formatDate(auditData.createdDate.toString())} ${formatTime(auditData.createdDate.toString())}`}
                      >
                        {' '}
                        {new Date(auditData.createdDate).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </SMSTypography>
                    )}
                  </SMSTypography>
                </SMSStack>
                <SMSTypography variant="body2" sx={{ color: 'text.secondary', mx: 1, fontWeight: 400 }}>
                  |
                </SMSTypography>
                <SMSStack direction="row" spacing={0.5} alignItems="center">
                  <SMSTypography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                    Edited By:
                  </SMSTypography>
                  <SMSTypography variant="body2" sx={{ color: 'text.primary' }}>
                    {auditData.editedBy || ''}
                    {auditData.editedDate && (
                      <SMSTypography
                        component="span"
                        variant="body2"
                        sx={{ 
                          color: 'text.secondary',
                          fontSize: '0.8125rem', 
                          ml: 0.5,
                          fontWeight: 400,
                        }}
                        title={`${formatDate(auditData.editedDate.toString())} ${formatTime(auditData.editedDate.toString())}`}
                      >
                        {' '}
                        {new Date(auditData.editedDate).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </SMSTypography>
                    )}
                  </SMSTypography>
                </SMSStack>
              </SMSStack>
            </SMSBox>
          )}

          {/* Form Actions */}
          <SMSStack
            direction="row"
            spacing={2}
            justifyContent="flex-end"
            sx={{
              mt: 4,
              pt: 4,
            }}
          >
            {onCancel && (
              <SMSButton
                type="button"
                onClick={onCancel}
                disabled={isLoading}
                sx={{ minWidth: 120 }}
              >
                {cancelText}
              </SMSButton>
            )}
            <SMSButton
              type="submit"
              disabled={isLoading || disabled}
              loading={isLoading}
              fullWidth={!onCancel && submitFullWidth}
              sx={{ minWidth: 120 }}
            >
              {submitText}
            </SMSButton>
          </SMSStack>
        </SMSStack>
      </SMSForm>
    </SMSBox>
  );
};

SMSFormContainer.displayName = 'SMSFormContainer';
export default SMSFormContainer;

