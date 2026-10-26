  import React, { useEffect, useMemo, useState } from 'react';
  import {
    SMSButton,
    SMSCheckbox,
    SMSDropdown,
    SMSTextField,
    SMSTypography,
    SMSBox,
  } from '@/components/smsatoms';
  import { useAppDispatch, useAppSelector } from '@/store/hooks';
  import { showToast } from '@/store/slices/toastSlice';
  import { DepartmentPolicyResponse, TenureMetricType } from '@/types/departmentPolicy';
  import { upsertDepartmentPolicy } from '@/services/departmentPolicyService';
  import { DEPARTMENT_POLICY } from '@/constants/strings';
  import { useDepartmentPolicyVisibility } from './useDepartmentPolicyVisibility';
  import '@/styles/forms.css';
  import './SMSDepartmentPolicyForm.css';

  export interface SMSDepartmentPolicyFormProps {
    initialData?: DepartmentPolicyResponse | null;
    departmentId?: string;
    onSuccess?: (saved: DepartmentPolicyResponse) => void;
    onCancel?: () => void;
    className?: string;
  }

  type FormData = {
    departmentID: string;
    // Enable / Disable flags
    isPostsTakenPerDay: boolean;
    isHoursPerDayWorked: boolean;
    isHoursPerWeekWorked: boolean;
    isHoursPerMonthWorked: boolean;
    isDeptOpenPostsTakenPerDay: boolean;
    isTenurePostsAllowedPerWeek: boolean;
    isTenurePostsAllowedPerDay: boolean;
    isDeptOpenPostsTakenPerWeek: boolean;
    // Limits
    postsTakenPerDay: string;
    hoursPerDayWorked: string;
    hoursPerWeekWorked: string;
    hoursPerMonthWorked: string;
    deptOpenPostsTakenPerDay: string;
    tenurePostsAllowedPerWeek: string;
    tenurePostsAllowedPerDay: string;
    deptOpenPostsTakenPerWeek: string;
    // Preview
    isPreviewable: boolean;
    previewableHours: string;
    // Minimum hours paid
    isMinHoursPaid: boolean;
    minHoursPaid: string;
    // Same-day rules
    isPositionTakenOnSameday: boolean;
    positionTakenOnSameday: string;
    timeToClosePost: string;
    isPostExemptTakenOnSameday: boolean;
    isManagedPostTakenOnSameday: boolean;
    managedPostTakenOnSameday: string;
    // Supervisor / overlap
    postToSupervise: string;
    overlapJobConflictConfirmation: boolean;
    supervisorsCanViewLowerEmpTypeJobs: boolean;
    numberOfEmployeesBeforeSupervisorRequired: string;
    restrictWebLoginForNonAdminEmployee: boolean;
    // Tenure Policy
    tenureType: string;
    tenureRule1Days: string;
    tenureRule1Value: string;
    tenureRule2Days: string;
    tenureRule2Value: string;
    tenureRule3Days: string;
    tenureRule3Value: string;
  };

  type FormErrors = Partial<Record<keyof FormData, string>> & { formLevel?: string };

  const toStr = (v: number | null | undefined): string => (v != null ? String(v) : '');

  const buildInitialFormData = (
    initialData: DepartmentPolicyResponse | null | undefined,
    departmentIdFromProps: string | undefined,
    userDepartmentId: string | undefined
  ): FormData => {
    const deptId =
      initialData?.departmentID || departmentIdFromProps || userDepartmentId || '';

    if (!initialData) {
      return {
        departmentID: deptId,
        // Enable / Disable flags (default to false)
        isPostsTakenPerDay: false,
        isHoursPerDayWorked: false,
        isHoursPerWeekWorked: false,
        isHoursPerMonthWorked: false,
        isDeptOpenPostsTakenPerDay: false,
        isTenurePostsAllowedPerWeek: false,
        isTenurePostsAllowedPerDay: false,
        isDeptOpenPostsTakenPerWeek: false,
        // Limits
        postsTakenPerDay: '',
        hoursPerDayWorked: '',
        hoursPerWeekWorked: '',
        hoursPerMonthWorked: '',
        deptOpenPostsTakenPerDay: '',
        tenurePostsAllowedPerWeek: '',
        tenurePostsAllowedPerDay: '',
        deptOpenPostsTakenPerWeek: '',
        // Preview
        isPreviewable: false,
        previewableHours: '',
        // Minimum hours paid
        isMinHoursPaid: false,
        minHoursPaid: '',
        // Same-day rules
        isPositionTakenOnSameday: false,
        positionTakenOnSameday: '',
        timeToClosePost: '',
        isPostExemptTakenOnSameday: false,
        isManagedPostTakenOnSameday: false,
        managedPostTakenOnSameday: '',
        // Supervisor / overlap
        postToSupervise: '',
        overlapJobConflictConfirmation: false,
        supervisorsCanViewLowerEmpTypeJobs: false,
        numberOfEmployeesBeforeSupervisorRequired: '',
        restrictWebLoginForNonAdminEmployee: false,
        // Tenure Policy
        tenureType: '',
        tenureRule1Days: '',
        tenureRule1Value: '',
        tenureRule2Days: '',
        tenureRule2Value: '',
        tenureRule3Days: '',
        tenureRule3Value: '',
      };
    }

    let tenureRule1Days = '';
    let tenureRule1Value = '';
    let tenureRule2Days = '';
    let tenureRule2Value = '';
    let tenureRule3Days = '';
    let tenureRule3Value = '';

    if (initialData.tenureRulesJson) {
      try {
        const parsed = JSON.parse(initialData.tenureRulesJson) as
          | { rules?: { days?: number; value?: number }[] }
          | { days?: number; value?: number }[];

        const rulesArray = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.rules)
            ? parsed.rules
            : [];

        const [r1, r2, r3] = rulesArray;
        if (r1) {
          tenureRule1Days = toStr(r1.days as number | null | undefined);
          tenureRule1Value = toStr(r1.value as number | null | undefined);
        }
        if (r2) {
          tenureRule2Days = toStr(r2.days as number | null | undefined);
          tenureRule2Value = toStr(r2.value as number | null | undefined);
        }
        if (r3) {
          tenureRule3Days = toStr(r3.days as number | null | undefined);
          tenureRule3Value = toStr(r3.value as number | null | undefined);
        }
      } catch {
        // Ignore parse errors and keep defaults
      }
    }

    return {
      departmentID: deptId,
      // Enable / Disable flags
      isPostsTakenPerDay: Boolean(initialData.isPostsTakenPerDay),
      isHoursPerDayWorked: Boolean(initialData.isHoursPerDayWorked),
      isHoursPerWeekWorked: Boolean(initialData.isHoursPerWeekWorked),
      isHoursPerMonthWorked: Boolean(initialData.isHoursPerMonthWorked),
      isDeptOpenPostsTakenPerDay: Boolean(initialData.isDeptOpenPostsTakenPerDay),
      isTenurePostsAllowedPerWeek: Boolean(initialData.isTenurePostsAllowedPerWeek),
      isTenurePostsAllowedPerDay: Boolean(initialData.isTenurePostsAllowedPerDay),
      isDeptOpenPostsTakenPerWeek: Boolean(initialData.isDeptOpenPostsTakenPerWeek),
      // Limits
      postsTakenPerDay: toStr(initialData.postsTakenPerDay),
      hoursPerDayWorked: toStr(initialData.hoursPerDayWorked),
      hoursPerWeekWorked: toStr(initialData.hoursPerWeekWorked),
      hoursPerMonthWorked: toStr(initialData.hoursPerMonthWorked),
      deptOpenPostsTakenPerDay: toStr(initialData.deptOpenPostsTakenPerDay),
      tenurePostsAllowedPerWeek: toStr(initialData.tenurePostsAllowedPerWeek),
      tenurePostsAllowedPerDay: toStr(initialData.tenurePostsAllowedPerDay),
      deptOpenPostsTakenPerWeek: toStr(initialData.deptOpenPostsTakenPerWeek),
      // Preview
      isPreviewable: Boolean(initialData.isPreviewable ?? false),
      previewableHours: toStr(initialData.previewableHours),
      // Minimum hours paid
      isMinHoursPaid: Boolean(initialData.isMinHoursPaid),
      minHoursPaid: toStr(initialData.minHoursPaid),
      // Same-day rules
      isPositionTakenOnSameday: Boolean(initialData.isPositionTakenOnSameday),
      positionTakenOnSameday: toStr(initialData.positionTakenOnSameday),
      timeToClosePost: toStr(initialData.timeToClosePost),
      isPostExemptTakenOnSameday: Boolean(initialData.isPostExemptTakenOnSameday ?? false),
      isManagedPostTakenOnSameday: Boolean(initialData.isManagedPostTakenOnSameday ?? false),
      managedPostTakenOnSameday: toStr(initialData.managedPostTakenOnSameday),
      // Supervisor / overlap
      postToSupervise: toStr(initialData.postToSupervise),
      overlapJobConflictConfirmation: Boolean(
        initialData.overlapJobConflictConfirmation
      ),
      supervisorsCanViewLowerEmpTypeJobs: Boolean(
        initialData.supervisorsCanViewLowerEmpTypeJobs
      ),
      numberOfEmployeesBeforeSupervisorRequired: toStr(
        initialData.numberOfEmployeesBeforeSupervisorRequired
      ),
      restrictWebLoginForNonAdminEmployee: Boolean(initialData.restrictWebLoginForNonAdminEmployee),
      // Tenure Policy
      tenureType: initialData.tenureType ? String(initialData.tenureType) : '',
      tenureRule1Days,
      tenureRule1Value,
      tenureRule2Days,
      tenureRule2Value,
      tenureRule3Days,
      tenureRule3Value,
    };
  };

  export const SMSDepartmentPolicyForm: React.FC<SMSDepartmentPolicyFormProps> = ({
    initialData,
    departmentId,
    onSuccess,
    onCancel,
    className = '',
  }) => {
    const dispatch = useAppDispatch();
    const { user } = useAppSelector((state) => state.auth);

    const isEditMode = Boolean(initialData?.departmentPolicyID);
    const [formData, setFormData] = useState<FormData>(() =>
      buildInitialFormData(initialData, departmentId, user?.departmentID)
    );
    const [errors, setErrors] = useState<FormErrors>({});
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const effectiveDepartmentId = useMemo(
      () => departmentId || initialData?.departmentID || user?.departmentID || '',
      [departmentId, initialData?.departmentID, user?.departmentID]
    );

    const {
      canShowPostsTakenPerDay,
      canShowHoursPerDayWorked,
      canShowHoursPerWeekWorked,
      canShowHoursPerMonthWorked,
      canShowDeptOpenPostsTakenPerDay,
      canShowDeptOpenPostsTakenPerWeek,
      canShowTenurePostsAllowedPerWeek,
      canShowTenurePostsAllowedPerDay,
      canShowMinHoursPaid,
      canShowPreviewSection,
      canShowPositionTakenOnSameDay,
      canShowPostExemptTakenOnSameDay,
      canShowManagedPostTakenOnSameDay,
      canShowOverlapJobConflict,
      canShowSupervisorsViewLowerEmpTypeJobs,
      canShowRestrictWebLoginForNormalEmployee,
      canShowHoursPostsSection,
      canShowTenureSection,
      canShowSameDaySection,
      canShowSupervisorSection,
      canShowSupervisorInputs,
      canShowTenurePolicySection,
    } = useDepartmentPolicyVisibility(effectiveDepartmentId);

    useEffect(() => {
      setFormData(
        buildInitialFormData(initialData, departmentId, user?.departmentID)
      );
      setErrors({});
      setSubmitError(null);
    }, [initialData, departmentId, user?.departmentID]);

    const handleChange = <K extends keyof FormData>(field: K, value: FormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
      if (errors.formLevel) {
        setErrors((prev) => ({ ...prev, formLevel: undefined }));
      }
      if (submitError) {
        setSubmitError(null);
      }
    };

    const ensureNonNegativeNumber = (labelKey: keyof typeof DEPARTMENT_POLICY.FORM) => {
      const label = DEPARTMENT_POLICY.FORM[labelKey];
      return `${label} must be 0 or greater`;
    };

    const validateForm = (): boolean => {
      const nextErrors: FormErrors = {};

      if (!effectiveDepartmentId) {
        nextErrors.formLevel = DEPARTMENT_POLICY.ERRORS.DEPARTMENT_REQUIRED;
      }

      const numericFields: (keyof FormData)[] = [
        'postsTakenPerDay',
        'hoursPerDayWorked',
        'hoursPerWeekWorked',
        'hoursPerMonthWorked',
        'deptOpenPostsTakenPerDay',
        'tenurePostsAllowedPerWeek',
        'tenurePostsAllowedPerDay',
        'deptOpenPostsTakenPerWeek',
        'previewableHours',
        'minHoursPaid',
        'positionTakenOnSameday',
        'timeToClosePost',
        'managedPostTakenOnSameday',
        'postToSupervise',
        'numberOfEmployeesBeforeSupervisorRequired',
      ];

      numericFields.forEach((field) => {
        const raw = formData[field];
        if (raw === '') {
          return;
        }
        const num = Number(raw);
        if (Number.isNaN(num) || num < 0) {
          // Map a subset to friendlier messages; fallback to generic
          let labelKey: keyof typeof DEPARTMENT_POLICY.FORM | null = null;
          switch (field) {
            case 'postsTakenPerDay':
              labelKey = 'POSTS_TAKEN_PER_DAY';
              break;
            case 'hoursPerDayWorked':
              labelKey = 'HOURS_PER_DAY_WORKED';
              break;
            case 'hoursPerWeekWorked':
              labelKey = 'HOURS_PER_WEEK_WORKED';
              break;
            case 'hoursPerMonthWorked':
              labelKey = 'HOURS_PER_MONTH_WORKED';
              break;
            case 'minHoursPaid':
              labelKey = 'MIN_HOURS_PAID';
              break;
            case 'timeToClosePost':
              labelKey = 'TIME_TO_CLOSE_POST';
              break;
            default:
              labelKey = null;
          }
          nextErrors[field] =
            labelKey != null
              ? ensureNonNegativeNumber(labelKey)
              : DEPARTMENT_POLICY.ERRORS.NUMBER_INVALID;
        }
      });

      // Tenure rules validation (only when tenure type is selected)
      if (formData.tenureType) {
        const rules: { days: number; value: number; dayKey: keyof FormData; valueKey: keyof FormData }[] = [];

        const d1 = toNumber(formData.tenureRule1Days);
        const v1 = toNumber(formData.tenureRule1Value);
        const d2 = toNumber(formData.tenureRule2Days);
        const v2 = toNumber(formData.tenureRule2Value);
        const d3 = toNumber(formData.tenureRule3Days);
        const v3 = toNumber(formData.tenureRule3Value);

        if (d1 != null || v1 != null) {
          if (d1 == null || v1 == null) {
            nextErrors.tenureRule1Days = DEPARTMENT_POLICY.ERRORS.NUMBER_INVALID;
            nextErrors.tenureRule1Value = DEPARTMENT_POLICY.ERRORS.NUMBER_INVALID;
          } else {
            rules.push({
              days: d1,
              value: v1,
              dayKey: 'tenureRule1Days',
              valueKey: 'tenureRule1Value',
            });
          }
        }

        if (d2 != null || v2 != null) {
          if (d2 == null || v2 == null) {
            nextErrors.tenureRule2Days = DEPARTMENT_POLICY.ERRORS.NUMBER_INVALID;
            nextErrors.tenureRule2Value = DEPARTMENT_POLICY.ERRORS.NUMBER_INVALID;
          } else {
            rules.push({
              days: d2,
              value: v2,
              dayKey: 'tenureRule2Days',
              valueKey: 'tenureRule2Value',
            });
          }
        }

        if (d3 != null || v3 != null) {
          if (d3 == null || v3 == null) {
            nextErrors.tenureRule3Days = DEPARTMENT_POLICY.ERRORS.NUMBER_INVALID;
            nextErrors.tenureRule3Value = DEPARTMENT_POLICY.ERRORS.NUMBER_INVALID;
          } else {
            rules.push({
              days: d3,
              value: v3,
              dayKey: 'tenureRule3Days',
              valueKey: 'tenureRule3Value',
            });
          }
        }

        // Require all three levels (Days and Value) when tenure is enabled
        if (rules.length < 3) {
          if (d1 == null || v1 == null) {
            nextErrors.tenureRule1Days = DEPARTMENT_POLICY.ERRORS.NUMBER_INVALID;
            nextErrors.tenureRule1Value = DEPARTMENT_POLICY.ERRORS.NUMBER_INVALID;
          }
          if (d2 == null || v2 == null) {
            nextErrors.tenureRule2Days = DEPARTMENT_POLICY.ERRORS.NUMBER_INVALID;
            nextErrors.tenureRule2Value = DEPARTMENT_POLICY.ERRORS.NUMBER_INVALID;
          }
          if (d3 == null || v3 == null) {
            nextErrors.tenureRule3Days = DEPARTMENT_POLICY.ERRORS.NUMBER_INVALID;
            nextErrors.tenureRule3Value = DEPARTMENT_POLICY.ERRORS.NUMBER_INVALID;
          }
        } else if (rules.length > 1) {
          for (let i = 1; i < rules.length; i += 1) {
            if (
              rules[i].days <= rules[i - 1].days ||
              rules[i].value <= rules[i - 1].value
            ) {
              // Highlight the later row that breaks ordering
              nextErrors[rules[i].dayKey] =
                DEPARTMENT_POLICY.ERRORS.TENURE_RULES_INVALID_ORDER;
              nextErrors[rules[i].valueKey] =
                DEPARTMENT_POLICY.ERRORS.TENURE_RULES_INVALID_ORDER;
              nextErrors.formLevel =
                DEPARTMENT_POLICY.ERRORS.TENURE_RULES_INVALID_ORDER;
              break;
            }
          }
        }
      }

      const hasErrors = Object.keys(nextErrors).length > 0;
      setErrors(nextErrors);

      if (hasErrors) {
        // Prefer a specific form-level error if present
        if (nextErrors.formLevel) {
          setSubmitError(nextErrors.formLevel);
        } else {
          setSubmitError(DEPARTMENT_POLICY.ERRORS.NUMBER_INVALID);
        }
      } else {
        setSubmitError(null);
      }

      return !hasErrors;
    };

    const toNumber = (s: string): number | null => {
      if (s === '' || s == null) return null;
      const n = Number(s);
      if (Number.isNaN(n)) return null;
      return n;
    };

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitError(null);

      if (!validateForm()) {
        return;
      }

      if (!effectiveDepartmentId) {
        setSubmitError(DEPARTMENT_POLICY.ERRORS.DEPARTMENT_REQUIRED);
        return;
      }

      setIsSubmitting(true);
      try {
        // Prefer the departmentID coming from the existing policy (GET API),
        // fall back to the effective department ID from route / auth for new records.
        const departmentIdForPayload = initialData?.departmentID || effectiveDepartmentId;

        const buildTenureRulesJson = (): string | undefined => {
          if (!formData.tenureType) return undefined;

          const rows: { level: number; days: number; value: number }[] = [];
          const d1 = toNumber(formData.tenureRule1Days);
          const v1 = toNumber(formData.tenureRule1Value);
          const d2 = toNumber(formData.tenureRule2Days);
          const v2 = toNumber(formData.tenureRule2Value);
          const d3 = toNumber(formData.tenureRule3Days);
          const v3 = toNumber(formData.tenureRule3Value);

          if (d1 != null && v1 != null) rows.push({ level: 1, days: d1, value: v1 });
          if (d2 != null && v2 != null) rows.push({ level: 2, days: d2, value: v2 });
          if (d3 != null && v3 != null) rows.push({ level: 3, days: d3, value: v3 });

          if (rows.length === 0) return undefined;

          return JSON.stringify({ rules: rows });
        };

        const tenureTypeNumeric = formData.tenureType
          ? (Number(formData.tenureType) as TenureMetricType)
          : undefined;

        const payload: DepartmentPolicyResponse = {
          departmentPolicyID: initialData?.departmentPolicyID,
          departmentID: departmentIdForPayload,
          // Enable / Disable flags
          isPostsTakenPerDay: formData.isPostsTakenPerDay,
          isHoursPerDayWorked: formData.isHoursPerDayWorked,
          isHoursPerWeekWorked: formData.isHoursPerWeekWorked,
          isHoursPerMonthWorked: formData.isHoursPerMonthWorked,
          isDeptOpenPostsTakenPerDay: formData.isDeptOpenPostsTakenPerDay,
          isTenurePostsAllowedPerWeek: formData.isTenurePostsAllowedPerWeek,
          isTenurePostsAllowedPerDay: formData.isTenurePostsAllowedPerDay,
          isDeptOpenPostsTakenPerWeek: formData.isDeptOpenPostsTakenPerWeek,
          // Limits
          postsTakenPerDay: toNumber(formData.postsTakenPerDay) ?? 0,
          hoursPerDayWorked: toNumber(formData.hoursPerDayWorked) ?? 0,
          hoursPerWeekWorked: toNumber(formData.hoursPerWeekWorked) ?? 0,
          hoursPerMonthWorked: toNumber(formData.hoursPerMonthWorked) ?? 0,
          deptOpenPostsTakenPerDay:
            toNumber(formData.deptOpenPostsTakenPerDay) ?? 0,
          tenurePostsAllowedPerWeek:
            toNumber(formData.tenurePostsAllowedPerWeek) ?? 0,
          tenurePostsAllowedPerDay:
            toNumber(formData.tenurePostsAllowedPerDay) ?? 0,
          deptOpenPostsTakenPerWeek:
            toNumber(formData.deptOpenPostsTakenPerWeek) ?? 0,
          // Preview
          isPreviewable: formData.isPreviewable ? true : undefined,
          previewableHours: formData.isPreviewable
            ? (toNumber(formData.previewableHours) ?? undefined)
            : undefined,
          // Minimum hours paid
          isMinHoursPaid: formData.isMinHoursPaid,
          minHoursPaid: toNumber(formData.minHoursPaid) ?? 0,
          // Same-day rules
          isPositionTakenOnSameday: formData.isPositionTakenOnSameday,
          positionTakenOnSameday: toNumber(formData.positionTakenOnSameday) ?? 0,
          timeToClosePost: toNumber(formData.timeToClosePost) ?? 0,
          isPostExemptTakenOnSameday: formData.isPostExemptTakenOnSameday
            ? true
            : undefined,
          isManagedPostTakenOnSameday: formData.isManagedPostTakenOnSameday
            ? true
            : undefined,
          managedPostTakenOnSameday: formData.isManagedPostTakenOnSameday
            ? (toNumber(formData.managedPostTakenOnSameday) ?? undefined)
            : undefined,
          // Supervisor / overlap
          postToSupervise: toNumber(formData.postToSupervise) ?? undefined,
          overlapJobConflictConfirmation:
            formData.overlapJobConflictConfirmation,
          supervisorsCanViewLowerEmpTypeJobs:
            formData.supervisorsCanViewLowerEmpTypeJobs,
          numberOfEmployeesBeforeSupervisorRequired: toNumber(
            formData.numberOfEmployeesBeforeSupervisorRequired
          ) ?? 0,
          restrictWebLoginForNonAdminEmployee: formData.restrictWebLoginForNonAdminEmployee,
          // Tenure Policy
          tenureType: tenureTypeNumeric,
          tenureRulesJson: buildTenureRulesJson(),
        };

        const saved = await upsertDepartmentPolicy(payload);
        dispatch(
          showToast(
            isEditMode
              ? DEPARTMENT_POLICY.SUCCESS.UPDATED
              : DEPARTMENT_POLICY.SUCCESS.ADDED,
            'success'
          )
        );

        onSuccess?.(saved);
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err ?? '');
        setSubmitError(
          raw || DEPARTMENT_POLICY.ERRORS.SUBMIT_FAILED
        );
        dispatch(
          showToast(
            raw || DEPARTMENT_POLICY.ERRORS.SUBMIT_FAILED,
            'error'
          )
        );
      } finally {
        setIsSubmitting(false);
      }
    };

    return (
      <form
        onSubmit={handleSubmit}
        className={`department-policy-form app-form ${className}`}
        noValidate
      >
        {submitError && (
          <SMSBox className="app-form__error-message" sx={{ mb: 2 }}>
            <SMSTypography color="error" variant="body2">
              {submitError}
            </SMSTypography>
          </SMSBox>
        )}
        {(canShowPreviewSection || !isEditMode) && (
          <div className="app-form__section">
            <SMSTypography component="h3" variant="h6" className="app-form__section-title" gutterBottom>
              {DEPARTMENT_POLICY.FORM.SECTION_PREVIEW}
            </SMSTypography>
            <div className="app-form__flex-row">
              {canShowHoursPerWeekWorked && (
                <div className="department-policy-form__checkbox-input-row">
                  <div className="app-form__form-checkbox">
                    <SMSCheckbox
                      label=""
                      checked={formData.isHoursPerWeekWorked}
                      onChange={(checked) =>
                        handleChange('isHoursPerWeekWorked', checked)
                      }
                      disabled={isSubmitting}
                    />
                  </div>
                  <SMSTextField fullWidth
                    type="number"
                    label={DEPARTMENT_POLICY.FORM.HOURS_PER_WEEK_WORKED}
                    value={formData.hoursPerWeekWorked}
                    onChange={(e) =>
                      handleChange('hoursPerWeekWorked', e.target.value)
                    }
                    inputProps={{ min: 0 }}
                    error={Boolean(errors.hoursPerWeekWorked)} helperText={errors.hoursPerWeekWorked}
                    disabled={isSubmitting || !formData.isHoursPerWeekWorked}
                  />
                </div>
              )}

              {canShowHoursPerMonthWorked && (
                <div className="department-policy-form__checkbox-input-row">
                  <div className="app-form__form-checkbox">
                    <SMSCheckbox
                      label=""
                      checked={formData.isHoursPerMonthWorked}
                      onChange={(checked) =>
                        handleChange('isHoursPerMonthWorked', checked)
                      }
                      disabled={isSubmitting}
                    />
                  </div>
                  <SMSTextField fullWidth
                    type="number"
                    label={DEPARTMENT_POLICY.FORM.HOURS_PER_MONTH_WORKED}
                    value={formData.hoursPerMonthWorked}
                    onChange={(e) =>
                      handleChange('hoursPerMonthWorked', e.target.value)
                    }
                    inputProps={{ min: 0 }}
                    error={Boolean(errors.hoursPerMonthWorked)} helperText={errors.hoursPerMonthWorked}
                    disabled={isSubmitting || !formData.isHoursPerMonthWorked}
                  />
                </div>
              )}

              {canShowPreviewSection && (
                <div className="department-policy-form__checkbox-input-row">
                  <div className="app-form__form-checkbox">
                    <SMSCheckbox
                      label=""
                      checked={formData.isPreviewable}
                      onChange={(checked) =>
                        handleChange('isPreviewable', checked)
                      }
                      disabled={isSubmitting}
                    />
                  </div>
                  <SMSTextField fullWidth
                    type="number"
                    label={DEPARTMENT_POLICY.FORM.PREVIEWABLE_HOURS}
                    value={formData.previewableHours}
                    onChange={(e) =>
                      handleChange('previewableHours', e.target.value)
                    }
                    inputProps={{ min: 0 }}
                    error={Boolean(errors.previewableHours)} helperText={errors.previewableHours}
                    disabled={isSubmitting || !formData.isPreviewable}
                  />
                </div>
              )}

              {canShowMinHoursPaid && (
                <div className="department-policy-form__checkbox-input-row">
                  <div className="app-form__form-checkbox">
                    <SMSCheckbox
                      label=""
                      checked={formData.isMinHoursPaid}
                      onChange={(checked) =>
                        handleChange('isMinHoursPaid', checked)
                      }
                      disabled={isSubmitting}
                    />
                  </div>
                  <SMSTextField fullWidth
                    type="number"
                    label={DEPARTMENT_POLICY.FORM.MIN_HOURS_PAID}
                    value={formData.minHoursPaid}
                    onChange={(e) =>
                      handleChange('minHoursPaid', e.target.value)
                    }
                    inputProps={{ min: 0 }}
                    error={Boolean(errors.minHoursPaid)} helperText={errors.minHoursPaid}
                    disabled={isSubmitting || !formData.isMinHoursPaid}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {(canShowHoursPostsSection || !isEditMode) && (
          <div className="app-form__section">
            <SMSTypography component="h3" variant="h6" className="app-form__section-title" gutterBottom>
              {DEPARTMENT_POLICY.FORM.SECTION_HOURS_POSTS}
            </SMSTypography>
            <div className="app-form__flex-row">
              {canShowPostsTakenPerDay && (
                <div className="department-policy-form__checkbox-input-row">
                  <div className="app-form__form-checkbox">
                    <SMSCheckbox
                      label=""
                      checked={formData.isPostsTakenPerDay}
                      onChange={(checked) =>
                        handleChange('isPostsTakenPerDay', checked)
                      }
                      disabled={isSubmitting}
                    />
                  </div>
                  <SMSTextField fullWidth
                    type="number"
                    label={DEPARTMENT_POLICY.FORM.POSTS_TAKEN_PER_DAY}
                    value={formData.postsTakenPerDay}
                    onChange={(e) =>
                      handleChange('postsTakenPerDay', e.target.value)
                    }
                    inputProps={{ min: 0 }}
                    error={Boolean(errors.postsTakenPerDay)} helperText={errors.postsTakenPerDay}
                    disabled={isSubmitting || !formData.isPostsTakenPerDay}
                  />
                </div>
              )}

              {canShowHoursPerDayWorked && (
                <div className="department-policy-form__checkbox-input-row">
                  <div className="app-form__form-checkbox">
                    <SMSCheckbox
                      label=""
                      checked={formData.isHoursPerDayWorked}
                      onChange={(checked) =>
                        handleChange('isHoursPerDayWorked', checked)
                      }
                      disabled={isSubmitting}
                    />
                  </div>
                  <SMSTextField fullWidth
                    type="number"
                    label={DEPARTMENT_POLICY.FORM.HOURS_PER_DAY_WORKED}
                    value={formData.hoursPerDayWorked}
                    onChange={(e) =>
                      handleChange('hoursPerDayWorked', e.target.value)
                    }
                    inputProps={{ min: 0 }}
                    error={Boolean(errors.hoursPerDayWorked)} helperText={errors.hoursPerDayWorked}
                    disabled={isSubmitting || !formData.isHoursPerDayWorked}
                  />
                </div>
              )}

              {canShowDeptOpenPostsTakenPerDay && (
                <div className="department-policy-form__checkbox-input-row">
                  <div className="app-form__form-checkbox">
                    <SMSCheckbox
                      label=""
                      checked={formData.isDeptOpenPostsTakenPerDay}
                      onChange={(checked) =>
                        handleChange('isDeptOpenPostsTakenPerDay', checked)
                      }
                      disabled={isSubmitting}
                    />
                  </div>
                  <SMSTextField fullWidth
                    type="number"
                    label={
                      DEPARTMENT_POLICY.FORM.DEPT_OPEN_POSTS_TAKEN_PER_DAY
                    }
                    value={formData.deptOpenPostsTakenPerDay}
                    onChange={(e) =>
                      handleChange(
                        'deptOpenPostsTakenPerDay',
                        e.target.value
                      )
                    }
                    inputProps={{ min: 0 }}
                    error={Boolean(errors.deptOpenPostsTakenPerDay)} helperText={errors.deptOpenPostsTakenPerDay}
                    disabled={
                      isSubmitting || !formData.isDeptOpenPostsTakenPerDay
                    }
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {(canShowTenureSection || !isEditMode) && (
          <div className="app-form__section">
            <SMSTypography component="h3" variant="h6" className="app-form__section-title" gutterBottom>
              {DEPARTMENT_POLICY.FORM.SECTION_TENURE}
            </SMSTypography>
            <div className="app-form__flex-row">
              {canShowTenurePostsAllowedPerWeek && (
                <div className="department-policy-form__checkbox-input-row">
                  <div className="app-form__form-checkbox">
                    <SMSCheckbox
                      label=""
                      checked={formData.isTenurePostsAllowedPerWeek}
                      onChange={(checked) =>
                        handleChange('isTenurePostsAllowedPerWeek', checked)
                      }
                      disabled={isSubmitting}
                    />
                  </div>
                  <SMSTextField fullWidth
                    type="number"
                    label={
                      DEPARTMENT_POLICY.FORM.TENURE_POSTS_ALLOWED_PER_WEEK
                    }
                    value={formData.tenurePostsAllowedPerWeek}
                    onChange={(e) =>
                      handleChange(
                        'tenurePostsAllowedPerWeek',
                        e.target.value
                      )
                    }
                    inputProps={{ min: 0 }}
                    error={Boolean(errors.tenurePostsAllowedPerWeek)} helperText={errors.tenurePostsAllowedPerWeek}
                    disabled={
                      isSubmitting || !formData.isTenurePostsAllowedPerWeek
                    }
                  />
                </div>
              )}

              {canShowTenurePostsAllowedPerDay && (
                <div className="department-policy-form__checkbox-input-row">
                  <div className="app-form__form-checkbox">
                    <SMSCheckbox
                      label=""
                      checked={formData.isTenurePostsAllowedPerDay}
                      onChange={(checked) =>
                        handleChange('isTenurePostsAllowedPerDay', checked)
                      }
                      disabled={isSubmitting}
                    />
                  </div>
                  <SMSTextField fullWidth
                    type="number"
                    label={
                      DEPARTMENT_POLICY.FORM.TENURE_POSTS_ALLOWED_PER_DAY
                    }
                    value={formData.tenurePostsAllowedPerDay}
                    onChange={(e) =>
                      handleChange(
                        'tenurePostsAllowedPerDay',
                        e.target.value
                      )
                    }
                    inputProps={{ min: 0 }}
                    error={Boolean(errors.tenurePostsAllowedPerDay)} helperText={errors.tenurePostsAllowedPerDay}
                    disabled={
                      isSubmitting || !formData.isTenurePostsAllowedPerDay
                    }
                  />
                </div>
              )}

              {canShowDeptOpenPostsTakenPerWeek && (
                <div className="department-policy-form__checkbox-input-row">
                  <div className="app-form__form-checkbox">
                    <SMSCheckbox
                      label=""
                      checked={formData.isDeptOpenPostsTakenPerWeek}
                      onChange={(checked) =>
                        handleChange('isDeptOpenPostsTakenPerWeek', checked)
                      }
                      disabled={isSubmitting}
                    />
                  </div>
                  <SMSTextField fullWidth
                    type="number"
                    label={
                      DEPARTMENT_POLICY.FORM.DEPT_OPEN_POSTS_TAKEN_PER_WEEK
                    }
                    value={formData.deptOpenPostsTakenPerWeek}
                    onChange={(e) =>
                      handleChange(
                        'deptOpenPostsTakenPerWeek',
                        e.target.value
                      )
                    }
                    inputProps={{ min: 0 }}
                    error={Boolean(errors.deptOpenPostsTakenPerWeek)} helperText={errors.deptOpenPostsTakenPerWeek}
                    disabled={
                      isSubmitting || !formData.isDeptOpenPostsTakenPerWeek
                    }
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {canShowTenurePolicySection && (
          <div className="app-form__section">
            <SMSTypography component="h3" variant="h6" className="app-form__section-title" gutterBottom>
              {DEPARTMENT_POLICY.FORM.SECTION_TENURE_POLICY}
            </SMSTypography>
            <div className="app-form__flex-row">
              <div className="department-policy-form__checkbox-input-row department-policy-form__tenure-type-row">
                <SMSDropdown
                  label={DEPARTMENT_POLICY.FORM.TENURE_TYPE}
                  value={formData.tenureType || ''}
                  onChange={(e) =>
                    handleChange('tenureType', String(e.target.value))
                  }
                  options={[
                    {
                      value: String(TenureMetricType.Assignments),
                      label: 'Assignments',
                    },
                    {
                      value: String(TenureMetricType.Hours),
                      label: 'Hours',
                    },
                  ]}
                  disabled={isSubmitting}
                  displayEmpty
                />
              </div>
            </div>
            <div className="app-form__flex-row">
              <div className="department-policy-form__checkbox-input-row">
                <SMSTextField fullWidth
                  type="number"
                  label={DEPARTMENT_POLICY.FORM.TENURE_RULE_DAY}
                  value={formData.tenureRule1Days}
                  onChange={(e) =>
                    handleChange('tenureRule1Days', e.target.value)
                  }
                  inputProps={{ min: 0 }}
                  disabled={isSubmitting}
                  required={Boolean(canShowTenurePolicySection)}
                  error={Boolean(errors.tenureRule1Days)} helperText={errors.tenureRule1Days}
                />
                <SMSTextField fullWidth
                  type="number"
                  label={
                    formData.tenureType === String(TenureMetricType.Hours)
                      ? DEPARTMENT_POLICY.FORM.TENURE_RULE_VALUE_HOURS
                      : DEPARTMENT_POLICY.FORM.TENURE_RULE_VALUE_ASSIGNMENTS
                  }
                  value={formData.tenureRule1Value}
                  onChange={(e) =>
                    handleChange('tenureRule1Value', e.target.value)
                  }
                  inputProps={{ min: 0 }}
                  disabled={isSubmitting}
                  required={Boolean(canShowTenurePolicySection)}
                  error={Boolean(errors.tenureRule1Value)} helperText={errors.tenureRule1Value}
                />
              </div>
            </div>
            <div className="app-form__flex-row">
              <div className="department-policy-form__checkbox-input-row">
                <SMSTextField fullWidth
                  type="number"
                  label={DEPARTMENT_POLICY.FORM.TENURE_RULE_DAY}
                  value={formData.tenureRule2Days}
                  onChange={(e) =>
                    handleChange('tenureRule2Days', e.target.value)
                  }
                  inputProps={{ min: 0 }}
                  disabled={isSubmitting}
                  required={Boolean(canShowTenurePolicySection)}
                  error={Boolean(errors.tenureRule2Days)} helperText={errors.tenureRule2Days}
                />
                <SMSTextField fullWidth
                  type="number"
                  label={
                    formData.tenureType === String(TenureMetricType.Hours)
                      ? DEPARTMENT_POLICY.FORM.TENURE_RULE_VALUE_HOURS
                      : DEPARTMENT_POLICY.FORM.TENURE_RULE_VALUE_ASSIGNMENTS
                  }
                  value={formData.tenureRule2Value}
                  onChange={(e) =>
                    handleChange('tenureRule2Value', e.target.value)
                  }
                  inputProps={{ min: 0 }}
                  disabled={isSubmitting}
                  required={Boolean(canShowTenurePolicySection)}
                  error={Boolean(errors.tenureRule2Value)} helperText={errors.tenureRule2Value}
                />
              </div>
            </div>
            <div className="app-form__flex-row">
              <div className="department-policy-form__checkbox-input-row">
                <SMSTextField fullWidth
                  type="number"
                  label={DEPARTMENT_POLICY.FORM.TENURE_RULE_DAY}
                  value={formData.tenureRule3Days}
                  onChange={(e) =>
                    handleChange('tenureRule3Days', e.target.value)
                  }
                  inputProps={{ min: 0 }}
                  disabled={isSubmitting}
                  required={Boolean(canShowTenurePolicySection)}
                  error={Boolean(errors.tenureRule3Days)} helperText={errors.tenureRule3Days}
                />
                <SMSTextField fullWidth
                  type="number"
                  label={
                    formData.tenureType === String(TenureMetricType.Hours)
                      ? DEPARTMENT_POLICY.FORM.TENURE_RULE_VALUE_HOURS
                      : DEPARTMENT_POLICY.FORM.TENURE_RULE_VALUE_ASSIGNMENTS
                  }
                  value={formData.tenureRule3Value}
                  onChange={(e) =>
                    handleChange('tenureRule3Value', e.target.value)
                  }
                  inputProps={{ min: 0 }}
                  disabled={isSubmitting}
                  required={Boolean(canShowTenurePolicySection)}
                  error={Boolean(errors.tenureRule3Value)} helperText={errors.tenureRule3Value}
                />
              </div>
            </div>
          </div>
        )}

        {(canShowSameDaySection || !isEditMode) && (
          <div className="app-form__section">
            <SMSTypography component="h3" variant="h6" className="app-form__section-title" gutterBottom>
              {DEPARTMENT_POLICY.FORM.SECTION_SAME_DAY_RULES}
            </SMSTypography>
            <div className="app-form__flex-row">
              {canShowPositionTakenOnSameDay && (
                <div className="department-policy-form__checkbox-input-row">
                  <div className="app-form__form-checkbox">
                    <SMSCheckbox
                      label=""
                      checked={formData.isPositionTakenOnSameday}
                      onChange={(checked) =>
                        handleChange('isPositionTakenOnSameday', checked)
                      }
                      disabled={isSubmitting}
                    />
                  </div>
                  <SMSTextField fullWidth
                    type="number"
                    label={
                      DEPARTMENT_POLICY.FORM
                        .POSITION_TAKEN_ON_SAMEDAY
                    }
                    value={formData.positionTakenOnSameday}
                    onChange={(e) =>
                      handleChange(
                        'positionTakenOnSameday',
                        e.target.value
                      )
                    }
                    inputProps={{ min: 0 }}
                    error={Boolean(errors.positionTakenOnSameday)} helperText={errors.positionTakenOnSameday}
                    disabled={
                      isSubmitting || !formData.isPositionTakenOnSameday
                    }
                  />
                </div>
              )}

              {canShowPositionTakenOnSameDay && (
                <div className="department-policy-form__checkbox-input-row">
                  <SMSTextField fullWidth
                    type="number"
                    label={DEPARTMENT_POLICY.FORM.TIME_TO_CLOSE_POST}
                    value={formData.timeToClosePost}
                    onChange={(e) =>
                      handleChange('timeToClosePost', e.target.value)
                    }
                    inputProps={{ min: 0 }}
                    error={Boolean(errors.timeToClosePost)} helperText={errors.timeToClosePost}
                    disabled={isSubmitting}
                  />
                </div>
              )}

              {canShowManagedPostTakenOnSameDay && (
                <div className="department-policy-form__checkbox-input-row">
                  <div className="app-form__form-checkbox">
                    <SMSCheckbox
                      label=""
                      checked={formData.isManagedPostTakenOnSameday}
                      onChange={(checked) =>
                        handleChange(
                          'isManagedPostTakenOnSameday',
                          checked
                        )
                      }
                      disabled={isSubmitting}
                    />
                  </div>
                  <SMSTextField fullWidth
                    type="number"
                    label={
                      DEPARTMENT_POLICY.FORM
                        .MANAGED_POST_TAKEN_ON_SAMEDAY
                    }
                    value={formData.managedPostTakenOnSameday}
                    onChange={(e) =>
                      handleChange(
                        'managedPostTakenOnSameday',
                        e.target.value
                      )
                    }
                    inputProps={{ min: 0 }}
                    error={Boolean(errors.managedPostTakenOnSameday)} helperText={errors.managedPostTakenOnSameday}
                    disabled={
                      isSubmitting || !formData.isManagedPostTakenOnSameday
                    }
                  />
                </div>
              )}

              {canShowPostExemptTakenOnSameDay && (
                <div className="department-policy-form__checkbox-input-row">
                  <div className="app-form__form-checkbox">
                    <SMSCheckbox
                      label={
                        DEPARTMENT_POLICY.FORM
                          .IS_POST_EXEMPT_TAKEN_ON_SAMEDAY
                      }
                      checked={formData.isPostExemptTakenOnSameday}
                      onChange={(checked) =>
                        handleChange('isPostExemptTakenOnSameday', checked)
                      }
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {canShowSupervisorSection && (
          <div className="app-form__section">
            <SMSTypography component="h3" variant="h6" className="app-form__section-title" gutterBottom>
              {DEPARTMENT_POLICY.FORM.SECTION_SUPERVISOR}
            </SMSTypography>
            <div className="app-form__flex-row">
              {canShowSupervisorInputs && (
                <>
                  <SMSTextField fullWidth
                    type="number"
                    label={DEPARTMENT_POLICY.FORM.POST_TO_SUPERVISE}
                    value={formData.postToSupervise}
                    onChange={(e) =>
                      handleChange('postToSupervise', e.target.value)
                    }
                    inputProps={{ min: 0 }}
                    error={Boolean(errors.postToSupervise)} helperText={errors.postToSupervise}
                    className="department-policy-form__supervisor-input"
                  />
                  <SMSTextField fullWidth
                    type="number"
                    label={
                      DEPARTMENT_POLICY.FORM
                        .NUMBER_OF_EMPLOYEES_BEFORE_SUPERVISOR_REQUIRED
                    }
                    value={formData.numberOfEmployeesBeforeSupervisorRequired}
                    onChange={(e) =>
                      handleChange(
                        'numberOfEmployeesBeforeSupervisorRequired',
                        e.target.value
                      )
                    }
                    inputProps={{ min: 0 }}
                    error={Boolean(errors.numberOfEmployeesBeforeSupervisorRequired)} helperText={errors.numberOfEmployeesBeforeSupervisorRequired}
                    className="department-policy-form__supervisor-input"
                  />
                </>
              )}
              {canShowOverlapJobConflict && (
                <div className="app-form__form-checkbox">
                  <SMSCheckbox
                    label={
                      DEPARTMENT_POLICY.FORM
                        .OVERLAP_POST_CONFLICT_CONFIRMATION
                    }
                    checked={formData.overlapJobConflictConfirmation}
                    onChange={(checked) =>
                      handleChange(
                        'overlapJobConflictConfirmation',
                        checked
                      )
                    }
                    disabled={isSubmitting}
                  />
                </div>
              )}
              {canShowSupervisorsViewLowerEmpTypeJobs && (
                <div className="app-form__form-checkbox">
                  <SMSCheckbox
                    label={
                      DEPARTMENT_POLICY.FORM
                        .SUPERVISORS_CAN_VIEW_LOWER_EMP_TYPE_POSTS
                    }
                    checked={formData.supervisorsCanViewLowerEmpTypeJobs}
                    onChange={(checked) =>
                      handleChange(
                        'supervisorsCanViewLowerEmpTypeJobs',
                        checked
                      )
                    }
                    disabled={isSubmitting}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {canShowRestrictWebLoginForNormalEmployee && (
        <div className="app-form__section">
          <SMSTypography component="h3" variant="h6" className="app-form__section-title" gutterBottom>
            {DEPARTMENT_POLICY.FORM.SECTION_LOGIN}
          </SMSTypography>
          <div className="app-form__flex-row">
            <div className="app-form__form-checkbox">
              <SMSCheckbox
                label={DEPARTMENT_POLICY.FORM.RESTRICT_WEB_LOGIN_FOR_NORMAL_EMPLOYEE}
                checked={formData.restrictWebLoginForNonAdminEmployee}
                onChange={(checked) =>
                  handleChange('restrictWebLoginForNonAdminEmployee', checked)
                }
                disabled={isSubmitting}
              />
            </div>
          </div>
        </div>
        )}

        <div className="app-form__form-footer">
          {onCancel && (
            <SMSButton
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              {DEPARTMENT_POLICY.FORM.CANCEL_BUTTON}
            </SMSButton>
          )}
          <SMSButton
            type="submit"
            disabled={isSubmitting}
            loading={isSubmitting}
          >
            {isEditMode ? DEPARTMENT_POLICY.BUTTON.UPDATE : DEPARTMENT_POLICY.FORM.SUBMIT_BUTTON}
          </SMSButton>
        </div>
      </form>
    );
  };

