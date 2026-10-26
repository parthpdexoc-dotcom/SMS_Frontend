import { SMSIcon } from '@/components/smsatoms';
import React from 'react';
import { TabProps } from '@/types';
import './Tab.css';

export const Tab: React.FC<TabProps> = ({
  id,
  label,
  icon,
  active = false,
  disabled = false,
  hasError = false,
  onClick,
  className = '',
}) => {
  const handleClick = () => {
    if (!disabled && onClick) {
      onClick(id);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && !disabled && onClick) {
      e.preventDefault();
      onClick(id);
    }
  };

  const classNames = [
    'tab',
    active && 'tab--active',
    disabled && 'tab--disabled',
    hasError && 'tab--error',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={classNames}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      role="tab"
      aria-selected={active}
      aria-disabled={disabled}
      id={id}
    >
      {icon && <SMSIcon name={icon} size="sm" className="tab__icon" />}
      <span className="tab__label">{label}{hasError && '*'}</span>
    </button>
  );
};

