import React from 'react';
import InputAdornment from '@mui/material/InputAdornment';
import type { SMSDropdownOption } from '@/components/smsatoms';
import { SMSCard, SMSChip, SMSDatePicker, SMSDropdown, SMSTextField, SMSTypography } from '@/components/smsatoms';
import { STATISTIC_LABEL_SX } from '@/components/smsatoms/SMSStatisticCard';
import {
  isNegativeNumberInput,
  sanitizeMileageInput,
} from '@/components/smsmolecules/SMSCloseForm/utils';
import { PAYMENT_GRID } from '@/constants/strings';
import type { PaymentEntryFormState } from '@/types/payment';
import './EditablePaymentSlate.css';

const COL = PAYMENT_GRID.REQUESTER_PAYMENT_PAGE.TABLE.COLUMNS;
const FORM = PAYMENT_GRID.FORM;

const COMPACT_LABEL_SX = {
  ...STATISTIC_LABEL_SX,
  fontSize: '0.625rem',
  lineHeight: 1.15,
} as const;

export interface EditablePaymentSlateProps {
  requesterName: string;
  value: PaymentEntryFormState;
  onChange: (patch: Partial<PaymentEntryFormState>) => void;
  errors?: Partial<Record<keyof PaymentEntryFormState, string>>;
  disabled?: boolean;
  amountReadOnly?: boolean;
  amountLabel?: string;
  paymentTypeOptions?: SMSDropdownOption[];
  paymentTypesLoading?: boolean;
}

export const EditablePaymentSlate: React.FC<EditablePaymentSlateProps> = ({
  requesterName,
  value,
  onChange,
  errors = {},
  disabled = false,
  amountReadOnly = false,
  amountLabel,
  paymentTypeOptions = [],
  paymentTypesLoading = false,
}) => (
  <SMSCard variant="outlined" padding="none" className="editable-payment-slate">
    <div
      className="editable-payment-slate__row"
      role="group"
      aria-label={PAYMENT_GRID.SETTLE_PENDING_INVOICES.ENTRY_ARIA_LABEL}
    >
      <div className="editable-payment-slate__cell">
        <SMSTypography variant="caption" color="text.secondary" sx={COMPACT_LABEL_SX} component="div">
          {FORM.REQUESTER}
        </SMSTypography>
        <SMSChip
          label={requesterName.trim() || PAYMENT_GRID.EMPTY_PLACEHOLDER}
          size="small"
          variant="outlined"
          sx={{ fontWeight: 600, maxWidth: '100%' }}
        />
      </div>

      <div className="editable-payment-slate__cell">
        <SMSDatePicker
          label={COL.DATE}
          value={value.paymentDate}
          onChange={(next) => onChange({ paymentDate: next })}
          required
          disabled={disabled}
          valueFormat="YYYY-MM-DD"
          format="MM/DD/YYYY"
          error={errors.paymentDate}
        />
      </div>

      <div className="editable-payment-slate__cell">
        <SMSTextField
          label={amountLabel ?? COL.AMOUNT_PAID}
          value={value.amount}
          onChange={(e) => {
            if (amountReadOnly) return;
            const nextValue = sanitizeMileageInput(e.target.value);
            if (isNegativeNumberInput(nextValue)) return;
            onChange({ amount: nextValue });
          }}
          placeholder={FORM.AMOUNT_PLACEHOLDER}
          required
          type="text"
          inputMode="decimal"
          disabled={disabled || amountReadOnly}
          error={Boolean(errors.amount)}
          helperText={errors.amount}
          fullWidth
          InputProps={{
            readOnly: amountReadOnly,
            startAdornment: (
              <InputAdornment position="start" className="editable-payment-slate__amount-adornment">
                $
              </InputAdornment>
            ),
          }}
        />
      </div>

      <div className="editable-payment-slate__cell">
        <SMSDropdown
          label={COL.PAYMENT_TYPE}
          options={paymentTypeOptions}
          value={value.paymentTypeId}
          onChange={(e) => onChange({ paymentTypeId: String(e.target.value) })}
          disabled={disabled || paymentTypesLoading}
          searchable={false}
          fullWidth
          error={Boolean(errors.paymentTypeId)}
          helperText={errors.paymentTypeId}
          required
        />
      </div>

      <div className="editable-payment-slate__cell">
        <SMSTextField
          label={COL.REFERENCE_NUMBER}
          value={value.referenceNumber}
          onChange={(e) => onChange({ referenceNumber: e.target.value })}
          placeholder={FORM.REFERENCE_PLACEHOLDER}
          disabled={disabled}
          fullWidth
        />
      </div>
    </div>
  </SMSCard>
);
