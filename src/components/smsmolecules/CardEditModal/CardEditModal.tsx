import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  SMSButton,
  SMSCheckbox,
  SMSTextField,
  SMSIcon,
} from '@/components/smsatoms';
import { REQUESTER } from '@/constants/strings';
import { formatPhoneNumber, unformatPhoneNumber } from '@/utils/formatters';
import {
  formatPlaceholderBadgeInput,
  isValidOptionalPhone,
  isValidOptionalPlaceholderBadge,
} from '@/utils/validationUtils';
import '../EmployeeCard/EmployeeCard.css';
import './CardEditModal.css';

export type CardEditDraft = {
  firstName: string;
  lastName: string;
  employeeNumber: string;
  contactNumber: string;
  enableInvoiceAndPayroll: boolean;
  /** When true, this placeholder is unique per position and a badge number is not allowed. */
  isUniquePerPosition: boolean;
};

const emptyDraft = (): CardEditDraft => ({
  firstName: '',
  lastName: '',
  employeeNumber: '',
  contactNumber: '',
  enableInvoiceAndPayroll: false,
  isUniquePerPosition: false,
});

const computeInitials = (firstName: string, lastName: string, fallback = '?'): string => {
  const first = firstName.trim();
  const last = lastName.trim();
  if (!first && !last) return fallback;
  return `${first[0] || ''}${last[0] || ''}`.toUpperCase() || fallback;
};

export interface CardEditModalProps {
  open: boolean;
  initialValues?: CardEditDraft | null;
  onClose: () => void;
  onSave: (values: CardEditDraft) => void;
  disabled?: boolean;
  avatarLabel?: string;
  /** When true, invoice/payroll checkbox and badge are visible but not editable (e.g. existing placeholder on a post position). */
  disableEnableInvoiceAndPayroll?: boolean;
}

export const CardEditModal: React.FC<CardEditModalProps> = ({
  open,
  initialValues,
  onClose,
  onSave,
  disabled = false,
  avatarLabel = '?',
  disableEnableInvoiceAndPayroll = false,
}) => {
  const [draft, setDraft] = useState<CardEditDraft>(emptyDraft);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    if (!open) return;
    setShowErrors(false);
    if (initialValues) {
      setDraft({
        firstName: initialValues.firstName,
        lastName: initialValues.lastName,
        employeeNumber: initialValues.isUniquePerPosition
          ? ''
          : initialValues.employeeNumber,
        contactNumber: initialValues.contactNumber
          ? formatPhoneNumber(initialValues.contactNumber)
          : '',
        enableInvoiceAndPayroll: initialValues.enableInvoiceAndPayroll,
        isUniquePerPosition: initialValues.isUniquePerPosition,
      });
    } else {
      setDraft(emptyDraft());
    }
  }, [open, initialValues]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const displayAvatar = useMemo(
    () => computeInitials(draft.firstName, draft.lastName, avatarLabel),
    [draft.firstName, draft.lastName, avatarLabel]
  );

  const badgeLocked = draft.isUniquePerPosition;
  const badgeRequired = draft.enableInvoiceAndPayroll && !badgeLocked;

  const lastNameMissing = showErrors && !draft.lastName.trim();
  const firstNameMissing = showErrors && !draft.firstName.trim();
  const badgeMissing = showErrors && badgeRequired && !draft.employeeNumber.trim();
  const badgeInvalid =
    showErrors && !badgeLocked && !isValidOptionalPlaceholderBadge(draft.employeeNumber);
  const phoneInvalid = showErrors && !isValidOptionalPhone(draft.contactNumber);

  const handleSave = useCallback(() => {
    setShowErrors(true);
    const hasRequired = draft.firstName.trim().length > 0 && draft.lastName.trim().length > 0;
    const badgeOk =
      badgeLocked ||
      (isValidOptionalPlaceholderBadge(draft.employeeNumber) &&
        (!draft.enableInvoiceAndPayroll || draft.employeeNumber.trim().length > 0));
    const phoneOk = isValidOptionalPhone(draft.contactNumber);
    if (!hasRequired || !badgeOk || !phoneOk) return;

    onSave({
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      employeeNumber: badgeLocked ? '' : formatPlaceholderBadgeInput(draft.employeeNumber),
      contactNumber: draft.contactNumber.trim()
        ? unformatPhoneNumber(draft.contactNumber)
        : '',
      enableInvoiceAndPayroll: draft.enableInvoiceAndPayroll,
      isUniquePerPosition: draft.isUniquePerPosition,
    });
  }, [badgeLocked, draft, onSave]);

  if (!open) return null;

  return createPortal(
    <div
      className="card-edit-modal-overlay"
      role="presentation"
      onClick={disabled ? undefined : onClose}
    >
      <div
        className="card-edit-modal__card employee-card"
        role="dialog"
        aria-modal="true"
        aria-label="Edit card"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="employee-card__close-button"
          onClick={onClose}
          disabled={disabled}
          aria-label="Close"
          title="Close"
        >
          <SMSIcon name="close" size="sm" />
        </button>
        <div className="employee-card__header" />
        <div className="employee-card__avatar">{displayAvatar}</div>
        <div className="card-edit-modal__form employee-card__body">
          <SMSTextField
            fullWidth
            size="small"
            label={`${REQUESTER.ASSIGN_EMPLOYEES.PLACEHOLDER_LAST_NAME} *`}
            value={draft.lastName}
            onChange={(e) => setDraft((prev) => ({ ...prev, lastName: e.target.value }))}
            disabled={disabled}
            error={lastNameMissing}
            helperText={
              lastNameMissing ? REQUESTER.ASSIGN_EMPLOYEES.PLACEHOLDER_LAST_NAME_REQUIRED : undefined
            }
          />
          <SMSTextField
            fullWidth
            size="small"
            label={`${REQUESTER.ASSIGN_EMPLOYEES.PLACEHOLDER_FIRST_NAME} *`}
            value={draft.firstName}
            onChange={(e) => setDraft((prev) => ({ ...prev, firstName: e.target.value }))}
            disabled={disabled}
            error={firstNameMissing}
            helperText={
              firstNameMissing ? REQUESTER.ASSIGN_EMPLOYEES.PLACEHOLDER_FIRST_NAME_REQUIRED : undefined
            }
          />
          <SMSTextField
            fullWidth
            size="small"
            label={
              badgeRequired
                ? REQUESTER.ASSIGN_EMPLOYEES.PLACEHOLDER_BADGE_REQUIRED_LABEL
                : REQUESTER.ASSIGN_EMPLOYEES.PLACEHOLDER_BADGE
            }
            value={draft.employeeNumber}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                employeeNumber: formatPlaceholderBadgeInput(e.target.value),
              }))
            }
            disabled={disabled || badgeLocked || disableEnableInvoiceAndPayroll}
            inputProps={{ inputMode: 'numeric', maxLength: 5 }}
            error={badgeMissing || badgeInvalid}
            helperText={
              badgeMissing
                ? REQUESTER.ASSIGN_EMPLOYEES.PLACEHOLDER_BADGE_REQUIRED
                : badgeInvalid
                  ? REQUESTER.ASSIGN_EMPLOYEES.PLACEHOLDER_BADGE_INVALID
                  : undefined
            }
          />
          <SMSTextField
            fullWidth
            size="small"
            label={REQUESTER.ASSIGN_EMPLOYEES.PLACEHOLDER_PHONE}
            value={draft.contactNumber}
            onChange={(e) =>
              setDraft((prev) => ({ ...prev, contactNumber: formatPhoneNumber(e.target.value) }))
            }
            disabled={disabled}
            error={phoneInvalid}
            helperText={
              phoneInvalid ? REQUESTER.ASSIGN_EMPLOYEES.PLACEHOLDER_PHONE_INVALID : undefined
            }
            InputProps={{
              startAdornment: <SMSIcon name="phone" size="sm" />,
            }}
          />
          <div className="card-edit-modal__checkbox">
            <SMSCheckbox
              label={REQUESTER.ASSIGN_EMPLOYEES.PLACEHOLDER_UNIQUE_PER_POST}
              checked={draft.isUniquePerPosition}
              onChange={(checked) =>
                setDraft((prev) => ({
                  ...prev,
                  isUniquePerPosition: checked,
                  employeeNumber: checked ? '' : prev.employeeNumber,
                }))
              }
              disabled={disabled}
            />
          </div>
          <div className="card-edit-modal__checkbox">
            <SMSCheckbox
              label={REQUESTER.ASSIGN_EMPLOYEES.ENABLE_PAYROLL_AND_INVOICING}
              checked={draft.enableInvoiceAndPayroll}
              onChange={(checked) =>
                setDraft((prev) => ({ ...prev, enableInvoiceAndPayroll: checked }))
              }
              disabled={disabled || disableEnableInvoiceAndPayroll}
            />
          </div>
          <div className="card-edit-modal__actions">
            <SMSButton variant="text" onClick={onClose} disabled={disabled}>
              Cancel
            </SMSButton>
            <SMSButton onClick={handleSave} disabled={disabled}>
              {initialValues ? 'Update' : 'Save'}
            </SMSButton>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
