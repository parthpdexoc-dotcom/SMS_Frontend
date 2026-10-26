import React, { useEffect } from 'react';
import { SMSToast } from '@/components/smsatoms';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { removeToast } from '@/store/slices/toastSlice';
import './SMSToastContainer.css';

export const SMSToastContainer: React.FC = () => {
  const dispatch = useAppDispatch();
  const toasts = useAppSelector((state) => state.toast.toasts);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    toasts.forEach((toast) => {
      const duration = toast.duration && toast.duration > 0 ? Math.min(toast.duration, 5000) : 5000;

      const timer = setTimeout(() => {
        dispatch(removeToast(toast.id));
      }, duration);
      timers.push(timer);
    });

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [toasts, dispatch]);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="toast-container" role="region" aria-live="polite" aria-label="Notifications">
      {toasts.map((toast) => (
        <SMSToast
          key={toast.id}
          id={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => dispatch(removeToast(toast.id))}
        />
      ))}
    </div>
  );
};
