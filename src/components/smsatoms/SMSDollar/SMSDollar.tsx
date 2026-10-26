import { FC, memo } from 'react';
import { SMSIcon, SMSIconButton, type SMSIconButtonProps } from '@/components/smsatoms';

export interface SMSDollarProps extends Omit<SMSIconButtonProps, 'children' | 'title' | 'aria-label'> {
  /** Accessible label and tooltip text for the payment action. */
  label: string;
  iconSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

/**
 * Reusable dollar / payment icon button built from {@link SMSIconButton} + money icon.
 */
export const SMSDollar: FC<SMSDollarProps> = memo(function SMSDollar({
  label,
  iconSize = 'sm',
  tone = 'positive',
  size = 'small',
  className = '',
  ...iconButtonProps
}) {
  return (
    <SMSIconButton
      tone={tone}
      size={size}
      title={label}
      aria-label={label}
      className={`sms-dollar${className ? ` ${className}` : ''}`}
      {...iconButtonProps}
    >
      <SMSIcon name="money" size={iconSize} />
    </SMSIconButton>
  );
});

SMSDollar.displayName = 'SMSDollar';

export default SMSDollar;
