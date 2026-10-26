import { SMSButton } from '@/components/smsatoms';
import React from 'react';
export interface FormStepFooterProps {
  onBack?: () => void;
  onCancel: () => void;
  backLabel?: string;
  cancelLabel?: string;
  primaryLabel: string;
  primaryLoading?: boolean;
  /** Label when primary is in loading state (e.g. "Submitting...") */
  primaryLoadingLabel?: string;
  primaryType?: 'submit' | 'button';
  onPrimaryClick?: () => void;
  /** Disable all buttons (e.g. while submitting) */
  disabled?: boolean;
  /** Disable only the primary button (e.g. loading step) */
  primaryDisabled?: boolean;
  showBack?: boolean;
}

export const FormStepFooter: React.FC<FormStepFooterProps> = ({
  onBack,
  onCancel,
  backLabel = 'Back',
  cancelLabel = 'Cancel',
  primaryLabel,
  primaryLoading = false,
  primaryLoadingLabel,
  primaryType = 'submit',
  onPrimaryClick,
  disabled = false,
  primaryDisabled = false,
  showBack = true,
}) => (
  <div className="form-modal__footer">
    {showBack && onBack && (
      <SMSButton
        type="button"
        onClick={onBack}
        disabled={disabled}
        className="form-modal__cancel-button"
        
      >
        {backLabel}
      </SMSButton>
    )}
    <SMSButton
      type="button"
      onClick={onCancel}
      disabled={disabled}
      className="form-modal__cancel-button"
      
    >
      {cancelLabel}
    </SMSButton>
    <SMSButton
      type={primaryType}
      disabled={disabled || primaryDisabled}
      className="form-modal__submit-button"
      {...(primaryType === 'button' && onPrimaryClick ? { onClick: onPrimaryClick } : {})}
    >
      {primaryLoading ? (primaryLoadingLabel ?? 'Submitting...') : primaryLabel}
    </SMSButton>
  </div>
);
