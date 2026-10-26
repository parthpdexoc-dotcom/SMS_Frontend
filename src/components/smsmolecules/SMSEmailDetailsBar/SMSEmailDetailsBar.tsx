import React from 'react';
import type { SMSEmailDetailsBarProps } from './SMSEmailDetailsBar.types';
import './SMSEmailDetailsBar.css';

export const SMSEmailDetailsBar: React.FC<SMSEmailDetailsBarProps> = ({
  items,
  className = '',
}) => {
  if (items.length === 0) return null;

  return (
    <div className={`sms-email-details-bar ${className}`.trim()}>
      {items.map((item, index) => (
        <React.Fragment key={item.label}>
          {index > 0 ? <span className="sms-email-details-bar__separator">|</span> : null}
          <span className="sms-email-details-bar__label">{item.label}:</span>
          <span className="sms-email-details-bar__value">{item.value}</span>
        </React.Fragment>
      ))}
    </div>
  );
};
