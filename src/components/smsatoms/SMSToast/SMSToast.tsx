import { SMSIcon } from '@/components/smsatoms';
import React from 'react';

import type { ToastProps } from '@/types';
import './SMSToast.css';

export const SMSToast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  onClose,
  className = '',
}) => {
  const getIconName = () => {
    switch (type) {
      case 'success':
        return 'check_circle';
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
      default:
        return 'info';
    }
  };

  return (
    <div className={`toast toast--${type} ${className}`} role="alert">
      <div className="toast__content">
        <SMSIcon name={getIconName()} size="sm" className="toast__icon" />
        <span className="toast__message">{message}</span>
      </div>
      {onClose && (
        <button
          type="button"
          className="toast__close"
          onClick={onClose}
          aria-label="Close notification"
        >
          <SMSIcon name="close" size="sm" />
        </button>
      )}
    </div>
  );
};
