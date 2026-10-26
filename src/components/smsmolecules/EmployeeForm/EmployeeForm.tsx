import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  SMSButton,
  SMSCurrencyInput,
  SMSTextField,
  SMSDropdown,
  SMSSwitch,
  SMSCheckbox,
  SMSBox,
  SMSDialogActions,
  SMSDatePicker,
  SMSTabs,
  SMSSegmentedStatusFilter,
} from '@/components/smsatoms';
import { MuiTelInput, type MuiTelInputInfo } from 'mui-tel-input';
import { SMSModal as Modal } from '@/components/smsorganisms';
import { SMSFormField, SMSConfirmDialog } from '@/components/smsmolecules';
import {
  SMSConsentDisclosureDialog,
  type SMSConsentDisclosureDialogMode,
} from '@/components/smsmolecules/SMSConsentDisclosureDialog';

import { DEPARTMENT, EMPLOYEE, LOGIN } from '@/constants/strings';
import {
  CreateEmployeeRequest,
  EmployeeResponse,
  EmployeeFormData,
  employeeResponseToFormData,
} from '@/types/employee';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { upsertEmployeeThunk, patchEmployeeThunk, fetchEmployees } from '@/store/slices/employeeSlice';
import { fetchActiveEmployeeTypes } from '@/store/slices/employeeTypeSlice';
import { fetchActiveEmployeeStatuses } from '@/store/slices/employeeStatusSlice';
import { fetchActiveSkills } from '@/store/slices/skillSlice';
import { fetchActiveDepartmentDivisions } from '@/store/slices/departmentDivisionsSlice';
import { fetchAdminTypes } from '@/store/slices/adminTypeSlice';
import { showToast } from '@/store/slices/toastSlice';
import { bumpProfilePhotoRefresh } from '@/store/slices/authSlice';
import { uploadEmployeePhoto, getEmployeePhotoPreviewUrl } from '@/services/fileUploadService';
import {
  formatDate,
  formatDateShort,
  formatTime,
  formatPhoneNumber,
  unformatPhoneNumber,
  joinSmsTelephoneNumber,
  DEFAULT_SMS_TELEPHONE_REGION,
  validateEmail,
  formatLastNameCommaFirstName,
} from '@/utils';
import '@/styles/forms.css'; // Common form styles
import './EmployeeForm.css';
import { createEmployeeAdmin } from '@/services/employeeAdminService';
import { upsertDepartmentAdminThunk } from '@/store/slices/departmentAdminSlice';
import { SMSDataTableWrapper, SMSDataTableActions, type DataTableColumn } from '@/components/smsorganisms';
import { EmployeeSkillDto } from '@/types/employeeSkill';
import type { SkillResponse } from '@/types/skill';
import { hasRole, UserRoleType } from '@/types/userRole';
import {
  bulkUpsertEmployeeSkillsThunk,
  deleteEmployeeSkillThunk,
  fetchEmployeeSkills,
} from '@/store/slices/employeeSkillSlice';
import { EmployeeTenureRankHistorySection } from './EmployeeTenureRankHistorySection';
import {
  clearWizardEmployee,
  saveWizardEmployee,
  WizardEmployeeResume,
} from '@/features/department-administration/pages/DepartmentFormPage/wizardResume';
export interface EmployeeFormProps {
  initialData?: EmployeeResponse | null;
  departmentID?: string;
  /** Department create wizard: create the department when the admin employee is saved. */
  resolveDepartmentId?: () => Promise<string>;
  /** Present after a refresh that happened once the department already existed. */
  wizardResume?: WizardEmployeeResume | null;
  /** Department create wizard: remove that new department when the admin employee is not saved. */
  abandonCreatedDepartment?: (departmentId: string, message?: string) => Promise<void>;
  onSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
}

interface EmployeeSkillRow {
  employeeSkillId: string;
  skillId: string;
  skillShort?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  isActive: boolean;
}

function idByName<T>(
  items: T[],
  target: string,
  idOf: (item: T) => string,
  namesOf: (item: T) => Array<string | null | undefined>
): string {
  const wanted = target.trim().toLowerCase();
  const match = items.find((item) =>
    namesOf(item).some((name) => (name || '').trim().toLowerCase() === wanted)
  );
  return match ? idOf(match) : '';
}

function isSameEmployeeId(a: string | undefined, b: string | undefined): boolean {
  const x = a?.trim().toLowerCase();
  const y = b?.trim().toLowerCase();
  return Boolean(x && y && x === y);
}

function employeeSkillIdFromDto(es: { employeeSkillId?: string; EmployeeSkillId?: string; employeeSkillID?: string; EmployeeSkillID?: string } | null | undefined): string | null {
  if (es == null) return null;
  return es.employeeSkillId ?? es.EmployeeSkillId ?? es.employeeSkillID ?? es.EmployeeSkillID ?? null;
}

/** Merge bulk upsert results into current rows (API returns only created/updated DTOs). */
function mergeEmployeeSkillsWithBulkResult(
  previous: EmployeeSkillDto[],
  bulkResult: EmployeeSkillDto[]
): EmployeeSkillDto[] {
  const map = new Map<string, EmployeeSkillDto>();
  for (const es of previous) {
    const id = employeeSkillIdFromDto(es);
    if (id) map.set(id, es);
  }
  for (const u of bulkResult) {
    const id = employeeSkillIdFromDto(u);
    if (id) map.set(id, u);
  }
  return [...map.values()];
}

// Using EmployeeFormData from types/employee.ts

// Field name constants to avoid hardcoded strings
const FIELD_NAMES = {
  EMPLOYEE_TYPE_ID: 'employeeTypeID',
  STATUS_ID: 'statusID',
  BADGE_NUMBER: 'badgeNumber',
  EMPLOYEE_NUMBER: 'employeeNumber',
  FIRST_NAME: 'firstName',
  LAST_NAME: 'lastName',
  USERNAME: 'username',
  PASSWORD: 'password',
  PRIMARY_PHONE: 'primaryPhone',
  SECONDARY_PHONE: 'secondaryPhone',
  OFF_DUTY_CALLBACK_PHONE_NUMBER: 'offDutyCallBackPhoneNumber',
  PRIMARY_EMAIL: 'primaryEmail',
  SECONDARY_EMAIL: 'secondaryEmail',
  OFF_DUTY_CALLBACK_EMAIL: 'offDutyCallBackEmail',
  IS_SUBSIDIZED_VEHICLE: 'isSubsidizedVehicle',
  SMS_TELEPHONE_NUMBER: 'smsTelephoneNumber',
  SMS_CONSENT_DISCLOSURE: 'hasSmsConsent',
  NOTIFY_WHEN_JOBS_POSTED: 'notifyWhenJobsPosted',
  NOTIFY_JOB_STARTING_IN_24_HOURS: 'notifyJobStartingIn24Hours',
  NOTIFY_JOB_STARTING_IN_1_HOUR: 'notifyJobStartingIn1Hour',
  HOURLY_SALARY: 'hourlySalary',
  HR_COST_CENTER_CODE: 'hrCostCenterCode',
  DIVISION_ID: 'divisionID',
  EMPLOYEE_DEPARTMENT_DEFINED_FIELD_1: 'employeeDepartmentDefinedField1',
  EMPLOYEE_DEPARTMENT_DEFINED_FIELD_2: 'employeeDepartmentDefinedField2',
  EMPLOYEE_DEPARTMENT_DEFINED_FIELD_3: 'employeeDepartmentDefinedField3',
  EMPLOYEE_DEPARTMENT_DEFINED_FIELD_4: 'employeeDepartmentDefinedField4',
  SKILL_IDS: 'skillIDs',
} as const;

const INFO_TABS = {
  SKILLS: 'skills',
  RANK_HISTORY: 'rankHistory',
  ADDITIONAL: 'additional',
} as const;

type InfoTabKey = (typeof INFO_TABS)[keyof typeof INFO_TABS];

interface EmployeeFormErrors {
  employeeTypeID?: string;
  statusID?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  password?: string;
  hourlySalary?: string;
  primaryEmail?: string;
  secondaryEmail?: string;  
  offDutyCallBackEmail?: string;
  costCenterCode?: string;
  badgeNumber?: string;
  employeeNumber?: string;
  skillIDs?: string;
  primaryPhone?: string;
  offDutyCallBackPhoneNumber?: string;
  smsTelephoneNumber?: string;
  divisionID?: string;
  profilePhoto?: string;
}

const getDefaultFormData = (): EmployeeFormData => ({
  employeeID: '',
  departmentID: '',
  employeeTypeID: '',
  statusID: '',
  badgeNumber: '',
  employeeNumber: '',
  firstName: '',
  lastName: '',
  username: '',
  password: '',
  primaryPhone: '',
  secondaryPhone: '',
  offDutyCallBackPhoneNumber: '',
  primaryEmail: '',
  secondaryEmail: '',
  offDutyCallBackEmail: '',
  hourlySalary: null,
  hrCostCenterCode: '',
  divisionID: '',
  employeeDepartmentDefinedField1: '',
  employeeDepartmentDefinedField2: '',
  employeeDepartmentDefinedField3: '',
  employeeDepartmentDefinedField4: '',
  skillIDs: [],
  isApproved: true,
  isSubsidizedVehicle: false,
  smsTelephoneNumber: '',
  smsTelephoneRegion: DEFAULT_SMS_TELEPHONE_REGION,
  smsTelephoneInput: DEFAULT_SMS_TELEPHONE_REGION,
  hasSmsConsent: false,
  notifyWhenJobsPosted: true,
  notifyJobStartingIn24Hours: true,
  notifyJobStartingIn1Hour: true,
});

function revokeBlobPreviewUrl(url: string | null): void {
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
}

function skillResponseIsSuspended(skill: SkillResponse | undefined): boolean {
  if (!skill) return false;
  const short = (skill.skillShort || '').trim().toLowerCase();
  const long = (skill.skillLong || '').trim().toLowerCase();
  return short === 'suspended' || long === 'suspended';
}

function dropdownOptions(
  isWizard: boolean,
  wizardLabel: string,
  isEdit: boolean,
  options: { value: string; label: string }[],
  placeholder: string
) {
  if (isWizard) return [{ value: wizardLabel, label: wizardLabel }];
  if (isEdit) return options;
  return [{ value: '', label: placeholder }, ...options];
}

function skillIdIsSuspended(skillId: string, skills: SkillResponse[]): boolean {
  const found = skills.find((sk) => String(sk.skillId) === String(skillId));
  return skillResponseIsSuspended(found);
}

export const EmployeeForm: React.FC<EmployeeFormProps> = ({
  initialData,
  departmentID,
  resolveDepartmentId,
  wizardResume = null,
  abandonCreatedDepartment,
  onSuccess,
  onCancel,
  className = '',
}) => {
  const isDepartmentWizard = Boolean(resolveDepartmentId);
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state: any) => state.auth);
  const isDepartmentAdmin = hasRole(user?.roles, UserRoleType.DepartmentAdmin);
  const isSuperUser = user?.isSuperUser === true || hasRole(user?.roles, UserRoleType.SuperUser);
  const { isLoading, employees } = useAppSelector((state) => state.employee);
  const { activeEmployeeTypes } = useAppSelector((state) => state.employeeType);
  const { activeEmployeeStatuses } = useAppSelector((state) => state.employeeStatus);
  const { activeSkills } = useAppSelector((state) => state.skill);
  const { adminTypes } = useAppSelector((state) => state.adminType);
  const { activeDivisions: departmentDivisions, isLoading: divisionsLoading } = useAppSelector(
    (state) => state.departmentDivisions
  );
  const [formData, setFormData] = useState<EmployeeFormData>(() => {
    if (wizardResume?.form) {
      return { ...getDefaultFormData(), ...wizardResume.form };
    }
    if (initialData) {
      return employeeResponseToFormData(initialData, departmentID);
    }
    return {
      ...getDefaultFormData(),
      departmentID: departmentID || user?.departmentID || '',
    };
  });
  const isOwnProfile = useMemo(() => {
    const current = (user?.employeeID || '').trim().toLowerCase();
    const target = (initialData?.employeeID || formData.employeeID || '').trim().toLowerCase();
    return Boolean(initialData?.employeeID && current && target && current === target);
  }, [user?.employeeID, initialData?.employeeID, formData.employeeID]);

  /** Full edit: super user, or department admin editing another employee (not own profile). */
  const canEditAllFields = isSuperUser || (isDepartmentAdmin && !isOwnProfile);

  const [errors, setErrors] = useState<EmployeeFormErrors>({});
  const [, setSubmitError] = useState<string | null>(null);
  const [activeInfoTab, setActiveInfoTab] = useState<InfoTabKey>(INFO_TABS.SKILLS);
  const [selectedSkillId, setSelectedSkillId] = useState<string>('');
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  // Tracks which EmployeeSkill record (row) is being edited so updates
  // apply to the correct active/inactive instance when there are multiples.
  const [editingEmployeeSkillId, setEditingEmployeeSkillId] = useState<string | null>(null);
  // Tracks newly added skills (by skillId) and edited existing EmployeeSkill rows (by EmployeeSkillID)
  // so that API calls can be performed once when the main Update button is clicked.
  const [newSkillIds, setNewSkillIds] = useState<Set<string>>(new Set());
  const [editedEmployeeSkillIds, setEditedEmployeeSkillIds] = useState<Set<string>>(new Set());
  /** Saved EmployeeSkill row IDs to delete via DELETE /EmployeeSkill/{id} when the form is updated */
  const [pendingDeletedEmployeeSkillIds, setPendingDeletedEmployeeSkillIds] = useState<Set<string>>(
    new Set()
  );
  const [skillStartDateInput, setSkillStartDateInput] = useState<string>('');
  const [skillEndDateInput, setSkillEndDateInput] = useState<string>('');
  const [skillStartDateOverrides, setSkillStartDateOverrides] = useState<Record<string, string | null>>(
    wizardResume?.skillStartDateOverrides ?? {}
  );
  const [skillEndDateOverrides, setSkillEndDateOverrides] = useState<Record<string, string | null>>(
    wizardResume?.skillEndDateOverrides ?? {}
  );
  const [employeeSkills, setEmployeeSkills] = useState<EmployeeSkillDto[]>([]);
  const employeeSkillsRef = useRef(employeeSkills);
  employeeSkillsRef.current = employeeSkills;
  const [employeeSkillRowPendingDelete, setEmployeeSkillRowPendingDelete] =
    useState<EmployeeSkillRow | null>(null);
  const [skillAddError, setSkillAddError] = useState<string | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrlState] = useState<string | null>(null);
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoPreviewUrlRef = useRef<string | null>(null);
  const setPhotoPreviewUrlSafe = (url: string | null) => {
    revokeBlobPreviewUrl(photoPreviewUrlRef.current);
    photoPreviewUrlRef.current = null;
    if (url) photoPreviewUrlRef.current = url;
    setPhotoPreviewUrlState(url);
  };

  useEffect(() => {
    if (isDepartmentWizard) return;
    if (initialData) {
      setFormData(employeeResponseToFormData(initialData, departmentID));
    } else {
      setFormData({
        ...getDefaultFormData(),
        departmentID: departmentID || user?.departmentID || '',
      });
    }
  }, [initialData, departmentID, isDepartmentWizard, user?.departmentID]);

  // Load employee skill date ranges from backend (EmployeeSkill API) in edit mode
  useEffect(() => {
    const loadEmployeeSkills = async () => {
      if (!initialData?.employeeID) return;
      try {
        const skills = await dispatch(fetchEmployeeSkills(initialData.employeeID)).unwrap();
        setEmployeeSkills(skills);
      } catch (e) {
        console.error('Failed to load employee skills', e);
      }
    };

    loadEmployeeSkills();
  }, [initialData?.employeeID]);

  // Load existing profile photo when editing: prefer inline image from GET /Employee/{id}
  // (profilePhotoBase64); fall back to UploadFile stream when the DTO has no embedded photo.
  useEffect(() => {
    if (!initialData?.employeeID) {
      setPhotoPreviewUrlSafe(null);
      setPendingPhotoFile(null);
      return;
    }
    setPendingPhotoFile(null);
    let mounted = true;

    const b64 = initialData.profilePhotoBase64?.trim();
    const mime = (initialData.profilePhotoContentType || 'image/jpeg').trim() || 'image/jpeg';
    if (b64) {
      setPhotoPreviewUrlSafe(`data:${mime};base64,${b64}`);
      return () => {
        mounted = false;
      };
    }

    void getEmployeePhotoPreviewUrl(initialData.employeeID)
      .then((url) => {
        if (!mounted) return;
        if (url) setPhotoPreviewUrlSafe(url);
        else setPhotoPreviewUrlSafe(null);
      })
      .catch(() => {
        if (mounted) setPhotoPreviewUrlSafe(null);
      });
    return () => {
      mounted = false;
    };
  }, [
    initialData?.employeeID,
    initialData?.profilePhotoBase64,
    initialData?.profilePhotoContentType,
  ]);

  // Revoke blob preview URL on unmount (data: URLs are not revoked)
  useEffect(() => {
    return () => {
      revokeBlobPreviewUrl(photoPreviewUrlRef.current);
      photoPreviewUrlRef.current = null;
    };
  }, []);

  // When the Add/Edit Skill modal is opened fresh, clear any previous error
  useEffect(() => {
    if (isSkillModalOpen) {
      setSkillAddError(null);
    }
  }, [isSkillModalOpen]);

  // Fetch department divisions for the department this form is scoped to.
  useEffect(() => {
    const deptID = departmentID || formData.departmentID || (isDepartmentWizard ? '' : user?.departmentID);
    if (!deptID) return;
    dispatch(
      fetchActiveDepartmentDivisions({
        departmentId: deptID,
        selectedId: initialData?.divisionID || undefined,
      })
    );
  }, [formData.departmentID, departmentID, isDepartmentWizard, user?.departmentID, initialData?.divisionID, dispatch]);

  const departmentIdForReferenceLists = useMemo(
    () =>
      departmentID ||
      formData.departmentID ||
      (isDepartmentWizard ? undefined : user?.departmentID || undefined),
    [departmentID, formData.departmentID, isDepartmentWizard, user?.departmentID]
  );

  useEffect(() => {
    if (!initialData?.employeeID) return;
    dispatch(
      fetchActiveSkills({
        departmentId: departmentIdForReferenceLists,
        selectedIds: Array.from(
          new Set(
            [
              ...(formData.skillIDs ?? []),
              ...(employeeSkills || []).map((es: any) =>
                es.skillId ?? es.SkillId ?? es.skillID ?? es.SkillID ?? null
              ),
            ]
              .map((sid) => String(sid ?? '').trim())
              .filter(Boolean)
          )
        ),
      })
    );
  }, [
    dispatch,
    initialData?.employeeID,
    departmentIdForReferenceLists,
    formData.skillIDs,
    employeeSkills,
  ]);

  // Fetch active data for form dropdowns (scoped by department when ID is known)
  useEffect(() => {
    if (isDepartmentWizard && !departmentIdForReferenceLists) return;
    dispatch(
      fetchActiveEmployeeTypes({
        departmentId: departmentIdForReferenceLists,
        selectedId: initialData?.employeeTypeID || undefined,
      })
    );
    dispatch(
      fetchActiveEmployeeStatuses({
        departmentId: departmentIdForReferenceLists,
        selectedId: initialData?.statusID || undefined,
      })
    );
  }, [
    dispatch,
    isDepartmentWizard,
    departmentIdForReferenceLists,
    initialData?.employeeTypeID,
    initialData?.statusID,
  ]);

  // Ensure form skillIDs only contain skills that still exist in the active skills list
  useEffect(() => {
    if (isDepartmentWizard) return;
    if (!activeSkills || activeSkills.length === 0) return;

    setFormData((prev) => {
      const currentSkillIDs = prev.skillIDs || [];
      if (currentSkillIDs.length === 0) {
        return prev;
      }

      const activeSkillIdSet = new Set(activeSkills.map((s) => s.skillId));
      const validSkillIDs = currentSkillIDs.filter((id) => activeSkillIdSet.has(id));

      // If nothing changed, avoid unnecessary state updates/re-renders
      if (validSkillIDs.length === currentSkillIDs.length) {
        return prev;
      }

      return {
        ...prev,
        skillIDs: validSkillIDs,
      };
    });
  }, [activeSkills, isDepartmentWizard]);

  // Ensure admin types are loaded so we can resolve the Department Admin type ID from API (via slice)
  useEffect(() => {
    if (!adminTypes || adminTypes.length === 0) {
      dispatch(fetchAdminTypes({ page: 1, pageSize: 1000 }));
    }
  }, [adminTypes, dispatch]);

  const DEPARTMENT_ADMIN_SHORT = 'Department Admin';

  const departmentAdminTypeID = useMemo(() => {
    if (!adminTypes || adminTypes.length === 0) return '';
    const match = adminTypes.find(
      (t) =>
        (t.adminTypeShort || '').trim().toLowerCase() ===
        DEPARTMENT_ADMIN_SHORT.trim().toLowerCase()
    );
    return match?.adminTypeID ?? '';
  }, [adminTypes]);

  const isDepartmentAdminEditingSelf = useMemo(() => {
    if (!hasRole(user?.roles, UserRoleType.DepartmentAdmin)) return false;
    const current = (user?.employeeID || '').trim().toLowerCase();
    const target = (initialData?.employeeID || formData.employeeID || '').trim().toLowerCase();
    return Boolean(target && current && current === target);
  }, [user?.roles, user?.employeeID, initialData?.employeeID, formData.employeeID]);

  const employeeTypeOptions = useMemo(() => {
    const base = activeEmployeeTypes.map((type) => ({
      value: type.employeeTypeID,
      label: type.employeeTypeShort,
    }));
    if (!initialData?.employeeID) return base;
    const sel = formData.employeeTypeID || '';
    if (!sel || base.some((o) => String(o.value) === String(sel))) return base;
    const label =
      (initialData.employeeType && String(initialData.employeeType).trim()) || 'Currently assigned';
    return [...base, { value: sel, label }];
  }, [activeEmployeeTypes, formData.employeeTypeID, initialData?.employeeID, initialData?.employeeType]);

  const employeeStatusOptions = useMemo(() => {
    const base = activeEmployeeStatuses.map((status) => ({
      value: status.employeeStatusID,
      label: status.statusShort,
    }));
    if (!initialData?.employeeID) return base;
    const sel = formData.statusID || '';
    if (!sel || base.some((o) => String(o.value) === String(sel))) return base;
    const label =
      (initialData.status && String(initialData.status).trim()) || 'Currently assigned';
    return [...base, { value: sel, label }];
  }, [activeEmployeeStatuses, formData.statusID, initialData?.employeeID, initialData?.status]);

  const divisionOptions = useMemo(() => {
    const base = departmentDivisions
      .filter(
        (division) =>
          division.divisionActive ||
          String(division.divisionID) === String(formData.divisionID || '')
      )
      .map((division) => ({
        value: division.divisionID,
        label: division.divisionShort || division.divisionLong,
      }));
    if (!initialData?.employeeID) return base;
    const sel = formData.divisionID || '';
    if (!sel || base.some((o) => String(o.value) === String(sel))) return base;
    return [...base, { value: sel, label: 'Currently assigned' }];
  }, [departmentDivisions, formData.divisionID, initialData?.employeeID]);

  const skillOptions = useMemo(
    () =>
      activeSkills.map((skill) => ({
        value: skill.skillId,
        label: skill.skillShort || skill.skillLong,
      })),
    [activeSkills]
  );

  const skillLabelById = useMemo(() => {
    const map = new Map<string, string>();
    skillOptions.forEach((opt) => {
      map.set(String(opt.value), String(opt.label || '').trim());
    });
    return map;
  }, [skillOptions]);

  const handleChange = (field: keyof EmployeeFormData, value: string | number | boolean | string[] | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors[field as keyof EmployeeFormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSmsTelephoneChange = (value: string, info: MuiTelInputInfo) => {
    setFormData((prev) => ({
      ...prev,
      smsTelephoneInput: value,
      smsTelephoneRegion: info.countryCallingCode
        ? `+${info.countryCallingCode}`
        : DEFAULT_SMS_TELEPHONE_REGION,
      smsTelephoneNumber: formatPhoneNumber(info.nationalNumber || ''),
    }));
    if (errors.smsTelephoneNumber) {
      setErrors((prev) => ({ ...prev, smsTelephoneNumber: undefined }));
    }
  };

  /**
   * SMS consent disclosure dialog.
   * - `consent`: opened by checking the box; Yes checks it, No leaves it cleared.
   * - `review`: opened from the hyperlink; read-only, does not change the checkbox.
   */
  const [consentDialogMode, setConsentDialogMode] = useState<SMSConsentDisclosureDialogMode | null>(null);

  const handleSmsConsentToggle = (checked: boolean) => {
    if (checked) {
      const digits = (formData.smsTelephoneNumber || '').replace(/\D/g, '');
      if (!digits) {
        setErrors((prev) => ({
          ...prev,
          smsTelephoneNumber: EMPLOYEE.NOTIFICATIONS.SMS_TELEPHONE_REQUIRED,
        }));
        return;
      }
      setConsentDialogMode('consent');
      return;
    }
    handleChange(FIELD_NAMES.SMS_CONSENT_DISCLOSURE, false);
  };

  const handleConsentDialogYes = () => {
    if (consentDialogMode === 'consent') {
      handleChange(FIELD_NAMES.SMS_CONSENT_DISCLOSURE, true);
    }
    setConsentDialogMode(null);
  };

  const handleConsentDialogNo = () => {
    if (consentDialogMode === 'consent') {
      handleChange(FIELD_NAMES.SMS_CONSENT_DISCLOSURE, false);
    }
    setConsentDialogMode(null);
  };

  const REQUIRED_PHOTO_WIDTH = 700;
  const REQUIRED_PHOTO_HEIGHT = 700;

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEditAllFields) return;
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      if (img.naturalWidth === REQUIRED_PHOTO_WIDTH && img.naturalHeight === REQUIRED_PHOTO_HEIGHT) {
        setErrors((prev) => ({ ...prev, profilePhoto: undefined }));
        setPhotoPreviewUrlSafe(URL.createObjectURL(file));
        setPendingPhotoFile(file);
      } else {
        setErrors((prev) => ({ ...prev, profilePhoto: EMPLOYEE.ERRORS.PROFILE_PHOTO_DIMENSIONS }));
        dispatch(showToast(EMPLOYEE.ERRORS.PROFILE_PHOTO_DIMENSIONS, 'error', 5000));
        setPhotoPreviewUrlSafe(null);
        setPendingPhotoFile(null);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setErrors((prev) => ({ ...prev, profilePhoto: EMPLOYEE.ERRORS.PROFILE_PHOTO_DIMENSIONS }));
      dispatch(showToast(EMPLOYEE.ERRORS.PROFILE_PHOTO_DIMENSIONS, 'error', 5000));
      setPhotoPreviewUrlSafe(null);
      setPendingPhotoFile(null);
    };
    img.src = objectUrl;
  };

  const validateForm = (): boolean => {
    const newErrors: EmployeeFormErrors = {};

    if (errors.profilePhoto) {
      newErrors.profilePhoto = errors.profilePhoto;
    }

     if (!isDepartmentWizard && !formData.employeeTypeID.trim()) {
      newErrors.employeeTypeID = EMPLOYEE.ERRORS.EMPLOYEE_TYPE_REQUIRED;
    }

   if (!formData.firstName.trim()) {
    newErrors.firstName = EMPLOYEE.ERRORS.FIRST_NAME_REQUIRED;
  }

  if (!formData.lastName.trim()) {
    newErrors.lastName = EMPLOYEE.ERRORS.LAST_NAME_REQUIRED;
  }

  if (!isDepartmentWizard && !formData.statusID.trim()) {
    newErrors.statusID = EMPLOYEE.ERRORS.STATUS_REQUIRED;
  }

  if (
    !isDepartmentWizard &&
    (divisionsLoading || divisionOptions.length > 0) &&
    !formData.divisionID?.trim()
  ) {
    newErrors.divisionID = 'Division is required';
  }

  if (formData.hourlySalary == null || formData.hourlySalary <= 0) {
    newErrors.hourlySalary = 'Hourly salary is required';
  }

  // Account Information
  if (!formData.username.trim()) {
    newErrors.username = EMPLOYEE.ERRORS.USERNAME_REQUIRED;
  }

  // Password validation (create + edit / new password)
  // - In create mode: password is required
  // - In edit mode: password is optional, but if provided it must meet the same rules
  const trimmedPassword = (formData.password || '').trim();

  if (!initialData?.employeeID && !trimmedPassword) {
    newErrors.password = EMPLOYEE.ERRORS.PASSWORD_REQUIRED;
  } else if (trimmedPassword) {
    // Reuse login password rules for consistency (minimum length only)
    if (trimmedPassword.length < 6) {
      newErrors.password = LOGIN.ERRORS.PASSWORD_MIN_LENGTH;
    }
  }

  if (!formData.badgeNumber.trim()) {
    newErrors.badgeNumber = 'Badge number is required';
  }

  if (!formData.employeeNumber?.trim()) {
    newErrors.employeeNumber = EMPLOYEE.ERRORS.EMPLOYEE_NUMBER_REQUIRED;
  }

  // Contact Information
  if (!formData.primaryEmail.trim()) {
    newErrors.primaryEmail = 'Primary email is required';
  } else if (!validateEmail(formData.primaryEmail)) {
    newErrors.primaryEmail = EMPLOYEE.ERRORS.EMAIL_INVALID;
  }

  if (formData.secondaryEmail?.trim() && !validateEmail(formData.secondaryEmail)) {
    newErrors.secondaryEmail = EMPLOYEE.ERRORS.EMAIL_INVALID;
  }

  if (formData.offDutyCallBackEmail?.trim() && !validateEmail(formData.offDutyCallBackEmail)) {
    newErrors.offDutyCallBackEmail = EMPLOYEE.ERRORS.EMAIL_INVALID;
  }

  if (!formData.primaryPhone.trim()) {
    newErrors.primaryPhone = 'Primary phone is required';
  }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validateForm()) {
      return;
    }

    try {
      const afterEmployeeSkillBulkSave = async (saved: EmployeeSkillDto[], employeeId: string) => {
        if (saved.length > 0) {
          setEmployeeSkills((prev) => mergeEmployeeSkillsWithBulkResult(prev, saved));
        } else {
          setEmployeeSkills(await dispatch(fetchEmployeeSkills(employeeId)).unwrap());
        }
      };

      const hourlySalaryValue = formData.hourlySalary;
      if (initialData?.employeeID) {
        const updatedValues: Partial<EmployeeResponse> = {
          departmentID: formData.departmentID || initialData.departmentID,
          notifyWhenJobsPosted: formData.notifyWhenJobsPosted ?? true,
          notifyJobStartingIn24Hours: formData.notifyJobStartingIn24Hours ?? true,
          notifyJobStartingIn1Hour: formData.notifyJobStartingIn1Hour ?? true,
          employeeTypeID: formData.employeeTypeID,
          statusID: formData.statusID,
          badgeNumber: formData.badgeNumber,
          employeeNumber: formData.employeeNumber,
          firstName: formData.firstName,
          lastName: formData.lastName,
          username: formData.username,
          primaryPhone: unformatPhoneNumber(formData.primaryPhone),
          secondaryPhone: unformatPhoneNumber(formData.secondaryPhone || '')
            ? unformatPhoneNumber(formData.secondaryPhone || '')
            : null,
          offDutyCallBackPhoneNumber: unformatPhoneNumber(formData.offDutyCallBackPhoneNumber || '')
            ? unformatPhoneNumber(formData.offDutyCallBackPhoneNumber || '')
            : null,
          primaryEmail: formData.primaryEmail,
          secondaryEmail: formData.secondaryEmail || null,
          offDutyCallBackEmail: formData.offDutyCallBackEmail || null,
          isSubsidizedVehicle: formData.isSubsidizedVehicle ?? false,
          smsTelephoneNumber: joinSmsTelephoneNumber(
            formData.smsTelephoneRegion,
            formData.smsTelephoneNumber
          ),
          hasSmsConsent: formData.hasSmsConsent ?? false,
          hourlySalary: hourlySalaryValue,
          hrCostCenterCode: formData.hrCostCenterCode || null,
          divisionID: formData.divisionID || null,
          employeeDepartmentDefinedField1: formData.employeeDepartmentDefinedField1 || null,
          employeeDepartmentDefinedField2: formData.employeeDepartmentDefinedField2 || null,
          employeeDepartmentDefinedField3: formData.employeeDepartmentDefinedField3 || null,
          employeeDepartmentDefinedField4: formData.employeeDepartmentDefinedField4 || null,
          isApproved: formData.isApproved ?? null,
        };

        // Only send password when user actually entered one
        if (formData.password && formData.password.trim().length > 0) {
          updatedValues.password = formData.password;
        }

        const patchValues = !canEditAllFields
          ? (Object.fromEntries(
              Object.entries(updatedValues).filter(
                ([key]) =>
                  key === 'password' ||
                  key === 'departmentID' ||
                  key === 'offDutyCallBackPhoneNumber' ||
                  key === 'offDutyCallBackEmail' ||
                  key === 'isSubsidizedVehicle' ||
                  key === 'smsTelephoneNumber' ||
                  key === 'hasSmsConsent' ||
                  key === 'notifyWhenJobsPosted' ||
                  key === 'notifyJobStartingIn24Hours' ||
                  key === 'notifyJobStartingIn1Hour'
              )
            ) as Partial<EmployeeResponse>)
          : updatedValues;

        const hasEmployeeFieldChanges = Object.keys(patchValues).some((key) => {
          const newVal = (patchValues as Record<string, unknown>)[key];
          const oldVal = (initialData as unknown as Record<string, unknown>)[key];
          const newIsArray = Array.isArray(newVal);
          const oldIsArray = Array.isArray(oldVal);
          if (newIsArray || oldIsArray) {
            const a = (newVal as unknown[]) || [];
            const b = (oldVal as unknown[]) || [];
            if (a.length !== b.length) return true;
            for (let i = 0; i < a.length; i += 1) {
              if (a[i] !== b[i]) return true;
            }
            return false;
          }
          return newVal !== oldVal;
        });

        const hadSkillChangesBeforeSubmit =
          canEditAllFields &&
          (newSkillIds.size > 0 ||
            editedEmployeeSkillIds.size > 0 ||
            pendingDeletedEmployeeSkillIds.size > 0);

        const hadPendingPhoto = canEditAllFields && !!pendingPhotoFile;

        // If neither employee fields, skills, nor pending photo have changed, show "No changes" and stop.
        if (!hasEmployeeFieldChanges && !hadSkillChangesBeforeSubmit && !hadPendingPhoto) {
          dispatch(showToast('No changes to save.', 'info', 5000));
          return;
        }

        if (hasEmployeeFieldChanges) {
          await dispatch(
            patchEmployeeThunk({
              original: initialData,
              updatedValues: patchValues,
            })
          ).unwrap();
        }

        if (
          canEditAllFields &&
          initialData?.employeeID &&
          pendingDeletedEmployeeSkillIds.size > 0
        ) {
          const toDelete = [...pendingDeletedEmployeeSkillIds];
          try {
            for (const id of toDelete) {
              await dispatch(deleteEmployeeSkillThunk(id)).unwrap();
            }
          } catch (e) {
            console.error('Failed to delete employee skills on save', e);
            dispatch(showToast(EMPLOYEE.SKILLS.DELETE_PERSIST_FAILED, 'error', 5000));
            return;
          }
        }

        // Persist new and edited EmployeeSkill rows in one call (POST /EmployeeSkill/bulk)
        if (
          canEditAllFields &&
          initialData?.employeeID &&
          (newSkillIds.size > 0 || editedEmployeeSkillIds.size > 0)
        ) {
          const employeeID = initialData.employeeID;
          const skillBulk: EmployeeSkillDto[] = [];
          const skillIDs = formData.skillIDs || [];

          for (const skillId of skillIDs) {
            if (!newSkillIds.has(skillId)) continue;
            const existing = (employeeSkills || []).find(
              (es) => getSkillIdFromDto(es) === skillId
            );
            const startDate =
              skillStartDateOverrides[skillId] ?? (existing ? getStartFromDto(existing) : null);
            const endDate =
              skillEndDateOverrides[skillId] ?? (existing ? getEndFromDto(existing) : null);
            skillBulk.push({
              employeeID,
              skillId,
              startDate: startDate ?? null,
              endDate: endDate ?? null,
            });
          }

          for (const es of employeeSkills || []) {
            const employeeSkillId = employeeSkillIdFromDto(es);
            if (!employeeSkillId || !editedEmployeeSkillIds.has(employeeSkillId)) continue;
            const skillId = getSkillIdFromDto(es);
            if (!skillId) continue;
            const startDate =
              skillStartDateOverrides[skillId] ?? getStartFromDto(es);
            const endDate = skillEndDateOverrides[skillId] ?? getEndFromDto(es);
            skillBulk.push({
              employeeSkillId,
              employeeID,
              skillId,
              startDate: startDate ?? null,
              endDate: endDate ?? null,
            });
          }

          if (skillBulk.length > 0) {
            try {
              const saved = await dispatch(bulkUpsertEmployeeSkillsThunk(skillBulk)).unwrap();
              await afterEmployeeSkillBulkSave(saved, employeeID);
            } catch (e) {
              console.error('Failed to sync employee skills', e);
              dispatch(showToast('Employee updated but some skills could not be saved.', 'error', 5000));
            }
          }
        }

        // Reset tracking sets after a successful update
        setNewSkillIds(new Set());
        setEditedEmployeeSkillIds(new Set());
        setPendingDeletedEmployeeSkillIds(new Set());

        let photoUploadSucceeded = false;

        // Upload profile photo if one was selected
        if (hadPendingPhoto && pendingPhotoFile) {
          try {
            await uploadEmployeePhoto(initialData.employeeID, pendingPhotoFile);
            setPendingPhotoFile(null);
            photoUploadSucceeded = true;
            if (isSameEmployeeId(initialData.employeeID, user?.employeeID)) {
              dispatch(bumpProfilePhotoRefresh());
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to upload profile photo';
            dispatch(showToast(message, 'error', 5000));
          }
        }

        // If only skills or only profile photo changed (no employee field diffs), show a success toast here
        // so the user gets feedback. When employee fields also changed, the PATCH thunk already shows the success toast.
        if (
          !hasEmployeeFieldChanges &&
          (hadSkillChangesBeforeSubmit || (hadPendingPhoto && photoUploadSucceeded))
        ) {
          dispatch(showToast(EMPLOYEE.SUCCESS.EMPLOYEE_UPDATED, 'success'));
        }
      } else {
        // The department wizard creates the department here, then this employee.
        let setupDepartmentId = '';
        let wizardEmployeeTypeId = '';
        let wizardStatusId = '';
        let wizardDivisionId = '';
        const abandonSetup = async (message?: string) => {
          if (wizardResume || !setupDepartmentId || !abandonCreatedDepartment) return;
          await abandonCreatedDepartment(setupDepartmentId, message);
        };
        if (resolveDepartmentId) {
          saveWizardEmployee({
            form: formData,
            skillStartDateOverrides,
            skillEndDateOverrides,
          });
          try {
            setupDepartmentId = (await resolveDepartmentId()).trim();
          } catch (error) {
            clearWizardEmployee();
            if (typeof error === 'string') return;
            const message = error instanceof Error ? error.message : '';
            if (message) {
              setSubmitError(message);
              dispatch(showToast(message, 'error'));
            }
            return;
          }
          if (!setupDepartmentId) return;
          let defaultsReady = false;
          for (let attempt = 0; attempt < 3 && !defaultsReady; attempt += 1) {
            try {
              const [types, statuses, divisions] = await Promise.all([
                dispatch(fetchActiveEmployeeTypes({ departmentId: setupDepartmentId })).unwrap(),
                dispatch(fetchActiveEmployeeStatuses({ departmentId: setupDepartmentId })).unwrap(),
                dispatch(fetchActiveDepartmentDivisions({ departmentId: setupDepartmentId })).unwrap(),
              ]);
              wizardEmployeeTypeId = idByName(
                types,
                EMPLOYEE.FORM.DEFAULT_EMPLOYEE_TYPE,
                (type) => type.employeeTypeID,
                (type) => [type.employeeTypeShort, type.employeeTypeLong]
              );
              wizardStatusId = idByName(
                statuses,
                EMPLOYEE.FORM.DEFAULT_EMPLOYEE_STATUS,
                (status) => status.employeeStatusID,
                (status) => [status.statusShort, status.statusLong]
              );
              wizardDivisionId = idByName(
                divisions,
                EMPLOYEE.FORM.DEFAULT_DIVISION,
                (division) => division.divisionID,
                (division) => [division.divisionShort, division.divisionLong]
              );
              defaultsReady = Boolean(wizardEmployeeTypeId && wizardStatusId && wizardDivisionId);
            } catch {
              defaultsReady = false;
            }
            if (!defaultsReady && attempt < 2) {
              await new Promise((resolve) => window.setTimeout(resolve, 400));
            }
          }
          if (!wizardEmployeeTypeId || !wizardStatusId || !wizardDivisionId) {
            await abandonSetup(DEPARTMENT.WIZARD.DEFAULTS_NOT_FOUND);
            return;
          }
        }

        const currentDeptID = setupDepartmentId || formData.departmentID || departmentID || user?.departmentID || '';
        const employeesInDeptBefore = employees.filter((emp) => emp.departmentID === currentDeptID);
        const hadAnyEmployeeInDept = employeesInDeptBefore.length > 0;

        const payload: CreateEmployeeRequest = {
          departmentID: setupDepartmentId || formData.departmentID,
          employeeTypeID: wizardEmployeeTypeId || formData.employeeTypeID,
          statusID: wizardStatusId || formData.statusID,
          badgeNumber: formData.badgeNumber,
          employeeNumber: formData.employeeNumber,
          firstName: formData.firstName,
          lastName: formData.lastName,
          username: formData.username,
          password: formData.password,
          primaryPhone: unformatPhoneNumber(formData.primaryPhone),
          secondaryPhone: unformatPhoneNumber(formData.secondaryPhone || '') || '',
          offDutyCallBackPhoneNumber: unformatPhoneNumber(formData.offDutyCallBackPhoneNumber || '')
            ? unformatPhoneNumber(formData.offDutyCallBackPhoneNumber || '')
            : null,
          primaryEmail: formData.primaryEmail,
          secondaryEmail: formData.secondaryEmail,
          offDutyCallBackEmail: formData.offDutyCallBackEmail || null,
          isSubsidizedVehicle: formData.isSubsidizedVehicle ?? false,
          smsTelephoneNumber: joinSmsTelephoneNumber(
            formData.smsTelephoneRegion,
            formData.smsTelephoneNumber
          ),
          hasSmsConsent: formData.hasSmsConsent ?? false,
          notifyWhenJobsPosted: formData.notifyWhenJobsPosted ?? true,
          notifyJobStartingIn24Hours: formData.notifyJobStartingIn24Hours ?? true,
          notifyJobStartingIn1Hour: formData.notifyJobStartingIn1Hour ?? true,
          hourlySalary: hourlySalaryValue,
          hrCostCenterCode: formData.hrCostCenterCode || null,
          divisionID: wizardDivisionId || formData.divisionID || null,
          employeeDepartmentDefinedField1: formData.employeeDepartmentDefinedField1 || null,
          employeeDepartmentDefinedField2: formData.employeeDepartmentDefinedField2 || null,
          employeeDepartmentDefinedField3: formData.employeeDepartmentDefinedField3 || null,
          employeeDepartmentDefinedField4: formData.employeeDepartmentDefinedField4 || null,
          isApproved: formData.isApproved,
        };

        const findCreatedEmployee = async (departmentId: string) => {
          const listed = await dispatch(
            fetchEmployees({ departmentId, page: 1, pageSize: 100 })
          ).unwrap();
          const username = formData.username.trim().toLowerCase();
          return listed.data.find((emp) => (emp.username || '').trim().toLowerCase() === username);
        };

        const saveAdminRecords = async (
          savedEmployee: EmployeeResponse | undefined,
          targetEmployeeId: string,
          adminTypeId: string,
          departmentId: string | undefined,
          adminTypeRows: typeof adminTypes
        ) => {
          try {
            await createEmployeeAdmin({
              employeeID: targetEmployeeId,
              adminTypeID: adminTypeId,
            });
          } catch (adminError) {
            console.error('Failed to create employee admin record:', adminError);
          }
          try {
            const deptAdminType = adminTypeRows.find((type) => type.adminTypeID === adminTypeId);
            const derivedLong =
              formatLastNameCommaFirstName(
                savedEmployee?.firstName ?? formData.firstName,
                savedEmployee?.lastName ?? formData.lastName
              ) ||
              savedEmployee?.username ||
              savedEmployee?.badgeNumber ||
              '';
            await dispatch(
              upsertDepartmentAdminThunk({
                departmentAdminShort:
                  deptAdminType?.adminTypeShort || deptAdminType?.adminTypeLong || DEPARTMENT_ADMIN_SHORT,
                departmentAdminLong: derivedLong,
                departmentAdminStatus: true,
                adminTypeID: adminTypeId,
                employeeID: targetEmployeeId,
                departmentID: departmentId,
              })
            ).unwrap();
          } catch (deptAdminError) {
            console.error('Failed to create department admin record:', deptAdminError);
          }
        };

        let newEmployee: EmployeeResponse | undefined;
        try {
          newEmployee = await dispatch(upsertEmployeeThunk(payload)).unwrap();
        } catch (error) {
          if (wizardResume && setupDepartmentId) {
            try {
              newEmployee = await findCreatedEmployee(setupDepartmentId);
            } catch {
              newEmployee = undefined;
            }
          }
          if (!newEmployee) {
            await abandonSetup();
            throw error;
          }
        }

        let employeeId = (newEmployee?.employeeID || '').trim();
        if (setupDepartmentId && !employeeId) {
          try {
            employeeId = (await findCreatedEmployee(setupDepartmentId))?.employeeID?.trim() || '';
          } catch {
            employeeId = '';
          }
        }
        if (setupDepartmentId && employeeId) {
          let adminTypeRows = adminTypes;
          let adminTypeId = departmentAdminTypeID;
          if (!adminTypeId) {
            try {
              const loaded = await dispatch(fetchAdminTypes({ page: 1, pageSize: 1000 })).unwrap();
              adminTypeRows = loaded.data ?? [];
              const wanted = DEPARTMENT_ADMIN_SHORT.trim().toLowerCase();
              adminTypeId =
                adminTypeRows.find((type) => {
                  const short = (type.adminTypeShort || '').trim().toLowerCase();
                  const long = (type.adminTypeLong || '').trim().toLowerCase();
                  return short === wanted || long === wanted;
                })?.adminTypeID ?? '';
            } catch {
              adminTypeId = '';
            }
          }
          if (adminTypeId) {
            await saveAdminRecords(newEmployee, employeeId, adminTypeId, setupDepartmentId, adminTypeRows);
          }
        } else if (employeeId && !hadAnyEmployeeInDept && departmentAdminTypeID) {
          await saveAdminRecords(newEmployee, employeeId, departmentAdminTypeID, currentDeptID || undefined, adminTypes);
        }

        if (newEmployee?.employeeID && pendingPhotoFile) {
          try {
            await uploadEmployeePhoto(newEmployee.employeeID, pendingPhotoFile);
            setPendingPhotoFile(null);
            if (isSameEmployeeId(newEmployee.employeeID, user?.employeeID)) {
              dispatch(bumpProfilePhotoRefresh());
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to upload profile photo';
            dispatch(showToast(message, 'error', 5000));
          }
        }

        // Backend no longer accepts EmployeeDto.skillIDs; persist skill date ranges via EmployeeSkill bulk API.
        if (newEmployee?.employeeID) {
          const skillIDsToCreate = formData.skillIDs || [];
          if (skillIDsToCreate.length > 0) {
            try {
              const dtos: EmployeeSkillDto[] = skillIDsToCreate.map((skillId) => ({
                employeeID: newEmployee.employeeID,
                skillId,
                startDate: skillStartDateOverrides[skillId] ?? null,
                endDate: skillEndDateOverrides[skillId] ?? null,
              }));
              const saved = await dispatch(bulkUpsertEmployeeSkillsThunk(dtos)).unwrap();
              await afterEmployeeSkillBulkSave(saved, newEmployee.employeeID);
            } catch (e) {
              console.error('Failed to persist employee skills after create', e);
              dispatch(showToast('Employee created, but some skills could not be saved.', 'error', 5000));
            }
          }
        }
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      // Extract error message
      let errorMessage = '';
      if (typeof error === 'string') {
        errorMessage = error;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }

      const normalizedMessage = (errorMessage || '').toLowerCase();

      // If backend reports a password-specific error (e.g. minimum length),
      // surface it directly on the password / new password field.
      if (normalizedMessage.includes('password')) {
        setErrors((prev) => ({
          ...prev,
          password: errorMessage || 'Invalid password',
        }));
      }

      // Check if error is about employee already existing
      const isEmployeeExistsError =
        normalizedMessage.includes('employee already exists') ||
        normalizedMessage.includes('already exists') ||
        (normalizedMessage.includes('username') && normalizedMessage.includes('badge number')) ||
        normalizedMessage.includes('duplicate');

      if (isEmployeeExistsError) {
        // Show toast for employee already exists error
        dispatch(
          showToast(
            'Employee already exists with the same username or badge number.',
            'error',
            5000
          )
        );
        // Also set form error
        setSubmitError('Employee already exists with the same username or badge number.');
      } else if (!normalizedMessage.includes('password')) {
        // For non-password-related errors, show generic submit failure message.
        setSubmitError(EMPLOYEE.ERRORS.SUBMIT_FAILED);
      }
    }
  };

  const submitRef = useRef(handleSubmit);
  submitRef.current = handleSubmit;
  useEffect(() => {
    if (!wizardResume) return;
    const timer = window.setTimeout(() => {
      void submitRef.current({ preventDefault() {} } as React.FormEvent);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [wizardResume]);

  const isEditMode = Boolean(initialData?.employeeID);
  const fieldDisabled = isLoading || !canEditAllFields;

  const {
    employeeType: employeeTypeDropdownOptions,
    status: employeeStatusDropdownOptions,
    division: divisionDropdownOptions,
  } = useMemo(
    () => ({
      employeeType: dropdownOptions(
        isDepartmentWizard,
        EMPLOYEE.FORM.DEFAULT_EMPLOYEE_TYPE,
        isEditMode,
        employeeTypeOptions,
        EMPLOYEE.FORM.EMPLOYEE_TYPE_PLACEHOLDER
      ),
      status: dropdownOptions(
        isDepartmentWizard,
        EMPLOYEE.FORM.DEFAULT_EMPLOYEE_STATUS,
        isEditMode,
        employeeStatusOptions,
        EMPLOYEE.FORM.STATUS_PLACEHOLDER
      ),
      division: dropdownOptions(
        isDepartmentWizard,
        EMPLOYEE.FORM.DEFAULT_DIVISION,
        isEditMode,
        divisionOptions,
        EMPLOYEE.FORM.DIVISION_PLACEHOLDER
      ),
    }),
    [
      isDepartmentWizard,
      isEditMode,
      employeeTypeOptions,
      employeeStatusOptions,
      divisionOptions,
    ]
  );

  const openAddSkillModal = () => {
    if (!canEditAllFields) return;
    setIsSkillModalOpen(true);
  };

  // Add a new skill via the Add Skill modal (persists via EmployeeSkill API in edit mode)
  const handleAddSkill = async () => {
    const trimmed = (selectedSkillId || '').trim();
    if (!trimmed) {
      setSkillAddError('Please select a skill.');
      return;
    }

    if (!skillStartDateInput || !skillEndDateInput) {
      setSkillAddError('Start Date and End Date are required.');
      return;
    }

    // Block adding when there is any active instance of this skill (from API) or
    // an active unsaved new row (API has not returned isActive for it yet)
    const getSid = (es: { skillId?: string; SkillId?: string; skillID?: string; SkillID?: string }) =>
      es.skillId ?? es.SkillId ?? es.skillID ?? es.SkillID ?? null;
    const hasActiveInstance =
      (employeeSkills || []).some((es) => {
        if (getSid(es) !== trimmed) return false;
        return (es.isActive ?? (es as { IsActive?: boolean }).IsActive) !== false;
      }) ||
      (formData.skillIDs || []).some((id) => {
        if (id !== trimmed) return false;
        const range = skillDateRanges[id] || {};
        const effectiveEnd =
          skillEndDateOverrides[id] ?? range.endDate ?? null;
        return !isEndDateExpired(effectiveEnd);
      });

    if (hasActiveInstance) {
      setSkillAddError('This skill is already active. You can add it again only after its End Date.');
      return;
    }

    setSkillAddError(null);

    setFormData((prev) => {
      const existing = prev.skillIDs || [];
      if (existing.includes(trimmed)) {
        return prev;
      }
      return {
        ...prev,
        skillIDs: [...existing, trimmed],
      };
    });

    setSkillStartDateOverrides((prev) => ({
      ...prev,
      [trimmed]: skillStartDateInput || null,
    }));
    setSkillEndDateOverrides((prev) => ({
      ...prev,
      [trimmed]: skillEndDateInput || null,
    }));

    // Mark as new so when the employee is saved in edit mode,
    // this skill is created as a new EmployeeSkill record (no EmployeeSkillID).
    if (initialData?.employeeID) {
      setNewSkillIds((prev) => {
        const next = new Set(prev);
        next.add(trimmed);
        return next;
      });
    }

    // In edit mode, skills are persisted only when the user clicks the main Update button.
    // No API call here.

    setIsSkillModalOpen(false);
    setEditingSkillId(null);
    setSelectedSkillId('');
    setSkillStartDateInput('');
    setSkillEndDateInput('');
  };

  // Update only the End Date for an existing skill from the edit modal
  const handleUpdateSkillEndDate = async () => {
    if (!editingSkillId) return;
    const nextStart =
      (skillStartDateInput && skillStartDateInput.trim()) ||
      skillStartDateOverrides[editingSkillId] ||
      (skillDateRanges[editingSkillId]?.startDate ?? null) ||
      null;

    const nextEnd =
      (skillEndDateInput && skillEndDateInput.trim()) ||
      skillEndDateOverrides[editingSkillId] ||
      (skillDateRanges[editingSkillId]?.endDate ?? null) ||
      null;

    if (!nextStart || !nextEnd) {
      setSkillAddError('Start Date and End Date are required.');
      return;
    }

    setSkillStartDateOverrides((prev) => ({
      ...prev,
      [editingSkillId]: nextStart,
    }));

    setSkillEndDateOverrides((prev) => ({
      ...prev,
      [editingSkillId]: nextEnd,
    }));

    // Mark this EmployeeSkill row as edited so it will be persisted
    // when the user clicks the main Update button.
    if (initialData?.employeeID && editingEmployeeSkillId) {
      setEditedEmployeeSkillIds((prev) => {
        const next = new Set(prev);
        next.add(editingEmployeeSkillId);
        return next;
      });
    }

    setIsSkillModalOpen(false);
    setEditingSkillId(null);
    setEditingEmployeeSkillId(null);
    setSkillStartDateInput('');
    setSkillEndDateInput('');
  };

  // Map skill ID -> { startDate, endDate } using EmployeeSkill API response
  const skillDateRanges = useMemo(() => {
    const map: Record<string, { startDate?: string | null; endDate?: string | null }> = {};
    (employeeSkills || []).forEach((es: any) => {
      const id =
        es.skillId ??
        es.SkillId ??
        es.skillID ??
        es.SkillID ??
        null;
      if (!id) return;
      // Support both camelCase and PascalCase from backend
      const start = es.startDate ?? es.StartDate ?? null;
      const end = es.endDate ?? es.EndDate ?? null;
      map[id] = {
        startDate: start,
        endDate: end,
      };
    });
    return map;
  }, [employeeSkills]);

  /** Add/Edit Skill modal: end date is enabled only when a start date exists (entered or loaded for edit). */
  const skillModalEffectiveStart = useMemo(() => {
    const fromInput = String(skillStartDateInput || '').trim();
    if (fromInput) return fromInput;
    if (editingSkillId && skillDateRanges[editingSkillId]?.startDate) {
      return String(skillDateRanges[editingSkillId].startDate).slice(0, 10).trim();
    }
    return '';
  }, [skillStartDateInput, editingSkillId, skillDateRanges]);

  const getSkillIdFromDto = (es: any): string | null =>
    es.skillId ?? es.SkillId ?? es.skillID ?? es.SkillID ?? null;

  const getStartFromDto = (es: any): string | null =>
    es.startDate ?? es.StartDate ?? null;

  const getEndFromDto = (es: any): string | null =>
    es.endDate ?? es.EndDate ?? null;

  /**
   * Returns a Date object normalised to midnight local time, using only the date
   * portion of the input (ignores any time / timezone offsets from the API).
   */
  const toDateOnly = (value: string | null | undefined): Date | null => {
    if (!value) return null;
    const datePart = String(value).slice(0, 10); // YYYY-MM-DD
    if (!datePart) return null;
    const d = new Date(`${datePart}T00:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const formatSkillDate = (value?: string | null): string => {
    if (!value) return '-';
    const d = toDateOnly(value);
    if (d) {
      return formatDateShort(d);
    }
    const parsed = new Date(String(value).trim());
    if (Number.isNaN(parsed.getTime())) return '-';
    return formatDateShort(parsed) || '-';
  };

  const removeFromEmployeeSkillList = (
    list: EmployeeSkillDto[],
    row: EmployeeSkillRow
  ): EmployeeSkillDto[] => {
    if (row.employeeSkillId.startsWith('temp-')) {
      return list;
    }
    if (row.employeeSkillId.startsWith('emp-skill-')) {
      return list.filter((es) => {
        if (employeeSkillIdFromDto(es)) return true;
        return !(
          getSkillIdFromDto(es) === row.skillId &&
          getStartFromDto(es) === row.startDate &&
          getEndFromDto(es) === row.endDate
        );
      });
    }
    return list.filter((es) => (employeeSkillIdFromDto(es) || '') !== row.employeeSkillId);
  };

  const [skillStatusFilter, setSkillStatusFilter] = useState<'active' | 'inactive'>('active');

  /**
   * A skill is considered expired/inactive when its EndDate is strictly before today.
   * EndDate today or in the future is treated as active.
   */
  const isEndDateExpired = (end: string | null | undefined): boolean => {
    const endDate = toDateOnly(end);
    if (!endDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return endDate < today;
  };

  const skillRows: EmployeeSkillRow[] = useMemo(() => {
    const rows: EmployeeSkillRow[] = [];

    // 1) Existing EmployeeSkill records from backend
    (employeeSkills || []).forEach((es: any, index: number) => {
      const skillId = getSkillIdFromDto(es);
      if (!skillId) return;

      const employeeSkillId =
        employeeSkillIdFromDto(es) || `emp-skill-${skillId}-${index}`;

      const a = es.isActive ?? es.IsActive;
      const isRowActive = a !== false;

      rows.push({
        employeeSkillId,
        skillId,
        skillShort: es.skillshort ?? es.skillShort ?? es.SkillShort ?? null,
        startDate: getStartFromDto(es),
        endDate: getEndFromDto(es),
        isActive: isRowActive,
      });
    });

    // 2) Newly added (unsaved) skills - show them as separate rows
    (formData.skillIDs || []).forEach((skillId, index) => {
      // In edit mode, only show skills that are newly added (in newSkillIds)
      // In create mode, show all skills since there are no existing employee skills
      if (isEditMode && !newSkillIds.has(skillId)) return;

      const tempId = `temp-${skillId}-${index}`;
      rows.push({
        employeeSkillId: tempId,
        skillId,
        startDate: skillStartDateOverrides[skillId] ?? null,
        endDate: skillEndDateOverrides[skillId] ?? null,
        isActive: true,
      });
    });

    // Sort so active skills stay at the top
    rows.sort((a, b) => {
      if (a.isActive === b.isActive) return 0;
      return a.isActive ? -1 : 1;
    });

    return rows;
  }, [
    employeeSkills,
    formData.skillIDs,
    newSkillIds,
    skillStartDateOverrides,
    skillEndDateOverrides,
  ]);

  const activeSkillRows = useMemo(
    () => skillRows.filter((row) => row.isActive),
    [skillRows]
  );

  const inactiveSkillRows = useMemo(
    () => skillRows.filter((row) => !row.isActive),
    [skillRows]
  );

  // Skill IDs that are currently active — hide these from the Add dropdown
  const activeSkillIdsSet = useMemo(() => {
    const set = new Set<string>();
    skillRows.forEach((row) => {
      if (row.isActive) {
        set.add(row.skillId);
      }
    });
    return set;
  }, [skillRows]);

  const skillOptionsForDropdown = useMemo(() => {
    const base = skillOptions.filter((opt) => !activeSkillIdsSet.has(opt.value));
    if (!isDepartmentAdminEditingSelf) return base;
    return base.filter((opt) => !skillIdIsSuspended(opt.value, activeSkills));
  }, [skillOptions, activeSkillIdsSet, isDepartmentAdminEditingSelf, activeSkills]);

  // Edit modal must list the skill being edited; otherwise the dropdown has no matching
  // option for an active assignment and shows the raw skillId (UUID).
  const skillModalSkillOptions = useMemo(() => {
    if (!editingSkillId) return skillOptionsForDropdown;
    const base = skillOptions.filter(
      (opt) => !activeSkillIdsSet.has(opt.value) || opt.value === editingSkillId
    );
    if (!isDepartmentAdminEditingSelf) return base;
    return base.filter(
      (opt) => !skillIdIsSuspended(opt.value, activeSkills) || opt.value === editingSkillId
    );
  }, [
    editingSkillId,
    skillOptions,
    skillOptionsForDropdown,
    activeSkillIdsSet,
    isDepartmentAdminEditingSelf,
    activeSkills,
  ]);

  const requestDeleteSkillRow = (row: EmployeeSkillRow) => {
    setEmployeeSkillRowPendingDelete(row);
  };

  const handleConfirmDeleteSkill = () => {
    const row = employeeSkillRowPendingDelete;
    if (!row) return;
    setEmployeeSkillRowPendingDelete(null);
    executeDeleteSkillRow(row);
  };

  const handleCloseDeleteSkillDialog = () => {
    setEmployeeSkillRowPendingDelete(null);
  };

  const executeDeleteSkillRow = (row: EmployeeSkillRow) => {
    if (editingEmployeeSkillId === row.employeeSkillId) {
      setIsSkillModalOpen(false);
      setEditingSkillId(null);
      setEditingEmployeeSkillId(null);
      setSelectedSkillId('');
      setSkillStartDateInput('');
      setSkillEndDateInput('');
    }

    if (row.employeeSkillId.startsWith('temp-')) {
      const { skillId } = row;
      setFormData((prev) => ({
        ...prev,
        skillIDs: (prev.skillIDs || []).filter((id) => id !== skillId),
      }));
      setNewSkillIds((prev) => {
        const next = new Set(prev);
        next.delete(skillId);
        return next;
      });
      setSkillStartDateOverrides((prev) => {
        const c = { ...prev };
        delete c[skillId];
        return c;
      });
      setSkillEndDateOverrides((prev) => {
        const c = { ...prev };
        delete c[skillId];
        return c;
      });
      dispatch(showToast(EMPLOYEE.SKILLS.REMOVED_TOAST, 'success', 4000));
      return;
    }

    const isSynthetic = row.employeeSkillId.startsWith('emp-skill-');
    if (!isSynthetic) {
      setPendingDeletedEmployeeSkillIds((prev) => {
        const next = new Set(prev);
        next.add(row.employeeSkillId);
        return next;
      });
    }

    const nextEs = removeFromEmployeeSkillList(employeeSkillsRef.current, row);
    setEmployeeSkills(nextEs);
    setFormData((fd) => {
      const { skillId } = row;
      const ids = fd.skillIDs || [];
      if (!ids.includes(skillId)) return fd;
      const hasApi = nextEs.some((es) => getSkillIdFromDto(es) === skillId);
      if (hasApi) return fd;
      if (isEditMode && newSkillIds.has(skillId)) return fd;
      return { ...fd, skillIDs: ids.filter((x) => x !== skillId) };
    });

    setEditedEmployeeSkillIds((prev) => {
      if (isSynthetic) return prev;
      const next = new Set(prev);
      next.delete(row.employeeSkillId);
      return next;
    });
  };

  const skillColumns: DataTableColumn<EmployeeSkillRow>[] = [
    {
      key: 'skillId',
      label: 'Skill',
      render: (_val: string, row) =>
        row.skillShort?.trim() || skillLabelById.get(String(row.skillId)) || '-',
    },
    {
      key: 'startDate',
      label: 'Start Date',
      render: (val: string | null | undefined) => formatSkillDate(val),
    },
    {
      key: 'endDate',
      label: 'End Date',
      render: (val: string | null | undefined) => formatSkillDate(val),
    },
    {
      key: 'action',
      label: 'Action',
      render: (_, row) => (
        <SMSDataTableActions
          onEdit={
            canEditAllFields && row.isActive
              ? () => {
                  setEditingSkillId(row.skillId);
                  setEditingEmployeeSkillId(row.employeeSkillId);
                  setSelectedSkillId(row.skillId);
                  const effectiveStart =
                    skillStartDateOverrides[row.skillId] ??
                    skillDateRanges[row.skillId]?.startDate ??
                    null;
                  const effectiveEnd =
                    skillEndDateOverrides[row.skillId] ??
                    skillDateRanges[row.skillId]?.endDate ??
                    '';
                  setSkillStartDateInput(
                    effectiveStart ? String(effectiveStart).slice(0, 10) : ''
                  );
                  setSkillEndDateInput(
                    effectiveEnd ? String(effectiveEnd).slice(0, 10) : ''
                  );
                  setIsSkillModalOpen(true);
                }
              : undefined
          }
          onDelete={
            canEditAllFields
              ? () => {
                  requestDeleteSkillRow(row);
                }
              : undefined
          }
          editLabel="Edit"
          deleteLabel={EMPLOYEE.SKILLS.DELETE}
        />
      ),
    },
  ];

  return (
    <SMSBox className={`app-form employee-form ${className}`}>
      <form onSubmit={handleSubmit} className="app-form__form" noValidate>
        {/* Basic Information Section */}
        <SMSBox className="app-form__section">
          <SMSBox className="app-form__section-title app-form__full-width" style={{ marginBottom: 0 }}>
            <SMSBox
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
              }}
            >
              <span>Basic Information</span>
              <SMSSwitch
                label="Active"
                checked={formData.isApproved ?? true}
                onChange={(e) => handleChange('isApproved', e.target.checked)}
                disabled={fieldDisabled}
              />
            </SMSBox>
          </SMSBox>
          <SMSBox className="app-form__flex-row">
            <SMSTextField
              type="text"
              label={EMPLOYEE.FORM.FIRST_NAME}
              value={formData.firstName}
              onChange={(e) => handleChange(FIELD_NAMES.FIRST_NAME, e.target.value)}
              placeholder={EMPLOYEE.FORM.FIRST_NAME_PLACEHOLDER}
              error={Boolean(errors.firstName)}
              helperText={errors.firstName}
              name={FIELD_NAMES.FIRST_NAME}
              id={FIELD_NAMES.FIRST_NAME}
              disabled={fieldDisabled}
              required
            />

            <SMSTextField
              type="text"
              label={EMPLOYEE.FORM.LAST_NAME}
              value={formData.lastName}
              onChange={(e) => handleChange(FIELD_NAMES.LAST_NAME, e.target.value)}
              placeholder={EMPLOYEE.FORM.LAST_NAME_PLACEHOLDER}
              error={Boolean(errors.lastName)}
              helperText={errors.lastName}
              name={FIELD_NAMES.LAST_NAME}
              id={FIELD_NAMES.LAST_NAME}
              disabled={fieldDisabled}
              required
            />

            <SMSDropdown
              label={EMPLOYEE.FORM.EMPLOYEE_TYPE}
              options={employeeTypeDropdownOptions}
              value={isDepartmentWizard ? EMPLOYEE.FORM.DEFAULT_EMPLOYEE_TYPE : formData.employeeTypeID || ''}
              onChange={(e) => handleChange(FIELD_NAMES.EMPLOYEE_TYPE_ID, String(e.target.value))}
              placeholder={EMPLOYEE.FORM.EMPLOYEE_TYPE_PLACEHOLDER}
              disabled={fieldDisabled || isDepartmentWizard}
              name={FIELD_NAMES.EMPLOYEE_TYPE_ID}
              id={FIELD_NAMES.EMPLOYEE_TYPE_ID}
              required
            />

            <SMSDropdown
              label={EMPLOYEE.FORM.STATUS}
              options={employeeStatusDropdownOptions}
              value={isDepartmentWizard ? EMPLOYEE.FORM.DEFAULT_EMPLOYEE_STATUS : formData.statusID || ''}
              onChange={(e) => handleChange(FIELD_NAMES.STATUS_ID, String(e.target.value))}
              placeholder={EMPLOYEE.FORM.STATUS_PLACEHOLDER}
              disabled={fieldDisabled || isDepartmentWizard}
              error={Boolean(errors.statusID)}
              helperText={errors.statusID}
              name={FIELD_NAMES.STATUS_ID}
              id={FIELD_NAMES.STATUS_ID}
              required
            />
          </SMSBox>

          <SMSBox className="app-form__flex-row">
            <SMSDropdown
              label={EMPLOYEE.FORM.DIVISION}
              options={divisionDropdownOptions}
              value={isDepartmentWizard ? EMPLOYEE.FORM.DEFAULT_DIVISION : formData.divisionID || ''}
              onChange={(e) => handleChange(FIELD_NAMES.DIVISION_ID, String(e.target.value))}
              placeholder={EMPLOYEE.FORM.DIVISION_PLACEHOLDER}
              disabled={fieldDisabled || divisionsLoading || isDepartmentWizard}
              name={FIELD_NAMES.DIVISION_ID}
              id={FIELD_NAMES.DIVISION_ID}
              required={divisionsLoading || divisionOptions.length > 0}
              error={Boolean(errors.divisionID)}
              helperText={errors.divisionID}
            />
            <SMSCurrencyInput
              label={EMPLOYEE.FORM.HOURLY_SALARY}
              value={formData.hourlySalary}
              onChange={(value) => handleChange(FIELD_NAMES.HOURLY_SALARY, value)}
              placeholder={EMPLOYEE.FORM.HOURLY_SALARY_PLACEHOLDER}
              name={FIELD_NAMES.HOURLY_SALARY}
              id={FIELD_NAMES.HOURLY_SALARY}
              disabled={fieldDisabled}
              error={Boolean(errors.hourlySalary)}
              helperText={errors.hourlySalary}
              required
            />

            <SMSTextField
              type="text"
              label={EMPLOYEE.FORM.HR_COST_CENTER_CODE}
              value={formData.hrCostCenterCode || ''}
              onChange={(e) => handleChange(FIELD_NAMES.HR_COST_CENTER_CODE, e.target.value)}
              placeholder={EMPLOYEE.FORM.HR_COST_CENTER_CODE_PLACEHOLDER}
              name={FIELD_NAMES.HR_COST_CENTER_CODE}
              id={FIELD_NAMES.HR_COST_CENTER_CODE}
              disabled={fieldDisabled}
              required
            />

            <SMSTextField
              type="text"
              label={EMPLOYEE.FORM.EMPLOYEE_NUMBER}
              value={formData.employeeNumber}
              onChange={(e) => {
                const value = e.target.value;
                setFormData((prev) => ({
                  ...prev,
                  employeeNumber: value,
                  badgeNumber: value,
                }));
                if (errors.employeeNumber || errors.badgeNumber) {
                  setErrors((prev) => ({
                    ...prev,
                    employeeNumber: undefined,
                    badgeNumber: undefined,
                  }));
                }
              }}
              placeholder={EMPLOYEE.FORM.EMPLOYEE_NUMBER_PLACEHOLDER}
              name={FIELD_NAMES.EMPLOYEE_NUMBER}
              id={FIELD_NAMES.EMPLOYEE_NUMBER}
              disabled={fieldDisabled}
              required
              error={Boolean(errors.employeeNumber)}
              helperText={errors.employeeNumber}
            />
          </SMSBox>
        </SMSBox>

        {/* Account & Contact Information Section */}
        <SMSBox className="app-form__section">
          <SMSBox className="app-form__section-title">Account &amp; Contact Information</SMSBox>
          <SMSBox className="app-form__flex-row">
            <SMSTextField
              type="text"
              label={EMPLOYEE.FORM.USERNAME}
              value={formData.username}
              onChange={(e) => handleChange(FIELD_NAMES.USERNAME, e.target.value)}
              placeholder={EMPLOYEE.FORM.USERNAME_PLACEHOLDER}
              error={Boolean(errors.username)}
              helperText={errors.username}
              name={FIELD_NAMES.USERNAME}
              id={FIELD_NAMES.USERNAME}
              disabled={fieldDisabled}
              required
            />

            {!isEditMode && (
              <SMSTextField
                type="password"
                label={EMPLOYEE.FORM.PASSWORD}
                value={formData.password}
                onChange={(e) => handleChange(FIELD_NAMES.PASSWORD, e.target.value)}
                placeholder={EMPLOYEE.FORM.PASSWORD_PLACEHOLDER}
                error={Boolean(errors.password)}
                helperText={errors.password}
                name={FIELD_NAMES.PASSWORD}
                id={FIELD_NAMES.PASSWORD}
                disabled={isLoading}
                required
              />
            )}

            {isEditMode && (
              <SMSTextField
                type="password"
                label="New password"
                value={formData.password}
                onChange={(e) => handleChange(FIELD_NAMES.PASSWORD, e.target.value)}
                placeholder="Leave blank to keep current password"
                error={Boolean(errors.password)}
                helperText={errors.password}
                name="newPassword"
                id="newPassword"
                disabled={isLoading}
              />
            )}

            <SMSTextField
              type="text"
              label={EMPLOYEE.FORM.BADGE_NUMBER}
              value={formData.badgeNumber}
              placeholder={EMPLOYEE.FORM.BADGE_NUMBER_PLACEHOLDER}
              name={FIELD_NAMES.BADGE_NUMBER}
              id={FIELD_NAMES.BADGE_NUMBER}
              disabled
              required
              error={Boolean(errors.badgeNumber)}
              helperText={errors.badgeNumber}
            />
          </SMSBox>

          <SMSBox className="app-form__flex-row">
            <SMSTextField
              type="email"
              label={EMPLOYEE.FORM.PRIMARY_EMAIL}
              value={formData.primaryEmail}
              onChange={(e) => handleChange(FIELD_NAMES.PRIMARY_EMAIL, e.target.value)}
              placeholder={EMPLOYEE.FORM.PRIMARY_EMAIL_PLACEHOLDER}
              error={Boolean(errors.primaryEmail)}
              helperText={errors.primaryEmail}
              name={FIELD_NAMES.PRIMARY_EMAIL}
              id={FIELD_NAMES.PRIMARY_EMAIL}
              disabled={fieldDisabled}
              required
            />

            <SMSTextField
              type="tel"
              label={EMPLOYEE.FORM.PRIMARY_PHONE}
              value={formData.primaryPhone}
              onChange={(e) => handleChange(FIELD_NAMES.PRIMARY_PHONE, formatPhoneNumber(e.target.value))}
              placeholder={EMPLOYEE.FORM.PRIMARY_PHONE_PLACEHOLDER}
              name={FIELD_NAMES.PRIMARY_PHONE}
              id={FIELD_NAMES.PRIMARY_PHONE}
              disabled={fieldDisabled}
              required
              error={Boolean(errors.primaryPhone)}
              helperText={errors.primaryPhone}
            />

            <SMSTextField
              type="tel"
              label={EMPLOYEE.FORM.SECONDARY_PHONE}
              value={formData.secondaryPhone}
              onChange={(e) => handleChange(FIELD_NAMES.SECONDARY_PHONE, formatPhoneNumber(e.target.value))}
              placeholder={EMPLOYEE.FORM.SECONDARY_PHONE_PLACEHOLDER}
              name={FIELD_NAMES.SECONDARY_PHONE}
              id={FIELD_NAMES.SECONDARY_PHONE}
              disabled={fieldDisabled}
            />

            <SMSTextField
              type="email"
              label={EMPLOYEE.FORM.SECONDARY_EMAIL}
              value={formData.secondaryEmail}
              onChange={(e) => handleChange(FIELD_NAMES.SECONDARY_EMAIL, e.target.value)}
              placeholder={EMPLOYEE.FORM.SECONDARY_EMAIL_PLACEHOLDER}
              helperText={errors.secondaryEmail}
              error={Boolean(errors.secondaryEmail)}
              name={FIELD_NAMES.SECONDARY_EMAIL}
              id={FIELD_NAMES.SECONDARY_EMAIL}
              disabled={fieldDisabled}
            />
          </SMSBox>
        </SMSBox>

        <SMSBox className="app-form__section">
          <SMSBox className="app-form__section-title app-form__full-width" style={{ marginBottom: 0 }}>
            <SMSBox
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
              }}
            >
              <span>Off-Duty Call Back Details</span>
              <SMSSwitch
                label={EMPLOYEE.FORM.IS_SUBSIDIZED_VEHICLE}
                checked={formData.isSubsidizedVehicle ?? false}
                onChange={(e) => handleChange(FIELD_NAMES.IS_SUBSIDIZED_VEHICLE, e.target.checked)}
                disabled={isLoading}
              />
            </SMSBox>
          </SMSBox>
          <SMSBox className="app-form__flex-row">
            <SMSTextField
              type="tel"
              label={EMPLOYEE.FORM.OFF_DUTY_CALLBACK_PHONE}
              value={formData.offDutyCallBackPhoneNumber || ''}
              onChange={(e) =>
                handleChange(FIELD_NAMES.OFF_DUTY_CALLBACK_PHONE_NUMBER, formatPhoneNumber(e.target.value))
              }
              placeholder={EMPLOYEE.FORM.OFF_DUTY_CALLBACK_PHONE_PLACEHOLDER}
              name={FIELD_NAMES.OFF_DUTY_CALLBACK_PHONE_NUMBER}
              id={FIELD_NAMES.OFF_DUTY_CALLBACK_PHONE_NUMBER}
              disabled={isLoading}
            />
            <SMSTextField
              type="email"
              label={EMPLOYEE.FORM.OFF_DUTY_CALLBACK_EMAIL}
              value={formData.offDutyCallBackEmail || ''}
              onChange={(e) => handleChange(FIELD_NAMES.OFF_DUTY_CALLBACK_EMAIL, e.target.value)}
              placeholder={EMPLOYEE.FORM.OFF_DUTY_CALLBACK_EMAIL_PLACEHOLDER}
              error={Boolean(errors.offDutyCallBackEmail)}
              helperText={errors.offDutyCallBackEmail}
              name={FIELD_NAMES.OFF_DUTY_CALLBACK_EMAIL}
              id={FIELD_NAMES.OFF_DUTY_CALLBACK_EMAIL}
              disabled={isLoading}
            />
          </SMSBox>
        </SMSBox>

        <SMSBox className="app-form__section">
          <SMSBox className="app-form__section-title app-form__full-width">
            <span>{EMPLOYEE.NOTIFICATIONS.SECTION_TITLE}</span>
          </SMSBox>
          <SMSBox className="employee-form__notifications app-form__full-width">
            <div className="employee-form__sms-consent-row">
              <div className="employee-form__sms-number-group">
                <MuiTelInput
                  label={EMPLOYEE.NOTIFICATIONS.SMS_TELEPHONE_NUMBER}
                  value={formData.smsTelephoneInput || ''}
                  defaultCountry="US"
                  forceCallingCode
                  preferredCountries={['US', 'CA', 'IN', 'GB']}
                  onChange={handleSmsTelephoneChange}
                  error={Boolean(errors.smsTelephoneNumber)}
                  helperText={errors.smsTelephoneNumber}
                  placeholder={EMPLOYEE.NOTIFICATIONS.SMS_TELEPHONE_NUMBER_PLACEHOLDER}
                  disabled={isLoading}
                  size="small"
                  fullWidth
                  sx={{ marginTop: 1 }}
                  name={FIELD_NAMES.SMS_TELEPHONE_NUMBER}
                  id={FIELD_NAMES.SMS_TELEPHONE_NUMBER}
                  className="employee-form__sms-telephone"
                />
              </div>
              <div className="app-form__form-checkbox employee-form__sms-consent-checkbox">
                <SMSCheckbox
                  label={
                    <a
                      href="#consent-disclosure"
                      className="employee-form__consent-link"
                      aria-label={EMPLOYEE.NOTIFICATIONS.CONSENT_DISCLOSURE_LINK_ARIA}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setConsentDialogMode('review');
                      }}
                    >
                      {EMPLOYEE.NOTIFICATIONS.CONSENT_DISCLOSURE_LINK}
                    </a>
                  }
                  checked={formData.hasSmsConsent ?? false}
                  onChange={handleSmsConsentToggle}
                  disabled={isLoading}
                />
              </div>
            </div>
            <div className="app-form__checkboxes employee-form__notifications-row">
              <div className="app-form__form-checkbox">
                <SMSCheckbox
                  label={EMPLOYEE.NOTIFICATIONS.WHEN_JOBS_POSTED}
                  checked={formData.notifyWhenJobsPosted ?? true}
                  onChange={(checked) => handleChange(FIELD_NAMES.NOTIFY_WHEN_JOBS_POSTED, checked)}
                  disabled={isLoading}
                />
              </div>
              <div className="app-form__form-checkbox">
                <SMSCheckbox
                  label={EMPLOYEE.NOTIFICATIONS.JOB_STARTING_24_HOURS}
                  checked={formData.notifyJobStartingIn24Hours ?? true}
                  onChange={(checked) =>
                    handleChange(FIELD_NAMES.NOTIFY_JOB_STARTING_IN_24_HOURS, checked)
                  }
                  disabled={isLoading}
                />
              </div>
              <div className="app-form__form-checkbox">
                <SMSCheckbox
                  label={EMPLOYEE.NOTIFICATIONS.JOB_STARTING_1_HOUR}
                  checked={formData.notifyJobStartingIn1Hour ?? true}
                  onChange={(checked) =>
                    handleChange(FIELD_NAMES.NOTIFY_JOB_STARTING_IN_1_HOUR, checked)
                  }
                  disabled={isLoading}
                />
              </div>
            </div>
          </SMSBox>
        </SMSBox>

        {/* Additional Information + Skills + Rank History Section (Tabbed) */}
        <SMSBox className="app-form__section">
          <SMSBox className="app-form__half-width">
            <SMSTabs
              options={[
                {
                  id: INFO_TABS.SKILLS,
                  label: canEditAllFields ? EMPLOYEE.SKILLS.UPDATE_TAB : EMPLOYEE.SKILLS.VIEW_TAB,
                },
                { id: INFO_TABS.RANK_HISTORY, label: EMPLOYEE.RANK_HISTORY.TAB },
                { id: INFO_TABS.ADDITIONAL, label: 'Additional Information' },
              ]}
              value={activeInfoTab}
              onChange={(id) => setActiveInfoTab(id as InfoTabKey)}
            />
          </SMSBox>

          {activeInfoTab === INFO_TABS.SKILLS && (
            <SMSBox className="app-form__full-width">
              <SMSBox className="employee-form__skills-card">
                {skillRows.length === 0 && (!formData.skillIDs || formData.skillIDs.length === 0) ? (
                  // Empty state: simple Skill dropdown + Add button (dates handled in modal)
                  <SMSBox className="employee-form__skills-row">
                    <SMSBox className="employee-form__skills-dropdown">
                      <SMSDropdown
                        label="Skill"
                        options={skillOptionsForDropdown}
                        value={selectedSkillId}
                        onChange={(e) => setSelectedSkillId(String(e.target.value))}
                        placeholder={EMPLOYEE.FORM.SKILLS_PLACEHOLDER}
                        disabled={fieldDisabled}
                        name={FIELD_NAMES.SKILL_IDS}
                        id={FIELD_NAMES.SKILL_IDS}
                      />
                    </SMSBox>
                    <SMSBox className="employee-form__skills-add">
                      <SMSButton
                        type="button"
                        onClick={() => {
                          setEditingSkillId(null);
                          setSkillStartDateInput('');
                          setSkillEndDateInput('');
                          setSkillAddError(null);
                          openAddSkillModal();
                        }}
                        disabled={fieldDisabled}
                      >
                        Add
                      </SMSButton>
                    </SMSBox>
                  </SMSBox>
                ) : (
                  <>
                    <SMSBox className="employee-form__skills-header">
                      <span className="employee-form__skills-title">Skills</span>
                      <SMSSegmentedStatusFilter
                        className="employee-form__skills-status-filter"
                        value={skillStatusFilter}
                        onChange={(next) => setSkillStatusFilter(next === 'inactive' ? 'inactive' : 'active')}
                        activeLabel="Active"
                        inactiveLabel="Inactive"
                        showIcons={false}
                        ariaLabel="Skill status filter"
                      />
                      <SMSButton
                        type="button"
                        onClick={() => {
                          setEditingSkillId(null);
                          setSelectedSkillId('');
                          setSkillStartDateInput('');
                          setSkillEndDateInput('');
                          openAddSkillModal();
                        }}
                        disabled={fieldDisabled}
                      >
                        Add Skill
                      </SMSButton>
                    </SMSBox>
                    {(skillStatusFilter === 'active' ? activeSkillRows : inactiveSkillRows).length === 0 ? (
                      <SMSBox sx={{ marginTop: '0.75rem', paddingTop: '0.75rem' }}>
                        <SMSBox
                          sx={{
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            paddingY: '1rem',
                            textAlign: 'center',
                            color: '#64748b',
                            fontSize: '0.9rem',
                            backgroundColor: '#ffffff',
                          }}
                        >
                          No data available
                        </SMSBox>
                      </SMSBox>
                    ) : (
                      <SMSBox className="employee-form__skills-list">
                        <SMSDataTableWrapper
                          columns={skillColumns}
                          data={skillStatusFilter === 'active' ? activeSkillRows : inactiveSkillRows}
                          searchable={false}
                          pagination={undefined}
                        />
                      </SMSBox>
                    )}
                  </>
                )}
              </SMSBox>
            </SMSBox>
          )}

          {activeInfoTab === INFO_TABS.RANK_HISTORY && (
            <EmployeeTenureRankHistorySection
              employeeId={initialData?.employeeID}
              isCreateMode={!isEditMode}
            />
          )}

          {activeInfoTab === INFO_TABS.ADDITIONAL && (
            <SMSBox className="employee-form__additional-grid app-form__full-width">
              <SMSFormField
                type="text"
                name={FIELD_NAMES.EMPLOYEE_DEPARTMENT_DEFINED_FIELD_1}
                label={EMPLOYEE.FORM.EMPLOYEE_DEPARTMENT_DEFINED_FIELD_1}
                value={formData.employeeDepartmentDefinedField1 || ''}
                onChange={(value) =>
                  handleChange(FIELD_NAMES.EMPLOYEE_DEPARTMENT_DEFINED_FIELD_1, value)
                }
                placeholder={EMPLOYEE.FORM.EMPLOYEE_DEPARTMENT_DEFINED_FIELD_1_PLACEHOLDER}
                disabled={fieldDisabled}
                maxLength={200}
              />
              <SMSFormField
                type="text"
                name={FIELD_NAMES.EMPLOYEE_DEPARTMENT_DEFINED_FIELD_2}
                label={EMPLOYEE.FORM.EMPLOYEE_DEPARTMENT_DEFINED_FIELD_2}
                value={formData.employeeDepartmentDefinedField2 || ''}
                onChange={(value) =>
                  handleChange(FIELD_NAMES.EMPLOYEE_DEPARTMENT_DEFINED_FIELD_2, value)
                }
                placeholder={EMPLOYEE.FORM.EMPLOYEE_DEPARTMENT_DEFINED_FIELD_2_PLACEHOLDER}
                disabled={fieldDisabled}
                maxLength={200}
              />
              <SMSFormField
                type="text"
                name={FIELD_NAMES.EMPLOYEE_DEPARTMENT_DEFINED_FIELD_3}
                label={EMPLOYEE.FORM.EMPLOYEE_DEPARTMENT_DEFINED_FIELD_3}
                value={formData.employeeDepartmentDefinedField3 || ''}
                onChange={(value) =>
                  handleChange(FIELD_NAMES.EMPLOYEE_DEPARTMENT_DEFINED_FIELD_3, value)
                }
                placeholder={EMPLOYEE.FORM.EMPLOYEE_DEPARTMENT_DEFINED_FIELD_3_PLACEHOLDER}
                disabled={fieldDisabled}
                maxLength={200}
              />
              <SMSFormField
                type="text"
                name={FIELD_NAMES.EMPLOYEE_DEPARTMENT_DEFINED_FIELD_4}
                label={EMPLOYEE.FORM.EMPLOYEE_DEPARTMENT_DEFINED_FIELD_4}
                value={formData.employeeDepartmentDefinedField4 || ''}
                onChange={(value) =>
                  handleChange(FIELD_NAMES.EMPLOYEE_DEPARTMENT_DEFINED_FIELD_4, value)
                }
                placeholder={EMPLOYEE.FORM.EMPLOYEE_DEPARTMENT_DEFINED_FIELD_4_PLACEHOLDER}
                disabled={fieldDisabled}
                maxLength={200}
              />
            </SMSBox>
          )}

          <SMSBox className="employee-form__photo-row app-form__full-width">
            <SMSButton
              type="button"
              disabled={fieldDisabled}
              onClick={() => photoInputRef.current?.click()}
              className="employee-form__photo-button"
            >
              {EMPLOYEE.FORM.UPLOAD_PHOTO_BUTTON}
            </SMSButton>
            <span className="employee-form__photo-label">{EMPLOYEE.FORM.PROFILE_PHOTO}</span>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="employee-form__photo-input"
              aria-label={EMPLOYEE.FORM.UPLOAD_PHOTO_BUTTON}
              onChange={handlePhotoSelect}
              disabled={fieldDisabled}
            />
            {photoPreviewUrl && (
              <SMSBox className="employee-form__photo-preview">
                <img src={photoPreviewUrl} alt="Profile" className="employee-form__photo-preview-img" />
              </SMSBox>
            )}
            {errors.profilePhoto && (
              <span className="employee-form__photo-error" role="alert">
                {errors.profilePhoto}
              </span>
            )}
          </SMSBox>
        </SMSBox>

        {isEditMode && initialData && (
          <SMSBox className="app-form__audit-footer">
            <span>
              <strong>{EMPLOYEE.TABLE.COLUMNS.CREATED_BY}:</strong> {initialData.createdBy || 'N/A'}
              {initialData.createdDate && (
                <span> ({formatDate(initialData.createdDate)} {formatTime(initialData.createdDate)})</span>
              )}
            </span>
            <span className="app-form__audit-separator">|</span>
            <span>
              <strong>{EMPLOYEE.TABLE.COLUMNS.EDITED_BY}:</strong> {initialData.editedBy || 'N/A'}
              {initialData.editedDate && (
                <span> ({formatDate(initialData.editedDate)} {formatTime(initialData.editedDate)})</span>
              )}
            </span>
          </SMSBox>
        )}

        <SMSBox className="app-form__footer">
          {onCancel && (
            <SMSButton
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="app-form__cancel-button"
            >
              {EMPLOYEE.FORM.CANCEL_BUTTON}
            </SMSButton>
          )}
          <SMSButton
            type="submit"
            className="app-form__submit-button"
            disabled={isLoading}
            loading={isLoading}
          >
            {isEditMode ? EMPLOYEE.BUTTON.UPDATE : EMPLOYEE.FORM.SUBMIT_BUTTON}
          </SMSButton>
        </SMSBox>
      </form>

      <Modal
        open={isSkillModalOpen}
        onClose={() => {
          setIsSkillModalOpen(false);
          setEditingSkillId(null);
          setEditingEmployeeSkillId(null);
          setSkillStartDateInput('');
          setSkillEndDateInput('');
        }}
        title={editingSkillId ? 'Edit Skill' : 'Add Skill'}
        size="small"
      >
          <SMSBox className="employee-form__skills-modal">
          <SMSBox className="employee-form__skills-modal-row">
            <SMSDropdown
              label="Skill"
              options={skillModalSkillOptions}
              value={selectedSkillId}
              onChange={(e) => {
                setSelectedSkillId(String(e.target.value));
                setSkillAddError(null);
              }}
              placeholder="Select Skill"
              disabled={fieldDisabled || !!editingSkillId}
              name={FIELD_NAMES.SKILL_IDS}
              id={`${FIELD_NAMES.SKILL_IDS}-modal`}
            />
          </SMSBox>

          {editingSkillId ? (
            <>
              <SMSBox className="employee-form__skills-modal-dates-row">
                <SMSBox className="employee-form__skills-modal-date-field">
                  <SMSDatePicker
                    label="Start Date"
                    required
                    disabled={fieldDisabled}
                    value={
                      skillStartDateInput ||
                      (editingSkillId && skillDateRanges[editingSkillId]?.startDate
                        ? String(skillDateRanges[editingSkillId]?.startDate).slice(0, 10)
                        : '')
                    }
                    onChange={(v) => {
                      setSkillStartDateInput(v);
                      setSkillAddError(null);
                    }}
                    id="employee-skill-modal-start-edit"
                  />
                </SMSBox>
                <SMSBox className="employee-form__skills-modal-date-field">
                  <SMSDatePicker
                    label="End Date"
                    required
                    disabled={fieldDisabled || !skillModalEffectiveStart}
                    value={
                      skillEndDateInput ||
                      (editingSkillId && skillDateRanges[editingSkillId]?.endDate
                        ? String(skillDateRanges[editingSkillId]?.endDate).slice(0, 10)
                        : '')
                    }
                    onChange={(v) => {
                      setSkillEndDateInput(v);
                      setSkillAddError(null);
                    }}
                    minDate={
                      skillStartDateInput ||
                      (editingSkillId && skillDateRanges[editingSkillId]?.startDate
                        ? String(skillDateRanges[editingSkillId]?.startDate).slice(0, 10)
                        : undefined) ||
                      undefined
                    }
                    id="employee-skill-modal-end-edit"
                  />
                </SMSBox>
              </SMSBox>
              {skillAddError && (
                <SMSBox className="employee-form__skills-error">
                  {skillAddError}
                </SMSBox>
              )}
            </>
          ) : (
            <>
              <SMSBox className="employee-form__skills-modal-dates-row">
                <SMSBox className="employee-form__skills-modal-date-field">
                  <SMSDatePicker
                    label="Start Date"
                    required
                    disabled={fieldDisabled}
                    value={skillStartDateInput}
                    onChange={(v) => {
                      setSkillStartDateInput(v);
                      setSkillAddError(null);
                    }}
                    id="employee-skill-modal-start-add"
                  />
                </SMSBox>
                <SMSBox className="employee-form__skills-modal-date-field">
                  <SMSDatePicker
                    label="End Date"
                    required
                    disabled={fieldDisabled || !skillModalEffectiveStart}
                    value={skillEndDateInput}
                    onChange={(v) => {
                      setSkillEndDateInput(v);
                      setSkillAddError(null);
                    }}
                    minDate={skillStartDateInput || undefined}
                    id="employee-skill-modal-end-add"
                  />
                </SMSBox>
              </SMSBox>
              {skillAddError && (
                <SMSBox className="employee-form__skills-error">
                  {skillAddError}
                </SMSBox>
              )}
            </>
          )}

          <SMSDialogActions className="employee-form__skills-modal-actions">
            <SMSButton
              type="button"
              onClick={() => {
                setIsSkillModalOpen(false);
                setEditingSkillId(null);
                setSkillEndDateInput('');
              }}
              
            >
              Cancel
            </SMSButton>
            {editingSkillId ? (
              <SMSButton
                type="button"
                onClick={handleUpdateSkillEndDate}
                disabled={fieldDisabled || !editingSkillId || !selectedSkillId}
              >
                Update
              </SMSButton>
            ) : (
              <SMSButton
                type="button"
                onClick={handleAddSkill}
                disabled={fieldDisabled}
              >
                Add
              </SMSButton>
            )}
          </SMSDialogActions>
        </SMSBox>
      </Modal>

      <SMSConfirmDialog
        open={!!employeeSkillRowPendingDelete}
        title={EMPLOYEE.SKILLS.DELETE_DIALOG_TITLE}
        message={EMPLOYEE.SKILLS.DELETE_CONFIRM}
        confirmText={EMPLOYEE.SKILLS.DELETE}
        cancelText={EMPLOYEE.SKILLS.DELETE_CANCEL}
        onConfirm={handleConfirmDeleteSkill}
        onClose={handleCloseDeleteSkillDialog}
        variant="error"
      />

      <SMSConsentDisclosureDialog
        open={consentDialogMode !== null}
        mode={consentDialogMode ?? 'review'}
        firstName={formData.firstName || ''}
        lastName={formData.lastName || ''}
        phoneNumber={
          joinSmsTelephoneNumber(formData.smsTelephoneRegion, formData.smsTelephoneNumber) || ''
        }
        email={formData.offDutyCallBackEmail?.trim() || formData.primaryEmail || ''}
        consentChecked={consentDialogMode === 'consent' || (formData.hasSmsConsent ?? false)}
        onAccept={handleConsentDialogYes}
        onDecline={handleConsentDialogNo}
      />
    </SMSBox>
  );
};