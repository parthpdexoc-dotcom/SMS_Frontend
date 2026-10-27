/**
 * Authentication API Service
 * Handles all API calls related to Authentication
 */

import { apiPost, clearSessionReplaced, isSessionReplaced, RenewedAccessToken } from '@/utils/apiClient';
import { setToken, removeToken, setTokenExpiration, setTokenType, getToken } from '@/utils/token';
import { decodeToken } from '@/utils/jwtDecoder';
import { getErrorMessageFromErrorResponse } from '@/services/textPlainJson';

export interface LoginRequest {
  departmentCode?: string;
  username: string;
  password: string;
}

export interface TokenDto {
  token?: string;
  expiresAt: string;
  tokenType: string;
  isPasswordReset?: boolean;
}

const IMPERSONATION_MODE_KEY = 'is_impersonation_session';
const AUTH_TOKEN_KEY = 'auth_token';
const AUTH_TOKEN_EXPIRATION_KEY = 'auth_token_expires_at';
const AUTH_TOKEN_TYPE_KEY = 'auth_token_type';

/** Centralized tab-scoped auth accessors (sessionStorage-backed). */
export const setAuthToken = (token: string, expiresAt?: string, tokenType: string = 'Bearer'): void => {
  clearSessionReplaced();
  setToken(token);
  setTokenType(tokenType && tokenType.trim() ? tokenType.trim() : 'Bearer');
  if (expiresAt && expiresAt.trim()) {
    setTokenExpiration(expiresAt.trim());
  }
};

export const getAuthToken = (): string | null => {
  const raw = sessionStorage.getItem(AUTH_TOKEN_KEY);
  return raw && raw.trim() ? raw : null;
};

export const clearAuthToken = (): void => {
  removeToken();
};

export const isAuthenticated = (): boolean => {
  return !!getAuthToken();
};

export const setImpersonationMode = (enabled: boolean): void => {
  if (enabled) {
    sessionStorage.setItem(IMPERSONATION_MODE_KEY, '1');
  } else {
    sessionStorage.removeItem(IMPERSONATION_MODE_KEY);
  }
};

export const isImpersonationSession = (): boolean => {
  return sessionStorage.getItem(IMPERSONATION_MODE_KEY) === '1';
};

export const clearImpersonationMode = (): void => {
  sessionStorage.removeItem(IMPERSONATION_MODE_KEY);
};

/** Clean bootstrap URL — no token in query or hash. */
export const buildEmployeeTabLoginUrl = (): string => {
  const basePath = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
  return `${window.location.origin}${basePath}/employee-auto-login`;
};

/** Seed the target tab's sessionStorage (tab-scoped; does not touch the opener tab). */
const seedEmployeeTabSession = (
  targetWindow: Window,
  token: string,
  expiresAt?: string,
  tokenType?: string
): void => {
  targetWindow.sessionStorage.setItem(AUTH_TOKEN_KEY, token);
  targetWindow.sessionStorage.setItem(
    AUTH_TOKEN_TYPE_KEY,
    tokenType && tokenType.trim() ? tokenType.trim() : 'Bearer'
  );
  if (expiresAt && expiresAt.trim()) {
    targetWindow.sessionStorage.setItem(AUTH_TOKEN_EXPIRATION_KEY, expiresAt.trim());
  }
  targetWindow.sessionStorage.setItem(IMPERSONATION_MODE_KEY, '1');
};

/**
 * Hand token to a new tab via that tab's sessionStorage, then open /employee-auto-login.
 * Accepts a pre-opened tab reference to avoid popup blockers during async flows.
 */
export const openNewTabWithEmployeeToken = (
  token: string,
  expiresAt?: string,
  tokenType?: string,
  targetWindow?: Window | null
): void => {
  const safeToken = String(token ?? '').trim();
  if (!safeToken) {
    throw new Error('Token is required to open employee tab');
  }

  const href = buildEmployeeTabLoginUrl();
  const child = targetWindow ?? window.open('about:blank', '_blank');
  if (!child) {
    throw new Error('Popup was blocked. Please allow popups for this site.');
  }
  child.opener = null;
  seedEmployeeTabSession(child, safeToken, expiresAt, tokenType);
  child.location.href = href;
};

/** Request short-lived employee JWT using current superuser bearer token. */
export const impersonateEmployee = async (employeeId: string): Promise<TokenDto> => {
  const id = String(employeeId ?? '').trim();
  if (!id) throw new Error('Employee id is required');

  const response = await apiPost(
    '/auth/impersonate',
    { employeeId: id },
    {
      headers: {
        accept: 'application/json, text/plain',
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(getErrorMessageFromErrorResponse(errorText, errorText));
  }

  const responseText = await response.text();
  let data: TokenDto;
  try {
    data = JSON.parse(responseText) as TokenDto;
  } catch {
    data = { token: responseText.trim(), expiresAt: '', tokenType: 'Bearer' };
  }

  if (!data.token || !String(data.token).trim()) {
    throw new Error('No token received from impersonation response');
  }
  return data;
};

/**
 * One-call helper:
 * - opens a new tab synchronously
 * - requests impersonation token
 * - seeds that tab's sessionStorage, then navigates to /employee-auto-login
 */
export const openEmployeeImpersonationTab = async (employeeId: string): Promise<void> => {
  const newTab = window.open('about:blank', '_blank');
  if (!newTab) {
    throw new Error('Popup was blocked. Please allow popups for this site.');
  }
  newTab.opener = null;
  try {
    const tokenDto = await impersonateEmployee(employeeId);
    openNewTabWithEmployeeToken(tokenDto.token!, tokenDto.expiresAt, tokenDto.tokenType, newTab);
  } catch (error) {
    newTab.close();
    throw error;
  }
};

const LOGIN_CLIENT_KEY = 'R4xu3Z0qpitTg9DM';
const LOGIN_CLIENT_IV = 'sftqtIQ83aBrSAVi';

// Precomputed AES-128-CBC encryption of 'web' with LOGIN_CLIENT_KEY and LOGIN_CLIENT_IV.
// In non-secure HTTP contexts (e.g. http://122.170.13.77:90), browser crypto.subtle is undefined.
const PRECOMPUTED_WEB_LOGIN_CLIENT = 'F2fPnBPdTmx8pu2iTCevEQ==';

const encryptWebLoginClient = async (): Promise<string> => {
  try {
    const subtle = typeof window !== 'undefined' ? window.crypto?.subtle : undefined;
    if (subtle) {
      const encodedKey = new TextEncoder().encode(LOGIN_CLIENT_KEY);
      const key = await subtle.importKey('raw', encodedKey.buffer as ArrayBuffer, { name: 'AES-CBC' }, false, ['encrypt']);
      const encrypted = new Uint8Array(
        await subtle.encrypt(
          { name: 'AES-CBC', iv: new TextEncoder().encode(LOGIN_CLIENT_IV) },
          key,
          new TextEncoder().encode('web')
        )
      );
      return btoa(String.fromCharCode(...encrypted));
    }
  } catch (error) {
    console.warn('WebCrypto AES encryption unavailable, using precomputed client token:', error);
  }
  return PRECOMPUTED_WEB_LOGIN_CLIENT;
};

/**
 * Login with username and password (Employee)
 * @param credentials - Login credentials (username and password)
 * @returns Promise<TokenDto> - The token response with token, expiresAt, and tokenType
 */
export const login = async (credentials: LoginRequest): Promise<TokenDto> => {
  try {
    const response = await apiPost(
      '/Employee/login',
      {
        ...credentials,
        deviceToken: '',
        loginClient: await encryptWebLoginClient(),
      },
      {
        skipAuth: true, // Don't send token for login request
        headers: {
          // Backend returns text/plain (either a raw token string or JSON encoded in text/plain)
          'accept': 'text/plain',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(getErrorMessageFromErrorResponse(errorText, errorText));
    }

    // Backend returns text/plain, so handle text then attempt JSON parse
    const responseText = await response.text();

    let data: TokenDto;
    try {
      data = JSON.parse(responseText) as TokenDto;
    } catch {
      // If it's not JSON, assume the entire response is the JWT token
      data = {
        token: responseText.trim(),
        expiresAt: '',
        tokenType: 'Bearer',
      };
    }

    if (!data.isPasswordReset && (!data.token || !String(data.token).trim())) {
      throw new Error('No token received from server');
    }

    // Store token only for successful sign-in (no forced reset)
    if (data.token && String(data.token).trim()) {
      setAuthToken(data.token, data.expiresAt, data.tokenType);
      clearImpersonationMode();
    }

    return data;
  } catch (error) {
    console.error('Error during employee login:', error);
    throw error;
  }
};

/**
 * Admin login with username and password
 * @param credentials - Login credentials (username and password)
 * @returns Promise<TokenDto> - The token response with token, expiresAt, and tokenType
 */
export const adminLogin = async (credentials: LoginRequest): Promise<TokenDto> => {
  try {
    const response = await apiPost(
      '/Admin/login',
      credentials,
      {
        skipAuth: true, // Don't send token for login request
        headers: {
          // Backend returns text/plain (either a raw token string or JSON encoded in text/plain)
          'accept': 'text/plain',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(getErrorMessageFromErrorResponse(errorText, errorText));
    }

    // Backend returns text/plain, so handle text then attempt JSON parse
    const responseText = await response.text();

    let data: TokenDto;
    try {
      data = JSON.parse(responseText) as TokenDto;
    } catch {
      // If it's not JSON, assume the entire response is the JWT token
      data = {
        token: responseText.trim(),
        expiresAt: '',
        tokenType: 'Bearer',
      };
    }

    if (!data.isPasswordReset && (!data.token || !String(data.token).trim())) {
      throw new Error('No token received from server');
    }

    // Store token only for successful sign-in (no forced reset)
    if (data.token && String(data.token).trim()) {
      setAuthToken(data.token, data.expiresAt, data.tokenType);
      clearImpersonationMode();
    }

    return data;
  } catch (error) {
    console.error('Error during admin login:', error);
    throw error;
  }
};

/**
 * Logout - removes the token from storage
 */
export const logout = (): void => {
  clearAuthToken();
  clearImpersonationMode();
};

/**
 * Renew access token session when Stay Signed In is clicked.
 * Performs backend token renewal request via role-specific endpoint:
 * POST /Admin/renew-token for Admin sessions or POST /Employee/renew-token for Employee sessions.
 */
export const renewTokenSession = async (): Promise<RenewedAccessToken | null> => {
  if (isSessionReplaced()) return null;
  try {
    const currentToken = getToken();
    const decoded = currentToken ? decodeToken(currentToken) : null;
    const userType = decoded?.UserType || (decoded as { userType?: string })?.userType;
    const isAdmin =
      String(userType).toLowerCase() === 'admin' ||
      Boolean(decoded?.AdminID || (decoded as { adminID?: string })?.adminID);

    const endpoint = isAdmin ? '/Admin/renew-token' : '/Employee/renew-token';
    const response = await apiPost(endpoint, {});
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to renew token session:', errorText);
      return null;
    }

    const data = (await response.json()) as TokenDto;
    if (data?.token) {
      if (isSessionReplaced()) return null;
      setToken(data.token);
      if (data.expiresAt) {
        setTokenExpiration(data.expiresAt);
      }
      if (data.tokenType) {
        setTokenType(data.tokenType);
      }
      return {
        token: data.token,
        expiresAt: data.expiresAt || null,
        tokenType: data.tokenType || 'Bearer',
      };
    }
    return null;
  } catch (error) {
    console.error('Failed to renew token session:', error);
    return null;
  }
};

export interface ForgotPasswordRequest {
  departmentCode?: string;
  username?: string;
  otp?: string;
  newPassword?: string;
  isPasswordReset?: boolean;
}

export interface LoginPasswordResetRequest {
  departmentCode?: string;
  username: string;
  password: string;
  newPassword: string;
  isPasswordReset?: boolean;
}

export type ForgotPasswordResetRequest = ForgotPasswordRequest | LoginPasswordResetRequest;

export interface ForgotPasswordResponse {
  loginId?: string;
  message?: string;
  [key: string]: unknown;
}

/**
 * Forgot Password - Send OTP to registered email
 * @param request - Forgot password OTP request (email)
 * @returns Promise<ForgotPasswordResponse>
 */
export const sendForgotPasswordOtp = async (
  request: ForgotPasswordRequest
): Promise<ForgotPasswordResponse> => {
  try {
    const response = await apiPost(
      '/Employee/forgot-password/send-otp',
      request,
      {
        skipAuth: true,
        headers: {
          accept: 'text/plain',
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      const message = getErrorMessageFromErrorResponse(
        errorText,
        `Send OTP failed: ${response.status}`
      );
      throw new Error(message);
    }

    // The API returns text/plain, so we need to handle it accordingly
    const responseText = await response.text();

    // Try to parse as JSON if possible
    let data: ForgotPasswordResponse;
    try {
      data = JSON.parse(responseText) as ForgotPasswordResponse;
    } catch {
      // If it's not JSON, assume the entire response is the loginId
      data = { loginId: responseText.trim(), message: responseText.trim() };
    }

    return data;
  } catch (error) {
    console.error('Error sending forgot-password OTP:', error);
    throw error;
  }
};

/**
 * Forgot Password - Verify OTP
 * @param request - OTP verification request (email, otp)
 * @returns Promise<ForgotPasswordResponse>
 */
export const verifyForgotPasswordOtp = async (
  request: ForgotPasswordRequest
): Promise<ForgotPasswordResponse> => {
  try {
    const response = await apiPost(
      '/Employee/forgot-password/verify-otp',
      request,
      {
        skipAuth: true,
        headers: {
          accept: 'text/plain',
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      const message = getErrorMessageFromErrorResponse(
        errorText,
        `Verify OTP failed: ${response.status}`
      );
      throw new Error(message);
    }

    const responseText = await response.text();

    let data: ForgotPasswordResponse;
    try {
      data = JSON.parse(responseText) as ForgotPasswordResponse;
    } catch {
      data = { message: responseText.trim() };
    }

    return data;
  } catch (error) {
    console.error('Error verifying forgot-password OTP:', error);
    throw error;
  }
};

/**
 * Forgot Password - Reset password
 * @param request - reset request (email, otp, newPassword)
 * @returns Promise<ForgotPasswordResponse>
 */
export const resetForgotPassword = async (
  request: ForgotPasswordResetRequest
): Promise<ForgotPasswordResponse> => {
  try {
    const isPasswordReset = request.isPasswordReset === true;
    const { isPasswordReset: _isPasswordReset, ...requestBody } = request;
    const resetEndpoint = isPasswordReset
      ? '/Employee/forgot-password/reset?isPasswordReset=true'
      : '/Employee/forgot-password/reset';

    const response = await apiPost(
      resetEndpoint,
      requestBody,
      {
        skipAuth: true,
        headers: {
          accept: 'text/plain',
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      const message = getErrorMessageFromErrorResponse(
        errorText,
        `Reset password failed: ${response.status}`
      );
      throw new Error(message);
    }

    const responseText = await response.text();

    let data: ForgotPasswordResponse;
    try {
      data = JSON.parse(responseText) as ForgotPasswordResponse;
    } catch {
      data = { message: responseText.trim() };
    }

    return data;
  } catch (error) {
    console.error('Error resetting forgot password:', error);
    throw error;
  }
};

