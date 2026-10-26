import { getTokenExpiryTimeMs } from './token';

/** Show popup / decide renewal when this many seconds remain. */
export const SESSION_WARNING_THRESHOLD_SEC = 120;

/** Track API usage when remaining time is above the warning threshold and within this window. */
export const SESSION_API_ACTIVITY_WINDOW_MAX_SEC = 300;

let apiActivityInRenewalWindow = false;
let trackedExpiryMs: number | null = null;

export function resetSessionApiActivity(expiryMs: number | null = null): void {
  apiActivityInRenewalWindow = false;
  trackedExpiryMs = expiryMs;
}

export function hadApiActivityInRenewalWindow(): boolean {
  return apiActivityInRenewalWindow;
}

/**
 * Record an authenticated API call for session renewal decisions.
 * Counts only when time remaining is between 2 and 5 minutes (exclusive lower bound).
 */
export function recordAuthenticatedApiActivity(): void {
  const expiryMs = getTokenExpiryTimeMs();
  if (!expiryMs) return;

  if (trackedExpiryMs !== expiryMs) {
    trackedExpiryMs = expiryMs;
    apiActivityInRenewalWindow = false;
  }

  const timeRemainingSec = Math.max(0, Math.floor((expiryMs - Date.now()) / 1000));
  if (
    timeRemainingSec > SESSION_WARNING_THRESHOLD_SEC &&
    timeRemainingSec <= SESSION_API_ACTIVITY_WINDOW_MAX_SEC
  ) {
    apiActivityInRenewalWindow = true;
  }
}
