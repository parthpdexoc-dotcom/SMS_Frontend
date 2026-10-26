/**
 * Flat archived report row (`GET Report/archived-report`).
 * JSON uses `employeeCode`, `requestCode`, `postCode` (legacy `employeeNumber` / `requestId` / `postId` still read in {@link normalizeReportRowDto}).
 */
export interface ReportRowDto {
  employeeCode?: string | null;
  employeeName?: string | null;
  payroll?: string | null;
  pvt?: string | null;
  requestCode?: string | null;
  postCode?: string | null;
  hoursWorked?: number | null;
  /** ISO date string (DateOnly) */
  postDay?: string | null;
  payCode?: string | null;
  comments?: string | null;
  requesterName?: string | null;
  requesterAddress?: string | null;
  /** ISO time string (TimeOnly) */
  startTime?: string | null;
  hoursRequired?: number | null;
  responseArea?: string | null;
  requestAddress?: string | null;
  callSign?: string | null;
  vehicle?: string | null;
  onDuty?: boolean | null;
  postFor?: string | null;
  postPayRate?: number | null;
  empHrlyRate?: number | null;
  ldrPc116?: number | null;
  ldrPc103?: number | null;
  ldrPc102?: number | null;
  pc102?: number | null;
  pc102At125?: number | null;
  pc102Rate?: number | null;
  vehicleNumber?: string | null;
  vehicleHrs?: number | null;
  requestName?: string | null;
  agency?: string | null;
  closedBy?: string | null;
  ptaeo?: string | null;
  invoice?: string | null;
  isPlaceholder?: string | null;
  isClosed?: string | null;
  vehicleClosedHours?: number | null;
  personalRank?: string | null;
  shiftRank?: string | null;
}
