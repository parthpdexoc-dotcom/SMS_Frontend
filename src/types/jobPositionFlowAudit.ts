/**
 * Job Position Flow audit (SCRUM-953).
 * Aligns with backend `SMS.Generic.Enums.PostPositionFlowEventType`.
 * Assign who/how is encoded in event type (AssignedByAdmin / AssignedByOther / AssignedBySystem / SelfTaken)
 * — no separate PerformedBy enum on the frontend.
 */

/** Matches backend `SMS.Generic.Enums.PostPositionFlowEventType`. */
export enum PostPositionFlowEventType {
  Created = 1,
  SelfTaken = 2,
  /** Assigned by a user who has an EmployeeAdmin / AdminType. */
  AssignedByAdmin = 3,
  Transferred = 4,
  UnassignedByAdmin = 5,
  Closed = 6,
  ClosedAndSplit = 7,
  CancellationPending = 8,
  Cancelled = 9,
  SplitAccepted = 10,
  SplitDeclined = 11,
  Unclosed = 12,
  CancellationRevoked = 13,
  /** New split slot awaiting accept/decline (SplitDecisionPending). */
  SplitPending = 14,
  /** Assigned by another employee (CreatedUserID != EmployeeID, no EmployeeAdmin). */
  AssignedByOther = 15,
  /** Assigned by system (no CreatedUserID / performer). */
  AssignedBySystem = 16,
}

/** UI action keys used by timeline icons/labels (mapped from `PostPositionFlowEventType`). */
export type JobPositionFlowAction =
  | 'created'
  | 'self_taken'
  | 'assigned_by_admin'
  | 'assigned_by_other'
  | 'assigned_by_system'
  | 'transferred'
  | 'unassigned_by_admin'
  | 'closed'
  | 'closed_and_split'
  | 'cancellation_pending'
  | 'cancelled'
  | 'split_accepted'
  | 'split_declined'
  | 'unclosed'
  | 'cancellation_revoked'
  | 'split_pending'
  | 'unknown';

/** Detail row; `items` holds nested groups (e.g. Vehicle type/number/mileage). */
export interface JobPositionFlowDetail {
  label: string;
  value: string;
  items?: JobPositionFlowDetail[];
}

export interface JobPositionFlowEvent {
  id: string;
  action: JobPositionFlowAction;
  eventType: PostPositionFlowEventType | number;
  occurredAt: string;
  actorName: string;
  /** Derived from event type (and optional API `role` string). */
  actorRole: 'admin' | 'employee' | 'system';
  employeeName?: string;
  summary: string;
  details: JobPositionFlowDetail[];
  postPositionId?: string;
  relatedPostPositionId?: string;
}

export interface JobPositionFlowStory {
  id: string;
  flowRootPostPositionId: string;
  postPositionId: string;
  jobTitle: string;
  requestTitle?: string;
  workDate: string;
  startTime: string;
  endTime: string;
  currentStatus: string;
  employeeName: string;
  events: JobPositionFlowEvent[];
}

export interface JobPositionFlowPagedResult {
  data: JobPositionFlowStory[];
  totalRecords: number;
}
