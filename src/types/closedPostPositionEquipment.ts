/**
 * Types for ClosedPostPositionEquipment API
 */

export enum ClosedPostPositionStatus {
  Closed = 1,
  Unclosed = 2,
}

/**
 * Request payload for close and split (exact API shape).
 * Endpoint (/close vs /split) distinguishes the operation; payload is the same.
 */
export interface CloseOrSplitPayload {
  postPositionID: string;
  closedPostPositionID?: string | null;
  parentClosedPostPositionID?: string | null;
  splitEmployeeID: string | undefined;
  /** When true, backend will treat this as "split with myself" and ignore splitEmployeeID, using the caller's employee ID from the token instead. */
  isSplitWithSelf: boolean;
  workStartDate: string | null;
  workStartTime: string | null;
  workEndTime: string | null;
  hoursWorked: number;
  workedOnDuty: boolean;
  comment: string | null;
  isMinimumDue: boolean;
  minimumHoursDue: number | null;
  dateOfWork: string | null;
  startTime: string | null;
  endTime: string | null;
  /** Split: same value as endTime; JSON key requestedEndTime → DB RequestedEndTime. */
  requestedEndTime?: string | null;
  /** Split: user confirmed proceeding despite time overlap (matches take-job / assign). */
  confirmConflict?: boolean;
  equipmentDetails: ClosedPostPositionEquipmentDetail[];
  questionnaireSubmissions?: { questionnaireId: string; answers: { questionId: string; answer: string }[] }[] | undefined;
  /** Set when a department administrator edits a closed assignment (per department configuration). */
  editedByDepartmentAdministrator?: boolean;
}

/** Equipment item in close/split payload (exact API shape). */
export interface ClosedPostPositionEquipmentDetail {
  departmentEquipmentID?: string;
  isWorked?: boolean | null;
  noWorkReason?: string | null;
  isUnPaidBreakTime?: boolean | null;
  breakTime?: number | null;
  usedEquipmentQuantity?: number | null;
  equipmentUsedHours?: number | null;
  /** Backend may bind vehicle hours/quantity from these names (see Close Post Form vehicle step). */
  vehicleQuantity?: number | null;
  vehicleUsedHours?: number | null;
  vehicleOwnedBy?: string | number | null;
  vehNumber?: string | null;
  startMileage?: number | null;
  endMileage?: number | null;
  totalMileage?: number | null;
}

export interface ClosedPostPositionEquipmentSplitRequest {
  closedPostPositionID?: string;
  postPositionID: string;
  employeeID: string;
  postID: string;
  workStartDate: string;
  workStartTime: string;
  hoursWorked: number;
  workedOnDuty: boolean;
  comment?: string;
  requestedStartDate: string;
  requestedStartTime: string;
  closeBy?: string;
  closeDateTime?: string;
  isMinimumDue: boolean;
  minimumHoursDue: number;
  seniority?: boolean;
  reimburseStatus?: string;
  payRate?: number;
  reimbursePayRate?: number;
  split: string; // Employee ID to split with
  questionaireRequired?: boolean;
  questionaireResponseID?: string;
  equipmentDetails: ClosedPostPositionEquipmentDetail[];
}

export interface ClosedPostPositionEquipmentSplitResponse {
  closedPostPositionID?: string;
  postPositionID?: string;
  employeeID?: string;
  splitEmployeeID?: string;
  status?: string;
  message?: string;
}

export interface SplitRequest {
  closedPostPositionID: string;
  postPositionID: string;
  postID: string;
  postTitle?: string;
  employeeID: string;
  employeeName?: string;
  splitEmployeeID: string;
  splitEmployeeName?: string;
  workStartDate: string;
  workStartTime: string;
  requestedStartDate: string;
  requestedStartTime: string;
  splitStartTime?: string;
  createdDate?: string;
  comment?: string;
  equipmentDetails?: ClosedPostPositionEquipmentDetail[];
}

/**
 * Split/Close Post Position Request (exact API payload shape).
 */
export interface SplitPostPositionRequestDto {
  postPositionID: string;
  splitEmployeeID: string;
  /** When true, indicates the splitter chose "split post with myself" in the UI. Backend will ignore splitEmployeeID and use the employee ID from the token. */
  isSplitWithSelf: boolean;
  workStartDate: string | null;
  workStartTime: string | null;
  workEndTime: string | null;
  hoursWorked: number;
  workedOnDuty: boolean;
  comment: string | null;
  isMinimumDue: boolean;
  minimumHoursDue: number | null;
  dateOfWork: string | null;
  startTime: string | null;
  endTime: string | null;
  requestedEndTime?: string | null;
  equipmentDetails: ClosedPostPositionEquipmentDetail[];
  questionnaireSubmissions?: { questionnaireId: string; answers: { questionId: string; answer: string }[] }[] | null;
}

/** Equipment item in split/close payload (alias for same shape). */
export type SplitPostPositionEquipmentDto = ClosedPostPositionEquipmentDetail;
