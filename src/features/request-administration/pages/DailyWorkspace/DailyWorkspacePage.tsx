import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Menu, MenuItem, Popover, Skeleton } from '@mui/material';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { SMSBox, SMSButton, SMSDatePicker, SMSIcon, SMSIconButton, SMSTextField } from '@/components/smsatoms';
import {
  SendEmailModal,
  type SendEmailContext,
  NotificationHistoryModal,
  UploadFileModal,
  SMSConfirmDialog,
  SMSMultiDateCalendar,
  type SMSMultiDateCalendarLabels,
  InvoicePreviewModal,
} from '@/components/smsmolecules';
import { SMSAuditHistoryModal, SMSRosterModal, RequestScheduleListModal } from '@/components/smsorganisms';
import {
  WorkspaceIconButton,
  WorkspacePanelHeader,
  WorkspaceFilterChips,
  WorkspaceRequestCard,
  WorkspacePositionsPanel,
  PostTree,
} from './components';
import type {
  PostTreeActions,
  WorkspaceRequestCardActions,
  PositionsPaging,
} from './components';
import {
  DAILY_ADMINISTRATION,
  DAILY_WORKSPACE,
  INVOICE_GRID,
  POST_POSITION,
  REQUESTER,
  REQUESTER_GRID_MENU,
  REQUEST_FORM,
} from '@/constants/strings';
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants/tablePagination';
import { useDebounce } from '@/hooks/useDebounceSearch';
import { formatTimeToHHmm } from '@/utils/dateTimeUtils';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  cloneRequestThunk,
  clearRequestPostPositionsForPost,
  deleteRequestThunk,
  fetchRequestById,
  fetchRequestPostPositions,
  fetchRequestPosts,
  fetchRequestsByRequesterId,
} from '@/store/slices/requestSlice';
import { clonePostThunk, deletePostThunk, fetchPostById } from '@/store/slices/postSlice';
import { cancelPostPositionThunk } from '@/store/slices/postPositionSlice';
import { PostPositionStatus } from '@/types/postPosition';
import { AuditHistoryTable } from '@/services/auditHistoryService';
import { fileUpload, getFilesOrFile } from '@/services/fileUploadService';
import type { FileUploadDto } from '@/types/fileUpload';
import { fetchDepartmentConfigByDepartmentId } from '@/store/slices/departmentConfigurationSlice';
import { showToast } from '@/store/slices/toastSlice';
import {
  type RequestInRequesterListDto,
  type PostInRequestListDto,
  type PostPositionInRequestListDto,
  type RequestPostPositionsFilter,
  type RequestResponse,
} from '@/types/request';
import { useEntityAuditHistory } from './hooks/useEntityAuditHistory';
import {
  readDailyWorkspaceSessionState,
  writeDailyWorkspaceSessionState,
  createDefaultDailyWorkspaceSnapshot,
  type DailyWorkspaceSessionSnapshot,
} from '@/utils/dailyWorkspaceSessionState';
import { useDailyWorkspaceFilters } from './DailyWorkspaceFiltersContext';
import {
  runWorkspaceRefresh,
  type WorkspaceRefreshDomain,
  type WorkspaceRefreshScope,
} from './workspaceRefresh';
import { AssignEmployeesModal } from '../RequesterList/AssignEmployeesModal';
import '../RequesterList/RequesterList.css';
import './DailyWorkspacePage.css';

const DEFAULT_POSITIONS_PAGING: PositionsPaging = {
  page: 1,
  pageSize: DEFAULT_TABLE_PAGE_SIZE,
};

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

const ROSTER_URL_DATE_QUERY = 'dateOfWork';

const DAILY_WORKSPACE_ROSTER_PATH =
  /^\/personnel\/daily-workspace\/[^/]+\/request\/([^/]+)\/roster\/?$/;

export const DailyWorkspacePage: React.FC = () => {
  const { requesterId = '' } = useParams<{ requesterId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const {
    startDate: filterStartDate,
    endDate: filterEndDate,
    requestStatuses,
    requestTypes,
    setStartDate: setFilterStartDate,
    setEndDate: setFilterEndDate,
    toggleStatus,
    toggleType,
    clearAllFilters,
    apiFilterParams,
    activeFilterCount,
  } = useDailyWorkspaceFilters();

  const initialSnapshotRef = useRef<DailyWorkspaceSessionSnapshot | null | undefined>(undefined);
  if (initialSnapshotRef.current === undefined) {
    initialSnapshotRef.current = readDailyWorkspaceSessionState(requesterId);
  }
  const initialSnapshot = initialSnapshotRef.current;

  const {
    requesterRequests,
    requesterRequestsTotalCount,
    requesterRequestsLoadingMore,
    requesterPostsTotalCount,
    requesterHasUnpaidInvoice,
    requestPosts,
    requestPostsTotalCount,
    requestPostsLoading,
    requestPostsLoadingMore,
    requestPostPositionsByPostId,
    requestPostPositionsTotalByPostId,
    requestPostPositionDatesByPostId,
    requestPostPositionsLoadingByPostId,
    isLoading: requestsLoading,
  } = useAppSelector((state) => state.request);
  const { user } = useAppSelector((state) => state.auth);
  const departmentConfig = useAppSelector((state) =>
    user?.departmentID
      ? state.departmentConfiguration.configByDepartmentId[user.departmentID] ?? null
      : null
  );

  const requestPanelRef = useRef<HTMLElement | null>(null);
  const requestListScrollRef = useRef<HTMLElement | null>(null);
  const requestSentinelRef = useRef<HTMLDivElement | null>(null);
  const requestsLoadingMoreRef = useRef(false);
  const requestsPageRef = useRef(1);
  const postsPageRef = useRef(1);
  const postPanelRef = useRef<HTMLElement | null>(null);
  const positionPanelRef = useRef<HTMLElement | null>(null);

  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    () => initialSnapshot?.selectedRequestId ?? null
  );
  const [selectedPostIds, setSelectedPostIds] = useState<Set<string>>(
    () => new Set(initialSnapshot?.selectedPostIds ?? [])
  );
  const [activePostId, setActivePostId] = useState<string | null>(
    () => initialSnapshot?.activePostId ?? null
  );
  const [positionsPagingByPostId, setPositionsPagingByPostId] = useState<
    Record<string, PositionsPaging>
  >(() => initialSnapshot?.positionsPagingByPostId ?? {});
  const [requestMenu, setRequestMenu] = useState<{
    el: HTMLElement;
    request: RequestInRequesterListDto;
  } | null>(null);
  const [postMenu, setPostMenu] = useState<{ el: HTMLElement; post: PostInRequestListDto } | null>(
    null
  );
  const [requestVehicleEquipmentById, setRequestVehicleEquipmentById] = useState<
    Record<string, { requiresVehicle: boolean; requiresEquipment: boolean }>
  >({});
  const [postVehicleEquipmentById, setPostVehicleEquipmentById] = useState<
    Record<string, { postRequiresVehicle: boolean; postRequiresEquipment: boolean }>
  >({});
  const [assignOpen, setAssignOpen] = useState(false);
  const [transferRow, setTransferRow] = useState<PostPositionInRequestListDto | null>(null);
  const [positionMenu, setPositionMenu] = useState<{
    el: HTMLElement;
    row: PostPositionInRequestListDto;
    postId: string;
  } | null>(null);
  const [sendEmailContext, setSendEmailContext] = useState<SendEmailContext | null>(null);
  const [notificationHistoryContext, setNotificationHistoryContext] = useState<{
    postPositionId?: string;
    postId?: string;
    requestId?: string;
    requesterId?: string;
    title?: string;
  } | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadModalRequest, setUploadModalRequest] = useState<RequestInRequesterListDto | null>(
    null
  );
  const [uploadModalExistingFiles, setUploadModalExistingFiles] = useState<FileUploadDto[]>([]);
  const [deletingRequest, setDeletingRequest] = useState<RequestInRequesterListDto | null>(null);
  const [pendingCloneRequest, setPendingCloneRequest] = useState<RequestInRequesterListDto | null>(
    null
  );
  const [pendingClonePost, setPendingClonePost] = useState<PostInRequestListDto | null>(null);
  const [scheduleModalRequest, setScheduleModalRequest] = useState<RequestResponse | null>(null);
  const [invoicePreviewOpen, setInvoicePreviewOpen] = useState(false);
  const [invoicePreviewRequest, setInvoicePreviewRequest] = useState<RequestResponse | null>(null);
  const [deletingPost, setDeletingPost] = useState<PostInRequestListDto | null>(null);
  const [unassigningPosition, setUnassigningPosition] = useState<{
    row: PostPositionInRequestListDto;
    postId: string;
  } | null>(null);
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);
  const [isCloneLoading, setIsCloneLoading] = useState(false);
  const [isUnassignLoading, setIsUnassignLoading] = useState(false);
  const confirmationModalStrings = POST_POSITION.ASSIGNMENTS_AND_WAITING.CONFIRMATION_MODAL;
  const [requestSearch, setRequestSearch] = useState(
    () => initialSnapshot?.requestSearch ?? ''
  );
  const [postSearch, setPostSearch] = useState(() => initialSnapshot?.postSearch ?? '');
  const [requestsCollapsed, setRequestsCollapsed] = useState(
    () => initialSnapshot?.requestsCollapsed ?? false
  );
  const [postsCollapsed, setPostsCollapsed] = useState(
    () => initialSnapshot?.postsCollapsed ?? false
  );
  const [positionsCollapsed, setPositionsCollapsed] = useState(
    () => initialSnapshot?.positionsCollapsed ?? false
  );
  const [requestLayout, setRequestLayout] = useState<'grid' | 'list'>(
    () => initialSnapshot?.requestLayout ?? 'list'
  );
  const [collapsedPositionPostIds, setCollapsedPositionPostIds] = useState<Set<string>>(
    () => new Set(initialSnapshot?.collapsedPositionPostIds ?? [])
  );
  const [postFilterDatesByPostId, setPostFilterDatesByPostId] = useState<
    Record<string, string[]>
  >(() => initialSnapshot?.postFilterDatesByPostId ?? {});
  /** Per-post Assigned History toggle (`isViewHistory` on by-post/filter). Default false = Current Assigned. */
  const [viewHistoryByPostId, setViewHistoryByPostId] = useState<Record<string, boolean>>({});
  const [postDatesCalendarAnchor, setPostDatesCalendarAnchor] = useState<{
    el: HTMLElement;
    postId: string;
  } | null>(null);
  const postDatesInitializedRef = useRef<Set<string>>(new Set());
  const postFilterDatesByPostIdRef = useRef(postFilterDatesByPostId);
  postFilterDatesByPostIdRef.current = postFilterDatesByPostId;
  const positionsPagingByPostIdRef = useRef(positionsPagingByPostId);
  positionsPagingByPostIdRef.current = positionsPagingByPostId;

  // ── sessionStorage: restore / persist workspace UI (per requester, per tab) ──
  const sessionHydratedRef = useRef(true);
  const sessionReadyForPersistRef = useRef(true);
  const restoreRequestSelectionPendingRef = useRef(Boolean(initialSnapshot?.selectedRequestId));
  const restorePostSelectionPendingRef = useRef(
    Boolean(initialSnapshot?.selectedPostIds?.length)
  );
  const prevSelectedRequestIdRef = useRef<string | null>(
    initialSnapshot?.selectedRequestId ?? null
  );
  const savedScrollRef = useRef<DailyWorkspaceSessionSnapshot['scroll'] | null>(
    initialSnapshot?.scroll ?? null
  );
  const scrollRestoredRef = useRef(false);
  const prevRequesterIdRef = useRef<string | null>(null);

  const persistSnapshotRef = useRef<DailyWorkspaceSessionSnapshot>({
    selectedRequestId: null,
    selectedPostIds: [],
    activePostId: null,
    filterStartDate: '',
    filterEndDate: '',
    requestStatuses: [],
    requestTypes: [],
    requestSearch: '',
    postSearch: '',
    requestsCollapsed: false,
    postsCollapsed: false,
    positionsCollapsed: false,
    requestLayout: 'list',
    collapsedPositionPostIds: [],
    positionsPagingByPostId: {},
    postFilterDatesByPostId: {},
    scroll: { requestPanel: 0, postPanel: 0, positionPanel: 0 },
  });

  persistSnapshotRef.current = {
    selectedRequestId,
    selectedPostIds: [...selectedPostIds],
    activePostId,
    filterStartDate,
    filterEndDate,
    requestStatuses: requestStatuses.map(Number),
    requestTypes: requestTypes.map(Number),
    requestSearch,
    postSearch,
    requestsCollapsed,
    postsCollapsed,
    positionsCollapsed,
    requestLayout,
    collapsedPositionPostIds: [...collapsedPositionPostIds],
    positionsPagingByPostId,
    postFilterDatesByPostId,
    scroll: {
      requestPanel:
        (requestLayout === 'list'
          ? requestListScrollRef.current?.scrollTop
          : requestPanelRef.current?.scrollTop) ?? 0,
      postPanel: postPanelRef.current?.scrollTop ?? 0,
      positionPanel: positionPanelRef.current?.scrollTop ?? 0,
    },
  };

  useEffect(() => {
    return () => {
      if (sessionReadyForPersistRef.current && requesterId) {
        writeDailyWorkspaceSessionState(requesterId, persistSnapshotRef.current);
      }
    };
  }, [requesterId]);

  useEffect(() => {
    if (!requesterId || !sessionReadyForPersistRef.current) return;

    const timer = window.setTimeout(() => {
      writeDailyWorkspaceSessionState(requesterId, persistSnapshotRef.current);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [
    requesterId,
    selectedRequestId,
    selectedPostIds,
    activePostId,
    filterStartDate,
    filterEndDate,
    requestStatuses,
    requestTypes,
    requestSearch,
    postSearch,
    requestsCollapsed,
    postsCollapsed,
    positionsCollapsed,
    requestLayout,
    collapsedPositionPostIds,
    positionsPagingByPostId,
    postFilterDatesByPostId,
  ]);

  const requestHistory = useEntityAuditHistory({
    table: AuditHistoryTable.Request,
    errorMessage: DAILY_WORKSPACE.TOAST.REQUEST_AUDIT_FAILED,
  });
  const postHistory = useEntityAuditHistory({
    table: AuditHistoryTable.Post,
    errorMessage: DAILY_WORKSPACE.TOAST.POST_AUDIT_FAILED,
  });

  const returnPath = `/personnel/daily-workspace/${requesterId}`;

  const rosterRouteRequestId = useMemo(() => {
    const match = location.pathname.match(DAILY_WORKSPACE_ROSTER_PATH);
    return match?.[1]?.trim() ?? '';
  }, [location.pathname]);

  const rosterModalFromRoute = Boolean(rosterRouteRequestId);
  const effectiveRosterRequestId = rosterRouteRequestId;
  const [rosterDateOfWork, setRosterDateOfWork] = useState('');

  const rosterModalDateProp = useMemo(() => {
    if (!rosterModalFromRoute) return rosterDateOfWork;
    const fromQuery = searchParams.get(ROSTER_URL_DATE_QUERY)?.trim();
    return fromQuery || rosterDateOfWork.trim() || '';
  }, [rosterModalFromRoute, searchParams, rosterDateOfWork]);

  useEffect(() => {
    if (!rosterModalFromRoute) return;
    const fromQuery = searchParams.get(ROSTER_URL_DATE_QUERY)?.trim();
    setRosterDateOfWork(fromQuery || '');
  }, [rosterModalFromRoute, searchParams]);

  const syncRosterDateToUrl = useCallback(
    (ymd: string) => {
      const t = ymd.trim();
      setRosterDateOfWork(t);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (t) next.set(ROSTER_URL_DATE_QUERY, t);
          else next.delete(ROSTER_URL_DATE_QUERY);
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const navigateWithSave = useCallback(
    (to: string, options?: { state?: Record<string, unknown> }) => {
      writeDailyWorkspaceSessionState(requesterId, persistSnapshotRef.current);
      navigate(to, {
        ...options,
        state: {
          ...(options?.state ?? {}),
          returnPath,
          requesterId,
        },
      });
    },
    [navigate, requesterId, returnPath]
  );

  const openRequestRoster = useCallback(
    (request: RequestInRequesterListDto) => {
      const start = request.startDate?.slice(0, 10) ?? '';
      const qs = start ? `?${ROSTER_URL_DATE_QUERY}=${encodeURIComponent(start)}` : '';
      navigateWithSave(
        `/personnel/daily-workspace/${requesterId}/request/${request.requestId}/roster${qs}`
      );
    },
    [navigateWithSave, requesterId]
  );

  const openRequestSchedule = useCallback(
    (request: RequestInRequesterListDto) => {
      setScheduleModalRequest({
        requestID: request.requestId,
        requesterID: requesterId,
        title: request.name,
        startDate: request.startDate,
        endDate: request.endDate,
        requestType: request.requestType ?? undefined,
      } as RequestResponse);
    },
    [requesterId]
  );

  const openRequestInvoice = useCallback(
    async (request: RequestInRequesterListDto) => {
      try {
        const fullRequest = await dispatch(fetchRequestById(request.requestId)).unwrap();
        setInvoicePreviewRequest(fullRequest);
        setInvoicePreviewOpen(true);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : DAILY_WORKSPACE.TOAST.INVOICE_PREVIEW_FAILED;
        dispatch(showToast(message, 'error'));
      }
    },
    [dispatch]
  );

  const getPostTimeLabel = useCallback((post: PostInRequestListDto) => {
    const start = formatTimeToHHmm(post.postStartTime) || post.postStartTime || '—';
    const end = formatTimeToHHmm(post.postEndTime) || post.postEndTime || '—';
    return `${start} – ${end}`;
  }, []);

  const debouncedRequestSearch = useDebounce(requestSearch, 300);
  const debouncedPostSearch = useDebounce(postSearch, 300);

  const clearPostSelection = useCallback(() => {
    setSelectedPostIds(new Set());
    setActivePostId(null);
    setCollapsedPositionPostIds(new Set());
  }, []);

  const togglePostSelection = useCallback((postId: string) => {
    setSelectedPostIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
        if (next.size === 0) {
          setActivePostId(null);
          setCollapsedPositionPostIds(new Set());
        } else {
          setActivePostId((current) =>
            current === postId ? [...next][next.size - 1]! : current
          );
        }
      } else {
        next.add(postId);
        setActivePostId(postId);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!requesterId) return;

    const prevRequester = prevRequesterIdRef.current;
    prevRequesterIdRef.current = requesterId;

    if (prevRequester === null || prevRequester === requesterId) return;

    sessionHydratedRef.current = false;
    sessionReadyForPersistRef.current = false;
    scrollRestoredRef.current = false;
    restoreRequestSelectionPendingRef.current = false;
    restorePostSelectionPendingRef.current = false;
    savedScrollRef.current = null;
    initialSnapshotRef.current = readDailyWorkspaceSessionState(requesterId);

    const snapshot = initialSnapshotRef.current ?? createDefaultDailyWorkspaceSnapshot();
    setSelectedRequestId(snapshot.selectedRequestId);
    setSelectedPostIds(new Set(snapshot.selectedPostIds));
    setActivePostId(snapshot.activePostId);
    setRequestSearch(snapshot.requestSearch);
    setPostSearch(snapshot.postSearch);
    setRequestsCollapsed(snapshot.requestsCollapsed);
    setPostsCollapsed(snapshot.postsCollapsed);
    setPositionsCollapsed(snapshot.positionsCollapsed);
    setRequestLayout(snapshot.requestLayout);
    setCollapsedPositionPostIds(new Set(snapshot.collapsedPositionPostIds));
    setPositionsPagingByPostId(snapshot.positionsPagingByPostId);
    setPostFilterDatesByPostId(snapshot.postFilterDatesByPostId ?? {});
    postDatesInitializedRef.current = new Set();
    savedScrollRef.current = snapshot.scroll;

    if (snapshot.selectedRequestId) {
      restoreRequestSelectionPendingRef.current = true;
      prevSelectedRequestIdRef.current = snapshot.selectedRequestId;
    }
    if (snapshot.selectedPostIds.length > 0) {
      restorePostSelectionPendingRef.current = true;
    }

    sessionHydratedRef.current = true;
    sessionReadyForPersistRef.current = true;
  }, [requesterId]);

  const requestFilters = useMemo(
    () => ({
      requesterId,
      ...apiFilterParams,
    }),
    [requesterId, apiFilterParams]
  );

  const postFilters = useMemo(
    () => ({
      requestId: selectedRequestId ?? '',
      ...(debouncedPostSearch.trim() ? { search: debouncedPostSearch.trim() } : {}),
    }),
    [selectedRequestId, debouncedPostSearch]
  );

  const reloadRequestPosts = useCallback(() => {
    if (!selectedRequestId) return;
    postsPageRef.current = 1;
    dispatch(
      fetchRequestPosts({
        ...postFilters,
        pageParam: { page: 1, pageSize: DEFAULT_TABLE_PAGE_SIZE },
      })
    );
  }, [dispatch, selectedRequestId, postFilters]);

  const requestPostsHasMore = requestPosts.length < requestPostsTotalCount;

  const loadMoreRequestPosts = useCallback(() => {
    if (
      !selectedRequestId ||
      requestPostsLoading ||
      requestPostsLoadingMore ||
      !requestPostsHasMore
    ) {
      return;
    }
    postsPageRef.current += 1;
    dispatch(
      fetchRequestPosts({
        ...postFilters,
        pageParam: { page: postsPageRef.current, pageSize: DEFAULT_TABLE_PAGE_SIZE },
        append: true,
      })
    );
  }, [
    dispatch,
    postFilters,
    requestPostsLoading,
    requestPostsHasMore,
    requestPostsLoadingMore,
    selectedRequestId,
  ]);

  const handlePostsScroll = useCallback(
    (e: React.UIEvent<HTMLElement>) => {
      const el = e.currentTarget;
      if (el.scrollHeight - el.scrollTop - el.clientHeight > 80) return;
      loadMoreRequestPosts();
    },
    [loadMoreRequestPosts]
  );

  const reloadRequesterRequests = useCallback(() => {
    if (!requesterId) return;
    requestsPageRef.current = 1;
    dispatch(
      fetchRequestsByRequesterId({
        ...requestFilters,
        pageParam: { page: 1, pageSize: DEFAULT_TABLE_PAGE_SIZE },
      })
    );
  }, [dispatch, requesterId, requestFilters]);

  const requesterRequestsHasMore =
    requesterRequests.length < requesterRequestsTotalCount;

  const loadMoreRequesterRequests = useCallback(() => {
    if (
      !requesterId ||
      requestsLoading ||
      requesterRequestsLoadingMore ||
      requestsLoadingMoreRef.current ||
      !requesterRequestsHasMore
    ) {
      return;
    }
    requestsLoadingMoreRef.current = true;
    requestsPageRef.current += 1;
    void dispatch(
      fetchRequestsByRequesterId({
        ...requestFilters,
        pageParam: { page: requestsPageRef.current, pageSize: DEFAULT_TABLE_PAGE_SIZE },
        append: true,
      })
    ).finally(() => {
      requestsLoadingMoreRef.current = false;
    });
  }, [
    dispatch,
    requestFilters,
    requesterId,
    requesterRequestsHasMore,
    requesterRequestsLoadingMore,
    requestsLoading,
  ]);

  const handleRequestsScroll = useCallback(
    (e: React.UIEvent<HTMLElement>) => {
      const el = e.currentTarget;
      if (el.scrollHeight - el.scrollTop - el.clientHeight > 80) return;
      loadMoreRequesterRequests();
    },
    [loadMoreRequesterRequests]
  );

  useEffect(() => {
    const node = requestSentinelRef.current;
    if (!node || !requesterRequestsHasMore || requestsLoading) return;
    let root: HTMLElement | null = node.parentElement;
    while (root) {
      const overflow = getComputedStyle(root).overflowY;
      if (overflow === 'auto' || overflow === 'scroll') break;
      root = root.parentElement;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMoreRequesterRequests();
      },
      { root, rootMargin: '120px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [
    loadMoreRequesterRequests,
    requesterRequestsHasMore,
    requestsLoading,
    requesterRequests.length,
    requestLayout,
  ]);

  useEffect(() => {
    reloadRequesterRequests();
  }, [reloadRequesterRequests]);

  useEffect(() => {
    if (!selectedRequestId || requestsLoading) return;

    if (restoreRequestSelectionPendingRef.current) {
      if (requesterRequests.length === 0) return;
      restoreRequestSelectionPendingRef.current = false;
    }

    if (!requesterRequests.some((r) => r.requestId === selectedRequestId)) {
      setSelectedRequestId(null);
      clearPostSelection();
    }
  }, [requesterRequests, selectedRequestId, clearPostSelection, requestsLoading]);

  useEffect(() => {
    if (!selectedRequestId) {
      if (prevSelectedRequestIdRef.current !== null) {
        clearPostSelection();
      }
      prevSelectedRequestIdRef.current = null;
      return;
    }

    reloadRequestPosts();

    if (prevSelectedRequestIdRef.current === selectedRequestId) return;

    if (prevSelectedRequestIdRef.current !== null) {
      clearPostSelection();
      setPostSearch('');
      setPostsCollapsed(false);
    }
    prevSelectedRequestIdRef.current = selectedRequestId;
  }, [selectedRequestId, reloadRequestPosts, clearPostSelection]);

  useEffect(() => {
    if (!user?.departmentID) return;
    void dispatch(fetchDepartmentConfigByDepartmentId(user.departmentID));
  }, [dispatch, user?.departmentID]);

  useEffect(() => {
    if (!uploadModalOpen || !uploadModalRequest?.requestId || !requesterId) {
      setUploadModalExistingFiles([]);
      return;
    }
    let mounted = true;
    getFilesOrFile(requesterId, uploadModalRequest.requestId)
      .then((list) => {
        if (mounted) setUploadModalExistingFiles(list ?? []);
      })
      .catch(() => {
        if (mounted) setUploadModalExistingFiles([]);
      });
    return () => {
      mounted = false;
    };
  }, [uploadModalOpen, uploadModalRequest?.requestId, requesterId]);

  const selectedRequest = useMemo(
    () => requesterRequests.find((r) => r.requestId === selectedRequestId) ?? null,
    [requesterRequests, selectedRequestId]
  );

  const posts = selectedRequestId ? requestPosts : [];
  const postsLoading = selectedRequestId ? requestPostsLoading : false;

  useEffect(() => {
    if (scrollRestoredRef.current || !savedScrollRef.current) return;
    if (requestsLoading) return;
    if (selectedRequestId && postsLoading) return;

    scrollRestoredRef.current = true;
    const scroll = savedScrollRef.current;
    requestAnimationFrame(() => {
      const requestScrollEl =
        requestLayout === 'list' ? requestListScrollRef.current : requestPanelRef.current;
      if (requestScrollEl) requestScrollEl.scrollTop = scroll.requestPanel;
      if (postPanelRef.current) postPanelRef.current.scrollTop = scroll.postPanel;
      if (positionPanelRef.current) positionPanelRef.current.scrollTop = scroll.positionPanel;
    });
  }, [requestsLoading, postsLoading, selectedRequestId, selectedPostIds, requestLayout]);

  const selectedPostIdsKey = useMemo(
    () => [...selectedPostIds].sort().join(','),
    [selectedPostIds]
  );

  useEffect(() => {
    if (selectedPostIds.size === 0 || postsLoading) return;

    if (restorePostSelectionPendingRef.current) {
      if (posts.length === 0) return;
      restorePostSelectionPendingRef.current = false;
      return;
    }

    if (posts.length === 0) return;

    const validIds = new Set(
      posts.map((p) => p.postId).filter((id): id is string => Boolean(id))
    );
    const staleIds = [...selectedPostIds].filter((id) => !validIds.has(id));
    if (staleIds.length === 0) return;

    setSelectedPostIds((prev) => {
      const next = new Set(prev);
      for (const id of staleIds) next.delete(id);
      return next;
    });
    setActivePostId((current) => {
      if (current && validIds.has(current)) return current;
      const remaining = [...selectedPostIds].filter(
        (id) => validIds.has(id) && !staleIds.includes(id)
      );
      return remaining[remaining.length - 1] ?? null;
    });
  }, [posts, selectedPostIds, postsLoading]);

  const selectedPosts = useMemo(
    () => posts.filter((p) => p.postId && selectedPostIds.has(p.postId)),
    [posts, selectedPostIds]
  );

  const selectedPost = useMemo(
    () => selectedPosts.find((p) => p.postId === activePostId) ?? selectedPosts[0] ?? null,
    [selectedPosts, activePostId]
  );

  const hasSelectedPosts = selectedPostIds.size > 0;

  useEffect(() => {
    setCollapsedPositionPostIds((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set([...prev].filter((id) => selectedPostIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
    setPositionsPagingByPostId((prev) => {
      const keys = Object.keys(prev);
      if (keys.length === 0) return prev;
      let changed = false;
      const next: Record<string, PositionsPaging> = {};
      for (const id of keys) {
        if (selectedPostIds.has(id)) next[id] = prev[id];
        else changed = true;
      }
      return changed ? next : prev;
    });
    setViewHistoryByPostId((prev) => {
      const keys = Object.keys(prev);
      if (keys.length === 0) return prev;
      let changed = false;
      const next: Record<string, boolean> = {};
      for (const id of keys) {
        if (selectedPostIds.has(id)) next[id] = prev[id];
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [selectedPostIdsKey, selectedPostIds]);

  const togglePositionPostCollapsed = useCallback((postId: string) => {
    if (!postId) return;
    setCollapsedPositionPostIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  }, []);

  const positionDateRange = useMemo(() => {
    const start = filterStartDate.trim();
    const end = filterEndDate.trim();
    if (!start || !end) return {};
    return { startDate: start, endDate: end };
  }, [filterStartDate, filterEndDate]);

  const requestStatusValues = useMemo(
    () => requestStatuses.map((status) => Number(status)),
    [requestStatuses]
  );

  const buildPositionFetchFilters = useCallback(
    (
      postId: string,
      selectedDates: string[],
      paging?: PositionsPaging,
      options?: { isViewHistory?: boolean }
    ): RequestPostPositionsFilter => {
      const page = paging?.page ?? DEFAULT_POSITIONS_PAGING.page;
      const pageSize = paging?.pageSize ?? DEFAULT_POSITIONS_PAGING.pageSize;
      const isViewHistory = options?.isViewHistory ?? viewHistoryByPostId[postId] ?? false;

      return {
        postId,
        ...(positionDateRange.startDate && positionDateRange.endDate
          ? {
              startDate: positionDateRange.startDate,
              endDate: positionDateRange.endDate,
            }
          : {}),
        ...(selectedDates.length > 0 ? { dates: [...selectedDates].sort() } : {}),
        isViewHistory,
        pageParam: { page, pageSize },
      };
    },
    [positionDateRange, viewHistoryByPostId]
  );

  const reloadPositionsForPost = useCallback(
    (
      postId: string,
      selectedDates: string[],
      paging?: PositionsPaging,
      options?: { isViewHistory?: boolean }
    ) => {
      const effectivePaging =
        paging ?? positionsPagingByPostIdRef.current[postId] ?? DEFAULT_POSITIONS_PAGING;
      dispatch(
        fetchRequestPostPositions(
          buildPositionFetchFilters(postId, selectedDates, effectivePaging, options)
        )
      );
    },
    [buildPositionFetchFilters, dispatch]
  );

  const reloadPositionsForPostRef = useRef(reloadPositionsForPost);
  reloadPositionsForPostRef.current = reloadPositionsForPost;

  const handleTogglePostViewHistory = useCallback(
    (postId: string) => {
      const id = postId.trim();
      if (!id) return;
      const next = !(viewHistoryByPostId[id] ?? false);
      setViewHistoryByPostId((prev) => ({ ...prev, [id]: next }));
      reloadPositionsForPost(id, postFilterDatesByPostIdRef.current[id] ?? [], undefined, {
        isViewHistory: next,
      });
    },
    [reloadPositionsForPost, viewHistoryByPostId]
  );

  const reloadPositionsForSelection = useCallback(
    (postId: string) => {
      reloadPositionsForPost(postId, postFilterDatesByPostId[postId] ?? []);
    },
    [postFilterDatesByPostId, reloadPositionsForPost]
  );

  /** Mutation-driven refresh: only call APIs for domains that actually changed. */
  const refreshWorkspace = useCallback(
    (domains: WorkspaceRefreshDomain[], scope?: WorkspaceRefreshScope) => {
      runWorkspaceRefresh(
        domains,
        {
          reloadRequests: reloadRequesterRequests,
          reloadPosts: reloadRequestPosts,
          reloadPositionsForPost: reloadPositionsForSelection,
          getSelectedPostIds: () => [...selectedPostIds],
        },
        scope
      );
    },
    [
      reloadRequesterRequests,
      reloadRequestPosts,
      reloadPositionsForSelection,
      selectedPostIds,
    ]
  );

  /** Select every available assignment date returned for the current Start/End filter window. */
  const resolveDefaultPositionDatesFromApi = useCallback((apiDates: string[]): string[] => {
    const start = positionDateRange.startDate;
    const end = positionDateRange.endDate;
    const unique = [...new Set(apiDates.map((d) => String(d).trim()).filter(Boolean))].sort();
    if (!start || !end) return unique;
    return unique.filter((d) => d >= start && d <= end);
  }, [positionDateRange.startDate, positionDateRange.endDate]);

  const initializePostDates = useCallback(
    async (postId: string) => {
      try {
        const result = await dispatch(
          fetchRequestPostPositions(buildPositionFetchFilters(postId, []))
        ).unwrap();
        const apiDates = result.data.dates ?? [];
        const defaultDates = resolveDefaultPositionDatesFromApi(apiDates);
        setPostFilterDatesByPostId((prev) => ({ ...prev, [postId]: defaultDates }));
        reloadPositionsForPost(postId, defaultDates);
      } catch (error) {
        console.error(`Failed to initialize dates for post ${postId}`, error);
        setPostFilterDatesByPostId((prev) => ({ ...prev, [postId]: [] }));
        reloadPositionsForPost(postId, []);
      }
    },
    [buildPositionFetchFilters, dispatch, reloadPositionsForPost, resolveDefaultPositionDatesFromApi]
  );

  const ensurePostCollectDates = useCallback(
    (postId: string) => {
      if (
        requestPostPositionDatesByPostId[postId] !== undefined ||
        requestPostPositionsLoadingByPostId[postId] === true
      ) {
        return;
      }
      reloadPositionsForPost(postId, postFilterDatesByPostId[postId] ?? []);
    },
    [
      postFilterDatesByPostId,
      reloadPositionsForPost,
      requestPostPositionDatesByPostId,
      requestPostPositionsLoadingByPostId,
    ]
  );

  const selectPostFilterDates = useCallback(
    (postId: string, dates: string[]) => {
      const sorted = [...dates].sort();
      const resetPaging = {
        ...(positionsPagingByPostId[postId] ?? DEFAULT_POSITIONS_PAGING),
        page: 1,
      };
      setPostFilterDatesByPostId((prev) => ({ ...prev, [postId]: sorted }));
      setPositionsPagingByPostId((prev) => ({ ...prev, [postId]: resetPaging }));
      reloadPositionsForPost(postId, sorted, resetPaging);
    },
    [positionsPagingByPostId, reloadPositionsForPost]
  );

  const togglePostFilterDate = useCallback(
    (postId: string, date: string) => {
      setPostFilterDatesByPostId((prev) => {
        const current = prev[postId] ?? [];
        const next = current.includes(date)
          ? current.filter((value) => value !== date)
          : [...current, date].sort();
        const resetPaging = {
          ...(positionsPagingByPostId[postId] ?? DEFAULT_POSITIONS_PAGING),
          page: 1,
        };
        setPositionsPagingByPostId((pagingPrev) => ({ ...pagingPrev, [postId]: resetPaging }));
        reloadPositionsForPost(postId, next, resetPaging);
        return { ...prev, [postId]: next };
      });
    },
    [positionsPagingByPostId, reloadPositionsForPost]
  );

  const isPostDatesCalendarOpen = Boolean(
    postDatesCalendarAnchor &&
      selectedPostIds.has(postDatesCalendarAnchor.postId) &&
      postDatesCalendarAnchor.el.isConnected
  );

  useEffect(() => {
    if (postDatesCalendarAnchor && !isPostDatesCalendarOpen) {
      setPostDatesCalendarAnchor(null);
    }
  }, [postDatesCalendarAnchor, isPostDatesCalendarOpen]);

  const handleRosterCallSignUpdated = useCallback(
    (postId: string) => {
      const id = postId?.trim();
      if (!id || !selectedPostIds.has(id)) return;
      refreshWorkspace(['postPosition'], { postIds: [id] });
    },
    [refreshWorkspace, selectedPostIds]
  );

  const prevSelectedPostIdsKeyRef = useRef(selectedPostIdsKey);
  const positionFilterKey = `${positionDateRange.startDate ?? ''}|${positionDateRange.endDate ?? ''}|${requestStatusValues.join(',')}`;
  const prevPositionFilterKeyRef = useRef(positionFilterKey);

  useEffect(() => {
    if (selectedPostIds.size === 0) return;

    const selectionChanged = prevSelectedPostIdsKeyRef.current !== selectedPostIdsKey;
    prevSelectedPostIdsKeyRef.current = selectedPostIdsKey;
    const filterChanged = prevPositionFilterKeyRef.current !== positionFilterKey;
    prevPositionFilterKeyRef.current = positionFilterKey;

    for (const postId of selectedPostIds) {
      const selectedDates = postFilterDatesByPostIdRef.current[postId] ?? [];
      if (selectionChanged || filterChanged) {
        const resetPaging = {
          ...(positionsPagingByPostIdRef.current[postId] ?? DEFAULT_POSITIONS_PAGING),
          page: 1,
        };
        setPositionsPagingByPostId((prev) => ({
          ...prev,
          [postId]: resetPaging,
        }));
        postDatesInitializedRef.current.add(postId);
        if (filterChanged) {
          // Top Start/End (or status) changed — re-select every available date in that window.
          void initializePostDates(postId);
        } else if (selectedDates.length > 0) {
          // Only the selected post changed — keep existing Position Dates picks.
          reloadPositionsForPostRef.current(postId, selectedDates, resetPaging);
        } else {
          void initializePostDates(postId);
        }
        continue;
      }

      if (!postDatesInitializedRef.current.has(postId)) {
        postDatesInitializedRef.current.add(postId);
        if (selectedDates.length > 0) {
          reloadPositionsForPostRef.current(postId, selectedDates);
        } else {
          void initializePostDates(postId);
        }
        continue;
      }
    }

    for (const postId of [...postDatesInitializedRef.current]) {
      if (!selectedPostIds.has(postId)) {
        postDatesInitializedRef.current.delete(postId);
      }
    }
  }, [
    selectedPostIdsKey,
    positionFilterKey,
    initializePostDates,
    selectedPostIds,
  ]);

  const totalPositionsCount = useMemo(() => {
    let sum = 0;
    for (const postId of selectedPostIds) {
      sum +=
        requestPostPositionsTotalByPostId[postId] ??
        requestPostPositionsByPostId[postId]?.length ??
        0;
    }
    return sum;
  }, [selectedPostIds, requestPostPositionsTotalByPostId, requestPostPositionsByPostId]);

  const positionsBySelectedPost = useMemo(() => {
    const ordered = [...selectedPosts];
    if (activePostId) {
      ordered.sort((a, b) => {
        if (a.postId === activePostId) return -1;
        if (b.postId === activePostId) return 1;
        return 0;
      });
    }
    return ordered.map((post) => {
      const postId = post.postId ?? '';
      const rows = requestPostPositionsByPostId[postId] || [];
      const totalRecords = requestPostPositionsTotalByPostId[postId] ?? rows.length;
      return { post, rows, totalRecords };
    });
  }, [
    selectedPosts,
    requestPostPositionsByPostId,
    requestPostPositionsTotalByPostId,
    activePostId,
  ]);

  const loadingCalendarDatesByPostId = useMemo(() => {
    const loading: Record<string, boolean> = {};
    for (const postId of selectedPostIds) {
      loading[postId] =
        requestPostPositionsLoadingByPostId[postId] === true &&
        requestPostPositionDatesByPostId[postId] === undefined;
    }
    return loading;
  }, [
    selectedPostIds,
    requestPostPositionsLoadingByPostId,
    requestPostPositionDatesByPostId,
  ]);

  const totalPosts = requesterPostsTotalCount;
  const totalRequests = requesterRequestsTotalCount;

  const filteredRequesterRequests = useMemo(() => {
    const q = debouncedRequestSearch.trim().toLowerCase();
    if (!q) return requesterRequests;
    return requesterRequests.filter((request) => {
      const title = (request.name || '').toLowerCase();
      const project = (request.projectNumber || '').toLowerCase();
      const id = (request.requestId || '').toLowerCase();
      return title.includes(q) || project.includes(q) || id.includes(q);
    });
  }, [requesterRequests, debouncedRequestSearch]);

  const requesterName =
    searchParams.get('requesterName')?.trim() ||
    (location.state as { requesterName?: string } | null)?.requesterName?.trim() ||
    DAILY_WORKSPACE.LIST_TITLE;

  const handleClearFilters = useCallback(() => {
    clearAllFilters();
  }, [clearAllFilters]);

  const handleFileUpload = async (request: RequestInRequesterListDto, files: File[]) => {
    if (files.length === 0) return;
    if (!requesterId) {
      dispatch(showToast(DAILY_WORKSPACE.TOAST.UPLOAD_REQUESTER_MISSING, 'error'));
      return;
    }
    try {
      await fileUpload(requesterId, request.requestId, files);
      dispatch(
        showToast(
          DAILY_WORKSPACE.TOAST.UPLOAD_SUCCESS.replace('{count}', String(files.length)).replace(
            '{requestId}',
            request.requestId
          ),
          'success'
        )
      );
      const updated = await getFilesOrFile(requesterId, request.requestId);
      setUploadModalExistingFiles(updated ?? []);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : DAILY_WORKSPACE.TOAST.UPLOAD_FAILED;
      dispatch(showToast(message, 'error'));
    }
  };

  const enableAttachFilesToRequests = departmentConfig?.enableAttachFilesToRequests ?? false;

  const requestMenuVehicleEquipment = useMemo(() => {
    if (!requestMenu) {
      return { showVehicle: false, showEquipment: false };
    }
    const requestId = requestMenu.request.requestId;
    const cached = requestVehicleEquipmentById[requestId];
    return {
      showVehicle: Boolean(cached?.requiresVehicle),
      showEquipment: Boolean(cached?.requiresEquipment),
    };
  }, [requestMenu, requestVehicleEquipmentById]);

  const postMenuVehicleEquipment = useMemo(() => {
    if (!postMenu?.post.postId) {
      return { showVehicle: false, showEquipment: false };
    }
    const postId = postMenu.post.postId;
    const cached = postVehicleEquipmentById[postId];
    return {
      showVehicle: Boolean(cached?.postRequiresVehicle),
      showEquipment: Boolean(cached?.postRequiresEquipment),
    };
  }, [postMenu, postVehicleEquipmentById]);

  useEffect(() => {
    if (!requestMenu?.request.requestId) return;
    const requestId = requestMenu.request.requestId;
    if (requestVehicleEquipmentById[requestId]) return;
    void dispatch(fetchRequestById({ requestId, silent: true }))
      .unwrap()
      .then((detail) => {
        setRequestVehicleEquipmentById((prev) => ({
          ...prev,
          [requestId]: {
            requiresVehicle: Boolean(detail.requiresVehicle),
            requiresEquipment: Boolean(detail.requiresEquipment),
          },
        }));
      })
      .catch(() => undefined);
  }, [dispatch, requestMenu, requestVehicleEquipmentById]);

  useEffect(() => {
    const postId = postMenu?.post.postId?.trim();
    if (!postId) return;
    if (postVehicleEquipmentById[postId]) return;
    void dispatch(fetchPostById({ postId, silent: true }))
      .unwrap()
      .then((detail) => {
        setPostVehicleEquipmentById((prev) => ({
          ...prev,
          [postId]: {
            postRequiresVehicle: Boolean(detail.postRequiresVehicle),
            postRequiresEquipment: Boolean(detail.postRequiresEquipment),
          },
        }));
      })
      .catch(() => undefined);
  }, [dispatch, postMenu, postVehicleEquipmentById]);

  const handleUnassign = (row: PostPositionInRequestListDto, postId: string) => {
    setUnassigningPosition({ row, postId });
  };

  const handleConfirmUnassign = useCallback(async () => {
    if (!unassigningPosition || isUnassignLoading) return;
    const { row, postId } = unassigningPosition;
    const isApproveCancellation = row.status === PostPositionStatus.CancellationPending;
    setIsUnassignLoading(true);
    try {
      await dispatch(
        cancelPostPositionThunk({
          postPositionId: row.postPositionId,
          cancellationReason: isApproveCancellation
            ? null
            : DAILY_WORKSPACE.UNASSIGN_REASON,
          isApproveCancellation,
          skipAssignedListRefresh: true,
        })
      ).unwrap();
      if (postId && selectedPostIds.has(postId)) {
        refreshWorkspace(['postPosition'], { postIds: [postId] });
      }
      setUnassigningPosition(null);
    } catch {
      /* toast from slice */
    } finally {
      setIsUnassignLoading(false);
    }
  }, [dispatch, isUnassignLoading, refreshWorkspace, selectedPostIds, unassigningPosition]);

  const handleConfirmDelete = useCallback(async () => {
    setIsDeleteLoading(true);
    try {
      if (deletingPost?.postId) {
        const deletedPostId = deletingPost.postId;
        await dispatch(deletePostThunk(deletedPostId)).unwrap();
        dispatch(clearRequestPostPositionsForPost(deletedPostId));
        setSelectedPostIds((prev) => {
          if (!prev.has(deletedPostId)) return prev;
          const next = new Set(prev);
          next.delete(deletedPostId);
          return next;
        });
        postDatesInitializedRef.current.delete(deletedPostId);
        if (selectedRequestId) {
          refreshWorkspace(['post']);
        }
        setDeletingPost(null);
      } else if (deletingRequest) {
        await dispatch(deleteRequestThunk(deletingRequest.requestId)).unwrap();
        clearPostSelection();
        refreshWorkspace(['request']);
        setDeletingRequest(null);
      }
    } catch {
      /* toast from slice */
    } finally {
      setIsDeleteLoading(false);
    }
  }, [
    clearPostSelection,
    deletingPost,
    deletingRequest,
    dispatch,
    refreshWorkspace,
    selectedRequestId,
  ]);

  const handleCloneConfirm = useCallback(async () => {
    setIsCloneLoading(true);
    try {
      if (pendingClonePost?.postId) {
        const cloned = await dispatch(clonePostThunk(pendingClonePost.postId)).unwrap();
        if (cloned?.postId && selectedRequestId) {
          navigateWithSave(`/personnel/job/${selectedRequestId}/${cloned.postId}?mode=edit`, {
            state: { returnPath, isCloned: true },
          });
        }
        if (selectedRequestId) {
          refreshWorkspace(['post']);
        }
        setPendingClonePost(null);
      } else if (pendingCloneRequest) {
        const cloned = await dispatch(cloneRequestThunk(pendingCloneRequest.requestId)).unwrap();
        if (cloned?.requestID) {
          navigateWithSave(`/personnel/request/edit/${cloned.requestID}`, {
            state: { returnPath, isCloned: true },
          });
        }
        refreshWorkspace(['request']);
        setPendingCloneRequest(null);
      }
    } catch {
      /* toast from slice */
    } finally {
      setIsCloneLoading(false);
    }
  }, [
    dispatch,
    navigateWithSave,
    pendingClonePost,
    pendingCloneRequest,
    refreshWorkspace,
    returnPath,
    selectedRequestId,
  ]);

  const workspaceStage: 'requests' | 'posts' | 'positions' = !selectedRequestId
    ? 'requests'
    : !hasSelectedPosts
      ? 'posts'
      : 'positions';

  useEffect(() => {
    if (workspaceStage === 'requests') {
      setRequestsCollapsed(false);
      setPostsCollapsed(false);
    }
  }, [workspaceStage]);

  const bodyLayoutClass = [
    `daily-workspace__body--stage-${workspaceStage}`,
    workspaceStage === 'requests' && requestLayout === 'list'
      ? 'daily-workspace__body--requests-list'
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  const requestCardActions = useMemo<WorkspaceRequestCardActions>(
    () => ({
      onClone: (request) => {
        setPendingCloneRequest(request);
      },
      onEdit: (request) => {
        navigateWithSave(`/personnel/request/edit/${request.requestId}`, {
          state: { returnPath },
        });
      },
      onSchedule: openRequestSchedule,
      onInvoice: (request) => {
        void openRequestInvoice(request);
      },
      onDelete: (request) => {
        setDeletingRequest(request);
      },
      onMore: (el, request) => setRequestMenu({ el, request }),
      onProjectClick: (request) => {
        navigateWithSave(INVOICE_GRID.INVOICE_LIST_PATH, {
          state: {
            request: {
              requestID: request.requestId,
              title: request.name,
              projectNumber: request.projectNumber,
            },
            returnTab: 'daily',
            returnPath,
          },
        });
      },
    }),
    [openRequestInvoice, navigateWithSave, returnPath, requesterId, openRequestSchedule]
  );

  const postTreeActions = useMemo<PostTreeActions>(
    () => ({
      onClone: (post) => {
        if (!post.postId) return;
        setPendingClonePost(post);
      },
      onEdit: (post) => {
        if (!post.postId || !selectedRequestId) return;
        navigateWithSave(`/personnel/job/${selectedRequestId}/${post.postId}?mode=edit`, {
          state: { returnPath },
        });
      },
      onDelete: (post) => {
        if (!post.postId) return;
        setDeletingPost(post);
      },
      onMore: (el, post) => setPostMenu({ el, post }),
    }),
    [navigateWithSave, returnPath, selectedRequestId]
  );

  const unassignEmployeeName = unassigningPosition?.row.employeeName?.trim() || '—';
  const isApproveCancellationAction =
    unassigningPosition?.row.status === PostPositionStatus.CancellationPending;

  const requestListLayout =
    workspaceStage === 'requests' && requestLayout === 'list' ? 'list' : 'grid';

  return (
    <SMSBox className="daily-workspace">
      <SMSBox className="daily-workspace__top">
        <SMSBox className="daily-workspace__summary">
          <SMSBox className="daily-workspace__summary-identity">
            <SMSBox className="daily-workspace__title-row">
              <h1 className="daily-workspace__title">{requesterName}</h1>
            </SMSBox>
          </SMSBox>

          <SMSBox className="daily-workspace__summary-aside">
            <SMSBox className="daily-workspace__counts" aria-label="Summary counts">
              <div className="daily-workspace__stat">
                <span className="daily-workspace__stat-label">{DAILY_WORKSPACE.REQUESTS_PANEL}</span>
                <span className="daily-workspace__stat-value">{totalRequests}</span>
              </div>
              <div className="daily-workspace__stat">
                <span className="daily-workspace__stat-label">{DAILY_WORKSPACE.POSTS_PANEL}</span>
                <span className="daily-workspace__stat-value">{totalPosts}</span>
              </div>
            </SMSBox>
            <span className="daily-workspace__summary-divider" aria-hidden="true" />
            <SMSBox className="daily-workspace__toolbar" role="group" aria-label="Requester actions">
              <SMSButton
                size="small"
                onClick={() =>
                  navigateWithSave(`/personnel/request/add/${requesterId}`, { state: { returnPath } })
                }
              >
                {DAILY_WORKSPACE.ACTIONS.CREATE_REQUEST}
              </SMSButton>
              <SMSBox className="daily-workspace__icon-group">
                <WorkspaceIconButton
                  allowWhenSuspended
                  title={DAILY_WORKSPACE.ACTIONS.VIEW_REQUESTER}
                  onClick={() =>
                    navigateWithSave(`/personnel/requester/view/${requesterId}`, { state: { returnPath } })
                  }
                >
                  <SMSIcon name="visibility" size="sm" />
                </WorkspaceIconButton>
                <WorkspaceIconButton
                  title={DAILY_WORKSPACE.ACTIONS.EDIT_REQUESTER}
                  onClick={() =>
                    navigateWithSave(`/personnel/requester/edit/${requesterId}`, { state: { returnPath } })
                  }
                >
                  <SMSIcon name="edit" size="sm" />
                </WorkspaceIconButton>
                <WorkspaceIconButton
                  title={DAILY_WORKSPACE.ACTIONS.INVOICE}
                  onClick={() =>
                    navigateWithSave('/admin/requester-invoice', {
                      state: { requesterId, returnPath, returnTab: 'daily' },
                    })
                  }
                >
                  <SMSIcon name="receipt_long" size="sm" />
                </WorkspaceIconButton>
                <WorkspaceIconButton
                  title={
                    requesterHasUnpaidInvoice
                      ? INVOICE_GRID.GROUPED.UNPAID_INVOICE_TOOLTIP
                      : REQUESTER_GRID_MENU.PAYMENT
                  }
                  tone={requesterHasUnpaidInvoice ? 'error' : 'positive'}
                  onClick={() =>
                    navigateWithSave('/admin/requester-payment', {
                      state: { requesterId, returnPath },
                    })
                  }
                >
                  <SMSIcon name="money" size="sm" />
                </WorkspaceIconButton>
              </SMSBox>
            </SMSBox>
          </SMSBox>
        </SMSBox>

        <SMSBox className="daily-workspace__filters-wrap is-expanded">
          <SMSBox className="daily-workspace__filters">
            <SMSBox className="daily-workspace__filter-segment daily-workspace__filter-dates">
              <SMSDatePicker
                label={DAILY_WORKSPACE.FILTERS.START_DATE}
                id="dw-filter-start"
                value={filterStartDate}
                onChange={setFilterStartDate}
              />
              <SMSDatePicker
                label={DAILY_WORKSPACE.FILTERS.END_DATE}
                id="dw-filter-end"
                value={filterEndDate}
                onChange={setFilterEndDate}
              />
            </SMSBox>

            <span className="daily-workspace__filter-divider" aria-hidden="true" />

            <WorkspaceFilterChips
              variant="page"
              layout="inline"
              requestStatuses={requestStatuses}
              requestTypes={requestTypes}
              onToggleStatus={toggleStatus}
              onToggleType={toggleType}
            />

            {activeFilterCount > 0 && (
              <SMSIconButton
                type="button"
                className="daily-workspace__filter-clear"
                onClick={handleClearFilters}
                aria-label={DAILY_WORKSPACE.FILTERS.CLEAR_FILTERS}
                title={DAILY_WORKSPACE.FILTERS.CLEAR_FILTERS}
              >
                <SMSIcon name="filter_alt_off" size="sm" />
              </SMSIconButton>
            )}
          </SMSBox>
        </SMSBox>
      </SMSBox>

      <SMSBox className={`daily-workspace__body ${bodyLayoutClass}`}>
        <aside
          className={`daily-workspace__panel daily-workspace__panel--requests${requestsCollapsed ? ' is-collapsed' : ''}`}
        >
          <WorkspacePanelHeader
            title={DAILY_WORKSPACE.REQUESTS_PANEL}
            count={
              debouncedRequestSearch.trim()
                ? filteredRequesterRequests.length
                : requesterRequestsTotalCount
            }
            collapsed={requestsCollapsed}
            collapsible={true}
            onToggleCollapse={() => setRequestsCollapsed((v) => !v)}
            tools={
              workspaceStage === 'requests' ? (
                <button
                  type="button"
                  className="daily-workspace__layout-toggle-btn"
                  aria-pressed={requestLayout === 'list'}
                  aria-label={
                    requestLayout === 'grid'
                      ? DAILY_WORKSPACE.REQUEST_LAYOUT.GRID
                      : DAILY_WORKSPACE.REQUEST_LAYOUT.LIST
                  }
                  title={
                    requestLayout === 'grid'
                      ? DAILY_WORKSPACE.REQUEST_LAYOUT.LIST
                      : DAILY_WORKSPACE.REQUEST_LAYOUT.GRID
                  }
                  onClick={() =>
                    setRequestLayout((layout) => (layout === 'grid' ? 'list' : 'grid'))
                  }
                >
                  <SMSIcon
                    name={requestLayout === 'grid' ? 'grid_view' : 'view_list'}
                    size="sm"
                  />
                  <span>
                    {requestLayout === 'grid'
                      ? DAILY_WORKSPACE.REQUEST_LAYOUT.GRID
                      : DAILY_WORKSPACE.REQUEST_LAYOUT.LIST}
                  </span>
                </button>
              ) : undefined
            }
          />
          {!requestsCollapsed && (
            <>
              <SMSBox className="daily-workspace__panel-search">
                <SMSTextField
                  id="dw-request-search"
                  placeholder={DAILY_WORKSPACE.FILTERS.SEARCH_REQUEST_PLACEHOLDER}
                  value={requestSearch}
                  onChange={(e) => setRequestSearch(e.target.value)}
                  fullWidth
                  size="small"
                />
              </SMSBox>
              <SMSBox
                className="daily-workspace__panel-body"
                ref={requestPanelRef}
                onScroll={requestListLayout === 'grid' ? handleRequestsScroll : undefined}
              >
                {requestsLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={`req-${i}`} variant="rounded" height={96} sx={{ mb: 1 }} />
                  ))
                ) : filteredRequesterRequests.length === 0 &&
                  activeFilterCount === 0 &&
                  !requestSearch.trim() ? (
                  <SMSBox className="daily-workspace__empty">{DAILY_WORKSPACE.NO_REQUESTS}</SMSBox>
                ) : filteredRequesterRequests.length === 0 ? (
                  <SMSBox className="daily-workspace__empty">
                    {DAILY_WORKSPACE.NO_REQUESTS_FILTERED}
                  </SMSBox>
                ) : (
                  <>
                    {requestListLayout === 'list' && (
                      <div className="daily-workspace__request-list-header" aria-hidden="true">
                        <span>{DAILY_WORKSPACE.REQUEST_LIST_COLUMNS.PROJECT}</span>
                        <span>{DAILY_WORKSPACE.REQUEST_LIST_COLUMNS.REQUEST}</span>
                        <span>{DAILY_WORKSPACE.REQUEST_LIST_COLUMNS.DATES}</span>
                        <span>{DAILY_WORKSPACE.REQUEST_LIST_COLUMNS.STATUS}</span>
                        <span>{DAILY_WORKSPACE.REQUEST_LIST_COLUMNS.POSTS}</span>
                        <span>{DAILY_WORKSPACE.REQUEST_LIST_COLUMNS.SCHEDULE}</span>
                        <span>{DAILY_WORKSPACE.REQUEST_LIST_COLUMNS.ACTIONS}</span>
                      </div>
                    )}
                    <SMSBox
                      className={
                        requestListLayout === 'list'
                          ? 'daily-workspace__request-list-scroll'
                          : undefined
                      }
                      ref={requestListLayout === 'list' ? requestListScrollRef : undefined}
                      onScroll={requestListLayout === 'list' ? handleRequestsScroll : undefined}
                    >
                      <SMSBox className="daily-workspace__card-list">
                        {filteredRequesterRequests.map((request) => (
                          <WorkspaceRequestCard
                            key={request.requestId}
                            request={request}
                            selected={request.requestId === selectedRequestId}
                            layout={requestListLayout}
                            onSelect={setSelectedRequestId}
                            actions={requestCardActions}
                          />
                        ))}
                        {requesterRequestsHasMore && <div ref={requestSentinelRef} />}
                        {requesterRequestsLoadingMore && (
                          <Skeleton variant="rounded" height={72} />
                        )}
                      </SMSBox>
                    </SMSBox>
                  </>
                )}
              </SMSBox>
            </>
          )}
        </aside>

        {selectedRequestId && (
          <section
            className={`daily-workspace__panel daily-workspace__panel--posts${postsCollapsed ? ' is-collapsed' : ''}`}
          >
            <WorkspacePanelHeader
              title={DAILY_WORKSPACE.POSTS_PANEL}
              count={requestPostsTotalCount}
              collapsed={postsCollapsed}
              onToggleCollapse={() => setPostsCollapsed((v) => !v)}
              tools={
                <WorkspaceIconButton
                  allowWhenSuspended
                  title={DAILY_WORKSPACE.CLOSE_PANEL}
                  onClick={() => {
                    setSelectedRequestId(null);
                    clearPostSelection();
                  }}
                >
                  <SMSIcon name="close" size="sm" />
                </WorkspaceIconButton>
              }
            />
            {!postsCollapsed && (
              <>
                <SMSBox className="daily-workspace__panel-search">
                  <SMSTextField
                    id="dw-post-search"
                    placeholder={DAILY_WORKSPACE.FILTERS.SEARCH_POST_PLACEHOLDER}
                    value={postSearch}
                    onChange={(e) => setPostSearch(e.target.value)}
                    fullWidth
                    size="small"
                  />
                </SMSBox>
                <SMSBox
                  className="daily-workspace__panel-body"
                  ref={postPanelRef}
                  onScroll={handlePostsScroll}
                >
                  {postsLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton
                        key={`post-${i}`}
                        variant="rounded"
                        height={80}
                        sx={{ mb: 1.25 }}
                      />
                    ))
                  ) : posts.length === 0 && !postSearch.trim() ? (
                    <SMSBox className="daily-workspace__empty">{DAILY_WORKSPACE.NO_POSTS}</SMSBox>
                  ) : posts.length === 0 ? (
                    <SMSBox className="daily-workspace__empty">
                      {DAILY_WORKSPACE.NO_POSTS_FILTERED}
                    </SMSBox>
                  ) : (
                    <>
                      {!hasSelectedPosts && (
                        <SMSBox className="daily-workspace__hint">
                          {DAILY_WORKSPACE.SELECT_POST_HINT}
                        </SMSBox>
                      )}
                      <PostTree
                        posts={posts}
                        selectedPostIds={selectedPostIds}
                        onSelect={togglePostSelection}
                        getTimeLabel={getPostTimeLabel}
                        actions={postTreeActions}
                        actionsPlacement={
                          hasSelectedPosts && !positionsCollapsed ? 'footer' : 'header'
                        }
                      />
                    </>
                  )}
                </SMSBox>
              </>
            )}
          </section>
        )}

        {hasSelectedPosts && (
          <section
            className={`daily-workspace__panel daily-workspace__panel--positions${positionsCollapsed ? ' is-collapsed' : ''}`}
          >
            <WorkspacePanelHeader
              title={DAILY_WORKSPACE.POSITIONS_PANEL}
              count={totalPositionsCount}
              collapsed={positionsCollapsed}
              onToggleCollapse={() => setPositionsCollapsed((v) => !v)}
              tools={
                <WorkspaceIconButton
                  allowWhenSuspended
                  title={DAILY_WORKSPACE.CLOSE_PANEL}
                  onClick={() => clearPostSelection()}
                >
                  <SMSIcon name="close" size="sm" />
                </WorkspaceIconButton>
              }
            />
            {!positionsCollapsed && (
              <SMSBox className="daily-workspace__panel-body daily-workspace__panel-body--positions" ref={positionPanelRef}>
                <WorkspacePositionsPanel
                  groups={positionsBySelectedPost}
                  loadingByPostId={requestPostPositionsLoadingByPostId}
                  collapsedPostIds={collapsedPositionPostIds}
                  pagingByPostId={positionsPagingByPostId}
                  defaultPaging={DEFAULT_POSITIONS_PAGING}
                  postFilterDatesByPostId={postFilterDatesByPostId}
                  loadingPostCollectDatesByPost={loadingCalendarDatesByPostId}
                  onEnsurePostCollectDates={ensurePostCollectDates}
                  onOpenPostDateCalendar={(postId, anchorEl) =>
                    setPostDatesCalendarAnchor({ postId, el: anchorEl })
                  }
                  onToggleCollapse={togglePositionPostCollapsed}
                  onPageChange={(postId, page) => {
                    const nextPaging = {
                      ...(positionsPagingByPostId[postId] ?? DEFAULT_POSITIONS_PAGING),
                      page,
                    };
                    setPositionsPagingByPostId((prev) => ({
                      ...prev,
                      [postId]: nextPaging,
                    }));
                    reloadPositionsForPost(
                      postId,
                      postFilterDatesByPostId[postId] ?? [],
                      nextPaging
                    );
                  }}
                  onPageSizeChange={(postId, pageSize) => {
                    const nextPaging = { page: 1, pageSize };
                    setPositionsPagingByPostId((prev) => ({
                      ...prev,
                      [postId]: nextPaging,
                    }));
                    reloadPositionsForPost(
                      postId,
                      postFilterDatesByPostId[postId] ?? [],
                      nextPaging
                    );
                  }}
                  onUnassign={handleUnassign}
                  onTransfer={(row, postId) => {
                    setActivePostId(postId);
                    setTransferRow(row);
                    setAssignOpen(true);
                  }}
                  onMore={(el, row, postId) => setPositionMenu({ el, row, postId })}
                  onPositionsRefresh={(postId) =>
                    refreshWorkspace(['postPosition'], { postIds: [postId] })
                  }
                  viewHistoryByPostId={viewHistoryByPostId}
                  onToggleViewHistory={handleTogglePostViewHistory}
                  positionMenuRowId={positionMenu?.row.postPositionId ?? null}
                />
              </SMSBox>
            )}
          </section>
        )}
      </SMSBox>

      <Menu
        anchorEl={requestMenu?.el ?? null}
        open={Boolean(requestMenu)}
        onClose={() => setRequestMenu(null)}
        PaperProps={{ sx: { minWidth: 200 } }}
      >
        <MenuItem
          onClick={() => {
            if (!requestMenu) return;
            requestHistory.open(
              String(requestMenu.request.requestId ?? ''),
              (requestMenu.request.name || '').trim() || requestMenu.request.requestId
            );
            setRequestMenu(null);
          }}
        >
          {DAILY_WORKSPACE.ACTIONS.VIEW_HISTORY}
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (!requestMenu) return;
            openRequestRoster(requestMenu.request);
            setRequestMenu(null);
          }}
        >
          {DAILY_WORKSPACE.ACTIONS.VIEW_ROSTER}
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (!requestMenu) return;
            navigateWithSave(`/personnel/job/create/${requestMenu.request.requestId}`, {
              state: { returnPath },
            });
            setRequestMenu(null);
          }}
        >
          {DAILY_WORKSPACE.CREATE_JOB}
        </MenuItem>
        {requestMenuVehicleEquipment.showVehicle && (
          <MenuItem
            onClick={() => {
              if (!requestMenu) return;
              navigateWithSave(
                `/personnel/request/edit/${requestMenu.request.requestId}?step=2&mode=single`,
                { state: { returnPath } }
              );
              setRequestMenu(null);
            }}
          >
            {DAILY_WORKSPACE.ACTIONS.MANAGE_VEHICLE}
          </MenuItem>
        )}
        {requestMenuVehicleEquipment.showEquipment && (
          <MenuItem
            onClick={() => {
              if (!requestMenu) return;
              navigateWithSave(
                `/personnel/request/edit/${requestMenu.request.requestId}?step=3&mode=single`,
                { state: { returnPath } }
              );
              setRequestMenu(null);
            }}
          >
            {DAILY_WORKSPACE.ACTIONS.MANAGE_EQUIPMENT}
          </MenuItem>
        )}
        {enableAttachFilesToRequests && (
          <MenuItem
            onClick={() => {
              if (!requestMenu) return;
              setUploadModalRequest(requestMenu.request);
              setUploadModalOpen(true);
              setRequestMenu(null);
            }}
          >
            {DAILY_WORKSPACE.ACTIONS.ADD_FILE}
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            if (!requestMenu) return;
            setSendEmailContext({
              requestId: requestMenu.request.requestId,
              attachRequestId: requestMenu.request.requestId,
              requesterId,
            });
            setRequestMenu(null);
          }}
        >
          {DAILY_WORKSPACE.ACTIONS.SEND_EMAIL}
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (!requestMenu) return;
            setNotificationHistoryContext({
              requestId: requestMenu.request.requestId,
              requesterId,
              title: (requestMenu.request.name || '').trim() || requestMenu.request.requestId,
            });
            setRequestMenu(null);
          }}
        >
          {DAILY_WORKSPACE.ACTIONS.NOTIFICATION_HISTORY}
        </MenuItem>
      </Menu>

      <Menu
        anchorEl={postMenu?.el ?? null}
        open={Boolean(postMenu)}
        onClose={() => setPostMenu(null)}
        PaperProps={{ sx: { minWidth: 200 } }}
      >
        <MenuItem
          onClick={() => {
            if (!postMenu?.post.postId) return;
            postHistory.open(
              String(postMenu.post.postId),
              postMenu.post.postTitle?.trim() || String(postMenu.post.postId)
            );
            setPostMenu(null);
          }}
        >
          {DAILY_WORKSPACE.ACTIONS.VIEW_HISTORY}
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (postMenu?.post.postId) {
              const postId = postMenu.post.postId;
              setActivePostId(postId);
              setSelectedPostIds((prev) => {
                if (prev.has(postId)) return prev;
                return new Set(prev).add(postId);
              });
            }
            setAssignOpen(true);
            setTransferRow(null);
            setPostMenu(null);
          }}
        >
          {DAILY_WORKSPACE.ASSIGN_EMPLOYEES}
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (!postMenu?.post.postId) return;
            const date =
              selectedRequest?.startDate?.slice(0, 10) ||
              new Date().toISOString().slice(0, 10);
            navigateWithSave(
              `/personnel/job-position/${postMenu.post.postId}/assignments-waiting-list?dateOfWork=${date}`,
              { state: { returnPath } }
            );
            setPostMenu(null);
          }}
        >
          {DAILY_WORKSPACE.VIEW_JOB_POSITION}
        </MenuItem>
        {postMenuVehicleEquipment.showVehicle && selectedRequestId && (
          <MenuItem
            onClick={() => {
              if (!postMenu?.post.postId || !selectedRequestId) return;
              navigateWithSave(
                `/personnel/job/${selectedRequestId}/${postMenu.post.postId}?mode=edit&step=2`,
                { state: { returnPath } }
              );
              setPostMenu(null);
            }}
          >
            {DAILY_WORKSPACE.ACTIONS.MANAGE_POST_VEHICLE}
          </MenuItem>
        )}
        {postMenuVehicleEquipment.showEquipment && selectedRequestId && (
          <MenuItem
            onClick={() => {
              if (!postMenu?.post.postId || !selectedRequestId) return;
              navigateWithSave(
                `/personnel/job/${selectedRequestId}/${postMenu.post.postId}?mode=edit&step=3`,
                { state: { returnPath } }
              );
              setPostMenu(null);
            }}
          >
            {DAILY_WORKSPACE.ACTIONS.MANAGE_POST_EQUIPMENT}
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            if (!postMenu?.post.postId || !selectedRequestId) return;
            navigateWithSave('/admin/block-date', {
              state: {
                requestId: selectedRequestId,
                postId: postMenu.post.postId,
                returnPath,
              },
            });
            setPostMenu(null);
          }}
        >
          {DAILY_WORKSPACE.ACTIONS.BLOCK_DATES}
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (!postMenu?.post.postId) return;
            setSendEmailContext({
              postId: postMenu.post.postId,
              attachRequestId: selectedRequestId ?? undefined,
              requesterId,
            });
            setPostMenu(null);
          }}
        >
          {DAILY_WORKSPACE.ACTIONS.SEND_EMAIL}
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (!postMenu?.post.postId) return;
            setNotificationHistoryContext({
              postId: postMenu.post.postId,
              requestId: selectedRequestId ?? undefined,
              requesterId,
              title: postMenu.post.postTitle ?? '',
            });
            setPostMenu(null);
          }}
        >
          {DAILY_WORKSPACE.ACTIONS.NOTIFICATION_HISTORY}
        </MenuItem>
      </Menu>

      <Menu
        anchorEl={positionMenu?.el ?? null}
        open={Boolean(positionMenu)}
        onClose={() => setPositionMenu(null)}
        disableScrollLock
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { minWidth: 200 } }}
      >
        <MenuItem
          onClick={() => {
            const postPositionId = positionMenu?.row.postPositionId?.trim();
            if (postPositionId) {
              setSendEmailContext({
                postPositionId,
                attachRequestId: selectedRequest?.requestId ?? selectedRequestId ?? undefined,
                requesterId,
              });
            }
            setPositionMenu(null);
          }}
        >
          {DAILY_WORKSPACE.ACTIONS.SEND_EMAIL}
        </MenuItem>
        <MenuItem
          onClick={() => {
            const row = positionMenu?.row;
            const postPositionId = row?.postPositionId?.trim();
            if (row && postPositionId) {
              setNotificationHistoryContext({
                postPositionId,
                requestId: selectedRequest?.requestId ?? selectedRequestId ?? undefined,
                requesterId,
                title: row.employeeName?.trim() || '—',
              });
            }
            setPositionMenu(null);
          }}
        >
          {DAILY_WORKSPACE.ACTIONS.NOTIFICATION_HISTORY}
        </MenuItem>
      </Menu>

      {selectedPost && selectedRequest && selectedRequestId && (
        <AssignEmployeesModal
          isOpen={assignOpen}
          onClose={() => {
            setAssignOpen(false);
            setTransferRow(null);
          }}
          post={
            (transferRow && activePostId
              ? posts.find((p) => p.postId === activePostId)
              : null) ?? selectedPost
          }
          request={
            selectedRequest
              ? ({
                  requestID: selectedRequest.requestId,
                  startDate: selectedRequest.startDate,
                  endDate: selectedRequest.endDate,
                } as RequestResponse)
              : undefined
          }
          variant={transferRow ? 'transfer' : 'assign'}
          transferSourcePostPosition={transferRow ?? null}
          onAssignSuccess={() => {
            refreshWorkspace(['postPosition']);
            setAssignOpen(false);
            setTransferRow(null);
          }}
        />
      )}

      <SendEmailModal
        isOpen={!!sendEmailContext}
        onClose={() => setSendEmailContext(null)}
        context={sendEmailContext}
      />

      <NotificationHistoryModal
        isOpen={!!notificationHistoryContext}
        onClose={() => setNotificationHistoryContext(null)}
        postPositionId={notificationHistoryContext?.postPositionId}
        postId={notificationHistoryContext?.postId}
        requestId={notificationHistoryContext?.requestId}
        requesterId={notificationHistoryContext?.requesterId}
        title={notificationHistoryContext?.title}
      />

      <SMSAuditHistoryModal
        open={requestHistory.isOpen}
        onClose={requestHistory.close}
        title={requestHistory.modalTitle}
        rows={requestHistory.rows}
        loading={requestHistory.loading}
        emptyMessage={REQUESTER.TABLE.NO_DATA}
        startDate={requestHistory.startDate}
        endDate={requestHistory.endDate}
        onStartDateChange={requestHistory.setStartDate}
        onEndDateChange={requestHistory.setEndDate}
        onApplyFilter={requestHistory.applyFilter}
        pagination={requestHistory.pagination}
      />

      <SMSAuditHistoryModal
        open={postHistory.isOpen}
        onClose={postHistory.close}
        title={postHistory.modalTitle}
        rows={postHistory.rows}
        loading={postHistory.loading}
        emptyMessage={REQUESTER.TABLE.NO_DATA}
        startDate={postHistory.startDate}
        endDate={postHistory.endDate}
        onStartDateChange={postHistory.setStartDate}
        onEndDateChange={postHistory.setEndDate}
        onApplyFilter={postHistory.applyFilter}
        pagination={postHistory.pagination}
      />

      <UploadFileModal
        isOpen={uploadModalOpen}
        onClose={() => {
          setUploadModalOpen(false);
          setUploadModalRequest(null);
          setUploadModalExistingFiles([]);
        }}
        onUpload={(files) => uploadModalRequest && handleFileUpload(uploadModalRequest, files)}
        existingFiles={uploadModalExistingFiles}
        requestID={uploadModalRequest?.requestId ?? undefined}
        requesterID={requesterId || undefined}
        onDeletedFile={
          uploadModalRequest?.requestId && requesterId
            ? () =>
                getFilesOrFile(requesterId, uploadModalRequest.requestId)
                  .then(setUploadModalExistingFiles)
                  .catch(() => setUploadModalExistingFiles([]))
            : undefined
        }
      />

      <RequestScheduleListModal
        isOpen={Boolean(scheduleModalRequest)}
        request={scheduleModalRequest}
        onClose={() => setScheduleModalRequest(null)}
      />

      <InvoicePreviewModal
        isOpen={invoicePreviewOpen}
        request={invoicePreviewRequest ?? undefined}
        paymentReturnPath={returnPath}
        onClose={() => {
          setInvoicePreviewOpen(false);
          setInvoicePreviewRequest(null);
        }}
        onGenerateInvoice={() => {
          setInvoicePreviewOpen(false);
          setInvoicePreviewRequest(null);
        }}
      />

      <SMSRosterModal
        key={rosterModalFromRoute ? `dw-roster-${effectiveRosterRequestId}` : 'dw-roster-modal'}
        isOpen={rosterModalFromRoute}
        onClose={() => {
          navigate(`/personnel/daily-workspace/${requesterId}`, { replace: true });
          setRosterDateOfWork('');
        }}
        requestID={effectiveRosterRequestId}
        dateOfWork={rosterModalDateProp}
        onDateOfWorkChange={rosterModalFromRoute ? syncRosterDateToUrl : undefined}
        onCallSignUpdated={handleRosterCallSignUpdated}
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
            dates={requestPostPositionDatesByPostId[postDatesCalendarAnchor.postId] ?? []}
            selectedDates={postFilterDatesByPostId[postDatesCalendarAnchor.postId] ?? []}
            loading={
              requestPostPositionsLoadingByPostId[postDatesCalendarAnchor.postId] === true &&
              requestPostPositionDatesByPostId[postDatesCalendarAnchor.postId] === undefined
            }
            labels={POSITION_DATE_CALENDAR_LABELS}
            resetClearToDefaultMonth={false}
            onSelectMonthDates={(dates) =>
              selectPostFilterDates(postDatesCalendarAnchor.postId, dates)
            }
            onToggleDate={(date) => togglePostFilterDate(postDatesCalendarAnchor.postId, date)}
            onClear={() => {
              // Reset to every available date in the current top Start/End window.
              const postId = postDatesCalendarAnchor.postId;
              const available = requestPostPositionDatesByPostId[postId] ?? [];
              selectPostFilterDates(postId, resolveDefaultPositionDatesFromApi(available));
            }}
            onClose={() => setPostDatesCalendarAnchor(null)}
          />
        )}
      </Popover>

      <SMSConfirmDialog
        open={Boolean(pendingCloneRequest || pendingClonePost)}
        title={
          pendingClonePost
            ? DAILY_WORKSPACE.CONFIRM.CLONE_POST_TITLE
            : DAILY_WORKSPACE.CONFIRM.CLONE_REQUEST_TITLE
        }
        message={
          pendingClonePost
            ? DAILY_WORKSPACE.CONFIRM.CLONE_POST_MESSAGE.replace(
                '{name}',
                pendingClonePost.postTitle || pendingClonePost.postId || ''
              )
            : pendingCloneRequest
              ? DAILY_WORKSPACE.CONFIRM.CLONE_REQUEST_MESSAGE.replace(
                  '{name}',
                  (pendingCloneRequest.name || '').trim() || pendingCloneRequest.requestId
                )
              : ''
        }
        confirmText={DAILY_WORKSPACE.CONFIRM.CLONE_CONFIRM}
        cancelText={DAILY_WORKSPACE.CONFIRM.CLONE_CANCEL}
        onConfirm={() => {
          void handleCloneConfirm();
        }}
        onClose={() => {
          if (isCloneLoading) return;
          setPendingCloneRequest(null);
          setPendingClonePost(null);
        }}
        variant="warning"
        loading={isCloneLoading}
      />

      <SMSConfirmDialog
        open={Boolean(deletingRequest || deletingPost)}
        title={
          deletingPost
            ? POST_POSITION.MESSAGES.DELETE_POST_TITLE
            : REQUEST_FORM.CONFIRM.DELETE_REQUEST_TITLE
        }
        message={
          deletingPost
            ? POST_POSITION.MESSAGES.DELETE_POST_MESSAGE.replace(
                '{title}',
                deletingPost.postTitle || deletingPost.postId || ''
              )
            : REQUEST_FORM.CONFIRM.DELETE_REQUEST_MESSAGE.replace(
                '{title}',
                deletingRequest
                  ? (deletingRequest.name || '').trim() || deletingRequest.requestId
                  : ''
              )
        }
        confirmText={REQUESTER_GRID_MENU.DELETE_CONFIRM}
        cancelText={REQUESTER_GRID_MENU.DELETE_CANCEL}
        onConfirm={() => {
          void handleConfirmDelete();
        }}
        onClose={() => {
          if (isDeleteLoading) return;
          setDeletingRequest(null);
          setDeletingPost(null);
        }}
        variant="error"
        loading={isDeleteLoading}
      />

      <SMSConfirmDialog
        open={Boolean(unassigningPosition)}
        title={
          isApproveCancellationAction
            ? confirmationModalStrings.APPROVE_CANCELLATION_TITLE
            : confirmationModalStrings.UNASSIGN_TITLE
        }
        message={
          isApproveCancellationAction
            ? confirmationModalStrings.APPROVE_CANCELLATION_MESSAGE.replace(
                '{employeeName}',
                unassignEmployeeName
              )
            : confirmationModalStrings.UNASSIGN_MESSAGE.replace(
                '{employeeName}',
                unassignEmployeeName
              )
        }
        confirmText={
          isApproveCancellationAction
            ? isUnassignLoading
              ? POST_POSITION.ASSIGNMENTS_AND_WAITING.ACTION_CANCELLING
              : POST_POSITION.ASSIGNMENTS_AND_WAITING.ACTION_APPROVE_CANCELLATION
            : POST_POSITION.ASSIGNMENTS_AND_WAITING.ACTION_UNASSIGN
        }
        cancelText={confirmationModalStrings.CANCEL_TEXT}
        onConfirm={() => {
          void handleConfirmUnassign();
        }}
        onClose={() => {
          if (isUnassignLoading) return;
          setUnassigningPosition(null);
        }}
        variant="error"
        loading={isUnassignLoading}
        loadingMessage={
          isApproveCancellationAction
            ? POST_POSITION.ASSIGNMENTS_AND_WAITING.ACTION_CANCELLING
            : undefined
        }
      />
    </SMSBox>
  );
};
