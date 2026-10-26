import Switch, { SwitchProps } from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import React, { FC, memo } from 'react';

export interface SMSSwitchProps extends Omit<SwitchProps, 'onChange'> {
  label?: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  helperText?: string;
}

export const SMSSwitch: FC<SMSSwitchProps> = memo(
  ({ label, onChange, error, helperText, checked, disabled, ...props }) => {
    const control = <Switch checked={!!checked} onChange={onChange} disabled={disabled} {...props} />;

    return (
      <>
        {label ? (
          <FormControlLabel
            control={control}
            label={label}
            sx={{
              alignItems: 'center',
              marginLeft: 0,
              marginRight: 0,
              columnGap: 1.5,
              '& .MuiFormControlLabel-label': {
                marginLeft: '0 !important',
              },
            }}
          />
        ) : (
          control
        )}
        {(error || helperText) && (
          <FormHelperText error={!!error}>{error || helperText}</FormHelperText>
        )}
      </>
    );
  }
);

SMSSwitch.displayName = 'SMSSwitch';

export default SMSSwitch;

