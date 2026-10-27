/**
 * API Client Utility
 * Provides a centralized way to make API calls with automatic JWT token injection
 */

import { getToken, getTokenType, removeToken, setToken, setTokenExpiration } from './token';
import { recordAuthenticatedApiActivity } from './sessionApiActivity';
import { tryHandleStaticApiRequest } from '@/static data/mockApi';
import { buildPaginationQueryParams, PaginationParams } from '@/utils/paginationUtils';
import { HttpStatus } from '@/constants/httpStatus';
import { LOGIN } from '@/constants/strings';
// Auto-detect API base URL based on environment
// Development: Uses relative URL '/api' (proxied by Vite to https://localhost:7144)
// Production: Uses VITE_API_BASE_URL environment variable or defaults to http://122.170.13.77:90/SMSapi/api
const RAW_API_BASE_URL = import.meta.env.PROD
  ? (import.meta.env.VITE_API_BASE_URL || 'http://122.170.13.77:90/SMSapi/api')
  : '/api';
const API_BASE_URL = RAW_API_BASE_URL.replace(/\/+$/, '');

// Static / fallback URLs for external map & geocoding services
export const STATIC_PHOTON_API_URL = 'https://photon.komoot.io/api/';
export const STATIC_OPENFREEMAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

// Configured URLs (environment variables with fallback to static defaults)
export const PHOTON_API_URL = import.meta.env.VITE_PHOTON_API_URL || STATIC_PHOTON_API_URL;
export const OPENFREEMAP_STYLE_URL = import.meta.env.VITE_OPENFREEMAP_STYLE_URL || STATIC_OPENFREEMAP_STYLE_URL;

//  https://api.checkthesite.com/api
// TEMP: Backend APIs are being updated; keep frontend unblocked.
// Static/mock mode defaults:
// - Development: ON (most endpoints served from `src/static data/`)
// - Production:  OFF
// Note: Auth + Skill endpoints always use the real backend.
const USE_STATIC_DATA = import.meta.env.PROD ? false : false;

export interface ApiRequestOptions extends RequestInit {
  skipAuth?: boolean; // Set to true to skip adding auth token (e.g., for login)
  /** When true, do not invoke the global forbidden callback on 403 (caller will handle it). */
  suppressForbiddenCallback?: boolean;
}

export interface RenewedAccessToken {
  token: string;
  expiresAt: string | null;
  tokenType: string;
}

const NEW_ACCESS_TOKEN_HEADER = 'X-New-Access-Token';
const NEW_ACCESS_TOKEN_EXPIRES_AT_HEADER = 'X-New-Access-Token-Expires-At';

export type UnauthorizedReason = 'SESSION_REPLACED';

// Callback for unauthorized access (401)
let onUnauthorizedCallback: ((reason?: UnauthorizedReason) => void) | null = null;
const accessTokenRenewedListeners: Array<(session: RenewedAccessToken) => void> = [];
let unauthorizedHandled = false;
let lastUnauthorizedToken: string | null = null;
/** Blocks token renewal after this web session was replaced, until the next sign-in. */
let sessionReplaced = false;
const IMPERSONATION_MODE_KEY = 'is_impersonation_session';

// Callback for forbidden access (403)
let onForbiddenCallback: (() => void) | null = null;

/**
 * Register a callback for a 401 response that has no replacement access token.
 * `SESSION_REPLACED` means another sign-in ended this session; do not refresh the token.
 */
export const registerUnauthorizedCallback = (
  callback: ((reason?: UnauthorizedReason) => void) | null
): void => {
  onUnauthorizedCallback = callback;
};

/** True after a SESSION_REPLACED 401 until the next successful sign-in. */
export const isSessionReplaced = (): boolean => sessionReplaced;

/** Allow the next sign-in to store and refresh a token. */
export const clearSessionReplaced = (): void => {
  sessionReplaced = false;
};

/** Synchronize Redux/user claims when the backend rotates the JWT in response headers. */
export const registerAccessTokenRenewedCallback = (
  callback: ((session: RenewedAccessToken) => void) | null
): void => {
  if (callback && !accessTokenRenewedListeners.includes(callback)) {
    accessTokenRenewedListeners.push(callback);
  }
};

/**
 * Register a callback to be called when a forbidden response (403) is received.
 */
export const registerForbiddenCallback = (callback: () => void): void => {
  onForbiddenCallback = callback;
};

const responseIsSessionReplaced = async (response: Response): Promise<boolean> => {
  if (response.status !== HttpStatus.UNAUTHORIZED) return false;
  try {
    const text = (await response.clone().text()).trim();
    if (!text.toUpperCase().includes('SESSION_REPLACED')) return false;
    const data = JSON.parse(text) as { code?: string; Code?: string };
    return String(data.code ?? data.Code ?? '').trim().toUpperCase() === 'SESSION_REPLACED';
  } catch {
    return false;
  }
};

const applyRenewedAccessToken = (response: Response): RenewedAccessToken | null => {
  if (sessionReplaced) return null;

  // Fetch Headers#get is case-insensitive.
  const token = response.headers.get(NEW_ACCESS_TOKEN_HEADER)?.trim();
  if (!token) return null;

  const expiresAt =
    response.headers.get(NEW_ACCESS_TOKEN_EXPIRES_AT_HEADER)?.trim() || null;
  const tokenType = getTokenType();

  setToken(token);
  if (expiresAt) {
    setTokenExpiration(expiresAt);
  }

  const session = { token, expiresAt, tokenType };
  unauthorizedHandled = false;
  lastUnauthorizedToken = null;
  accessTokenRenewedListeners.forEach((cb) => {
    try {
      cb(session);
    } catch (e) {
      console.error('Error in accessTokenRenewedListener:', e);
    }
  });
  return session;
};

const handleUnauthorizedOnce = (requestToken: string | null): void => {
  if (sessionReplaced) return;
  if (unauthorizedHandled && lastUnauthorizedToken === requestToken) return;
  unauthorizedHandled = true;
  lastUnauthorizedToken = requestToken;
  removeToken();
  onUnauthorizedCallback?.();
};

/**
 * Make an API request with automatic JWT token injection
 * @param endpoint - The API endpoint (e.g., '/Skill' or '/Employee/login')
 * @param options - Fetch options (method, headers, body, etc.)
 * @returns Promise<Response>
 */
export const apiRequest = async (
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<Response> => {
  const {
    skipAuth = false,
    suppressForbiddenCallback = false,
    headers = {},
    ...restOptions
  } = options;

  // Build headers - use Record type for proper indexing
  const requestHeaders: Record<string, string> = {
    'accept': 'text/plain',
    ...(headers as Record<string, string>),
  };

  // Add JWT token to headers if not skipping auth
  const requestToken = skipAuth ? null : getToken();
  if (requestToken) {
    requestHeaders['Authorization'] = `${getTokenType()} ${requestToken}`;
  }

  // Add Content-Type for requests with body (omit for FormData so browser sets multipart boundary)
  if (restOptions.body && !requestHeaders['Content-Type'] && !(restOptions.body instanceof FormData)) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  // TEMP: Use static data instead of calling backend/slicer APIs.
  // BUT: Always use real API for authentication and some endpoints we are actively integrating.
  const isAuthEndpoint =
    endpoint.includes('/Auth/') ||
    endpoint === '/Employee/login';

  const alwaysRealEndpoints = [
    '/ApprovalDetail',
    '/Skill',
    '/EmployeeStatus',
    '/ResponseArea',
    '/EmployeeType',
    '/DepartmentDivisions',
    '/DepartmentActivityType',
    '/DepartmentEquipment',
    '/DepartmentDefinedFields',
    '/DepartmentInvoiceConfig',
    '/Admin',
    '/AdminType',
    '/DepartmentAdmin',
    '/Department',
    '/Employee',
    '/Post',
    '/Questionnaire',
    '/ActivityForm',
    '/Question',
    '/Option',
    '/HolidayDay',
    '/RequesterRestrictedList',
    '/PtaeoCode',
    '/RequesterManager',
    '/RequesterEmployee',
    '/ClosedPostPosition',
    '/ClosedPostPositionEquipment',
    '/UploadFile',
    '/Invoice',
    '/InvoiceDetail',
    '/Request',
  ];

  const shouldUseStatic =
    USE_STATIC_DATA &&
    !isAuthEndpoint &&
    !alwaysRealEndpoints.some((p) => endpoint.includes(p));

  if (shouldUseStatic) {
    const staticResponse = await tryHandleStaticApiRequest(endpoint, {
      ...restOptions,
      headers: requestHeaders,
    });
    if (staticResponse) {
      if (
        !skipAuth &&
        requestToken &&
        !endpoint.includes('renew-token') 
      ) {
        recordAuthenticatedApiActivity();
      }
      applyRenewedAccessToken(staticResponse);
      return staticResponse;
    }
  }

  // Make the request
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...restOptions,
    headers: requestHeaders,
  });

  // Another web sign-in ended this session. Clear that token once and do not renew it.
  if (!skipAuth && (await responseIsSessionReplaced(response))) {
    const currentToken = getToken();
    if ((!currentToken || currentToken === requestToken) && !sessionReplaced) {
      sessionReplaced = true;
      removeToken();
      onUnauthorizedCallback?.('SESSION_REPLACED');
    }
    throw new Error(LOGIN.SESSION_REPLACED);
  }

  if (
    !skipAuth &&
    requestToken &&
    !endpoint.includes('renew-token')
  ) {
    recordAuthenticatedApiActivity();
  }

  const renewedSession = applyRenewedAccessToken(response);

  // A 401 without a replacement token ends the session. Guard the callback so
  // simultaneous failures cannot trigger duplicate logout/redirect handling.
  if (response.status === HttpStatus.UNAUTHORIZED && !skipAuth) {
    const isImpersonationSession = sessionStorage.getItem(IMPERSONATION_MODE_KEY) === '1';
    if (isImpersonationSession && !renewedSession) {
      handleUnauthorizedOnce(requestToken);
      throw new Error('Impersonation session expired. Please start impersonation again.');
    }

    if (!renewedSession) {
      handleUnauthorizedOnce(requestToken);
      throw new Error('Unauthorized: Please login again');
    }
  }

  // Handle 403 Forbidden - user is authenticated but not allowed to access the resource
  if (response.status === HttpStatus.FORBIDDEN) {
    if (!suppressForbiddenCallback && onForbiddenCallback) {
      onForbiddenCallback();
    }
    throw new Error('Forbidden: You are not allowed to access this screen');
  }

  return response;
};

/**
 * Make a GET request with automatic pagination query params
 * @param endpoint - The API endpoint
 * @param pagination - Optional pagination parameters
 * @param options - Additional fetch options
 * @returns Promise<Response>
 */
export const apiGetAll = async (
  endpoint: string,
  pagination?: PaginationParams,
  options: ApiRequestOptions = {}
): Promise<Response> => {
  const queryParams = buildPaginationQueryParams(pagination);
  const queryString = queryParams.toString();
  const fullEndpoint = queryString ? `${endpoint}?${queryString}` : endpoint;
  return apiGet(fullEndpoint, options);
};

/**
 * Make a GET request
 * @param endpoint - The API endpoint
 * @param options - Additional fetch options
 * @returns Promise<Response>
 */
export const apiGet = async (
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<Response> => {
  return apiRequest(endpoint, {
    ...options,
    method: 'GET',
  });
};

/**
 * Make a POST request
 * @param endpoint - The API endpoint
 * @param data - The data to send in the request body
 * @param options - Additional fetch options
 * @returns Promise<Response>
 */
export const apiPost = async (
  endpoint: string,
  data?: unknown,
  options: ApiRequestOptions = {}
): Promise<Response> => {
  return apiRequest(endpoint, {
    ...options,
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  });
};

/**
 * Make a PUT request
 * @param endpoint - The API endpoint
 * @param data - The data to send in the request body
 * @param options - Additional fetch options
 * @returns Promise<Response>
 */
export const apiPut = async (
  endpoint: string,
  data?: unknown,
  options: ApiRequestOptions = {}
): Promise<Response> => {
  return apiRequest(endpoint, {
    ...options,
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
  });
};

/**
 * Make a PATCH request
 * @param endpoint - The API endpoint
 * @param data - The data to send in the request body
 * @param options - Additional fetch options
 * @returns Promise<Response>
 */
export const apiPatch = async (
  endpoint: string,
  data?: unknown,
  options: ApiRequestOptions = {}
): Promise<Response> => {
  return apiRequest(endpoint, {
    ...options,
    method: 'PATCH',
    body: data ? JSON.stringify(data) : undefined,
  });
};

/**
 * Make a DELETE request
 * @param endpoint - The API endpoint
 * @param options - Additional fetch options
 * @returns Promise<Response>
 */
export const apiDelete = async (
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<Response> => {
  return apiRequest(endpoint, {
    ...options,
    method: 'DELETE',
  });
};

