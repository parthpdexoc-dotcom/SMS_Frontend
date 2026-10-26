import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SMSTextField, SMSTextFieldProps } from '@/components/smsatoms/SMSTextField';
import { processCurrencyFieldInput, toCurrencyFieldDisplay } from './currencyInputUtils';

export interface SMSCurrencyInputProps
  extends Omit<SMSTextFieldProps, 'type' | 'value' | 'onChange' | 'defaultValue'> {
  value?: number | null;
  onChange: (value: number | null) => void;
  /** Max fractional digits while typing (default 2). */
  decimalPlaces?: number;
  /** Show blank when value is 0 (default true). */
  emptyWhenZero?: boolean;
}

export const SMSCurrencyInput: React.FC<SMSCurrencyInputProps> = ({
  value,
  onChange,
  decimalPlaces = 2,
  emptyWhenZero = true,
  onFocus,
  onBlur,
  ...textFieldProps
}) => {
  const isFocusedRef = useRef(false);
  const [display, setDisplay] = useState(() =>
    toCurrencyFieldDisplay(value, { decimalPlaces, emptyWhenZero })
  );

  useEffect(() => {
    if (!isFocusedRef.current) {
      setDisplay(toCurrencyFieldDisplay(value, { decimalPlaces, emptyWhenZero }));
    }
  }, [value, decimalPlaces, emptyWhenZero]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { display: nextDisplay, numeric } = processCurrencyFieldInput(
        e.target.value,
        decimalPlaces
      );
      setDisplay(nextDisplay);
      onChange(numeric);
    },
    [decimalPlaces, onChange]
  );

  const handleFocus = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      isFocusedRef.current = true;
      onFocus?.(e);
    },
    [onFocus]
  );

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      isFocusedRef.current = false;
      setDisplay(toCurrencyFieldDisplay(value, { decimalPlaces, emptyWhenZero }));
      onBlur?.(e);
    },
    [value, decimalPlaces, emptyWhenZero, onBlur]
  );

  return (
    <SMSTextField
      type="text"
      value={display}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      inputProps={{ inputMode: 'decimal', ...textFieldProps.inputProps }}
      {...textFieldProps}
    />
  );
};

SMSCurrencyInput.displayName = 'SMSCurrencyInput';

export default SMSCurrencyInput;
