import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { addDays, isValid, parseISO } from 'date-fns';
import { SMSButton, SMSDropdown, SMSTextField, SMSDatePicker } from '@/components/smsatoms';
import {
  RequesterRestrict,
  RequesterOption,
  EmployeeOption,
  CreateRequesterRestrictRequest,
  UpdateRequesterRestrictRequest,
} from '@/types/requesterRestrict';
import { REQUESTER_RESTRICT } from '@/constants/strings';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { upsertRequesterRestrictThunk } from '@/store/slices/requesterRestrictedSlice';
import { formatDateToYYYYMMDD, getLocalTodayYyyyMmDd } from '@/utils/dateTimeUtils';
import './RequesterRestrictForm.css';

export type RequesterRestrictFormMode = 'create' | 'edit';

export interface RequesterRestrictFormProps {
  mode?: RequesterRestrictFormMode;
  initialData?: RequesterRestrict | null;
  requesterOptions?: RequesterOption[];
  employeeOptions?: EmployeeOption[];
  isLoadingEmployeeOptions?: boolean;
  onRequesterIdChange?: (requesterId: string) => void;
  /** If provided, requester is preselected and not editable (no dropdown). */
  lockedRequesterID?: string;
  /** Optional label for the locked requester (for display). */
  lockedRequesterName?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
}

const emptyItem = (): RequesterRestrict => ({
  requesterRestrictID: '',
  requesterID: '',
  requesterName: '',
  employeeID: '',
  employeeName: '',
  effectiveStartDate: '',
  effectiveEndDate: '',
  isCurrent: true,
  createdDate: null,
  createdUserID: null,
  createdBy: null,
  editedDate: null,
  editedUserID: null,
  editedBy: null,
});

export const RequesterRestrictForm: React.FC<RequesterRestrictFormProps> = ({
  mode = 'create',
  initialData,
  requesterOptions = [],
  employeeOptions = [],
  isLoadingEmployeeOptions = false,
  onRequesterIdChange,
  lockedRequesterID,
  lockedRequesterName,
  onSuccess,
  onCancel,
  className = '',
}) => {
  const dispatch = useAppDispatch();
  const { isLoading, error: reduxError } = useAppSelector(
    (state) => state.requesterRestricted
  );
  const requesterRestrictedList = useAppSelector(
    (state) => state.requesterRestricted.requesterRestrictedList
  );
  const { isLoading: requestersLoading } = useAppSelector((state) => state.requester);
  // Helper to format date from API (ISO string) to DateInput format (YYYY-MM-DD)
  const formatDateForInput = useCallback((dateValue: string | null | undefined): string => {
    if (!dateValue) return '';
    // If already in YYYY-MM-DD format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue.trim())) return dateValue.trim();
    // Convert ISO string to YYYY-MM-DD
    try {
      // Handle dates that might have time component or be in different formats
      const dateStr = dateValue.trim();
      // Try parsing as ISO date
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) {
        // If parsing fails, try to extract date part if it's in format like "2026-01-31T00:00:00"
        const dateMatch = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) return dateMatch[1];
        return '';
      }
      // Get YYYY-MM-DD from the date
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return '';
    }
  }, []);

  const [form, setForm] = useState<RequesterRestrict>(() => {
    if (initialData) {
      return {
        ...emptyItem(),
        ...initialData,
        // Ensure dates are in correct format for DateInput
        effectiveStartDate: formatDateForInput(initialData.effectiveStartDate),
        effectiveEndDate: formatDateForInput(initialData.effectiveEndDate),
      };
    }
    return emptyItem();
  });
  const [initialEditSnapshot, setInitialEditSnapshot] = useState<RequesterRestrict | null>(() => {
    if (initialData) {
      return {
        ...emptyItem(),
        ...initialData,
        effectiveStartDate: formatDateForInput(initialData.effectiveStartDate),
        effectiveEndDate: formatDateForInput(initialData.effectiveEndDate),
      };
    }
    return null;
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isCreate = mode === 'create';
  const isEdit = mode === 'edit';
  const isRequesterLocked = Boolean(lockedRequesterID);

  // If requester is locked (coming from requester grid), force it into form state.
  useEffect(() => {
    if (!lockedRequesterID) return;
    setForm((prev) => ({
      ...prev,
      requesterID: lockedRequesterID,
      requesterName:
        lockedRequesterName ??
        prev.requesterName ??
        requesterOptions.find((o) => o.value === lockedRequesterID)?.label ??
        lockedRequesterID,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockedRequesterID, lockedRequesterName]);

  // Update form when initialData changes (e.g., when editing different items)
  useEffect(() => {
    if (initialData) {
      const next = {
        ...emptyItem(),
        ...initialData,
        // Ensure dates are in correct format for DateInput
        effectiveStartDate: formatDateForInput(initialData.effectiveStartDate),
        effectiveEndDate: formatDateForInput(initialData.effectiveEndDate),
      };
      setForm(next);
      setInitialEditSnapshot(next);
    } else {
      setForm(emptyItem());
      setInitialEditSnapshot(null);
    }
    setSubmitError(null);
  }, [initialData, formatDateForInput]);

  const update = useCallback((field: keyof RequesterRestrict, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const isFieldFilled = useCallback((value: string | null | undefined): boolean => {
    if (value === null || value === undefined) return false;
    return String(value).trim() !== '';
  }, []);

  const areRequiredFieldsFilled = useMemo((): boolean => {
    if (isEdit) {
      return isFieldFilled(form.effectiveEndDate);
    }
    return (
      isFieldFilled(form.requesterID) &&
      isFieldFilled(form.employeeID) &&
      isFieldFilled(form.effectiveStartDate) &&
      isFieldFilled(form.effectiveEndDate)
    );
  }, [isEdit, form.requesterID, form.employeeID, form.effectiveStartDate, form.effectiveEndDate, isFieldFilled]);

  const isDirty = useMemo(() => {
    if (!isEdit || !initialEditSnapshot) return true;
    return form.effectiveEndDate !== initialEditSnapshot.effectiveEndDate;
  }, [isEdit, form.effectiveEndDate, initialEditSnapshot]);

  const canSubmit = useMemo(() => {
    if (isLoading) return false;
    if (!areRequiredFieldsFilled) return false;
    if (isEdit) return isDirty;
    return true;
  }, [isLoading, areRequiredFieldsFilled, isEdit, isDirty]);

  const handleRequesterChange = (value: string) => {
    const opt = requesterOptions.find((o) => o.value === value);
    setForm((prev) => ({
      ...prev,
      requesterID: value,
      requesterName: opt?.label ?? prev.requesterName,
      employeeID: '',
      employeeName: '',
    }));
    onRequesterIdChange?.(value);
  };

  const handleEmployeeChange = (value: string) => {
    const opt = employeeOptions.find((o) => o.value === value);
    update('employeeID', value);
    if (opt?.label) {
      update('employeeName' as keyof RequesterRestrict, opt.label);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    // In edit mode, Requester, Employee, and Start Date are disabled (non-editable)
    // We use initialData values directly for these fields, so no need to validate them
    // Only validate the End Date field which is editable
    if (isEdit) {
      // Only validate End Date as it's the only editable field in edit mode
      if (!isFieldFilled(form.effectiveEndDate)) {
        setSubmitError('End date is required. Please select a valid date.');
        return;
      }

      // Validate that End Date is strictly after Start Date
      if (isFieldFilled(form.effectiveStartDate) && isFieldFilled(form.effectiveEndDate)) {
        const start = new Date(form.effectiveStartDate);
        const end = new Date(form.effectiveEndDate);
        if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end <= start) {
          setSubmitError('End date must be after start date.');
          return;
        }
      }
      
      // Ensure initialData exists (should always be present in edit mode)
      if (!initialData) {
        setSubmitError('Unable to load record data. Please refresh and try again.');
        return;
      }
    } else {
      // In create mode, check all required fields
      if (!isFieldFilled(form.requesterID) || !isFieldFilled(form.employeeID) || 
          !isFieldFilled(form.effectiveStartDate) || !isFieldFilled(form.effectiveEndDate)) {
        setSubmitError('Please fill in all required fields');
        return;
      }

      // In create mode, prevent creating a duplicate restriction for the same requester and employee
      // with an overlapping date range.
      try {
        const newStart = new Date(form.effectiveStartDate);
        const newEnd = new Date(form.effectiveEndDate);

        const hasDuplicate = requesterRestrictedList.some((item) => {
          if (item.requesterID !== form.requesterID || item.employeeID !== form.employeeID) {
            return false;
          }

          // If dates cannot be parsed on either side, fall back to treating it as duplicate
          const existingStart = item.effectiveStartDate ? new Date(item.effectiveStartDate) : null;
          const existingEnd = item.effectiveEndDate ? new Date(item.effectiveEndDate) : null;

          if (
            Number.isNaN(newStart.getTime()) ||
            Number.isNaN(newEnd.getTime()) ||
            !existingStart ||
            !existingEnd ||
            Number.isNaN(existingStart.getTime()) ||
            Number.isNaN(existingEnd.getTime())
          ) {
            return true;
          }

          // Overlap condition: not (newEnd < existingStart || newStart > existingEnd)
          return !(newEnd < existingStart || newStart > existingEnd);
        });

        if (hasDuplicate) {
          setSubmitError(
            'This employee is already restricted for the selected requester and date range.'
          );
          return;
        }
      } catch {
        // If anything goes wrong in duplicate detection, do not block submission.
      }
    }

    try {
      const requesterRestrictID = initialData?.requesterRestrictID;

      // employeeID must come ONLY from the form/selected employee (dropdown), never from JWT or auth.
      const selectedEmployeeID =
        isEdit && initialData ? initialData.employeeID : form.employeeID;

      const payload = {
        requesterID: isEdit && initialData ? initialData.requesterID : form.requesterID,
        effectiveStartDate: isEdit && initialData ? initialData.effectiveStartDate : form.effectiveStartDate,
        effectiveEndDate: form.effectiveEndDate,
        isCurrent: isEdit && initialData ? initialData.isCurrent : form.isCurrent,
        // Explicitly set employeeID from form/selection only so it is never overridden by auth/token
        employeeID: selectedEmployeeID,
      };

      if (isEdit && requesterRestrictID) {
        await dispatch(
          upsertRequesterRestrictThunk({ requesterRestrictID, ...payload } as UpdateRequesterRestrictRequest)
        ).unwrap();
      } else {
        await dispatch(upsertRequesterRestrictThunk(payload as CreateRequesterRestrictRequest)).unwrap();
      }
      onSuccess?.();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : reduxError || 'Failed to save requester restrict'
      );
    }
  };

  const { FORM, BUTTON, TABLE } = REQUESTER_RESTRICT;

  // Get today's date in YYYY-MM-DD for min date restriction (local calendar day)
  const today = getLocalTodayYyyyMmDd();
  const minEndDate = useMemo((): string => {
    if (!form.effectiveStartDate) return today;
    const day = String(form.effectiveStartDate).trim().slice(0, 10);
    const start = parseISO(day);
    if (!isValid(start)) return today;
    const dayAfterStr = formatDateToYYYYMMDD(addDays(start, 1));
    return dayAfterStr > today ? dayAfterStr : today;
  }, [form.effectiveStartDate, today]);

  const formatAuditDate = (v: string | null | undefined) => {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime())
      ? null
      : d.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
  };
  const submitting = isLoading;

  return (
    <form className={`requester-restrict-form ${className}`} onSubmit={handleSubmit}>
      {(submitError || reduxError) && (
        <div className="requester-restrict-form__error" style={{ color: 'red', marginBottom: '1rem' }}>
          {submitError || reduxError}
        </div>
      )}
      <div className="requester-restrict-form__grid">
        {/* Requester – reference: RoutingGroupForm dropdown (id, required, loading placeholder) */}
        <div className="requester-restrict-form__field">
          {isRequesterLocked ? (
            <SMSTextField
              label={FORM.REQUESTER}
              value={lockedRequesterName ?? form.requesterName ?? form.requesterID}
              disabled
              name="requester"
              fullWidth
            />
          ) : isCreate ? (
            <SMSDropdown
              label={FORM.REQUESTER}
              placeholder={requestersLoading ? 'Loading requesters...' : FORM.SELECT_REQUESTER}
              options={requesterOptions}
              value={form.requesterID}
              onChange={(e) => handleRequesterChange(String(e.target.value))}
              name="requesterID"
              id="requesterID"
              required
              disabled={submitting || requestersLoading}
            />
          ) : (
            <SMSTextField
              label={FORM.REQUESTER}
              value={form.requesterName || form.requesterID || '-'}
              disabled
              name="requester"
              fullWidth
            />
          )}
        </div>

        {/* Employee – reference: RoutingGroupForm dropdown (id, required, loading placeholder) */}
        <div className="requester-restrict-form__field">
          {isCreate ? (
            <SMSDropdown
              label={FORM.EMPLOYEE}
              placeholder={isLoadingEmployeeOptions ? 'Loading employees...' : FORM.SELECT_EMPLOYEE}
              options={employeeOptions}
              value={form.employeeID}
              onChange={(e) => handleEmployeeChange(String(e.target.value))}
              name="employeeID"
              id="employeeID"
              required
              disabled={submitting || isLoadingEmployeeOptions}
            />
          ) : (
            <SMSTextField
              label={FORM.EMPLOYEE}
              value={form.employeeName || form.employeeID || '-'}
              disabled
              name="employee"
              fullWidth
            />
          )}
        </div>

        {/* Start Date - SMS DatePicker */}
        <div className="requester-restrict-form__field">
          {isCreate ? (
            <SMSDatePicker
              label={FORM.START_DATE}
              placeholder="Select date"
              value={form.effectiveStartDate || ''}
              onChange={(value) => update('effectiveStartDate', value)}
              required
              name="effectiveStartDate"
              id="requesterRestrictStartDate"
              disabled={submitting}
              minDate={today}
            />
          ) : (
            <SMSDatePicker
              label={FORM.START_DATE}
              value={form.effectiveStartDate || ''}
              disabled
              name="effectiveStartDate"
              onChange={(value) => update('effectiveStartDate', value)}
            />
          )}
        </div>

        {/* End Date - SMS DatePicker */}
        <div className="requester-restrict-form__field">
          {isCreate ? (
            <SMSDatePicker
              label={FORM.END_DATE}
              placeholder="Select date"
              value={form.effectiveEndDate || ''}
              onChange={(value) => update('effectiveEndDate', value)}
              required
              name="effectiveEndDate"
              id="requesterRestrictEndDate"
              disabled={submitting}
              minDate={minEndDate}
            />
          ) : (
            <SMSDatePicker
              label={FORM.END_DATE}
              placeholder="Select date"
              value={form.effectiveEndDate || ''}
              onChange={(value) => update('effectiveEndDate', value)}
              required
              name="effectiveEndDate"
              id="requesterRestrictEndDate"
              disabled={submitting}
              minDate={minEndDate}
            />
          )}
        </div>
      </div>

      {/* Audit: Created By / Edited By (edit mode only, like Requester Employee) */}
      {isEdit && (form.createdBy || form.editedBy) && (
        <div className="requester-restrict-form__audit">
          <div className="requester-restrict-form__audit-row">
            <span className="requester-restrict-form__audit-item">
              <span className="requester-restrict-form__audit-label">
                {TABLE.COLUMNS.CREATED_BY}:
              </span>
              <span className="requester-restrict-form__audit-value">
                {form.createdBy || ''}
                {form.createdDate && (
                  <span className="requester-restrict-form__audit-date">
                    {' '}
                    {formatAuditDate(form.createdDate)}
                  </span>
                )}
              </span>
            </span>
            <span className="requester-restrict-form__audit-separator">|</span>
            <span className="requester-restrict-form__audit-item">
              <span className="requester-restrict-form__audit-label">
                {TABLE.COLUMNS.EDITED_BY}:
              </span>
              <span className="requester-restrict-form__audit-value">
                {form.editedBy || ''}
                {form.editedDate && (
                  <span className="requester-restrict-form__audit-date">
                    {' '}
                    {formatAuditDate(form.editedDate)}
                  </span>
                )}
              </span>
            </span>
          </div>
        </div>
      )}

      <div className="requester-restrict-form__actions">
        <SMSButton type="button" onClick={onCancel} disabled={submitting}>
          {BUTTON.CANCEL}
        </SMSButton>
        <SMSButton
          type="submit"
          disabled={!canSubmit}
          loading={submitting}
        >
          {isEdit ? 'Update' : BUTTON.SAVE}
        </SMSButton>
      </div>
    </form>
  );
};
