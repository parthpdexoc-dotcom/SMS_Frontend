import { SMSButton, SMSCard } from '@/components/smsatoms';
import React from 'react';
import { ButtonVariant, StatCardProps } from '@/types';
import './StatCard.css';

function statCardButtonSx(variant: ButtonVariant): { variant: 'contained' | 'outlined'; color: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' } {
  switch (variant) {
    case 'secondary':
      return { variant: 'outlined', color: 'primary' };
    case 'success':
      return { variant: 'contained', color: 'success' };
    case 'warning':
      return { variant: 'contained', color: 'warning' };
    case 'danger':
      return { variant: 'contained', color: 'error' };
    case 'info':
      return { variant: 'contained', color: 'info' };
    default:
      return { variant: 'contained', color: 'primary' };
  }
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  icon,
  buttonText,
  buttonVariant = 'primary',
  onClick,
  color,
  className = '',
}) => {
  const gradientStyle = color ? {
    '--stat-card-gradient': `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`
  } as React.CSSProperties : undefined;

  return (
    <SMSCard className={`stat-card ${className}`} elevation={0} style={gradientStyle}>
      <div className="stat-card__icon-wrapper">
        {icon}
      </div>
      <h3 className="stat-card__title">{title}</h3>
      <div className="stat-card__button">
        <SMSButton {...statCardButtonSx(buttonVariant)} onClick={onClick} fullWidth>
          {buttonText}
        </SMSButton>
      </div>
    </SMSCard>
  );
};

