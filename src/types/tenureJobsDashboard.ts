import { TenureMetricType } from '@/types/departmentPolicy';

/**
 * Tenure jobs dashboard — aligns with API: one row per request + date of work, with nested posts.
 */
export interface TenureJobsDashboardRow {
  postID: string;
  postTitle: string;
  /** YYYY-MM-DD — work date for this post row (per-row; usually matches the parent group). */
  dateOfWork: string;
  /** HH:mm */
  startTime: string;
  /** HH:mm */
  endTime: string;
  /** Minutes (despite the legacy "Hours" name, the API field is in minutes — render via `formatDurationHrsMins`). */
  minimumHoursRequired: number;
  location: string;
  totalPostPositions: number;
}

export interface TenureJobsDashboardGroup {
  requestID: string;
  requestTitle: string;
  /** Request unique number from API (e.g. billing / reference id). */
  requestUniqueNumber: string;
  requesterName: string;
  /** YYYY-MM-DD — work date for all posts in `tenureJobs` */
  dateOfWork: string;
  /** YYYY-MM-DD — tenure process date for this row */
  processDate: string;
  /** HH:mm */
  processTime: string;
  tenureJobs: TenureJobsDashboardRow[];
}

export interface TenureJobsDashboardFetchParams {
  startDate: string;
  endDate: string;
  page: number;
  pageSize: number;
}

/**
 * Row from GET /Request/interested-list/{postId}/{dateOfWork}
 * (backend: TenureInterestedEmployeeRowDto).
 */
export interface TenureInterestedEmployeeRow {
  /** Stable id for table keys (prefer waiting list row id). */
  id: string;
  /** Required for assign / process-waiting-list APIs. */
  waitingPostPositionId: string;
  employeeName: string;
  employeeNumber: string;
  rank: string;
  /**
   * Keys normalized to lowercase `l` + digits (e.g. l6, l10) from `statisticsByLabel`.
   */
  statisticsByLabel: Record<string, number>;
  /**
   * How to interpret `statisticsByLabel` values (backend `TenureMetricType`).
   * `Hours` → show as hours; `Assignments` → show as assignment counts.
   */
  tenureType: TenureMetricType | null;
  /** True when the employee already applied / is on a tenure track for this job. */
  hasAppliedInTenure: boolean;
}

/** Sort `l{n}` keys by n ascending (e.g. l6, l10, l16). */
export function sortTenureStatisticKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    const na = parseInt(/^l(\d+)$/i.exec(a.trim())?.[1] ?? '0', 10);
    const nb = parseInt(/^l(\d+)$/i.exec(b.trim())?.[1] ?? '0', 10);
    return na - nb;
  });
}

/** UI header: `l6` → "Last 6D" */
export function tenureStatisticKeyToColumnLabel(statKey: string): string {
  const m = /^l(\d+)$/i.exec(statKey.trim());
  if (!m) return statKey;
  return `Last ${m[1]}D`;
}

function formatStatisticNumberCore(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (Number.isInteger(n)) return String(n);
  return n % 1 === 0 ? String(Math.round(n)) : String(n);
}

/**
 * Display a `statisticsByLabel` value with postfix: hours vs assignments per `tenureType`.
 */
export function formatTenureStatisticDisplay(
  value: number,
  tenureType: TenureMetricType | null | undefined
): string {
  const core = formatStatisticNumberCore(value);
  if (core === '—') return '—';

  if (tenureType === TenureMetricType.Hours) {
    return `${core} hrs`;
  }
  if (tenureType === TenureMetricType.Assignments) {
    const n = value;
    const word =
      Number.isInteger(n) && Math.abs(n) === 1 ? 'assignment' : 'assignments';
    return `${core} ${word}`;
  }

  return core;
}
