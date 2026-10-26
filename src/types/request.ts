import type { RequestEquipmentDto } from '@/services/requestEquipmentService';
import type { PagedResponse, PageParam } from '@/types/common';
import type { RequestWithLocationsDto } from '@/types/employeePostLocation';
import type { Post } from './post';
import { RecurrenceUnit } from './recurrence';

/**
 * Request Status enum - matches backend RequestStatus enum
 * @deprecated Use RequestStatus instead. Kept for backward compatibility.
 */
export enum ReleaseStatus {
  Pending = 0,
  ReleaseNow = 1,
  ReleasedOn = 2,
  Cancelled = 3,
  Completed = 4,
}

/**
 * Request Status enum - matches backend RequestStatus enum
 */
export enum RequestStatus {
  Pending = 0,
  ReleaseNow = 1,
  ReleasedOn = 2,
  Cancelled = 3,
  Completed = 4,
}

/**
 * Request recurrence / schedule kind — matches backend `RequestTypes` enum.
 */
export enum RequestTypes {
  OneTime = 1,
  Daily = 2,
  Weekly = 3,
  Monthly = 4,
  Custom = 5,
}

/**
 * Release As enum - matches backend ReleaseAs enum
 */
export enum ReleaseAs {
  Open = 0,
  TenureBased = 1,
  Managed = 2,
  Preferred = 3,
  Cancelled = 4,
  /** Matches backend ReleaseAs.General — used for “My Waiting List” general tab API filter. */
  General = 5,
}

export interface RequestResponse {
  requestID: string;
  requesterID: string;
  requesterManagerID?: string | null;
  requesterAuthorizedID?: string | null;
  /** Department that owns the request (used for equipment/vehicle lookup when present). */
  departmentID?: string | null;
  enableWaitingList: boolean;
  firstName: string;
  lastName: string;
  primaryPhone: string;
  cellPhone?: string;
  secondaryPhone?: string;
  alternateCellPhone?: string;
  primaryEmail?: string;
  secondaryEmail?: string;
  isPostContact: boolean;
  startDate: string; // ISO Date "2026-01-01"
  endDate: string;   // ISO Date "2026-01-01"
  /** Fiscal year for invoice project number (from backend RequestDto.FiscalYear) */
  fiscalYear?: number | null;
  /** Project number (not including fiscal year) (from backend RequestDto.ProjectNumber) */
  projectNumber?: string | null;
  title: string;
  location: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  postLocationsAreStationary: boolean;
  requiresPermit: boolean;
  permitNumber?: string;
  isSpecialEvent: boolean;
  isPremiumPaidEvent?: boolean;
  specialEventApproved?: boolean;
  requiresLiquorLicense: boolean;
  liquorLicenseNumber?: string;
  alcoholPermitRequired?: boolean;
  specialRate?: number | null;
  requiresVehicle: boolean;
  requiresVehicleAtEveryPost: boolean;
  numberOfVehicles?: number;
  vehicleApproved?: boolean;
  requiresEquipment: boolean;
  requiresEquipmentAtEachPost: boolean;
  numberOfEquipment?: number;
  isSkillRequired: boolean;
  skillIDs?: string[];
  departmentDefinedFieldValue1?: string;
  departmentDefinedFieldValue2?: string;
  departmentDefinedFieldValue3?: string;
  departmentDefinedFieldValue4?: string;
  departmentDefinedFieldValue5?: string;
  departmentDefinedFieldValue6?: string;
  departmentDefinedFieldValue7?: string;
  departmentDefinedFieldValue8?: string;
  departmentDefinedFieldValue9?: string;
  departmentDefinedFieldValue10?: string;
  requestHasBeenUpdated: boolean;
  requestType?: RequestTypeDto;
  DepartmentResponseAreaId?: string | null;
  departmentResponseAreaID?: string | null; // API response may use camelCase
  releaseAs?: ReleaseAs | null;
  /** Scheduling and release fields moved to RequestSchedule table. */
  requestSchedule?: RequestScheduleDto | null;
  requestSchedules?: RequestScheduleDto[] | null;
  posts?: Post[];
  enableFees?: boolean;
  selectedDepartmentFeeIds?: string[];
  /** Post count from API (PascalCase from .NET) */
  /** Post count from API (camelCase from JSON) */
  postCount?: number;
  /** Request equipment/vehicles when returned by GET Request (avoids separate RequestEquipment call). */
  requestEquipment?: RequestEquipmentDto[] | null;
  createdDate: string;
  createdUserID?: string;
  createdBy?: string;
  editedDate?: string | null;
  editedUserID?: string | null;
  editedBy?: string | null;
}

export interface RequestTypeDto {
  requestTypeID: string;
  requestID: string;
  requestType: number; // Formerly RecurrenceUnit
  repeatEvery: number; // Formerly Interval
  daysOfWeek?: number[]; // Formerly WeekDays
  daysOfMonth?: number[]; // Formerly MonthDays
  monthlyMode?: number;
  weekIndex?: number;
}

/**
 * Request schedule "Release for" (Add Schedule modal).
 * 0 = from scheduled time; 1, 24, 48, 72 = hours before release window.
 */
export type ScheduleReleaseHours = 0 | 1 | 24 | 48 | 72;

export interface RequestScheduleDto {
  requestScheduleID?: string;
  requestId?: string;
  isActive?: boolean;
  startDate?: string | null;
  endDate?: string | null;
  releaseAs: ReleaseAs;
  requestStatus: RequestStatus;
  scheduleDate?: string | null;
  scheduledTime?: string | null;
  processDate?: string | null;
  processTime?: string | null;
  /** 0 = from scheduled time; 1, 24, 48, 72 = hours (JSON: releaseHours; legacy responses may use scheduleReleaseHours). */
  releaseHours?: ScheduleReleaseHours | null;
  processedAt?: string | null;
  processingStatus?: number | string;
  processingResult?: string | null;
  processingJobId?: string | null;
  /** Set to true on first save after cloning a request (maps to `IsCloned` on upsert). */
  isCloned?: boolean;
  /** When true, auto-generate leaves this row unchanged and builds schedules after it. */
  preserveOnRegenerate?: boolean;
  /** Present on Generate Schedule responses with the number of rows created. */
  generatedScheduleCount?: number | null;
  /** Set when tenure rows were skipped because the process date is the work day. */
  generationWarning?: string | null;
}

/** Schedule row from `RequestScheduleInRequesterListDto`. */
export interface RequestScheduleInRequesterListDto {
  requestScheduleID: string;
  startDate?: string | null;
  endDate?: string | null;
  releaseStatus: string;
  releaseAs: string;
  requestStatus?: number | string | null;
  scheduleDate?: string | null;
  scheduledTime?: string | null;
  processDate?: string | null;
  processTime?: string | null;
  releaseHours?: number | null;
}

/** Request row from `RequestInRequesterListDto` (POST `/Request/requester-requests`). */
export interface RequestInRequesterListDto {
  requestId: string;
  startDate: string;
  endDate: string;
  name?: string | null;
  projectNumber?: string | null;
  requestType?: RequestTypeDto | null;
  releaseStatus: string;
  requestSchedules: RequestScheduleInRequesterListDto[];
  postCount: number;
}

/** Response from `RequesterRequestsResponseDto` (POST `/Request/requester-requests`). */
export interface RequesterRequestsResponseDto extends PagedResponse<RequestInRequesterListDto> {
  hasUnpaidInvoice: boolean;
  totalRequestCount: number;
  totalPostCount: number;
}

/** Response from POST `/Request/requester-requests-with-locations` (nested posts/positions/locations). */
export interface RequesterRequestsWithLocationsResponseDto
  extends PagedResponse<RequestWithLocationsDto> {
  hasUnpaidInvoice: boolean;
  totalRequestCount: number;
  totalPostCount: number;
}

/** Filter body for `RequesterRequestsFilterDto`. */
export interface RequesterRequestsFilter {
  requesterId: string;
  startDate?: string;
  endDate?: string;
  requestStatuses?: number[];
  requestTypes?: number[];
  /** Schedule release types. */
  releaseAs?: number[];
  /** When true, start/end dates filter schedule dates and only those rows are returned. */
  applyDateOnSchedules?: boolean;
  search?: string;
  pageParam?: PageParam;
}

/** Post row from `PostInRequestListDto` (POST `/Post/request-posts`). */
export interface PostInRequestListDto {
  postId: string;
  postTitle: string;
  postStartTime: string;
  postEndTime: string;
  postLocation: string;
  totalPositions: number;
  isSupervisorPost: boolean;
  postParentId?: string | null;
  level?: string | null;
  defineCallSign?: boolean | null;
}

/** Response from `RequestPostsResponseDto` (POST `/Post/request-posts`). */
export interface RequestPostsResponseDto {
  totalPostCount: number;
  totalPositionCount: number;
  posts: PostInRequestListDto[];
}

/** Filter body for `RequestPostsFilterDto`. */
export interface RequestPostsFilter {
  requestId: string;
  search?: string;
  pageParam?: PageParam;
}

/** Position row from `PostPositionInRequestListDto` (POST `/PostPosition/by-post/filter`). */
export interface PostPositionInRequestListDto {
  postPositionId: string;
  postCallSignId?: string | null;
  callSign?: string | null;
  employeeName?: string | null;
  dateOfWork?: string | null;
  employeeType?: string | null;
  badgeNumber?: string | null;
  phone?: string | null;
  status: number;
  isPlaceholder: boolean;
  placeholderId?: string | null;
  defineCallSign?: boolean | null;
}

/** Response from `RequestPostPositionsResponseDto` (POST `/PostPosition/by-post/filter`). */
export interface RequestPostPositionsResponseDto extends PagedResponse<PostPositionInRequestListDto> {
  dates: string[];
}

/** Filter body for `RequestPostPositionsFilterDto`. */
export interface RequestPostPositionsFilter {
  postId: string;
  startDate?: string;
  endDate?: string;
  dates?: string[];
  requestStatuses?: number[];
  includeCompleted?: boolean;
  /**
   * Query param on POST `/PostPosition/by-post/filter`.
   * When false, only Assigned rows (Current Assigned).
   * When true, all statuses (Assigned History).
   * Omit to use the API default (`true`).
   */
  isViewHistory?: boolean;
  pageParam?: PageParam;
}

export interface CreateRequestRequest {
  requesterID: string;
  requesterManagerID?: string | null;
  requesterAuthorizedID?: string | null;
  enableWaitingList: boolean;
  firstName: string;
  lastName: string;
  primaryPhone: string;
  cellPhone?: string;
  secondaryPhone?: string;
  alternateCellPhone?: string;
  primaryEmail?: string;
  secondaryEmail?: string;
  isPostContact: boolean;
  startDate: string;
  endDate: string;
  title: string;
  location: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  postLocationsAreStationary: boolean;
  requiresPermit: boolean;
  permitNumber?: string;
  isSpecialEvent: boolean;
  isPremiumPaidEvent?: boolean;
  /** Explicit admin confirmation for premium pay-rate conflict during request update. */
  confirmConflict?: boolean;
  specialEventApproved?: boolean;
  requiresLiquorLicense: boolean;
  liquorLicenseNumber?: string;
  alcoholPermitRequired?: boolean;
  specialRate?: number | null;
  requiresVehicle: boolean;
  requiresVehicleAtEveryPost: boolean;
  numberOfVehicles?: number;
  vehicleApproved?: boolean;
  requiresEquipment: boolean;
  requiresEquipmentAtEachPost: boolean;
  numberOfEquipment?: number;
  isSkillRequired: boolean;
  skillIDs?: string[];
  /** Number of days the request is released for (used for recurring requests). */
  releaseDays?: number | null;
  departmentDefinedFieldValue1?: string;
  departmentDefinedFieldValue2?: string;
  departmentDefinedFieldValue3?: string;
  departmentDefinedFieldValue4?: string;
  departmentDefinedFieldValue5?: string;
  departmentDefinedFieldValue6?: string;
  departmentDefinedFieldValue7?: string;
  departmentDefinedFieldValue8?: string;
  departmentDefinedFieldValue9?: string;
  departmentDefinedFieldValue10?: string;
  requestHasBeenUpdated: boolean;
  // Renamed from recurrence to requestType to match backend DTO
  requestType?: Partial<RequestTypeDto>;
  DepartmentResponseAreaId?: string | null;
  // Kept for compatibility in UI state, but sent under RequestSchedule in payload transform.
  requestStatus: RequestStatus;
  releaseAs: ReleaseAs;
  scheduleDate?: string | null;
  scheduledTime?: string | null;
  processDate?: string | null;
  processTime?: string | null;
  posts?: Post[];
  enableFees?: boolean;
  selectedDepartmentFeeIds?: string[];
  /** Post positions to transfer on one-time date change despite time overlap (maps to `TransferWithConflictPostPositionIds`). */
  transferWithConflictPostPositionIds?: string[];
}

export interface UpdateRequestRequest extends CreateRequestRequest {
  requestID: string;
}

export interface RequestListParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  requesterID?: string;
  startDate?: string;
  endDate?: string;
}

/** Normalize address fields whether API returned camelCase or PascalCase keys. */
function pickAddressFieldsFromRequest(source: RequestResponse): Pick<
  CreateRequestRequest,
  'address' | 'city' | 'state' | 'zip'
> {
  const raw = source as unknown as Record<string, unknown>;
  return {
    address: (source.address ?? raw.Address ?? null) as string | null,
    city: (source.city ?? raw.City ?? null) as string | null,
    state: (source.state ?? raw.State ?? null) as string | null,
    zip: (source.zip ?? raw.Zip ?? null) as string | null,
  };
}

/**
 * Sanitize requestType for create/upsert. Backend requires:
 * - DaysOfWeek only for weekly; must be omitted or empty for non-weekly.
 * - DaysOfMonth only for monthly; must be omitted or empty for non-monthly.
 * Build a minimal object (like post clone) and omit these keys when not applicable.
 */
function sanitizeRequestTypeForCreate(
  rt: RequestTypeDto | undefined
): CreateRequestRequest['requestType'] {
  if (!rt) return undefined;
  const typeNum = rt.requestType ?? 0;
  const isWeekly = typeNum === RecurrenceUnit.WEEK;
  const isMonthly = typeNum === RecurrenceUnit.MONTH;
  const out: CreateRequestRequest['requestType'] = {
    requestType: typeNum,
    repeatEvery: rt.repeatEvery ?? 1,
    monthlyMode: rt.monthlyMode,
    weekIndex: rt.weekIndex,
  };
  if (isWeekly) out.daysOfWeek = rt.daysOfWeek ?? [];
  if (isMonthly) out.daysOfMonth = rt.daysOfMonth ?? [];
  return out;
}

/**
 * Prepare a request object to be used as the basis for creating a cloned request.
 * Clears identifiers and audit fields and associates the new request with the same requester.
 * Uses the original as a source template. Posts are created separately after the request.
 */
export const prepareClonedRequestForCreate = (source: RequestResponse): CreateRequestRequest => ({
  requesterID: source.requesterID,
  enableWaitingList: source.enableWaitingList,
  firstName: source.firstName,
  lastName: source.lastName,
  primaryPhone: source.primaryPhone,
  cellPhone: source.cellPhone,
  secondaryPhone: source.secondaryPhone,
  alternateCellPhone: source.alternateCellPhone,
  primaryEmail: source.primaryEmail,
  secondaryEmail: source.secondaryEmail,
  isPostContact: source.isPostContact,
  startDate: source.startDate,
  endDate: source.endDate,
  title: source.title,
  location: source.location,
  ...pickAddressFieldsFromRequest(source),
  postLocationsAreStationary: source.postLocationsAreStationary,
  requiresPermit: source.requiresPermit,
  permitNumber: source.requiresPermit ? source.permitNumber : undefined,
  isSpecialEvent: source.isSpecialEvent,
  isPremiumPaidEvent: source.isPremiumPaidEvent ?? false,
  specialEventApproved: source.specialEventApproved,
  requiresLiquorLicense: source.requiresLiquorLicense,
  liquorLicenseNumber: source.requiresLiquorLicense ? source.liquorLicenseNumber : undefined,
  alcoholPermitRequired: source.alcoholPermitRequired,
  specialRate: source.specialRate ?? null,
  requiresVehicle: source.requiresVehicle,
  requiresVehicleAtEveryPost: source.requiresVehicleAtEveryPost,
  numberOfVehicles: source.numberOfVehicles,
  vehicleApproved: source.vehicleApproved,
  requiresEquipment: source.requiresEquipment,
  requiresEquipmentAtEachPost: source.requiresEquipmentAtEachPost,
  numberOfEquipment: source.numberOfEquipment,
  isSkillRequired: source.isSkillRequired,
  skillIDs: source.skillIDs,
  departmentDefinedFieldValue1: source.departmentDefinedFieldValue1,
  departmentDefinedFieldValue2: source.departmentDefinedFieldValue2,
  departmentDefinedFieldValue3: source.departmentDefinedFieldValue3,
  departmentDefinedFieldValue4: source.departmentDefinedFieldValue4,
  departmentDefinedFieldValue5: source.departmentDefinedFieldValue5,
  departmentDefinedFieldValue6: source.departmentDefinedFieldValue6,
  departmentDefinedFieldValue7: source.departmentDefinedFieldValue7,
  departmentDefinedFieldValue8: source.departmentDefinedFieldValue8,
  departmentDefinedFieldValue9: source.departmentDefinedFieldValue9,
  departmentDefinedFieldValue10: source.departmentDefinedFieldValue10,
  requestHasBeenUpdated: false,
  requestType: sanitizeRequestTypeForCreate(source.requestType),
  DepartmentResponseAreaId: source.DepartmentResponseAreaId ?? source.departmentResponseAreaID ?? null,
  requestStatus: source.requestSchedule?.requestStatus ?? RequestStatus.Pending,
  releaseAs: source.releaseAs ?? source.requestSchedule?.releaseAs ?? ReleaseAs.Open,
  scheduleDate: source.requestSchedule?.scheduleDate ?? null,
  scheduledTime: source.requestSchedule?.scheduledTime ?? null,
  processDate: source.requestSchedule?.processDate ?? null,
  processTime: source.requestSchedule?.processTime ?? null,
  posts: [],
});

/** Matches backend `RequestOneTimeDateChangeAssignmentDto`. */
export interface RequestOneTimeDateChangeAssignmentDto {
  postPositionID: string;
  employeeID: string;
  employeeName: string;
  postTitle: string | null;
  dateOfWork: string;
  newDateOfWork?: string | null;
  startTime: string;
  endTime: string;
  duration: number;
  hasTimeConflict: boolean;
}

/** Matches backend `RequestOneTimeDateChangeConflictDto`. */
export interface RequestOneTimeDateChangeConflictDto {
  message: string;
  assignedPostPositions: RequestOneTimeDateChangeAssignmentDto[];
}

export interface RequestFilter {
  requesterID?: string;
  startDate?: string;
  endDate?: string;
}
