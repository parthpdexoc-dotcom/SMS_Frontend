import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { SMSAvailablePostList, SMSWaitingListTabs } from '@/components/smsorganisms';
import { SMSScheduledPostList, SMSJobReadyToCloseList, SMSMyHistoryList } from '@/components/smsmolecules';
import { AVAILABLE_POST } from '@/constants/strings';
import {
  AVAILABLE_JOBS_ROUTE_TAB_ID,
  LEGACY_AVAILABLE_JOBS_TAB_REDIRECTS,
  isAvailableJobsRouteTabId,
  normalizeAvailableJobsTabSegment,
  type AvailableJobsRouteTabId,
} from '@/constants/availableJobsRouteTabs';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { resetAvailableJobEntry } from '@/store/slices/availablePostSlice';
import { isSuspendedEmployeeActive } from '@/utils';
import './EmployeeDashboard.css';
import type { SMSTabOption } from '@/components/smsatoms/SMSTabs';
import { SMSTabs } from '@/components/smsatoms/SMSTabs';

const BASE_TAB_ITEMS: SMSTabOption[] = [
  { id: AVAILABLE_JOBS_ROUTE_TAB_ID.AVAILABLE_JOB, label: AVAILABLE_POST.TABS.AVAILABLE_POST, icon: 'briefcase' },
  { id: AVAILABLE_JOBS_ROUTE_TAB_ID.SCHEDULED_JOB, label: AVAILABLE_POST.TABS.SCHEDULED_POST, icon: 'schedule' },
  { id: AVAILABLE_JOBS_ROUTE_TAB_ID.JOB_READY_TO_CLOSE, label: AVAILABLE_POST.TABS.CLOSE_POST, icon: 'check_circle' },
  { id: AVAILABLE_JOBS_ROUTE_TAB_ID.MY_HISTORY, label: AVAILABLE_POST.TABS.MY_HISTORY, icon: 'history' },
  { id: AVAILABLE_JOBS_ROUTE_TAB_ID.WAITING_LIST, label: AVAILABLE_POST.TABS.WAITING_LIST, icon: 'list' },
];

export const EmployeeDashboard: React.FC = () => {
  const { tab: tabFromPath } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { hasOutstandingReadyToClosePost } = useAppSelector((state) => state.availablePost);
  const prevTabRef = useRef<AvailableJobsRouteTabId | null>(null);
  const skipLayoutResetRef = useRef(false);
  const [availableJobMountKey, setAvailableJobMountKey] = useState(0);
  const isSuspendedActive = isSuspendedEmployeeActive(user);
  const fallbackTab: AvailableJobsRouteTabId = isSuspendedActive
    ? AVAILABLE_JOBS_ROUTE_TAB_ID.SCHEDULED_JOB
    : AVAILABLE_JOBS_ROUTE_TAB_ID.AVAILABLE_JOB;
  const normalizedTabFromPath = normalizeAvailableJobsTabSegment(tabFromPath);
  const activeTab: AvailableJobsRouteTabId = isAvailableJobsRouteTabId(normalizedTabFromPath)
    ? normalizedTabFromPath
    : fallbackTab;

  const resetAvailableJobState = useCallback(() => {
    dispatch(resetAvailableJobEntry());
    setAvailableJobMountKey((key) => key + 1);
  }, [dispatch]);

  const handleTabChange = useCallback(
    (tabId: string) => {
      if (tabId === AVAILABLE_JOBS_ROUTE_TAB_ID.AVAILABLE_JOB) {
        skipLayoutResetRef.current = true;
        resetAvailableJobState();
        navigate({ pathname: `/available-jobs/${tabId}`, search: '' }, { replace: true });
        return;
      }
      navigate(`/available-jobs/${tabId}`, { replace: true });
    },
    [resetAvailableJobState, navigate]
  );

  const visibleTabs = useMemo<SMSTabOption[]>(() => {
    const items = isSuspendedActive
      ? BASE_TAB_ITEMS.filter((tab) => tab.id !== AVAILABLE_JOBS_ROUTE_TAB_ID.AVAILABLE_JOB)
      : BASE_TAB_ITEMS;

    if (!hasOutstandingReadyToClosePost) return items;

    return items.map((tab) =>
      tab.id === AVAILABLE_JOBS_ROUTE_TAB_ID.JOB_READY_TO_CLOSE
        ? { ...tab, badge: true }
        : tab
    );
  }, [isSuspendedActive, hasOutstandingReadyToClosePost]);

  const tabContent = useMemo(() => {
    switch (activeTab) {
      case AVAILABLE_JOBS_ROUTE_TAB_ID.AVAILABLE_JOB:
        return <SMSAvailablePostList key={availableJobMountKey} />;
      case AVAILABLE_JOBS_ROUTE_TAB_ID.SCHEDULED_JOB:
        return <SMSScheduledPostList />;
      case AVAILABLE_JOBS_ROUTE_TAB_ID.JOB_READY_TO_CLOSE:
        return <SMSJobReadyToCloseList />;
      case AVAILABLE_JOBS_ROUTE_TAB_ID.MY_HISTORY:
        return <SMSMyHistoryList />;
      case AVAILABLE_JOBS_ROUTE_TAB_ID.WAITING_LIST:
        return <SMSWaitingListTabs />;
      default:
        return <SMSAvailablePostList />;
    }
  }, [activeTab, availableJobMountKey]);

  // Reset when switching into Available Job from another dashboard tab.
  // Skip on first mount/refresh so URL filters (e.g. Cancelled Jobs) are preserved.
  useLayoutEffect(() => {
    const prevTab = prevTabRef.current;
    prevTabRef.current = activeTab;

    if (
      activeTab !== AVAILABLE_JOBS_ROUTE_TAB_ID.AVAILABLE_JOB ||
      prevTab === null ||
      prevTab === AVAILABLE_JOBS_ROUTE_TAB_ID.AVAILABLE_JOB
    ) {
      return;
    }

    if (skipLayoutResetRef.current) {
      skipLayoutResetRef.current = false;
      return;
    }

    resetAvailableJobState();
    if (location.search) {
      navigate({ pathname: location.pathname, search: '' }, { replace: true });
    }
  }, [activeTab, resetAvailableJobState, location.pathname, location.search, navigate]);

  // Clear filters when leaving Open Jobs so left-menu return starts fresh.
  useEffect(() => {
    return () => {
      dispatch(resetAvailableJobEntry());
    };
  }, [dispatch]);

  useEffect(() => {
    if (tabFromPath && Object.prototype.hasOwnProperty.call(LEGACY_AVAILABLE_JOBS_TAB_REDIRECTS, tabFromPath)) {
      const canonical = LEGACY_AVAILABLE_JOBS_TAB_REDIRECTS[tabFromPath];
      navigate(`/available-jobs/${canonical}`, { replace: true });
      return;
    }
    if (isSuspendedActive && activeTab === AVAILABLE_JOBS_ROUTE_TAB_ID.AVAILABLE_JOB) {
      navigate(`/available-jobs/${AVAILABLE_JOBS_ROUTE_TAB_ID.SCHEDULED_JOB}`, { replace: true });
      return;
    }
    if (tabFromPath && !isAvailableJobsRouteTabId(normalizedTabFromPath)) {
      navigate(`/available-jobs/${fallbackTab}`, { replace: true });
    }
  }, [activeTab, tabFromPath, normalizedTabFromPath, navigate, isSuspendedActive, fallbackTab]);

  return (
    <div className="employee-dashboard">
      <div className="employee-dashboard__tabs-container">
        <SMSTabs
          options={visibleTabs}
          value={activeTab}
          onChange={handleTabChange}
        />
      </div>
      <div className="employee-dashboard__tab-content">{tabContent}</div>
    </div>
  );
};
