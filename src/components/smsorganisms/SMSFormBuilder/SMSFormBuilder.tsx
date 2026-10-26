import React, { FormEvent } from 'react';
import { SMSStack, SMSCard } from '@/components/smsatoms';
import { SMSFormField } from '@/components/smsmolecules';
import { SMSButton } from '@/components/smsatoms';

export interface SMSFormFieldConfig {
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'switch' | 'number' | 'email' | 'password' | 'date' | 'time';
  name: string;
  label: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  options?: Array<{ label: string; value: string | number }>;
  validation?: (value: any) => string | undefined;
}

export interface SMSFormBuilderProps {
  fields: SMSFormFieldConfig[];
  initialValues?: Record<string, any>;
  onSubmit: (values: Record<string, any>) => void;
  onCancel?: () => void;
  submitText?: string;
  cancelText?: string;
  loading?: boolean;
  spacing?: number;
  showActions?: boolean;
}

export const SMSFormBuilder: React.FC<SMSFormBuilderProps> = ({
  fields,
  initialValues = {},
  onSubmit,
  onCancel,
  submitText = 'Submit',
  cancelText = 'Cancel',
  loading = false,
  spacing = 3,
  showActions = true,
}) => {
  const [values, setValues] = React.useState<Record<string, any>>(initialValues);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  // TODO: Implement form component with validation and error handling
  const handleChange = (name: string, value: any) => {
    setValues(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    fields.forEach(field => {
      if (field.required && !values[field.name]) {
        newErrors[field.name] = `${field.label} is required`;
      } else if (field.validation) {
        const error = field.validation(values[field.name]);
        if (error) {
          newErrors[field.name] = error;
        }
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(values);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <SMSCard sx={{ padding: 3 }}>
        <SMSStack spacing={spacing}>
          {fields.map(field => (
            <SMSFormField
              key={field.name}
              type={field.type}
              name={field.name}
              label={field.label}
              value={values[field.name]}
              onChange={(value) => handleChange(field.name, value)}
              error={errors[field.name]}
              required={field.required}
              disabled={field.disabled}
              placeholder={field.placeholder}
              options={field.options}
            />
          ))}
          {showActions && (
            <SMSStack direction="row" spacing={2} justifyContent="flex-end">
              {onCancel && (
                <SMSButton onClick={onCancel} disabled={loading}>
                  {cancelText}
                </SMSButton>
              )}
              <SMSButton type="submit" disabled={loading} loading={loading}>
                {submitText}
              </SMSButton>
            </SMSStack>
          )}
        </SMSStack>
      </SMSCard>
    </form>
  );
};

SMSFormBuilder.displayName = 'SMSFormBuilder';
export default SMSFormBuilder;

