import React from 'react';
import {
  SMSCard,
  SMSBox,
  SMSStack,
  SMSTypography,
} from '@/components/smsatoms';

type CloseFormCardProps = {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export const CloseFormCard: React.FC<CloseFormCardProps> = ({ title, children, footer }) => (
  <SMSCard
    variant="outlined"
    sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, bgcolor: 'background.paper' }}
  >
    <SMSStack sx={{ pb: 1, borderBottom: 1, borderColor: 'divider' }}>
      <SMSTypography component="h3" variant="subtitle1" fontWeight={700} color="primary">
        {title}
      </SMSTypography>
    </SMSStack>
    <SMSBox sx={{ pt: 0.5 }}>{children}</SMSBox>
    {footer ? (
      <SMSStack
        direction="row"
        justifyContent="flex-end"
        alignItems="center"
        spacing={2}
        flexWrap="wrap"
        sx={{ pt: 2, borderTop: 1, borderColor: 'divider' }}
      >
        {footer}
      </SMSStack>
    ) : null}
  </SMSCard>
);

export type CloseFormStepperItem = { key: string; title: string };

export const CloseFormStepper: React.FC<{ items: CloseFormStepperItem[]; activeIndex1Based: number }> = ({
  items,
  activeIndex1Based,
}) => (
  <SMSStack
    direction={{ xs: 'column', sm: 'row' }}
    alignItems={{ xs: 'stretch', sm: 'flex-end' }}
    justifyContent="center"
    sx={{ mb: 3, py: 2, width: 1, gap: { xs: 2, sm: 0 } }}
  >
    {items.map((item, index) => {
      const stepNum = index + 1;
      const isActive = activeIndex1Based === stepNum;
      const isDone = activeIndex1Based > stepNum;
      const state: 'idle' | 'active' | 'done' = isDone ? 'done' : isActive ? 'active' : 'idle';
      return (
        <React.Fragment key={item.key}>
          <SMSStack alignItems="center" spacing={1} sx={{ minWidth: { sm: 120 } }}>
            <SMSBox
              sx={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
                fontSize: '0.875rem',
                border: '2px solid',
                ...(state === 'idle' && {
                  bgcolor: 'grey.200',
                  color: 'text.secondary',
                  borderColor: 'grey.300',
                }),
                ...(state === 'active' && {
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  borderColor: 'primary.main',
                }),
                ...(state === 'done' && {
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  borderColor: 'primary.main',
                }),
              }}
            >
              {stepNum}
            </SMSBox>
            <SMSTypography
              variant="caption"
              textAlign="center"
              sx={{
                lineHeight: 1.2,
                fontWeight: state === 'idle' ? 500 : 600,
                color:
                  state === 'active'
                    ? 'primary.main'
                    : state === 'done'
                      ? 'primary.main'
                      : 'text.secondary',
              }}
            >
              {item.title}
            </SMSTypography>
          </SMSStack>
          {index < items.length - 1 && (
            <SMSBox
              sx={{
                flex: { sm: '1 1 24px' },
                height: { xs: 20, sm: 2 },
                width: { xs: 2, sm: 'auto' },
                alignSelf: { xs: 'center', sm: 'center' },
                mb: { sm: 2.5 },
                bgcolor: activeIndex1Based > stepNum ? 'primary.main' : 'grey.300',
              }}
            />
          )}
        </React.Fragment>
      );
    })}
  </SMSStack>
);
