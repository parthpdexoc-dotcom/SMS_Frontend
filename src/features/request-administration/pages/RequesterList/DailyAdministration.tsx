import React from 'react';
import { Badge, Menu, MenuItem, Popover, Skeleton } from '@mui/material';
import {
  SMSButton,
  SMSTextField,
  SMSDatePicker,
  SMSDollar,
  SMSIcon,
  SMSIconButton,
  SMSBox,
  SMSGrid,
  SMSPagination,
  SMSChip,
} from '@/components/smsatoms';
import {
  SMSConfirmDialog,
  SMSMultiDateCalendar,
  type SMSMultiDateCalendarLabels,
} from '@/components/smsmolecules';
import { RequestResponse, RequestStatus, RequestTypes } from '@/types/request';
import { RequesterResponse } from '@/types/requester';
import { Post } from '@/types/post';
import { PostPositionResponse } from '@/types/postPosition';
import { formatTimeToHHmm, getPostEndTime } from '@/utils';
import { DAILY_ADMINISTRATION, INVOICE_GRID, PAGINATION, REQUESTER_GRID_MENU } from '@/constants/strings';
import { TABLE_PAGE_SIZE_OPTIONS } from '@/constants/tablePagination';
import { getRequestProjectNumber } from '@/utils/requestInvoiceUtils';
import {
  formatRequestDateDisplay,
  getReleaseAsLabel,
  getReleaseStatusLabel,
  RequestTypeDisplay,
} from './requestCardHelpers';
import {
  getSelectedDatesForPost,
  postPositionFilterCacheKey,
} from '@/utils/postPositionDateTree';
import { DEFAULT_REQUESTER_WITH_REQUEST_TYPES } from '@/services/requesterService';

/**
 * Release-status filter chips shown on the Daily Administration filter bar.
 * Order matches the backend `RequestStatus` enum so newly added statuses extend predictably.
 */
const DAILY_STATUS_FILTER_OPTIONS: ReadonlyArray<{
  value: RequestStatus;
  label: string;
}> = [
  { value: RequestStatus.Pending, label: DAILY_ADMINISTRATION.STATUS_FILTER.OPTIONS.PENDING },
  { value: RequestStatus.ReleaseNow, label: DAILY_ADMINISTRATION.STATUS_FILTER.OPTIONS.RELEASE_NOW },
  { value: RequestStatus.ReleasedOn, label: DAILY_ADMINISTRATION.STATUS_FILTER.OPTIONS.RELEASED_ON },
  { value: RequestStatus.Cancelled, label: DAILY_ADMINISTRATION.STATUS_FILTER.OPTIONS.CANCELLED },
  { value: RequestStatus.Completed, label: DAILY_ADMINISTRATION.STATUS_FILTER.OPTIONS.COMPLETED },
];

/** Default type chip selection — mirrors `DEFAULT_REQUESTER_WITH_REQUEST_TYPES` in the service. */
const DAILY_DEFAULT_REQUEST_TYPE_FILTER: ReadonlyArray<RequestTypes> = [...DEFAULT_REQUESTER_WITH_REQUEST_TYPES];

const DAILY_REQUEST_TYPE_FILTER_OPTIONS: ReadonlyArray<{
  value: RequestTypes;
  label: string;
}> = [
  { value: RequestTypes.OneTime, label: DAILY_ADMINISTRATION.REQUEST_TYPE_FILTER.OPTIONS.ONE_TIME },
  { value: RequestTypes.Daily, label: DAILY_ADMINISTRATION.REQUEST_TYPE_FILTER.OPTIONS.DAILY },
  { value: RequestTypes.Weekly, label: DAILY_ADMINISTRATION.REQUEST_TYPE_FILTER.OPTIONS.WEEKLY },
  { value: RequestTypes.Monthly, label: DAILY_ADMINISTRATION.REQUEST_TYPE_FILTER.OPTIONS.MONTHLY },
  { value: RequestTypes.Custom, label: DAILY_ADMINISTRATION.REQUEST_TYPE_FILTER.OPTIONS.CUSTOM },
];

/** Default chip selection — mirrors `DEFAULT_REQUESTER_WITH_REQUESTS_STATUSES` in the service. */
const DAILY_DEFAULT_STATUS_FILTER: ReadonlyArray<RequestStatus> = [
  RequestStatus.Pending,
  RequestStatus.ReleaseNow,
  RequestStatus.ReleasedOn,
];

const POSITION_DATE_CALENDAR_LABELS: SMSMultiDateCalendarLabels = {
  title: DAILY_ADMINISTRATION.POSITION_DATES.TITLE,
  close: DAILY_ADMINISTRATION.POSITION_DATES.CLOSE,
  yearLabel: DAILY_ADMINISTRATION.POSITION_DATES.YEAR_LABEL,
  monthsLabel: DAILY_ADMINISTRATION.POSITION_DATES.MONTHS_LABEL,
  selectYear: DAILY_ADMINISTRATION.POSITION_DATES.SELECT_YEAR,
  selectMonth: DAILY_ADMINISTRATION.POSITION_DATES.SELECT_MONTH,
  clear: DAILY_ADMINISTRATION.POSITION_DATES.CLEAR,
  prevMonth: DAILY_ADMINISTRATION.POSITION_DATES.PREV_MONTH,
  nextMonth: DAILY_ADMINISTRATION.POSITION_DATES.NEXT_MONTH,
  noDates: DAILY_ADMINISTRATION.POSITION_DATES.NO_DATES,
  daysSelected: DAILY_ADMINISTRATION.POSITION_DATES.DAYS_SELECTED,
  daysSelectedRange: DAILY_ADMINISTRATION.POSITION_DATES.DAYS_SELECTED_RANGE,
  weekdays: DAILY_ADMINISTRATION.POSITION_DATES.WEEKDAYS,
};

export interface DailyAdministrationProps {
  viewOnlyRequesters: boolean;
  dailySearchRequester: string;
  setDailySearchRequester: (v: string) => void;
  dailyStartDate: string;
  setDailyStartDate: (v: string) => void;
  dailyEndDate: string;
  setDailyEndDate: (v: string) => void;
  resetDailyDates: () => void;
  /** Selected release-status filters (POST body `requestStatuses`). */
  dailyRequestStatuses: ReadonlyArray<RequestStatus>;
  setDailyRequestStatuses: (next: RequestStatus[]) => void;
  /** Selected request-type filters (POST body `requestTypes`) — backend `RequestTypes` enum. */
  dailyRequestTypes: ReadonlyArray<RequestTypes>;
  setDailyRequestTypes: (next: RequestTypes[]) => void;
  dailyLoading: boolean;
  dailyLoadingMore: boolean;
  dailyHasMore: boolean;
  /** Total requesters matching the API filter (`PagedList.totalRecords`). */
  dailyTotalRequesters: number;
  onLoadMoreRequesters: () => void;
  groupedByRequester: Record<
    string,
    { requester: RequesterResponse | null; requests: RequestResponse[]; hasUnpaidInvoice?: boolean }
  >;
  expandedRequesters: string[];
  toggleRequesterExpand: (id: string) => void;
  postsByRequest: Record<string, Post[]>;
  expandedRequests: string[];
  toggleRequestExpand: (id: string) => void;
  getPostsPagination: (requestID: string) => { page: number; pageSize: number; totalPages: number; totalRecords: number };
  setPostsPagination: (requestID: string, values: Partial<{ page: number; pageSize: number; totalRecords: number }>) => void;
  loadPostsAndPositionsForRequest: (requestID: string, opts?: { page?: number; pageSize?: number }) => Promise<void>;
  pageSizeMenuAnchor: { el: HTMLElement; requestID: string } | null;
  setPageSizeMenuAnchor: (v: { el: HTMLElement; requestID: string } | null) => void;
  expandedPosts: Set<string>;
  togglePostExpand: (postId: string) => void;
  loadPostEmployeesAndExpand: (postId: string) => Promise<void>;
  postCollectDatesByPost: Record<string, string[]>;
  loadingPostCollectDatesByPost: Record<string, boolean>;
  ensurePostCollectDates: (postId: string) => void;
  expandedPostDays: Set<string>;
  selectPostFilterDates: (postId: string, dates: string[]) => void;
  togglePostFilterDate: (postId: string, date: string) => void;
  refreshPostPositions: (
    postId: string,
    selectedDates: string[],
    requestID: string,
    pagination?: { page: number; pageSize: number },
    meta?: { refreshPostCounts?: boolean; includeDate?: string }
  ) => Promise<void>;
  postPositionsByPostAndDate: Record<string, PostPositionResponse[]>;
  filledPositionsByPostAndDate: Record<string, number>;
  loadingPostPositionsByPost: Record<string, boolean>;
  setDeletingPost: (post: Post | null) => void;
  setDeletingRequest: (req: RequestResponse | null) => void;
  setDeletingItem: (item: RequesterResponse | null) => void;
  handleCollapseAll: () => void;
  requesterListReturnPath: string;
  activeTab: string;
  handleViewProfile: (requester: RequesterResponse) => void;
  handleEdit: (requester: RequesterResponse) => void;
  handleCreateRequest: (requester: RequesterResponse) => void;
  handleRequesterInvoice: (requester: RequesterResponse, requests: RequestResponse[]) => void;
  onRequesterPayment: (requester: RequesterResponse) => void;
  handleCloneRequest: (req: RequestResponse) => void;
  handleEditRequest: (requestID: string) => void;
  handleCreatePost: (requestID: string) => void;
  handleEditPost: (post: Post) => void;
  handleClonePost: (post: Post) => void;
  setInvoicePreviewRequest: (r: RequestResponse | null) => void;
  setInvoicePreviewOpen: (open: boolean) => void;
  onScheduleClick: (request: RequestResponse, e: React.MouseEvent) => void;
  onProjectNumberClick: (
    request: RequestResponse,
    requester: RequesterResponse,
    e: React.MouseEvent
  ) => void;
  onCreateRequestInvoice: (request: RequestResponse) => void;
  navigate: (path: string, opts?: { state?: object }) => void;
  getPostIndentByLevel: (level?: string) => number;
  renderRequestActionMenu: (request: RequestResponse) => React.ReactNode;
  renderPostActionMenu: (post: Post, request: RequestResponse) => React.ReactNode;
  renderPostEmployeesSlider: (
    postId: string,
    post: Post,
    request: RequestResponse,
    selectedDates: string[],
    positions: PostPositionResponse[],
    totalRecords: number,
    onPositionUnassigned?: (
      pagination?: { page: number; pageSize: number },
      meta?: { refreshPostCounts?: boolean; includeDate?: string }
    ) => void | Promise<void>,
    sliderKey?: string,
    /** Soft reload — keep headers mounted; body/pagination show loading. */
    isLoading?: boolean
  ) => React.ReactNode;
}

const ONE_TIME_REQUEST_TYPE = 1;

function isOneTimeRequest(request: RequestResponse): boolean {
  return Number(request.requestType?.requestType ?? ONE_TIME_REQUEST_TYPE) === ONE_TIME_REQUEST_TYPE;
}

function toNonNegativeCount(value: number | null | undefined): number {
  const count = Number(value ?? 0);
  return Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
}

function getAssignmentProgressCounts(post: Post) {
  const total = toNonNegativeCount(post.totalPostPositions);
  const assigned = toNonNegativeCount(post.assignedPostPositionCount);
  const cancelled = toNonNegativeCount(post.cancelledPostPositionCount);
  const open = Math.max(total - assigned, 0);

  return {
    open,
    assigned,
    cancelled,
    total,
  };
}

function AssignmentProgressIndicator({ post }: { post: Post }) {
  const counts = getAssignmentProgressCounts(post);
  const summary = `Total-${counts.total} / Available-${counts.open} / Assigned-${counts.assigned} / Cancelled-${counts.cancelled}`;

  return (
    <SMSBox
      aria-label={`Total / Available / Assigned / Cancelled: ${summary}`}
      title={`Total / Available / Assigned / Cancelled: ${summary}`}
      sx={{ width: '100%' }}
    >
      <SMSBox
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: '0.25rem 0.35rem',
          width: '100%',
          minWidth: 0,
        }}
      >
        <SMSChip
          size="small"
          label={`Total-${counts.total}`}
          variant="outlined"
          clickable={false}
          title="Total Post Positions"
          sx={{
            justifyContent: 'center',
            width: '100%',
            height: '20px',
            borderColor: '#cbd5e1',
            color: '#334155',
            backgroundColor: '#f1f5f9',
            fontSize: '0.62rem',
            fontWeight: 700,
          }}
        />
        <SMSChip
          size="small"
          label={`Available-${counts.open}`}
          variant="outlined"
          clickable={false}
          title="Available includes status: Open."
          sx={{
            justifyContent: 'center',
            width: '100%',
            height: '20px',
            borderColor: '#93c5fd',
            color: '#1e40af',
            backgroundColor: '#dbeafe',
            fontSize: '0.62rem',
            fontWeight: 700,
          }}
        />
        <SMSChip
          size="small"
          label={`Assigned-${counts.assigned}`}
          variant="outlined"
          clickable={false}
          title="Assigned includes status: Assigned and CancellationPending."
          sx={{
            justifyContent: 'center',
            width: '100%',
            height: '20px',
            borderColor: '#6ee7b7',
            color: '#047857',
            backgroundColor: '#d1fae5',
            fontSize: '0.62rem',
            fontWeight: 700,
          }}
        />
        <SMSChip
          size="small"
          label={`Cancelled-${counts.cancelled}`}
          variant="outlined"
          clickable={false}
          title="Cancelled includes status: Cancelled."
          sx={{
            justifyContent: 'center',
            width: '100%',
            height: '20px',
            borderColor: '#fca5a5',
            color: '#b91c1c',
            backgroundColor: '#fee2e2',
            fontSize: '0.62rem',
            fontWeight: 700,
          }}
        />
      </SMSBox>
    </SMSBox>
  );
}

export const DailyAdministration: React.FC<DailyAdministrationProps> = (props) => {
  const {
    viewOnlyRequesters,
    dailySearchRequester,
    setDailySearchRequester,
    dailyStartDate,
    setDailyStartDate,
    dailyEndDate,
    setDailyEndDate,
    resetDailyDates,
    dailyRequestStatuses,
    setDailyRequestStatuses,
    dailyRequestTypes,
    setDailyRequestTypes,
    dailyLoading,
    dailyLoadingMore,
    dailyHasMore,
    dailyTotalRequesters,
    onLoadMoreRequesters,
    groupedByRequester,
    expandedRequesters,
    toggleRequesterExpand,
    postsByRequest,
    expandedRequests,
    toggleRequestExpand,
    getPostsPagination,
    setPostsPagination,
    loadPostsAndPositionsForRequest,
    pageSizeMenuAnchor,
    setPageSizeMenuAnchor,
    expandedPosts,
    togglePostExpand,
    loadPostEmployeesAndExpand,
    postCollectDatesByPost,
    loadingPostCollectDatesByPost,
    ensurePostCollectDates,
    expandedPostDays,
    selectPostFilterDates,
    togglePostFilterDate,
    refreshPostPositions,
    postPositionsByPostAndDate,
    filledPositionsByPostAndDate,
    loadingPostPositionsByPost,
    setDeletingPost,
    setDeletingRequest,
    setDeletingItem,
    handleCollapseAll,
    requesterListReturnPath,
    activeTab,
    handleViewProfile,
    handleEdit,
    handleCreateRequest,
    handleRequesterInvoice,
    onRequesterPayment,
    handleCloneRequest,
    handleEditRequest,
    handleEditPost,
    handleClonePost,
    onScheduleClick,
    onProjectNumberClick,
    onCreateRequestInvoice,
    navigate,
    getPostIndentByLevel,
    renderRequestActionMenu,
    renderPostActionMenu,
    renderPostEmployeesSlider,
  } = props;

  const [pendingCloneRequest, setPendingCloneRequest] = React.useState<RequestResponse | null>(null);
  const [pendingClonePost, setPendingClonePost] = React.useState<Post | null>(null);
  const [postDatesCalendarAnchor, setPostDatesCalendarAnchor] = React.useState<{
    el: HTMLElement;
    postId: string;
  } | null>(null);

  const isPostDatesCalendarOpen = Boolean(
    postDatesCalendarAnchor &&
      expandedPosts.has(postDatesCalendarAnchor.postId) &&
      postDatesCalendarAnchor.el.isConnected
  );

  React.useEffect(() => {
    if (postDatesCalendarAnchor && !isPostDatesCalendarOpen) {
      setPostDatesCalendarAnchor(null);
    }
  }, [postDatesCalendarAnchor, isPostDatesCalendarOpen]);

  /**
   * Infinite scroll for the requester list — replaces the legacy "Load More Requesters" button.
   * The sentinel is rendered at the bottom of the visible list (only when more pages exist and we're not
   * currently loading); when it scrolls into view we trigger {@link onLoadMoreRequesters}. The effect
   * intentionally early-returns while a fetch is in flight (so it disconnects mid-load and reattaches
   * once `dailyLoadingMore` flips back to false) to avoid duplicate page requests.
   */
  const loadMoreSentinelRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel) return;
    if (!dailyHasMore || dailyLoading || dailyLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMoreRequesters();
        }
      },
      { root: null, rootMargin: '120px 0px', threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [dailyHasMore, dailyLoading, dailyLoadingMore, onLoadMoreRequesters]);

  const handleCloneConfirm = React.useCallback(() => {
    if (pendingClonePost) {
      handleClonePost(pendingClonePost);
    } else if (pendingCloneRequest) {
      handleCloneRequest(pendingCloneRequest);
    }
    setPendingClonePost(null);
    setPendingCloneRequest(null);
  }, [pendingClonePost, pendingCloneRequest, handleClonePost, handleCloneRequest]);

  const handleCloneCancel = React.useCallback(() => {
    setPendingClonePost(null);
    setPendingCloneRequest(null);
  }, []);

  const selectedStatusSet = React.useMemo(
    () => new Set<RequestStatus>(dailyRequestStatuses),
    [dailyRequestStatuses]
  );

  const toggleRequestStatus = React.useCallback(
    (status: RequestStatus) => {
      const next = selectedStatusSet.has(status)
        ? dailyRequestStatuses.filter((s) => s !== status)
        : [...dailyRequestStatuses, status];
      setDailyRequestStatuses(next as RequestStatus[]);
    },
    [dailyRequestStatuses, selectedStatusSet, setDailyRequestStatuses]
  );

  const selectedRequestTypeSet = React.useMemo(
    () => new Set<RequestTypes>(dailyRequestTypes),
    [dailyRequestTypes]
  );

  const toggleRequestType = React.useCallback(
    (rt: RequestTypes) => {
      const next = selectedRequestTypeSet.has(rt)
        ? dailyRequestTypes.filter((t) => t !== rt)
        : [...dailyRequestTypes, rt];
      setDailyRequestTypes(next as RequestTypes[]);
    },
    [dailyRequestTypes, selectedRequestTypeSet, setDailyRequestTypes]
  );

  const renderRequesterSkeleton = React.useCallback(
    (keyPrefix: string) => (
      <SMSBox key={keyPrefix} className="hierarchical-requester-group">
        <SMSBox className="level-1-requester" data-expanded={false}>
          <SMSBox className="level-1-requester__header">
            <SMSBox className="level-1-requester__info" sx={{ width: '100%' }}>
              <Skeleton variant="circular" width={24} height={24} />
              <SMSBox className="level-1-requester__title-block" sx={{ width: '100%' }}>
                <Skeleton variant="text" width="32%" height={30} />
                <Skeleton variant="rounded" width={160} height={24} />
              </SMSBox>
            </SMSBox>
          </SMSBox>
          <SMSBox className="level-2-requests" sx={{ mt: 1 }}>
            <SMSBox className="level-2-request">
              <SMSBox className="level-2-request__header">
                <SMSBox className="level-2-request__info" sx={{ width: '100%' }}>
                  <Skeleton variant="circular" width={22} height={22} />
                  <SMSBox className="level-2-request__data" sx={{ width: '100%' }}>
                    {[0, 1, 2, 3, 4, 5, 6].map((idx) => (
                      <SMSBox key={`${keyPrefix}-request-skeleton-${idx}`} className="level-2-request__data-item">
                        <Skeleton variant="text" width="70%" height={16} />
                        <Skeleton variant="text" width="90%" height={24} />
                      </SMSBox>
                    ))}
                  </SMSBox>
                </SMSBox>
              </SMSBox>
            </SMSBox>
          </SMSBox>
        </SMSBox>
      </SMSBox>
    ),
    []
  );

  return (
    <SMSBox className="requester-list__content">
      <SMSBox className="requester-list__header">
        <h2 className="requester-list__section-title">{DAILY_ADMINISTRATION.SECTION_TITLE}</h2>
        {!viewOnlyRequesters && (
          <SMSButton
            leftIcon={<SMSIcon name="add" size="sm" />}
            onClick={() => navigate('/personnel/request/add', { state: { returnPath: requesterListReturnPath, tab: activeTab } })}
          >
            Add Request
          </SMSButton>
        )}
      </SMSBox>

      <SMSBox className="daily-admin-container">
        <SMSBox className="daily-admin-filters">
          <SMSBox className="daily-admin-filters__groups">
            <SMSBox className="filter-group">
              <SMSTextField
              label="Search Requester"
                id="search-requester"
                placeholder="Type requester name..."
                value={dailySearchRequester}
                onChange={(e) => setDailySearchRequester(e.target.value)}
                fullWidth
              />
            </SMSBox>
            <SMSBox className="filter-group">
              <SMSDatePicker label="Start Date" id="start-date" value={dailyStartDate} onChange={setDailyStartDate} />
            </SMSBox>
            <SMSBox className="filter-group">
              <SMSDatePicker label="End Date" id="end-date" value={dailyEndDate} onChange={setDailyEndDate} />
            </SMSBox>
          </SMSBox>
          <SMSBox className="daily-admin-filters__actions">
            <SMSButton
              allowWhenSuspended
              onClick={() => {
                setDailySearchRequester('');
                resetDailyDates();
                setDailyRequestStatuses([...DAILY_DEFAULT_STATUS_FILTER]);
                setDailyRequestTypes([...DAILY_DEFAULT_REQUEST_TYPE_FILTER]);
              }}
            >
              Clear
            </SMSButton>
            <SMSBox sx={{ flex: 1, minWidth: 0 }} />
            {dailyLoading ? (
              <Skeleton variant="text" width={140} height={24} className="daily-admin-total-requesters__skeleton" />
            ) : (
              <span className="daily-admin-total-requesters" aria-live="polite">
                <span className="daily-admin-total-requesters__label">{DAILY_ADMINISTRATION.TOTAL_REQUESTERS_LABEL}</span>
                <strong className="daily-admin-total-requesters__value">{dailyTotalRequesters}</strong>
              </span>
            )}
            <SMSButton variant="outlined" allowWhenSuspended onClick={handleCollapseAll} leftIcon={<SMSIcon name="unfold_less" size="sm" />}>
              Collapse All
            </SMSButton>
          </SMSBox>
        </SMSBox>

        <SMSBox className="daily-admin-filter-strip">
          <SMSBox className="daily-admin-filter-panel daily-admin-filter-panel--request-type">
            <SMSBox
              className="daily-admin-status-filter__group"
              role="group"
              aria-label={DAILY_ADMINISTRATION.REQUEST_TYPE_FILTER.GROUP_ARIA_LABEL}
            >
              <span className="daily-admin-status-filter__label">
                {DAILY_ADMINISTRATION.REQUEST_TYPE_FILTER.GROUP_LABEL}
              </span>
              <SMSBox className="daily-admin-status-filter__chips">
                {DAILY_REQUEST_TYPE_FILTER_OPTIONS.map(({ value, label }) => {
                  const active = selectedRequestTypeSet.has(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      className="daily-admin-status-filter__chip"
                      data-active={active}
                      aria-pressed={active}
                      onClick={() => toggleRequestType(value)}
                    >
                      {label}
                    </button>
                  );
                })}
              </SMSBox>
            </SMSBox>
          </SMSBox>

          <SMSBox className="daily-admin-filter-panel daily-admin-filter-panel--status">
            <SMSBox
              className="daily-admin-status-filter__group"
              role="group"
              aria-label={DAILY_ADMINISTRATION.STATUS_FILTER.GROUP_ARIA_LABEL}
            >
              <span className="daily-admin-status-filter__label">
                {DAILY_ADMINISTRATION.STATUS_FILTER.GROUP_LABEL}
              </span>
              <SMSBox className="daily-admin-status-filter__chips">
                {DAILY_STATUS_FILTER_OPTIONS.map(({ value, label }) => {
                  const active = selectedStatusSet.has(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      className="daily-admin-status-filter__chip"
                      data-active={active}
                      aria-pressed={active}
                      onClick={() => toggleRequestStatus(value)}
                    >
                      {label}
                    </button>
                  );
                })}
              </SMSBox>
            </SMSBox>
          </SMSBox>
        </SMSBox>

        <SMSBox className="hierarchical-view">
          {dailyLoading ? (
            <SMSBox>
              {Array.from({ length: 3 }).map((_, idx) => renderRequesterSkeleton(`daily-loading-${idx}`))}
            </SMSBox>
          ) : (
            Object.entries(groupedByRequester).map(([requesterID, { requester, requests, hasUnpaidInvoice }]) => {
              const isRequesterExpanded = expandedRequesters.includes(requesterID);
              const activeRequestsCount = requests.length;
              return (
                <SMSBox key={requesterID} className="hierarchical-requester-group">
                  <SMSBox className="level-1-requester" data-expanded={isRequesterExpanded}>
                    <SMSBox className="level-1-requester__header">
                      <SMSBox className="level-1-requester__info">
                        <SMSIconButton
                          className="level-1-requester__expand-btn"
                          tone="success"
                          allowWhenSuspended
                          onClick={() => toggleRequesterExpand(requesterID)}
                          size="small"
                          aria-label={isRequesterExpanded ? 'Collapse requester' : 'Expand requester'}
                          title={isRequesterExpanded ? 'Collapse' : 'Expand'}
                        >
                          <SMSIcon name={isRequesterExpanded ? 'expand_more' : 'navigate_next'} size="sm" />
                        </SMSIconButton>
                        <SMSBox className="level-1-requester__title-block">
                          <h3 className="level-1-requester__name">{requester?.name || `Requester ${requesterID}`}</h3>
                          <SMSBox className="level-1-requester__badges">
                            <span className="badge badge--blue">{activeRequestsCount} Active Requests</span>
                          </SMSBox>
                        </SMSBox>
                      </SMSBox>
                      <SMSBox className="level-1-requester__actions">
                        {requester &&
                          (viewOnlyRequesters ? (
                            <SMSIconButton className="level-1-requester__icon-btn" tone="info" allowWhenSuspended onClick={() => handleViewProfile(requester)} aria-label="View" title="View Requester" size="small">
                              <SMSIcon name="visibility" size="sm" />
                            </SMSIconButton>
                          ) : (
                            <>
                              <SMSIconButton className="level-1-requester__icon-btn" tone="info" allowWhenSuspended onClick={() => handleViewProfile(requester)} aria-label="View" title="View Requester" size="small">
                                <SMSIcon name="visibility" size="sm" />
                              </SMSIconButton>
                              <SMSIconButton className="level-1-requester__icon-btn" tone="primary" onClick={() => handleEdit(requester)} aria-label="Edit" title="Edit Requester" size="small">
                                <SMSIcon name="edit" size="sm" />
                              </SMSIconButton>
                              <SMSIconButton className="level-1-requester__icon-btn" tone="success" onClick={() => handleCreateRequest(requester)} aria-label="Create Request" title="Create Request" size="small">
                                <SMSIcon name="add" size="sm" />
                              </SMSIconButton>
                              <SMSIconButton
                                className="level-1-requester__icon-btn"
                                tone="secondary"
                                onClick={() => handleRequesterInvoice(requester, requests)}
                                aria-label="Invoice"
                                title="Invoice"
                                size="small"
                              >
                                <SMSIcon name="receipt_long" size="sm" />
                              </SMSIconButton>
                              <SMSDollar
                                className="level-1-requester__icon-btn"
                                label={
                                  hasUnpaidInvoice
                                    ? INVOICE_GRID.GROUPED.UNPAID_INVOICE_TOOLTIP
                                    : REQUESTER_GRID_MENU.PAYMENT
                                }
                                tone={hasUnpaidInvoice ? 'error' : 'positive'}
                                onClick={() => onRequesterPayment(requester)}
                              />
                            </>
                          ))}
                      </SMSBox>
                    </SMSBox>

                    <SMSBox className="level-2-requests">
                      {requests.map((req) => {
                        const isRequestExpanded = expandedRequests.includes(req.requestID);
                        const requestPosts = postsByRequest[req.requestID];
                        const postsReady = requestPosts !== undefined;
                        const showPostAssignmentProgress = isOneTimeRequest(req);
                        const { page, pageSize, totalRecords } = getPostsPagination(req.requestID);
                        const postsTotal = totalRecords;
                        const projectNumber = getRequestProjectNumber(req);
                        // Server already returns the correct page slice for this request.
                        // Do not slice again on the client; double-slicing hides page 2+ rows.
                        const visiblePosts = requestPosts || [];

                        return (
                          <SMSBox key={req.requestID} className="level-2-request" data-expanded={isRequestExpanded}>
                            <SMSBox
                              className="level-2-request__header"
                              onClick={() => {
                                if (req.postCount !== undefined && req.postCount === 0) return;
                                toggleRequestExpand(req.requestID);
                              }}
                              style={{ cursor: req.postCount !== undefined && req.postCount === 0 ? undefined : 'pointer' }}
                            >
                              <SMSBox className="level-2-request__info">
                                <SMSIconButton
                                  className={`level-1-requester__expand-btn${req.postCount !== undefined && req.postCount === 0 ? ' level-2-request__expand-btn--hidden' : ''}`}
                                  tone="success"
                                  allowWhenSuspended
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (req.postCount !== undefined && req.postCount === 0) return;
                                    toggleRequestExpand(req.requestID);
                                  }}
                                  size="small"
                                  disabled={req.postCount !== undefined && req.postCount === 0}
                                  aria-hidden={req.postCount !== undefined && req.postCount === 0}
                                  aria-label={isRequestExpanded ? 'Collapse request' : 'Expand request and load posts'}
                                  title={isRequestExpanded ? 'Collapse' : 'Expand to load posts (Post/by-request)'}
                                >
                                  <SMSIcon name={isRequestExpanded ? 'expand_more' : 'navigate_next'} size="sm" />
                                </SMSIconButton>
                                <SMSBox className="level-2-request__data">
                                  <SMSBox className="level-2-request__data-item level-2-request__data-item--project">
                                    <span className="level-2-request__data-label">
                                      {DAILY_ADMINISTRATION.PROJECT_NUMBER_LABEL}
                                    </span>
                                    {projectNumber ? (
                                      <button
                                        type="button"
                                        className="level-2-request__data-value level-2-request__data-value--project-link"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (requester) onProjectNumberClick(req, requester, e);
                                        }}
                                        title={DAILY_ADMINISTRATION.PROJECT_NUMBER_LABEL}
                                      >
                                        {projectNumber}
                                      </button>
                                    ) : (
                                      <span className="level-2-request__data-value">-</span>
                                    )}
                                  </SMSBox>
                                  <SMSBox className="level-2-request__data-item level-2-request__data-item--start-date">
                                    <span className="level-2-request__data-label">Start Date</span>
                                    <span className="level-2-request__data-value">{formatRequestDateDisplay(req.startDate)}</span>
                                  </SMSBox>
                                  <SMSBox className="level-2-request__data-item level-2-request__data-item--end-date">
                                    <span className="level-2-request__data-label">End Date</span>
                                    <span className="level-2-request__data-value">{formatRequestDateDisplay(req.endDate)}</span>
                                  </SMSBox>
                                  <SMSBox className="level-2-request__data-item level-2-request__data-item--name">
                                    <span className="level-2-request__data-label">Name</span>
                                    <span className="level-2-request__data-value">{req.title}</span>
                                  </SMSBox>
                                  <SMSBox className="level-2-request__data-item level-2-request__data-item--type">
                                    <span className="level-2-request__data-label">Request Type</span>
                                    <RequestTypeDisplay request={req} />
                                  </SMSBox>
                                  <SMSBox className="level-2-request__data-item level-2-request__data-item--release-status">
                                    <span className="level-2-request__data-label">Release Status</span>
                                    <span className="level-2-request__data-value level-2-request__data-value--release">{getReleaseStatusLabel(req)}</span>
                                  </SMSBox>
                                  <SMSBox className="level-2-request__data-item level-2-request__data-item--release-as">
                                    <span className="level-2-request__data-label">Release As</span>
                                    <span className="level-2-request__data-value">{getReleaseAsLabel(req)}</span>
                                  </SMSBox>
                                  <SMSBox className="level-2-request__data-item level-2-request__data-item--post-count">
                                    <span className="level-2-request__data-label">{DAILY_ADMINISTRATION.POST_COUNT_LABEL}</span>
                                    <span className="level-2-request__data-value">{req.postCount ?? '-'}</span>
                                  </SMSBox>
                                </SMSBox>
                              </SMSBox>
                              <SMSBox className="level-2-request__actions" onClick={(e) => e.stopPropagation()}>
                                {!viewOnlyRequesters && (
                                  <SMSIconButton
                                    className="level-2-request__icon-btn"
                                    tone="secondary"
                                    onClick={() => setPendingCloneRequest(req)}
                                    aria-label="Clone"
                                    title="Clone Request"
                                    size="small"
                                  >
                                    <SMSIcon name="content_copy" size="sm" />
                                  </SMSIconButton>
                                )}
                                {!viewOnlyRequesters && (
                                  <SMSIconButton className="level-2-request__icon-btn" tone="primary" onClick={() => handleEditRequest(req.requestID)} aria-label="Edit" title="Edit Request" size="small">
                                    <SMSIcon name="edit" size="sm" />
                                  </SMSIconButton>
                                )}
                                <SMSIconButton
                                  className="level-2-request__icon-btn level-2-request__icon-btn--schedule"
                                  tone="secondary"
                                  allowWhenSuspended
                                  onClick={(e) => onScheduleClick(req, e)}
                                  aria-label={DAILY_ADMINISTRATION.SCHEDULE_BUTTON_TOOLTIP}
                                  title={DAILY_ADMINISTRATION.SCHEDULE_BUTTON_TOOLTIP}
                                  size="small"
                                >
                                  <SMSIcon name="calendar" size="sm" />
                                </SMSIconButton>
                                {!viewOnlyRequesters && (
                                  <SMSIconButton
                                    className="level-2-request__icon-btn"
                                    tone="secondary"
                                    onClick={() => onCreateRequestInvoice(req)}
                                    disabled={!projectNumber}
                                    aria-label={INVOICE_GRID.REQUEST_SCOPE.CREATE_INVOICE}
                                    title={INVOICE_GRID.REQUEST_SCOPE.CREATE_INVOICE}
                                    size="small"
                                  >
                                    <SMSIcon name="receipt_long" size="sm" />
                                  </SMSIconButton>
                                )}
                                {!viewOnlyRequesters && (
                                  <SMSIconButton
                                    className="level-2-request__icon-btn requester-list__delete-button"
                                    tone="error"
                                    onClick={() => {
                                      setDeletingRequest(req);
                                      setDeletingItem(null);
                                      setDeletingPost(null);
                                    }}
                                    aria-label="Delete"
                                    title="Delete Request"
                                    size="small"
                                  >
                                    <SMSIcon name="delete" size="sm" />
                                  </SMSIconButton>
                                )}
                                {!viewOnlyRequesters && renderRequestActionMenu(req)}
                              </SMSBox>
                            </SMSBox>

                            <SMSBox className="level-3-posts">
                              {isRequestExpanded && !postsReady && (
                                <SMSBox sx={{ p: 2 }}>
                                  {Array.from({ length: 2 }).map((_, idx) => (
                                    <Skeleton
                                      key={`post-skeleton-${req.requestID}-${idx}`}
                                      variant="rounded"
                                      height={84}
                                      sx={{ mb: idx === 1 ? 0 : 1.5 }}
                                    />
                                  ))}
                                </SMSBox>
                              )}
                              {isRequestExpanded && postsReady && (
                                <SMSGrid container spacing={2} className="level-3-posts__grid">
                                  {visiblePosts.map((post) => {
                                    const startTime = post.postStartTime ?? '';
                                    const endTimeFormatted = getPostEndTime(post.postStartTime, post.postLength);
                                    const isPostExpanded = post.postId ? expandedPosts.has(post.postId) : false;
                                    const postIndentPx = getPostIndentByLevel(post.level);

                                    return (
                                      <SMSGrid item xs={12} key={post.postId}>
                                      <SMSBox className="level-3-post-wrapper" style={{ paddingInlineStart: `${postIndentPx}px` }}>
                                        <SMSBox className="level-3-post-card">
                                          <SMSBox className="level-3-post-card__content">
                                            <SMSBox className="level-3-post-card__section level-3-post-card__section--name">
                                              <SMSBox className="level-3-post-card__name-wrapper">
                                                {post.postId && (
                                                  <SMSIconButton
                                                    className="level-1-requester__expand-btn"
                                                    tone="success"
                                                    allowWhenSuspended
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      if (isPostExpanded) togglePostExpand(post.postId!);
                                                      else void loadPostEmployeesAndExpand(post.postId!);
                                                    }}
                                                    aria-label={
                                                      isPostExpanded
                                                        ? DAILY_ADMINISTRATION.COLLAPSE_EMPLOYEES
                                                        : DAILY_ADMINISTRATION.EXPAND_EMPLOYEES
                                                    }
                                                    aria-expanded={isPostExpanded}
                                                    title={
                                                      isPostExpanded
                                                        ? DAILY_ADMINISTRATION.COLLAPSE_EMPLOYEES
                                                        : DAILY_ADMINISTRATION.EXPAND_EMPLOYEES
                                                    }
                                                    size="small"
                                                  >
                                                    <SMSIcon name={isPostExpanded ? 'expand_more' : 'navigate_next'} size="sm" />
                                                  </SMSIconButton>
                                                )}
                                                <h5 className={`level-3-post-card__title${post.isSupervisorPost ? ' level-3-post-card__title--supervisor' : ''}`}>{post.postTitle}</h5>
                                              </SMSBox>
                                            </SMSBox>
                                            <SMSBox className="level-3-post-card__section level-3-post-card__section--time">
                                              <SMSBox className="level-3-post-card__detail-item">
                                                <span className="level-3-post-card__detail-label">Time:</span>
                                                <span className="level-3-post-card__detail-value">{formatTimeToHHmm(startTime)} - {endTimeFormatted || 'N/A'}</span>
                                              </SMSBox>
                                            </SMSBox>
                                            <SMSBox className="level-3-post-card__section level-3-post-card__section--location">
                                              <SMSBox className="level-3-post-card__detail-item">
                                                <span className="level-3-post-card__detail-label">Location:</span>
                                                <SMSBox className="level-3-post-card__location">
                                                  <SMSIcon name="location_on" size="sm" />
                                                  <span>{post.postLocation}</span>
                                                </SMSBox>
                                              </SMSBox>
                                            </SMSBox>
                                            {showPostAssignmentProgress && (
                                              <SMSBox className="level-3-post-card__section level-3-post-card__section--assignments">
                                                <AssignmentProgressIndicator post={post} />
                                              </SMSBox>
                                            )}
                                            <SMSBox className="level-3-post-card__section level-3-post-card__section--actions" onClick={(e) => e.stopPropagation()}>
                                              {post.postId && (
                                                <Badge
                                                  badgeContent={
                                                    (() => {
                                                      const distinctDates = new Set(
                                                        postCollectDatesByPost[post.postId!] ?? []
                                                      ).size;
                                                      return distinctDates > 0 ? distinctDates : undefined;
                                                    })()
                                                  }
                                                  color="primary"
                                                  overlap="circular"
                                                  className="level-3-post-card__calendar-badge"
                                                >
                                                  <SMSIconButton
                                                    className="level-3-post-card__icon-btn"
                                                    tone="default"
                                                    allowWhenSuspended
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      const postId = post.postId!;
                                                      if (!isPostExpanded) {
                                                        void loadPostEmployeesAndExpand(postId);
                                                      } else {
                                                        ensurePostCollectDates(postId);
                                                      }
                                                      setPostDatesCalendarAnchor({
                                                        el: e.currentTarget as HTMLElement,
                                                        postId,
                                                      });
                                                    }}
                                                    aria-label={DAILY_ADMINISTRATION.OPEN_POSITION_DATES}
                                                    title={DAILY_ADMINISTRATION.OPEN_POSITION_DATES}
                                                    size="small"
                                                  >
                                                    <SMSIcon name="calendar" size="sm" />
                                                  </SMSIconButton>
                                                </Badge>
                                              )}
                                              {!viewOnlyRequesters && (
                                                <>
                                                  <SMSIconButton
                                                    className="level-3-post-card__icon-btn"
                                                    tone="secondary"
                                                    onClick={() => setPendingClonePost(post)}
                                                    aria-label="Clone"
                                                    title="Clone Post"
                                                    size="small"
                                                  >
                                                    <SMSIcon name="content_copy" size="sm" />
                                                  </SMSIconButton>
                                                  <SMSIconButton className="level-3-post-card__icon-btn" tone="primary" onClick={() => handleEditPost(post)} aria-label={DAILY_ADMINISTRATION.EDIT_POST} title={DAILY_ADMINISTRATION.EDIT_POST} size="small">
                                                    <SMSIcon name="edit" size="sm" />
                                                  </SMSIconButton>
                                                  {post.postId && (
                                                    <SMSIconButton
                                                      className="level-3-post-card__icon-btn requester-list__delete-button"
                                                      tone="error"
                                                      onClick={() => { setDeletingPost(post); setDeletingItem(null); setDeletingRequest(null); }}
                                                      aria-label="Delete"
                                                      title="Delete Post"
                                                      size="small"
                                                    >
                                                      <SMSIcon name="delete" size="sm" />
                                                    </SMSIconButton>
                                                  )}
                                                </>
                                              )}
                                              {!viewOnlyRequesters && renderPostActionMenu(post, req)}
                                            </SMSBox>
                                          </SMSBox>
                                          {isPostExpanded && post.postId && (
                                            <SMSBox className={`post-assigned-members-wrapper ${isPostExpanded ? 'post-assigned-members-wrapper--expanded' : ''}`}>
                                              {(() => {
                                                const selectedDates = getSelectedDatesForPost(
                                                  expandedPostDays,
                                                  post.postId!
                                                );
                                                const cacheKey = postPositionFilterCacheKey(
                                                  post.postId!,
                                                  selectedDates
                                                );
                                                // First load: skeleton only. Refetch: keep slider mounted
                                                // (preserves page size) and show a grey overlay while loading.
                                                if (!(cacheKey in postPositionsByPostAndDate)) {
                                                  return (
                                                    <SMSBox sx={{ p: 2 }}>
                                                      <Skeleton variant="rounded" height={120} />
                                                    </SMSBox>
                                                  );
                                                }
                                                const positions = postPositionsByPostAndDate[cacheKey] ?? [];
                                                const totalRecords =
                                                  filledPositionsByPostAndDate[cacheKey] ?? positions.length;
                                                const isPositionsLoading =
                                                  loadingPostPositionsByPost[post.postId!] === true;
                                                return (
                                                  <SMSBox
                                                    className="post-assigned-members-wrapper__table-shell"
                                                    sx={{ position: 'relative' }}
                                                    aria-busy={isPositionsLoading || undefined}
                                                  >
                                                    {/* Keep table mounted on refetch so headers stay; only body/pagination update. */}
                                                    {renderPostEmployeesSlider(
                                                      post.postId!,
                                                      post,
                                                      req,
                                                      selectedDates,
                                                      positions,
                                                      totalRecords,
                                                      (pagination, meta) =>
                                                        refreshPostPositions(
                                                          post.postId!,
                                                          selectedDates,
                                                          req.requestID,
                                                          pagination,
                                                          meta
                                                        ),
                                                      cacheKey,
                                                      isPositionsLoading
                                                    )}
                                                    {isPositionsLoading ? (
                                                      <SMSBox
                                                        className="post-assigned-members-wrapper__loading-overlay"
                                                        aria-hidden
                                                      />
                                                    ) : null}
                                                  </SMSBox>
                                                );
                                              })()}
                                            </SMSBox>
                                          )}
                                        </SMSBox>
                                      </SMSBox>
                                      </SMSGrid>
                                    );
                                  })}
                                </SMSGrid>
                              )}
                              {isRequestExpanded && postsReady && postsTotal > 0 && (
                                <SMSPagination
                                  className="daily-administration__posts-pagination sms-pagination"
                                  variant="compact"
                                  currentPage={page}
                                  pageSize={pageSize}
                                  totalItems={postsTotal}
                                  onPageChange={(p) =>
                                    loadPostsAndPositionsForRequest(req.requestID, { page: p, pageSize })
                                  }
                                  pageSizeSlot={
                                    <>
                                      <SMSButton
                                        variant="outlined"
                                        onClick={(e) =>
                                          setPageSizeMenuAnchor({
                                            el: e.currentTarget as HTMLElement,
                                            requestID: req.requestID,
                                          })
                                        }
                                        sx={{ minWidth: 56 }}
                                        className="data-table__page-size-button"
                                      >
                                        {pageSize}
                                      </SMSButton>
                                      <Menu
                                        anchorEl={
                                          pageSizeMenuAnchor?.requestID === req.requestID
                                            ? pageSizeMenuAnchor.el
                                            : null
                                        }
                                        open={pageSizeMenuAnchor?.requestID === req.requestID}
                                        onClose={() => setPageSizeMenuAnchor(null)}
                                        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                                        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                                      >
                                        {TABLE_PAGE_SIZE_OPTIONS.map((size) => (
                                          <MenuItem
                                            key={size}
                                            onClick={() => {
                                              setPostsPagination(req.requestID, { pageSize: size });
                                              loadPostsAndPositionsForRequest(req.requestID, {
                                                page: 1,
                                                pageSize: size,
                                              });
                                              setPageSizeMenuAnchor(null);
                                            }}
                                          >
                                            {size}
                                          </MenuItem>
                                        ))}
                                      </Menu>
                                      <span className="sms-pagination__size-label">{PAGINATION.ROWS_PER_PAGE}</span>
                                    </>
                                  }
                                />
                              )}
                            </SMSBox>
                          </SMSBox>
                        );
                      })}
                    </SMSBox>
                  </SMSBox>
                </SMSBox>
              );
            })
          )}
          {!dailyLoading && Object.keys(groupedByRequester).length === 0 && <p className="no-data-message">No requests found.</p>}
          {!dailyLoading && Object.keys(groupedByRequester).length > 0 && dailyHasMore && (
            <div
              ref={loadMoreSentinelRef}
              className="daily-admin-load-more-sentinel"
              role="status"
              aria-live="polite"
              aria-busy={dailyLoadingMore}
            >
              {dailyLoadingMore && (
                <SMSBox className="daily-admin-load-more-skeleton-rows">
                  {Array.from({ length: 3 }).map((_, idx) =>
                    renderRequesterSkeleton(`daily-loading-more-${idx}`)
                  )}
                </SMSBox>
              )}
            </div>
          )}
        </SMSBox>
      </SMSBox>
      <SMSConfirmDialog
        open={!!pendingCloneRequest || !!pendingClonePost}
        title={pendingClonePost ? 'Confirm Clone Post' : 'Confirm Clone Request'}
        message={
          pendingClonePost
            ? `Are you sure you want to clone job "${pendingClonePost.postTitle}"?`
            : pendingCloneRequest
              ? `Are you sure you want to clone request "${pendingCloneRequest.title}"?`
              : 'Are you sure you want to clone this item?'
        }
        confirmText="Clone"
        cancelText="Cancel"
        onConfirm={handleCloneConfirm}
        onClose={handleCloneCancel}
        variant="warning"
      />
      <Popover
        open={isPostDatesCalendarOpen}
        anchorEl={postDatesCalendarAnchor?.el ?? null}
        onClose={() => setPostDatesCalendarAnchor(null)}
        disableScrollLock
        disableEnforceFocus
        disableRestoreFocus
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        BackdropProps={{ invisible: true }}
        slotProps={{
          paper: {
            className: 'sms-multi-date-calendar__paper',
          },
        }}
      >
        {postDatesCalendarAnchor && (
          <SMSMultiDateCalendar
            dates={postCollectDatesByPost[postDatesCalendarAnchor.postId] ?? []}
            selectedDates={getSelectedDatesForPost(expandedPostDays, postDatesCalendarAnchor.postId)}
            loading={
              loadingPostCollectDatesByPost[postDatesCalendarAnchor.postId] === true ||
              loadingPostPositionsByPost[postDatesCalendarAnchor.postId] === true ||
              postCollectDatesByPost[postDatesCalendarAnchor.postId] === undefined
            }
            labels={POSITION_DATE_CALENDAR_LABELS}
            onSelectMonthDates={(dates: string[]) =>
              selectPostFilterDates(postDatesCalendarAnchor.postId, dates)
            }
            onToggleDate={(date: string) =>
              togglePostFilterDate(postDatesCalendarAnchor.postId, date)
            }
            onClear={() => selectPostFilterDates(postDatesCalendarAnchor.postId, [])}
            onClose={() => setPostDatesCalendarAnchor(null)}
          />
        )}
      </Popover>
    </SMSBox>
  );
};
