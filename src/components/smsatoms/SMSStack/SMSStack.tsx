import Stack, { StackProps } from '@mui/material/Stack';
import  { FC, memo } from 'react';

export interface SMSStackProps extends StackProps {
  // All MUI Stack props are inherited
}

export const SMSStack: FC<SMSStackProps> = memo(({ ...props }) => {
  return <Stack {...props} />;
});

SMSStack.displayName = 'SMSStack';

export default SMSStack;

