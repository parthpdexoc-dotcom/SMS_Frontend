/**
 * Token Utility
 * Handles JWT token storage and retrieval with expiration checking.
 * Uses sessionStorage so each browser tab has an isolated auth session.
 */

import { decodeToken, isTokenExpired } from './jwtDecoder';

const TOKEN_KEY = 'auth_token';
const TOKEN_EXPIRATION_KEY = 'auth_token_expires_at';
const TOKEN_TYPE_KEY = 'auth_token_type';

/**
 * Store JWT token in sessionStorage (tab-scoped)
 * @param token - The JWT token to store
 */
export const setToken = (token: string): void => {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
  } catch (error) {
    console.error('Error storing token:', error);
  }
};

/**
 * Store token expiration date
 * @param expiresAt - ISO string of expiration date
 */
export const setTokenExpiration = (expiresAt: string): void => {
  try {
    sessionStorage.setItem(TOKEN_EXPIRATION_KEY, expiresAt);
  } catch (error) {
    console.error('Error storing token expiration:', error);
  }
};

/**
 * Store token type (e.g. "Bearer")
 * @param tokenType - Token type from auth response
 */
export const setTokenType = (tokenType: string): void => {
  try {
    sessionStorage.setItem(TOKEN_TYPE_KEY, tokenType);
  } catch (error) {
    console.error('Error storing token type:', error);
  }
};

/**
 * Get JWT token from sessionStorage
 * @returns The JWT token or null if not found or expired
 */
export const getToken = (): string | null => {
  try {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) {
      return null;
    }

    // Check if token is expired
    // User requested to prevent auto-logout. We'll trust the token unless explicit logout.
    // const expired = isTokenExpired(token);
    // if (expired === true) {
    //   // Token is expired, remove it
    //   removeToken();
    //   return null;
    // }

    return token;
  } catch (error) {
    console.error('Error retrieving token:', error);
    return null;
  }
};

/**
 * Get token expiration date
 * @returns ISO string of expiration date or null
 */
export const getTokenExpiration = (): string | null => {
  try {
    return sessionStorage.getItem(TOKEN_EXPIRATION_KEY);
  } catch (error) {
    console.error('Error retrieving token expiration:', error);
    return null;
  }
};

/**
 * Get token type
 * @returns token type (defaults to "Bearer" when missing)
 */
export const getTokenType = (): string => {
  try {
    return sessionStorage.getItem(TOKEN_TYPE_KEY) || 'Bearer';
  } catch (error) {
    console.error('Error retrieving token type:', error);
    return 'Bearer';
  }
};

/**
 * Remove JWT token and expiration from sessionStorage
 */
export const removeToken = (): void => {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_EXPIRATION_KEY);
    sessionStorage.removeItem(TOKEN_TYPE_KEY);
  } catch (error) {
    console.error('Error removing token:', error);
  }
};

/**
 * Resolve token expiry as epoch milliseconds.
 * Prefers `auth_token_expires_at` from login/refresh; falls back to JWT `exp`.
 */
export function getTokenExpiryTimeMs(): number | null {
  const expiresAtStr = getTokenExpiration();
  if (expiresAtStr) {
    const parsedMs = new Date(expiresAtStr).getTime();
    if (!Number.isNaN(parsedMs) && parsedMs > 0) {
      return parsedMs;
    }
  }

  const token = getToken();
  if (token) {
    const decoded = decodeToken(token);
    if (decoded?.exp) {
      return decoded.exp * 1000;
    }
  }

  return null;
}

/**
 * Total token lifetime in seconds from JWT `iat` → `exp`, when both claims are present.
 */
export function getTokenLifetimeSeconds(): number | null {
  const token = getToken();
  if (!token) return null;

  const decoded = decodeToken(token);
  if (decoded?.exp && decoded?.iat && decoded.exp > decoded.iat) {
    return decoded.exp - decoded.iat;
  }

  return null;
}

/**
 * Check if user is authenticated (has a valid, non-expired token)
 * @returns true if token exists and is not expired, false otherwise
 */
export const isAuthenticated = (): boolean => {
  const token = getToken();
  if (!token) {
    return false;
  }

  // Additional check: verify expiration
  const expired = isTokenExpired(token);
  if (expired === true) {
    removeToken();
    return false;
  }

  return true;
};

const AUTH_HANDOFF_KEY = 'sems:auth_handoff';
const AUTH_HANDOFF_TTL_MS = 30_000;

/**
 * Write current tab auth into a short-lived localStorage handoff so a newly opened tab
 * (sessionStorage is tab-scoped) can stay logged in.
 */
export const writeAuthHandoffForNewTab = (): void => {
  try {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) return;
    localStorage.setItem(
      AUTH_HANDOFF_KEY,
      JSON.stringify({
        token,
        expiresAt: sessionStorage.getItem(TOKEN_EXPIRATION_KEY),
        tokenType: sessionStorage.getItem(TOKEN_TYPE_KEY),
        createdAt: Date.now(),
      })
    );
  } catch (error) {
    console.error('Error writing auth handoff:', error);
  }
};

/** Opens a same-origin path in a new tab and copies the current login into that tab. */
export const openAuthenticatedPath = (path: string): void => {
  writeAuthHandoffForNewTab();
  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  window.open(`${base}${path.replace(/^\//, '')}`, '_blank');
};

/** Consume auth handoff into this tab's sessionStorage if it has no token yet. */
export const consumeAuthHandoff = (): void => {
  try {
    if (sessionStorage.getItem(TOKEN_KEY)) return;
    const raw = localStorage.getItem(AUTH_HANDOFF_KEY);
    if (!raw) return;
    localStorage.removeItem(AUTH_HANDOFF_KEY);
    const data = JSON.parse(raw) as {
      token?: string;
      expiresAt?: string | null;
      tokenType?: string | null;
      createdAt?: number;
    };
    if (!data?.token || typeof data.createdAt !== 'number') return;
    if (Date.now() - data.createdAt > AUTH_HANDOFF_TTL_MS) return;
    sessionStorage.setItem(TOKEN_KEY, data.token);
    if (data.expiresAt) sessionStorage.setItem(TOKEN_EXPIRATION_KEY, data.expiresAt);
    if (data.tokenType) sessionStorage.setItem(TOKEN_TYPE_KEY, data.tokenType);
  } catch (error) {
    console.error('Error consuming auth handoff:', error);
  }
};


