import Dialog, { DialogProps } from '@mui/material/Dialog';
import { FC, memo } from 'react';

export interface SMSDialogProps extends Omit<DialogProps, 'open'> {
  open: boolean;
}

export const SMSDialog: FC<SMSDialogProps> = memo(({ open, ...props }) => {
  return (
    <Dialog
      open={open}
      {...props}
      PaperProps={{
        ...props.PaperProps,
        sx: {
          borderRadius: 2,
          boxShadow: '0px 8px 40px rgba(0, 0, 0, 0.16)',
          backgroundColor: 'background.paper',
          ...props.PaperProps?.sx,
        },
      }}
      BackdropProps={{
        ...props.BackdropProps,
        sx: {
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          ...props.BackdropProps?.sx,
        },
      }}
    />
  );
});

SMSDialog.displayName = 'SMSDialog';

export default SMSDialog;

