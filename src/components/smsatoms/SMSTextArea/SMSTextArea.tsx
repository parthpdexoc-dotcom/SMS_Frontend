import TextField, { TextFieldProps } from '@mui/material/TextField';
import  { FC, memo } from 'react';

export interface SMSTextAreaProps extends Omit<TextFieldProps, 'multiline'> {
  rows?: number;
  minRows?: number;
  maxRows?: number;
}

export const SMSTextArea: FC<SMSTextAreaProps> = memo(({ rows, minRows, maxRows, InputProps, sx, ...props }) => {
  return (
    <TextField
      variant="outlined"
      multiline
      rows={rows}
      minRows={minRows}
      maxRows={maxRows}
      InputProps={InputProps}
      sx={{
        marginTop: 1,
        '& .MuiOutlinedInput-root': {
          backgroundColor: 'background.paper',
        },
        ...sx,
      }}
      {...props}
    />
  );
});

SMSTextArea.displayName = 'SMSTextArea';

export default SMSTextArea;

