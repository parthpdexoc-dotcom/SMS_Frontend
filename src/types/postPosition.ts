/** Mirrors backend `SMS.Generic.Enums.PostPositionStatus`. */
import type { SearchModel } from '@/types/availablePost';

export enum PostPositionStatus {
    Assigned = 1,
    Closed = 2,
    Cancelled = 3,
    ClosedAndSplit = 4,
    SplitDecisionPending = 5,
    Declined = 6,
    Waiting = 10,
    Unclosed = 11,
    Transferred = 13,
    CancellationPending = 14,
    /** Employee applied to a special-event request (dynamic post, no concrete post id yet). Mirrors backend. */
    SpecialEvent = 15,
}

/** Fetched together for the "Post Ready To Close" tab. */
export const POST_READY_TO_CLOSE_STATUS_FILTER: readonly PostPositionStatus[] = [
    PostPositionStatus.Assigned,
    PostPositionStatus.SplitDecisionPending,
    PostPositionStatus.Unclosed,
];

/**
 * Redux cache key for `postPosition` status lists (`positionsByStatus`, `paginationByStatus`, …).
 * Includes `isOngoing` so Assigned scheduled vs ready-to-close stay separate.
 */
export function postPositionListStateKey(statusEnum: number, isOngoing: boolean): string {
    return `${statusEnum}:${isOngoing}`;
}

export interface PostPositionResponse {
    postPositionId: string;
    postID: string;
    employeeID?: string;
    employeeName?: string;
    employeeFirstName?: string;
    employeeLastName?: string;
    requestID?: string; // Request ID to fetch request and requester details
    postTitle?: string;
    badgeNumber?: string; // Mapped from backend DTO, might be null
    firstName?: string;
    lastName?: string;
    employeeTypeName?: string;
    primaryPhone?: string;
    dateOfWork: string;
    /** New field from backend DTO - preferred over dateOfWork */
    startDate?: string;
    postStartTime?: string; // Backend field name for time (HH:mm:ss format)
    /** Scheduled end time from API (e.g. view-details); HH:mm */
    postEndTime?: string;
    lengthOfWork: number;
    /** Post length in minutes (alias from API, fallback for lengthOfWork) */
    postLength?: number;
    equipmentRequired: boolean;
    /** New field from backend DTO - preferred over equipmentRequired */
    requiresEquipment?: boolean;
    postRequiresVehicle?: boolean; // Whether vehicle is required for this post (from Post entity)
    /** New field from backend DTO - preferred over postRequiresVehicle */
    requiresVehicle?: boolean;
    vehicleRequired?: boolean; // Legacy field name (fallback)
    callSign?: string;
    postCallSignID?: string | null;
    defineCallSign?: boolean | null;
    postPositionStatus: number;
    postLocation?: string; // Location of the post
    postDescription?: string;
    postNotes?: string;
    postPayRate?: number;
    /** Pay rate locked on the post position (view-details). */
    postPositionPayRate?: number;
    isPremiumPaidEvent?: boolean;
    postPremiumRate?: number;
    postIsFlexible?: boolean;
    postRequiresEquipment?: boolean;
    isSkillsRequired?: boolean;
    rankEligible?: boolean;
    isPostRequiredDocument?: boolean;
    totalPostPositions?: number;
    postDepartmentDefinedFieldValue1?: string;
    postDepartmentDefinedFieldValue2?: string;
    postDepartmentDefinedFieldValue3?: string;
    postDepartmentDefinedFieldValue4?: string;
    postDepartmentDefinedFieldValue5?: string;
    postDepartmentDefinedFieldValue6?: string;
    postDepartmentDefinedFieldValue7?: string;
    postDepartmentDefinedFieldValue8?: string;
    postDepartmentDefinedFieldValue9?: string;
    postDepartmentDefinedFieldValue10?: string;
    createdDate?: string;
    createdUserID?: string;
    createdBy?: string;
    editedDate?: string | null;
    editedUserID?: string | null;
    editedBy?: string | null;
    /** Split status: 0 = pending, other values indicate different states */
    splitStatus?: number;
    /** Parent post position ID when this is a split position (camelCase from API) */
    parentPostPositionId?: string | null;
    /** Split post position ID (PascalCase from API) */
    splitPostPositionID?: string | null;
    /** Whether this is a split position */
    isSplit?: boolean;
    /** Closed post position ID for split requests */
    closedPostPositionID?: string | null;
    /** Server-driven flag to disable Unclose action in Close Assignments. */
    isUncloseDisabled?: boolean;
    /** Indicates this post position was unclosed before; disables Unclose action. */
    wasUnclosed?: boolean;
    /** Virtual placeholder assignment (no employee profile). */
    isPlaceholder?: boolean;
    /** Linked placeholder profile id when <see cref="isPlaceholder"/> is true. */
    placeholderId?: string;
    /** Invoice/payroll flag on the post position (placeholder rows only). */
    enableInvoiceAndPayroll?: boolean;
    /** Placeholder assignment is unique to this post (from linked placeholder). */
    isUniquePerPosition: boolean;
    /** From assigned employee (view-details); drives default Vehicle Owned By on close form. */
    isSubsidizedVehicle?: boolean;
}

export interface PostPositionFilter {
    postID?: string; // Implicitly used in endpoint logic usually, but good to have
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
    page?: number;
    pageSize?: number;
    limit?: number; // For offset/limit pagination mode
    isOngoing?: boolean; // Backend flag to distinguish ongoing vs history
    /** Optional employee filter for admin views (fallbacks to current user when omitted). */
    employeeID?: string;
    /** Optional requester filter for close assignments / admin views. */
    requesterID?: string;
    searchTerm?: string;
    /** Optional start date filter for close assignments */
    startDate?: string;
    /** Optional end date filter for close assignments */
    endDate?: string;
    /** Exact work dates for GET /PostPosition/by-post/{postId} (`List<DateOnly>` query). */
    dates?: string[];
    /** When true, includes past-date assignments (Daily Administration Completed filter). */
    includeCompleted?: boolean;
    /**
     * GET `/PostPosition/by-post/{postId}` — when false, only Assigned rows; when true, all statuses.
     * Omit to use the API default (`true`).
     */
    isViewHistory?: boolean;
    /** Release-status filter — same values as requester-with-requests `requestStatuses`. */
    requestStatuses?: number[];
    /** Optional search window / release / requester filters (by-statuses `SearchModel`). */
    searchModel?: SearchModel;
    /** When true, returns only placeholder post positions. */
    isPlaceholder?: boolean;
}
export type PostPositionListParams = PostPositionFilter;

/** Parameters for sending assignment invite email */
export interface SendAssignPostEmailParams {
    employeeId: string;
    postTitle: string;
    dateOfWork?: string | null;
    startTime?: string | null;
    postLength?: number | null;
    postLocation?: string | null;
}

/** Parameters for sendAssignPostEmail thunk */
export interface SendAssignPostEmailThunkArg {
    postPositionId: string;
    employeeId: string;
    postTitle: string;
    dateOfWork?: string | null;
    startTime?: string | null;
    postLength?: number | null;
    postLocation?: string | null;
}

/** Normalized client shape for PostPositionAndWaitingListForDateDto */
export interface PostPositionAssignmentsAndWaitingListForDate {
    assignments: PostPositionResponse[];
    waitingList: PostPositionResponse[];
}

/** Query param name for assigning by PostCallSign id via `PUT .../updatecallsign`. */
export const POST_POSITION_POST_CALL_SIGN_ID_FIELD_NAME = 'postCallSignID';

/** Query param name expected by `PUT .../updatecallsign` ([FromQuery] fieldName). */
export const POST_POSITION_CALL_SIGN_FIELD_NAME = 'callSign';

/**
 * Returns true if defineCallSign is explicitly enabled (handles boolean true, string 'true', or number 1).
 * Returns false if boolean false, string 'false', 0, null, or undefined.
 */
export function isDefineCallSignEnabled(
  row?: { defineCallSign?: boolean | string | number | null } | null,
  post?: { defineCallSign?: boolean | string | number | null } | null
): boolean {
  const val = row?.defineCallSign ?? post?.defineCallSign;
  return val === true || val === 'true' || val === 1 || val === '1';
}
