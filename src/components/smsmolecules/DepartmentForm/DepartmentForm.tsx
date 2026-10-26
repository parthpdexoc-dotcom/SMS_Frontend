import React, { useState, useEffect } from 'react';
import {
  SMSButton,
  SMSCheckbox,
  SMSDropdown,
  SMSTextArea,
  SMSTextField,
  SMSTypography,
} from '@/components/smsatoms';
import { DEPARTMENT } from '@/constants/strings';
import { CreateDepartmentRequest, DepartmentResponse, UpdateDepartmentRequest } from '@/types/department';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { createDepartmentThunk, updateDepartmentThunk } from '@/store/slices/departmentSlice';
import { showToast } from '@/store/slices/toastSlice';
import { uploadDepartmentLogo, getDepartmentLogoPreviewUrl } from '@/services/fileUploadService';
import { formatDate, formatTime, formatPhoneNumber, unformatPhoneNumber, validateEmail } from '@/utils';
import { getTimeZoneOptions } from '@/types/departmentTimeZone';
import './DepartmentForm.css';

export interface DepartmentWizardDraft {
  payload: CreateDepartmentRequest;
  logoFile: File | null;
}

export interface DepartmentFormProps {
  initialData?: DepartmentResponse | null;
  onSuccess?: (departmentId?: string) => void;
  /** Create wizard: store validated details and continue. The department is not created yet. */
  onWizardNext?: (draft: DepartmentWizardDraft) => void;
  onCancel?: () => void;
  className?: string;
  submitButtonText?: string;
  /** When true, Department code and Department name are read-only. */
  disableDepartmentIdentityFields?: boolean;
  /** When true, the Department folder name field is read-only (used in Settings → Edit Profile). */
  disableEmployeeDataFolderName?: boolean;
}

interface DepartmentFormData {
  departmentCode: string;
  departmentName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  firstName: string;
  lastName: string;
  phone: string;
  fax: string;
  email: string;
  domain: string;
  active: boolean;
  timeZoneId: string;
  employeeDataFolderName: string;
}

// Field name constants to avoid hardcoded strings
const FIELD_NAMES = {
  DEPARTMENT_CODE: 'departmentCode',
  DEPARTMENT_NAME: 'departmentName',
  ADDRESS: 'address',
  CITY: 'city',
  STATE: 'state',
  ZIP: 'zip',
  FIRST_NAME: 'firstName',
  LAST_NAME: 'lastName',
  PHONE: 'phone',
  FAX: 'fax',
  EMAIL: 'email',
  DOMAIN: 'domain',
  TIMEZONE: 'timeZoneId',
  EMPLOYEE_DATA_FOLDER_NAME: 'employeeDataFolderName',
  ACTIVE: 'active',
} as const;

interface DepartmentFormErrors {
  departmentCode?: string;
  departmentName?: string;
  employeeDataFolderName?: string;
  email?: string;
  logo?: string;
}

const getDefaultFormData = (): DepartmentFormData => ({
  departmentCode: '',
  departmentName: '',
  address: '',
  city: '',
  state: '',
  zip: '',
  firstName: '',
  lastName: '',
  phone: '',
  fax: '',
  email: '',
  domain: '',
  active: true,
  timeZoneId: 'Eastern Standard Time',
  employeeDataFolderName: '',
});


export const DepartmentForm: React.FC<DepartmentFormProps> = ({
  initialData,
  onSuccess,
  onWizardNext,
  onCancel,
  className = '',
  submitButtonText,
  disableDepartmentIdentityFields = false,
  disableEmployeeDataFolderName = false,
}) => {
  const [formData, setFormData] = useState<DepartmentFormData>(getDefaultFormData());

  useEffect(() => {
    if (initialData) {
      setFormData({
        departmentCode: initialData.departmentCode || '',
        departmentName: initialData.departmentName || '',
        address: initialData.address || '',
        city: initialData.city || '',
        state: initialData.state || '',
        zip: initialData.zip || '',
        firstName: initialData.firstName || '',
        lastName: initialData.lastName || '',
        phone: formatPhoneNumber(initialData.phone || ''),
        fax: formatPhoneNumber(initialData.fax || ''),
        email: initialData.email || '',
        domain: initialData.domain || '',
        active: initialData.active ?? true,
        timeZoneId: initialData.timeZoneId || 'Eastern Standard Time',
        employeeDataFolderName: initialData.employeeDataFolderName || '',
      });
    } else {
      setFormData(getDefaultFormData());
    }
  }, [initialData]);

  const dispatch = useAppDispatch();
  const { isLoading } = useAppSelector((state) => state.department);
  const [errors, setErrors] = useState<DepartmentFormErrors>({});
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  /** File selected in browser but not yet uploaded; Update button is enabled when this is set */
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const logoInputRef = React.useRef<HTMLInputElement>(null);
  const logoPreviewUrlRef = React.useRef<string | null>(null);

  const setLogoPreviewUrlSafe = (url: string | null) => {
    if (logoPreviewUrlRef.current) {
      URL.revokeObjectURL(logoPreviewUrlRef.current);
      logoPreviewUrlRef.current = null;
    }
    if (url) logoPreviewUrlRef.current = url;
    setLogoPreviewUrl(url);
  };

  // Load existing department logo when editing (GET by departmentId)
  useEffect(() => {
    if (!initialData?.departmentID) {
      setLogoPreviewUrlSafe(null);
      setPendingLogoFile(null);
      return;
    }
    setPendingLogoFile(null);
    let mounted = true;
    getDepartmentLogoPreviewUrl(initialData.departmentID)
      .then((url) => {
        if (mounted && url) setLogoPreviewUrlSafe(url);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [initialData?.departmentID]);

  // Revoke logo object URL on unmount
  useEffect(() => {
    return () => {
      if (logoPreviewUrlRef.current) URL.revokeObjectURL(logoPreviewUrlRef.current);
    };
  }, []);

  const handleChange = (field: keyof DepartmentFormData, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors[field as keyof DepartmentFormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: DepartmentFormErrors = {};

    if (errors.logo) {
      newErrors.logo = errors.logo;
    }

    if (!formData.departmentCode.trim()) {
      newErrors.departmentCode = DEPARTMENT.ERRORS.DEPARTMENT_CODE_REQUIRED;
    }

    if (!formData.departmentName.trim()) {
      newErrors.departmentName = DEPARTMENT.ERRORS.DEPARTMENT_NAME_REQUIRED;
    }

    if (!formData.employeeDataFolderName.trim()) {
      newErrors.employeeDataFolderName = DEPARTMENT.ERRORS.EMPLOYEE_DATA_FOLDER_NAME_REQUIRED;
    }

    // Email validation
    if (formData.email.trim() && !validateEmail(formData.email)) {
      newErrors.email = DEPARTMENT.ERRORS.EMAIL_INVALID;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Check if form has valid data (for button enabling)
  const isFormValid = (): boolean => {
    return (
      formData.departmentCode.trim().length > 0 &&
      formData.departmentName.trim().length > 0 &&
      formData.employeeDataFolderName.trim().length > 0
    );
  };

  // Check if form has changes compared to initial data (for edit mode)
  const hasFormChanged = (): boolean => {
    if (!initialData) return true; // For add mode, always allow if valid
    if (pendingLogoFile) return true; // Pending logo upload counts as a change
    return (
      formData.departmentCode !== initialData.departmentCode ||
      formData.departmentName !== initialData.departmentName ||
      formData.address !== initialData.address ||
      formData.city !== initialData.city ||
      formData.state !== initialData.state ||
      formData.zip !== initialData.zip ||
      formData.firstName !== initialData.firstName ||
      formData.lastName !== initialData.lastName ||
      unformatPhoneNumber(formData.phone) !== unformatPhoneNumber(initialData.phone || '') ||
      unformatPhoneNumber(formData.fax) !== unformatPhoneNumber(initialData.fax || '') ||
      formData.email !== initialData.email ||
      formData.domain !== initialData.domain ||
      formData.active !== initialData.active ||
      formData.timeZoneId !== (initialData.timeZoneId || 'Eastern Standard Time') ||
      formData.employeeDataFolderName !== (initialData.employeeDataFolderName || '')
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      if (initialData?.departmentID) {
        // Update existing department
        const payload: UpdateDepartmentRequest = {
          departmentID: initialData.departmentID,
          departmentCode: formData.departmentCode,
          departmentName: formData.departmentName,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zip: formData.zip,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: unformatPhoneNumber(formData.phone),
          fax: unformatPhoneNumber(formData.fax),
          email: formData.email,
          domain: formData.domain,
          active: formData.active,
          timeZoneId: formData.timeZoneId,
          employeeDataFolderName: formData.employeeDataFolderName,
        };

        await dispatch(updateDepartmentThunk(payload)).unwrap();
        if (pendingLogoFile) {
          try {
            await uploadDepartmentLogo(initialData.departmentID, pendingLogoFile);
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to upload logo';
            dispatch(showToast(message, 'error'));
          } finally {
            setPendingLogoFile(null);
          }
        }
        if (onSuccess) {
          onSuccess(initialData.departmentID);
        }
      } else {
        const payload: CreateDepartmentRequest = {
          departmentCode: formData.departmentCode,
          departmentName: formData.departmentName,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zip: formData.zip,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: unformatPhoneNumber(formData.phone),
          fax: unformatPhoneNumber(formData.fax),
          email: formData.email,
          domain: formData.domain,
          active: formData.active,
          timeZoneId: formData.timeZoneId,
          employeeDataFolderName: formData.employeeDataFolderName,
        };

        if (onWizardNext) {
          onWizardNext({ payload, logoFile: pendingLogoFile });
          return;
        }

        const response = await dispatch(createDepartmentThunk(payload)).unwrap();
        const newDepartmentId = (response?.departmentID ?? '').trim();
        if (!newDepartmentId) {
          dispatch(showToast(DEPARTMENT.ERRORS.CREATE_RESPONSE_MISSING_ID, 'error'));
        }
        if (pendingLogoFile && newDepartmentId) {
          try {
            await uploadDepartmentLogo(newDepartmentId, pendingLogoFile);
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to upload logo';
            dispatch(showToast(message, 'error'));
          } finally {
            setPendingLogoFile(null);
          }
        }
        if (onSuccess) {
          onSuccess(newDepartmentId || undefined);
        }
      }
    } catch (error) {
    }
  };

  const isEditMode = Boolean(initialData?.departmentID);

  const REQUIRED_LOGO_WIDTH = 700;
  const REQUIRED_LOGO_HEIGHT = 700;

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      if (img.naturalWidth === REQUIRED_LOGO_WIDTH && img.naturalHeight === REQUIRED_LOGO_HEIGHT) {
        setErrors((prev) => ({ ...prev, logo: undefined }));
        setLogoPreviewUrlSafe(URL.createObjectURL(file));
        setPendingLogoFile(file);
      } else {
        setErrors((prev) => ({ ...prev, logo: DEPARTMENT.ERRORS.LOGO_DIMENSIONS }));
        dispatch(showToast(DEPARTMENT.ERRORS.LOGO_DIMENSIONS, 'error', 5000));
        setLogoPreviewUrlSafe(null);
        setPendingLogoFile(null);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setErrors((prev) => ({ ...prev, logo: DEPARTMENT.ERRORS.LOGO_DIMENSIONS }));
      dispatch(showToast(DEPARTMENT.ERRORS.LOGO_DIMENSIONS, 'error', 5000));
      setLogoPreviewUrlSafe(null);
      setPendingLogoFile(null);
    };
    img.src = objectUrl;
  };

  return (
    <div className={`department-form ${className}`}>
      <form onSubmit={handleSubmit} className="department-form__form">
        {/* Basic Information Section */}
        <div className="department-form__section">
          <SMSTypography component="h3" variant="h6" className="department-form__section-title">
            Basic Information
          </SMSTypography>
          <div className="department-form__form-row">
            <SMSTextField
              fullWidth
              type="text"
              label={DEPARTMENT.FORM.DEPARTMENT_CODE}
              value={formData.departmentCode}
              onChange={(e) => handleChange(FIELD_NAMES.DEPARTMENT_CODE, e.target.value)}
              placeholder={DEPARTMENT.FORM.DEPARTMENT_CODE_PLACEHOLDER}
              error={Boolean(errors.departmentCode)}
              helperText={errors.departmentCode}
              name={FIELD_NAMES.DEPARTMENT_CODE}
              id={FIELD_NAMES.DEPARTMENT_CODE}
              disabled={isLoading || disableDepartmentIdentityFields}
              required
            />

            <SMSTextField
              fullWidth
              type="text"
              label={DEPARTMENT.FORM.DEPARTMENT_NAME}
              value={formData.departmentName}
              onChange={(e) => handleChange(FIELD_NAMES.DEPARTMENT_NAME, e.target.value)}
              placeholder={DEPARTMENT.FORM.DEPARTMENT_NAME_PLACEHOLDER}
              error={Boolean(errors.departmentName)}
              helperText={errors.departmentName}
              name={FIELD_NAMES.DEPARTMENT_NAME}
              id={FIELD_NAMES.DEPARTMENT_NAME}
              disabled={isLoading}
              required
            />
            <SMSDropdown
              options={getTimeZoneOptions()}
              value={formData.timeZoneId}
              onChange={(e) => handleChange(FIELD_NAMES.TIMEZONE, String(e.target.value))}
              placeholder={DEPARTMENT.FORM.TIMEZONE_PLACEHOLDER}
              label={DEPARTMENT.FORM.TIMEZONE}
              name={FIELD_NAMES.TIMEZONE}
              id={FIELD_NAMES.TIMEZONE}
              disabled={isLoading}
            />
            <SMSTextField
              fullWidth
              type="text"
              label={DEPARTMENT.FORM.EMPLOYEE_DATA_FOLDER_NAME}
              value={formData.employeeDataFolderName}
              onChange={(e) => handleChange(FIELD_NAMES.EMPLOYEE_DATA_FOLDER_NAME, e.target.value)}
              placeholder={DEPARTMENT.FORM.EMPLOYEE_DATA_FOLDER_NAME_PLACEHOLDER}
              error={Boolean(errors.employeeDataFolderName)}
              helperText={errors.employeeDataFolderName}
              name={FIELD_NAMES.EMPLOYEE_DATA_FOLDER_NAME}
              id={FIELD_NAMES.EMPLOYEE_DATA_FOLDER_NAME}
              disabled={isLoading || disableEmployeeDataFolderName}
              required
            />
          </div>
        </div>

        {/* Address Information Section */}
        <div className="department-form__section">
          <SMSTypography component="h3" variant="h6" className="department-form__section-title">
            Address Information
          </SMSTypography>
          <SMSTextArea
            fullWidth
            label={DEPARTMENT.FORM.ADDRESS}
            value={formData.address}
            onChange={(e) => handleChange(FIELD_NAMES.ADDRESS, e.target.value)}
            placeholder={DEPARTMENT.FORM.ADDRESS_PLACEHOLDER}
            name={FIELD_NAMES.ADDRESS}
            id={FIELD_NAMES.ADDRESS}
            disabled={isLoading}
            minRows={3}
          />

          <div className="department-form__form-row">
            <SMSTextField
              fullWidth
              type="text"
              label={DEPARTMENT.FORM.CITY}
              value={formData.city}
              onChange={(e) => handleChange(FIELD_NAMES.CITY, e.target.value)}
              placeholder={DEPARTMENT.FORM.CITY_PLACEHOLDER}
              name={FIELD_NAMES.CITY}
              id={FIELD_NAMES.CITY}
              disabled={isLoading}
            />

            <SMSTextField
              fullWidth
              type="text"
              label={DEPARTMENT.FORM.STATE}
              value={formData.state}
              onChange={(e) => handleChange(FIELD_NAMES.STATE, e.target.value)}
              placeholder={DEPARTMENT.FORM.STATE_PLACEHOLDER}
              name={FIELD_NAMES.STATE}
              id={FIELD_NAMES.STATE}
              disabled={isLoading}
            />
          </div>
          <div className="department-form__form-row">
          <SMSTextField
              fullWidth
              type="text"
              label={DEPARTMENT.FORM.ZIP}
              value={formData.zip}
              onChange={(e) => handleChange(FIELD_NAMES.ZIP, e.target.value)}
              placeholder={DEPARTMENT.FORM.ZIP_PLACEHOLDER}
              name={FIELD_NAMES.ZIP}
              id={FIELD_NAMES.ZIP}
              disabled={isLoading}
              inputProps={{ maxLength: 10 }}
            />
          </div>
        </div>

        {/* Contact Information Section */}
        <div className="department-form__section">
          <SMSTypography component="h3" variant="h6" className="department-form__section-title">
            Contact Information
          </SMSTypography>
          <div className="department-form__form-row">
            <SMSTextField
              fullWidth
              type="text"
              label={DEPARTMENT.FORM.FIRST_NAME}
              value={formData.firstName}
              onChange={(e) => handleChange(FIELD_NAMES.FIRST_NAME, e.target.value)}
              placeholder={DEPARTMENT.FORM.FIRST_NAME_PLACEHOLDER}
              name={FIELD_NAMES.FIRST_NAME}
              id={FIELD_NAMES.FIRST_NAME}
              disabled={isLoading}
            />

            <SMSTextField
              fullWidth
              type="text"
              label={DEPARTMENT.FORM.LAST_NAME}
              value={formData.lastName}
              onChange={(e) => handleChange(FIELD_NAMES.LAST_NAME, e.target.value)}
              placeholder={DEPARTMENT.FORM.LAST_NAME_PLACEHOLDER}
              name={FIELD_NAMES.LAST_NAME}
              id={FIELD_NAMES.LAST_NAME}
              disabled={isLoading}
            />
          </div>

          <div className="department-form__form-row">
            <SMSTextField
              fullWidth
              type="tel"
              label={DEPARTMENT.FORM.PHONE}
              value={formData.phone}
              onChange={(e) => handleChange(FIELD_NAMES.PHONE, formatPhoneNumber(e.target.value))}
              placeholder={DEPARTMENT.FORM.PHONE_PLACEHOLDER}
              name={FIELD_NAMES.PHONE}
              id={FIELD_NAMES.PHONE}
              disabled={isLoading}
            />

            <SMSTextField
              fullWidth
              type="tel"
              label={DEPARTMENT.FORM.FAX}
              value={formData.fax}
              onChange={(e) => handleChange(FIELD_NAMES.FAX, formatPhoneNumber(e.target.value))}
              placeholder={DEPARTMENT.FORM.FAX_PLACEHOLDER}
              name={FIELD_NAMES.FAX}
              id={FIELD_NAMES.FAX}
              disabled={isLoading}
            />
          </div>

          <div className="department-form__form-row">
            <SMSTextField
              fullWidth
              type="email"
              label={DEPARTMENT.FORM.EMAIL}
              value={formData.email}
              onChange={(e) => handleChange(FIELD_NAMES.EMAIL, e.target.value)}
              placeholder={DEPARTMENT.FORM.EMAIL_PLACEHOLDER}
              error={Boolean(errors.email)}
              helperText={errors.email}
              name={FIELD_NAMES.EMAIL}
              id={FIELD_NAMES.EMAIL}
              disabled={isLoading}
            />

            <SMSTextField
              fullWidth
              type="text"
              label={DEPARTMENT.FORM.DOMAIN}
              value={formData.domain}
              onChange={(e) => handleChange(FIELD_NAMES.DOMAIN, e.target.value)}
              placeholder={DEPARTMENT.FORM.DOMAIN_PLACEHOLDER}
              name={FIELD_NAMES.DOMAIN}
              id={FIELD_NAMES.DOMAIN}
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Status Section */}
        <div className="department-form__section">
          <SMSTypography component="h3" variant="h6" className="department-form__section-title">
            Status
          </SMSTypography>
          <div className="department-form__form-checkbox">
            <SMSCheckbox
              label={DEPARTMENT.FORM.IS_ACTIVE}
              checked={formData.active}
              onChange={(checked) => handleChange(FIELD_NAMES.ACTIVE, checked)}
              name={FIELD_NAMES.ACTIVE}
              id={FIELD_NAMES.ACTIVE}
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Department Logo (Add and Edit) */}
        <div className="department-form__section department-form__section--logo">
            <div className="department-form__logo-row">
            <SMSButton
                type="button"
                disabled={isLoading}
                onClick={() => logoInputRef.current?.click()}
                className="department-form__logo-button"
              >
                {DEPARTMENT.FORM.UPLOAD_LOGO_BUTTON}
              </SMSButton>
              <span className="department-form__logo-label">{DEPARTMENT.FORM.UPLOAD_LOGO}</span>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="department-form__logo-input"
                aria-label={DEPARTMENT.FORM.UPLOAD_LOGO_BUTTON}
                onChange={handleLogoSelect}
                disabled={isLoading}
              />
              {logoPreviewUrl && (
                <div className="department-form__logo-preview">
                  <img src={logoPreviewUrl} alt="Department logo" className="department-form__logo-preview-img" />
                </div>
              )}
              {errors.logo && (
                <SMSTypography
                  component="span"
                  variant="caption"
                  color="error"
                  className="department-form__logo-error"
                  role="alert"
                >
                  {errors.logo}
                </SMSTypography>
              )}
            </div>
          </div>

        {isEditMode && initialData && (
          <div className="department-form__audit-info">
            <div className="department-form__audit-info-row">
              <span className="department-form__audit-item">
                <span className="department-form__audit-label">{DEPARTMENT.TABLE.COLUMNS.CREATED_BY}:</span>
                <span className="department-form__audit-value">
                  {initialData.createdBy || ''}
                  {initialData.createdDate && (
                    <span className="department-form__audit-date">
                      {' '}({formatDate(initialData.createdDate)} {formatTime(initialData.createdDate)})
                    </span>
                  )}
                </span>
              </span>
              <span className="department-form__audit-separator">|</span>
              <span className="department-form__audit-item">
                <span className="department-form__audit-label">{DEPARTMENT.TABLE.COLUMNS.EDITED_BY}:</span>
                <span className="department-form__audit-value">
                  {initialData.editedBy || ''}
                  {initialData.editedDate && (
                    <span className="department-form__audit-date">
                      {' '}({formatDate(initialData.editedDate)} {formatTime(initialData.editedDate)})
                    </span>
                  )}
                </span>
              </span>
            </div>
          </div>
        )}

        <div className="department-form__footer">
          {onCancel && (
            <SMSButton
              type="button"
              onClick={onCancel}
              disabled={isLoading}
            >
              {DEPARTMENT.FORM.CANCEL_BUTTON}
            </SMSButton>
          )}
          <SMSButton
            type="submit"
            disabled={isLoading || !isFormValid() || (isEditMode && !hasFormChanged())}
            loading={isLoading}
            fullWidth={!onCancel}
          >
            {submitButtonText || (isEditMode ? DEPARTMENT.BUTTON.UPDATE : DEPARTMENT.FORM.SUBMIT_BUTTON)}
          </SMSButton>
        </div>
      </form>
    </div>
  );
};

