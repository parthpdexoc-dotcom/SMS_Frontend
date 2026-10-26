import type { DataTableColumn } from '@/components/smsorganisms';
import { POST_GRID_COLUMNS } from '@/constants/strings';
import { formatDuration, formatTimeToHHmm } from './dateTimeUtils';

/** Row fields used for Start / End / Duration columns across post tables. */
export type PostGridTimingRow = {
  postStartTime?: string | null;
  startTime?: string | null;
  /** When set from the API (e.g. Post.PostEndTime on listing DTO), show as end time — do not compute from start + duration. */
  postEndTime?: string | null;
  workStartTime?: string | null;
  workEndTime?: string | null;
  lengthOfWork?: number | null;
  postLength?: number | null;
  hoursWorked?: number | null;
  /** Unified listing DTO work date (YYYY-MM-DD). */
  startDate?: string | null;
};

export type PostGridTimeColumnOptions = {
  useWorkTimes?: boolean;
  /** Close assignments: show Hours Worked + Hours Required instead of Duration. */
  showHoursWorkedAndRequired?: boolean;
};

function startTimeRaw(row: PostGridTimingRow): string | undefined {
  const t = row.postStartTime ?? row.startTime;
  if (t == null) return undefined;
  const s = String(t).trim();
  return s.length > 0 ? s : undefined;
}

function workStartTimeRaw(row: PostGridTimingRow): string | undefined {
  const t = row.workStartTime;
  if (t == null) return undefined;
  const s = String(t).trim();
  return s.length > 0 ? s : undefined;
}

function workEndTimeRaw(row: PostGridTimingRow): string | undefined {
  const t = row.workEndTime;
  if (t == null) return undefined;
  const s = String(t).trim();
  return s.length > 0 ? s : undefined;
}

function durationMinutes(row: PostGridTimingRow): number | undefined {
  const raw = row.postLength ?? row.lengthOfWork;
  if (raw === null || raw === undefined) return undefined;
  const n = Number(raw);
  if (Number.isNaN(n)) return undefined;
  return n;
}

export function formatPostGridStartTimeCell(row: PostGridTimingRow): string {
  const raw = startTimeRaw(row) ?? workStartTimeRaw(row);
  if (!raw) return '-';
  return formatTimeToHHmm(raw) || raw;
}

export function formatPostGridEndTimeCell(row: PostGridTimingRow): string {
  // Close-assignments and similar DTOs send actual work end time, not scheduled post end.
  const end = row.postEndTime ?? row.workEndTime;
  if (end != null && String(end).trim() !== '') {
    const s = String(end).trim();
    return formatTimeToHHmm(s) || s;
  }
  return '-';
}

export function formatPostGridWorkStartTimeCell(row: PostGridTimingRow): string {
  const raw = workStartTimeRaw(row);
  if (!raw) return '-';
  return formatTimeToHHmm(raw) || raw;
}

export function formatPostGridWorkEndTimeCell(row: PostGridTimingRow): string {
  const raw = workEndTimeRaw(row);
  if (!raw) return '-';
  return formatTimeToHHmm(raw) || raw;
}

export function formatPostGridDurationCell(row: PostGridTimingRow): string {
  const mins = durationMinutes(row);
  if (mins == null) return '-';
  return formatDuration(mins);
}

export function formatPostGridHoursWorkedCell(row: PostGridTimingRow): string {
  const raw = row.hoursWorked;
  if (raw === null || raw === undefined) return '-';
  const n = Number(raw);
  if (Number.isNaN(n)) return '-';
  return formatDuration(n);
}

export function formatPostGridHoursRequiredCell(row: PostGridTimingRow): string {
  return formatPostGridDurationCell(row);
}

/**
 * Start Time, End Time, Duration — labels from POST_GRID_COLUMNS.
 * Pass `{ useWorkTimes: true }` for grids that should display the actual work times
 * captured at close (e.g. My History → Closed Jobs) instead of the scheduled post times.
 */
export function getPostGridTimeColumns<T extends PostGridTimingRow>(
  options: PostGridTimeColumnOptions = {}
): DataTableColumn<T>[] {
  const { useWorkTimes = false, showHoursWorkedAndRequired = false } = options;
  const durationColumns: DataTableColumn<T>[] = showHoursWorkedAndRequired
    ? [
        {
          key: 'hoursWorked' as keyof T,
          label: POST_GRID_COLUMNS.HOURS_WORKED,
          render: (_value: unknown, row: T) => formatPostGridHoursWorkedCell(row),
        },
        {
          key: 'postLength' as keyof T,
          label: POST_GRID_COLUMNS.HOURS_REQUIRED,
          render: (_value: unknown, row: T) => formatPostGridHoursRequiredCell(row),
        },
      ]
    : [
        {
          key: 'lengthOfWork' as keyof T,
          label: POST_GRID_COLUMNS.DURATION,
          render: (_value: unknown, row: T) => formatPostGridDurationCell(row),
        },
      ];

  return [
    {
      key: (useWorkTimes ? 'workStartTime' : 'postStartTime') as keyof T,
      label: useWorkTimes ? POST_GRID_COLUMNS.WORK_START_TIME : POST_GRID_COLUMNS.START_TIME,
      render: (_value: unknown, row: T) =>
        useWorkTimes ? formatPostGridWorkStartTimeCell(row) : formatPostGridStartTimeCell(row),
    },
    {
      key: useWorkTimes ? '__workEndTime' : '__postEndTime',
      label: useWorkTimes ? POST_GRID_COLUMNS.WORK_END_TIME : POST_GRID_COLUMNS.END_TIME,
      render: (_value: unknown, row: T) =>
        useWorkTimes ? formatPostGridWorkEndTimeCell(row) : formatPostGridEndTimeCell(row),
    },
    ...durationColumns,
  ];
}
