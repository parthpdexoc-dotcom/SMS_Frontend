import Box, { BoxProps } from '@mui/material/Box';
import  { FC, memo } from 'react';

export interface SMSBoxProps extends BoxProps {
  // All MUI Box props are inherited
}

export const SMSBox: FC<SMSBoxProps> = memo(({ ...props }) => {
  return <Box {...props} />;
});

SMSBox.displayName = 'SMSBox';

export default SMSBox;

