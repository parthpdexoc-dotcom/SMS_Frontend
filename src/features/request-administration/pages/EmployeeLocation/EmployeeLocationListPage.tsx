import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Skeleton } from '@mui/material';
import { SMSBox, SMSButton, SMSTextField, SMSIcon } from '@/components/smsatoms';
import { DAILY_WORKSPACE, EMPLOYEE_LOCATION } from '@/constants/strings';
import { useDebounce } from '@/hooks/useDebounceSearch';
import { useInfiniteScrollInContainer } from '@/hooks/useInfiniteScrollInContainer';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  dailyWorkspaceListFilterKey,
  fetchDailyWorkspaceRequesters,
  fetchMoreDailyWorkspaceRequesters,
} from '@/store/slices/dailyWorkspaceSlice';
import { openAuthenticatedPath } from '@/utils/token';
import '../DailyWorkspace/DailyWorkspaceListPage.css';

function openLocationQuery(requesterName?: string): string {
  const name = requesterName?.trim();
  if (!name) return '';
  return `?${new URLSearchParams({ requesterName: name }).toString()}`;
}

export const EmployeeLocationListPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { requesters, totalRecords, hasMore, isLoading, isLoadingMore, error } = useAppSelector(
    (state) => state.dailyWorkspace
  );

  const [searchRequester, setSearchRequester] = React.useState('');
  const debouncedSearch = useDebounce(searchRequester, 500);

  const filters = useMemo(
    () => ({
      requesterName: debouncedSearch.trim() || null,
      requestStatuses: [] as const,
      requestTypes: [] as const,
      isShiftStartingWithin30Minutes: true,
    }),
    [debouncedSearch]
  );

  const listFilterKey = useMemo(() => dailyWorkspaceListFilterKey(filters), [filters]);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  useEffect(() => {
    dispatch(fetchDailyWorkspaceRequesters(filtersRef.current));
  }, [dispatch, listFilterKey]);

  const loadMoreRequesters = useCallback(() => {
    dispatch(fetchMoreDailyWorkspaceRequesters(filters));
  }, [dispatch, filters]);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

  useInfiniteScrollInContainer(scrollContainerRef, loadMoreSentinelRef, {
    hasMore,
    isLoading,
    isLoadingMore,
    onLoadMore: loadMoreRequesters,
    itemCount: requesters.length,
  });

  const openLocationInNewTab = useCallback((requesterId: string, requesterName?: string) => {
    openAuthenticatedPath(`/personnel/employee-location/${requesterId}${openLocationQuery(requesterName)}`);
  }, []);

  return (
    <SMSBox className="daily-workspace-list">
      <SMSBox className="daily-workspace-list__header">
        <SMSBox>
          <h1 className="daily-workspace-list__title">{EMPLOYEE_LOCATION.LIST_TITLE}</h1>
          <div className="daily-workspace-list__subtitle-stack">
            <p className="daily-workspace-list__subtitle daily-workspace-list__subtitle--emphasis">
              {EMPLOYEE_LOCATION.LIST_SUBTITLE_HIGHLIGHT}
            </p>
            <p className="daily-workspace-list__subtitle daily-workspace-list__subtitle--nowrap">
              {EMPLOYEE_LOCATION.LIST_SUBTITLE}
            </p>
          </div>
        </SMSBox>
        {isLoading ? (
          <Skeleton width={140} height={28} />
        ) : (
          <span className="daily-workspace-list__total">
            <span>{DAILY_WORKSPACE.TOTAL_REQUESTERS_LABEL}</span>
            <strong>{totalRecords}</strong>
          </span>
        )}
      </SMSBox>

      <SMSBox className="daily-workspace-list__filters">
        <SMSBox className="daily-workspace-list__filter-row">
          <SMSBox className="filter-group">
            <SMSTextField
              label={DAILY_WORKSPACE.FILTERS.SEARCH_LABEL}
              id="employee-location-search"
              placeholder={DAILY_WORKSPACE.FILTERS.SEARCH_PLACEHOLDER}
              value={searchRequester}
              onChange={(e) => setSearchRequester(e.target.value)}
              fullWidth
            />
          </SMSBox>
        </SMSBox>
      </SMSBox>

      {error && <SMSBox className="daily-workspace-list__error">{error}</SMSBox>}

      <div
        ref={scrollContainerRef}
        className="daily-workspace-list__scroll"
        aria-label={EMPLOYEE_LOCATION.LIST_TITLE}
      >
        {isLoading ? (
          Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton key={`el-skel-${idx}`} variant="rounded" height={72} />
          ))
        ) : requesters.length === 0 ? (
          <SMSBox className="daily-workspace-list__empty">{DAILY_WORKSPACE.EMPTY}</SMSBox>
        ) : (
          requesters.map((row) => {
            const projectHints = (row.projectNumbers || []).slice(0, 3);
            return (
              <div key={row.requesterId} className="daily-workspace-list__row">
                <SMSBox className="daily-workspace-list__row-main">
                  <h2 className="daily-workspace-list__row-name">{row.requesterName}</h2>
                  <SMSBox className="daily-workspace-list__row-meta">
                    <span className="daily-workspace-list__badge">
                      {DAILY_WORKSPACE.ACTIVE_REQUESTS.replace('{count}', String(row.requestCount ?? 0))}
                    </span>
                    {projectHints.map((project) => (
                      <span
                        key={project}
                        className="daily-workspace-list__badge daily-workspace-list__badge--muted"
                      >
                        {DAILY_WORKSPACE.PROJECT_LABEL} {project}
                      </span>
                    ))}
                  </SMSBox>
                </SMSBox>
                <SMSButton
                  className="daily-workspace-list__open-btn"
                  variant="contained"
                  size="small"
                  allowWhenSuspended
                  title={EMPLOYEE_LOCATION.OPEN_HINT}
                  endIcon={<SMSIcon name="open_in_new" size="sm" />}
                  onClick={() => openLocationInNewTab(row.requesterId, row.requesterName)}
                >
                  {EMPLOYEE_LOCATION.OPEN}
                </SMSButton>
              </div>
            );
          })
        )}
        {!isLoading && requesters.length > 0 && hasMore && (
          <div
            ref={loadMoreSentinelRef}
            className="daily-workspace-list__load-more-sentinel"
            role="status"
            aria-live="polite"
            aria-busy={isLoadingMore}
          >
            {isLoadingMore && (
              <SMSBox className="daily-workspace-list__load-more-skeleton-rows">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <Skeleton key={`el-loading-more-${idx}`} variant="rounded" height={72} />
                ))}
              </SMSBox>
            )}
          </div>
        )}
      </div>
    </SMSBox>
  );
};
