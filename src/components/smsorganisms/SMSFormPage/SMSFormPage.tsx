import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { SMSCard, SMSIcon } from '@/components/smsatoms';
import './SMSFormPage.css';

export interface SMSFormPageProps {
  title: string;
  subtitle?: string;
  titleActions?: React.ReactNode;
  children: React.ReactNode;
  onCancel?: () => void;
  backPath?: string;
  className?: string;
  rightSidePanel?: React.ReactNode;
  rightSidePanelLabel?: string;
  onPanelOpen?: () => void;
  hideBackButton?: boolean;
  overlayClassName?: string;
  sidePanelClassName?: string;
}

export const SMSFormPage: React.FC<SMSFormPageProps> = ({
  title,
  subtitle,
  titleActions,
  children,
  onCancel,
  backPath,
  className = '',
  rightSidePanel,
  rightSidePanelLabel = 'Notes',
  onPanelOpen,
  hideBackButton = false,
  overlayClassName,
  sidePanelClassName,
}) => {
  const navigate = useNavigate();
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else if (backPath) {
      navigate(backPath);
    } else {
      navigate(-1);
    }
  };

  const togglePanel = () => {
    const newState = !isPanelOpen;
    setIsPanelOpen(newState);
    if (newState && onPanelOpen) {
      onPanelOpen();
    }
  };

  const usePortalForPanel = Boolean(overlayClassName);

  const panelContent = (
    <>
      {isPanelOpen && (
        <div
          className={`form-page__side-panel-overlay${overlayClassName ? ` ${overlayClassName}` : ''}`}
          onClick={togglePanel}
          aria-hidden="true"
        />
      )}
      <button
        type="button"
        onClick={togglePanel}
        className={`form-page__panel-toggle ${isPanelOpen ? 'form-page__panel-toggle--open' : ''}`}
        aria-label={isPanelOpen ? 'Close panel' : 'Open panel'}
      >
        <span className="form-page__panel-toggle-label">{rightSidePanelLabel}</span>
      </button>
      <div
        className={`form-page__side-panel ${isPanelOpen ? 'form-page__side-panel--open' : ''}${sidePanelClassName ? ` ${sidePanelClassName}` : ''}`}
      >
        <div className="form-page__side-panel-header">
          <h3 className="form-page__side-panel-title">{rightSidePanelLabel}</h3>
          <button
            type="button"
            onClick={togglePanel}
            className="form-page__side-panel-close"
            aria-label="Close panel"
          >
            <SMSIcon name="close" size="sm" />
          </button>
        </div>
        <div className="form-page__side-panel-content">{rightSidePanel}</div>
      </div>
    </>
  );

  const panelFragment = rightSidePanel && (usePortalForPanel ? <div className="form-page__panel-portal">{panelContent}</div> : panelContent);

  return (
    <div className={`form-page ${className}${overlayClassName ? ' form-page--high-z-overlay' : ''}`}>
      <div className="form-page__header">
        {!hideBackButton && (
          <button
            type="button"
            onClick={handleCancel}
            className="form-page__back-button"
            aria-label="Go back"
          >
            <SMSIcon name="arrowLeft" size="md" />
          </button>
        )}
        <div className="form-page__title-section">
          <div className="form-page__title-row">
            <h1 className="form-page__title">{title}</h1>
            {titleActions ? <div className="form-page__title-actions">{titleActions}</div> : null}
          </div>
          {subtitle && <p className="form-page__subtitle">{subtitle}</p>}
        </div>
      </div>

      <div className={`form-page__content ${isPanelOpen ? 'form-page__content--panel-open' : ''}`}>
        <SMSCard className="form-page__card" padding="md" elevation={1}>
          {children}
        </SMSCard>
      </div>

      {rightSidePanel && (usePortalForPanel ? createPortal(panelFragment, document.body) : panelFragment)}
    </div>
  );
};
