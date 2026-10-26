/**
 * Unified list row from backend `EmployeePostListingItemDto`.
 * Returned by: available-post, my-post-positions/by-statuses, latest-per-post-position, my-tenure-waiting-positions.
 */
export interface EmployeePostListingItem {
  requestID: string;
  postID: string;
  /** Display title; from API `title` (unified per `isSpecialEvent`), stored as `postTitle` on the client model. */
  postTitle: string;
  postLocation: string | null;
  postLength: number;
  totalPositions: number;
  availablePositions: number | null;
  isSpecialEvent: boolean | null;
  releaseAs: number;
  postPositionId: string | null;
  postPositionStatus: number;
  parentPostPositionId: string | null;
  isSplit: boolean | null;
  splitPostPositionID: string | null;
  showVehicle: boolean | null;
  showEquipment: boolean | null;
  startDate: string;
  /** API: `dayofweek` / `dayOfWeek` — e.g. "TUE" for Available Jobs date column. */
  dayOfWeek?: string | null;
  /** API: `jobrank` / `jobRank` — displayed in Available Jobs Rank column. */
  jobRank?: string | null;
  startTime: string;
  postEndTime?: string | null;
  payCodeValue?: string | null;
  workStartTime?: string | null;
  workEndTime?: string | null;
  /** Actual minutes worked (close-assignments / closed post DTOs). */
  hoursWorked?: number | null;
  closedPostPositionID: string | null;
  waitingPostPositionId: string | null;
  orderNumber: number;
  /** API: `hasAppliedInTenure` — employee already applied/assigned from this tenure waiting row. */
  hasAppliedInTenure: boolean;
  processingStatus: number;
  requestTitle: string | null;
  /** API: `requesterID` — used for dashboard requester filter. */
  requesterID?: string | null;
  /** API: `requesterTitle` — display name for the requester on list rows. */
  requesterTitle?: string | null;
  failureReason: string | null;
  /** Assigned employee (close-assignments / post listing DTOs). */
  employeeID?: string | null;
  /** Display name from API when provided. */
  employeeName?: string | null;
  /** Who cancelled the slot; API: `cancelledBy` (e.g. by-statuses / Cancelled Jobs). */
  cancelledBy?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  badgeNumber?: string | null;
  /** API: post was unclosed before; UI should disable Unclose. */
  wasUnclosed?: boolean | null;
  /** API: explicit server flag to disable Unclose. */
  isUncloseDisabled?: boolean | null;
  /** API: placeholder assignment (no real employee); UI may hide split, etc. */
  isPlaceholder?: boolean | null;
  /**
   * Close assignments (`ClosedPostPosition/.../close-assignments`): who closed the assignment (display name from API).
   */
  closeBy?: string | null;
  /** Optional audit field when API sends who created/closed a row. */
  createdBy?: string | null;
}

/** Pagination/sort query for tenure waiting list (and similar paged listing endpoints). */
export interface EmployeePostListingPaginationFilter {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}
