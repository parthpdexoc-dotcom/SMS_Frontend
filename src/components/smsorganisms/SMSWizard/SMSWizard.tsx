import React, { useState } from 'react';
import { Stepper, Step, StepLabel, StepContent } from '@mui/material';
import { SMSStack, SMSTypography, SMSButton, SMSCard } from '@/components/smsatoms';

export interface SMSWizardStep {
  label: string;
  description?: string;
  content: React.ReactNode;
  optional?: boolean;
}

export interface SMSWizardProps {
  steps: SMSWizardStep[];
  activeStep?: number;
  onStepChange?: (step: number) => void;
  onFinish?: () => void;
  onCancel?: () => void;
  finishText?: string;
  cancelText?: string;
  nextText?: string;
  backText?: string;
  orientation?: 'horizontal' | 'vertical';
}

export const SMSWizard: React.FC<SMSWizardProps> = ({
  steps,
  activeStep: controlledActiveStep,
  onStepChange,
  onFinish,
  onCancel,
  finishText = 'Finish',
  cancelText = 'Cancel',
  nextText = 'Next',
  backText = 'Back',
  orientation = 'horizontal',
}) => {
  const [internalActiveStep, setInternalActiveStep] = useState(0);
  const activeStep = controlledActiveStep !== undefined ? controlledActiveStep : internalActiveStep;

  // TODO: Implement wizard component with step navigation and validation
  const handleNext = () => {
    const newStep = activeStep + 1;
    if (controlledActiveStep === undefined) {
      setInternalActiveStep(newStep);
    }
    onStepChange?.(newStep);
    if (newStep === steps.length) {
      onFinish?.();
    }
  };

  const handleBack = () => {
    const newStep = activeStep - 1;
    if (controlledActiveStep === undefined) {
      setInternalActiveStep(newStep);
    }
    onStepChange?.(newStep);
  };

  return (
    <SMSCard sx={{ padding: 3 }}>
      <SMSStack spacing={3}>
        <Stepper activeStep={activeStep} orientation={orientation}>
          {steps.map((step, index) => (
            <Step key={index} completed={index < activeStep}>
              <StepLabel optional={step.optional ? <SMSTypography variant="caption">Optional</SMSTypography> : undefined}>
                {step.label}
              </StepLabel>
              {orientation === 'vertical' && step.description && (
                <StepContent>
                  <SMSTypography variant="body2" color="text.secondary">
                    {step.description}
                  </SMSTypography>
                </StepContent>
              )}
            </Step>
          ))}
        </Stepper>
        <div>
          {steps[activeStep]?.content}
        </div>
        <SMSStack direction="row" spacing={2} justifyContent="space-between">
          <SMSButton
            onClick={onCancel || handleBack}
            disabled={activeStep === 0}
            
          >
            {activeStep === 0 ? cancelText : backText}
          </SMSButton>
          <SMSButton onClick={handleNext}>
            {activeStep === steps.length - 1 ? finishText : nextText}
          </SMSButton>
        </SMSStack>
      </SMSStack>
    </SMSCard>
  );
};

export default SMSWizard;

