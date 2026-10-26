import React from 'react';
import { SMSBox, SMSCard, SMSLoader, SMSStack, SMSTypography } from '@/components/smsatoms';
import { FormStepFooter } from './FormStepFooter';

export interface QuestionnaireLoadingStepProps {
  onBack: () => void;
  onCancel: () => void;
  nextLabel: string;
  backLabel: string;
  cancelLabel: string;
  title?: string;
  loadingMessage?: string;
}

export const QuestionnaireLoadingStep: React.FC<QuestionnaireLoadingStepProps> = ({
  onBack,
  onCancel,
  nextLabel,
  backLabel,
  cancelLabel,
  title = 'Questionnaires',
  loadingMessage = 'Loading questionnaires...',
}) => (
  <SMSBox component="section" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
    <SMSCard variant="outlined" sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, bgcolor: 'background.paper' }}>
      <SMSStack sx={{ pb: 1, borderBottom: 1, borderColor: 'divider' }}>
        <SMSTypography component="h3" variant="subtitle1" fontWeight={700} color="primary">
          {title}
        </SMSTypography>
      </SMSStack>
      <SMSBox sx={{ display: 'flex', justifyContent: 'center' }}>
        <SMSLoader loadingText={loadingMessage} aria-label={loadingMessage} />
      </SMSBox>
    </SMSCard>
    <FormStepFooter
      showBack
      onBack={onBack}
      onCancel={onCancel}
      backLabel={backLabel}
      cancelLabel={cancelLabel}
      primaryLabel={nextLabel}
      primaryType="button"
      primaryDisabled
    />
  </SMSBox>
);
