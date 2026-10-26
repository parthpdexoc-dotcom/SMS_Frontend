import type { ReleaseAs } from './request';

/**
 * Matches backend WaitingPostPositionDto (camelCase from API).
 * Used for "my waiting post positions" list; table displays same shape as post position.
 */
export interface TenureWaitingPositionResponse {
  waitingPostPositionId?: string;
  postID?: string;
  /** Request key for special-event rows; API often sends `requestId` (camelCase) — normalized to this in `getMyTenureWaitingPositions`. */
  requestID?: string;
  totalPostPositions?: number;
  message?: string | null;
  createdBy?: string;
  postPositionStatus?: number;
  processingStatus?: number | string;
  statusCode?: number;
  resultMessage?: string;
  processedAt?: string;
  /** Backend enum ReleaseAs (serialized as number). */
  releaseAs?: number;
  dateOfWork?: string;
  /** True when already applied/assigned from this tenure waiting-list row. */
  hasAppliedInTenure?: boolean;
  startTime?: string;
  lengthOfWork?: number;
  equipmentRequired?: boolean;
  callSign?: string;
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
  post?: {
    postTitle?: string;
    postID?: string;
    requestID?: string;
    /** Backend PostDto.PostRequiresVehicle (camelCase) */
    postRequiresVehicle?: boolean;
    requiresVehicle?: boolean;
    isVehicleRequired?: boolean;
  };
  /** Alias for table: time display (HH:mm) */
  postStartTime?: string;
  /** Alias for table: from post */
  postTitle?: string;
  postRequiresVehicle?: boolean;
  badgeNumber?: string;
  firstName?: string;
  lastName?: string;
  primaryPhone?: string;
  primaryEmail?: string;
}

/**
 * Filters for POST `WaitingPostPosition/my-tenure-waiting-positions`.
 * `releaseAs` selects the UI tab only; the service maps it to the body array
 * (tenure: [TenureBased]; general: Open, Managed, Preferred, Cancelled, General).
 */
export interface TenureWaitingPositionFilter {
  releaseAs: ReleaseAs;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  /**
   * Query on POST my-tenure-waiting-positions — when true, includes past rows;
   * when false, only future rows (department timezone).
   */
  isViewWLHistory?: boolean;
}
