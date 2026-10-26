import Checkbox, { CheckboxProps } from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import React, { FC, memo } from 'react';
import { cn } from '@/utils';
import styles from './SMSCheckbox.module.css';

export interface SMSCheckboxProps extends Omit<CheckboxProps, 'onChange'> {
  /** Plain text or a node (e.g. text with an inline link). */
  label: React.ReactNode;
  onChange?: (checked: boolean) => void;
  error?: string;
  helperText?: string;
}

export const SMSCheckbox: FC<SMSCheckboxProps> = memo(
  ({ label, onChange, error, helperText, checked, disabled, className, sx, ...props }) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e.target.checked);
    };

    // NOTE: Tooltip support was removed per product decision.
    // Keeping this commented block for potential future reuse:
    //
    // const hasTooltip = Boolean(tooltip != null && String(tooltip).trim() !== '');
    // if (hasTooltip) {
    //   return (
    //     <Tooltip title={tooltip} placement="top">
    //       <span style={{ display: 'inline-flex' }}>{body}</span>
    //     </Tooltip>
    //   );
    // }

    return (
      <div className={cn(styles.checkbox, className)}>
        <FormControlLabel
          control={
            <Checkbox
              checked={!!checked}
              onChange={handleChange}
              disabled={disabled}
              sx={[
                {
                  color: 'var(--text-secondary)',
                  '&.Mui-checked': { color: 'var(--color-primary)' },
                },
                ...(sx ? (Array.isArray(sx) ? sx : [sx]) : []),
              ]}
              {...props}
            />
          }
          label={label}
        />
        {(error || helperText) && (
          <FormHelperText error={!!error}>{error || helperText}</FormHelperText>
        )}
      </div>
    );
  }
);

SMSCheckbox.displayName = 'SMSCheckbox';

export default SMSCheckbox;

