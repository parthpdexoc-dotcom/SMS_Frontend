import React from 'react';
import { SMSStack } from '@/components/smsatoms';
import { SMSTextField, SMSTextArea, SMSDropdown, SMSCheckbox, SMSRadio, SMSSwitch } from '@/components/smsatoms';
import { SMSLabel } from '@/components/smsatoms';

export type SMSFormFieldType = 'text' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'switch' | 'number' | 'email' | 'password' | 'date' | 'time';

export interface SMSFormFieldOption {
  label: string;
  value: string | number;
  disabled?: boolean;
}

export interface SMSFormFieldProps {
  type: SMSFormFieldType;
  name: string;
  label?: string;
  value?: any;
  onChange?: (value: any) => void;
  error?: string;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  options?: SMSFormFieldOption[];
  fullWidth?: boolean;
  rows?: number;
  multiline?: boolean;
  maxLength?: number;
}

export const SMSFormField: React.FC<SMSFormFieldProps> = ({
  type,
  name,
  label,
  value,
  onChange,
  error,
  helperText,
  required,
  disabled,
  placeholder,
  options,
  fullWidth = true,
  rows,
  maxLength,
}) => {
  // TODO: Implement unified form field component that handles all field types
  const renderField = () => {
    switch (type) {
      case 'textarea':
        // Use minRows for better Material-UI TextField behavior with multiline
        // minRows sets the initial visible height, rows sets fixed height
        const textareaRows = rows && rows > 0 ? rows : 4;
        return (
          <SMSTextArea
            label={label}
            name={name}
            value={value || ''}
            onChange={(e) => onChange?.(e.target.value)}
            error={!!error}
            helperText={error || helperText}
            required={required}
            disabled={disabled}
            placeholder={placeholder}
            fullWidth={fullWidth}
            minRows={textareaRows}
            inputProps={{ maxLength }}
          />
        );
      case 'select':
        return (
          <SMSDropdown
            label={label}
            name={name}
            value={value || ''}
            onChange={(e) => onChange?.(e.target.value)}
            error={!!error}
            helperText={error || helperText}
            required={required}
            disabled={disabled}
            fullWidth={fullWidth}
            options={options || []}
          />
        );
      case 'checkbox':
        if (!label) {
          console.warn(`SMSFormField: label is required for checkbox type. Field name: ${name}`);
          return null;
        }
        return (
          <SMSCheckbox
            name={name}
            checked={value || false}
            onChange={(checked) => onChange?.(checked)}
            error={error}
            helperText={helperText}
            disabled={disabled}
            label={label}
          />
        );
      case 'radio':
        // SMSRadio is a single radio button, not a group
        // For radio groups, we need to render multiple SMSRadio components
        if (!options || options.length === 0) {
          console.warn(`SMSFormField: options are required for radio type. Field name: ${name}`);
          return null;
        }
        return (
          <SMSStack spacing={1}>
            {options.map((option) => (
              <SMSRadio
                key={option.value}
                name={name}
                label={option.label}
                checked={value === option.value}
                onChange={(e) => {
                  if (e.target.checked) {
                    onChange?.(option.value);
                  }
                }}
                error={error}
                helperText={helperText}
                disabled={disabled || option.disabled}
              />
            ))}
          </SMSStack>
        );
      case 'switch':
        return (
          <SMSSwitch
            name={name}
            checked={value || false}
            onChange={(e) => onChange?.(e.target.checked)}
            error={error}
            helperText={helperText}
            disabled={disabled}
            label={label}
          />
        );
      default:
        return (
          <SMSTextField
            type={type}
            label={label}
            name={name}
            value={value || ''}
            onChange={(e) => onChange?.(e.target.value)}
            error={!!error}
            helperText={error || helperText}
            required={required}
            disabled={disabled}
            placeholder={placeholder}
            fullWidth={fullWidth}
            inputProps={{ maxLength }}
          />
        );
    }
  };

  return (
    <SMSStack spacing={1}>
      {label && type === 'radio' && (
        <SMSLabel required={required}>{label}</SMSLabel>
      )}
      {renderField()}
    </SMSStack>
  );
};

export default SMSFormField;

