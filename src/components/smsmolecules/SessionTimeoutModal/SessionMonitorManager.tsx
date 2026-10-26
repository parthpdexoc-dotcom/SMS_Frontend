import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { accessTokenRenewed, logout } from '@/store/slices/authSlice';
import { getTokenExpiryTimeMs, isAuthenticated } from '@/utils/token';
import { registerAccessTokenRenewedCallback } from '@/utils/apiClient';
import {
  hadApiActivityInRenewalWindow,
  resetSessionApiActivity,
  SESSION_WARNING_THRESHOLD_SEC,
} from '@/utils/sessionApiActivity';
import { renewTokenSession } from '@/services/authService';
import { SessionTimeoutModal } from './SessionTimeoutModal';

const POLL_INTERVAL_MS = 5000;
const COUNTDOWN_INTERVAL_MS = 1000;

export const SessionMonitorManager: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isAuthenticated: isAuthRedux } = useAppSelector((state) => state.auth);

  const [open, setOpen] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(SESSION_WARNING_THRESHOLD_SEC);
  const [totalSeconds, setTotalSeconds] = useState(SESSION_WARNING_THRESHOLD_SEC);
  const [isRenewing, setIsRenewing] = useState(false);

  const silentRefreshAttemptedRef = useRef(false);
  const popupShownRef = useRef(false);
  const expiryTargetMsRef = useRef<number | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const openRef = useRef(false);

  openRef.current = open;

  const resetSessionMonitorFlags = useCallback(() => {
    silentRefreshAttemptedRef.current = false;
    popupShownRef.current = false;
  }, []);

  const clearPollInterval = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const clearCountdownInterval = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  const clearAllIntervals = useCallback(() => {
    clearPollInterval();
    clearCountdownInterval();
  }, [clearPollInterval, clearCountdownInterval]);

  const getTimeRemainingSeconds = useCallback((): number | null => {
    const expiryMs = getTokenExpiryTimeMs();
    if (!expiryMs) return null;
    return Math.max(0, Math.floor((expiryMs - Date.now()) / 1000));
  }, []);

  const performLogout = useCallback(() => {
    clearAllIntervals();
    resetSessionMonitorFlags();
    resetSessionApiActivity(null);
    expiryTargetMsRef.current = null;
    setOpen(false);
    dispatch(logout());
  }, [clearAllIntervals, dispatch, resetSessionMonitorFlags]);

  const handleTokenRenewed = useCallback(
    (session: { token: string; expiresAt: string | null; tokenType: string }) => {
      resetSessionMonitorFlags();
      expiryTargetMsRef.current = getTokenExpiryTimeMs();
      resetSessionApiActivity(expiryTargetMsRef.current);
      setOpen(false);
      dispatch(accessTokenRenewed(session));
    },
    [dispatch, resetSessionMonitorFlags]
  );

  const attemptSilentRefresh = useCallback(async () => {
    if (silentRefreshAttemptedRef.current) return;

    silentRefreshAttemptedRef.current = true;
    try {
      const renewedSession = await renewTokenSession();
      if (renewedSession) {
        handleTokenRenewed(renewedSession);
        return;
      }
    } catch (error) {
      console.error('Silent token refresh failed:', error);
    }

    const timeRemaining = getTimeRemainingSeconds();
    if (timeRemaining !== null && timeRemaining > 0 && !openRef.current) {
      popupShownRef.current = true;
      setTotalSeconds(Math.min(SESSION_WARNING_THRESHOLD_SEC, timeRemaining));
      setRemainingSeconds(timeRemaining);
      setOpen(true);
    }
  }, [getTimeRemainingSeconds, handleTokenRenewed]);

  const syncExpiryTarget = useCallback(() => {
    const expiryMs = getTokenExpiryTimeMs();
    if (!expiryMs) return null;

    if (expiryTargetMsRef.current !== expiryMs) {
      expiryTargetMsRef.current = expiryMs;
      resetSessionApiActivity(expiryMs);
      resetSessionMonitorFlags();
    }

    return expiryMs;
  }, [resetSessionMonitorFlags]);

  const runSessionCheck = useCallback(async () => {
    if (!isAuthRedux && !isAuthenticated()) return;
    if (openRef.current) return;

    const expiryMs = syncExpiryTarget();
    if (!expiryMs) return;

    const timeRemaining = Math.max(0, Math.floor((expiryMs - Date.now()) / 1000));

    if (timeRemaining <= 0) {
      performLogout();
      return;
    }

    if (timeRemaining > SESSION_WARNING_THRESHOLD_SEC) {
      popupShownRef.current = false;
      return;
    }

    if (hadApiActivityInRenewalWindow() && !silentRefreshAttemptedRef.current) {
      await attemptSilentRefresh();
      return;
    }

    if (!popupShownRef.current) {
      popupShownRef.current = true;
      const warningSeconds = Math.min(SESSION_WARNING_THRESHOLD_SEC, timeRemaining);
      setTotalSeconds(warningSeconds);
      setRemainingSeconds(timeRemaining);
      setOpen(true);
    }
  }, [attemptSilentRefresh, isAuthRedux, performLogout, syncExpiryTarget]);

  useEffect(() => {
    registerAccessTokenRenewedCallback((session) => {
      handleTokenRenewed(session);
    });

    return () => {
      registerAccessTokenRenewedCallback(null);
    };
  }, [handleTokenRenewed]);

  useEffect(() => {
    if (!isAuthRedux && !isAuthenticated()) {
      clearAllIntervals();
      resetSessionMonitorFlags();
      resetSessionApiActivity(null);
      expiryTargetMsRef.current = null;
      setOpen(false);
      return;
    }

    void runSessionCheck();
    pollIntervalRef.current = setInterval(() => {
      void runSessionCheck();
    }, POLL_INTERVAL_MS);

    return () => {
      clearPollInterval();
    };
  }, [clearAllIntervals, clearPollInterval, isAuthRedux, resetSessionMonitorFlags, runSessionCheck]);

  useEffect(() => {
    if (!open) {
      clearCountdownInterval();
      return;
    }

    const tickCountdown = () => {
      const timeRemaining = getTimeRemainingSeconds();
      if (timeRemaining === null) return;

      setRemainingSeconds(timeRemaining);

      if (timeRemaining <= 0) {
        performLogout();
      }
    };

    tickCountdown();
    countdownIntervalRef.current = setInterval(tickCountdown, COUNTDOWN_INTERVAL_MS);

    return () => {
      clearCountdownInterval();
    };
  }, [clearCountdownInterval, getTimeRemainingSeconds, open, performLogout]);

  useEffect(() => {
    return () => {
      clearAllIntervals();
      resetSessionMonitorFlags();
      resetSessionApiActivity(null);
      expiryTargetMsRef.current = null;
    };
  }, [clearAllIntervals, resetSessionMonitorFlags]);

  const handleStaySignedIn = async () => {
    try {
      setIsRenewing(true);
      const renewedSession = await renewTokenSession();
      if (renewedSession) {
        handleTokenRenewed(renewedSession);
      } else {
        performLogout();
      }
    } catch (error) {
      console.error('Failed to renew session token:', error);
      performLogout();
    } finally {
      setIsRenewing(false);
    }
  };

  const handleSignOut = () => {
    performLogout();
  };

  if (!isAuthRedux && !isAuthenticated()) {
    return null;
  }

  return (
    <SessionTimeoutModal
      open={open}
      onStaySignedIn={handleStaySignedIn}
      onSignOut={handleSignOut}
      remainingSeconds={remainingSeconds}
      totalSeconds={totalSeconds}
      isLoading={isRenewing}
    />
  );
};

export default SessionMonitorManager;
