import TextField, { TextFieldProps } from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import React, { FC, memo, useCallback, useRef, useState } from 'react';
import { cn } from '@/utils';
import { SMSIcon } from '@/components/smsatoms/SMSIcon';
import { SMSIconButton } from '@/components/smsatoms/SMSIconButton';
import styles from './SMSTextField.module.css';

// Extend MUI TextField props and explicitly allow `type`
export interface SMSTextFieldProps extends Omit<TextFieldProps, 'type'> {
  type?: React.InputHTMLAttributes<HTMLInputElement>['type'];
}

export const SMSTextField: FC<SMSTextFieldProps> = memo(({ InputLabelProps, className, type, InputProps, size = 'small', multiline, ...props }) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';

  const handleClickShowPassword = () => {
    setShowPassword((prev) => !prev);
  };

  const handleMouseDownPassword = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  const multilineWrapperRef = useRef<HTMLDivElement | null>(null);

  const handleMultilineWheel = useCallback((e: WheelEvent) => {
    const wrapper = multilineWrapperRef.current;
    if (!wrapper) return;
    const textarea = wrapper.querySelector('textarea');
    if (!textarea) return;
    const maxScroll = textarea.scrollHeight - textarea.clientHeight;
    if (maxScroll <= 0) return;
    e.preventDefault();
    e.stopPropagation();
    const nextScroll = textarea.scrollTop + e.deltaY;
    textarea.scrollTop = Math.max(0, Math.min(maxScroll, nextScroll));
  }, []);

  const setMultilineWrapperRef = useCallback(
    (node: HTMLDivElement | null) => {
      const prev = multilineWrapperRef.current;
      if (prev) prev.removeEventListener('wheel', handleMultilineWheel, { capture: true } as EventListenerOptions);
      (multilineWrapperRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      if (node) {
        node.addEventListener('wheel', handleMultilineWheel, { passive: false, capture: true });
      }
    },
    [handleMultilineWheel]
  );

  const textField = (
    <TextField
      variant="outlined"
      size={size}
      multiline={multiline}
      className={cn(styles.textField, className)}
      type={isPassword && showPassword ? 'text' : type}
      InputLabelProps={InputLabelProps}
      InputProps={{
        ...InputProps,
        endAdornment: isPassword ? (
          <InputAdornment position="end">
            <SMSIconButton
              aria-label="toggle password visibility"
              onClick={handleClickShowPassword}
              onMouseDown={handleMouseDownPassword}
              edge="end"
              tabIndex={-1}
              size="small"
            >
              <SMSIcon name={showPassword ? 'eye-off' : 'eye'} size="sm" />
            </SMSIconButton>
          </InputAdornment>
        ) : InputProps?.endAdornment,
      }}
      {...props}
      sx={{
        marginTop: 1,
        '& .MuiOutlinedInput-root': {
          height: 'var(--sms-input-height, 36px)',
          minHeight: 'var(--sms-input-height, 36px)',
          ...(multiline
            ? { maxHeight: 'var(--sms-input-height, 36px)', alignItems: 'flex-start', overflow: 'hidden' }
            : {}),
        },
        ...(multiline && {
          '& .MuiInputBase-inputMultiline': {
            height: '100% !important',
            minHeight: '100% !important',
            overflowY: 'auto',
            boxSizing: 'border-box',
            padding: '4px 6px',
          },
        }),
        ...props.sx,
      }}
    />
  );

  if (multiline) {
    return (
      <div ref={setMultilineWrapperRef} style={{ display: 'inline-block', width: '100%' }}>
        {textField}
      </div>
    );
  }

  return textField;
});

SMSTextField.displayName = 'SMSTextField';

export default SMSTextField;

