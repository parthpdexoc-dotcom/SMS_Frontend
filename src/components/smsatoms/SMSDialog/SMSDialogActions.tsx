import DialogActions, { DialogActionsProps } from '@mui/material/DialogActions';
import { FC, memo } from 'react';

export interface SMSDialogActionsProps extends DialogActionsProps {
  // All MUI DialogActions props are inherited
}

export const SMSDialogActions: FC<SMSDialogActionsProps> = memo(({ ...props }) => {
  return <DialogActions {...props} />;
});

SMSDialogActions.displayName = 'SMSDialogActions';

export default SMSDialogActions;

