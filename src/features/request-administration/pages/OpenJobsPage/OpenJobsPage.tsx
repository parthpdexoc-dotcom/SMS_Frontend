import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Stack, Typography } from '@mui/material';
import {
  SMSBox,
  SMSButton,
  SMSDatePicker,
  SMSIcon,
  SMSIconButton,
  SMSLoader,
  SMSMultiSelectDropdown,
  SMSPagination,
  SMSStack,
} from '@/components/smsatoms';
import { SMSViewDetailsEquipmentSection } from '@/components/smsmolecules/SMSViewDetailsEquipmentSection/SMSViewDetailsEquipmentSection';
import {
  SMSExpandableGroupList,
  SMSPostInformationModal,
  type DataTableColumn,
  type SMSExpandableGroupHeaderCell,
} from '@/components/smsorganisms';
import {
  ARCHIVED_REPORTS_PAGE,
  AVAILABLE_POST,
  MENU_ITEMS,
  OPEN_JOBS_PAGE,
  POST_POSITION,
  REQUEST,
} from '@/constants/strings';
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants/tablePagination';
import { usePagination } from '@/hooks/usePagination';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchAvailablePostDetails } from '@/store/slices/availablePostSlice';
import { fetchOpenJobsDashboard } from '@/store/slices/openJobsDashboardSlice';
import { showToast } from '@/store/slices/toastSlice';
import { downloadRequestFile } from '@/services/fileUploadService';
import { getPostById } from '@/services/postService';
import { getRequestById } from '@/services/requestService';
import type { PostEquipmentDto } from '@/services/postEquipmentService';
import type { EmployeePostListingItem } from '@/types/employeePostListingItem';
import type { FileUploadDto } from '@/types/fileUpload';
import type { Post } from '@/types/post';
import { ReleaseAs } from '@/types/request';
import type { RequestResponse } from '@/types/request';
import type { RequesterResponse } from '@/types/requester';
import type { OpenJobsDashboardGroup } from '@/types/openJobsDashboard';
import type { ViewDetailsLatestPostNoteMapped } from '@/utils/mapRequestViewDetails';
import { formatDateShort } from '@/utils';
import { formatDateToYYYYMMDD, getLocalTodayYyyyMmDd } from '@/utils/dateTimeUtils';
import { useSearchParams } from 'react-router-dom';
import { SearchFilter } from '@/components/smsmolecules/SearchFilter/SearchFilter';
import { AssignEmployeesModal } from '../RequesterList/AssignEmployeesModal';
import {
  InterestedListModal,
  type TenureJobInterestContext,
} from '../TenureJobsPage/InterestedListModal';
import './OpenJobsPage.css';

/** Inclusive day span for the initial end date (matches the old default “15 days” window). */
const DEFAULT_INITIAL_DAY_SPAN = 15;

const VIEW_JOB_DETAILS_LABEL = POST_POSITION.BY_STATUS_LIST.BUTTONS.VIEW_DETAILS;

/** Query: expanded groups as `requestID~dateOfWork`. */
const OPEN_JOBS_EXPANDED_QUERY = 'expanded';

const OPEN_JOBS_POSTS_TABLE_MAX_HEIGHT = 'min(38vh, 320px)';

const STATUS_FILTER_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'filled', label: 'Filled' },
  { value: 'cancels', label: 'Cancels' },
];
const STATUS_FILTER_LABEL_MAP: Record<string, string> = {
  open: 'Open',
  filled: 'Filled',
  cancels: 'Cancels',
};

const OPEN_JOBS_META_GRID_COLUMNS_LG =
  'minmax(0, 14%) repeat(7, minmax(0, 1fr))';

function isValidYmd(value: string | undefined): boolean {
  if (!value?.trim()) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

function openJobsExpansionKey(requestID: string, dateOfWork: string): string {
  return `${requestID.trim()}~${dateOfWork.trim()}`;
}

function parseExpandedQueryParam(raw: string | null): Set<string> {
  const out = new Set<string>();
  if (!raw?.trim()) return out;
  for (const part of raw.split(',')) {
    const p = part.trim();
    if (!p) continue;
    const tilde = p.indexOf('~');
    if (tilde <= 0 || tilde === p.length - 1) continue;
    const rid = p.slice(0, tilde).trim();
    const dow = p.slice(tilde + 1).trim();
    if (rid && isValidYmd(dow)) out.add(`${rid}~${dow}`);
  }
  return out;
}

function serializeExpandedQueryParam(keys: Set<string>): string {
  return Array.from(keys).sort().join(',');
}

function clearExpandedSearchParam(prev: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(prev);
  next.delete(OPEN_JOBS_EXPANDED_QUERY);
  return next;
}

/** Nested post row for the expandable list grid. */
type OpenJobsPostRow = {
  id: string;
  postID: string;
  postTitle: string;
  totalPositions: number;
  dayOfWeek: string;
  startDate: string;
  startTimeDisplay: string;
  endTimeDisplay: string;
  open: number;
  filled: number;
  pendingCancellation: number;
};

type OpenJobsRequestGroup = {
  id: string;
  requestID: string;
  requestTitle: string;
  requesterName: string;
  dateOfWork: string;
  requestUniqueNumber: string;
  totalPositions: number;
  totalOpen: number;
  totalFilled: number;
  totalCancel: number;
  posts: OpenJobsPostRow[];
};

function mapDashboardGroupToUi(
  group: OpenJobsDashboardGroup,
  page: number,
  index: number
): OpenJobsRequestGroup {
  const id = `ojd-${page}-${index}`;
  return {
    id,
    requestID: group.requestID?.trim() ?? '',
    requestTitle: group.requestTitle?.trim() ?? '',
    requesterName: group.requesterName.trim() || '—',
    dateOfWork: group.dateOfWork.trim() ?? '',
    requestUniqueNumber: group.requestUniqueNumber.trim() ?? '',
    totalPositions: group.totalPositions,
    totalOpen: group.totalOpen,
    totalFilled: group.totalFilled,
    totalCancel: group.totalCancel,
    posts: group.openJobs.map((row, j) => ({
      id: `${id}-row-${j}`,
      postID: row.postID.trim(),
      postTitle: row.postTitle.trim() || '—',
      totalPositions: row.totalPostPositions,
      dayOfWeek: row.dayOfWeek.trim(),
      startDate: row.startDate.trim(),
      startTimeDisplay: row.startTimeDisplay.trim(),
      endTimeDisplay: row.endTimeDisplay.trim(),
      open: row.open,
      filled: row.filled,
      pendingCancellation: row.pendingCancellation,
    })),
  };
}

function openJobPostToListingItem(
  row: OpenJobsPostRow,
  grp: OpenJobsRequestGroup
): EmployeePostListingItem {
  return {
    requestID: grp.requestID.trim(),
    postID: row.postID.trim(),
    postTitle: row.postTitle?.trim() || '—',
    postLocation: null,
    postLength: 0,
    totalPositions: row.totalPositions,
    availablePositions: row.open,
    isSpecialEvent: null,
    releaseAs: ReleaseAs.Open,
    postPositionId: null,
    postPositionStatus: 0,
    parentPostPositionId: null,
    isSplit: null,
    splitPostPositionID: null,
    showVehicle: null,
    showEquipment: null,
    startDate: row.startDate.trim(),
    startTime: row.startTimeDisplay.trim(),
    closedPostPositionID: null,
    waitingPostPositionId: null,
    orderNumber: 0,
    hasAppliedInTenure: false,
    processingStatus: 0,
    requestTitle: grp.requestTitle?.trim() ? grp.requestTitle : null,
    failureReason: null,
  };
}

function minOpenJobsStartDateYmd(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return formatDateToYYYYMMDD(d);
}

function inclusiveEndDateFromDayCount(startYmd: string, dayCount: number): string {
  const trimmed = startYmd.trim().slice(0, 10);
  const start = new Date(`${trimmed}T00:00:00`);
  if (Number.isNaN(start.getTime()) || dayCount < 1) return trimmed;
  const end = new Date(start);
  end.setDate(end.getDate() + dayCount - 1);
  return formatDateToYYYYMMDD(end);
}

export const OpenJobsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const { groups, totalRecords, isLoading, error, listMessage, lastParams } = useAppSelector(
    (s) => s.openJobsDashboard
  );

  const [localSearch, setLocalSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);

  const [startDate, setStartDate] = useState(getLocalTodayYyyyMmDd);
  const [endDate, setEndDate] = useState(() =>
    inclusiveEndDateFromDayCount(getLocalTodayYyyyMmDd(), DEFAULT_INITIAL_DAY_SPAN)
  );
  const [hasInitialized, setHasInitialized] = useState(false);

  const expandedParamRaw = searchParams.get(OPEN_JOBS_EXPANDED_QUERY) ?? '';
  const expandedKeys = useMemo(() => parseExpandedQueryParam(expandedParamRaw), [expandedParamRaw]);

  const [assignModalContext, setAssignModalContext] = useState<{
    post: Post;
    request: RequestResponse;
    initialWorkDate: string;
  } | null>(null);
  const [assignLoadingPostId, setAssignLoadingPostId] = useState<string | null>(null);

  const [waitingListOpen, setWaitingListOpen] = useState(false);
  const [waitingListJob, setWaitingListJob] = useState<TenureJobInterestContext | null>(null);

  const viewDetailsRequestIdRef = useRef(0);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailSelectedPost, setDetailSelectedPost] = useState<EmployeePostListingItem | null>(null);
  const [detailPostData, setDetailPostData] = useState<Post | null>(null);
  const [detailRequestData, setDetailRequestData] = useState<RequestResponse | null>(null);
  const [detailRequesterData, setDetailRequesterData] = useState<RequesterResponse | null>(null);
  const [detailRequestFiles, setDetailRequestFiles] = useState<FileUploadDto[]>([]);
  const [detailSpecialEventMessage, setDetailSpecialEventMessage] = useState<string | null>(null);
  const [detailLatestNote, setDetailLatestNote] = useState<ViewDetailsLatestPostNoteMapped | null>(null);
  const [detailEquipmentRaw, setDetailEquipmentRaw] = useState<PostEquipmentDto[]>([]);
  const [detailShowVehicle, setDetailShowVehicle] = useState(false);
  const [detailShowEquipment, setDetailShowEquipment] = useState(false);

  const {
    currentPage,
    pageSize,
    totalItems: pageTotalCount,
    setTotalItems,
    goToPage,
    goToFirstPage,
    setPageSize,
  } = usePagination({
    initialPage: 1,
    initialPageSize: DEFAULT_TABLE_PAGE_SIZE,
    totalItems: 0,
  });

  const pageSizeRef = useRef(pageSize);
  pageSizeRef.current = pageSize;

  const requestGroups = useMemo(
    () => groups.map((g, idx) => mapDashboardGroupToUi(g, currentPage, idx)),
    [groups, currentPage]
  );

  const getOpenJobsDashboardQueryRange = useCallback(() => {
    const s = lastParams?.startDate?.trim();
    const e = lastParams?.endDate?.trim();
    if (!s || !e) return null;
    return { startDate: s, endDate: e };
  }, [lastParams]);

  const runSearch = useCallback(() => {
    const start = startDate?.trim();
    const end = endDate?.trim();
    if (!start || !end) return;
    if (end < start) {
      dispatch(showToast(REQUEST.ERRORS.END_DATE_INVALID, 'error'));
      return;
    }
    goToFirstPage();
    setSearchParams((prev) => clearExpandedSearchParam(prev), { replace: true });
    const searchTerm = localSearch.trim();
    const filterVal = statusFilter.join(',');
    void dispatch(
      fetchOpenJobsDashboard({
        startDate: start,
        endDate: end,
        page: 1,
        pageSize: pageSizeRef.current,
        ...(searchTerm ? { searchTerm } : {}),
        ...(filterVal ? { statusFilter: filterVal } : {}),
      })
    );
  }, [dispatch, startDate, endDate, localSearch, statusFilter, goToFirstPage, setSearchParams]);

  const handleClearFilters = useCallback(() => {
    setLocalSearch('');
    setStatusFilter([]);
    const start = getLocalTodayYyyyMmDd();
    const end = inclusiveEndDateFromDayCount(start, DEFAULT_INITIAL_DAY_SPAN);
    setStartDate(start);
    setEndDate(end);
    goToFirstPage();
    setSearchParams((prev) => clearExpandedSearchParam(prev), { replace: true });
    void dispatch(
      fetchOpenJobsDashboard({
        startDate: start,
        endDate: end,
        page: 1,
        pageSize: pageSizeRef.current,
      })
    );
  }, [dispatch, goToFirstPage, setSearchParams]);

  useEffect(() => {
    if (hasInitialized) return;
    setHasInitialized(true);
    const initialStart = getLocalTodayYyyyMmDd();
    void dispatch(
      fetchOpenJobsDashboard({
        startDate: initialStart,
        endDate: inclusiveEndDateFromDayCount(initialStart, DEFAULT_INITIAL_DAY_SPAN),
        page: 1,
        pageSize: DEFAULT_TABLE_PAGE_SIZE,
      })
    );
  }, [dispatch, hasInitialized]);

  useEffect(() => {
    setTotalItems(totalRecords);
  }, [totalRecords, setTotalItems]);

  useEffect(() => {
    const min = minOpenJobsStartDateYmd();
    if (startDate.trim() && startDate < min) {
      setStartDate(min);
    }
  }, [startDate]);

  useEffect(() => {
    setEndDate((prev) => (prev < startDate ? startDate : prev));
  }, [startDate]);

  const toggleGroup = useCallback(
    (group: OpenJobsRequestGroup) => {
      const rid = group.requestID.trim();
      if (!rid) return;
      const key = openJobsExpansionKey(rid, group.dateOfWork);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const cur = parseExpandedQueryParam(next.get(OPEN_JOBS_EXPANDED_QUERY));
          if (cur.has(key)) cur.delete(key);
          else cur.add(key);
          if (cur.size === 0) next.delete(OPEN_JOBS_EXPANDED_QUERY);
          else next.set(OPEN_JOBS_EXPANDED_QUERY, serializeExpandedQueryParam(cur));
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const handleCollapseAll = useCallback(() => {
    setSearchParams((prev) => clearExpandedSearchParam(prev), { replace: true });
  }, [setSearchParams]);

  const handleOpenAssignModal = useCallback(
    async (row: OpenJobsPostRow, grp: OpenJobsRequestGroup) => {
      const pid = row.postID?.trim();
      const rid = grp.requestID?.trim();
      if (!pid || !rid) return;
      setAssignLoadingPostId(pid);
      try {
        const [post, request] = await Promise.all([getPostById(pid), getRequestById(rid)]);
        setAssignModalContext({
          post,
          request,
          initialWorkDate: row.startDate?.trim() ?? grp.dateOfWork.trim() ?? '',
        });
      } catch (e) {
        dispatch(
          showToast(e instanceof Error ? e.message : OPEN_JOBS_PAGE.LOAD_ASSIGN_CONTEXT_ERROR, 'error')
        );
      } finally {
        setAssignLoadingPostId(null);
      }
    },
    [dispatch]
  );

  const handleAssignModalSuccess = useCallback(() => {
    setAssignModalContext(null);
    if (lastParams) {
      void dispatch(fetchOpenJobsDashboard(lastParams));
    }
  }, [dispatch, lastParams]);

  const handleOpenWaitingList = useCallback(
    (row: OpenJobsPostRow, grp: OpenJobsRequestGroup) => {
      const postID = row.postID.trim();
      const dateOfWork = (grp.dateOfWork.trim() || row.startDate.trim()).trim();
      if (!postID || !isValidYmd(dateOfWork)) {
        dispatch(showToast(OPEN_JOBS_PAGE.WAITING_LIST_OPEN_ERROR, 'error'));
        return;
      }
      setWaitingListJob({ postID, dateOfWork });
      setWaitingListOpen(true);
    },
    [dispatch]
  );

  const handleCloseWaitingList = useCallback(() => {
    setWaitingListOpen(false);
    setWaitingListJob(null);
  }, []);

  const handleCloseDetailModal = useCallback(() => {
    setDetailModalOpen(false);
    setDetailSelectedPost(null);
    setDetailLoading(false);
    setDetailPostData(null);
    setDetailRequestData(null);
    setDetailRequesterData(null);
    setDetailRequestFiles([]);
    setDetailSpecialEventMessage(null);
    setDetailLatestNote(null);
    setDetailEquipmentRaw([]);
    setDetailShowVehicle(false);
    setDetailShowEquipment(false);
  }, []);

  const handleViewPostDetails = useCallback(
    async (row: OpenJobsPostRow, grp: OpenJobsRequestGroup) => {
      const rid = grp.requestID.trim();
      const pid = row.postID.trim();
      if (!rid || !pid) {
        dispatch(showToast(AVAILABLE_POST.DETAILS.ERROR_LOAD, 'error'));
        return;
      }
      const listing = openJobPostToListingItem(row, grp);
      const reqId = ++viewDetailsRequestIdRef.current;
      setDetailSelectedPost(listing);
      setDetailModalOpen(true);
      setDetailLoading(true);
      setDetailPostData(null);
      setDetailRequestData(null);
      setDetailRequesterData(null);
      setDetailRequestFiles([]);
      setDetailSpecialEventMessage(null);
      setDetailLatestNote(null);
      setDetailEquipmentRaw([]);
      setDetailShowVehicle(false);
      setDetailShowEquipment(false);
      try {
        const details = await dispatch(fetchAvailablePostDetails(listing)).unwrap();
        if (viewDetailsRequestIdRef.current !== reqId) return;
        setDetailPostData(details.postData ?? null);
        setDetailRequestData(details.requestData ?? null);
        setDetailRequesterData(details.requesterData ?? null);
        setDetailRequestFiles(details.files ?? []);
        setDetailSpecialEventMessage(details.specialEventJobDetailsMessage ?? null);
        setDetailLatestNote(details.latestPostNote ?? null);
        setDetailEquipmentRaw(details.detailModalEquipmentRaw ?? []);
        setDetailShowVehicle(Boolean(details.viewDetailsShowVehicle));
        setDetailShowEquipment(Boolean(details.viewDetailsShowEquipment));
        setDetailSelectedPost((prev) => {
          const base = prev ?? listing;
          const next = { ...base };
          if (details.viewDetailsAvailablePositions != null) {
            next.availablePositions = details.viewDetailsAvailablePositions;
          }
          if (details.viewDetailsTotalPostPositions != null) {
            next.totalPositions = details.viewDetailsTotalPostPositions;
          } else {
            const totalFromPost = details.postData?.totalPostPositions;
            if (typeof totalFromPost === 'number' && !Number.isNaN(totalFromPost) && totalFromPost >= 0) {
              next.totalPositions = totalFromPost;
            }
          }
          return next;
        });
      } catch {
        if (viewDetailsRequestIdRef.current !== reqId) return;
        dispatch(showToast(AVAILABLE_POST.DETAILS.ERROR_LOAD, 'error'));
      } finally {
        if (viewDetailsRequestIdRef.current === reqId) {
          setDetailLoading(false);
        }
      }
    },
    [dispatch]
  );

  const detailModalEquipmentExtra = useMemo(() => {
    if (!detailModalOpen || !detailSelectedPost) return null;
    if (
      detailEquipmentRaw.length === 0 &&
      !detailShowVehicle &&
      !detailShowEquipment
    ) {
      return null;
    }
    return (
      <SMSViewDetailsEquipmentSection
        equipmentRaw={detailEquipmentRaw}
        rootShowVehicle={detailShowVehicle}
        rootShowEquipment={detailShowEquipment}
        postPositionDetails={null}
      />
    );
  }, [
    detailModalOpen,
    detailSelectedPost,
    detailEquipmentRaw,
    detailShowVehicle,
    detailShowEquipment,
  ]);

  const getPostColumns = useCallback(
    (grp: OpenJobsRequestGroup): DataTableColumn<OpenJobsPostRow>[] => [
      {
        key: 'startDate',
        label: OPEN_JOBS_PAGE.DATE_OF_WORK,
        align: 'left',
        render: (_v, row) => (row.startDate ? formatDateShort(row.startDate) : '—'),
      },
      {
        key: 'startTimeDisplay',
        label: OPEN_JOBS_PAGE.COLUMNS.START_TIME,
        align: 'left',
      },
      {
        key: 'endTimeDisplay',
        label: OPEN_JOBS_PAGE.COLUMNS.END_TIME,
        align: 'left',
        render: (_v, row) => (row.endTimeDisplay.trim() ? row.endTimeDisplay : '—'),
      },
      { key: 'dayOfWeek', label: OPEN_JOBS_PAGE.COLUMNS.DAY_OF_WEEK, align: 'left' },
      { key: 'postTitle', label: OPEN_JOBS_PAGE.COLUMNS.POST_TITLE, align: 'left' },
      {
        key: 'totalPositions',
        label: OPEN_JOBS_PAGE.COLUMNS.TOTAL_POSITIONS,
        align: 'left',
      },
      { key: 'open', label: OPEN_JOBS_PAGE.COLUMNS.OPEN, align: 'left' },
      { key: 'filled', label: OPEN_JOBS_PAGE.COLUMNS.FILLED, align: 'left' },
      {
        key: 'pendingCancellation',
        label: OPEN_JOBS_PAGE.COLUMNS.PENDING_CANCELLATION,
        align: 'left',
      },
      {
        key: 'action',
        label: OPEN_JOBS_PAGE.COLUMNS.ACTION,
        align: 'center',
        render: (_v, row) => {
          const loading = assignLoadingPostId === row.postID;
          return (
            <SMSStack
              direction="row"
              spacing={0.5}
              justifyContent="center"
              alignItems="center"
              flexWrap="wrap"
              className="open-jobs-page__action-cell"
            >
              <SMSIconButton
                type="button"
                size="small"
                tone="primary"
                variant="outlined"
                allowWhenSuspended
                title={VIEW_JOB_DETAILS_LABEL}
                aria-label={VIEW_JOB_DETAILS_LABEL}
                onClick={() => void handleViewPostDetails(row, grp)}
              >
                <SMSIcon name="eye" size="sm" />
              </SMSIconButton>
              {loading ? (
                <SMSLoader
                  inline
                  size={28}
                  thickness={4}
                  loadingText={false}
                  aria-label={OPEN_JOBS_PAGE.ASSIGN_EMPLOYEE}
                />
              ) : (
                <SMSIconButton
                  type="button"
                  size="small"
                  tone="primary"
                  variant="outlined"
                  title={OPEN_JOBS_PAGE.ASSIGN_EMPLOYEE}
                  aria-label={OPEN_JOBS_PAGE.ASSIGN_EMPLOYEE}
                  allowWhenSuspended
                  onClick={() => void handleOpenAssignModal(row, grp)}
                >
                  <SMSIcon name="person_add" size="sm" />
                </SMSIconButton>
              )}
              <SMSButton
                type="button"
                size="small"
                variant="outlined"
                color="primary"
                allowWhenSuspended
                aria-label={OPEN_JOBS_PAGE.WAITING_LIST_BUTTON}
                onClick={() => handleOpenWaitingList(row, grp)}
              >
                {OPEN_JOBS_PAGE.WAITING_LIST_BUTTON}
              </SMSButton>
            </SMSStack>
          );
        },
      },
    ],
    [assignLoadingPostId, handleOpenAssignModal, handleOpenWaitingList, handleViewPostDetails]
  );

  const getGroupHeaderCells = useCallback(
    (group: OpenJobsRequestGroup): SMSExpandableGroupHeaderCell[] => [
      {
        key: 'request-title',
        label: OPEN_JOBS_PAGE.COLUMNS.REQUEST_TITLE,
        value: group.requestTitle.trim() ? group.requestTitle : '—',
        title: group.requestTitle.trim() ? group.requestTitle : undefined,
      },
      {
        key: 'date-of-work',
        label: OPEN_JOBS_PAGE.DATE_OF_WORK,
        value: group.dateOfWork ? formatDateShort(group.dateOfWork) : '—',
        title: group.dateOfWork ? formatDateShort(group.dateOfWork) : undefined,
      },
      {
        key: 'request-number',
        label: OPEN_JOBS_PAGE.REQUEST_UNIQUE_NUMBER,
        value: group.requestUniqueNumber.trim() ? group.requestUniqueNumber : '—',
        title: group.requestUniqueNumber.trim() ? group.requestUniqueNumber : undefined,
      },
      {
        key: 'total-positions',
        label: OPEN_JOBS_PAGE.COLUMNS.TOTAL_POSITIONS,
        value: group.totalPositions,
      },
      {
        key: 'total-open',
        label: OPEN_JOBS_PAGE.TOTAL_OPEN,
        value: group.totalOpen,
      },
      {
        key: 'total-filled',
        label: OPEN_JOBS_PAGE.TOTAL_FILLED,
        value: group.totalFilled,
      },
      {
        key: 'total-cancel',
        label: OPEN_JOBS_PAGE.TOTAL_CANCEL,
        value: group.totalCancel,
      },
    ],
    []
  );

  const getGroupCountChipLabel = useCallback(
    (group: OpenJobsRequestGroup) =>
      group.posts.length === 1
        ? `1 ${OPEN_JOBS_PAGE.POSTS_COUNT_one}`
        : `${group.posts.length} ${OPEN_JOBS_PAGE.POSTS_COUNT_other}`,
    []
  );

  const emptyMessage =
    !requestGroups.length && listMessage?.trim() ? listMessage.trim() : OPEN_JOBS_PAGE.EMPTY;

  return (
    <SMSBox
      className="open-jobs-page"
      component="main"
      sx={{ p: { xs: 2, sm: 3 }, width: '100%', boxSizing: 'border-box' }}
    >
      <Stack spacing={3}>
        <Typography variant="h5" component="h1">
          {MENU_ITEMS.OPEN_JOBS}
        </Typography>

        <SMSBox className="open-jobs-page__filters-row">
          <SMSBox className="open-jobs-page__filters-inner">
            <SMSBox sx={{ width: { xs: '100%', sm: 220 }, flexShrink: 0 }}>
              <SearchFilter
                value={localSearch}
                onChange={setLocalSearch}
                placeholder="Search..."
              />
            </SMSBox>
            <SMSBox sx={{ width: { xs: '100%', sm: 200 }, flexShrink: 0 }}>
              <SMSMultiSelectDropdown
                label="Status"
                options={STATUS_FILTER_OPTIONS}
                value={statusFilter}
                onChange={(values) => setStatusFilter(values.map(String))}
                placeholder={statusFilter.length > 0
                  ? statusFilter.map((v) => STATUS_FILTER_LABEL_MAP[v] ?? v).join(', ')
                  : 'Select status'}
                disabled={isLoading}
                showSelectedChips={false}
              />
            </SMSBox>
            <SMSBox sx={{ width: { xs: '100%', sm: 220 }, flexShrink: 0 }}>
              <SMSDatePicker
                id="open-jobs-start-date"
                label={OPEN_JOBS_PAGE.START_DATE}
                value={startDate}
                onChange={setStartDate}
                disabled={isLoading}
                minDate={minOpenJobsStartDateYmd()}
              />
            </SMSBox>
            <SMSBox sx={{ width: { xs: '100%', sm: 220 }, flexShrink: 0 }}>
              <SMSDatePicker
                id="open-jobs-end-date"
                label={ARCHIVED_REPORTS_PAGE.END_DATE}
                value={endDate}
                onChange={setEndDate}
                disabled={isLoading}
                minDate={startDate}
              />
            </SMSBox>
            <SMSButton variant="contained" onClick={() => runSearch()} disabled={isLoading} allowWhenSuspended>
              {OPEN_JOBS_PAGE.SEARCH}
            </SMSButton>
            <SMSButton variant="outlined" onClick={handleClearFilters} disabled={isLoading} allowWhenSuspended>
              Clear
            </SMSButton>
          </SMSBox>
          <SMSButton
            type="button"
            variant="outlined"
            allowWhenSuspended
            className="open-jobs-page__filters-collapse-all"
            onClick={handleCollapseAll}
            disabled={expandedKeys.size === 0 || isLoading}
            leftIcon={<SMSIcon name="unfold_less" size="sm" />}
          >
            {OPEN_JOBS_PAGE.COLLAPSE_ALL}
          </SMSButton>
        </SMSBox>

        {error ? (
          <Alert severity="error" role="alert">
            {error}
          </Alert>
        ) : null}

        {isLoading && requestGroups.length === 0 ? (
          <SMSBox sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <SMSLoader loadingText="Loading open jobs…" />
          </SMSBox>
        ) : null}

        {!isLoading && requestGroups.length === 0 ? (
          <Alert severity="info" role="status">
            {emptyMessage}
          </Alert>
        ) : null}

        <SMSExpandableGroupList<OpenJobsRequestGroup, OpenJobsPostRow>
          className="open-jobs-page__list"
          groups={requestGroups}
          getGroupKey={(group) => group.id}
          getExpandKey={(group) => openJobsExpansionKey(group.requestID, group.dateOfWork)}
          expandedKeys={expandedKeys}
          onToggleGroup={toggleGroup}
          getPrimaryText={(group) => group.requesterName.trim() || '—'}
          getHeaderCells={getGroupHeaderCells}
          getCountChipLabel={getGroupCountChipLabel}
          getRows={(group) => group.posts}
          getRowColumns={getPostColumns}
          getRowKey={(row) => row.id}
          nestedEmptyMessage={OPEN_JOBS_PAGE.NESTED_EMPTY}
          nestedMaxBodyHeight={OPEN_JOBS_POSTS_TABLE_MAX_HEIGHT}
          metaGridTemplateColumns={OPEN_JOBS_META_GRID_COLUMNS_LG}
          labels={{ expand: OPEN_JOBS_PAGE.EXPAND_GROUP, collapse: OPEN_JOBS_PAGE.COLLAPSE_GROUP }}
        />

        <SMSPagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={pageTotalCount}
          onPageChange={(page) => {
            const range = getOpenJobsDashboardQueryRange();
            if (!range) return;
            setSearchParams((prev) => clearExpandedSearchParam(prev), { replace: true });
            goToPage(page);
            const searchTerm = localSearch.trim();
            const filterVal = statusFilter.join(',');
            void dispatch(
              fetchOpenJobsDashboard({
                ...range,
                page,
                pageSize,
                ...(searchTerm ? { searchTerm } : {}),
                ...(filterVal ? { statusFilter: filterVal } : {}),
              })
            );
          }}
          onPageSizeChange={(size) => {
            const range = getOpenJobsDashboardQueryRange();
            if (!range) return;
            setSearchParams((prev) => clearExpandedSearchParam(prev), { replace: true });
            setPageSize(size);
            const searchTerm = localSearch.trim();
            const filterVal = statusFilter.join(',');
            void dispatch(
              fetchOpenJobsDashboard({
                ...range,
                page: 1,
                pageSize: size,
                ...(searchTerm ? { searchTerm } : {}),
                ...(filterVal ? { statusFilter: filterVal } : {}),
              })
            );
          }}
          loading={isLoading}
        />
      </Stack>

      {assignModalContext && (
        <AssignEmployeesModal
          isOpen
          onClose={() => setAssignModalContext(null)}
          post={assignModalContext.post}
          request={assignModalContext.request}
          initialWorkDate={assignModalContext.initialWorkDate || undefined}
          lockWorkDate
          onAssignSuccess={handleAssignModalSuccess}
        />
      )}

      <InterestedListModal
        open={waitingListOpen}
        onClose={handleCloseWaitingList}
        job={waitingListJob}
        highlightAppliedInTenure
        showAssign={false}
      />

      {detailSelectedPost ? (
        <SMSPostInformationModal
          open={detailModalOpen}
          onClose={handleCloseDetailModal}
          isLoading={detailLoading}
          preferPostPositionFields
          selectedPost={detailSelectedPost}
          requestData={detailRequestData}
          requesterData={detailRequesterData}
          postData={detailPostData}
          requestFiles={detailRequestFiles}
          showTotalPositions
          showAvailablePositions
          showCallSign
          specialEventMode={
            detailSelectedPost.isSpecialEvent === true || Boolean(detailSpecialEventMessage?.trim())
          }
          specialEventJobDetailsMessage={detailSpecialEventMessage}
          latestPostNoteFromDetails={detailLatestNote}
          extraContent={detailModalEquipmentExtra}
          onDownloadFile={async (file) => {
            try {
              const requesterID = detailRequestData?.requesterID;
              const requestID = detailRequestData?.requestID ?? detailSelectedPost.requestID;
              if (!requesterID || !requestID) return;
              await downloadRequestFile(requesterID, requestID, file.fileUploadedId, file.fileName);
            } catch {
              dispatch(showToast(AVAILABLE_POST.DETAILS.ERROR_DOWNLOAD, 'error'));
            }
          }}
        />
      ) : null}
    </SMSBox>
  );
};
