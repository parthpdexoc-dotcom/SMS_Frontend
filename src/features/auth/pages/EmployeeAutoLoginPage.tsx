import React, { useEffect } from 'react';
import { SMSBox, SMSLoader, SMSTypography } from '@/components/smsatoms';
import {
  clearAuthToken,
  getAuthToken,
  setImpersonationMode,
} from '@/services/authService';
import { decodeToken } from '@/utils/jwtDecoder';
import { buildAvailableJobsLandingPathWithQuery } from '@/constants/availableJobsRouteTabs';

const redirectToLogin = () => {
  const basePath = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
  window.location.replace(`${window.location.origin}${basePath || ''}`);
};

export const EmployeeAutoLoginPage: React.FC = () => {
  useEffect(() => {
    // Token was seeded into this tab's sessionStorage by the opener (no JWT in URL).
    const token = getAuthToken();

    if (!token || !token.trim() || !decodeToken(token)) {
      clearAuthToken();
      setImpersonationMode(false);
      redirectToLogin();
      return;
    }

    setImpersonationMode(true);

    const basePath = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
    window.location.replace(`${window.location.origin}${basePath}${buildAvailableJobsLandingPathWithQuery()}`);
  }, []);

  return (
    <SMSBox sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', gap: 1 }}>
      <SMSLoader />
      <SMSTypography variant="body2">Signing you in...</SMSTypography>
    </SMSBox>
  );
};
