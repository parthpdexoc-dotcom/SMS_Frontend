import type {
  ForgotPasswordRequest,
  LoginRequest,
  LoginPasswordResetRequest,
} from '@/services/authService';

const textPlainJson = (data: unknown, status = 200): Response => {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'text/plain',
    },
  });
};


const parseJsonBody = <T>(body: BodyInit | null | undefined): T => {
  if (!body) return {} as T;
  if (typeof body === 'string') return JSON.parse(body) as T;
  // apiClient always passes stringified JSON; keep this minimal.
  return JSON.parse(String(body)) as T;
};

const stripQuery = (endpoint: string) => endpoint.split('?')[0];


/**
 * Temporary mock API router.
 *
 * Returns a Response shaped like the backend (text/plain with JSON inside)
 * so existing service parsing logic keeps working.
 */
export const tryHandleStaticApiRequest = async (
  endpoint: string,
  options: RequestInit
): Promise<Response | null> => {
  const method = (options.method || 'GET').toUpperCase();
  const path = stripQuery(endpoint);

  // Auth
  if (path === '/Employee/login' && method === 'POST') {
    const req = parseJsonBody<LoginRequest>(options.body);
    const needsReset = req.username?.toLowerCase().includes('reset');

    // In static mode, use username containing "reset" to simulate forced reset flow.
    if (needsReset) {
      return textPlainJson({
        isPasswordReset: true,
        token: '',
        expiresAt: '',
        tokenType: 'Bearer',
      });
    }

    return textPlainJson({ token: 'static-dev-token', expiresAt: '', tokenType: 'Bearer' });
  }

  if (path === '/Employee/forgot-password/send-otp' && method === 'POST') {
    const req = parseJsonBody<ForgotPasswordRequest>(options.body);
    const hasForgotPasswordIdentity = Boolean(req.username && req.departmentCode);
    return textPlainJson({
      message: hasForgotPasswordIdentity
        ? 'Static mode: OTP sent'
        : 'Static mode: invalid forgot-password payload',
    });
  }

  if (path === '/Employee/forgot-password/verify-otp' && method === 'POST') {
    const req = parseJsonBody<ForgotPasswordRequest>(options.body);
    const hasForgotPasswordIdentity = Boolean(req.username && req.departmentCode);
    return textPlainJson({
      message: hasForgotPasswordIdentity && req.otp
        ? 'Static mode: OTP verified'
        : 'Static mode: invalid OTP verification payload',
    });
  }

  if (path === '/Employee/forgot-password/reset' && method === 'POST') {
    const req = parseJsonBody<ForgotPasswordRequest & Partial<LoginPasswordResetRequest>>(options.body);
    const hasForgotPasswordPayload = Boolean(req.username && req.departmentCode && req.otp && req.newPassword);
    const hasForcedResetPayload = Boolean(req.username && req.password && req.newPassword);

    return textPlainJson({
      message: hasForgotPasswordPayload || hasForcedResetPayload
        ? 'Static mode: password reset simulated'
        : 'Static mode: invalid reset payload',
      success: true,
    });
  }

  if (path === '/Admin/login' && method === 'POST') {
    const req = parseJsonBody<LoginRequest>(options.body);
    const needsReset = req.username?.toLowerCase().includes('reset');

    if (needsReset) {
      return textPlainJson({
        isPasswordReset: true,
        token: '',
        expiresAt: '',
        tokenType: 'Bearer',
      });
    }

    return textPlainJson({ token: 'static-dev-token-admin', expiresAt: '', tokenType: 'Bearer' });
  }

  return null;
};
