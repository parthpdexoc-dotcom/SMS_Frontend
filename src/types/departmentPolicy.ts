/**
 * DepartmentPolicy DTO & types
 * Mirrors backend SMS.Generic.Dtos.Dtos.DepartmentPolicyDto
 */

export enum TenureMetricType {
  Assignments = 1,
  Hours = 2,
}

export interface DepartmentPolicyResponse {
  departmentPolicyID?: string;
  departmentID: string;
  departmentName?: string;

  // Enable / Disable flags
  isPostsTakenPerDay: boolean;
  isHoursPerDayWorked: boolean;
  isHoursPerWeekWorked: boolean;
  isHoursPerMonthWorked: boolean;
  isDeptOpenPostsTakenPerDay: boolean;
  isTenurePostsAllowedPerWeek: boolean;
  isTenurePostsAllowedPerDay: boolean;
  isDeptOpenPostsTakenPerWeek: boolean;

  // Limits
  postsTakenPerDay: number;
  hoursPerDayWorked: number;
  hoursPerWeekWorked: number;
  hoursPerMonthWorked: number;
  deptOpenPostsTakenPerDay: number;
  tenurePostsAllowedPerWeek: number;
  tenurePostsAllowedPerDay: number;
  deptOpenPostsTakenPerWeek: number;

  // Preview
  isPreviewable?: boolean;
  previewableHours?: number;

  // Minimum hours paid
  isMinHoursPaid: boolean;
  minHoursPaid: number;

  // Same-day rules
  isPositionTakenOnSameday: boolean;
  positionTakenOnSameday: number;
  timeToClosePost?: number;
  isPostExemptTakenOnSameday?: boolean;
  isManagedPostTakenOnSameday?: boolean;
  managedPostTakenOnSameday?: number;

  // Supervisor / overlap
  postToSupervise?: number;
  overlapJobConflictConfirmation: boolean;
  supervisorsCanViewLowerEmpTypeJobs: boolean;
  numberOfEmployeesBeforeSupervisorRequired: number;
  restrictWebLoginForNonAdminEmployee: boolean;

  // Tenure Policy
  tenureType?: TenureMetricType | null;
  tenureRulesJson?: string | null;

  createdDate?: string | null;
  createdUserID?: string | null;
  createdBy?: string | null;
  editedDate?: string | null;
  editedUserID?: string | null;
  editedBy?: string | null;
}

