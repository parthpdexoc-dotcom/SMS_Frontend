import React from 'react';
import { SMSGrid, SMSStack, SMSCard } from '@/components/smsatoms';
import { useMediaQuery, useTheme } from '@mui/material';

export interface SMSMasterDetailProps {
  master: {
    title?: string;
    content: React.ReactNode;
    width?: number;
  };
  detail: {
    title?: string;
    content: React.ReactNode;
    width?: number;
  };
  defaultDetailWidth?: number;
  responsive?: boolean;
}

export const SMSMasterDetail: React.FC<SMSMasterDetailProps> = ({
  master,
  detail,
  defaultDetailWidth = 6,
  responsive = true,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const masterWidth = master.width || (12 - (detail.width || defaultDetailWidth));
  const detailWidth = detail.width || defaultDetailWidth;

  if (responsive && isMobile) {
    return (
      <SMSStack spacing={2}>
        <SMSCard sx={{ padding: 2 }}>
          {master.title && <h3>{master.title}</h3>}
          {master.content}
        </SMSCard>
        <SMSCard sx={{ padding: 2 }}>
          {detail.title && <h3>{detail.title}</h3>}
          {detail.content}
        </SMSCard>
      </SMSStack>
    );
  }

  return (
    <SMSGrid container spacing={3}>
      <SMSGrid item xs={12} md={masterWidth}>
        <SMSCard sx={{ padding: 2, height: '100%' }}>
          {master.title && <h3>{master.title}</h3>}
          {master.content}
        </SMSCard>
      </SMSGrid>
      <SMSGrid item xs={12} md={detailWidth}>
        <SMSCard sx={{ padding: 2, height: '100%' }}>
          {detail.title && <h3>{detail.title}</h3>}
          {detail.content}
        </SMSCard>
      </SMSGrid>
    </SMSGrid>
  );
};

export default SMSMasterDetail;

