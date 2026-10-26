import React, { useState, useEffect } from 'react';
import { SMSButton, SMSTextField, SMSCheckbox, SMSTabs, SMSTypography, SMSCard, SMSStackRow, SMSStackColumn } from '@/components/smsatoms';
import { LoginProps } from '@/types';
import { LOGIN, ADMIN_LOGIN, FORGOT_PASSWORD } from '@/constants/strings';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  login as loginThunk,
  adminLogin as adminLoginThunk,
  resetPasswordAfterLogin,
  sendForgotPasswordOtp,
  verifyForgotPasswordOtp,
  resetForgotPassword,
  clearError,
} from '@/store/slices/authSlice';
import { SMSAlert } from '@/components/smsmolecules';
import { SMSModal } from '@/components/smsorganisms';
import smsLogo from '@/assets/SMS-logo.png';
import { getSavedCredentials, saveCredentials, isRememberMeEnabled } from '@/utils/credentials';
import './Login.css';

interface ExtendedLoginProps extends LoginProps {
  loginType?: 'employee' | 'admin';
  onLoginTypeChange?: (type: 'employee' | 'admin') => void;
}

const LOGIN_PASSWORD_RESET = {
  TITLE: 'Reset Password',
  SUBTITLE: 'You must update your password before signing in.',
  NEW_PASSWORD_LABEL: 'New Password',
  NEW_PASSWORD_PLACEHOLDER: 'Enter new password',
  CONFIRM_PASSWORD_LABEL: 'Confirm Password',
  CONFIRM_PASSWORD_PLACEHOLDER: 'Re-enter new password',
  SAVE_BUTTON: 'Save Password',
  CANCEL_BUTTON: 'Cancel',
  ERRORS: {
    NEW_PASSWORD_REQUIRED: 'New password is required',
    CONFIRM_PASSWORD_REQUIRED: 'Please confirm your new password',
    PASSWORDS_DO_NOT_MATCH: 'Passwords do not match',
  },
};

export const Login: React.FC<ExtendedLoginProps> = ({
  onLogin,
  className = '',
  loginType = 'employee',
  onLoginTypeChange,
}) => {
  const dispatch = useAppDispatch();
  const { isLoading, error } = useAppSelector((state) => state.auth);
  // Remember-me dept must exist on first paint; useEffect runs too late and the first submit could omit it
  const [departmentCode, setDepartmentCode] = useState(
    () => getSavedCredentials()?.departmentCode || ''
  );
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showResetPasswordPopup, setShowResetPasswordPopup] = useState(false);
  const [showForgotPasswordFlowPopup, setShowForgotPasswordFlowPopup] = useState(false);
  const [forgotPasswordStep, setForgotPasswordStep] = useState<'otp' | 'reset'>('otp');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [resetConfirmPasswordValue, setResetConfirmPasswordValue] = useState('');
  const [resetPasswordSuccessMessage, setResetPasswordSuccessMessage] = useState('');
  const [resetPasswordErrors, setResetPasswordErrors] = useState<{
    newPassword?: string;
    confirmPassword?: string;
  }>({});
  const [fieldErrors, setFieldErrors] = useState<{
    departmentCode?: string;
    username?: string;
    password?: string;
  }>({});
  const [forgotFlowErrors, setForgotFlowErrors] = useState<{
    otp?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});
  const [forgotOtpSentSuccess, setForgotOtpSentSuccess] = useState(false);
  const [pendingResetCredentials, setPendingResetCredentials] = useState<{
    departmentCode?: string;
    username: string;
    password: string;
    token?: string;
  } | null>(null);

  // Dynamic strings based on login type
  const strings = loginType === 'admin' ? ADMIN_LOGIN : LOGIN;
  const forgotPasswordModalError = showForgotPasswordFlowPopup ? error : null;
  const loginFormError = showForgotPasswordFlowPopup ? null : error;

  // Load saved credentials on component mount
  useEffect(() => {
    const saved = getSavedCredentials();
    if (saved) {
      setDepartmentCode(saved.departmentCode || '');
      setUsername(saved.username || '');
      setPassword(saved.password);
      setRememberMe(isRememberMeEnabled());
    }
  }, []);

  const validateLoginFields = (includePassword: boolean): boolean => {
    const newErrors: { departmentCode?: string; username?: string; password?: string } = {};

    if (loginType === 'employee' && !departmentCode.trim()) {
      newErrors.departmentCode = LOGIN.ERRORS.DEPARTMENT_CODE_REQUIRED;
    }

    if (!username.trim()) {
      newErrors.username = loginType === 'admin'
        ? ADMIN_LOGIN.ERRORS.USERNAME_REQUIRED
        : LOGIN.ERRORS.EMPLOYEE_NUMBER_REQUIRED;
    }

    if (includePassword && !password.trim()) {
      newErrors.password = loginType === 'admin'
        ? ADMIN_LOGIN.ERRORS.PASSWORD_REQUIRED
        : LOGIN.ERRORS.PASSWORD_REQUIRED;
    }
    // Do not enforce min length here — backend validates; we need the API to run
    // so state.auth.error can show the backend message (authService throws response.text()).

    setFieldErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetPasswordSuccessMessage('');

    if (!validateLoginFields(true)) {
      return;
    }

    const loginAction = loginType === 'admin' ? adminLoginThunk : loginThunk;
    const credentials = loginType === 'admin'
      ? {
          username: username.trim(),
          password,
        }
      : {
          departmentCode: departmentCode.trim(),
          username: username.trim(),
          password,
        };

    try {
      const response = await dispatch(
        loginAction(credentials)
      ).unwrap();
      console.log('Login response:', response);

      if (response?.isPasswordReset) {
        setPendingResetCredentials({
          departmentCode: loginType === 'employee' ? departmentCode.trim() : undefined,
          username: username.trim(),
          password,
          token: response?.token,
        });
        setShowResetPasswordPopup(true);
        return;
      }

      // Save credentials for silent refresh (always saved to session, conditionally to local)
      saveCredentials(
        credentials,
        loginType === 'admin' ? 'Admin' : 'Employee',
        rememberMe
      );

      // Login successful - call the onLogin callback if provided
      if (onLogin) {
        onLogin(username, password);
      }
    } catch {
      // Rejected: authSlice already set state.error from backend (rejectWithValue message)
    }
  };

  const handleForgotPasswordClick = async () => {
    dispatch(clearError());
    setResetPasswordSuccessMessage('');
    if (!validateLoginFields(false)) return;

    try {
      const response = await dispatch(
        sendForgotPasswordOtp({
          departmentCode: loginType === 'employee' ? departmentCode.trim() : '',
          username: username.trim(),
        })
      ).unwrap();

      const loginId = typeof response?.loginId === 'string' ? response.loginId.trim() : '';
      if (loginId && !username.trim()) {
        setUsername(loginId);
      }
      setForgotOtp('');
      setForgotNewPassword('');
      setForgotConfirmPassword('');
      setForgotFlowErrors({});
      setForgotOtpSentSuccess(true);
      setForgotPasswordStep('otp');
      setShowForgotPasswordFlowPopup(true);
    } catch {
      // Error shown via auth slice state
    }
  };

  const handleForgotPasswordFlowClose = () => {
    dispatch(clearError());
    setShowForgotPasswordFlowPopup(false);
    setForgotPasswordStep('otp');
    setForgotOtp('');
    setForgotNewPassword('');
    setForgotConfirmPassword('');
    setForgotFlowErrors({});
    setForgotOtpSentSuccess(false);
  };

  const handleForgotOtpContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(clearError());
    if (!forgotOtp.trim()) {
      setForgotFlowErrors({ otp: FORGOT_PASSWORD.ERRORS.OTP_REQUIRED });
      return;
    }
    setForgotFlowErrors({});
    try {
      await dispatch(
        verifyForgotPasswordOtp({
          departmentCode: loginType === 'employee' ? departmentCode.trim() : '',
          username: username.trim(),
          otp: forgotOtp.trim(),
        })
      ).unwrap();
      setForgotPasswordStep('reset');
    } catch {
      setForgotOtpSentSuccess(false);
    }
  };

  const handleForgotResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(clearError());
    const errors: { newPassword?: string; confirmPassword?: string } = {};
    if (!forgotNewPassword.trim()) {
      errors.newPassword = FORGOT_PASSWORD.ERRORS.NEW_PASSWORD_REQUIRED;
    }
    if (!forgotConfirmPassword.trim()) {
      errors.confirmPassword = FORGOT_PASSWORD.ERRORS.CONFIRM_PASSWORD_REQUIRED;
    } else if (forgotNewPassword !== forgotConfirmPassword) {
      errors.confirmPassword = FORGOT_PASSWORD.ERRORS.PASSWORDS_DO_NOT_MATCH;
    }
    if (Object.keys(errors).length > 0) {
      setForgotFlowErrors(errors);
      return;
    }
    setForgotFlowErrors({});
    try {
      await dispatch(
        resetForgotPassword({
          departmentCode: loginType === 'employee' ? departmentCode.trim() : '',
          username: username.trim(),
          otp: forgotOtp.trim(),
          newPassword: forgotNewPassword,
          isPasswordReset: true,
        })
      ).unwrap();
      handleForgotPasswordFlowClose();
      setResetPasswordSuccessMessage(FORGOT_PASSWORD.SUCCESS_MESSAGE);
    } catch {
      // Error handled via auth slice
    }
  };

  const validateResetPasswordForm = (): boolean => {
    const errors: { newPassword?: string; confirmPassword?: string } = {};
    if (!resetPasswordValue.trim()) {
      errors.newPassword = LOGIN_PASSWORD_RESET.ERRORS.NEW_PASSWORD_REQUIRED;
    }
    if (!resetConfirmPasswordValue.trim()) {
      errors.confirmPassword = LOGIN_PASSWORD_RESET.ERRORS.CONFIRM_PASSWORD_REQUIRED;
    } else if (resetPasswordValue !== resetConfirmPasswordValue) {
      errors.confirmPassword = LOGIN_PASSWORD_RESET.ERRORS.PASSWORDS_DO_NOT_MATCH;
    }
    setResetPasswordErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleResetPasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingResetCredentials) return;
    if (!validateResetPasswordForm()) return;

    try {
      dispatch(clearError());
      await dispatch(
        resetPasswordAfterLogin({
          loginType,
          request: {
            ...pendingResetCredentials,
            newPassword: resetPasswordValue,
            isPasswordReset: true,
          },
        })
      ).unwrap();

      setShowResetPasswordPopup(false);
      setResetPasswordValue('');
      setResetConfirmPasswordValue('');
      setResetPasswordErrors({});
      setPassword('');
      setResetPasswordSuccessMessage('Password reset successful. Please sign in with your new password.');
      setPendingResetCredentials(null);
    } catch {
      // Error handled by auth slice state
    }
  };

  const loginTabs = [
    { id: 'employee', label: 'Employee Login' },
    { id: 'admin', label: 'Admin Login' },
  ];

  return (
    <main className={`login-root ${className}`}>
      <SMSCard elevation={2} sx={{ maxWidth: 400, p: 3 }}>
        <SMSStackColumn gap="lg">
          <SMSTabs
            options={loginTabs}
            value={loginType}
            onChange={(value) => onLoginTypeChange?.(value as 'employee' | 'admin')}
          />

          <SMSStackColumn gap="sm" alignItems="center">
            <img src={smsLogo} alt="Schedule Management System logo" className="login-logo" />
            <SMSTypography variant="h4" component="h1" fontWeight={700} color="text.primary">
              Schedule Management System
            </SMSTypography>
            <SMSTypography variant="body2" color="text.secondary">
              Sign in to your account
            </SMSTypography>
          </SMSStackColumn>

          <form className="login-form" onSubmit={handleSubmit}>
            {loginFormError && (
              <SMSTypography variant="body2" color="error" sx={{ textAlign: 'center', p: 2, mb: 1 }}>
                {loginFormError}
              </SMSTypography>
            )}
            <SMSStackColumn gap="md">
              {resetPasswordSuccessMessage && (
                <div className="login-form__success-alert">
                  <SMSAlert variant="success" message={resetPasswordSuccessMessage} />
                </div>
              )}
              {loginType === 'employee' && (
                <SMSTextField
                  type="text"
                  label={LOGIN.DEPARTMENT_CODE_LABEL}
                  placeholder={LOGIN.DEPARTMENT_CODE_PLACEHOLDER}
                  value={departmentCode}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setDepartmentCode(e.target.value);
                    if (fieldErrors.departmentCode) {
                      setFieldErrors((prev) => ({ ...prev, departmentCode: undefined }));
                    }
                  }}
                  required
                  name="departmentCode"
                  id={`login-department-code-${loginType}`}
                  fullWidth
                  error={Boolean(fieldErrors.departmentCode)}
                  helperText={fieldErrors.departmentCode}
                />
              )}

              <SMSTextField
                type="text"
                label={loginType === 'admin' ? ADMIN_LOGIN.USERNAME_LABEL : LOGIN.EMPLOYEE_NUMBER_LABEL}
                placeholder={loginType === 'admin' ? ADMIN_LOGIN.USERNAME_PLACEHOLDER : LOGIN.EMPLOYEE_NUMBER_PLACEHOLDER}
                value={username}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setUsername(e.target.value);
                  if (fieldErrors.username) {
                    setFieldErrors((prev) => ({ ...prev, username: undefined }));
                  }
                }}
                required
                name="username"
                id={`login-username-${loginType}`}
                fullWidth
                error={Boolean(fieldErrors.username)}
                helperText={fieldErrors.username}
              />

              <SMSTextField
                type="password"
                label={strings.PASSWORD_LABEL}
                placeholder={strings.PASSWORD_PLACEHOLDER}
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) {
                    setFieldErrors((prev) => ({ ...prev, password: undefined }));
                  }
                }}
                required
                name="password"
                id={`login-password-${loginType}`}
                fullWidth
                error={Boolean(fieldErrors.password)}
                helperText={fieldErrors.password}
              />

              <SMSStackRow justifyContent="space-between" alignItems="center">
                <SMSCheckbox
                  id={`login-remember-me-${loginType}`}
                  label="Remember me"
                  checked={rememberMe}
                  onChange={(checked: boolean) => setRememberMe(checked)}
                />
                <SMSButton
                  type="button"
                  variant="text"
                  onClick={handleForgotPasswordClick}
                >
                  Forgot Password?
                </SMSButton>
              </SMSStackRow>

              <SMSButton
                type="submit"
                size="large"
                fullWidth
                disabled={isLoading}
                loading={isLoading}
              >
                {strings.SIGN_IN_BUTTON}
              </SMSButton>
            </SMSStackColumn>
          </form>

                  </SMSStackColumn>
      </SMSCard>

      <SMSModal
        isOpen={showResetPasswordPopup}
        onClose={() => {
          setShowResetPasswordPopup(false);
          setResetPasswordValue('');
          setResetConfirmPasswordValue('');
          setResetPasswordErrors({});
          setPendingResetCredentials(null);
        }}
        title={LOGIN_PASSWORD_RESET.TITLE}
        size="md"
      >
        <form className="login-form" onSubmit={handleResetPasswordSave}>
          <SMSStackColumn gap="md">
            <SMSTypography variant="body2" color="text.secondary">
              {LOGIN_PASSWORD_RESET.SUBTITLE}
            </SMSTypography>

            {error && (
              <SMSTypography variant="body2" color="error">
                {error}
              </SMSTypography>
            )}

            <SMSTextField
              type="password"
              label={LOGIN_PASSWORD_RESET.NEW_PASSWORD_LABEL}
              placeholder={LOGIN_PASSWORD_RESET.NEW_PASSWORD_PLACEHOLDER}
              value={resetPasswordValue}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setResetPasswordValue(e.target.value);
                if (resetPasswordErrors.newPassword) {
                  setResetPasswordErrors((prev) => ({ ...prev, newPassword: undefined }));
                }
              }}
              error={Boolean(resetPasswordErrors.newPassword)}
              helperText={resetPasswordErrors.newPassword}
              required
              name="login-reset-new-password"
              id="login-reset-new-password"
              fullWidth
            />

            <SMSTextField
              type="password"
              label={LOGIN_PASSWORD_RESET.CONFIRM_PASSWORD_LABEL}
              placeholder={LOGIN_PASSWORD_RESET.CONFIRM_PASSWORD_PLACEHOLDER}
              value={resetConfirmPasswordValue}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setResetConfirmPasswordValue(e.target.value);
                if (resetPasswordErrors.confirmPassword) {
                  setResetPasswordErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                }
              }}
              error={Boolean(resetPasswordErrors.confirmPassword)}
              helperText={resetPasswordErrors.confirmPassword}
              required
              name="login-reset-confirm-password"
              id="login-reset-confirm-password"
              fullWidth
            />

            <SMSStackRow justifyContent="flex-end" gap="sm">
              <SMSButton
                type="button"
                onClick={() => {
                  setShowResetPasswordPopup(false);
                  setResetPasswordValue('');
                  setResetConfirmPasswordValue('');
                  setResetPasswordErrors({});
                  setPendingResetCredentials(null);
                }}
                disabled={isLoading}
              >
                {LOGIN_PASSWORD_RESET.CANCEL_BUTTON}
              </SMSButton>
              <SMSButton
                type="submit"
                disabled={isLoading}
                loading={isLoading}
              >
                {LOGIN_PASSWORD_RESET.SAVE_BUTTON}
              </SMSButton>
            </SMSStackRow>
          </SMSStackColumn>
        </form>
      </SMSModal>
      <SMSModal
        isOpen={showForgotPasswordFlowPopup}
        onClose={handleForgotPasswordFlowClose}
        title={FORGOT_PASSWORD.TITLE}
        size="md"
      >
        {forgotPasswordStep === 'otp' ? (
          <form className="login-form" onSubmit={handleForgotOtpContinue}>
            <SMSStackColumn gap="md">
              {forgotPasswordModalError ? (
                <SMSAlert variant="error" title={forgotPasswordModalError} />
              ) : forgotOtpSentSuccess ? (
                <SMSAlert
                  variant="success"
                  title={FORGOT_PASSWORD.OTP_SENT_SUCCESS_TITLE}
                  message={FORGOT_PASSWORD.OTP_SENT_SUCCESS_MESSAGE}
                />
              ) : null}
              <SMSTextField
                type="text"
                label={FORGOT_PASSWORD.OTP_LABEL}
                placeholder={FORGOT_PASSWORD.OTP_PLACEHOLDER}
                value={forgotOtp}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setForgotOtp(e.target.value);
                  if (forgotFlowErrors.otp) {
                    setForgotFlowErrors((prev) => ({ ...prev, otp: undefined }));
                  }
                  if (forgotPasswordModalError) {
                    dispatch(clearError());
                  }
                }}
                error={Boolean(forgotFlowErrors.otp)}
                helperText={forgotFlowErrors.otp}
                required
                fullWidth
              />
              <SMSStackRow justifyContent="flex-end" gap="sm">
                <SMSButton type="button" onClick={handleForgotPasswordFlowClose} disabled={isLoading}>
                  {FORGOT_PASSWORD.CLOSE_BUTTON}
                </SMSButton>
                <SMSButton type="submit" disabled={isLoading} loading={isLoading}>
                  {FORGOT_PASSWORD.CONTINUE_BUTTON}
                </SMSButton>
              </SMSStackRow>
            </SMSStackColumn>
          </form>
        ) : (
          <form className="login-form" onSubmit={handleForgotResetSubmit}>
            <SMSStackColumn gap="md">
              {forgotPasswordModalError && (
                <SMSAlert variant="error" title={forgotPasswordModalError} />
              )}
              <SMSTypography variant="body2" color="text.secondary">
                {FORGOT_PASSWORD.STEP_RESET_SUBTITLE}
              </SMSTypography>
              <SMSTextField
                type="password"
                label={FORGOT_PASSWORD.NEW_PASSWORD_LABEL}
                placeholder={FORGOT_PASSWORD.NEW_PASSWORD_PLACEHOLDER}
                value={forgotNewPassword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setForgotNewPassword(e.target.value);
                  if (forgotFlowErrors.newPassword) {
                    setForgotFlowErrors((prev) => ({ ...prev, newPassword: undefined }));
                  }
                }}
                error={Boolean(forgotFlowErrors.newPassword)}
                helperText={forgotFlowErrors.newPassword}
                required
                fullWidth
              />
              <SMSTextField
                type="password"
                label={FORGOT_PASSWORD.CONFIRM_PASSWORD_LABEL}
                placeholder={FORGOT_PASSWORD.CONFIRM_PASSWORD_PLACEHOLDER}
                value={forgotConfirmPassword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setForgotConfirmPassword(e.target.value);
                  if (forgotFlowErrors.confirmPassword) {
                    setForgotFlowErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                  }
                }}
                error={Boolean(forgotFlowErrors.confirmPassword)}
                helperText={forgotFlowErrors.confirmPassword}
                required
                fullWidth
              />
              <SMSStackRow justifyContent="flex-end" gap="sm">
                <SMSButton
                  type="button"
                  onClick={() => setForgotPasswordStep('otp')}
                  disabled={isLoading}
                >
                  {FORGOT_PASSWORD.BACK_BUTTON}
                </SMSButton>
                <SMSButton type="submit" disabled={isLoading} loading={isLoading}>
                  {FORGOT_PASSWORD.RESET_BUTTON}
                </SMSButton>
              </SMSStackRow>
            </SMSStackColumn>
          </form>
        )}
      </SMSModal>
    </main>
  );
};

