import { getLocalTodayYyyyMmDd } from '@/utils/dateTimeUtils';

/**
 * URL segment IDs for employee dashboard routes: `/available-jobs/:tab`
 * Single source of truth — use these instead of hardcoded strings.
 */
export const AVAILABLE_JOBS_ROUTE_TAB_ID = {
  AVAILABLE_JOB: 'available-job',
  SCHEDULED_JOB: 'scheduled-job',
  JOB_READY_TO_CLOSE: 'job-ready-to-close',
  MY_HISTORY: 'my-history',
  WAITING_LIST: 'waiting-list',
} as const;

export type AvailableJobsRouteTabId =
  (typeof AVAILABLE_JOBS_ROUTE_TAB_ID)[keyof typeof AVAILABLE_JOBS_ROUTE_TAB_ID];

export const AVAILABLE_JOBS_ROUTE_TAB_IDS: readonly AvailableJobsRouteTabId[] = Object.values(
  AVAILABLE_JOBS_ROUTE_TAB_ID
) as AvailableJobsRouteTabId[];

/** Old URL segments → canonical tab id */
export const LEGACY_AVAILABLE_JOBS_TAB_REDIRECTS: Readonly<
  Record<string, AvailableJobsRouteTabId>
> = {
  'scheduled-post': AVAILABLE_JOBS_ROUTE_TAB_ID.SCHEDULED_JOB,
  'post-ready-to-close': AVAILABLE_JOBS_ROUTE_TAB_ID.JOB_READY_TO_CLOSE,
};

export function normalizeAvailableJobsTabSegment(
  segment: string | undefined
): string | undefined {
  if (segment == null || segment === '') return undefined;
  return LEGACY_AVAILABLE_JOBS_TAB_REDIRECTS[segment] ?? segment;
}

export function isAvailableJobsRouteTabId(tab: string | undefined): tab is AvailableJobsRouteTabId {
  return (
    tab != null &&
    (AVAILABLE_JOBS_ROUTE_TAB_IDS as readonly string[]).includes(tab)
  );
}

/** Subset used on supervisor Employee Posts detail view (no waiting tab; available is read-only). */
export const EMPLOYEE_POSTS_JOBS_TAB_IDS = [
  AVAILABLE_JOBS_ROUTE_TAB_ID.AVAILABLE_JOB,
  AVAILABLE_JOBS_ROUTE_TAB_ID.SCHEDULED_JOB,
  AVAILABLE_JOBS_ROUTE_TAB_ID.JOB_READY_TO_CLOSE,
  AVAILABLE_JOBS_ROUTE_TAB_ID.MY_HISTORY,
] as const;

export type EmployeePostsJobsTabId = (typeof EMPLOYEE_POSTS_JOBS_TAB_IDS)[number];

export function isEmployeePostsJobsTabId(tab: string | undefined): tab is EmployeePostsJobsTabId {
  return (
    tab != null &&
    (EMPLOYEE_POSTS_JOBS_TAB_IDS as readonly string[]).includes(tab)
  );
}

/** Default landing after login: Available Job tab with query params (startDate = today local). */
export function buildAvailableJobsLandingPathWithQuery(): string {
  const startDate = getLocalTodayYyyyMmDd();
  const qs = new URLSearchParams({
    startDate,
    numberOfDays: '30',
    releaseAs: '0',
  });
  return `/available-jobs/${AVAILABLE_JOBS_ROUTE_TAB_ID.AVAILABLE_JOB}?${qs.toString()}`;
}
