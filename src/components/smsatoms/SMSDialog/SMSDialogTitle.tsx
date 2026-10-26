import DialogTitle, { DialogTitleProps } from '@mui/material/DialogTitle';
import { FC, memo } from 'react';

export interface SMSDialogTitleProps extends DialogTitleProps {
  // All MUI DialogTitle props are inherited
}

export const SMSDialogTitle: FC<SMSDialogTitleProps> = memo(({ ...props }) => {
  return <DialogTitle {...props} />;
});

SMSDialogTitle.displayName = 'SMSDialogTitle';

export default SMSDialogTitle;

