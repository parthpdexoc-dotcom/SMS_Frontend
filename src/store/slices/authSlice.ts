/**
 * Auth Redux Slice
 */
import { createSlice, createAsyncThunk, PayloadAction, type Reducer } from '@reduxjs/toolkit';
import {
  login as loginApi,
  adminLogin as adminLoginApi,
  logout as logoutApi,
  sendForgotPasswordOtp as sendForgotPasswordOtpApi,
  verifyForgotPasswordOtp as verifyForgotPasswordOtpApi,
  resetForgotPassword as resetForgotPasswordApi,
  LoginRequest,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  LoginPasswordResetRequest,
} from '@/services/authService';
import { getUserFromToken } from '@/utils/jwtDecoder';
import { getToken } from '@/utils/token';
import { clearSessionCredentials, getCredentials } from '@/utils/credentials';
import { clearAllDailyWorkspaceSessionState } from '@/utils/dailyWorkspaceSessionState';
import { LOGIN } from '@/constants/strings';

type ForgotPasswordOtpRequest = {
  departmentCode?: string;
  username?: string;
};

export interface UserInfo {
  // Common fields
  userType?: 'Employee' | 'Admin';
  username?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;

  // Employee-specific fields
  employeeID?: string;
  badgeNumber?: string;
  departmentID?: string;
  departmentName?: string;
  departmentCode?: string;
  employeeTypeID?: string;
  employeeTypeShort?: string;
  employeeTypeLong?: string;
  isSupervisor?: boolean;
  statusID?: string;
  statusShort?: string;
  statusLong?: string;

  // Admin-specific fields
  adminID?: string;
  adminTypeID?: string;
  adminTypeShort?: string;
  adminTypeLong?: string;

  // Role and permissions (roles from token e.g. "role": ["SuperUser"])
  adminTypes?: string[];
  adminTypeIDs?: string[];
  role?: string;
  roles?: string[];
  isSuperUser?: boolean;
  skills?: string[];
  skillsStartDates?: string[];
  skillsEndDates?: string[];
  /** From JWT EnableOpenWaitingList (DepartmentConfiguration.EnableOpenAgencyWaitLists at login). */
  enableOpenAgencyWaitLists?: boolean;
  /** From JWT AllowEmployeeCancellation. */
  allowEmployeeCancellation?: boolean;
  /** From JWT EnableEmployeeSplittingPosts. */
  enableEmployeeSplittingPosts?: boolean;
  /** From JWT EnablePolicyManagement (sidebar). */
  enablePolicyManagement?: boolean;
  /** From JWT UseAgencyDefinedFields (sidebar). */
  useAgencyDefinedFields?: boolean;
  /** Parsed from JWT claim `ReleaseAsTabTier` only (0–3). */
  releaseAsTabTier?: 0 | 1 | 2 | 3;
  /** From JWT `isLogo` / `IsLogo`: when true, load header profile photo from API. */
  isLogo?: boolean;
  /** From JWT `Interval` (seconds, e.g. 30 for location tracking). */
  interval?: number;
}

export interface AuthState {
  token: string | null;
  tokenExpiresAt: string | null;
  tokenType: string | null;
  user: UserInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  forgotPasswordData: ForgotPasswordResponse | null;
  /** Incremented after the signed-in user updates their employee photo so the header refetches. */
  profilePhotoRefreshNonce: number;
}

const initialState: AuthState = {
  token: null,
  tokenExpiresAt: null,
  tokenType: null,
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,
  error: null,
  forgotPasswordData: null,
  profilePhotoRefreshNonce: 0,
};

/**
 * Must run before login.fulfilled updates Redux: otherwise App mounts BrowserRouter while
 * `window.location` is still the previous user's path and React Router stays on that route.
 */
const replaceHistoryToDashboardForFreshLogin = (): void => {
  if (typeof window === 'undefined') return;
  const basePath = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
  window.history.replaceState(window.history.state, '', `${basePath}/dashboard`);
};

// Async thunks
export const login = createAsyncThunk(
  'auth/login',
  async (credentials: LoginRequest, { rejectWithValue }) => {
    try {
      const tokenDto = await loginApi(credentials);

      const hasToken = Boolean(tokenDto.token && String(tokenDto.token).trim());
      const user = hasToken ? getUserFromToken(tokenDto.token!) : null;
      if (hasToken && !tokenDto.isPasswordReset) {
        replaceHistoryToDashboardForFreshLogin();
      }

      return {
        ...tokenDto,
        user,
      };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Employee login failed');
    }
  }
);

export const adminLogin = createAsyncThunk(
  'auth/adminLogin',
  async (credentials: LoginRequest, { rejectWithValue }) => {
    try {
      const tokenDto = await adminLoginApi(credentials);

      const hasToken = Boolean(tokenDto.token && String(tokenDto.token).trim());
      const user = hasToken ? getUserFromToken(tokenDto.token!) : null;
      if (hasToken && !tokenDto.isPasswordReset) {
        replaceHistoryToDashboardForFreshLogin();
      }

      return {
        ...tokenDto,
        user,
      };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Admin login failed');
    }
  }
);

// Initialize auth state from stored token
export const initializeAuth = createAsyncThunk(
  'auth/initialize',
  async (_, { rejectWithValue }) => {
    try {
      const token = getToken();
      if (!token) {
        return null;
      }

      // Extract user info from token
      const user = getUserFromToken(token);
      if (!user) {
        return null;
      }

      // Get expiration from localStorage
      const expiresAt = localStorage.getItem('auth_token_expires_at');

      // Infer userType from stored credentials (set at login)
      const credentials = getCredentials();
      const userType = credentials?.type;

      return {
        token,
        tokenExpiresAt: expiresAt,
        tokenType: 'Bearer',
        user: userType ? { ...user, userType } : user,
      };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to initialize auth');
    }
  }
);

export const logout = createAsyncThunk(
  'auth/logout',
  async (sessionEndedMessage: string | void, { rejectWithValue }) => {
    try {
      logoutApi();
      // Clear only session credentials so "Remember Me" (localStorage) credentials persist after logout
      clearSessionCredentials();
      clearAllDailyWorkspaceSessionState();
      return sessionEndedMessage || null;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Logout failed');
    }
  }
);

export const sendForgotPasswordOtp = createAsyncThunk(
  'auth/sendForgotPasswordOtp',
  async (request: ForgotPasswordOtpRequest, { rejectWithValue }) => {
    try {
      const response = await sendForgotPasswordOtpApi(request);
      return response;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to send OTP');
    }
  }
);

export const verifyForgotPasswordOtp = createAsyncThunk(
  'auth/verifyForgotPasswordOtp',
  async (request: ForgotPasswordRequest, { rejectWithValue }) => {
    try {
      const response = await verifyForgotPasswordOtpApi(request);
      return response;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to verify OTP');
    }
  }
);

export const resetForgotPassword = createAsyncThunk(
  'auth/resetForgotPassword',
  async (request: ForgotPasswordRequest, { rejectWithValue }) => {
    try {
      const response = await resetForgotPasswordApi(request);
      return response;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to reset password');
    }
  }
);

export const resetPasswordAfterLogin = createAsyncThunk(
  'auth/resetPasswordAfterLogin',
  async (
    payload: { request: LoginPasswordResetRequest; loginType: 'employee' | 'admin' },
    { rejectWithValue }
  ) => {
    try {
      const response = await resetForgotPasswordApi(payload.request);
      return response;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to reset password');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearForgotPasswordData: (state) => {
      state.forgotPasswordData = null;
    },
    setAuthenticated: (state, action: PayloadAction<boolean>) => {
      state.isAuthenticated = action.payload;
    },
    accessTokenRenewed: (
      state,
      action: PayloadAction<{ token: string; expiresAt: string | null; tokenType: string }>
    ) => {
      const renewedUser = getUserFromToken(action.payload.token);
      const userType = state.user?.userType;

      state.token = action.payload.token;
      if (action.payload.expiresAt) {
        state.tokenExpiresAt = action.payload.expiresAt;
      }
      state.tokenType = action.payload.tokenType;
      state.user = renewedUser
        ? { ...renewedUser, ...(userType ? { userType } : {}) }
        : state.user;
      state.isAuthenticated = true;
      state.error = null;
    },
    bumpProfilePhotoRefresh: (state) => {
      state.profilePhotoRefreshNonce += 1;
    },
    updateSessionUserProfile: (
      state,
      action: PayloadAction<Partial<Pick<UserInfo, 'firstName' | 'lastName' | 'username'>>>
    ) => {
      if (!state.user) return;
      const p = action.payload;
      if (p.firstName !== undefined) state.user.firstName = p.firstName;
      if (p.lastName !== undefined) state.user.lastName = p.lastName;
      if (p.username !== undefined) state.user.username = p.username;
    },
  },
  extraReducers: (builder) => {
    builder
      // Employee Login
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload.isPasswordReset) {
          state.token = null;
          state.tokenExpiresAt = null;
          state.tokenType = null;
          state.user = null;
          state.isAuthenticated = false;
        } else {
          state.token = action.payload.token ?? null;
          state.tokenExpiresAt = action.payload.expiresAt;
          state.tokenType = action.payload.tokenType;
          state.user = action.payload.user
            ? { ...action.payload.user, userType: 'Employee' as const }
            : null;
          state.isAuthenticated = true;
        }
        state.error = null;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
        state.token = null;
        state.tokenExpiresAt = null;
        state.tokenType = null;
        state.user = null;
      })
      // Admin Login
      .addCase(adminLogin.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(adminLogin.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload.isPasswordReset) {
          state.token = null;
          state.tokenExpiresAt = null;
          state.tokenType = null;
          state.user = null;
          state.isAuthenticated = false;
        } else {
          state.token = action.payload.token ?? null;
          state.tokenExpiresAt = action.payload.expiresAt;
          state.tokenType = action.payload.tokenType;
          state.user = action.payload.user
            ? { ...action.payload.user, userType: 'Admin' as const }
            : null;
          state.isAuthenticated = true;
        }
        state.error = null;
      })
      .addCase(adminLogin.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
        state.token = null;
        state.tokenExpiresAt = null;
        state.tokenType = null;
        state.user = null;
      })
      // Initialize Auth
      .addCase(initializeAuth.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(initializeAuth.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isInitialized = true;
        if (action.payload) {
          state.token = action.payload.token;
          state.tokenExpiresAt = action.payload.tokenExpiresAt;
          state.tokenType = action.payload.tokenType;
          state.user = action.payload.user || null;
          state.isAuthenticated = true;
        } else {
          state.isAuthenticated = false;
          state.token = null;
          state.tokenExpiresAt = null;
          state.tokenType = null;
          state.user = null;
        }
      })
      .addCase(initializeAuth.rejected, (state) => {
        state.isLoading = false;
        state.isInitialized = true;
        state.isAuthenticated = false;
        state.token = null;
        state.tokenExpiresAt = null;
        state.tokenType = null;
        state.user = null;
      })
      // Logout
      .addCase(logout.fulfilled, (state, action) => {
        state.token = null;
        state.tokenExpiresAt = null;
        state.tokenType = null;
        state.user = null;
        state.isAuthenticated = false;
        const endedMessage = action.payload;
        if (typeof endedMessage === 'string' && endedMessage) {
          state.error = endedMessage;
        } else if (state.error !== LOGIN.SESSION_REPLACED) {
          state.error = null;
        }
        state.profilePhotoRefreshNonce = 0;
      })
      // Forgot Password - Send OTP
      .addCase(sendForgotPasswordOtp.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(sendForgotPasswordOtp.fulfilled, (state, action) => {
        state.isLoading = false;
        state.forgotPasswordData = action.payload;
        state.error = null;
      })
      .addCase(sendForgotPasswordOtp.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.forgotPasswordData = null;
      })
      // Forgot Password - Verify OTP
      .addCase(verifyForgotPasswordOtp.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(verifyForgotPasswordOtp.fulfilled, (state, action) => {
        state.isLoading = false;
        state.forgotPasswordData = action.payload;
        state.error = null;
      })
      .addCase(verifyForgotPasswordOtp.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.forgotPasswordData = null;
      })
      // Forgot Password - Reset
      .addCase(resetForgotPassword.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(resetForgotPassword.fulfilled, (state, action) => {
        state.isLoading = false;
        state.forgotPasswordData = action.payload;
        state.error = null;
      })
      .addCase(resetForgotPassword.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.forgotPasswordData = null;
      })
      // Forced Reset after login response
      .addCase(resetPasswordAfterLogin.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(resetPasswordAfterLogin.fulfilled, (state, action) => {
        state.isLoading = false;
        state.forgotPasswordData = action.payload;
        state.error = null;
      })
      .addCase(resetPasswordAfterLogin.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const {
  clearError,
  clearForgotPasswordData,
  setAuthenticated,
  accessTokenRenewed,
  bumpProfilePhotoRefresh,
  updateSessionUserProfile,
} = authSlice.actions;
export default authSlice.reducer as Reducer<AuthState>;

