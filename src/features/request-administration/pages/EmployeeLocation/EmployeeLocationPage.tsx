import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Skeleton } from '@mui/material';
import { useParams, useSearchParams } from 'react-router-dom';
import { SMSBox, SMSIcon, SMSIconButton, SMSTextField } from '@/components/smsatoms';
import { cn } from '@/utils';
import { DAILY_WORKSPACE, EMPLOYEE_LOCATION, OPEN_JOBS_PAGE } from '@/constants/strings';
import { useDebounce } from '@/hooks/useDebounceSearch';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  clearEmployeePostLocations,
  clearEmployeeTrack,
  clearPostEmployees,
  fetchEmployeeCoordinates,
  fetchPostEmployeesWithLocations,
  fetchRequesterEmployeeLocations,
} from '@/store/slices/employeePostLocationSlice';
import { formatTimeToHHmm } from '@/utils/dateTimeUtils';
import { formatRequestDateDisplay } from '../RequesterList/requestCardHelpers';
import { WorkspaceRequestCard } from '../DailyWorkspace/components';
import '../DailyWorkspace/DailyWorkspacePage.css';
import { EmployeeLocationMap } from './EmployeeLocationMap';
import {
  beginPoll,
  LOCATION_EMPTY,
  filterLocationRequests,
  isPostExpanded,
  isSameSeat,
  locationCounts,
  overlayPostEmployees,
  toRequestCardDto,
  withMoving,
  type LocationEmployee,
  type LocationRequestGroup,
} from './locationRoster';
import './EmployeeLocationPage.css';

const C = EMPLOYEE_LOCATION;
const DW = DAILY_WORKSPACE;

function clock(value: string): string {
  return formatTimeToHHmm(value) || value || LOCATION_EMPTY;
}

function postTimeLabel(startTime: string, endTime: string): string {
  return `${clock(startTime)} – ${clock(endTime)}`;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <SMSBox className="employee-location__empty">{children}</SMSBox>;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="daily-workspace__stat">
      <span className="daily-workspace__stat-label">{label}</span>
      <span className="daily-workspace__stat-value">{value}</span>
    </div>
  );
}

function TreeCard({
  selected,
  title,
  meta,
  onClick,
}: {
  selected: boolean;
  title: string;
  meta: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn('dw-post-tree__card', selected && 'is-selected')}
      onClick={onClick}
    >
      <span className="dw-post-tree__card-title">{title}</span>
      <span className="dw-post-tree__card-meta">{meta}</span>
    </button>
  );
}

export const EmployeeLocationPage: React.FC = () => {
  const { requesterId = '' } = useParams<{ requesterId: string }>();
  const [searchParams] = useSearchParams();
  const dispatch = useAppDispatch();
  const {
    requests,
    movingByEmployeeId,
    postEmployees,
    loadedPostId,
    isLoading,
    isPostLoading,
    error,
  } = useAppSelector((state) => state.employeePostLocation);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [postsOpen, setPostsOpen] = useState(false);
  const [openPostIds, setOpenPostIds] = useState<string[]>([]);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [highlightedEmployeeId, setHighlightedEmployeeId] = useState<string | null>(null);
  const [highlightedPostPositionId, setHighlightedPostPositionId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const requesterName = searchParams.get('requesterName')?.trim() || C.LIST_TITLE;
  const showOverview = !selectedRequestId;
  const query = useDebounce(search, 300).trim().toLowerCase();

  const treeRequests = useMemo(
    () => overlayPostEmployees(requests, activePostId, loadedPostId, postEmployees),
    [requests, activePostId, loadedPostId, postEmployees]
  );

  const filteredRequests = useMemo(
    () => filterLocationRequests(treeRequests, query),
    [treeRequests, query]
  );

  useEffect(() => {
    if (!requesterId) return;
    dispatch(fetchRequesterEmployeeLocations({ requesterId }));
    const stop = beginPoll(() => {
      dispatch(fetchRequesterEmployeeLocations({ requesterId, force: true }));
    });
    return () => {
      stop();
      dispatch(clearEmployeePostLocations());
    };
  }, [dispatch, requesterId]);

  useEffect(() => {
    if (!activePostId) return;
    return beginPoll(() => {
      dispatch(
        fetchPostEmployeesWithLocations({
          postId: activePostId,
          requestId: selectedRequestId ?? '',
          force: true,
        })
      );
    });
  }, [dispatch, activePostId, selectedRequestId]);

  useEffect(() => {
    if (!highlightedEmployeeId || !highlightedPostPositionId) return;
    const args = {
      employeeId: highlightedEmployeeId,
      postPositionId: highlightedPostPositionId,
    };
    dispatch(fetchEmployeeCoordinates(args));
    return beginPoll(() => {
      dispatch(fetchEmployeeCoordinates({ ...args, force: true }));
    });
  }, [dispatch, highlightedEmployeeId, highlightedPostPositionId]);

  const selectedRequest = useMemo(
    () => treeRequests.find((request) => request.requestId === selectedRequestId) ?? null,
    [treeRequests, selectedRequestId]
  );

  const activePost = selectedRequest?.posts.find((p) => p.postId === activePostId);
  const activeEmployees = postEmployees.length > 0 ? postEmployees : activePost?.employees ?? [];

  const mapEmployees = useMemo(
    () =>
      withMoving(
        activePostId
          ? activeEmployees
          : selectedRequest?.posts.flatMap((post) => post.employees) ?? [],
        movingByEmployeeId
      ),
    [activePostId, activeEmployees, selectedRequest, movingByEmployeeId]
  );

  const drillRequests = query ? filteredRequests : selectedRequest ? [selectedRequest] : [];

  const highlightedEmployee = useMemo(
    () => mapEmployees.find((employee) => employee.employeeId === highlightedEmployeeId) ?? null,
    [mapEmployees, highlightedEmployeeId]
  );

  const summary = useMemo(() => locationCounts(requests), [requests]);

  const clearEmployeeHighlight = useCallback(() => {
    setHighlightedEmployeeId(null);
    setHighlightedPostPositionId(null);
    dispatch(clearEmployeeTrack());
  }, [dispatch]);

  const loadPost = useCallback(
    (postId: string, requestId: string) => {
      dispatch(fetchPostEmployeesWithLocations({ postId, requestId }));
    },
    [dispatch]
  );

  const focusPost = useCallback(
    (postId: string, requestId: string) => {
      setSelectedRequestId(requestId);
      setPostsOpen(true);
      setOpenPostIds([postId]);
      setActivePostId(postId);
      clearEmployeeHighlight();
      loadPost(postId, requestId);
    },
    [clearEmployeeHighlight, loadPost]
  );

  const selectEmployee = useCallback(
    (employee: LocationEmployee | null) => {
      if (
        !employee ||
        isSameSeat(employee, highlightedEmployeeId, highlightedPostPositionId)
      ) {
        clearEmployeeHighlight();
        return;
      }
      setSelectedRequestId(employee.requestId);
      setPostsOpen(true);
      setOpenPostIds([employee.postId]);
      setActivePostId(employee.postId);
      loadPost(employee.postId, employee.requestId);
      setHighlightedEmployeeId(employee.employeeId);
      setHighlightedPostPositionId(employee.postPositionId);
    },
    [
      clearEmployeeHighlight,
      highlightedEmployeeId,
      highlightedPostPositionId,
      loadPost,
    ]
  );

  const resetDrill = useCallback(() => {
    setPostsOpen(false);
    setOpenPostIds([]);
    setActivePostId(null);
    clearEmployeeHighlight();
    dispatch(clearPostEmployees());
  }, [clearEmployeeHighlight, dispatch]);

  const clearRequestView = useCallback(
    (requestId: string | null = null) => {
      setSelectedRequestId(requestId);
      resetDrill();
    },
    [resetDrill]
  );

  const handleRequestClick = useCallback(
    (requestId: string) => {
      if (requestId !== selectedRequestId) {
        setSelectedRequestId(requestId);
        setPostsOpen(true);
        setOpenPostIds([]);
        setActivePostId(null);
        clearEmployeeHighlight();
        dispatch(clearPostEmployees());
        return;
      }
      if (query) return;
      if (postsOpen) {
        setActivePostId(null);
        setOpenPostIds([]);
        clearEmployeeHighlight();
        dispatch(clearPostEmployees());
      }
      setPostsOpen((open) => !open);
    },
    [clearEmployeeHighlight, dispatch, postsOpen, query, selectedRequestId]
  );

  const togglePost = useCallback(
    (postId: string, requestId: string) => {
      if (requestId !== selectedRequestId) {
        focusPost(postId, requestId);
        return;
      }
      if (openPostIds.includes(postId)) {
        setOpenPostIds([]);
        setActivePostId(null);
        clearEmployeeHighlight();
        dispatch(clearPostEmployees());
        return;
      }
      focusPost(postId, requestId);
    },
    [clearEmployeeHighlight, dispatch, focusPost, openPostIds, selectedRequestId]
  );

  const mapHint = highlightedEmployee
    ? highlightedEmployee.name
    : activePostId
      ? C.SELECT_POST_HINT
      : C.SELECT_EMPLOYEE_HINT;

  useEffect(() => {
    if (!postsOpen && openPostIds.length === 0 && !highlightedEmployeeId) return;

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      // Ignore clicks on interactive components or inside the map shell (the map handles its own canvas clicks)
      if (
        target.closest('.dw-post-tree__card') ||
        target.closest('.employee-location__employee') ||
        target.closest('.employee-location__pin') ||
        target.closest('.employee-location__map-shell') ||
        target.closest('.maplibregl-ctrl') ||
        target.closest('.maplibregl-ctrl-group') ||
        target.closest('.employee-location__back') ||
        target.closest('.employee-location__collapse') ||
        target.closest('.daily-workspace__panel-search') ||
        target.closest('input') ||
        target.closest('button')
      ) {
        return;
      }

      const scrollable = target.closest('.employee-location__left-body');
      if (scrollable) {
        const rect = scrollable.getBoundingClientRect();
        if (event.clientX >= rect.left + scrollable.clientWidth) {
          return;
        }
      }

      resetDrill();
    };

    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [postsOpen, openPostIds.length, highlightedEmployeeId, resetDrill]);

  let leftBody: React.ReactNode;
  if (isLoading && requests.length === 0) {
    leftBody = Array.from({ length: 3 }).map((_, i) => (
      <Skeleton key={`el-req-${i}`} variant="rounded" height={88} sx={{ mb: 1 }} />
    ));
  } else if (error && requests.length === 0) {
    leftBody = <Empty>{error}</Empty>;
  } else if (requests.length === 0) {
    leftBody = <Empty>{DW.NO_REQUESTS}</Empty>;
  } else if (showOverview) {
    leftBody =
      filteredRequests.length === 0 ? (
        <Empty>{C.NO_PEOPLE_FILTERED}</Empty>
      ) : (
        <>
          <div className="daily-workspace__request-list-header" aria-hidden="true">
            <span>{DW.REQUEST_LIST_COLUMNS.PROJECT}</span>
            <span>{DW.REQUEST_LIST_COLUMNS.REQUEST}</span>
            <span>{DW.REQUEST_LIST_COLUMNS.DATES}</span>
            <span>{DW.REQUEST_LIST_COLUMNS.STATUS}</span>
            <span>{DW.REQUEST_LIST_COLUMNS.POSTS}</span>
            <span>{DW.REQUEST_LIST_COLUMNS.SCHEDULE}</span>
          </div>
          <SMSBox className="daily-workspace__request-list-scroll">
            <SMSBox className="daily-workspace__card-list">
              {filteredRequests.map((request) => (
                <WorkspaceRequestCard
                  key={request.requestId}
                  request={toRequestCardDto(request)}
                  selected={false}
                  layout="list"
                  onSelect={() => clearRequestView(request.requestId)}
                />
              ))}
            </SMSBox>
          </SMSBox>
        </>
      );
  } else if (drillRequests.length > 0) {
    leftBody = (
      <RequestDrill
        requests={drillRequests}
        query={query}
        selectedRequestId={selectedRequestId}
        postsOpen={postsOpen}
        openPostIds={openPostIds}
        selectedEmployeeId={highlightedEmployeeId}
        selectedPostPositionId={highlightedPostPositionId}
        onSelectRequest={handleRequestClick}
        onTogglePost={togglePost}
        onSelectEmployee={selectEmployee}
      />
    );
  } else if (query) {
    leftBody = <Empty>{C.NO_PEOPLE_FILTERED}</Empty>;
  } else {
    leftBody = null;
  }

  return (
    <SMSBox component="main" className="daily-workspace employee-location">
      <SMSBox className="daily-workspace__top">
        <SMSBox className="daily-workspace__summary">
          <SMSBox className="daily-workspace__title-row">
            {!showOverview ? (
              <SMSIconButton
                type="button"
                onClick={() => clearRequestView()}
                className="employee-location__back"
                aria-label={C.BACK_TO_REQUESTS}
                title={C.BACK_TO_REQUESTS}
              >
                <SMSIcon name="arrowLeft" size="md" />
              </SMSIconButton>
            ) : null}
            <h1 className="daily-workspace__title">{requesterName}</h1>
          </SMSBox>
          <SMSBox className="daily-workspace__summary-aside">
            <SMSBox className="daily-workspace__counts" aria-label={C.LIST_TITLE}>
              <Stat label={DW.REQUESTS_PANEL} value={summary.requests} />
              {!showOverview ? (
                <>
                  <Stat label={DW.POSTS_PANEL} value={summary.posts} />
                  <Stat label={C.EMPLOYEES_LABEL} value={summary.employees} />
                </>
              ) : null}
            </SMSBox>
          </SMSBox>
        </SMSBox>
      </SMSBox>

      <SMSBox className={`employee-location__layout${showOverview ? ' employee-location__layout--overview' : ''}`}>
        <aside className="employee-location__left">
          <SMSBox className="employee-location__left-header">
            <h2>
              <span>{DW.REQUESTS_PANEL}</span>
              <span className="employee-location__count">
                {showOverview || query ? filteredRequests.length : requests.length}
              </span>
            </h2>
            {!showOverview && (postsOpen || openPostIds.length > 0) ? (
              <button type="button" className="employee-location__collapse" onClick={resetDrill}>
                {OPEN_JOBS_PAGE.COLLAPSE_ALL}
              </button>
            ) : null}
          </SMSBox>

          {requests.length > 0 ? (
            <SMSBox className="daily-workspace__panel-search">
              <SMSTextField
                id="el-search"
                placeholder={C.SEARCH_PEOPLE_PLACEHOLDER}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                fullWidth
                size="small"
              />
            </SMSBox>
          ) : null}

          <SMSBox
            className={`employee-location__left-body${
              showOverview
                ? ' employee-location__requests-overview daily-workspace__body--stage-requests daily-workspace__body--requests-list'
                : ''
            }`}
          >
            {leftBody}
          </SMSBox>
        </aside>

        {!showOverview ? (
          <section className="employee-location__right">
            <SMSBox className="employee-location__right-header">
              <SMSBox className="employee-location__right-heading">
                <h2>{C.MAP_PANEL}</h2>
                <p>{mapHint}</p>
              </SMSBox>
              <SMSIconButton
                type="button"
                onClick={() => clearRequestView()}
                aria-label={C.CLOSE_MAP}
                title={C.CLOSE_MAP}
              >
                <SMSIcon name="close" size="sm" />
              </SMSIconButton>
            </SMSBox>
            <SMSBox className="employee-location__map-body">
              <EmployeeLocationMap
                employees={mapEmployees}
                selectedEmployeeId={highlightedEmployeeId}
                requestId={selectedRequestId}
                activePostId={activePostId}
                loading={activePostId ? isPostLoading : isLoading}
                onSelectEmployee={selectEmployee}
                onClearSelection={resetDrill}
              />
            </SMSBox>
          </section>
        ) : null}
      </SMSBox>
    </SMSBox>
  );
};

const RequestDrill = memo(function RequestDrill({
  requests,
  query,
  selectedRequestId,
  postsOpen,
  openPostIds,
  selectedEmployeeId,
  selectedPostPositionId,
  onSelectRequest,
  onTogglePost,
  onSelectEmployee,
}: {
  requests: LocationRequestGroup[];
  query: string;
  selectedRequestId: string | null;
  postsOpen: boolean;
  openPostIds: string[];
  selectedEmployeeId: string | null;
  selectedPostPositionId: string | null;
  onSelectRequest: (requestId: string) => void;
  onTogglePost: (postId: string, requestId: string) => void;
  onSelectEmployee: (employee: LocationEmployee | null) => void;
}) {
  if (requests.length === 0) return <Empty>{C.NO_PEOPLE_FILTERED}</Empty>;

  return (
    <SMSBox className="dw-post-tree">
      {requests.map((request) => {
        const requestSelected = request.requestId === selectedRequestId;
        const showPosts = !!query || (requestSelected && postsOpen);
        return (
          <ul key={request.requestId} className="dw-post-tree">
            <li className="dw-post-tree__node">
              <TreeCard
                selected={requestSelected && postsOpen}
                title={request.requestName}
                meta={`${formatRequestDateDisplay(request.startDate)} – ${formatRequestDateDisplay(request.endDate)} · ${
                  request.releaseStatus || LOCATION_EMPTY
                } · ${DW.POSTS_COUNT.replace('{count}', String(request.postCount ?? request.posts.length))}`}
                onClick={() => onSelectRequest(request.requestId)}
              />

              {showPosts && request.posts.length === 0 ? (
                <Empty>{query ? C.NO_PEOPLE_FILTERED : DW.NO_POSTS}</Empty>
              ) : null}

              {showPosts && request.posts.length > 0 ? (
                <ul className="dw-post-tree__children dw-post-tree__children--step">
                  {request.posts.map((post, index) => {
                    const postOpen = isPostExpanded(post, query, openPostIds);
                    const last = index === request.posts.length - 1;
                    return (
                      <li
                        key={post.postId}
                        className={cn('dw-post-tree__node', last && 'is-last')}
                      >
                        <TreeCard
                          selected={postOpen}
                          title={post.postTitle}
                          meta={`${postTimeLabel(post.postStartTime, post.postEndTime)} · ${DW.POSITIONS_COUNT.replace(
                            '{count}',
                            String(post.employees.length)
                          )}`}
                          onClick={() => onTogglePost(post.postId, request.requestId)}
                        />
                        {postOpen ? (
                          post.employees.length === 0 ? (
                            <Empty>{C.NO_EMPLOYEES}</Empty>
                          ) : (
                            <ul className="dw-post-tree__children dw-post-tree__children--step">
                              {post.employees.map((employee, employeeIndex) => {
                                const selected = isSameSeat(
                                  employee,
                                  selectedEmployeeId,
                                  selectedPostPositionId
                                );
                                const lastEmployee = employeeIndex === post.employees.length - 1;
                                return (
                                  <li
                                    key={employee.key}
                                    className={cn(
                                      'dw-post-tree__node employee-location__tree-person',
                                      lastEmployee && 'is-last'
                                    )}
                                  >
                                    <button
                                      type="button"
                                      ref={(el) => {
                                        if (selected && el) {
                                          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                        }
                                      }}
                                      className={cn('employee-location__employee', selected && 'is-selected')}
                                      onClick={() => onSelectEmployee(selected ? null : employee)}
                                    >
                                      <span className="employee-location__employee-avatar" aria-hidden="true">
                                        {(employee.name.trim()[0] || '?').toUpperCase()}
                                      </span>
                                      <span className="employee-location__employee-text">
                                        <strong>{employee.name}</strong>
                                        {employee.callSign && employee.callSign !== LOCATION_EMPTY ? (
                                          <span>{employee.callSign}</span>
                                        ) : null}
                                      </span>
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          )
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          </ul>
        );
      })}
    </SMSBox>
  );
});
