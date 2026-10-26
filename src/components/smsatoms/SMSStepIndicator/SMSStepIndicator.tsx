import React from 'react';
import './SMSStepIndicator.css';

export interface SMSStepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  className?: string;
  onStepClick?: (step: number) => void;
  disabled?: boolean;
}

export const SMSStepIndicator: React.FC<SMSStepIndicatorProps> = ({
  currentStep,
  totalSteps,
  className = '',
  onStepClick,
  disabled = false,
}) => {
  const steps = Array.from({ length: totalSteps }, (_, index) => index + 1);
  const isClickable = Boolean(onStepClick) && !disabled;

  return (
    <div
      className={`sms-step-indicator ${disabled ? 'sms-step-indicator--disabled' : ''} ${className}`}
      data-current-step={currentStep}
      aria-disabled={disabled || undefined}
    >
      {steps.map((step, index) => (
        <React.Fragment key={step}>
          <span
            className={`sms-step-indicator__step ${
              currentStep >= step ? 'sms-step-indicator__step--active' : ''
            } ${isClickable ? 'sms-step-indicator__step--clickable' : ''}`}
            onClick={isClickable ? () => onStepClick?.(step) : undefined}
            style={isClickable ? { cursor: 'pointer' } : undefined}
          >
            {step}
          </span>
          {index < totalSteps - 1 && (
            <span
              className={`sms-step-indicator__connector ${
                currentStep > step ? 'sms-step-indicator__connector--active' : ''
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};
