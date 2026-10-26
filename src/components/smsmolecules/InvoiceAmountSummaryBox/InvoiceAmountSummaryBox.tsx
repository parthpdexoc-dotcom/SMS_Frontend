import React from 'react';
import type { InvoiceAmountSummaryBoxProps } from '@/types/invoiceAmountSummary';
import './InvoiceAmountSummaryBox.css';

export const InvoiceAmountSummaryBox: React.FC<InvoiceAmountSummaryBoxProps> = ({ title, rows }) => (
  <div className="invoice-amount-summary">
    <div className="invoice-amount-summary__box">
      {title ? <h3 className="invoice-amount-summary__title">{title}</h3> : null}
      {rows.map(({ key, label, value, variant = 'default' }) => {
        const rowClass =
          variant === 'total'
            ? 'invoice-amount-summary__row invoice-amount-summary__row--total'
            : variant === 'error'
              ? 'invoice-amount-summary__row invoice-amount-summary__row--error'
              : 'invoice-amount-summary__row';

        return (
          <div key={key} className={rowClass}>
            <span>{label}</span>
            <span className="invoice-amount-summary__value">{value}</span>
          </div>
        );
      })}
    </div>
  </div>
);
