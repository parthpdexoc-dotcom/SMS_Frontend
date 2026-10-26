import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Skeleton } from '@mui/material';
import { SMSBox, SMSButton, SMSDatePicker, SMSTextField, SMSIcon } from '@/components/smsatoms';
import { DAILY_WORKSPACE } from '@/constants/strings';
import { useDebounce } from '@/hooks/useDebounceSearch';
import { useInfiniteScrollInContainer } from '@/hooks/useInfiniteScrollInContainer';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  dailyWorkspaceListFilterKey,
  fetchDailyWorkspaceRequesters,
  fetchMoreDailyWorkspaceRequesters,
} from '@/store/slices/dailyWorkspaceSlice';
import { openAuthenticatedPath } from '@/utils/token';
import { WorkspaceFilterChips } from './components';
import { useDailyWorkspaceFilters } from './DailyWorkspaceFiltersContext';
import './DailyWorkspaceListPage.css';

function formatActiveRequestsLabel(count: number): string {
  return DAILY_WORKSPACE.ACTIVE_REQUESTS.replace('{count}', String(count));
}

export const DailyWorkspaceListPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { requesters, totalRecords, hasMore, isLoading, isLoadingMore, error } = useAppSelector(
    (state) => state.dailyWorkspace
  );
  const {
    startDate,
    endDate,
    requestStatuses,
    requestTypes,
    setStartDate,
    setEndDate,
    toggleStatus,
    toggleType,
    clearFiltersToDefaults,
    buildOpenWorkspaceQueryString,
  } = useDailyWorkspaceFilters();

  const [searchRequester, setSearchRequester] = React.useState('');
  const debouncedSearch = useDebounce(searchRequester, 500);

  const filters = useMemo(
    () => ({
      startDate: startDate.trim() || null,
      endDate: endDate.trim() || null,
      requestStatuses,
      requestTypes,
      requesterName: debouncedSearch.trim() || null,
    }),
    [startDate, endDate, requestStatuses, requestTypes, debouncedSearch]
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

  const handleClear = useCallback(() => {
    setSearchRequester('');
    clearFiltersToDefaults();
  }, [clearFiltersToDefaults]);

  const openWorkspaceInNewTab = useCallback(
    (requesterId: string, requesterName?: string) => {
      const query = buildOpenWorkspaceQueryString(requesterName);
      openAuthenticatedPath(`/personnel/daily-workspace/${requesterId}${query}`);
    },
    [buildOpenWorkspaceQueryString]
  );

  return (
    <SMSBox className="daily-workspace-list">
      <SMSBox className="daily-workspace-list__header">
        <SMSBox>
          <h1 className="daily-workspace-list__title">{DAILY_WORKSPACE.LIST_TITLE}</h1>
          <p className="daily-workspace-list__subtitle">{DAILY_WORKSPACE.LIST_SUBTITLE}</p>
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
              id="daily-workspace-search"
              placeholder={DAILY_WORKSPACE.FILTERS.SEARCH_PLACEHOLDER}
              value={searchRequester}
              onChange={(e) => setSearchRequester(e.target.value)}
              fullWidth
            />
          </SMSBox>
          <SMSBox className="filter-group">
            <SMSDatePicker
              label={DAILY_WORKSPACE.FILTERS.START_DATE}
              id="daily-workspace-start"
              value={startDate}
              onChange={setStartDate}
            />
          </SMSBox>
          <SMSBox className="filter-group">
            <SMSDatePicker
              label={DAILY_WORKSPACE.FILTERS.END_DATE}
              id="daily-workspace-end"
              value={endDate}
              onChange={setEndDate}
            />
          </SMSBox>
          <SMSBox className="daily-workspace-list__filter-actions">
            <SMSButton allowWhenSuspended onClick={handleClear}>
              {DAILY_WORKSPACE.FILTERS.CLEAR}
            </SMSButton>
          </SMSBox>
        </SMSBox>

        <WorkspaceFilterChips
          variant="list"
          layout="stacked"
          requestStatuses={requestStatuses}
          requestTypes={requestTypes}
          onToggleStatus={toggleStatus}
          onToggleType={toggleType}
        />
      </SMSBox>

      {error && <SMSBox className="daily-workspace-list__error">{error}</SMSBox>}

      <div
        ref={scrollContainerRef}
        className="daily-workspace-list__scroll"
        aria-label={DAILY_WORKSPACE.LIST_TITLE}
      >
        {isLoading ? (
          Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton key={`dw-skel-${idx}`} variant="rounded" height={72} />
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
                      {formatActiveRequestsLabel(row.requestCount ?? 0)}
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
                  title={DAILY_WORKSPACE.OPEN_WORKSPACE_HINT}
                  endIcon={<SMSIcon name="open_in_new" size="sm" />}
                  onClick={() => openWorkspaceInNewTab(row.requesterId, row.requesterName)}
                >
                  {DAILY_WORKSPACE.OPEN_WORKSPACE}
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
                  <Skeleton key={`dw-loading-more-${idx}`} variant="rounded" height={72} />
                ))}
              </SMSBox>
            )}
          </div>
        )}
      </div>
    </SMSBox>
  );
};
