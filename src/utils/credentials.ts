/**
 * Credentials Utility
 * securely stores user credentials for silent token refresh
 * NOTE: Storing credentials locally is generally not recommended for high-security applications,
 * but allows for "silent background login" when standard refresh tokens are not available.
 */

import { LoginRequest } from '@/services/authService';

const CREDENTIALS_KEY = 'auth_creds';
const USER_TYPE_KEY = 'auth_type';

export type UserLoginType = 'Employee' | 'Admin';

interface StoredCredentials extends LoginRequest {
  type: UserLoginType;
}

/**
 * Save credentials (obfuscated)
 * @param credentials - The login credentials
 * @param type - User type (Employee or Admin)
 * @param persistent - If true, saves to localStorage (for "Remember Me"), otherwise sessionStorage (for silent refresh during active session)
 */
export const saveCredentials = (
  credentials: LoginRequest,
  type: UserLoginType,
  persistent: boolean = false
): void => {
  try {
    // Simple base64 encoding to avoid plain text
    const data = JSON.stringify({ ...credentials, type });
    const encoded = btoa(data);

    // Always clear old ones first to avoid ambiguity
    localStorage.removeItem(CREDENTIALS_KEY);
    localStorage.removeItem(USER_TYPE_KEY);
    sessionStorage.removeItem(CREDENTIALS_KEY);
    sessionStorage.removeItem(USER_TYPE_KEY);

    const storage = persistent ? localStorage : sessionStorage;
    storage.setItem(CREDENTIALS_KEY, encoded);
    storage.setItem(USER_TYPE_KEY, type);
  } catch (error) {
    console.error('Error saving credentials:', error);
  }
};

/**
 * Get credentials from storage (checks localStorage first, then sessionStorage)
 */
export const getCredentials = (): StoredCredentials | null => {
  try {
    let encoded = localStorage.getItem(CREDENTIALS_KEY);

    if (!encoded) {
      encoded = sessionStorage.getItem(CREDENTIALS_KEY);
    }

    if (!encoded) return null;

    const decoded = atob(encoded);
    return JSON.parse(decoded) as StoredCredentials;
  } catch (error) {
    console.error('Error retrieving credentials:', error);
    return null;
  }
};

/**
 * Clear only session credentials (used on logout to preserve "Remember Me" localStorage data)
 */
export const clearSessionCredentials = (): void => {
  sessionStorage.removeItem(CREDENTIALS_KEY);
  sessionStorage.removeItem(USER_TYPE_KEY);
};

/**
 * Clear stored credentials from all storages
 */
export const clearCredentials = (): void => {
  localStorage.removeItem(CREDENTIALS_KEY);
  localStorage.removeItem(USER_TYPE_KEY);
  sessionStorage.removeItem(CREDENTIALS_KEY);
  sessionStorage.removeItem(USER_TYPE_KEY);
};

/**
 * Accessor for "Remember Me" functionality
 */
export const getSavedCredentials = (): StoredCredentials | null => {
  // Specifically for "Remember Me" on login screen, we only care about localStorage
  try {
    const encoded = localStorage.getItem(CREDENTIALS_KEY);
    if (!encoded) return null;
    const decoded = atob(encoded);
    return JSON.parse(decoded) as StoredCredentials;
  } catch {
    return null;
  }
};

/**
 * Check if persistent "Remember Me" is enabled
 */
export const isRememberMeEnabled = (): boolean => {
  return !!localStorage.getItem(CREDENTIALS_KEY);
};
