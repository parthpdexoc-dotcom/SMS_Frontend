import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@mui/material';
import {
  SMSBox,
  SMSDatePicker,
  SMSIcon,
  SMSMultiSelectDropdown,
  SMSIconButton,
  SMSPagination,
  SMSTextField,
} from '@/components/smsatoms';
import { SMSConfirmDialog } from '@/components/smsmolecules';
import { SMSDataTableActions } from '@/components/smsorganisms';
import { DAILY_ADMINISTRATION, DAILY_WORKSPACE, RELEASE_SCHEDULE, REQUEST } from '@/constants/strings';
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants/tablePagination';
import { useDebounce } from '@/hooks/useDebounceSearch';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  fetchReleaseSchedule,
  fetchReleaseScheduleRequests,
  fetchRequestSchedulePage,
} from '@/store/slices/releaseScheduleSlice';
import {
  deleteRequestScheduleThunk,
  fetchRequestSchedulesByRequestIdThunk,
  upsertRequestScheduleThunk,
} from '@/store/slices/requestScheduleSlice';
import { showToast } from '@/store/slices/toastSlice';
import { ReleaseAs, RequestStatus, RequestTypes, type RequestScheduleDto } from '@/types/request';
import { formatDateShort, formatDateToYYYYMMDD, formatTimeToHHmm, getDefaultReleaseScheduleDateRange } from '@/utils';
import {
  RELEASE_AS_OPTIONS,
  REQUEST_SCHEDULE_STATUS_OPTIONS,
  SMSRequestScheduleModal,
  emptyRequestScheduleModalDraft,
  readScheduleReleaseHoursFromDto,
  type RequestScheduleModalDraft,
  requiresScheduleReleaseHours,
  scheduleReleaseHoursLabel,
  type RequestScheduleSavePayload,
} from '@/components/smsorganisms/SMSRequestForm/SMSRequestScheduleModal';
import { navigateAdminBack } from '@/utils/requesterAdminNavigation';
import { formatRequestDateDisplay } from '../RequesterList/requestCardHelpers';
import { WorkspaceIconButton, WorkspacePanelHeader } from '../DailyWorkspace/components';
import '../DailyWorkspace/DailyWorkspacePage.css';
import './ReleaseSchedulePage.css';

const C = RELEASE_SCHEDULE;

const RELEASE_AS_FILTER_OPTIONS = [
  { value: String(ReleaseAs.Open), label: C.RELEASE_AS.OPEN },
  { value: String(ReleaseAs.TenureBased), label: C.RELEASE_AS.TENURE_BASED },
  { value: String(ReleaseAs.Managed), label: C.RELEASE_AS.MANAGED },
  { value: String(ReleaseAs.Preferred), label: C.RELEASE_AS.PREFERRED },
];

const RELEASE_STATUS_FILTER_OPTIONS = [
  { value: String(RequestStatus.Pending), label: C.STATUS.PENDING },
  { value: String(RequestStatus.ReleaseNow), label: C.STATUS.RELEASE_NOW },
  { value: String(RequestStatus.ReleasedOn), label: C.STATUS.RELEASED_ON },
  { value: String(RequestStatus.Cancelled), label: C.STATUS.CANCELLED },
  { value: String(RequestStatus.Completed), label: C.STATUS.COMPLETED },
];

const selectedLabels = (
  options: { value: string; label: string }[],
  selected: string[],
  fallback: string
) =>
  selected.length > 0
    ? options
        .filter((option) => selected.includes(option.value))
        .map((option) => option.label)
        .join(', ')
    : fallback;

const optionLabel = (options: { value: string; label: string }[], raw: unknown) => {
  const text = String(raw ?? '').trim();
  if (!text) return '-';
  const compact = text.replace(/\s+/g, '').toLowerCase();
  return (
    options.find((option) => {
      const label = option.label.replace(/\s+/g, '').toLowerCase();
      return option.value === text || label === compact;
    })?.label || text
  );
};

const matchesReleaseFilters = (
  statusRaw: unknown,
  releaseAsRaw: unknown,
  statusFilters: number[],
  releaseAsFilters: number[]
) => {
  if (
    statusFilters.length > 0 &&
    !statusFilters.some(
      (status) =>
        optionLabel(RELEASE_STATUS_FILTER_OPTIONS, statusRaw) ===
        optionLabel(RELEASE_STATUS_FILTER_OPTIONS, status)
    )
  ) {
    return false;
  }
  if (
    releaseAsFilters.length > 0 &&
    !releaseAsFilters.some(
      (releaseAs) =>
        optionLabel(RELEASE_AS_OPTIONS, releaseAsRaw) === optionLabel(RELEASE_AS_OPTIONS, releaseAs)
    )
  ) {
    return false;
  }
  return true;
};

const scheduleRecurrenceType = (requestType?: number | null) => {
  switch (requestType) {
    case RequestTypes.Daily:
      return 'DAY';
    case RequestTypes.Weekly:
      return 'WEEK';
    case RequestTypes.Monthly:
      return 'MONTH';
    case RequestTypes.Custom:
      return 'CUSTOM';
    default:
      return 'NONE';
  }
};

const scheduleDraft = (schedule: RequestScheduleDto): RequestScheduleModalDraft => {
  const scheduleAfter: RequestScheduleModalDraft['scheduleAfter'] =
    schedule.requestStatus === RequestStatus.ReleasedOn &&
    ((schedule.scheduleDate ?? '').trim() || (schedule.scheduledTime ?? '').trim())
      ? 'custom'
      : '';
  return {
    ...emptyRequestScheduleModalDraft(),
    startDate: schedule.startDate ?? '',
    endDate: schedule.endDate ?? '',
    isActive: schedule.isActive !== false,
    releaseAs: schedule.releaseAs ?? ReleaseAs.Open,
    requestStatus: schedule.requestStatus ?? RequestStatus.Pending,
    scheduleAfter,
    scheduleDate: schedule.scheduleDate ?? '',
    scheduledTime: schedule.scheduledTime ?? '',
    processDate: schedule.processDate ?? '',
    processTime: schedule.processTime ?? '',
    releaseHours: requiresScheduleReleaseHours(schedule.requestStatus, schedule.releaseAs)
      ? readScheduleReleaseHoursFromDto(schedule)
      : null,
    releaseForMode: '',
    preserveOnRegenerate: schedule.preserveOnRegenerate === true,
  };
};

const TreeCard: React.FC<{
  selected?: boolean;
  expanded?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ selected = false, expanded, onClick, children }) => (
  <SMSBox
    className={`daily-workspace__card${selected ? ' is-selected' : ''}`}
    onClick={onClick}
    role="button"
    tabIndex={0}
    aria-expanded={expanded}
    onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onClick();
      }
    }}
  >
    {children}
  </SMSBox>
);

export const ReleaseSchedulePage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { rows, totalRecords, isLoading, error, requestsByRequester, schedulePages } = useAppSelector(
    (state) => state.releaseSchedule
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState(() => getDefaultReleaseScheduleDateRange().startDate);
  const [endDate, setEndDate] = useState(() => getDefaultReleaseScheduleDateRange().endDate);
  const [releaseAs, setReleaseAs] = useState<string[]>([]);
  const [releaseStatus, setReleaseStatus] = useState<string[]>([]);
  const [selectedRequesterId, setSelectedRequesterId] = useState<string | null>(null);
  const [selectedRequestIds, setSelectedRequestIds] = useState<Set<string>>(() => new Set());
  const [requestersCollapsed, setRequestersCollapsed] = useState(false);
  const [schedulesCollapsed, setSchedulesCollapsed] = useState(false);
  const [shownRequesterCount, setShownRequesterCount] = useState(DEFAULT_TABLE_PAGE_SIZE);
  const [schedulePaging, setSchedulePaging] = useState<Record<string, { page: number; pageSize: number }>>({});
  const [collapsedScheduleIds, setCollapsedScheduleIds] = useState<Set<string>>(() => new Set());
  const [editingSchedule, setEditingSchedule] = useState<{
    requestId: string;
    schedule: RequestScheduleDto;
  } | null>(null);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [schedulePendingDelete, setSchedulePendingDelete] = useState<{
    requestId: string;
    scheduleId: string;
  } | null>(null);
  const debouncedSearch = useDebounce(searchQuery.trim(), 400);
  const releaseAsFilters = useMemo(
    () => releaseAs.map(Number).sort((a, b) => a - b),
    [releaseAs]
  );
  const releaseStatusFilters = useMemo(
    () => releaseStatus.map(Number).sort((a, b) => a - b),
    [releaseStatus]
  );
  const releaseAsKey = releaseAsFilters.join(',');
  const releaseStatusKey = releaseStatusFilters.join(',');
  const requestFilters = {
    ...(releaseAsFilters.length > 0 ? { releaseAs: releaseAsFilters } : {}),
    ...(releaseStatusFilters.length > 0 ? { requestStatuses: releaseStatusFilters } : {}),
  };
  const scheduleFilters = {
    ...(releaseAsFilters.length > 0 ? { releaseAs: releaseAsFilters } : {}),
    ...(releaseStatusFilters.length > 0 ? { requestStatus: releaseStatusFilters } : {}),
  };
  const searchText = debouncedSearch.toLowerCase();
  const filterKey = `${startDate}|${endDate}|${releaseAsKey}|${releaseStatusKey}|${debouncedSearch}`;
  const appliedFilterKey = useRef(filterKey);

  useEffect(() => {
    const start = startDate.trim();
    const end = endDate.trim();
    if (!start || !end) return;
    if (appliedFilterKey.current !== filterKey) {
      appliedFilterKey.current = filterKey;
      setShownRequesterCount(DEFAULT_TABLE_PAGE_SIZE);
    }
    dispatch(
      fetchReleaseSchedule({
        startDate: start,
        endDate: end,
        applyDateOnSchedules: true,
        ...requestFilters,
        ...(debouncedSearch ? { searchText: debouncedSearch } : {}),
      })
    );
  }, [
    dispatch,
    filterKey,
    startDate,
    endDate,
    releaseAsFilters,
    releaseStatusFilters,
    debouncedSearch,
  ]);

  useEffect(() => {
    if (error) dispatch(showToast(error, 'error'));
  }, [dispatch, error]);

  useEffect(() => {
    if (!selectedRequesterId) return;
    if (rows.some((row) => row.requesterId === selectedRequesterId)) return;
    setSelectedRequesterId(null);
    setSelectedRequestIds(new Set());
  }, [rows, selectedRequesterId]);

  const requestBucket = selectedRequesterId ? requestsByRequester[selectedRequesterId] : undefined;
  const requesterRequests = requestBucket?.rows ?? [];
  const requestsLoading = requestBucket?.isLoading ?? false;
  const requestsError = requestBucket?.error ?? null;
  const requestTotal = requestBucket?.totalRecords ?? 0;

  useEffect(() => {
    if (requestsError) dispatch(showToast(requestsError, 'error'));
  }, [dispatch, requestsError]);

  useEffect(() => {
    if (!selectedRequesterId || requestsLoading || !requestBucket) return;
    const visibleIds = new Set(requesterRequests.map((request) => request.requestId));
    setSelectedRequestIds((current) => {
      const next = new Set<string>();
      current.forEach((id) => {
        if (visibleIds.has(id)) next.add(id);
      });
      return next.size === current.size ? current : next;
    });
  }, [selectedRequesterId, requestsLoading, requestBucket, requesterRequests]);
  const seenRequests = useRef<Record<string, (typeof requesterRequests)[number]>>({});
  requesterRequests.forEach((request) => {
    seenRequests.current[request.requestId] = request;
  });
  rows.forEach((row) => {
    (row.requests ?? []).forEach((request) => {
      seenRequests.current[request.requestId] = request;
    });
  });
  const selectedRequestIdKey = [...selectedRequestIds].sort().join('|');
  const selectedRequestIdList = useMemo(
    () => (selectedRequestIdKey ? selectedRequestIdKey.split('|') : []),
    [selectedRequestIdKey]
  );
  const selectedRequests = selectedRequestIdList
    .map((requestId) => seenRequests.current[requestId])
    .filter(
      (request): request is NonNullable<typeof request> =>
        request != null
    );
  const scheduleCount = selectedRequests.reduce((total, request) => {
    const page = schedulePages[request.requestId];
    const rowsForRequest = page?.rows ?? [];
    const matched = rowsForRequest.filter((row) =>
      matchesReleaseFilters(row.requestStatus, row.releaseAs, releaseStatusFilters, releaseAsFilters)
    );
    const count = rowsForRequest.length === matched.length ? (page?.totalRecords ?? 0) : matched.length;
    return total + count;
  }, 0);
  const scheduleColumnOpen = selectedRequests.length > 0;
  const todayYmd = formatDateToYYYYMMDD(new Date());
  const todayDate = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);
  const editingRequest = editingSchedule ? seenRequests.current[editingSchedule.requestId] : undefined;
  const [overlapSchedules, setOverlapSchedules] = useState<RequestScheduleDto[] | null>(null);

  useEffect(() => {
    if (!editingSchedule) {
      setOverlapSchedules(null);
      return;
    }
    let cancelled = false;
    void dispatch(
      fetchRequestSchedulesByRequestIdThunk({
        requestId: editingSchedule.requestId,
        updateState: false,
        pagination: { page: 1, pageSize: 1000 },
      })
    )
      .unwrap()
      .then((page) => {
        if (!cancelled) setOverlapSchedules(page.data);
      })
      .catch(() => {
        // The open page stays the overlap source when the full list cannot be loaded.
      });
    return () => {
      cancelled = true;
    };
  }, [dispatch, editingSchedule]);

  const otherScheduleRanges = useMemo(() => {
    if (!editingSchedule) return [];
    const editingId = editingSchedule.schedule.requestScheduleID;
    const source = overlapSchedules ?? schedulePages[editingSchedule.requestId]?.rows ?? [];
    return source.flatMap((row) => {
      if (!row.requestScheduleID || row.requestScheduleID === editingId) return [];
      const start = (row.startDate ?? '').slice(0, 10);
      const end = (row.endDate ?? '').slice(0, 10);
      return start && end ? [{ start, end }] : [];
    });
  }, [editingSchedule, overlapSchedules, schedulePages]);
  const requestFilterKey = `${startDate}|${endDate}|${releaseAsKey}|${releaseStatusKey}`;
  const scheduleFilterKey = requestFilterKey;
  const appliedRequestFilterKey = useRef(requestFilterKey);
  const appliedScheduleFilterKey = useRef(scheduleFilterKey);
  const loadedRequestKeys = useRef<Record<string, string>>({});
  const loadedScheduleKeys = useRef<Record<string, string>>({});

  const requestPages = useRef<Record<string, number>>({});
  const loadingMoreRequests = useRef(false);

  useEffect(() => {
    if (!selectedRequesterId) return;
    const start = startDate.trim();
    const end = endDate.trim();
    if (!start || !end) return;
    if (appliedRequestFilterKey.current !== requestFilterKey) {
      appliedRequestFilterKey.current = requestFilterKey;
      loadedRequestKeys.current = {};
    }
    const loadKey = requestFilterKey;
    if (loadedRequestKeys.current[selectedRequesterId] === loadKey) return;
    loadedRequestKeys.current[selectedRequesterId] = loadKey;
    requestPages.current[selectedRequesterId] = 1;
    loadingMoreRequests.current = false;
    dispatch(
      fetchReleaseScheduleRequests({
        requesterId: selectedRequesterId,
        startDate: start,
        endDate: end,
        applyDateOnSchedules: true,
        ...requestFilters,
        pageParam: { page: 1, pageSize: DEFAULT_TABLE_PAGE_SIZE },
      })
    );
  }, [dispatch, selectedRequesterId, startDate, endDate, releaseAsFilters, releaseStatusFilters, requestFilterKey]);

  const loadMoreRequests = useCallback(() => {
    if (!selectedRequesterId || requestsLoading || requestsError || loadingMoreRequests.current) return;
    if (requesterRequests.length >= requestTotal) return;
    const start = startDate.trim();
    const end = endDate.trim();
    if (!start || !end) return;
    const nextPage = (requestPages.current[selectedRequesterId] ?? 1) + 1;
    requestPages.current[selectedRequesterId] = nextPage;
    loadingMoreRequests.current = true;
    void dispatch(
      fetchReleaseScheduleRequests({
        requesterId: selectedRequesterId,
        startDate: start,
        endDate: end,
        applyDateOnSchedules: true,
        ...requestFilters,
        pageParam: { page: nextPage, pageSize: DEFAULT_TABLE_PAGE_SIZE },
      })
    ).finally(() => {
      loadingMoreRequests.current = false;
    });
  }, [
    dispatch,
    selectedRequesterId,
    requestsLoading,
    requesterRequests.length,
    requestTotal,
    requestsError,
    startDate,
    endDate,
    releaseAsFilters,
    releaseStatusFilters,
  ]);

  const revealMore = useCallback(() => {
    if (!searchText && selectedRequesterId && requesterRequests.length < requestTotal) {
      loadMoreRequests();
    }
    setShownRequesterCount((count) => (count < rows.length ? count + DEFAULT_TABLE_PAGE_SIZE : count));
  }, [searchText, selectedRequesterId, requesterRequests.length, requestTotal, loadMoreRequests, rows.length]);

  const handleRequesterScroll = useCallback(
    (event: React.UIEvent<HTMLElement>) => {
      const el = event.currentTarget;
      if (el.scrollHeight - el.scrollTop - el.clientHeight > 80) return;
      revealMore();
    },
    [revealMore]
  );

  useEffect(() => {
    const el = document.querySelector(
      '.release-schedule .daily-workspace__panel--requests .daily-workspace__panel-body'
    );
    if (!(el instanceof HTMLElement) || el.scrollHeight - el.clientHeight > 80) return;
    revealMore();
  }, [revealMore, shownRequesterCount, rows.length, requesterRequests.length, requestsLoading]);

  useEffect(() => {
    const appliedParts = appliedScheduleFilterKey.current.split('|');
    const scheduleFilterCleared =
      (Boolean(appliedParts[2]) && releaseAsFilters.length === 0) ||
      (Boolean(appliedParts[3]) && releaseStatusFilters.length === 0);
    if (scheduleFilterCleared && Object.keys(schedulePaging).length > 0) {
      appliedScheduleFilterKey.current = scheduleFilterKey;
      setSchedulePaging({});
      return;
    }

    const start = startDate.trim();
    const end = endDate.trim();
    if (!start || !end || selectedRequestIdList.length === 0) return;
    if (appliedScheduleFilterKey.current !== scheduleFilterKey) {
      appliedScheduleFilterKey.current = scheduleFilterKey;
      const needsFirstPage = selectedRequestIdList.some(
        (requestId) => (schedulePaging[requestId]?.page ?? 1) !== 1
      );
      if (needsFirstPage) {
        setSchedulePaging((current) => {
          const next = { ...current };
          selectedRequestIdList.forEach((requestId) => {
            const paging = next[requestId] ?? { page: 1, pageSize: DEFAULT_TABLE_PAGE_SIZE };
            next[requestId] = { ...paging, page: 1 };
          });
          return next;
        });
        return;
      }
    }
    const activeIds = new Set(selectedRequestIdList);
    Object.keys(loadedScheduleKeys.current).forEach((requestId) => {
      if (!activeIds.has(requestId)) delete loadedScheduleKeys.current[requestId];
    });
    selectedRequestIdList.forEach((requestId) => {
      const paging = schedulePaging[requestId] ?? { page: 1, pageSize: DEFAULT_TABLE_PAGE_SIZE };
      const loadKey = `${scheduleFilterKey}|${paging.page}|${paging.pageSize}`;
      if (loadedScheduleKeys.current[requestId] === loadKey) return;
      loadedScheduleKeys.current[requestId] = loadKey;
      dispatch(
        fetchRequestSchedulePage({
          requestId,
          startDate: start,
          endDate: end,
          ...scheduleFilters,
          page: paging.page,
          pageSize: paging.pageSize,
        })
      );
    });
  }, [
    dispatch,
    startDate,
    endDate,
    releaseAsFilters,
    releaseStatusFilters,
    requestFilterKey,
    scheduleFilterKey,
    selectedRequestIdList,
    schedulePaging,
  ]);

  const toggleRequester = (requesterId: string) => {
    setSelectedRequesterId((current) => {
      setSelectedRequestIds(new Set());
      return current === requesterId ? null : requesterId;
    });
    setRequestersCollapsed(false);
  };

  const toggleScheduleGroup = (requestId: string) => {
    setCollapsedScheduleIds((current) => {
      const next = new Set(current);
      if (next.has(requestId)) next.delete(requestId);
      else next.add(requestId);
      return next;
    });
  };

  const toggleRequest = (requestId: string) => {
    setSelectedRequestIds((current) => {
      const next = new Set(current);
      if (next.has(requestId)) next.delete(requestId);
      else next.add(requestId);
      return next;
    });
    setSchedulesCollapsed(false);
  };

  const reloadSchedule = (requestId: string) => {
    const start = startDate.trim();
    const end = endDate.trim();
    if (!start || !end) return;
    const paging = schedulePaging[requestId] ?? { page: 1, pageSize: DEFAULT_TABLE_PAGE_SIZE };
    return dispatch(
      fetchRequestSchedulePage({
        requestId,
        startDate: start,
        endDate: end,
        ...scheduleFilters,
        page: paging.page,
        pageSize: paging.pageSize,
      })
    );
  };

  const saveSchedule = async (payload: RequestScheduleSavePayload) => {
    if (!editingSchedule) return;
    const requestId = editingSchedule.requestId;
    setScheduleSaving(true);
    try {
      await dispatch(
        upsertRequestScheduleThunk({
          ...editingSchedule.schedule,
          requestId,
          requestScheduleID: editingSchedule.schedule.requestScheduleID,
          startDate: payload.startDate,
          endDate: payload.endDate,
          isActive: payload.isActive,
          releaseAs: payload.releaseAs,
          requestStatus: payload.requestStatus,
          scheduleDate: payload.scheduleDate,
          scheduledTime: payload.scheduledTime,
          processDate: payload.processDate,
          processTime: payload.processTime,
          releaseHours: payload.releaseHours as RequestScheduleDto['releaseHours'],
          preserveOnRegenerate: payload.preserveOnRegenerate,
        })
      ).unwrap();
      setEditingSchedule(null);
      await reloadSchedule(requestId);
    } catch {
      // Toast is shown by the thunk.
    } finally {
      setScheduleSaving(false);
    }
  };

  const deleteSchedule = async (requestId: string, scheduleId?: string) => {
    if (!scheduleId) return false;
    const paging = schedulePaging[requestId] ?? { page: 1, pageSize: DEFAULT_TABLE_PAGE_SIZE };
    try {
      await dispatch(deleteRequestScheduleThunk(scheduleId)).unwrap();
      if (editingSchedule?.schedule.requestScheduleID === scheduleId) setEditingSchedule(null);
      const pendingReload = reloadSchedule(requestId);
      if (pendingReload) {
        void pendingReload
          .unwrap()
          .then((page) => {
            if (page && page.data.length === 0 && paging.page > 1) {
              setSchedulePaging((current) => ({
                ...current,
                [requestId]: { page: paging.page - 1, pageSize: paging.pageSize },
              }));
            }
          })
          .catch(() => undefined);
      }
      return true;
    } catch {
      return false;
    }
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    const range = getDefaultReleaseScheduleDateRange();
    setStartDate(range.startDate);
    setEndDate(range.endDate);
    setReleaseAs([]);
    setReleaseStatus([]);
  };

  const bodyClass = scheduleColumnOpen
    ? 'daily-workspace__body--stage-posts'
    : 'daily-workspace__body--stage-requests';

  return (
    <SMSBox component="main" className="daily-workspace release-schedule">
      <SMSBox className="daily-workspace__top">
        <SMSBox className="daily-workspace__summary">
          <SMSBox className="daily-workspace__title-row">
            <SMSIconButton
              type="button"
              onClick={() => navigateAdminBack(navigate, undefined, '/personnel/requester/manage')}
              className="form-page__back-button"
              aria-label={C.BACK_ARIA_LABEL}
            >
              <SMSIcon name="arrowLeft" size="md" />
            </SMSIconButton>
            <h1 className="daily-workspace__title">{C.TITLE}</h1>
          </SMSBox>
        </SMSBox>
        <SMSBox className="daily-workspace__filters-wrap is-expanded">
          <SMSBox className="daily-workspace__filters">
            <SMSBox className="filter-group release-schedule__search-filter">
              <SMSTextField
                label={C.SEARCH_LABEL}
                id="release-schedule-search"
                placeholder={C.SEARCH_PLACEHOLDER}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                size="small"
                fullWidth
              />
            </SMSBox>
            <SMSBox className="daily-workspace__filter-segment daily-workspace__filter-dates">
              <SMSDatePicker label={C.START_DATE} id="release-schedule-start" value={startDate} onChange={setStartDate} />
              <SMSDatePicker label={C.END_DATE} id="release-schedule-end" value={endDate} onChange={setEndDate} />
            </SMSBox>
            <SMSBox className="filter-group release-schedule__release-as-filter">
              <SMSMultiSelectDropdown
                label={C.COLUMNS.RELEASE_AS}
                id="release-schedule-release-as"
                options={RELEASE_AS_FILTER_OPTIONS}
                value={releaseAs}
                onChange={(values) => setReleaseAs(values.map(String))}
                placeholder={selectedLabels(RELEASE_AS_FILTER_OPTIONS, releaseAs, C.COLUMNS.RELEASE_AS)}
                showSelectedChips={false}
                clearable
              />
            </SMSBox>
            <SMSBox className="filter-group release-schedule__release-as-filter">
              <SMSMultiSelectDropdown
                label={C.COLUMNS.RELEASE_STATUS}
                id="release-schedule-release-status"
                options={RELEASE_STATUS_FILTER_OPTIONS}
                value={releaseStatus}
                onChange={(values) => setReleaseStatus(values.map(String))}
                placeholder={selectedLabels(RELEASE_STATUS_FILTER_OPTIONS, releaseStatus, C.COLUMNS.RELEASE_STATUS)}
                showSelectedChips={false}
                clearable
              />
            </SMSBox>
            <SMSIconButton
              type="button"
              className="daily-workspace__filter-clear"
              onClick={handleClearFilters}
              aria-label={C.CLEAR}
              title={C.CLEAR}
            >
              <SMSIcon name="filter_alt_off" size="sm" />
            </SMSIconButton>
          </SMSBox>
        </SMSBox>
      </SMSBox>

      <SMSBox className={`daily-workspace__body ${bodyClass}`}>
        <aside className={`daily-workspace__panel daily-workspace__panel--requests${requestersCollapsed ? ' is-collapsed' : ''}`}>
          <WorkspacePanelHeader
            title={C.REQUESTERS_PANEL}
            count={totalRecords}
            collapsed={requestersCollapsed}
            onToggleCollapse={() => setRequestersCollapsed((value) => !value)}
          />
          {!requestersCollapsed && (
            <>
              <SMSBox className="daily-workspace__panel-body" onScroll={handleRequesterScroll}>
                {isLoading && rows.length === 0 ? (
                  Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={`release-schedule-loading-${index}`} variant="rounded" height={88} sx={{ mb: 1 }} />
                  ))
                ) : rows.length === 0 ? (
                  <SMSBox className="daily-workspace__empty">{C.EMPTY_REQUESTERS}</SMSBox>
                ) : (
                  <SMSBox component="ul" className="dw-post-tree release-schedule__tree">
                    {rows.slice(0, shownRequesterCount).map((group) => {
                      const expanded = group.requesterId === selectedRequesterId;
                      const open = Boolean(searchText) || expanded;
                      const searchedRequests = group.requests ?? [];
                      const childRequests = searchText ? searchedRequests : requesterRequests;
                      const showRequests =
                        open &&
                        (childRequests.length > 0 ||
                          (!searchText && requestsLoading && (group.requestCount ?? 0) > 0));
                      return (
                        <SMSBox component="li" key={group.requesterId} className="dw-post-tree__node">
                          <TreeCard selected={open} expanded={open} onClick={() => toggleRequester(group.requesterId)}>
                            <SMSBox className="daily-workspace__card-top">
                              <h3 className="daily-workspace__card-title">{group.requesterName}</h3>
                              <SMSBox className="daily-workspace__card-meta">
                                <span className="daily-workspace__card-meta-posts">
                                  {group.requestCount ?? 0} {C.REQUESTS_BADGE}
                                </span>
                              </SMSBox>
                            </SMSBox>
                          </TreeCard>
                          {showRequests ? (
                            <>
                              <SMSBox component="ul" className="dw-post-tree__children dw-post-tree__children--step">
                                {!searchText && requestsLoading && requesterRequests.length === 0 ? (
                                  <SMSBox component="li" className="dw-post-tree__node is-last">
                                    <Skeleton variant="rounded" height={88} />
                                  </SMSBox>
                                ) : (
                                  childRequests.map((request, index) => {
                                    const listedSchedules = request.requestSchedules ?? [];
                                    const loadedSchedules = schedulePages[request.requestId]?.rows ?? [];
                                    const matchedListed = listedSchedules.find((schedule) =>
                                      matchesReleaseFilters(
                                        schedule.releaseStatus ?? schedule.requestStatus,
                                        schedule.releaseAs,
                                        releaseStatusFilters,
                                        releaseAsFilters
                                      )
                                    );
                                    const matchedLoaded = loadedSchedules.find((schedule) =>
                                      matchesReleaseFilters(
                                        schedule.requestStatus,
                                        schedule.releaseAs,
                                        releaseStatusFilters,
                                        releaseAsFilters
                                      )
                                    );
                                    const releaseStatusLabel = optionLabel(
                                      RELEASE_STATUS_FILTER_OPTIONS,
                                      matchedListed
                                        ? (matchedListed.releaseStatus ?? matchedListed.requestStatus)
                                        : matchedLoaded
                                          ? matchedLoaded.requestStatus
                                          : request.releaseStatus
                                    );
                                    const releaseAsLabel = optionLabel(
                                      RELEASE_AS_OPTIONS,
                                      matchedListed?.releaseAs ??
                                        matchedLoaded?.releaseAs ??
                                        listedSchedules[0]?.releaseAs ??
                                        loadedSchedules[0]?.releaseAs
                                    );
                                    return (
                                    <SMSBox
                                      component="li"
                                      key={request.requestId}
                                      className={`dw-post-tree__node${index === childRequests.length - 1 ? ' is-last' : ''}`}
                                    >
                                      <TreeCard
                                        selected={selectedRequestIds.has(request.requestId)}
                                        expanded={selectedRequestIds.has(request.requestId)}
                                        onClick={() => toggleRequest(request.requestId)}
                                      >
                                        <SMSBox className="daily-workspace__card-top">
                                          <h3 className="daily-workspace__card-title">
                                            {(request.name ?? '').trim() || '-'}
                                          </h3>
                                          <SMSBox className="daily-workspace__card-meta">
                                            <span className="daily-workspace__card-meta-dates">
                                              {formatRequestDateDisplay(request.startDate)} –{' '}
                                              {formatRequestDateDisplay(request.endDate)}
                                            </span>
                                          </SMSBox>
                                          <SMSBox className="daily-workspace__card-meta release-schedule__card-fields">
                                            <span>
                                              <small>{C.COLUMNS.RELEASE_STATUS}</small>
                                              {releaseStatusLabel}
                                            </span>
                                            <span>
                                              <small>{C.COLUMNS.RELEASE_AS}</small>
                                              {releaseAsLabel}
                                            </span>
                                          </SMSBox>
                                        </SMSBox>
                                      </TreeCard>
                                    </SMSBox>
                                    );
                                  })
                                )}
                              </SMSBox>
                              {!searchText && requestsLoading && requesterRequests.length > 0 ? (
                                <Skeleton variant="rounded" height={48} sx={{ mt: 1 }} />
                              ) : null}
                            </>
                          ) : null}
                        </SMSBox>
                      );
                    })}
                  </SMSBox>
                )}
              </SMSBox>
            </>
          )}
        </aside>

        {scheduleColumnOpen && (
          <section className={`daily-workspace__panel daily-workspace__panel--posts${schedulesCollapsed ? ' is-collapsed' : ''}`}>
            <WorkspacePanelHeader
              title={C.SCHEDULES_PANEL}
              count={scheduleCount}
              collapsed={schedulesCollapsed}
              onToggleCollapse={() => setSchedulesCollapsed((value) => !value)}
              tools={
                <>
                  <WorkspaceIconButton
                    allowWhenSuspended
                    title={C.CLOSE}
                    onClick={() => setSelectedRequestIds(new Set())}
                  >
                    <SMSIcon name="close" size="sm" />
                  </WorkspaceIconButton>
                </>
              }
            />
            {!schedulesCollapsed && (
              <SMSBox className="daily-workspace__panel-body daily-workspace__panel-body--positions release-schedule__schedules">
                <SMSBox className="daily-workspace__positions-stack">
                  {selectedRequests.map((request) => {
                    const pageState = schedulePages[request.requestId];
                    const loadedSchedules = pageState?.rows ?? [];
                    const requestSchedules = loadedSchedules.filter((schedule) =>
                      matchesReleaseFilters(schedule.requestStatus, schedule.releaseAs, releaseStatusFilters, releaseAsFilters)
                    );
                    const scheduleTotal =
                      loadedSchedules.length === requestSchedules.length
                        ? (pageState?.totalRecords ?? 0)
                        : requestSchedules.length;
                    const schedulesLoading = pageState?.isLoading ?? false;
                    const isGroupCollapsed = collapsedScheduleIds.has(request.requestId);
                    const paging = schedulePaging[request.requestId] ?? {
                      page: 1,
                      pageSize: DEFAULT_TABLE_PAGE_SIZE,
                    };
                    return (
                      <SMSBox
                        key={request.requestId}
                        className={`daily-workspace__positions-group${isGroupCollapsed ? ' is-collapsed' : ''}`}
                      >
                        <SMSBox
                          className="daily-workspace__positions-group-header"
                          role={isGroupCollapsed ? 'button' : undefined}
                          tabIndex={isGroupCollapsed ? 0 : undefined}
                          onClick={isGroupCollapsed ? () => toggleScheduleGroup(request.requestId) : undefined}
                          onKeyDown={
                            isGroupCollapsed
                              ? (event) => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    toggleScheduleGroup(request.requestId);
                                  }
                                }
                              : undefined
                          }
                        >
                          <WorkspaceIconButton
                            className="daily-workspace__positions-group-collapse"
                            title={
                              isGroupCollapsed
                                ? DAILY_WORKSPACE.EXPAND_SECTION
                                : DAILY_WORKSPACE.COLLAPSE_SECTION
                            }
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleScheduleGroup(request.requestId);
                            }}
                          >
                            <SMSIcon name={isGroupCollapsed ? 'chevron-right' : 'expand_more'} size="sm" />
                          </WorkspaceIconButton>
                          <h3 className="daily-workspace__positions-group-title">
                            {(request.name ?? '').trim() || '-'}
                          </h3>
                          <SMSBox className="daily-workspace__positions-group-tools">
                            <span className="daily-workspace__positions-group-count">
                              {scheduleTotal}
                            </span>
                          </SMSBox>
                        </SMSBox>
                        {!isGroupCollapsed && (
                          <SMSBox className="daily-workspace__positions-group-body">
                            {schedulesLoading && requestSchedules.length === 0 ? (
                              <Skeleton variant="rounded" height={120} />
                            ) : requestSchedules.length === 0 ? (
                              <SMSBox className="daily-workspace__empty daily-workspace__empty--in-group">
                                {C.EMPTY_SCHEDULES}
                              </SMSBox>
                            ) : (
                              <>
                                <SMSBox className="daily-workspace__table-wrap">
                                  <table className="daily-workspace__table">
                                    <thead>
                                      <tr>
                                        <th>{REQUEST.FORM.START_DATE}</th>
                                        <th>{REQUEST.FORM.END_DATE}</th>
                                        <th>{REQUEST.FORM.RELEASE_STATUS}</th>
                                        <th>{REQUEST.FORM.SCHEDULE_DATE}</th>
                                        <th>{REQUEST.FORM.SCHEDULE_TIME}</th>
                                        <th>{REQUEST.FORM.RELEASE_FOR}</th>
                                        <th>{REQUEST.FORM.RELEASE_AS}</th>
                                        <th>{REQUEST.FORM.TENURE_START_DATE}</th>
                                        <th>{REQUEST.FORM.TENURE_START_TIME}</th>
                                        <th>{REQUEST.FORM.ACTION}</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {requestSchedules.map((schedule) => {
                                        const startKey = (schedule.startDate ?? '').slice(0, 10);
                                        const endKey = (schedule.endDate ?? '').slice(0, 10);
                                        const band = !startKey || !endKey
                                          ? undefined
                                          : endKey < todayYmd
                                            ? 'old'
                                            : startKey > todayYmd
                                              ? 'future'
                                              : 'ongoing';
                                        const releaseAsText = String(schedule.releaseAs ?? '').trim();
                                        return (
                                          <tr
                                            key={schedule.requestScheduleID || `${schedule.startDate}-${schedule.endDate}`}
                                            className={band ? `release-schedule__row--${band}` : undefined}
                                          >
                                            <td>{schedule.startDate ? formatDateShort(schedule.startDate) : '-'}</td>
                                            <td>{schedule.endDate ? formatDateShort(schedule.endDate) : '-'}</td>
                                            <td>
                                              {REQUEST_SCHEDULE_STATUS_OPTIONS.find(
                                                (option) => option.value === String(schedule.requestStatus)
                                              )?.label ?? '-'}
                                            </td>
                                            <td>{schedule.scheduleDate ? formatDateShort(schedule.scheduleDate) : '-'}</td>
                                            <td>{schedule.scheduledTime ? formatTimeToHHmm(schedule.scheduledTime) : '-'}</td>
                                            <td>
                                              {requiresScheduleReleaseHours(schedule.requestStatus, schedule.releaseAs)
                                                ? scheduleReleaseHoursLabel(readScheduleReleaseHoursFromDto(schedule))
                                                : '-'}
                                            </td>
                                            <td>
                                              {RELEASE_AS_OPTIONS.find(
                                                (option) =>
                                                  option.value === releaseAsText ||
                                                  option.label.toLowerCase() === releaseAsText.toLowerCase()
                                              )?.label ?? (releaseAsText || '-')}
                                            </td>
                                            <td>{schedule.processDate ? formatDateShort(schedule.processDate) : '-'}</td>
                                            <td>{schedule.processTime ? formatTimeToHHmm(schedule.processTime) : '-'}</td>
                                            <td>
                                              <SMSDataTableActions
                                                onEdit={() =>
                                                  setEditingSchedule({ requestId: request.requestId, schedule })
                                                }
                                                onDelete={() => {
                                                  if (!schedule.requestScheduleID) return;
                                                  setSchedulePendingDelete({
                                                    requestId: request.requestId,
                                                    scheduleId: schedule.requestScheduleID,
                                                  });
                                                }}
                                              />
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </SMSBox>
                                <SMSPagination
                                  className="daily-workspace__positions-pagination"
                                  variant="compact"
                                  currentPage={paging.page}
                                  pageSize={paging.pageSize}
                                  totalItems={scheduleTotal}
                                  loading={schedulesLoading}
                                  onPageChange={(page) =>
                                    setSchedulePaging((current) => ({
                                      ...current,
                                      [request.requestId]: { ...paging, page },
                                    }))
                                  }
                                  onPageSizeChange={(pageSize) =>
                                    setSchedulePaging((current) => ({
                                      ...current,
                                      [request.requestId]: { page: 1, pageSize },
                                    }))
                                  }
                                />
                              </>
                            )}
                          </SMSBox>
                        )}
                      </SMSBox>
                    );
                  })}
                </SMSBox>
              </SMSBox>
            )}
          </section>
        )}
      </SMSBox>
      <SMSRequestScheduleModal
        key={
          editingSchedule
            ? `${editingSchedule.schedule.requestScheduleID}|${editingSchedule.schedule.startDate}|${editingSchedule.schedule.endDate}`
            : 'closed'
        }
        open={Boolean(editingSchedule && editingRequest)}
        onClose={() => setEditingSchedule(null)}
        onSave={(payload) => {
          void saveSchedule(payload);
        }}
        initialDraft={editingSchedule ? scheduleDraft(editingSchedule.schedule) : emptyRequestScheduleModalDraft()}
        selectedType={scheduleRecurrenceType(editingRequest?.requestType?.requestType)}
        boundStartDate={(editingRequest?.startDate ?? '').slice(0, 10)}
        boundEndDate={(editingRequest?.endDate ?? '').slice(0, 10)}
        addScheduleStartMinDate={(editingRequest?.startDate ?? '').slice(0, 10)}
        otherScheduleRanges={otherScheduleRanges}
        today={todayDate}
        minProcessDate={todayDate}
        isLoading={scheduleSaving}
        requestSchedulesLoading={false}
        releaseAsDropdownOptions={RELEASE_AS_OPTIONS}
        parentFieldErrors={{}}
        isEditing
      />
      <SMSConfirmDialog
        open={schedulePendingDelete != null}
        onClose={() => setSchedulePendingDelete(null)}
        onConfirm={async () => {
          if (!schedulePendingDelete) return;
          await deleteSchedule(schedulePendingDelete.requestId, schedulePendingDelete.scheduleId);
          setSchedulePendingDelete(null);
        }}
        title={DAILY_ADMINISTRATION.DELETE_SCHEDULE_TITLE}
        message={DAILY_ADMINISTRATION.DELETE_SCHEDULE_MESSAGE}
        confirmText={DAILY_ADMINISTRATION.DELETE_SCHEDULE_CONFIRM}
        cancelText={DAILY_ADMINISTRATION.DELETE_SCHEDULE_CANCEL}
        variant="error"
      />
    </SMSBox>
  );
};
