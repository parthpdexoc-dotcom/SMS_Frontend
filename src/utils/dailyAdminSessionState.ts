/**
 * Persists Daily Administration UI state in sessionStorage (per browser tab).
 * Date, status, and type filters survive navigation to request/post edit and back.
 */

import { DAILY_ADMIN_QUERY, DAILY_ADMIN_QUERY_KEYS } from '@/constants/strings';

const STORAGE_KEY = 'sems:daily-administration';
const STORAGE_VERSION = 3 as const;
const LEGACY_STORAGE_VERSION = 2 as const;

/** Filter + expand-tree fields shared by v2 and v3 persisted payloads. */
interface DailyAdminSessionSnapshotBase {
  dailySearchRequester: string;
  dailyRequestStatuses: number[];
  dailyRequestTypes: number[];
  expandedRequesters: string[];
  expandedRequests: string[];
  expandedPosts: string[];
}

/** In-memory / restored Daily Administration state (no version field). */
export interface DailyAdminSessionSnapshot extends DailyAdminSessionSnapshotBase {
  dailyStartDate: string;
  dailyEndDate: string;
}

export type DailyAdminUrlSnapshot = DailyAdminSessionSnapshot;

export interface DailyAdminFilterDefaults {
  startDate: string;
  endDate: string;
  requestStatuses: number[];
  requestTypes: number[];
}

/** Current sessionStorage payload (v3 includes date filters). */
export interface DailyAdminSessionState extends DailyAdminSessionSnapshot {
  version: typeof STORAGE_VERSION;
}

/** Legacy sessionStorage payload — dates were not persisted until v3. */
interface DailyAdminSessionStateV2 extends DailyAdminSessionSnapshotBase {
  version: typeof LEGACY_STORAGE_VERSION;
}

type StoredDailyAdminSessionState = DailyAdminSessionState | DailyAdminSessionStateV2;

const EMPTY_SNAPSHOT: DailyAdminSessionSnapshot = {
  dailySearchRequester: '',
  dailyStartDate: '',
  dailyEndDate: '',
  dailyRequestStatuses: [],
  dailyRequestTypes: [],
  expandedRequesters: [],
  expandedRequests: [],
  expandedPosts: [],
};

function isDailyAdminSessionStateV3(
  value: StoredDailyAdminSessionState
): value is DailyAdminSessionState {
  return value.version === STORAGE_VERSION;
}

function isDailyAdminSessionStateV2(
  value: StoredDailyAdminSessionState
): value is DailyAdminSessionStateV2 {
  return value.version === LEGACY_STORAGE_VERSION;
}

/** Read persisted Daily Administration state for this tab (null if missing or invalid). */
export function readDailyAdminSessionState(): DailyAdminSessionSnapshot | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoredDailyAdminSessionState;

    if (isDailyAdminSessionStateV3(parsed)) {
      const { version: _, ...snapshot } = parsed;
      return snapshot;
    }

    if (isDailyAdminSessionStateV2(parsed)) {
      const { version: _, ...base } = parsed;
      return {
        ...base,
        dailyStartDate: '',
        dailyEndDate: '',
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Resolve Daily Administration filters + expand tree for initial render.
 * Session values win; dates fall back to {@link defaults} when blank.
 * Status/type arrays are restored as stored (including empty = all deselected).
 */
export function resolveDailyAdminFilters(
  defaults: DailyAdminFilterDefaults
): DailyAdminSessionSnapshot {
  const session = readDailyAdminSessionState();
  if (!session) {
    return {
      dailySearchRequester: '',
      dailyStartDate: defaults.startDate,
      dailyEndDate: defaults.endDate,
      dailyRequestStatuses: [...defaults.requestStatuses],
      dailyRequestTypes: [...defaults.requestTypes],
      expandedRequesters: [],
      expandedRequests: [],
      expandedPosts: [],
    };
  }

  return {
    dailySearchRequester: session.dailySearchRequester,
    dailyStartDate: session.dailyStartDate.trim() || defaults.startDate,
    dailyEndDate: session.dailyEndDate.trim() || defaults.endDate,
    dailyRequestStatuses: [...session.dailyRequestStatuses],
    dailyRequestTypes: [...session.dailyRequestTypes],
    expandedRequesters: [...session.expandedRequesters],
    expandedRequests: [...session.expandedRequests],
    expandedPosts: [...session.expandedPosts],
  };
}

/** Write Daily Administration state to sessionStorage. */
export function writeDailyAdminSessionState(snapshot: DailyAdminSessionSnapshot): void {
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: STORAGE_VERSION, ...snapshot } satisfies DailyAdminSessionState)
    );
  } catch {
    // Ignore quota / private-mode errors; in-memory state still works.
  }
}

/** Clear persisted Daily Administration state for this browser tab. */
export function clearDailyAdminSessionState(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors.
  }
}

/**
 * Read Daily Administration state from URL query params (share links / deep links).
 */
export function readDailyAdminFromSearchParams(
  searchParams: URLSearchParams
): DailyAdminUrlSnapshot | null {
  const hasParams = DAILY_ADMIN_QUERY_KEYS.some((key) => searchParams.has(key));
  if (!hasParams) return null;

  return {
    ...EMPTY_SNAPSHOT,
    dailySearchRequester: searchParams.get(DAILY_ADMIN_QUERY.SEARCH) ?? '',
    dailyStartDate: searchParams.get(DAILY_ADMIN_QUERY.START_DATE) ?? '',
    dailyEndDate: searchParams.get(DAILY_ADMIN_QUERY.END_DATE) ?? '',
    expandedRequesters: searchParams.getAll(DAILY_ADMIN_QUERY.REQUESTER_ID).filter(Boolean),
    expandedRequests: searchParams.getAll(DAILY_ADMIN_QUERY.REQUEST_ID).filter(Boolean),
    expandedPosts: searchParams.getAll(DAILY_ADMIN_QUERY.POST_ID).filter(Boolean),
  };
}

/** Remove daily administration query params from the browser URL (keeps roster `dateOfWork`, etc.). */
export function stripDailyAdminSearchParams(searchParams: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  for (const key of DAILY_ADMIN_QUERY_KEYS) {
    next.delete(key);
  }
  return next;
}

export function hasDailyAdminSearchParams(searchParams: URLSearchParams): boolean {
  return DAILY_ADMIN_QUERY_KEYS.some((key) => searchParams.has(key));
}
