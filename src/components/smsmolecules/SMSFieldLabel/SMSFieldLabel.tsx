import React from 'react';
import type { SMSFieldLabelProps } from './SMSFieldLabel.types';
import './SMSFieldLabel.css';

export const SMSFieldLabel: React.FC<SMSFieldLabelProps> = ({
  children,
  required = false,
  className = '',
}) => (
  <span className={`sms-field-label ${className}`.trim()}>
    {children}
    {required ? <span className="sms-field-label__required">*</span> : null}
  </span>
);
