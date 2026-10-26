/**
 * Watch Commander report row (`GET Report/watch-commander-report` paged JSON).
 * Field names match typical camelCase API payloads; PascalCase is normalized in the service.
 */
export interface WatchCommanderReportRowDto {
  startDate?: string | null;
  employeeName?: string | null;
  payroll?: string | null;
  callSign?: string | null;
  employeeType?: string | null;
  startTime?: string | null;
  hoursWorked?: number | null;
  endTime?: string | null;
  requester?: string | null;
  requesterAddress?: string | null;
  /** API may send boolean or legacy string values. */
  vehicle?: boolean | string | null;
}
