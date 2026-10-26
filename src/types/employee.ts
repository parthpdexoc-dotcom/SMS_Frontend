/**
 * Employee DTOs and Types
 */

import { formatPhoneNumber } from '@/utils/formatters';
import { DEFAULT_SMS_TELEPHONE_REGION, splitSmsTelephoneNumber } from '@/utils/smsTelephone';

// Response DTO for the new API structure
export interface EmployeeResponse {
  employeeID: string;
  departmentID: string;
  employeeTypeID: string;
  statusID: string;
  employeeType: string;
  status: string;
  badgeNumber: string;
  /** Unique employee number used for login/identification */
  employeeNumber?: string;
  firstName: string;
  lastName: string;
  username: string;
  password?: string;
  primaryPhone: string;
  secondaryPhone?: string | null;
  offDutyCallBackPhoneNumber?: string | null;
  primaryEmail: string;
  secondaryEmail?: string | null;
  offDutyCallBackEmail?: string | null;
  isSubsidizedVehicle?: boolean | null;
  /** Phone number used for SMS schedule notifications. */
  smsTelephoneNumber?: string | null;
  /** Employee agreed to the SMS consent disclosure. */
  hasSmsConsent?: boolean;
  notifyWhenJobsPosted?: boolean | null;
  notifyJobStartingIn24Hours?: boolean | null;
  notifyJobStartingIn1Hour?: boolean | null;
  hourlySalary?: number | null;
  hrCostCenterCode?: string | null;
  divisionID?: string | null;
  employeeDepartmentDefinedField1?: string | null;
  employeeDepartmentDefinedField2?: string | null;
  employeeDepartmentDefinedField3?: string | null;
  employeeDepartmentDefinedField4?: string | null;
  /** Whether the employee is approved/active for scheduling, etc. */
  isApproved?: boolean | null;
  createdDate?: string | null;
  createdUserID?: string | null;
  createdBy?: string | null;
  editedDate?: string | null;
  editedUserID?: string | null;
  editedBy?: string | null;
  /** MIME type of profile photo (e.g. "image/png", "image/jpeg"). Null when no photo. */
  profilePhotoContentType?: string | null;
  /** Profile photo bytes as base64. Null when no photo. */
  profilePhotoBase64?: string | null;
}

/** Split job / lookup-by-number: IDs for form submit and display name. */
export interface EmployeeByNumberLookup {
  employeeID: string;
  employeeName: string;
}

export interface CreateEmployeeRequest {
  departmentID?: string;
  employeeTypeID: string;
  statusID: string;
  badgeNumber: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  username: string;
  password: string;
  primaryPhone: string;
  secondaryPhone?: string;
  offDutyCallBackPhoneNumber?: string | null;
  primaryEmail: string;
  secondaryEmail?: string;
  offDutyCallBackEmail?: string | null;
  hourlySalary?: number | null;
  hrCostCenterCode?: string | null;
  divisionID?: string | null;
  employeeDepartmentDefinedField1?: string | null;
  employeeDepartmentDefinedField2?: string | null;
  employeeDepartmentDefinedField3?: string | null;
  employeeDepartmentDefinedField4?: string | null;
   /** Whether the employee is approved/active on create */
   isApproved?: boolean;
  isSubsidizedVehicle?: boolean;
  smsTelephoneNumber?: string | null;
  hasSmsConsent?: boolean;
  notifyWhenJobsPosted?: boolean;
  notifyJobStartingIn24Hours?: boolean;
  notifyJobStartingIn1Hour?: boolean;
}

export interface UpdateEmployeeRequest {
  employeeID: string;
  departmentID?: string;
  employeeTypeID: string;
  statusID: string;
  badgeNumber: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  username: string;
  password?: string;
  primaryPhone: string;
  secondaryPhone?: string;
  offDutyCallBackPhoneNumber?: string | null;
  primaryEmail: string;
  secondaryEmail?: string;
  offDutyCallBackEmail?: string | null;
  hourlySalary?: number | null;
  hrCostCenterCode?: string | null;
  divisionID?: string | null;
  employeeDepartmentDefinedField1?: string | null;
  employeeDepartmentDefinedField2?: string | null;
  employeeDepartmentDefinedField3?: string | null;
  employeeDepartmentDefinedField4?: string | null;
   /** Whether the employee is approved/active on update */
   isApproved?: boolean;
  isSubsidizedVehicle?: boolean;
  smsTelephoneNumber?: string | null;
  hasSmsConsent?: boolean;
  notifyWhenJobsPosted?: boolean;
  notifyJobStartingIn24Hours?: boolean;
  notifyJobStartingIn1Hour?: boolean;
}

/**
 * JSON Patch (RFC 6902) replace operation for Employee PATCH API.
 * Only "replace" operations are allowed; path is camelCase with leading slash.
 */
export interface JsonPatchReplaceOperation {
  op: 'replace';
  path: string;
  value: string | number | boolean | string[] | null;
}

// Pagination parameters for employee list
export interface EmployeeListParams {
  offset?: number;
  limit?: number;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: string;
  /** Optional free-text search term for server-side filtering */
  searchTerm?: string;
  /** Optional employee type filter (GUID string) */
  employeeTypeId?: string;
  /** Optional department filter (GUID string); supported when present on list/search APIs */
  departmentId?: string;
  /** Optional selected employee ID to include even if otherwise filtered out */
  selectedId?: string;
}

// Paginated response
export interface PaginatedEmployeeResponse {
  data: EmployeeResponse[];
  totalCount?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
}

// Form data type for the Employee form
export interface EmployeeFormData {
  employeeID: string;
  departmentID?: string;
  employeeTypeID: string;
  statusID: string;
  badgeNumber: string;
   /** Local-only field for employee number input */
  employeeNumber: string;
  firstName: string;
  lastName: string;
  username: string;
  password: string;
  primaryPhone: string;
  secondaryPhone?: string;
  offDutyCallBackPhoneNumber?: string;
  primaryEmail: string;
  secondaryEmail?: string;
  offDutyCallBackEmail?: string;
  hourlySalary?: number | null;
  hrCostCenterCode?: string;
  divisionID?: string;
  employeeDepartmentDefinedField1?: string;
  employeeDepartmentDefinedField2?: string;
  employeeDepartmentDefinedField3?: string;
  employeeDepartmentDefinedField4?: string;
  skillIDs?: string[];
  /** Local form toggle for IsApproved */
  isApproved?: boolean;
  isSubsidizedVehicle?: boolean;
  smsTelephoneNumber?: string;
  /** Local-only dialing prefix. Saved as part of smsTelephoneNumber. */
  smsTelephoneRegion?: string;
  /** Local-only value shown in the Material UI telephone input. */
  smsTelephoneInput?: string;
  hasSmsConsent?: boolean;
  notifyWhenJobsPosted?: boolean;
  notifyJobStartingIn24Hours?: boolean;
  notifyJobStartingIn1Hour?: boolean;
}

/**
 * Maps an API employee row into {@link EmployeeFormData} (display formatting for phone).
 */
export function employeeResponseToFormData(
  data: EmployeeResponse,
  departmentIDProp?: string
): EmployeeFormData {
  return {
    employeeID: data.employeeID || '',
    departmentID: data.departmentID || departmentIDProp || '',
    employeeTypeID: data.employeeTypeID || '',
    statusID: data.statusID || '',
    employeeNumber: String(data.employeeNumber ?? ''),
    badgeNumber: String(data.employeeNumber ?? data.badgeNumber ?? ''),
    firstName: data.firstName || '',
    lastName: data.lastName || '',
    username: data.username || '',
    password: '',
    primaryPhone: formatPhoneNumber(data.primaryPhone || ''),
    secondaryPhone: formatPhoneNumber(data.secondaryPhone || ''),
    offDutyCallBackPhoneNumber: formatPhoneNumber(data.offDutyCallBackPhoneNumber || ''),
    primaryEmail: data.primaryEmail || '',
    secondaryEmail: data.secondaryEmail || '',
    offDutyCallBackEmail: data.offDutyCallBackEmail || '',
    hourlySalary: data.hourlySalary ?? null,
    hrCostCenterCode: data.hrCostCenterCode ?? '',
    divisionID: data.divisionID ?? '',
    employeeDepartmentDefinedField1: data.employeeDepartmentDefinedField1 ?? '',
    employeeDepartmentDefinedField2: data.employeeDepartmentDefinedField2 ?? '',
    employeeDepartmentDefinedField3: data.employeeDepartmentDefinedField3 ?? '',
    employeeDepartmentDefinedField4: data.employeeDepartmentDefinedField4 ?? '',
    // Backend no longer provides EmployeeDto.skillIDs. Employee skills are managed via EmployeeSkill API.
    skillIDs: [],
    isApproved: data.isApproved ?? true,
    isSubsidizedVehicle: data.isSubsidizedVehicle ?? false,
    ...(() => {
      const smsTelephone = splitSmsTelephoneNumber(data.smsTelephoneNumber);
      return {
        smsTelephoneNumber: smsTelephone.phone,
        smsTelephoneRegion: smsTelephone.region || DEFAULT_SMS_TELEPHONE_REGION,
        smsTelephoneInput: smsTelephone.inputValue,
      };
    })(),
    hasSmsConsent: data.hasSmsConsent ?? false,
    notifyWhenJobsPosted: data.notifyWhenJobsPosted ?? true,
    notifyJobStartingIn24Hours: data.notifyJobStartingIn24Hours ?? true,
    notifyJobStartingIn1Hour: data.notifyJobStartingIn1Hour ?? true,
  };
}

// Form errors type
export interface EmployeeFormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  employeeType?: string;
  [key: string]: string | undefined;
}


