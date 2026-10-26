import Grid, { GridProps } from '@mui/material/Grid';
import { forwardRef, memo } from 'react';

export interface SMSGridProps extends GridProps {}

const SMSGridRoot = forwardRef<HTMLDivElement, SMSGridProps>(function SMSGrid(props, ref) {
  return <Grid ref={ref} {...props} />;
});

/** Single MUI Grid entry point: theme `MuiGrid` + this wrapper apply app-wide. */
export const SMSGrid = memo(SMSGridRoot);

SMSGrid.displayName = 'SMSGrid';

export default SMSGrid;

