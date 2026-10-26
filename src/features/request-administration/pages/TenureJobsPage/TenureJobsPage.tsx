import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Stack, Typography } from '@mui/material';
import {
  SMSBox,
  SMSButton,
  SMSDatePicker,
  SMSIcon,
  SMSIconButton,
  SMSLoader,
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
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants/tablePagination';
import { ARCHIVED_REPORTS_PAGE, AVAILABLE_POST, MENU_ITEMS, OPEN_JOBS_PAGE, POST_POSITION, REQUEST } from '@/constants/strings';
import { downloadRequestFile } from '@/services/fileUploadService';
import { usePagination } from '@/hooks/usePagination';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchAvailablePostDetails } from '@/store/slices/availablePostSlice';
import { showToast } from '@/store/slices/toastSlice';
import { fetchTenureJobsDashboard } from '@/store/slices/tenureJobsDashboardSlice';
import type { EmployeePostListingItem } from '@/types/employeePostListingItem';
import { ReleaseAs } from '@/types/request';
import type { Post } from '@/types/post';
import type { RequestResponse } from '@/types/request';
import type { RequesterResponse } from '@/types/requester';
import type { FileUploadDto } from '@/types/fileUpload';
import type { TenureJobsDashboardGroup, TenureJobsDashboardRow } from '@/types/tenureJobsDashboard';
import type { PostEquipmentDto } from '@/services/postEquipmentService';
import type { ViewDetailsLatestPostNoteMapped } from '@/utils/mapRequestViewDetails';
import { formatDateShort } from '@/utils';
import { formatDateToYYYYMMDD, formatDurationHrsMins, getLocalTodayYyyyMmDd } from '@/utils/dateTimeUtils';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { InterestedListModal, type TenureJobInterestContext } from './InterestedListModal';
import './TenureJobsPage.css';

/** Default end date = start date + this many calendar days (initial load + date picker default). */
const DEFAULT_END_DATE_OFFSET_DAYS = 7;

/** Inner table body scroll cap (slightly below panel cap to allow posts-panel padding). */
const TENURE_POSTS_TABLE_MAX_HEIGHT = 'min(38vh, 320px)';

function minTenureJobsStartDateYmd(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return formatDateToYYYYMMDD(d);
}

function addDaysToYmd(ymd: string, deltaDays: number): string {
  const parts = ymd.split('-').map((x) => parseInt(x, 10));
  const y = parts[0];
  const m = parts[1];
  const day = parts[2];
  if (!y || !m || !day || Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(day)) return ymd;
  const dt = new Date(y, m - 1, day);
  dt.setDate(dt.getDate() + deltaDays);
  return formatDateToYYYYMMDD(dt);
}

function isValidYmd(value: string | undefined): boolean {
  if (!value?.trim()) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

/** Normalize path segment dates for API + pickers (clamp start, ensure end ≥ start). */
function resolveRangeFromPathParams(
  startParam: string | undefined,
  endParam: string | undefined
): { start: string; end: string } {
  const minStart = minTenureJobsStartDateYmd();
  const today = getLocalTodayYyyyMmDd();
  const rawStart = startParam?.trim() ?? '';
  const rawEnd = endParam?.trim() ?? '';

  let start = isValidYmd(rawStart) ? rawStart : today;
  if (start < minStart) start = minStart;

  let end = isValidYmd(rawEnd)
    ? rawEnd
    : addDaysToYmd(start, DEFAULT_END_DATE_OFFSET_DAYS);

  if (end < start) end = start;
  return { start, end };
}

/** Canonical client route: `/admin/tenure-jobs/{start}/{end}` (inside Router basename, e.g. `/sms`). */
export function buildTenureJobsPath(startDate: string, endDate: string): string {
  return `/admin/tenure-jobs/${startDate}/${endDate}`;
}

/**
 * Query: which requester rows are expanded. Comma-separated tokens `requestID~dateOfWork`
 * (date disambiguates the same request on multiple work dates).
 */
export const TENURE_JOBS_EXPANDED_QUERY = 'expanded';

export function tenureExpansionKey(requestID: string, dateOfWork: string): string {
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
  next.delete(TENURE_JOBS_EXPANDED_QUERY);
  return next;
}

/** Redirect `/admin/tenure-jobs` → `/admin/tenure-jobs/{start}/{end}` (honors legacy `?startDate=&endDate=`; keeps `expanded`). */
export function TenureJobsIndexRedirect() {
  const [searchParams] = useSearchParams();
  const qsStart = searchParams.get('startDate') ?? undefined;
  const qsEnd = searchParams.get('endDate') ?? undefined;
  const expandedRaw = searchParams.get(TENURE_JOBS_EXPANDED_QUERY);
  const hasQsPair =
    isValidYmd(qsStart) && isValidYmd(qsEnd) && (qsEnd as string) >= (qsStart as string);
  const r = hasQsPair
    ? resolveRangeFromPathParams(qsStart, qsEnd)
    : resolveRangeFromPathParams(undefined, undefined);
  const path = buildTenureJobsPath(r.start, r.end);
  const expanded = parseExpandedQueryParam(expandedRaw);
  if (expanded.size === 0) {
    return <Navigate to={path} replace />;
  }
  const qs = new URLSearchParams();
  qs.set(TENURE_JOBS_EXPANDED_QUERY, serializeExpandedQueryParam(expanded));
  return <Navigate to={`${path}?${qs.toString()}`} replace />;
}

/** One job (post) row under a request + date of work — shown in the nested grid. */
export type TenurePostRow = {
  id: string;
  postID: string;
  post: string;
  totalPositions: number;
  minRequiredHours: number;
  location: string;
  /** YYYY-MM-DD — date of work for this row (prefers row-level value; falls back to parent group). */
  startDate: string;
  /** HH:mm */
  startTime: string;
  /** HH:mm */
  endTime: string;
  interestedList: string;
};

type TenureRequestGroup = {
  id: string;
  requestID: string;
  requestTitle: string;
  requesterName: string;
  /** YYYY-MM-DD */
  dateOfWork: string;
  requestUniqueNumber: string;
  /** YYYY-MM-DD */
  processDate: string;
  processTime: string;
  posts: TenurePostRow[];
};

function mapRowToTenurePostRow(
  row: TenureJobsDashboardRow,
  group: TenureJobsDashboardGroup,
  groupId: string,
  index: number
): TenurePostRow {
  const post = row.postTitle?.trim() || '—';
  const rowDate = row.dateOfWork?.trim() ?? '';
  const groupDate = group.dateOfWork?.trim() ?? '';
  return {
    id: `${groupId}-row-${index}`,
    postID: row.postID?.trim() || `${groupId}-p-${index}`,
    post,
    totalPositions: row.totalPostPositions,
    minRequiredHours: row.minimumHoursRequired,
    location: row.location,
    startDate: rowDate || groupDate,
    startTime: row.startTime,
    endTime: row.endTime,
    interestedList: '',
  };
}

/** Minimal listing row for `GET /Request/view-details` (same pattern as Available Jobs). */
function tenurePostRowToListingItem(row: TenurePostRow, grp: TenureRequestGroup): EmployeePostListingItem {
  return {
    requestID: grp.requestID.trim(),
    postID: row.postID.trim(),
    postTitle: row.post.trim() || '—',
    postLocation: row.location?.trim() ? row.location.trim() : null,
    postLength: 0,
    totalPositions: row.totalPositions,
    availablePositions: null,
    isSpecialEvent: null,
    releaseAs: ReleaseAs.TenureBased,
    postPositionId: null,
    postPositionStatus: 0,
    parentPostPositionId: null,
    isSplit: null,
    splitPostPositionID: null,
    showVehicle: null,
    showEquipment: null,
    startDate: row.startDate.trim(),
    startTime: row.startTime.trim(),
    closedPostPositionID: null,
    waitingPostPositionId: null,
    orderNumber: 0,
    hasAppliedInTenure: false,
    processingStatus: 0,
    requestTitle: grp.requestTitle.trim() ? grp.requestTitle : null,
    failureReason: null,
  };
}

function mapDashboardGroupToUi(
  group: TenureJobsDashboardGroup,
  page: number,
  index: number
): TenureRequestGroup {
  const id = `tjd-${page}-${index}`;
  return {
    id,
    requestID: group.requestID?.trim() ?? '',
    requestTitle: group.requestTitle?.trim() ?? '',
    requesterName: group.requesterName.trim() || '—',
    dateOfWork: group.dateOfWork.trim() ?? '',
    requestUniqueNumber: group.requestUniqueNumber.trim() ?? '',
    processDate: group.processDate.trim() ?? '',
    processTime: group.processTime.trim() ?? '',
    posts: group.tenureJobs.map((row, j) => mapRowToTenurePostRow(row, group, id, j)),
  };
}

const C = {
  DATE_OF_WORK: 'Date Of Work',
  REQUEST_UNIQUE_NUMBER: 'Request number',
  POST: 'Post',
  TOTAL_POSITIONS: 'Total Positions',
  MIN_REQUIRED_HOURS: 'Minimum Required Hours',
  LOCATION: 'Location',
  START_TIME: 'Start Time',
  END_TIME: 'End Time',
  PROCESS_DATE: 'Process Date',
  PROCESS_TIME: 'Process Time',
  ACTION: 'Action',
  INTERESTED_LIST_BUTTON: 'Waiting List',
  VIEW_JOB_DETAILS: POST_POSITION.BY_STATUS_LIST.BUTTONS.VIEW_DETAILS,
  POSTS_COUNT_one: 'post',
  POSTS_COUNT_other: 'posts',
  EXPAND_GROUP: 'Expand request',
  COLLAPSE_GROUP: 'Collapse request',
  COLLAPSE_ALL: 'Collapse all',
  EMPTY_LIST: 'No tenure jobs for this date range.',
  NESTED_EMPTY: 'No posts for this request and date.',
} as const;

/** Fixed-track meta-grid layout (lg+) — preserves the legacy 35/12/12/12/29 split. */
const TENURE_META_GRID_COLUMNS_LG =
  'minmax(0, 35%) minmax(0, 12%) minmax(0, 12%) minmax(0, 12%) minmax(0, 29%)';

/** Request Administration → Tenure Jobs. */
export const TenureJobsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { startDate: startParam, endDate: endParam } = useParams<{
    startDate: string;
    endDate: string;
  }>();
  const { groups, totalRecords, isLoading, error, listMessage, lastParams } = useAppSelector(
    (s) => s.tenureJobsDashboard
  );

  const [startDate, setStartDate] = useState(() => resolveRangeFromPathParams(startParam, endParam).start);
  const [endDate, setEndDate] = useState(() => resolveRangeFromPathParams(startParam, endParam).end);
  const [interestedListOpen, setInterestedListOpen] = useState(false);
  const [interestedListJob, setInterestedListJob] = useState<TenureJobInterestContext | null>(null);

  const expandedParamRaw = searchParams.get(TENURE_JOBS_EXPANDED_QUERY) ?? '';
  const expandedKeys = useMemo(() => parseExpandedQueryParam(expandedParamRaw), [expandedParamRaw]);

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

  const requestGroups = useMemo(
    () => groups.map((g, idx) => mapDashboardGroupToUi(g, currentPage, idx)),
    [groups, currentPage]
  );

  const tenureUrlKey = `${startParam ?? ''}|${endParam ?? ''}`;

  /** Only reset query + refetch when path dates change — not when only `?expanded=` updates (avoids wiping expansion). */
  const prevTenurePathKeyRef = useRef<string | null>(null);

  const pageSizeRef = useRef(pageSize);
  pageSizeRef.current = pageSize;

  useEffect(() => {
    const min = minTenureJobsStartDateYmd();
    if (startDate.trim() && startDate < min) {
      setStartDate(min);
    }
  }, [startDate]);

  useEffect(() => {
    setEndDate((prev) => (prev < startDate ? startDate : prev));
  }, [startDate]);

  useEffect(() => {
    setTotalItems(totalRecords);
  }, [totalRecords, setTotalItems]);

  /** Normalize bad path segments, then load when start/end path segments change (not when only search query changes). */
  useEffect(() => {
    const rawS = startParam?.trim() ?? '';
    const rawE = endParam?.trim() ?? '';
    const hasValidPair = isValidYmd(rawS) && isValidYmd(rawE) && rawE >= rawS;

    const r = resolveRangeFromPathParams(startParam, endParam);

    if (!hasValidPair) {
      prevTenurePathKeyRef.current = null;
      navigate(buildTenureJobsPath(r.start, r.end), { replace: true });
      return;
    }

    const prevKey = prevTenurePathKeyRef.current;
    const pathKeyChanged = prevKey !== tenureUrlKey;
    prevTenurePathKeyRef.current = tenureUrlKey;

    if (!pathKeyChanged) {
      return;
    }

    setStartDate(r.start);
    setEndDate(r.end);
    // First navigation to this page (prevKey == null): keep `?expanded=` from deep link. Later path date changes: reset expansion.
    if (prevKey !== null) {
      setSearchParams((prev) => clearExpandedSearchParam(prev), { replace: true });
    }
    goToFirstPage();
    void dispatch(
      fetchTenureJobsDashboard({
        startDate: r.start,
        endDate: r.end,
        page: 1,
        pageSize: pageSizeRef.current,
      })
    );
    // Do not add `setSearchParams` — RR often gives a new function ref after search-string updates, which would re-run this effect and clear `expanded`.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- path segments tracked via `tenureUrlKey`
  }, [tenureUrlKey, navigate, dispatch, goToFirstPage]);

  const runSearch = useCallback(() => {
    const s = startDate?.trim();
    const e = endDate?.trim();
    if (!s || !e) return;
    if (e < s) {
      dispatch(showToast(REQUEST.ERRORS.END_DATE_INVALID, 'error'));
      return;
    }
    goToFirstPage();
    navigate(buildTenureJobsPath(s, e), { replace: true });
  }, [dispatch, startDate, endDate, goToFirstPage, navigate]);

  /** Prefer Redux snapshot (matches loaded grid); fall back to filters when lastParams not set yet (e.g. fetch pending). */
  const getTenureDashboardQueryRange = useCallback(() => {
    const s = lastParams?.startDate?.trim() || startDate.trim();
    const e = lastParams?.endDate?.trim() || endDate.trim();
    if (!s || !e || e < s) return null;
    return { startDate: s, endDate: e };
  }, [lastParams, startDate, endDate]);

  const toggleGroup = useCallback(
    (group: TenureRequestGroup) => {
      const rid = group.requestID.trim();
      if (!rid) return;
      const key = tenureExpansionKey(rid, group.dateOfWork);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const cur = parseExpandedQueryParam(next.get(TENURE_JOBS_EXPANDED_QUERY));
          if (cur.has(key)) cur.delete(key);
          else cur.add(key);
          if (cur.size === 0) next.delete(TENURE_JOBS_EXPANDED_QUERY);
          else next.set(TENURE_JOBS_EXPANDED_QUERY, serializeExpandedQueryParam(cur));
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

  const handleOpenInterestedList = useCallback(
    (row: TenurePostRow, grp: TenureRequestGroup) => {
      const postID = row.postID.trim();
      const dateOfWork = (grp.dateOfWork.trim() || row.startDate.trim()).trim();
      if (!postID || !isValidYmd(dateOfWork)) {
        dispatch(showToast('Unable to open interested list: missing post or work date.', 'error'));
        return;
      }
      setInterestedListJob({
        postID,
        dateOfWork,
      });
      setInterestedListOpen(true);
    },
    [dispatch]
  );

  const handleCloseInterestedList = useCallback(() => {
    setInterestedListOpen(false);
    setInterestedListJob(null);
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
    async (row: TenurePostRow, grp: TenureRequestGroup) => {
      const rid = grp.requestID.trim();
      const pid = row.postID.trim();
      if (!rid || !pid) {
        dispatch(showToast(AVAILABLE_POST.DETAILS.ERROR_LOAD, 'error'));
        return;
      }
      const listing = tenurePostRowToListingItem(row, grp);
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
    (grp: TenureRequestGroup): DataTableColumn<TenurePostRow>[] => [
      {
        key: 'startDate',
        label: C.DATE_OF_WORK,
        align: 'center',
        render: (_v, row) => (row.startDate?.trim() ? formatDateShort(row.startDate) : '—'),
      },
      {
        key: 'startTime',
        label: C.START_TIME,
        align: 'center',
        render: (_v, row) => (row.startTime?.trim() ? row.startTime : '—'),
      },
      {
        key: 'endTime',
        label: C.END_TIME,
        align: 'center',
        render: (_v, row) => (row.endTime?.trim() ? row.endTime : '—'),
      },
      {
        key: 'minRequiredHours',
        label: C.MIN_REQUIRED_HOURS,
        align: 'center',
        render: (_v, row) => formatDurationHrsMins(row.minRequiredHours),
      },
      { key: 'totalPositions', label: C.TOTAL_POSITIONS, align: 'center' },
      { key: 'post', label: C.POST },
      { key: 'location', label: C.LOCATION },
      {
        key: 'interestedList',
        label: C.ACTION,
        align: 'center',
        render: (_v, row) => (
          <SMSStack direction="row" spacing={0.5} justifyContent="center" alignItems="center" flexWrap="wrap">
            <SMSIconButton
              type="button"
              size="small"
              tone="primary"
              variant="outlined"
              allowWhenSuspended
              aria-label={C.VIEW_JOB_DETAILS}
              title={C.VIEW_JOB_DETAILS}
              onClick={() => void handleViewPostDetails(row, grp)}
            >
              <SMSIcon name="eye" size="sm" />
            </SMSIconButton>
            <SMSButton
              type="button"
              size="small"
              variant="outlined"
              color="primary"
              allowWhenSuspended
              aria-label={C.INTERESTED_LIST_BUTTON}
              onClick={() => handleOpenInterestedList(row, grp)}
            >
              {C.INTERESTED_LIST_BUTTON}
            </SMSButton>
          </SMSStack>
        ),
      },
    ],
    [handleOpenInterestedList, handleViewPostDetails]
  );

  const getGroupHeaderCells = useCallback(
    (group: TenureRequestGroup): SMSExpandableGroupHeaderCell[] => [
      {
        key: 'date-of-work',
        label: C.DATE_OF_WORK,
        value: group.dateOfWork ? formatDateShort(group.dateOfWork) : '—',
        title: group.dateOfWork ? formatDateShort(group.dateOfWork) : undefined,
      },
      {
        key: 'request-number',
        label: C.REQUEST_UNIQUE_NUMBER,
        value: group.requestUniqueNumber.trim() ? group.requestUniqueNumber : '—',
        title: group.requestUniqueNumber.trim() ? group.requestUniqueNumber : undefined,
      },
      {
        key: 'process-date',
        label: C.PROCESS_DATE,
        value: group.processDate ? formatDateShort(group.processDate) : '—',
        title: group.processDate ? formatDateShort(group.processDate) : undefined,
      },
      {
        key: 'process-time',
        label: C.PROCESS_TIME,
        value: group.processTime.trim() ? group.processTime : '—',
        title: group.processTime.trim() ? group.processTime : undefined,
      },
    ],
    []
  );

  const getGroupCountChipLabel = useCallback(
    (group: TenureRequestGroup) =>
      group.posts.length === 1
        ? `1 ${C.POSTS_COUNT_one}`
        : `${group.posts.length} ${C.POSTS_COUNT_other}`,
    []
  );

  const emptyMessage = !requestGroups.length && listMessage?.trim() ? listMessage.trim() : C.EMPTY_LIST;

  return (
    <SMSBox className="tenure-jobs-page" component="main" sx={{ p: { xs: 2, sm: 3 }, width: '100%', boxSizing: 'border-box' }}>
      <Stack spacing={3}>
        <SMSBox className="tenure-jobs-page__intro">
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
            {MENU_ITEMS.TENURE_JOBS}
          </Typography>
        </SMSBox>

        <SMSBox className="tenure-jobs-page__filters-row">
          <SMSBox className="tenure-jobs-page__filters-inner">
            <SMSBox sx={{ width: { xs: '100%', sm: 220 }, flexShrink: 0 }}>
              <SMSDatePicker
                id="tenure-jobs-start-date"
                label={OPEN_JOBS_PAGE.START_DATE}
                value={startDate}
                onChange={setStartDate}
                minDate={minTenureJobsStartDateYmd()}
                disabled={isLoading}
              />
            </SMSBox>
            <SMSBox sx={{ width: { xs: '100%', sm: 220 }, flexShrink: 0 }}>
              <SMSDatePicker
                id="tenure-jobs-end-date"
                label={ARCHIVED_REPORTS_PAGE.END_DATE}
                value={endDate}
                onChange={setEndDate}
                minDate={startDate}
                disabled={isLoading}
              />
            </SMSBox>
            <SMSButton variant="contained" onClick={runSearch} disabled={isLoading} allowWhenSuspended>
              {OPEN_JOBS_PAGE.SEARCH}
            </SMSButton>
          </SMSBox>
          <SMSButton
            type="button"
            variant="outlined"
            allowWhenSuspended
            className="tenure-jobs-page__filters-collapse-all"
            onClick={handleCollapseAll}
            disabled={expandedKeys.size === 0 || isLoading}
            leftIcon={<SMSIcon name="unfold_less" size="sm" />}
          >
            {C.COLLAPSE_ALL}
          </SMSButton>
        </SMSBox>

        {error ? (
          <Alert severity="error" role="alert">
            {error}
          </Alert>
        ) : null}

        {isLoading && requestGroups.length === 0 ? (
          <SMSBox sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <SMSLoader loadingText="Loading tenure jobs…" />
          </SMSBox>
        ) : null}

        {!isLoading && requestGroups.length === 0 ? (
          <Alert severity="info" role="status">
            {emptyMessage}
          </Alert>
        ) : null}

        <SMSExpandableGroupList<TenureRequestGroup, TenurePostRow>
          className="tenure-jobs-page__list"
          groups={requestGroups}
          getGroupKey={(group) => group.id}
          getExpandKey={(group) => tenureExpansionKey(group.requestID, group.dateOfWork)}
          expandedKeys={expandedKeys}
          onToggleGroup={toggleGroup}
          getPrimaryText={(group) => group.requesterName}
          getHeaderCells={getGroupHeaderCells}
          getCountChipLabel={getGroupCountChipLabel}
          getRows={(group) => group.posts}
          getRowColumns={getPostColumns}
          getRowKey={(row) => row.id}
          nestedEmptyMessage={C.NESTED_EMPTY}
          nestedMaxBodyHeight={TENURE_POSTS_TABLE_MAX_HEIGHT}
          metaGridTemplateColumns={TENURE_META_GRID_COLUMNS_LG}
          labels={{ expand: C.EXPAND_GROUP, collapse: C.COLLAPSE_GROUP }}
        />

        <SMSPagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={pageTotalCount}
          onPageChange={(page) => {
            const range = getTenureDashboardQueryRange();
            if (!range) return;
            setSearchParams((prev) => clearExpandedSearchParam(prev), { replace: true });
            goToPage(page);
            void dispatch(
              fetchTenureJobsDashboard({
                ...range,
                page,
                pageSize,
              })
            );
          }}
          onPageSizeChange={(size) => {
            const range = getTenureDashboardQueryRange();
            if (!range) return;
            setSearchParams((prev) => clearExpandedSearchParam(prev), { replace: true });
            setPageSize(size);
            void dispatch(
              fetchTenureJobsDashboard({
                ...range,
                page: 1,
                pageSize: size,
              })
            );
          }}
          loading={isLoading}
        />

        <InterestedListModal open={interestedListOpen} onClose={handleCloseInterestedList} job={interestedListJob} />

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
      </Stack>
    </SMSBox>
  );
};
