import React from 'react';
import { Stack, StackProps } from '@mui/material';

export interface SMSStackColumnProps extends Omit<StackProps, 'direction' | 'gap'> {
  gap?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  className?: string;
  sx?: StackProps['sx'];
}

export const SMSStackColumn: React.FC<SMSStackColumnProps> = ({
  children,
  gap = 'md',
  className = '',
  sx,
  ...props
}) => {
  const gapMap = {
    xs: 0.5,
    sm: 1,
    md: 2,
    lg: 3,
    xl: 4,
    '2xl': 6,
    '3xl': 8,
  };

  return (
    <Stack direction="column" className={className} spacing={gapMap[gap]} sx={sx} {...props}>
      {children}
    </Stack>
  );
};
