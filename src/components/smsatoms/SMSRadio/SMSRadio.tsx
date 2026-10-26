import Radio, { RadioProps } from '@mui/material/Radio';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import React, { FC, memo } from 'react';

export interface SMSRadioProps extends Omit<RadioProps, 'onChange'> {
  label: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  helperText?: string;
}

export const SMSRadio: FC<SMSRadioProps> = memo(
  ({ label, onChange, error, helperText, checked, disabled, ...props }) => {
    return (
      <>
        <FormControlLabel
          control={
            <Radio checked={!!checked} onChange={onChange} disabled={disabled} {...props} />
          }
          label={label}
        />
        {(error || helperText) && (
          <FormHelperText error={!!error}>{error || helperText}</FormHelperText>
        )}
      </>
    );
  }
);

SMSRadio.displayName = 'SMSRadio';

export default SMSRadio;

