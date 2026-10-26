import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchMasterMap } from '@/store/slices/masterMapSlice';

const DEFAULT_POLL_INTERVAL_MS = 15_000;

/**
 * Poller for the Master Map.
 * Active only while mounted on the Master Map screen (`MasterMapPage`) and
 * "Enable Employee Location" is enabled in Department Configuration (`enableEmployeeLocation === true`).
 */
export function useMasterMapPoller(intervalMs = DEFAULT_POLL_INTERVAL_MS): void {
  const dispatch = useAppDispatch();
  const isFetchingRef = useRef(false);

  const { isAuthenticated, user } = useAppSelector((state) => state.auth);
  const departmentId = user?.departmentID ?? '';
  const departmentConfig = useAppSelector((state) =>
    departmentId ? state.departmentConfiguration.configByDepartmentId[departmentId] : null
  );

  const isEnabled = isAuthenticated && departmentConfig?.enableEmployeeLocation === true;

  useEffect(() => {
    if (!isEnabled) {
      return;
    }

    const doFetch = async (force: boolean) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      try {
        await dispatch(fetchMasterMap(force)).unwrap();
      } catch {
        // Silent catch for background polling
      } finally {
        isFetchingRef.current = false;
      }
    };

    // Initial fetch when authenticated and "Enable Employee Location" is enabled
    void doFetch(false);

    // Continuous polling while on Master Map screen
    const timer = window.setInterval(() => {
      void doFetch(true);
    }, intervalMs);

    // Immediately refresh when user returns to tab / focuses window
    const handleFocus = () => {
      void doFetch(true);
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', handleFocus);
    };
  }, [dispatch, isEnabled, intervalMs]);
}
