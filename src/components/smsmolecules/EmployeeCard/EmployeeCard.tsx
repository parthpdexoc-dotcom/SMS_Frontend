import React, { useState, useRef } from 'react';
import { SMSCard, SMSIcon } from '@/components/smsatoms';
import { PostPositionResponse } from '@/types/postPosition';
import { REQUESTER } from '@/constants/strings';
import { formatLastNameCommaFirstName, formatPhoneNumber } from '@/utils';
import {
  getPostPositionStatusCardTone,
  readPostPositionStatusValue,
  type PostPositionStatusCardTone,
} from '@/utils/postPositionStatusPill';
import './EmployeeCard.css';

export interface EmployeeCardProps {
  position: PostPositionResponse;
  /** Data URL for profile photo (e.g. from eligible-employees API). When set, avatar shows image; otherwise initials. */
  profilePhotoDataUrl?: string | null;
  className?: string;
  showCheckbox?: boolean;
  isChecked?: boolean;
  onCheckboxChange?: (checked: boolean) => void;
  showCloseButton?: boolean;
  onClose?: () => void;
  showEditLink?: boolean;
  /** Shift the edit control left when the visibility toggle occupies the top-right corner. */
  editOffset?: boolean;
  onEdit?: () => void;
  /**
   * When true, card uses assigned (success/green) border when status is missing from the row.
   * Status is read from `position.postPositionStatus` / `PostPositionStatus` when present.
   */
  statusAssigned?: boolean;
  /** Placeholder visibility (hidden) styling + eye toggle. */
  isHidden?: boolean;
  showVisibilityToggle?: boolean;
  isVisibilitySelected?: boolean;
  onVisibilityToggle?: () => void;
}

export const EmployeeCard: React.FC<EmployeeCardProps> = ({
  position,
  profilePhotoDataUrl,
  className = '',
  showCheckbox = false,
  isChecked = false,
  onCheckboxChange,
  showCloseButton = false,
  onClose,
  showEditLink = false,
  editOffset = false,
  onEdit,
  statusAssigned = false,
  isHidden = false,
  showVisibilityToggle = false,
  isVisibilitySelected = false,
  onVisibilityToggle,
}) => {
  const statusNum = readPostPositionStatusValue(position);
  let tone: PostPositionStatusCardTone = getPostPositionStatusCardTone(statusNum);
  if (statusAssigned && !Number.isFinite(statusNum)) {
    tone = 'success';
  }
  if (isHidden) {
    tone = 'danger';
  }

  const cardToneClass: Record<PostPositionStatusCardTone, string> = {
    danger: 'employee-card--danger',
    success: 'employee-card--applied',
    warning: 'employee-card--status-warning',
    info: 'employee-card--status-info',
    neutral: '',
  };

  const cardBorderSx: Record<PostPositionStatusCardTone, object> = {
    neutral: { p: 0 },
    danger: {
      p: 0,
      border: '2px solid var(--danger-color) !important',
      boxShadow: '0 0 0 1px color-mix(in srgb, var(--danger-color) 20%, transparent) !important',
    },
    success: {
      p: 0,
      border: '2px solid var(--success-color) !important',
      boxShadow: '0 0 0 1px color-mix(in srgb, var(--success-color) 22%, transparent) !important',
    },
    warning: {
      p: 0,
      border: '2px solid var(--warning-color) !important',
      boxShadow: '0 0 0 1px color-mix(in srgb, var(--warning-color) 28%, transparent) !important',
    },
    info: {
      p: 0,
      border: '2px solid var(--info-color) !important',
      boxShadow: '0 0 0 1px color-mix(in srgb, var(--info-color) 25%, transparent) !important',
    },
  };
  const fullName = formatLastNameCommaFirstName(position.firstName, position.lastName, 'Unknown');
  const initials = `${position.firstName?.[0] || ''}${position.lastName?.[0] || ''}`.toUpperCase() || '?';
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const nameRef = useRef<HTMLHeadingElement>(null);

  const handleNameMouseEnter = (_e: React.MouseEvent<HTMLHeadingElement>) => {
    if (nameRef.current) {
      const rect = nameRef.current.getBoundingClientRect();
      setTooltipPosition({
        top: rect.top - 35,
        left: rect.left + rect.width / 2
      });
      setShowTooltip(true);
    }
  };

  const handleNameMouseLeave = () => {
    setShowTooltip(false);
  };

  return (
    <div data-employee-name={fullName}>
      <SMSCard
        className={`employee-card${cardToneClass[tone] ? ` ${cardToneClass[tone]}` : ''} ${className}`.trim()}
        elevation={0}
        sx={cardBorderSx[tone]}
      >
      {showCheckbox && (
        <input
          type="checkbox"
          checked={isChecked}
          onChange={(e) => onCheckboxChange?.(e.target.checked)}
          className="employee-card__checkbox"
          onClick={(e) => e.stopPropagation()}
        />
      )}
      {showCloseButton && (
        <button
          className="employee-card__close-button"
          onClick={(e) => {
            e.stopPropagation();
            onClose?.();
          }}
          aria-label="Unassign employee"
          title="Unassign employee"
        >
          <SMSIcon name="close" size="sm" />
        </button>
      )}
      {showEditLink && (
        <button
          type="button"
          className={`employee-card__edit${editOffset ? ' employee-card__edit--offset' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onEdit?.();
          }}
          aria-label={REQUESTER.ASSIGN_EMPLOYEES.EDIT}
          title={REQUESTER.ASSIGN_EMPLOYEES.EDIT}
        >
          <SMSIcon name="edit" size="sm" />
        </button>
      )}
      {showVisibilityToggle && (
        <button
          type="button"
          className={`employee-card__visibility${isVisibilitySelected ? ' employee-card__visibility--selected' : ''}${isHidden ? ' employee-card__visibility--hidden' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onVisibilityToggle?.();
          }}
          aria-label={
            isHidden
              ? REQUESTER.ASSIGN_EMPLOYEES.PLACEHOLDER_UNHIDE_ARIA
              : REQUESTER.ASSIGN_EMPLOYEES.PLACEHOLDER_HIDE_ARIA
          }
          title={
            isHidden
              ? REQUESTER.ASSIGN_EMPLOYEES.PLACEHOLDER_UNHIDE_ARIA
              : REQUESTER.ASSIGN_EMPLOYEES.PLACEHOLDER_HIDE_ARIA
          }
          aria-pressed={isVisibilitySelected}
        >
          <SMSIcon name={isHidden ? 'eye-off' : 'eye'} size="sm" />
        </button>
      )}
      {/* Header with pattern */}
      <div className="employee-card__header"></div>
      
      {/* Avatar overlapping header and body */}
      <div className="employee-card__avatar">
        {profilePhotoDataUrl ? (
          <img src={profilePhotoDataUrl} alt={fullName} />
        ) : (
          initials
        )}
      </div>
      
      {/* Body content */}
      <div className="employee-card__body">
        <div className="employee-card__info">
          <h4 
            ref={nameRef}
            className="employee-card__name" 
            data-employee-name={fullName}
            onMouseEnter={handleNameMouseEnter}
            onMouseLeave={handleNameMouseLeave}
          >
            {fullName}
          </h4>
          <p
            className={`employee-card__badge${position.badgeNumber ? '' : ' employee-card__badge--empty'}`}
            aria-hidden={!position.badgeNumber}
          >
            {position.badgeNumber ? `Badge: ${position.badgeNumber}` : '\u00A0'}
          </p>
        </div>
        
        {/* Divider */}
        <div className="employee-card__divider"></div>
        
        {/* Contact/Details section */}
        {position.primaryPhone ? (
          <div className="employee-card__contact">
            <SMSIcon name="phone" size="sm" />
            <span>{formatPhoneNumber(position.primaryPhone)}</span>
          </div>
        ) : (
          <div className="employee-card__contact employee-card__contact--empty">
            <span>&nbsp;</span>
          </div>
        )}
      </div>
      {showTooltip && (
        <div 
          className="employee-card__tooltip"
          style={{
            position: 'fixed',
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
            transform: 'translateX(-50%)',
            zIndex: 999999
          }}
        >
          {fullName}
        </div>
      )}
    </SMSCard>
    </div>
  );
};
