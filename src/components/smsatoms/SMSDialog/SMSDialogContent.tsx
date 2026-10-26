import DialogContent, { DialogContentProps } from '@mui/material/DialogContent';
import { FC, memo } from 'react';

export interface SMSDialogContentProps extends DialogContentProps {
  // All MUI DialogContent props are inherited
}

export const SMSDialogContent: FC<SMSDialogContentProps> = memo(({ sx, ...props }) => {
  return (
    <DialogContent
      {...props}
      sx={{
        // Must use the same selector as MUI's `paddingTop: 0` rule or it loses on specificity.
        '.MuiDialogTitle-root + &': {
          paddingTop: 'var(--space-5, 0.5rem)',
        },
        ...sx,
      }}
    />
  );
});

SMSDialogContent.displayName = 'SMSDialogContent';

export default SMSDialogContent;

