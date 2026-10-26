import React from 'react';
import { SMSStack } from '@/components/smsatoms';
import { useTheme } from '@mui/material/styles';

export interface SMSPageLayoutProps {
  children: React.ReactNode;
  spacing?: number;
  padding?: number | { xs?: number; sm?: number; md?: number };
  backgroundColor?: string;
}

export const SMSPageLayout: React.FC<SMSPageLayoutProps> = ({
  children,
  spacing = 3,
  padding = { xs: 2, md: 3 },
  backgroundColor,
}) => {
  const theme = useTheme();

  return (
    <SMSStack
      spacing={spacing}
      sx={{
        flex: 1,
        padding,
        backgroundColor: backgroundColor || theme.palette.background.default,
        minHeight: '100%',
        overflowY: 'auto',
      }}
    >
      {children}
    </SMSStack>
  );
};

export default SMSPageLayout;

