/**
 * Bucket label for officer schedule rows.
 * Mirrors backend enum `OfficerScheduleStatus`.
 */
export enum OfficerScheduleStatus {
  RecentlyEnded = 0,
  CurrentlyWorking = 1,
  Upcoming = 2,
}

/**
 * Minimal officer schedule row for dashboard buckets.
 * Mirrors backend `OfficerScheduledAssignmentDto`.
 */
export interface OfficerScheduledAssignmentDto {
  employeeName?: string | null;
  payroll?: string | null;
  employeeType?: string | null;
  /** Job / position title (from API `jobTitle` or similar). */
  jobTitle?: string | null;
  post?: string | null;
  dateOfWork?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  callSign?: string | null;
  hoursWorked?: number | null;
  status: OfficerScheduleStatus;
}
