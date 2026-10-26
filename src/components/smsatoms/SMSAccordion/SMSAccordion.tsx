import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import type { AccordionProps } from '@mui/material/Accordion';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { FC, ReactNode } from 'react';

import { SMSBox } from '@/components/smsatoms/SMSBox';
import { SMSTypography } from '@/components/smsatoms/SMSTypography';

export interface SMSAccordionProps extends Omit<AccordionProps, 'children' | 'title'> {
  title: ReactNode;
  children: ReactNode;
  defaultExpanded?: boolean;
}

export const SMSAccordion: FC<SMSAccordionProps> = ({
  title,
  children,
  defaultExpanded = true,
  sx,
  ...props
}) => {
  const isControlled = props.expanded !== undefined;
  return (
    <Accordion
      {...(isControlled ? {} : { defaultExpanded })}
      elevation={0}
      disableGutters
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        '&:before': { display: 'none' },
        ...sx,
      }}
      {...props}
    >
      <AccordionSummary
        expandIcon={
          <ExpandMoreIcon fontSize="small" />
        }
        sx={{
          minHeight: 40,
          pl: 0.75,
          pr: 2,
          alignItems: 'center',
          '& .MuiAccordionSummary-expandIconWrapper': {
            order: -1,
            ml: 0,
            mr: 0.5,
          },
          '& .MuiAccordionSummary-content': {
            my: 0.5,
            ml: 0,
            minWidth: 0,
            width: '100%',
            overflow: 'visible',
          },
        }}
      >
        <SMSTypography component="div" variant="subtitle2" sx={{ fontWeight: 700, width: '100%', minWidth: 0 }}>
          {title}
        </SMSTypography>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 0, pt: 0, pb: 0 }}>
        <SMSBox>{children}</SMSBox>
      </AccordionDetails>
    </Accordion>
  );
};

export default SMSAccordion;

