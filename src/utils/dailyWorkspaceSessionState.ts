/**
 * Persists Daily Workspace UI state in sessionStorage (per browser tab, per requester).
 * Survives navigation to edit forms and back within the same tab.
 */

const STORAGE_KEY_PREFIX = 'sems:daily-workspace';
const STORAGE_VERSION = 1 as const;

export interface DailyWorkspaceScrollPositions {
  requestPanel: number;
  postPanel: number;
  positionPanel: number;
}

export interface DailyWorkspaceSessionSnapshot {
  selectedRequestId: string | null;
  selectedPostIds: string[];
  activePostId: string | null;
  filterStartDate: string;
  filterEndDate: string;
  requestStatuses: number[];
  requestTypes: number[];
  requestSearch: string;
  postSearch: string;
  requestsCollapsed: boolean;
  postsCollapsed: boolean;
  positionsCollapsed: boolean;
  requestLayout: 'grid' | 'list';
  collapsedPositionPostIds: string[];
  positionsPagingByPostId: Record<string, { page: number; pageSize: number }>;
  postFilterDatesByPostId: Record<string, string[]>;
  scroll: DailyWorkspaceScrollPositions;
}

interface DailyWorkspaceSessionState extends DailyWorkspaceSessionSnapshot {
  version: typeof STORAGE_VERSION;
}

function storageKey(requesterId: string): string {
  return `${STORAGE_KEY_PREFIX}:${requesterId}`;
}

/** Read persisted Daily Workspace state for this requester in the current tab. */
export function readDailyWorkspaceSessionState(
  requesterId: string
): DailyWorkspaceSessionSnapshot | null {
  if (!requesterId) return null;
  try {
    const raw = sessionStorage.getItem(storageKey(requesterId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DailyWorkspaceSessionState;
    if (parsed.version !== STORAGE_VERSION) return null;
    const { version: _, ...snapshot } = parsed;
    return snapshot;
  } catch {
    return null;
  }
}

/** Write Daily Workspace state to sessionStorage for this requester. */
export function writeDailyWorkspaceSessionState(
  requesterId: string,
  snapshot: DailyWorkspaceSessionSnapshot
): void {
  if (!requesterId) return;
  try {
    sessionStorage.setItem(
      storageKey(requesterId),
      JSON.stringify({ version: STORAGE_VERSION, ...snapshot } satisfies DailyWorkspaceSessionState)
    );
  } catch {
    // Ignore quota / private-mode errors; in-memory state still works.
  }
}

/** Clear persisted Daily Workspace state for a requester in this browser tab. */
export function clearDailyWorkspaceSessionState(requesterId: string): void {
  if (!requesterId) return;
  try {
    sessionStorage.removeItem(storageKey(requesterId));
  } catch {
    // Ignore storage errors.
  }
}

/** Clear all Daily Workspace session keys in this browser tab (e.g. on logout). */
export function clearAllDailyWorkspaceSessionState(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(`${STORAGE_KEY_PREFIX}:`)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // Ignore storage errors.
  }
}

export function createDefaultDailyWorkspaceSnapshot(): DailyWorkspaceSessionSnapshot {
  return {
    selectedRequestId: null,
    selectedPostIds: [],
    activePostId: null,
    filterStartDate: '',
    filterEndDate: '',
    requestStatuses: [],
    requestTypes: [],
    requestSearch: '',
    postSearch: '',
    requestsCollapsed: false,
    postsCollapsed: false,
    positionsCollapsed: false,
    requestLayout: 'list',
    collapsedPositionPostIds: [],
    positionsPagingByPostId: {},
    postFilterDatesByPostId: {},
    scroll: { requestPanel: 0, postPanel: 0, positionPanel: 0 },
  };
}

export function buildDailyWorkspaceReturnPath(requesterId: string): string {
  return `/personnel/daily-workspace/${requesterId}`;
}

export function isDailyWorkspacePath(path: string | null | undefined): boolean {
  return Boolean(path?.includes('/daily-workspace/'));
}

/** Fallback when navigation state is missing — uses persisted workspace for this tab. */
export function findDailyWorkspaceReturnPath(): string | null {
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (!key?.startsWith(`${STORAGE_KEY_PREFIX}:`)) continue;
      const requesterId = key.slice(STORAGE_KEY_PREFIX.length + 1);
      if (requesterId) return buildDailyWorkspaceReturnPath(requesterId);
    }
  } catch {
    // ignore
  }
  return null;
}

export interface WorkspaceNavigationState {
  returnPath?: string;
  requesterId?: string;
  tab?: string;
}

/**
 * Resolves back-navigation for shared form/drill-in pages (request, post, block date, etc.).
 *
 * Priority keeps Daily Administration and Daily Workspace independent:
 * 1. Explicit `returnPath` from navigation state (admin or workspace)
 * 2. Daily Administration `tab` → `/personnel/requester/{tab}`
 * 3. Workspace `requesterId` in state → daily workspace URL
 * 4. Optional URL requester id (only for `/personnel/request/add/:requesterId` from workspace)
 *
 * Does not use workspace sessionStorage fallback — callers apply their own defaults
 * (e.g. daily admin deep links) when this returns null.
 */
export function resolveFormReturnPath(
  state: WorkspaceNavigationState | null | undefined,
  urlRequesterId?: string
): string | null {
  const returnPath = state?.returnPath?.trim();
  if (returnPath) return returnPath;

  const tab = state?.tab?.trim();
  if (tab) return `/personnel/requester/${tab}`;

  const stateRequesterId = state?.requesterId?.trim();
  if (stateRequesterId) return buildDailyWorkspaceReturnPath(stateRequesterId);

  const urlId = urlRequesterId?.trim();
  if (urlId) return buildDailyWorkspaceReturnPath(urlId);

  return null;
}

/** @alias resolveFormReturnPath — shared by workspace drill-ins; admin paths win when present in state. */
export const resolveWorkspaceReturnPath = resolveFormReturnPath;
