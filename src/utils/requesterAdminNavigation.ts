import type { NavigateFunction } from 'react-router-dom';
import type { RequesterResponse } from '@/types/requester';

export type RequesterAdminRouteState = {
  requesterId: string;
  requesterName?: string | null;
  /** Screen to return to when the user clicks Back. */
  returnPath?: string;
  /** Location state to restore when navigating to returnPath. */
  returnState?: unknown;
};

export const buildRequesterScopedAdminRoute = (
  basePath: string,
  requester: Pick<RequesterResponse, 'requesterID' | 'name'>,
  opts?: { returnPath?: string; returnState?: unknown }
): { path: string; state: RequesterAdminRouteState } => ({
  path: `${basePath}?requesterId=${encodeURIComponent(requester.requesterID)}`,
  state: {
    requesterId: requester.requesterID,
    requesterName: requester.name,
    ...(opts?.returnPath?.trim() ? { returnPath: opts.returnPath.trim() } : {}),
    ...(opts?.returnState !== undefined ? { returnState: opts.returnState } : {}),
  },
});

/** Prefer explicit returnPath from navigation state; else browser history; else fallback. */
export const navigateAdminBack = (
  navigate: NavigateFunction,
  returnPath: string | undefined,
  fallbackPath: string,
  returnState?: unknown
): void => {
  if (returnPath?.trim()) {
    navigate(returnPath.trim(), returnState !== undefined ? { state: returnState } : undefined);
    return;
  }
  if (typeof window !== 'undefined' && window.history.length > 1) {
    navigate(-1);
    return;
  }
  navigate(fallbackPath);
};
