import Paper, { PaperProps } from '@mui/material/Paper';
import  { FC, memo } from 'react';

export interface SMSPaperProps extends PaperProps {
  // All MUI Paper props are inherited
}

export const SMSPaper: FC<SMSPaperProps> = memo(({ variant = 'outlined', elevation = 0, ...props }) => {
  return <Paper variant={variant} elevation={elevation} {...props} />;
});

SMSPaper.displayName = 'SMSPaper';

export default SMSPaper;

