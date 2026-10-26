import Typography, { TypographyProps } from '@mui/material/Typography';
import  { FC, memo } from 'react';

export interface SMSTypographyProps extends TypographyProps {
  // All MUI Typography props are inherited
}

export const SMSTypography: FC<SMSTypographyProps> = memo(({ ...props }) => {
  return <Typography {...props} />;
});

SMSTypography.displayName = 'SMSTypography';

export default SMSTypography;

