import React, { useState, useEffect, useMemo } from 'react';
import { SMSButton, SMSDropdown, SMSMultiSelectDropdown, SMSSwitch, SMSTextArea, SMSTextField } from '@/components/smsatoms';
import { ROUTING_GROUP } from '@/constants/strings';
import { RoutingGroupResponse } from '@/types/routingGroup';
import { ApprovalType } from '@/types/vehicleApproval';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { upsertRoutingGroupThunk } from '@/store/slices/routingGroupSlice';
import { showToast } from '@/store/slices/toastSlice';
import { fetchEmployees } from '@/store/slices/employeeSlice';
import { formatLastNameCommaFirstName, validateEmail } from '@/utils';
import './RoutingGroupForm.css';

export interface RoutingGroupFormProps {
  initialData?: RoutingGroupResponse | null;
  onSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
}

const NULL_APPROVAL_TYPE_VALUE = '';

const APPROVAL_TYPE_OPTIONS: { value: ApprovalType; label: string }[] = [
  { value: ApprovalType.SpecialEventApproval, label: ROUTING_GROUP.FORM.APPROVAL_TYPE_SPECIAL_EVENT },
  { value: ApprovalType.VehicleApproval, label: ROUTING_GROUP.FORM.APPROVAL_TYPE_VEHICLE },
  { value: ApprovalType.PremitApproval, label: ROUTING_GROUP.FORM.APPROVAL_TYPE_PERMIT },
];

interface RoutingGroupFormData {
  approvalType: ApprovalType | null;
  approverShort: string;
  approverLong: string;
  approverEmail: string;
  employeeIDs: string[];
  approverStatus: boolean;
}

interface RoutingGroupFormErrors {
  approvalType?: string;
  approverShort?: string;
  approverLong?: string;
  approverEmail?: string;
  employeeIDs?: string;
  /** Used for duplicate title – shown as toast, not on field */
  formLevel?: string;
}

const getDefaultFormData = (): RoutingGroupFormData => ({
  approvalType: null,
  approverShort: '',
  approverLong: '',
  approverEmail: '',
  employeeIDs: [],
  approverStatus: true,
});

const getFormDataFromInitial = (data: RoutingGroupResponse | null | undefined): RoutingGroupFormData => {
  if (!data) return getDefaultFormData();
  const ids = Array.from(new Set((data.employeeIDs || []).map(String)));
  const approvalType = (data.approvalType === null || data.approvalType === undefined) ? null : (typeof data.approvalType === 'number' ? data.approvalType : null);
  return {
    approvalType,
    approverShort: data.approverShort || '',
    approverLong: data.approverLong || '',
    approverEmail: data.approverEmail || '',
    employeeIDs: ids,
    approverStatus: data.approverStatus !== false,
  };
};

export const RoutingGroupForm: React.FC<RoutingGroupFormProps> = ({
  initialData,
  onSuccess,
  onCancel,
  className = '',
}) => {
  const dispatch = useAppDispatch();
  const { isLoading, routingGroups } = useAppSelector((state) => state.routingGroup);
  const { employees, isLoading: employeesLoading } = useAppSelector((state) => state.employee);

  const [formData, setFormData] = useState<RoutingGroupFormData>(() => getFormDataFromInitial(initialData));

  const [errors, setErrors] = useState<RoutingGroupFormErrors>({});
  const [, setSubmitError] = useState<string | null>(null);
  const [, setSubmitSuccess] = useState(false);

  const isEditMode = Boolean(initialData?.routingGroupId);

  // Fetch employees on mount
  useEffect(() => {
    dispatch(fetchEmployees({ page: 1, pageSize: 1000 }));
  }, [dispatch]);

  // Reset form when initialData changes
  useEffect(() => {
    setFormData(getFormDataFromInitial(initialData));
    setErrors({});
    setSubmitError(null);
    setSubmitSuccess(false);
  }, [initialData]);

  // When approval type options change (e.g. one type already taken), keep selected type in the available list. Null is always available.
  const availableApprovalTypeOptions = useMemo(() => {
    const currentId = initialData?.routingGroupId != null ? String(initialData.routingGroupId) : undefined;
    const typedOptions = APPROVAL_TYPE_OPTIONS.filter((opt) =>
      !routingGroups.some(
        (rg) =>
          rg.approvalType === opt.value &&
          (isEditMode ? String(rg.routingGroupId) !== currentId : true)
      )
    );
    return [{ value: NULL_APPROVAL_TYPE_VALUE, label: ROUTING_GROUP.FORM.APPROVAL_TYPE_PLACEHOLDER }, ...typedOptions.map((o) => ({ value: String(o.value), label: o.label }))];
  }, [routingGroups, isEditMode, initialData?.routingGroupId]);

  useEffect(() => {
    setFormData((prev) => {
      if (prev.approvalType === null) return prev; // null is always valid
      const isCurrentInList = availableApprovalTypeOptions.some((o) => o.value === String(prev.approvalType));
      if (isCurrentInList) return prev;
      const firstTyped = availableApprovalTypeOptions.find((o) => o.value !== NULL_APPROVAL_TYPE_VALUE);
      return { ...prev, approvalType: firstTyped ? Number(firstTyped.value) as ApprovalType : null };
    });
  }, [availableApprovalTypeOptions]);

  const employeeOptions = useMemo(() => {
    const fromEmployees = employees.map((emp) => ({
      value: String(emp.employeeID),
      label: formatLastNameCommaFirstName(emp.firstName, emp.lastName) || emp.username || 'Unknown',
      statusID: emp.statusID,
    }));
    if (!initialData?.employeeIDs?.length) return fromEmployees;
    const optionValues = new Set(fromEmployees.map((o) => o.value));
    const initialIds = initialData.employeeIDs.map(String);
    const employeeNames = initialData.employeeNames ?? [];
    const missingIds = Array.from(new Set(initialIds.filter((id) => !optionValues.has(id))));
    const synthetic = missingIds.map((id) => {
      const idx = initialIds.indexOf(id);
      const label = employeeNames[idx] ?? id;
      return { value: id, label, statusID: undefined as string | undefined };
    });
    if (synthetic.length === 0) return fromEmployees;
    return [...fromEmployees, ...synthetic];
  }, [employees, initialData?.employeeIDs, initialData?.employeeNames]);

  const handleChange = (field: keyof RoutingGroupFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors[field as keyof RoutingGroupFormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    if (field === 'approverShort' && errors.formLevel) {
      setErrors((prev) => ({ ...prev, formLevel: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: RoutingGroupFormErrors = {};

    if (!isEditMode && formData.approvalType === null) {
      newErrors.approvalType = ROUTING_GROUP.ERRORS.APPROVAL_TYPE_REQUIRED;
    } else if (formData.approvalType !== null) {
      const approvalTypeOption = availableApprovalTypeOptions.find((o) => o.value === String(formData.approvalType));
      if (approvalTypeOption === undefined) {
        newErrors.approvalType = ROUTING_GROUP.ERRORS.APPROVAL_TYPE_TAKEN;
      }
    }

    if (!formData.approverShort.trim()) {
      newErrors.approverShort = ROUTING_GROUP.ERRORS.TITLE_REQUIRED;
    } else {
      // Check for duplicate approverShort
      const trimmedShort = formData.approverShort.trim().toLowerCase();
      const currentRoutingGroupId = initialData?.routingGroupId != null ? String(initialData.routingGroupId) : undefined;
      const isDuplicate = routingGroups.some((rg) => {
        // Skip the current record when editing (compare as string to handle number/string from API)
        if (isEditMode && currentRoutingGroupId && String(rg.routingGroupId) === currentRoutingGroupId) {
          return false;
        }
        return rg.approverShort?.toLowerCase() === trimmedShort;
      });
      if (isDuplicate) {
        newErrors.formLevel = ROUTING_GROUP.ERRORS.TITLE_DUPLICATE;
      }
    }

    if (!formData.approverLong.trim()) {
      newErrors.approverLong = ROUTING_GROUP.ERRORS.DESCRIPTION_REQUIRED;
    }

    if (formData.employeeIDs.length === 0) {
      newErrors.employeeIDs = ROUTING_GROUP.ERRORS.EMPLOYEES_REQUIRED;
    }

   if (!formData.approverEmail.trim()) {
  newErrors.approverEmail = ROUTING_GROUP.ERRORS.EMAIL_INVALID;
} else if (!validateEmail(formData.approverEmail)) {
  newErrors.approverEmail = ROUTING_GROUP.ERRORS.EMAIL_INVALID;
}

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(false);

    if (!validateForm()) {
      if (!formData.approverShort.trim()) {
        setSubmitError(ROUTING_GROUP.ERRORS.TITLE_REQUIRED);
      } else {
        // Check if it's a duplicate error – show toast instead of field error
        const trimmedShort = formData.approverShort.trim().toLowerCase();
        const currentRoutingGroupId = initialData?.routingGroupId != null ? String(initialData.routingGroupId) : undefined;
        const isDuplicate = routingGroups.some((rg) => {
          if (isEditMode && currentRoutingGroupId && String(rg.routingGroupId) === currentRoutingGroupId) {
            return false;
          }
          return rg.approverShort?.toLowerCase() === trimmedShort;
        });
        if (isDuplicate) {
          dispatch(showToast(ROUTING_GROUP.ERRORS.TITLE_DUPLICATE, 'error'));
          setTimeout(() => {
            onCancel?.();
          }, 1500);
        }
      }
      return;
    }

    try {
      const payload = {
        employeeIDs: formData.employeeIDs,
        approvalType: formData.approvalType ?? null,
        approverLong: formData.approverLong.trim(),
        approverShort: formData.approverShort.trim(),
        approverEmail: formData.approverEmail.trim() || undefined,
        approverStatus: formData.approverStatus,
      };

      if (isEditMode && initialData?.routingGroupId) {
        await dispatch(
          upsertRoutingGroupThunk({
            routingGroupId: initialData.routingGroupId,
            ...payload,
          })
        ).unwrap();
      } else {
        await dispatch(upsertRoutingGroupThunk(payload)).unwrap();
      }

      setSubmitSuccess(true);

      setTimeout(() => {
        if (!isEditMode) {
          setFormData(getDefaultFormData());
        }
        setSubmitSuccess(false);
        setSubmitError(null);
        setTimeout(() => {
          onSuccess?.();
        }, 50);
      }, 1500);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'Failed to save routing group'
      );
    }
  };

  // Check if form data has changed from initial data (for edit mode)


  // Check if required fields are filled



  return (
    <div className={`routing-group-form ${className}`}>
      <form onSubmit={handleSubmit} className="routing-group-form__form" noValidate>
        <div className="routing-group-form__row">
          <div className="routing-group-form__col">
            <SMSDropdown
              label={ROUTING_GROUP.FORM.APPROVAL_TYPE}
              options={availableApprovalTypeOptions}
              value={formData.approvalType === null ? NULL_APPROVAL_TYPE_VALUE : String(formData.approvalType)}
              onChange={(e) => {
                const value = String(e.target.value);
                handleChange('approvalType', value === NULL_APPROVAL_TYPE_VALUE ? null : (Number(value) as ApprovalType));
              }}
              placeholder={ROUTING_GROUP.FORM.APPROVAL_TYPE_PLACEHOLDER}
              disabled={isLoading || availableApprovalTypeOptions.length === 0 || isEditMode}
              name="approvalType"
              id="approvalType"
              required
              error={Boolean(errors.approvalType)}
              helperText={errors.approvalType}
            />
          </div>
        </div>
        <div className="routing-group-form__row">
          <div className="routing-group-form__col">
            <SMSTextField
              type="text"
              label={ROUTING_GROUP.FORM.TITLE}
              placeholder={ROUTING_GROUP.FORM.TITLE_PLACEHOLDER}
              value={formData.approverShort}
              onChange={(e) => handleChange('approverShort', e.target.value)}
              error={Boolean(errors.approverShort)}
              helperText={errors.approverShort}
              required
              name="approverShort"
              id="approverShort"
              inputProps={{ maxLength: 50 }}
              disabled={isLoading}
            />
          </div>

          <div className="routing-group-form__col">
            <SMSTextField
              type="email"
              label={ROUTING_GROUP.FORM.EMAIL}
              placeholder={ROUTING_GROUP.FORM.EMAIL_PLACEHOLDER}
              value={formData.approverEmail}
              onChange={(e) => handleChange('approverEmail', e.target.value)}
              error={Boolean(errors.approverEmail)}
              helperText={errors.approverEmail}
              name="approverEmail"
              id="approverEmail"
              inputProps={{ maxLength: 150 }}
              disabled={isLoading}
              required
            />
          </div>
        </div>

        <SMSTextArea
          label={ROUTING_GROUP.FORM.DESCRIPTION}
          placeholder={ROUTING_GROUP.FORM.DESCRIPTION_PLACEHOLDER}
          value={formData.approverLong}
          onChange={(e) => handleChange('approverLong', e.target.value)}
          error={Boolean(errors.approverLong)}
          helperText={errors.approverLong}
          required
          name="approverLong"
          id="approverLong"
          inputProps={{ maxLength: 200 }}
          rows={3}
          disabled={isLoading}
        />

        <SMSMultiSelectDropdown
          label={ROUTING_GROUP.FORM.EMPLOYEES}
          options={employeeOptions}
          value={formData.employeeIDs}
          onChange={(values) => handleChange('employeeIDs', values.map(String))}
          placeholder={employeesLoading ? 'Loading employees...' : ROUTING_GROUP.FORM.EMPLOYEES_PLACEHOLDER}
          error={Boolean(errors.employeeIDs)}
          helperText={errors.employeeIDs}
          name="employeeIDs"
          id="employeeIDs"
          disabled={isLoading || employeesLoading}
          required
        />

        <div className="routing-group-form__switch">
          <SMSSwitch
            checked={formData.approverStatus}
            onChange={(e) => handleChange('approverStatus', e.target.checked)}
            name="approverStatus"
            id="approverStatus"
            disabled={isLoading}
            label={ROUTING_GROUP.FORM.IS_ACTIVE}
          />
        </div>

        <div className="routing-group-form__footer">
          {onCancel && (
            <SMSButton
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="routing-group-form__cancel-button"
            >
              {ROUTING_GROUP.FORM.CANCEL_BUTTON}
            </SMSButton>
          )}
          <SMSButton
            type="submit"
            className="routing-group-form__submit-button"
            fullWidth={!onCancel}
            disabled={isLoading}
            loading={isLoading}
          >
            {isEditMode ? ROUTING_GROUP.BUTTON.UPDATE : ROUTING_GROUP.FORM.SUBMIT_BUTTON}
          </SMSButton>
        </div>
      </form>
    </div>
  );
};
