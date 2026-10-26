import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { SMSButton, SMSCheckbox, SMSDropdown, SMSTextField } from '@/components/smsatoms';
import {
  createRequesterEmployeeThunk,
  updateRequesterEmployeeThunk,
  clearError as clearRequesterEmployeeError,
} from '@/store/slices/requesterEmployeeSlice';
import type {
  RequesterEmployee,
  RequesterEmployeeFormProps,
  CreateRequesterEmployeeRequest,
  UpdateRequesterEmployeeRequest,
} from '@/types/requesterEmployee';
import { REQUESTER_EMPLOYEE } from '@/constants/strings';
import './RequesterEmployeeForm.css';
import { fetchAvailableRequesterEmployees } from '@/store/slices/employeeSlice';
import { formatDate, formatLastNameCommaFirstName } from '@/utils';

const emptyItem = (): RequesterEmployee => ({
  requesterEmployeeID: '',
  employeeID: '',
  requesterManagerID: '',
  isPreferred: false,
  createdBy: null,
  editedBy: null,
  createdDate: null,
  editedDate: null,
});

export const RequesterEmployeeForm: React.FC<RequesterEmployeeFormProps> = ({
  mode = 'create',
  initialData,
  managerID,
  managerName,
  requesterManagerID: contextRequesterManagerID,
  onSuccess,
  onCancel,
  className = '',
}) => {
  const dispatch = useAppDispatch();
  const { isLoading, error: reduxError } = useAppSelector((state) => state.requesterEmployee);
  const [, setSubmitError] = useState<string | null>(null);
  const [form, setForm] = useState<RequesterEmployee>(() =>
    initialData ? { ...emptyItem(), ...initialData } : emptyItem()
  );
  const { availableRequesterEmployees } = useAppSelector((state) => state.employee);
  const update = useCallback(
    (field: keyof RequesterEmployee, value: string | boolean | null) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const isCreate = mode === 'create';
  const isEdit = mode === 'edit';
  const hasContextManager = Boolean(managerID?.trim());

  const handleEmployeeChange = (value: string) => {
    update('employeeID', value);
  };

  useEffect(() => {
    dispatch(clearRequesterEmployeeError());
  }, [dispatch]);
  useEffect(() => {
    if (contextRequesterManagerID) {
      dispatch(fetchAvailableRequesterEmployees(contextRequesterManagerID));
    }
  }, [dispatch, contextRequesterManagerID]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const requesterManagerID = hasContextManager
      ? (contextRequesterManagerID?.trim() || managerID?.trim() || '')
      : (form.requesterManagerID?.trim() || '');

    if (!requesterManagerID) {
      setSubmitError(REQUESTER_EMPLOYEE.FORM.ERRORS.MANAGER_REQUIRED);
      return;
    }
    if (hasContextManager && !contextRequesterManagerID?.trim()) {
      setSubmitError(REQUESTER_EMPLOYEE.FORM.ERRORS.MANAGER_LINK_MISSING);
      return;
    }
    if (!form.employeeID?.trim()) {
      setSubmitError(REQUESTER_EMPLOYEE.FORM.ERRORS.EMPLOYEE_REQUIRED);
      return;
    }
    try {
      if (isEdit && form.requesterEmployeeID) {
        const updatePayload: UpdateRequesterEmployeeRequest = {
          requesterEmployeeID: form.requesterEmployeeID,
          requesterManagerID,
          employeeID: form.employeeID,
          isPreferred: form.isPreferred ?? false,
        };
        await dispatch(updateRequesterEmployeeThunk(updatePayload)).unwrap();
      } else {
        const createPayload: CreateRequesterEmployeeRequest = {
          requesterManagerID,
          employeeID: form.employeeID,
          isPreferred: form.isPreferred ?? false,
        };
        await dispatch(createRequesterEmployeeThunk(createPayload)).unwrap();
      }
      onSuccess?.();
    } catch {
      setSubmitError(
        reduxError || 'Failed to save requester employee'
      );
    }
  };

  const { FORM, BUTTON, TABLE } = REQUESTER_EMPLOYEE;

  const employeeOptions = useMemo(() => {
    return availableRequesterEmployees.map((emp) => ({ // map employees to dropdown options
      value: emp.employeeID,
      label: formatLastNameCommaFirstName(emp.firstName, emp.lastName),
    }));
  }, [availableRequesterEmployees]);

  const submitting = isLoading;

  return (
    <form
      className={`requester-employee-form ${className}`}
      onSubmit={handleSubmit}
    >
      <div className="requester-employee-form__grid">
        <div className="requester-employee-form__field">
          <SMSTextField
            label={FORM.MANAGER}
            placeholder={FORM.SELECT_MANAGER}
            value={managerName ?? ''}
            name="managerID"
            disabled
            fullWidth
          />
        </div>

        {/* Employee */}
        <div className="requester-employee-form__field">
          {isCreate ? (
            <SMSDropdown
              label={FORM.EMPLOYEE}
              placeholder={FORM.SELECT_EMPLOYEE}
              options={employeeOptions}
              value={form.employeeID}
              onChange={(e) => handleEmployeeChange(String(e.target.value))}
              name="employeeID"
            />
          ) : (
            <SMSTextField
              label={FORM.EMPLOYEE}
              value={form.employeeID ?? ''}
              disabled
              name="employee"
              fullWidth
            />
          )}
        </div>

        {/* Preferred */}
        <div className="requester-employee-form__field requester-employee-form__field--checkbox">
          <SMSCheckbox
            label={FORM.PREFERRED}
            checked={form.isPreferred}
            onChange={(v) => update('isPreferred', v)}
          />
        </div>

      </div>

      {/* Audit: Created By / Edited By (edit mode only, like BusinessType) */}
      {isEdit && (form.createdBy || form.editedBy) && (
        <div className="requester-employee-form__audit">
          <div className="requester-employee-form__audit-row">
            <span className="requester-employee-form__audit-item">
              <span className="requester-employee-form__audit-label">
                {TABLE.COLUMNS.CREATED_BY}:
              </span>
              <span className="requester-employee-form__audit-value">
                {form.createdBy || ''}
                {form.createdDate && (
                  <span className="requester-employee-form__audit-date">
                    {' '}
                    {formatDate(form.createdDate)}
                  </span>
                )}
              </span>
            </span>
            <span className="requester-employee-form__audit-separator">|</span>
            <span className="requester-employee-form__audit-item">
              <span className="requester-employee-form__audit-label">
                {TABLE.COLUMNS.EDITED_BY}:
              </span>
              <span className="requester-employee-form__audit-value">
                {form.editedBy || ''}
                {form.editedDate && (
                  <span className="requester-employee-form__audit-date">
                    {' '}
                    {formatDate(form.editedDate)}
                  </span>
                )}
              </span>
            </span>
          </div>
        </div>
      )}

      <div className="requester-employee-form__actions">
        <SMSButton
          type="button"
          onClick={onCancel}
          disabled={submitting}
        >
          {BUTTON.CANCEL}
        </SMSButton>
        <SMSButton type="submit" disabled={submitting} loading={submitting}>
          {BUTTON.SAVE}
        </SMSButton>
      </div>
    </form>
  );
};
