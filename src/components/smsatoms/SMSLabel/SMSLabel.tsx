import FormLabel, { FormLabelProps } from '@mui/material/FormLabel';
import { FC, memo } from 'react';

export interface SMSLabelProps extends FormLabelProps {
  // All MUI FormLabel props are inherited (including required, htmlFor, etc.)
}

export const SMSLabel: FC<SMSLabelProps> = memo(({ ...props }) => {
  return <FormLabel {...props} />;
});

SMSLabel.displayName = 'SMSLabel';

export default SMSLabel;

