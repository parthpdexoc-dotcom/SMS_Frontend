import Chip, { ChipProps } from '@mui/material/Chip';
import  { FC, forwardRef, memo, Ref } from 'react';

export interface SMSChipProps extends ChipProps {
  // All MUI Chip props are inherited
}

export const SMSChip: FC<SMSChipProps> = memo(
  forwardRef(({ variant = 'filled', ...props }, forwardedRef: Ref<HTMLDivElement>) => {
    return <Chip ref={forwardedRef} variant={variant} {...props} />;
  })
);

SMSChip.displayName = 'SMSChip';

export default SMSChip;

