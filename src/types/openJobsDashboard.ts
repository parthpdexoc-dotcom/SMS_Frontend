/**
 * Requester-manager open jobs dashboard — grouped by request + date of work, nested posts (`openJobs`).
 */

/** One post row inside `openJobs` from the API. */
export interface OpenJobsDashboardPostRow {
  postID: string;
  postTitle: string;
  totalPostPositions: number;
  dayOfWeek: string;
  /** YYYY-MM-DD */
  startDate: string;
  /** HH:mm for display */
  startTimeDisplay: string;
  /** HH:mm for display */
  endTimeDisplay: string;
  open: number;
  filled: number;
  pendingCancellation: number;
}

/** One paginated row: request summary for a single work date + nested open job posts. */
export interface OpenJobsDashboardGroup {
  requestID: string;
  requestTitle: string;
  requestUniqueNumber: string;
  requesterName: string;
  /** YYYY-MM-DD — work date for rows in `openJobs` */
  dateOfWork: string;
  totalPositions: number;
  totalOpen: number;
  totalFilled: number;
  totalCancel: number;
  openJobs: OpenJobsDashboardPostRow[];
}

export interface OpenJobsDashboardFetchParams {
  startDate: string;
  /** Inclusive end date (YYYY-MM-DD); route segment matches backend DateOnly. */
  endDate: string;
  page: number;
  pageSize: number;
  searchTerm?: string;
  /** Filter by slot status: 'open', 'filled', or 'cancels'. */
  statusFilter?: string;
}
