/**
 * Matches backend SMS.Generic.Dtos / enums (camelCase from API).
 * JobType and ScheduleFrequency are numeric — values come from GET schedules, not hardcoded.
 */
/** Editable in the UI. Value `4` may still appear in GET DTOs for older “custom” rows until re-saved. */
export type ScheduleFrequency = 0 | 1 | 2 | 3;
export type DepartmentCronScheduleFrequency = ScheduleFrequency | 4;

/** Backend `SMS.Generic.Enums.MonthlySubPattern` (monthly only). */
export enum MonthlySubPattern {
  ByCalendarDay = 0,
  ByWeekdayOrdinal = 1,
  ByLastWeekday = 2,
}

/** `SMSDropdown` options for schedule frequency; values align with `ScheduleFrequency` / backend. "Minute" is first in the UI only. */
export const DEPARTMENT_CRON_FREQUENCY_DROPDOWN_OPTIONS: { value: string; label: string }[] = [
  { value: '3', label: 'Minute' },
  { value: '0', label: 'Daily' },
  { value: '1', label: 'Weekly' },
  { value: '2', label: 'Monthly' },
];

export const DEPARTMENT_CRON_MONTHLY_SUBPATTERN_DROPDOWN_OPTIONS: { value: string; label: string }[] = [
  { value: '0', label: 'On a calendar day' },
  { value: '1', label: 'On the Nth weekday' },
  { value: '2', label: 'On the last weekday' },
];

/** 1 = first through 5 = fifth (for monthly Nth weekday). */
export const MONTH_WEEK_ORDINAL_DROPDOWN_OPTIONS: { value: string; label: string }[] = [
  { value: '1', label: 'First' },
  { value: '2', label: 'Second' },
  { value: '3', label: 'Third' },
  { value: '4', label: 'Fourth' },
  { value: '5', label: 'Fifth' },
];

export interface DepartmentCronScheduleDto {
  departmentCronJobManagementId?: string | null;
  departmentID: string;
  job: number;
  jobName: string;
  frequency: DepartmentCronScheduleFrequency;
  hour: number;
  minute: number;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  /** Calendar day, Nth weekday, or last weekday (only when `frequency` is Monthly). */
  monthlySubPattern?: MonthlySubPattern;
  monthWeekOrdinal?: number | null;
  /** When `frequency` is Weekly, one or more run days (0 = Sun .. 6 = Sat). The API also sets `dayOfWeek` to the first. */
  daysOfWeek?: number[] | null;
  // 1–59 for minute-interval schedules; server builds the minute field as * /N (5 standard cron fields).
  intervalMinutes?: number | null;
  customCronExpression?: string | null;
  cronExpression?: string | null;
  /** Human-readable schedule from the server (e.g. "Every 10 minutes", "Every day at 1:00 AM"). */
  cronExpressionDescription?: string | null;
}

/** Job type not yet saved for the department; from GET unconfigured-job-types. */
export interface DepartmentCronJobTypeOptionDto {
  job: number;
  jobName: string;
}

export interface DepartmentCronScheduleUpsertDto {
  departmentCronJobManagementId?: string | null;
  departmentID: string;
  job: number;
  frequency: ScheduleFrequency;
  hour: number;
  minute: number;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  monthlySubPattern: MonthlySubPattern;
  /** 1=first..5=fifth, only for `ByWeekdayOrdinal` */
  monthWeekOrdinal?: number | null;
  /** Weekly: 1+ distinct 0..6. When set, the server uses this; `dayOfWeek` is still set to the first for compatibility. */
  daysOfWeek?: number[] | null;
  intervalMinutes?: number | null;
  customCronExpression?: string | null;
}
