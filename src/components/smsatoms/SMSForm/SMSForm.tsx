import React, { FormEvent, FormHTMLAttributes, FC, memo } from 'react';

export interface SMSFormProps extends Omit<FormHTMLAttributes<HTMLFormElement>, 'onSubmit'> {
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
  children: React.ReactNode;
}

export const SMSForm: FC<SMSFormProps> = memo(({ onSubmit, children, className, ...props }) => {
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit?.(e);
  };

  return (
    <form onSubmit={handleSubmit} className={className} {...props}>
      {children}
    </form>
  );
});

SMSForm.displayName = 'SMSForm';
export default SMSForm;

