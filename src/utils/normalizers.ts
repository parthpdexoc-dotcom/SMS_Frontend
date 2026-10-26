/**
 * Data normalization utilities
 * Functions to convert raw API responses to properly typed frontend objects
 */

import {
  AdminTypeResponse,
  DepartmentResponse,
  DepartmentEquipmentResponse,
  DepartmentDivisionResponse,
  DepartmentActivityTypeResponse,
  DepartmentDefinedFieldsResponse,
  SkillResponse,
  BusinessTypeResponse,
  DepartmentAdminResponse,
  EmployeeResponse,
  EmployeeTypeResponse,
  EmployeeStatusResponse,
  EquipmentTypeResponse,
  ResponseAreaResponse,
  RequesterResponse,
} from '@/types';
import type { RequestEmployeeResponseDto } from '@/types/requesterEmployee';
import type { RequestManagerResponseDto } from '@/types/requesterManager';

import { RoutingGroupResponse } from '@/types/routingGroup';
import { BlockDateResponse } from '@/types/blockDate';
import type { RequesterAuthorized } from '@/types/requesterAuthorized';

/**
 * Normalize department data from API response
 */
export const normalizeDepartment = (raw: Record<string, unknown>): DepartmentResponse => {
  const departmentID = String(
    raw?.departmentID ??
      raw?.DepartmentID ??
      raw?.departmentId ??
      raw?.DepartmentId ??
      raw?.id ??
      raw?.Id ??
      ''
  ).trim() as string;
  return {
    departmentID,
    departmentCode: (raw?.departmentCode || raw?.DepartmentCode || '') as string,
    departmentName: (raw?.departmentName || raw?.DepartmentName || '') as string,
    address: (raw?.address || raw?.Address || '') as string,
    city: (raw?.city || raw?.City || '') as string,
    state: (raw?.state || raw?.State || '') as string,
    zip: (raw?.zip || raw?.Zip || '') as string,
    firstName: (raw?.firstName || raw?.FirstName || '') as string,
    lastName: (raw?.lastName || raw?.LastName || '') as string,
    phone: (raw?.phone || raw?.Phone || '') as string,
    fax: (raw?.fax || raw?.Fax || '') as string,
    email: (raw?.email || raw?.Email || '') as string,
    domain: (raw?.domain || raw?.Domain || '') as string,
    active: Boolean(raw?.active || raw?.Active || true),
    timeZoneId: (raw?.timeZoneId || raw?.TimeZoneId || 'Eastern Standard Time') as string,
    employeeDataFolderName: (raw?.employeeDataFolderName || raw?.EmployeeDataFolderName || '') as string,
    createdDate: raw?.createdDate || raw?.CreatedDate || null,
    createdUserID: raw?.createdUserID || raw?.CreatedUserID || null,
    createdBy: raw?.createdBy || raw?.CreatedBy || null,
    editedDate: raw?.editedDate || raw?.EditedDate || null,
    editedUserID: raw?.editedUserID || raw?.EditedUserID || null,
    editedBy: raw?.editedBy || raw?.EditedBy || null,
  } as DepartmentResponse;
};

/**
 * Normalize admin type data from API response
 */
export const normalizeAdminType = (raw: Record<string, unknown>): AdminTypeResponse => {
  const adminTypeID = (raw?.adminTypeID || raw?.AdminTypeID || '') as string;
  const parentId = raw?.parentID ?? raw?.ParentID ?? null;
  return {
    adminTypeID,
    adminTypeShort: (raw?.adminTypeShort || raw?.AdminTypeShort || '') as string,
    adminTypeLong: (raw?.adminTypeLong || raw?.AdminTypeLong || '') as string,
    adminTypeStatus: Boolean(raw?.adminTypeStatus ?? raw?.status ?? raw?.Status ?? true),
    isManagePost: Boolean(raw?.isManagePost ?? raw?.IsManagePost ?? false),
    parentID: parentId != null && parentId !== '' ? String(parentId) : null,
    createdDate: raw?.createdDate || raw?.CreatedDate || null,
    createdUserID: raw?.createdUserID || raw?.CreatedUserID || null,
    createdBy: raw?.createdBy || raw?.CreatedBy || null,
    editedDate: raw?.editedDate || raw?.EditedDate || null,
    editedUserID: raw?.editedUserID || raw?.EditedUserID || null,
    editedBy: raw?.editedBy || raw?.EditedBy || null,
  } as AdminTypeResponse;
};

/**
 * Normalize department equipment data from API response (supports camelCase and PascalCase from API)
 */
export const normalizeDepartmentEquipment = (raw: Record<string, unknown>): DepartmentEquipmentResponse => {
  const departmentEquipmentID = (raw?.departmentEquipmentID ?? raw?.DepartmentEquipmentID ?? '') as string;
  const equipmentTypeID = (raw?.equipmentTypeID ?? raw?.EquipmentTypeID ?? '') as string;
  const equipmentType = (raw?.equipmentType ?? raw?.EquipmentType ?? '') as string;
  const charge = Number(raw?.charge ?? raw?.Charge ?? 0);
  const mileageCharge = Number(raw?.mileageCharge ?? raw?.MileageCharge ?? 0);
  const chargeMileage = Boolean(raw?.chargeMileage ?? raw?.ChargeMileage);
  const requiresApproval = Boolean(raw?.requiresApproval ?? raw?.RequiresApproval ?? true);
  const requiresUtilizationRecorded = Boolean(raw?.requiresUtilizationRecorded ?? raw?.RequiresUtilizationRecorded ?? true);
  const equipmentStatus = raw?.equipmentStatus ?? raw?.EquipmentStatus ?? true;
  const isDefault = Boolean(raw?.isDefault ?? raw?.IsDefault ?? false);
  const isVehicle = Boolean(raw?.isVehicle ?? raw?.IsVehicle ?? false);
  return {
    ...raw,
    departmentEquipmentID,
    equipmentTypeID,
    equipmentType,
    chargedType: Number(
      raw?.chargedType ?? raw?.ChargedType ?? raw?.chargeType ?? raw?.ChargeType ?? 0
    ),
    charge,
    chargeMileage,
    mileageCharge,
    mileageCondition: Number(raw?.mileageCondition ?? raw?.MileageCondition ?? 0),
    equipmentStatus,
    requiresApproval,
    requiresUtilizationRecorded,
    isDefault,
    isVehicle,
  } as DepartmentEquipmentResponse;
};

/**
 * Normalize department division data from API response
 */
export const normalizeDepartmentDivision = (raw: Record<string, unknown>): DepartmentDivisionResponse => {
  const divisionID = (raw?.divisionID || raw?.DivisionID || '') as string;
  const divisionActiveRaw = raw?.divisionActive ?? raw?.DivisionActive;
  return {
    divisionID,
    divisionShort: (raw?.divisionShort || raw?.DivisionShort || '') as string,
    divisionLong: (raw?.divisionLong || raw?.DivisionLong || '') as string,
    divisionActive: divisionActiveRaw === undefined ? true : Boolean(divisionActiveRaw),
    createdDate: raw?.createdDate || raw?.CreatedDate || null,
    createdUserID: raw?.createdUserID || raw?.CreatedUserID || null,
    createdBy: raw?.createdBy || raw?.CreatedBy || null,
    editedDate: raw?.editedDate || raw?.EditedDate || null,
    editedUserID: raw?.editedUserID || raw?.EditedUserID || null,
    editedBy: raw?.editedBy || raw?.EditedBy || null,
  } as DepartmentDivisionResponse;
};

/**
 * Normalize department activity type data from API response.
 * Backend GetAllActiveDepartmentActivityType returns DepartmentActivityTypeDto:
 * DepartmentActivityTypeId, ActivityTypeShort, ActivityTypeLong, ActivityTypeStatus (PascalCase or camelCase in JSON).
 */
export const normalizeDepartmentActivityType = (raw: Record<string, unknown>): DepartmentActivityTypeResponse => {
  const id =
    (
      raw?.departmentActivityTypeId ??
      raw?.departmentActivityTypeID ??
      raw?.DepartmentActivityTypeId ??
      raw?.DepartmentActivityTypeID ??
      raw?.activityTypeId ??
      raw?.activityTypeID ??
      raw?.ActivityTypeId ??
      raw?.ActivityTypeID ??
      ''
    ) as string;
  const departmentActivityTypeId = id != null && id !== '' ? String(id).trim() : '';
  const activityTypeAbstract =
    (
      raw?.activityTypeAbstract ??
      raw?.ActivityTypeAbstract ??
      raw?.departmentActivityTypeAbstract ??
      raw?.DepartmentActivityTypeAbstract ??
      ''
    ) as string;
  return {
    departmentActivityTypeId,
    activityTypeShort: (
      raw?.activityTypeShort ??
      raw?.ActivityTypeShort ??
      raw?.departmentActivityTypeShort ??
      raw?.DepartmentActivityTypeShort ??
      ''
    ) as string,
    activityTypeLong: (
      raw?.activityTypeLong ??
      raw?.ActivityTypeLong ??
      raw?.departmentActivityTypeLong ??
      raw?.DepartmentActivityTypeLong ??
      ''
    ) as string,
    activityTypeAbstract: activityTypeAbstract != null && activityTypeAbstract !== '' ? String(activityTypeAbstract).trim() : null,
    valueBy: (raw?.valueBy ?? raw?.ValueBy ?? null) as string | null,
    activityTypeStatus: Boolean(raw?.activityTypeStatus ?? raw?.ActivityTypeStatus ?? true),
    createdDate: raw?.createdDate ?? raw?.CreatedDate ?? null,
    createdUserID: raw?.createdUserID ?? raw?.CreatedUserID ?? null,
    createdBy: raw?.createdBy ?? raw?.CreatedBy ?? null,
    editedDate: raw?.editedDate ?? raw?.EditedDate ?? null,
    editedUserID: raw?.editedUserID ?? raw?.EditedUserID ?? null,
    editedBy: raw?.editedBy ?? raw?.EditedBy ?? null,
  } as DepartmentActivityTypeResponse;
};

/**
 * Normalize skill data from API response
 */
export const normalizeSkill = (raw: Record<string, unknown>): SkillResponse => {
  // Ensure we always have skillId (backend uses skillId)
  const skillId = (raw?.skillId || '') as string;
  return {
    ...raw,
    skillId,
  } as SkillResponse;
};

/**
 * Normalize business type data from API response
 */
export const normalizeBusinessType = (raw: Record<string, unknown>): BusinessTypeResponse => {
  const businessTypeID = (raw?.businessTypeID || '') as string;
  return {
    ...raw,
    businessTypeID,
    businessTypeStatus: raw?.businessTypeStatus ?? true,
  } as BusinessTypeResponse;
};

/**
 * Normalize department admin data from API response
 */
export const normalizeDepartmentAdmin = (raw: Record<string, unknown>): DepartmentAdminResponse => {
  const departmentAdminID = (raw?.departmentAdminID
    || raw?.departmentAdminId
    || raw?.DepartmentAdminID
    || raw?.DepartmentAdminId
    || '') as string;
  return {
    departmentAdminID,
    employeeID: String(
      raw?.employeeID
      ?? raw?.EmployeeID
      ?? ''
    ) || undefined,
    adminTypeID: String(
      raw?.adminTypeID
      ?? raw?.AdminTypeID
      ?? ''
    ) || undefined,
    departmentID: String(
      raw?.departmentID
      ?? raw?.DepartmentID
      ?? ''
    ) || undefined,
    employeeName: (raw as any)?.employeeName ?? (raw as any)?.EmployeeName ?? null,
    adminTypeName: (raw as any)?.adminTypeName ?? (raw as any)?.AdminTypeName ?? null,
    departmentAdminShort: (raw?.departmentAdminShort || raw?.DepartmentAdminShort || '') as string,
    departmentAdminLong: (raw?.departmentAdminLong || raw?.DepartmentAdminLong || '') as string,
    departmentAdminStatus: raw?.departmentAdminStatus !== undefined
      ? Boolean(raw.departmentAdminStatus)
      : raw?.DepartmentAdminStatus !== undefined
        ? Boolean(raw.DepartmentAdminStatus)
        : true,
    createdDate: (raw?.createdDate || raw?.CreatedDate || null) as string | null,
    createdUserID: (raw?.createdUserID || raw?.CreatedUserID || null) as string | null,
    createdBy: (raw?.createdBy || raw?.CreatedBy || null) as string | null,
    editedDate: (raw?.editedDate || raw?.EditedDate || null) as string | null,
    editedUserID: (raw?.editedUserID || raw?.EditedUserID || null) as string | null,
    editedBy: (raw?.editedBy || raw?.EditedBy || null) as string | null,
  } as DepartmentAdminResponse;
};

/**
 * Normalize employee type data from API response
 */
export const normalizeEmployeeType = (raw: Record<string, unknown>): EmployeeTypeResponse => {
  const employeeTypeID = (raw?.employeeTypeID || raw?.EmployeeTypeID || '') as string;
  const payRate = raw?.payRate ?? raw?.PayRate;
  const premiumPayRate = raw?.premiumPayRate ?? raw?.PremiumPayRate;
  const holidayPayRate = raw?.holidayPayRate ?? raw?.HolidayPayRate;
  const isSupervisorRaw = raw?.isSupervisor ?? (raw as any)?.IsSupervisor;
  const isEligibleRaw = raw?.isEligible ?? (raw as any)?.IsEligible;
  const sameRankRaw = raw?.sameRankIds ?? raw?.SameRankIds ?? raw?.sameRankIDs ?? raw?.SameRankIDs;
  let sameRankIds: string[] | undefined;
  if (Array.isArray(sameRankRaw)) {
    sameRankIds = sameRankRaw.map((id) => String(id)).filter(Boolean);
  }

  return {
    ...raw,
    employeeTypeID,
    employeeTypeActive: raw?.employeeTypeActive ?? true,
    payRate: payRate != null ? Number(payRate) : null,
    premiumPayRate: premiumPayRate != null ? Number(premiumPayRate) : null,
    holidayPayRate: holidayPayRate != null ? Number(holidayPayRate) : null,
    isSupervisor:
      isSupervisorRaw !== undefined && isSupervisorRaw !== null
        ? Boolean(isSupervisorRaw)
        : null,
    isEligible:
      isEligibleRaw !== undefined && isEligibleRaw !== null
        ? Boolean(isEligibleRaw)
        : null,
    ...(sameRankIds !== undefined ? { sameRankIds } : {}),
  } as EmployeeTypeResponse;
};

/**
 * Normalize employee data from API response
 */
export const normalizeEmployee = (raw: Record<string, unknown>): EmployeeResponse => {
  const employeeID = String(raw?.employeeID || raw?.EmployeeID || '');
  const employeeTypeValue = raw?.employeeType || raw?.employeeTypeShort || raw?.employeeTypeName || raw?.EmployeeType;
  const statusValue = raw?.status || raw?.statusShort || raw?.statusName || raw?.Status;
  const offDutyCallBackPhoneRaw =
    raw?.offDutyCallBackPhoneNumber ??
    raw?.offDutyCallbackPhoneNumber ??
    raw?.OffDutyCallBackPhoneNumber ??
    raw?.OffDutyCallbackPhoneNumber;
  const offDutyCallBackEmailRaw =
    raw?.offDutyCallBackEmail ??
    raw?.offDutyCallbackEmail ??
    raw?.OffDutyCallBackEmail ??
    raw?.OffDutyCallbackEmail;

  return {
    employeeID,
    departmentID: String(raw?.departmentID || raw?.DepartmentID || ''),
    employeeTypeID: String(raw?.employeeTypeID || raw?.EmployeeTypeID || employeeTypeValue || ''),
    statusID: String(raw?.statusID || raw?.StatusID || statusValue || ''),
    employeeType: String(employeeTypeValue || ''),
    status: String(statusValue || ''),
    badgeNumber: String(raw?.badgeNumber || raw?.BadgeNumber || ''),
    employeeNumber:
      raw?.employeeNumber != null && raw?.employeeNumber !== ''
        ? String(raw.employeeNumber)
        : raw?.EmployeeNumber != null && raw?.EmployeeNumber !== ''
          ? String((raw as any).EmployeeNumber)
          : undefined,
    firstName: String(raw?.firstName || raw?.FirstName || ''),
    lastName: String(raw?.lastName || raw?.LastName || ''),
    username: String(raw?.userName || raw?.username || raw?.Username || ''),
    password: raw?.password || raw?.Password ? String(raw.password || raw.Password) : undefined,
    primaryPhone: String(raw?.phone || raw?.primaryPhone || raw?.PrimaryPhone || ''),
    secondaryPhone: raw?.altPhone1 || raw?.secondaryPhone || raw?.SecondaryPhone ? String(raw.altPhone1 || raw.secondaryPhone || raw.SecondaryPhone) : null,
    offDutyCallBackPhoneNumber:
      offDutyCallBackPhoneRaw != null && String(offDutyCallBackPhoneRaw).trim() !== ''
        ? String(offDutyCallBackPhoneRaw)
        : null,
    primaryEmail: String(raw?.email || raw?.primaryEmail || raw?.PrimaryEmail || ''),
    secondaryEmail: raw?.homeEmail || raw?.secondaryEmail || raw?.SecondaryEmail ? String(raw.homeEmail || raw.secondaryEmail || raw.SecondaryEmail) : null,
    offDutyCallBackEmail:
      offDutyCallBackEmailRaw != null && String(offDutyCallBackEmailRaw).trim() !== ''
        ? String(offDutyCallBackEmailRaw)
        : null,
    hourlySalary: raw?.hourlySalary !== undefined && raw?.hourlySalary !== null
      ? (typeof raw.hourlySalary === 'number' ? raw.hourlySalary : parseFloat(String(raw.hourlySalary || raw?.HourlySalary || 0)))
      : null,
    hrCostCenterCode: raw?.hrCostCenterCode || raw?.HrCostCenterCode ? String(raw.hrCostCenterCode || raw.HrCostCenterCode) : null,
    divisionID: raw?.divisionID || raw?.DivisionID ? String(raw.divisionID || raw.DivisionID) : null,
    employeeDepartmentDefinedField1: raw?.employeeDepartmentDefinedField1 || raw?.EmployeeDepartmentDefinedField1
      ? String(raw.employeeDepartmentDefinedField1 || raw.EmployeeDepartmentDefinedField1)
      : null,
    employeeDepartmentDefinedField2: raw?.employeeDepartmentDefinedField2 || raw?.EmployeeDepartmentDefinedField2
      ? String(raw.employeeDepartmentDefinedField2 || raw.EmployeeDepartmentDefinedField2)
      : null,
    employeeDepartmentDefinedField3: raw?.employeeDepartmentDefinedField3 || raw?.EmployeeDepartmentDefinedField3
      ? String(raw.employeeDepartmentDefinedField3 || raw.EmployeeDepartmentDefinedField3)
      : null,
    employeeDepartmentDefinedField4: raw?.employeeDepartmentDefinedField4 || raw?.EmployeeDepartmentDefinedField4
      ? String(raw.employeeDepartmentDefinedField4 || raw.EmployeeDepartmentDefinedField4)
      : null,
    // Default to true when field is missing so existing data stays "active"
    isApproved:
      raw?.isApproved !== undefined
        ? Boolean(raw.isApproved)
        : raw?.IsApproved !== undefined
          ? Boolean((raw as any).IsApproved)
          : true,
    isSubsidizedVehicle: Boolean(raw?.isSubsidizedVehicle ?? raw?.IsSubsidizedVehicle ?? false),
    smsTelephoneNumber:
      raw?.smsTelephoneNumber || raw?.SmsTelephoneNumber
        ? String(raw.smsTelephoneNumber || raw.SmsTelephoneNumber)
        : null,
    hasSmsConsent: Boolean(raw?.hasSmsConsent ?? raw?.HasSmsConsent ?? false),
    notifyWhenJobsPosted: Boolean(raw?.notifyWhenJobsPosted ?? raw?.NotifyWhenJobsPosted ?? true),
    notifyJobStartingIn24Hours: Boolean(
      raw?.notifyJobStartingIn24Hours ?? raw?.NotifyJobStartingIn24Hours ?? true
    ),
    notifyJobStartingIn1Hour: Boolean(raw?.notifyJobStartingIn1Hour ?? raw?.NotifyJobStartingIn1Hour ?? true),
    createdDate: raw?.createdDate || raw?.CreatedDate || raw?.appointmentDate || null,
    createdUserID: raw?.createdUserID || raw?.CreatedUserID || null,
    createdBy: raw?.createdBy || raw?.CreatedBy || null,
    editedDate: raw?.editedDate || raw?.EditedDate || raw?.lastTimeTouched || null,
    editedUserID: raw?.editedUserID || raw?.EditedUserID || null,
    editedBy: raw?.editedBy || raw?.EditedBy || null,
    profilePhotoContentType:
      raw?.profilePhotoContentType != null
        ? String(raw.profilePhotoContentType)
        : raw?.ProfilePhotoContentType != null
          ? String(raw.ProfilePhotoContentType)
          : null,
    profilePhotoBase64:
      raw?.profilePhotoBase64 != null
        ? String(raw.profilePhotoBase64)
        : raw?.ProfilePhotoBase64 != null
          ? String(raw.ProfilePhotoBase64)
          : null,
  } as EmployeeResponse;
};

/**
 * Normalize employee status data from API response
 */
export const normalizeEmployeeStatus = (raw: Record<string, unknown>): EmployeeStatusResponse => {
  const employeeStatusID = String(
    raw?.employeeStatusID ?? raw?.EmployeeStatusID ?? ''
  ).trim();
  return {
    ...raw,
    employeeStatusID,
    statusShort: (raw?.statusShort ?? raw?.StatusShort ?? '') as string,
    statusLong: (raw?.statusLong ?? raw?.StatusLong ?? '') as string,
    status:
      raw?.status !== undefined && raw?.status !== null
        ? Boolean(raw.status)
        : raw?.Status !== undefined && raw?.Status !== null
          ? Boolean(raw.Status)
          : true,
  } as EmployeeStatusResponse;
};

/**
 * Normalize equipment type data from API response
 */
export const normalizeEquipmentType = (raw: Record<string, unknown>): EquipmentTypeResponse => {
  const equipementTypeID = (raw?.equipementTypeID || '') as string;
  return {
    ...raw,
    equipementTypeID,
    isVehicle: Boolean(raw?.isVehicle),
    equipementTypeStatus: raw?.equipementTypeStatus ?? true,
  } as EquipmentTypeResponse;
};

/**
 * Normalize response area data from API response (DepartmentResponseArea entity)
 */
export const normalizeResponseArea = (raw: Record<string, unknown>): ResponseAreaResponse => {
  const responseAreaID = (
    raw?.departmentResponseAreaID ??
    raw?.departmentResponseAreaId ??
    raw?.DepartmentResponseAreaID ??
    raw?.DepartmentResponseAreaId ??
    raw?.responseAreaID ??
    raw?.responseAreaId ??
    raw?.ResponseAreaID ??
    raw?.ResponseAreaId ??
    ''
  ) as string;
  const departmentID = (raw?.departmentID ?? raw?.DepartmentID ?? '') as string;
  const responseAreaStatus = (raw?.departmentResponseAreaStatus ??
    raw?.DepartmentResponseAreaStatus ??
    raw?.responseAreaStatus ??
    raw?.ResponseAreaStatus ??
    true) as boolean;
  return {
    responseAreaID,
    departmentID,
    responseAreaShort: (raw?.departmentResponseAreaShort ?? raw?.DepartmentResponseAreaShort ?? raw?.responseAreaShort ?? '') as string,
    responseAreaLong: (raw?.departmentResponseAreaLong ?? raw?.DepartmentResponseAreaLong ?? raw?.responseAreaLong ?? '') as string,
    responseAreaStatus,
    createdDate: (raw?.createdDate ?? raw?.CreatedDate ?? null) as string | null,
    createdUserID: (raw?.createdUserID ?? raw?.CreatedUserID ?? null) as string | null,
    createdBy: (raw?.createdBy ?? raw?.CreatedBy ?? null) as string | null,
    editedDate: (raw?.editedDate ?? raw?.EditedDate ?? null) as string | null,
    editedUserID: (raw?.editedUserID ?? raw?.EditedUserID ?? null) as string | null,
    editedBy: (raw?.editedBy ?? raw?.EditedBy ?? null) as string | null,
  };
};

/**
 * Normalize requester manager data from API response.
 * API uses EmployeeID for the manager (employee) ID; we map to employeeID for UI.
 * API uses RequesterManagerID as the primary key.
 */
export const normalizeRequesterManager = (raw: Record<string, unknown>): RequestManagerResponseDto => {
  const employeeID = String(
    raw?.employeeID ??
    raw?.EmployeeID ??
    raw?.managerId ??
    (raw as any)?.ManagerId ??
    raw?.managerID ??
    raw?.ManagerID ??
    ''
  );

  // API field: RequesterManagerID -> UI: requesterManagerID (primary key). Try all common key variants.
  const requesterManagerIDKeys = [
    'requesterManagerID', 'RequesterManagerID', 'requesterManagerId', 'RequesterManagerId',
    'id', 'Id', 'ID', 'guid', 'Guid', 'GUID', 'requesterManagerGuid', 'RequesterManagerGuid',
  ];
  let requesterManagerID = '';
  for (const k of requesterManagerIDKeys) {
    const v = (raw as Record<string, unknown>)[k];
    if (v != null && String(v).trim() !== '') {
      requesterManagerID = String(v).trim();
      break;
    }
  }

  const isRequestShared = Boolean(raw?.isRequestShared ?? raw?.IsRequestShared ?? false);
  const isEmployeeShared = Boolean(raw?.isEmployeeShared ?? raw?.IsEmployeeShared ?? false);

  return {
    requesterManagerID,
    requesterID: String(
      raw?.requesterID ??
      raw?.RequesterID ??
      // Be tolerant to different casing (requesterId / RequesterId)
      (raw as any)?.requesterId ??
      (raw as any)?.RequesterId ??
      ''
    ),
    employeeID,
    // Keep UI-only Is Shared for display/form convenience.
    isShared: isRequestShared || isEmployeeShared || Boolean(raw?.isShared ?? raw?.IsShared ?? false),
    isRequestShared,
    isEmployeeShared,
    requesterEmployees: Array.isArray(raw?.requesterEmployees || raw?.RequesterEmployees)
      ? ((raw?.requesterEmployees || raw?.RequesterEmployees) as any[]).map((re: any) => normalizeRequesterEmployee(re))
      : [],
    employeeName: (raw as any)?.employeeName ?? (raw as any)?.EmployeeName ?? undefined,
    createdBy: (raw?.createdBy ?? raw?.CreatedBy ?? null) as string | null,
    editedBy: (raw?.editedBy ?? raw?.EditedBy ?? null) as string | null,
    createdDate: (raw?.createdDate ?? raw?.CreatedDate ?? null) as string | null,
    editedDate: (raw?.editedDate ?? raw?.EditedDate ?? null) as string | null,
  };
};

/**
 * Normalize requester employee data from API response.
 * API uses requesterManagerID and isPreferred; we map to managerID and preferred for UI.
 */
export const normalizeRequesterEmployee = (raw: Record<string, unknown>): RequestEmployeeResponseDto => {
  const requesterManagerID = String(raw?.requesterManagerID ?? raw?.RequesterManagerID ?? raw?.managerID ?? raw?.ManagerID ?? '');
  return {
    requesterEmployeeID: String(raw?.requesterEmployeeID ?? raw?.RequesterEmployeeID ?? ''),
    employeeID: String(raw?.employeeID ?? raw?.EmployeeID ?? ''),
    requesterManagerID,
    isPreferred: Boolean(raw?.isPreferred ?? raw?.IsPreferred ?? raw?.preferred ?? raw?.Preferred ?? false),
    employeeName: (raw as any)?.employeeName ?? (raw as any)?.EmployeeName ?? undefined,
    createdBy: (raw?.createdBy ?? raw?.CreatedBy ?? null) as string | null,
    editedBy: (raw?.editedBy ?? raw?.EditedBy ?? null) as string | null,
    createdDate: (raw?.createdDate ?? raw?.CreatedDate ?? null) as string | null,
    editedDate: (raw?.editedDate ?? raw?.EditedDate ?? null) as string | null,
  };
};

/**
 * Normalize requester data from API response
 */
export const normalizeRequester = (raw: Record<string, unknown>): RequesterResponse => {
  const requesterID = String(
    raw?.requesterID ||
      raw?.RequesterID ||
      raw?.requesterId ||
      raw?.RequesterId ||
      ''
  );
  return {
    requesterID,
    departmentDefinedNumber: String(raw?.departmentDefinedNumber || raw?.DepartmentDefinedNumber || ''),
    businessTypeID: String(raw?.businessTypeID || raw?.BusinessTypeID || ''),
    departmentQuestionnaireId: raw?.departmentQuestionnaireId || raw?.DepartmentQuestionnaireId || null,
    businessType: String(raw?.businessType || raw?.BusinessType || ''),
    status: Boolean(raw?.status || raw?.Status || false),
    name: String(
      raw?.name ||
        raw?.Name ||
        raw?.companyName ||
        raw?.CompanyName ||
        raw?.requesterName ||
        raw?.RequesterName ||
        raw?.organizationName ||
        raw?.OrganizationName ||
        ''
    ),
    address: String(raw?.address || raw?.Address || ''),
    address2: String(raw?.address2 || raw?.Address2 || ''),
    city: String(raw?.city || raw?.City || ''),
    state: String(raw?.state || raw?.State || ''),
    zip: String(raw?.zip || raw?.Zip || ''),
    email: String(raw?.email || raw?.Email || ''),
    phone: String(raw?.phone || raw?.Phone || ''),
    primaryContact: String(raw?.primaryContact || raw?.PrimaryContact || ''),
    fax: String(raw?.fax || raw?.Fax || ''),
    secondaryContact: String(raw?.secondaryContact || raw?.SecondaryContact || ''),
    secondaryPhone: String(raw?.secondaryPhone || raw?.SecondaryPhone || ''),
    invoiceBillingName: String(raw?.invoiceBillingName || raw?.InvoiceBillingName || ''),
    invoiceContact: String(raw?.invoiceContact || raw?.InvoiceContact || ''),
    invoiceAddress: String(raw?.invoiceAddress || raw?.InvoiceAddress || ''),
    invoiceAddress2: String(raw?.invoiceAddress2 || raw?.InvoiceAddress2 || ''),
    invoiceCity: String(raw?.invoiceCity || raw?.InvoiceCity || ''),
    invoiceState: String(raw?.invoiceState || raw?.InvoiceState || ''),
    invoiceZip: String(raw?.invoiceZip || raw?.InvoiceZip || ''),
    invoicePhone: String(raw?.invoicePhone || raw?.InvoicePhone || ''),
    invoicePhoneExt: String(raw?.invoicePhoneExt || raw?.InvoicePhoneExt || ''),
    invoiceEmail: String(raw?.invoiceEmail || raw?.InvoiceEmail || ''),
    invoiceFax: String(raw?.invoiceFax || raw?.InvoiceFax || ''),
    isLiquorLicenseRequired: Boolean(raw?.isLiquorLicenseRequired || raw?.IsLiquorLicenseRequired || false),
    liquorLicense: String(raw?.liquorLicense || raw?.LiquorLicense || ''),
    billingNotes: String(raw?.billingNotes || raw?.BillingNotes || ''),
    comments: String(raw?.comments || raw?.Comments || ''),
    approvedForCivilians: Boolean(raw?.approvedForCivilians || raw?.ApprovedForCivilians || false),
    exemptFromExtract: Boolean(raw?.exemptFromExtract || raw?.ExemptFromExtract || false),
    isChild: Boolean(raw?.isChild || raw?.IsChild || false),
    notificationRecipients: String(raw?.notificationRecipients || raw?.NotificationRecipients || ''),
    parentID: String(raw?.parentID || raw?.ParentID || ''),
    // Requester Authorization
    isRequesterAuthorized: Boolean(raw?.isRequesterAuthorized ?? raw?.IsRequesterAuthorized ?? false),
    // Skills requirements (optional)
    isSkillsRequired: Boolean(raw?.isSkillsRequired ?? raw?.IsSkillsRequired ?? false),
    skillIDs: Array.isArray((raw as any)?.skillIDs || (raw as any)?.SkillIDs)
      ? ((raw as any)?.skillIDs || (raw as any)?.SkillIDs).map((id: unknown) => String(id)).filter(Boolean)
      : [],
    createdDate: raw?.createdDate || raw?.CreatedDate || null,
    createdUserID: raw?.createdUserID || raw?.CreatedUserID || null,
    createdBy: raw?.createdBy || raw?.CreatedBy || null,
    editedDate: raw?.editedDate || raw?.EditedDate || null,
    editedUserID: raw?.editedUserID || raw?.EditedUserID || null,
    editedBy: raw?.editedBy || raw?.EditedBy || null,
  } as RequesterResponse;
};

/**
 * Normalize department defined fields data from API response
 */
export const normalizeDepartmentDefinedFields = (raw: Record<string, unknown>): DepartmentDefinedFieldsResponse => {
  const departmentDefinedFieldID = (raw?.departmentDefinedFieldID || raw?.DepartmentDefinedFieldID || '') as string;
  const departmentID = (raw?.departmentID || raw?.DepartmentID || '') as string;
  const departmentName = (raw?.departmentName || raw?.DepartmentName || '') as string;

  return {
    departmentDefinedFieldID,
    departmentID,
    departmentName: departmentName || undefined,
    requestDepartmentDefinedFieldInterfaceLabel1: (raw?.requestDepartmentDefinedFieldInterfaceLabel1 || raw?.RequestDepartmentDefinedFieldInterfaceLabel1 || null) as string | null,
    requestDepartmentDefinedFieldInterfaceLabel2: (raw?.requestDepartmentDefinedFieldInterfaceLabel2 || raw?.RequestDepartmentDefinedFieldInterfaceLabel2 || null) as string | null,
    requestDepartmentDefinedFieldInterfaceLabel3: (raw?.requestDepartmentDefinedFieldInterfaceLabel3 || raw?.RequestDepartmentDefinedFieldInterfaceLabel3 || null) as string | null,
    requestDepartmentDefinedFieldInterfaceLabel4: (raw?.requestDepartmentDefinedFieldInterfaceLabel4 || raw?.RequestDepartmentDefinedFieldInterfaceLabel4 || null) as string | null,
    requestDepartmentDefinedFieldInterfaceLabel5: (raw?.requestDepartmentDefinedFieldInterfaceLabel5 || raw?.RequestDepartmentDefinedFieldInterfaceLabel5 || null) as string | null,
    requestDepartmentDefinedFieldInterfaceLabel6: (raw?.requestDepartmentDefinedFieldInterfaceLabel6 || raw?.RequestDepartmentDefinedFieldInterfaceLabel6 || null) as string | null,
    requestDepartmentDefinedFieldInterfaceLabel7: (raw?.requestDepartmentDefinedFieldInterfaceLabel7 || raw?.RequestDepartmentDefinedFieldInterfaceLabel7 || null) as string | null,
    requestDepartmentDefinedFieldInterfaceLabel8: (raw?.requestDepartmentDefinedFieldInterfaceLabel8 || raw?.RequestDepartmentDefinedFieldInterfaceLabel8 || null) as string | null,
    requestDepartmentDefinedFieldInterfaceLabel9: (raw?.requestDepartmentDefinedFieldInterfaceLabel9 || raw?.RequestDepartmentDefinedFieldInterfaceLabel9 || null) as string | null,
    requestDepartmentDefinedFieldInterfaceLabel10: (raw?.requestDepartmentDefinedFieldInterfaceLabel10 || raw?.RequestDepartmentDefinedFieldInterfaceLabel10 || null) as string | null,
    postDepartmentDefinedFieldInterfaceLabel1: (raw?.postDepartmentDefinedFieldInterfaceLabel1 || raw?.PostDepartmentDefinedFieldInterfaceLabel1 || null) as string | null,
    postDepartmentDefinedFieldInterfaceLabel2: (raw?.postDepartmentDefinedFieldInterfaceLabel2 || raw?.PostDepartmentDefinedFieldInterfaceLabel2 || null) as string | null,
    postDepartmentDefinedFieldInterfaceLabel3: (raw?.postDepartmentDefinedFieldInterfaceLabel3 || raw?.PostDepartmentDefinedFieldInterfaceLabel3 || null) as string | null,
    postDepartmentDefinedFieldInterfaceLabel4: (raw?.postDepartmentDefinedFieldInterfaceLabel4 || raw?.PostDepartmentDefinedFieldInterfaceLabel4 || null) as string | null,
    postDepartmentDefinedFieldInterfaceLabel5: (raw?.postDepartmentDefinedFieldInterfaceLabel5 || raw?.PostDepartmentDefinedFieldInterfaceLabel5 || null) as string | null,
    postDepartmentDefinedFieldInterfaceLabel6: (raw?.postDepartmentDefinedFieldInterfaceLabel6 || raw?.PostDepartmentDefinedFieldInterfaceLabel6 || null) as string | null,
    postDepartmentDefinedFieldInterfaceLabel7: (raw?.postDepartmentDefinedFieldInterfaceLabel7 || raw?.PostDepartmentDefinedFieldInterfaceLabel7 || null) as string | null,
    postDepartmentDefinedFieldInterfaceLabel8: (raw?.postDepartmentDefinedFieldInterfaceLabel8 || raw?.PostDepartmentDefinedFieldInterfaceLabel8 || null) as string | null,
    postDepartmentDefinedFieldInterfaceLabel9: (raw?.postDepartmentDefinedFieldInterfaceLabel9 || raw?.PostDepartmentDefinedFieldInterfaceLabel9 || null) as string | null,
    postDepartmentDefinedFieldInterfaceLabel10: (raw?.postDepartmentDefinedFieldInterfaceLabel10 || raw?.PostDepartmentDefinedFieldInterfaceLabel10 || null) as string | null,
    createdDate: raw?.createdDate || raw?.CreatedDate || null,
    createdUserID: raw?.createdUserID || raw?.CreatedUserID || null,
    createdBy: raw?.createdBy || raw?.CreatedBy || null,
    editedDate: raw?.editedDate || raw?.EditedDate || null,
    editedUserID: raw?.editedUserID || raw?.EditedUserID || null,
    editedBy: raw?.editedBy || raw?.EditedBy || null,
  } as DepartmentDefinedFieldsResponse;
};
/**
 * Normalize routing group data from API response
 */
export const normalizeRoutingGroup = (raw: Record<string, unknown>): RoutingGroupResponse => {
  const routingGroupId = (raw?.routingGroupId ?? raw?.RoutingGroupId ?? raw?.approverID ?? raw?.ApproverID ?? '') as string;

  // Handle employeeIDs which can be an array or a comma-separated string
  let employeeIDs: string[] = [];
  const rawEmployeeIDs = raw?.employeeIDs || raw?.EmployeeIDs;
  if (Array.isArray(rawEmployeeIDs)) {
    employeeIDs = rawEmployeeIDs.map(String);
  } else if (typeof rawEmployeeIDs === 'string' && rawEmployeeIDs) {
    try {
      // Try to parse as JSON array first
      const parsed = JSON.parse(rawEmployeeIDs);
      employeeIDs = Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      // Fall back to comma-separated string
      employeeIDs = rawEmployeeIDs.split(',').map((id: string) => id.trim()).filter(Boolean);
    }
  }

  const rawEmployeeNames = raw?.employeeFirstNames || raw?.EmployeeFirstNames || raw?.employeeNames || raw?.EmployeeNames;
  const employeeNames: string[] = Array.isArray(rawEmployeeNames)
    ? rawEmployeeNames.map(String)
    : [];

  const approvalTypeRaw = raw?.approvalType ?? raw?.ApprovalType;
  const approvalType = (approvalTypeRaw === null || approvalTypeRaw === undefined) ? null : (typeof approvalTypeRaw === 'number' ? approvalTypeRaw : null);

  return {
    routingGroupId,
    employeeIDs,
    approverLong: (raw?.approverLong || raw?.ApproverLong || null) as string | null,
    approverShort: (raw?.approverShort || raw?.ApproverShort || null) as string | null,
    approverEmail: (raw?.approverEmail || raw?.ApproverEmail || null) as string | null,
    approverStatus: raw?.approverStatus !== undefined ? Boolean(raw.approverStatus) :
      raw?.ApproverStatus !== undefined ? Boolean(raw.ApproverStatus) : true,
    approvalType,
    employeeNames: employeeNames.length > 0 ? employeeNames : undefined,
    createdDate: (raw?.createdDate || raw?.CreatedDate || null) as string | null,
    createdUserID: (raw?.createdUserID || raw?.CreatedUserID || null) as string | null,
    createdBy: (raw?.createdBy || raw?.CreatedBy || null) as string | null,
    editedDate: (raw?.editedDate || raw?.EditedDate || null) as string | null,
    editedUserID: (raw?.editedUserID || raw?.EditedUserID || null) as string | null,
    editedBy: (raw?.editedBy || raw?.EditedBy || null) as string | null,
  };
};

/**
 * Normalize block date data from API response
 */
export const normalizeBlockDate = (raw: Record<string, unknown>): BlockDateResponse => {
  const blockDateId = (raw?.blockDateId || raw?.BlockDateId || '') as string;
  return {
    blockDateId,
    requestID: (raw?.requestID ?? raw?.RequestID ?? null) as string | null,
    postID: (raw?.postID ?? raw?.PostID ?? null) as string | null,
    startDateTime: (raw?.startDateTime || raw?.StartDateTime || '') as string,
    endDateTime: (raw?.endDateTime || raw?.EndDateTime || '') as string,
    createdDate: (raw?.createdDate || raw?.CreatedDate || null) as string | null,
    createdUserID: (raw?.createdUserID || raw?.CreatedUserID || null) as string | null,
    createdBy: (raw?.createdBy || raw?.CreatedBy || null) as string | null,
    editedDate: (raw?.editedDate || raw?.EditedDate || null) as string | null,
    editedUserID: (raw?.editedUserID || raw?.EditedUserID || null) as string | null,
    editedBy: (raw?.editedBy || raw?.EditedBy || null) as string | null,
  };
};

/**
 * Normalize requester authorized data from API response
 */
export const normalizeRequesterAuthorized = (raw: Record<string, unknown>): RequesterAuthorized => {
  const requesterAuthorizedID = String(
    raw?.requesterAuthorizedID ?? 
    raw?.RequesterAuthorizedID ?? 
    raw?.requesterAuthorizedId ?? 
    raw?.RequesterAuthorizedId ?? 
    raw?.id ?? 
    raw?.Id ?? 
    raw?.ID ?? 
    ''
  ).trim();

  return {
    requesterAuthorizedID,
    requesterID: String(
      raw?.requesterID ?? 
      raw?.RequesterID ?? 
      raw?.requesterId ?? 
      raw?.RequesterId ?? 
      ''
    ).trim(),
    firstName: String(
      raw?.firstName ?? 
      raw?.FirstName ?? 
      raw?.firstname ?? 
      raw?.Firstname ?? 
      ''
    ).trim(),
    lastName: String(
      raw?.lastName ?? 
      raw?.LastName ?? 
      raw?.lastname ?? 
      raw?.Lastname ?? 
      ''
    ).trim(),
    primaryPhone: String(
      raw?.primaryPhone ?? 
      raw?.PrimaryPhone ?? 
      raw?.phone ?? 
      raw?.Phone ?? 
      ''
    ).trim(),
    secondaryPhone: String(
      raw?.secondaryPhone ?? 
      raw?.SecondaryPhone ?? 
      raw?.secondaryPhone ?? 
      raw?.SecondaryPhone ?? 
      ''
    ).trim(),
    primaryEmail: String(
      raw?.primaryEmail ?? 
      raw?.PrimaryEmail ?? 
      raw?.email ?? 
      raw?.Email ?? 
      ''
    ).trim(),
    secondaryEmail: String(
      raw?.secondaryEmail ?? 
      raw?.SecondaryEmail ?? 
      raw?.secondaryEmail ?? 
      raw?.SecondaryEmail ?? 
      ''
    ).trim(),
    status: Number(raw?.status ?? raw?.Status ?? 1),
    createdBy: (raw?.createdBy ?? raw?.CreatedBy ?? null) as string | null,
    editedBy: (raw?.editedBy ?? raw?.EditedBy ?? null) as string | null,
    createdDate: (raw?.createdDate ?? raw?.CreatedDate ?? null) as string | null,
    editedDate: (raw?.editedDate ?? raw?.EditedDate ?? null) as string | null,
  };
};

