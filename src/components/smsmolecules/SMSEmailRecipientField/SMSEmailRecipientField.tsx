import React from 'react';
import { SMSFieldLabel } from '@/components/smsmolecules/SMSFieldLabel';
import type { SMSEmailRecipientFieldProps } from './SMSEmailRecipientField.types';
import './SMSEmailRecipientField.css';

export const SMSEmailRecipientField: React.FC<SMSEmailRecipientFieldProps> = ({
  label,
  required,
  addRecipientsLabel,
  selected,
  onAdd,
  onRemove,
  disabled = false,
  className = '',
}) => (
  <div className={`sms-email-recipient-field ${className}`.trim()}>
    <div className="sms-email-recipient-field__header">
      <SMSFieldLabel required={required}>{label}</SMSFieldLabel>
      <button
        type="button"
        className="sms-email-recipient-field__add"
        onClick={onAdd}
        disabled={disabled}
      >
        {addRecipientsLabel}
      </button>
    </div>
    <div className="sms-email-recipient-field__box">
      {selected.length > 0 ? (
        <div className="sms-email-recipient-field__chips">
          {selected.map((recipient) => (
            <span key={recipient.employeeId} className="sms-email-recipient-field__chip">
              {recipient.employeeNumber
                ? `${recipient.employeeName} (${recipient.employeeNumber})`
                : recipient.employeeName}
              {disabled ? null : (
                <button
                  type="button"
                  className="sms-email-recipient-field__chip-remove"
                  onClick={() => onRemove(recipient.employeeId)}
                  aria-label={`Remove ${recipient.employeeName}`}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  </div>
);
