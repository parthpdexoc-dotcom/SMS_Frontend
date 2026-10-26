import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SMSButton,
  SMSTextField,
  SMSDatePicker,
  SMSSwitch,
  SMSIcon,
  SMSIconButton,
  SMSLoader,
  SMSBox,
  SMSGrid,
  SMSTabs,
} from '@/components/smsatoms';
import {
  SMSConfirmDialog,
  PlaceholderCardGrid,
  createPlaceholderCard,
  type PlaceholderCard,
} from '@/components/smsmolecules';
import { SMSModal } from '@/components/smsorganisms';
import { REQUESTER, AVAILABLE_POST, OPEN_JOBS_PAGE } from '@/constants/strings';
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants/tablePagination';
import { fetchAssignableEmployeesByRequestThunk } from '@/store/slices/requestSlice';
import {
  bulkAssignPostPositionsThunk,
  type BulkAssignTimeConflictRejected,
  fetchPostPositionsDatesByPostId,
} from '@/store/slices/postPositionSlice';
import {
  fetchPlaceholdersThunk,
  searchPlaceholdersThunk,
  updatePlaceholdersVisibilityThunk,
} from '@/store/slices/placeholderSlice';
import { useDebounce } from '@/hooks/useDebounceSearch';
import { PostPositionResponse, PostPositionStatus } from '@/types/postPosition';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchSpecialEventEmployeesThunk, clearSpecialEventEmployees } from '@/store/slices/tenureWaitingPositionSlice';
import { showToast } from '@/store/slices/toastSlice';
import { PlaceholderStatus } from '@/types/placeholder';
import { RequestResponse, type PostInRequestListDto, type PostPositionInRequestListDto } from '@/types/request';
import { Post } from '@/types/post';
import { formatLastNameCommaFirstName } from '@/utils';
import {
  isValidOptionalPhone,
  isValidOptionalPlaceholderBadge,
} from '@/utils/validationUtils';
import { formatDateToYYYYMMDD, enumerateInclusiveYmdStringKeys } from '@/utils/dateTimeUtils';
import { EmployeeCard } from '@/components/smsmolecules/EmployeeCard';
import type {
  BulkAssignPlaceholderItem,
  BulkAssignPostPositionRequest,
} from '@/services/requestService';
import './RequesterList.css';

/** Bulk time-conflict modal: text comes from the API (`timeConflictDialogMessage` or `message`). */
function getBulkTimeConflictModalMessage(conflict: Partial<BulkAssignTimeConflictRejected>): string {
  const dialog = String(conflict.timeConflictDialogMessage ?? '').trim();
  if (dialog) return dialog;
  return String(conflict.message ?? '').trim() || AVAILABLE_POST.DETAILS.CONFLICT.MESSAGE_DEFAULT;
}

/**
 * After user declines overlap confirmation: employees to assign on the follow-up request.
 * Server stops bulk after the first conflict — if conflict rows omitted `employeeId`, skip the first requested id only.
 */
function remainingEmployeeIdsAfterDecliningConflict(
  pending: BulkAssignPostPositionRequest,
  conflictingEmployeeIds: string[]
): string[] {
  const skip = new Set(
    conflictingEmployeeIds.map((id) => String(id).trim().toLowerCase()).filter(Boolean)
  );
  let remaining = pending.employeeIDs.filter((id) => !skip.has(String(id).trim().toLowerCase()));
  if (pending.employeeIDs.length > 1 && remaining.length === pending.employeeIDs.length) {
    remaining = pending.employeeIDs.slice(1);
  }
  return remaining;
}

type BulkTimeConflictSnapshot = { bulk: BulkAssignPostPositionRequest; conflictingIds: string[] };

type PlaceholderVisibilityTab = 'all' | 'visible' | 'hidden' | 'archived';

function bulkAssignPayloadAfterDecliningConflict(snapshot: BulkTimeConflictSnapshot): BulkAssignPostPositionRequest | null {
  const { bulk, conflictingIds } = snapshot;
  if (bulk.isPlaceholder === true) {
    return {
      postID: bulk.postID,
      dateOfWork: bulk.dateOfWork,
      employeeIDs: [],
      isPlaceholder: true,
      placeholders: bulk.placeholders,
    };
  }
  if (!bulk.employeeIDs.length) return null;
  const remaining = remainingEmployeeIdsAfterDecliningConflict(bulk, conflictingIds);
  if (!remaining.length) return null;
  return {
    postID: bulk.postID,
    dateOfWork: bulk.dateOfWork,
    employeeIDs: remaining,
    ...(bulk.isTransfer === true && bulk.sourcePostPositionId
      ? { isTransfer: true, sourcePostPositionId: bulk.sourcePostPositionId }
      : {}),
  };
}

export interface AssignEmployeesModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: Post | PostInRequestListDto;
  request?: RequestResponse;
  /** When opened from row Transfer action, primary action is labeled Transfer. */
  variant?: 'assign' | 'transfer';
  /** Assigned row user clicked Transfer on; sent as bulk-assign `sourcePostPositionId` when variant is transfer. */
  transferSourcePostPosition?: PostPositionResponse | PostPositionInRequestListDto | null;
  /** YYYY-MM-DD work date to pre-select (e.g. Open Jobs dashboard row). */
  initialWorkDate?: string;
  /** When true (e.g. Open Jobs assign), work date is fixed to `initialWorkDate` and bulk assign uses it. */
  lockWorkDate?: boolean;
  onAssignSuccess?: (dateOfWork: string) => void;
}

const readAssignModalRequestId = (
  post: Post | PostInRequestListDto,
  request?: RequestResponse
): string => (request?.requestID || ('requestID' in post ? post.requestID : '') || '').trim();

const readAssignModalPostLength = (post: Post | PostInRequestListDto): number =>
  'postLength' in post ? post.postLength : 0;

export const AssignEmployeesModal: React.FC<AssignEmployeesModalProps> = ({
  isOpen,
  onClose,
  post,
  request,
  variant = 'assign',
  transferSourcePostPosition = null,
  initialWorkDate,
  lockWorkDate = false,
  onAssignSuccess,
}) => {
  const dispatch = useAppDispatch();
  const isTransferVariant = variant === 'transfer';
  const lockedWorkDateYmd = useMemo(() => {
    const t = initialWorkDate?.trim() ?? '';
    return lockWorkDate && t ? t : '';
  }, [lockWorkDate, initialWorkDate]);
  const workDatePickerDisabled = isTransferVariant || lockWorkDate;
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set());
  const [isPlaceholderMode, setIsPlaceholderMode] = useState(false);
  const [placeholderCards, setPlaceholderCards] = useState<PlaceholderCard[]>([]);
  const [selectedPlaceholderIds, setSelectedPlaceholderIds] = useState<Set<string>>(new Set());
  const [visibilitySelectedIds, setVisibilitySelectedIds] = useState<Set<string>>(new Set());
  const [placeholderTab, setPlaceholderTab] = useState<PlaceholderVisibilityTab>('visible');
  const [placeholderTabTotal, setPlaceholderTabTotal] = useState(0);
  const [placeholderPage, setPlaceholderPage] = useState(1);
  const [placeholderHasMore, setPlaceholderHasMore] = useState(false);
  const [placeholderLoadingMore, setPlaceholderLoadingMore] = useState(false);
  const [showPlaceholderValidationErrors, setShowPlaceholderValidationErrors] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const isPlaceholderModeRef = useRef(false);
  const placeholderBodyRef = useRef<HTMLDivElement | null>(null);
  const placeholderLoadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const isLoadingPlaceholders = useAppSelector((state) => state.placeholder.isLoading);
  const isSavingPlaceholders = useAppSelector((state) => state.placeholder.isSaving);

  const selectedPlaceholderCards = useMemo(
    () =>
      placeholderCards.filter(
        (c) => selectedPlaceholderIds.has(c.id) && c.placeholderStatus !== PlaceholderStatus.Hidden && c.placeholderStatus !== PlaceholderStatus.Archived
      ),
    [placeholderCards, selectedPlaceholderIds]
  );

  const placeholderItems = useMemo((): BulkAssignPlaceholderItem[] => {
    return selectedPlaceholderCards
      .filter((c) => c.firstName.trim().length > 0 && c.lastName.trim().length > 0)
      .map((c) => {
        const placeholderId = c.placeholderId?.trim() || undefined;
        const isUniquePerPosition = c.isUniquePerPosition;
        const badgeDigits = isUniquePerPosition ? '' : c.employeeNumber.replace(/\D/g, '');
        return {
          ...(placeholderId ? { placeholderId } : {}),
          firstName: c.firstName.trim(),
          lastName: c.lastName.trim(),
          enableInvoiceAndPayroll: c.enableInvoiceAndPayroll === true,
          isUniquePerPosition,
          ...(c.contactNumber.trim()
            ? { contactNumber: c.contactNumber.replace(/\D/g, '') }
            : {}),
          ...(badgeDigits.length > 0 ? { employeeNumber: badgeDigits } : {}),
        };
      });
  }, [selectedPlaceholderCards]);
  const hasIncompletePlaceholderName = useMemo(
    () =>
      selectedPlaceholderCards.some((c) => {
        const hasAny =
          c.firstName.trim().length > 0 ||
          c.lastName.trim().length > 0 ||
          c.employeeNumber.trim().length > 0 ||
          c.contactNumber.trim().length > 0;
        if (!hasAny) return false;
        return !c.firstName.trim() || !c.lastName.trim();
      }),
    [selectedPlaceholderCards]
  );
  const hasInvalidPlaceholderFields = useMemo(
    () =>
      selectedPlaceholderCards.some(
        (c) =>
          !isValidOptionalPhone(c.contactNumber) ||
          (!c.isUniquePerPosition && !isValidOptionalPlaceholderBadge(c.employeeNumber))
      ),
    [selectedPlaceholderCards]
  );
  const hasAnyPlaceholderName = placeholderItems.length > 0;
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');
  const debouncedPlaceholderSearch = useDebounce(
    isPlaceholderMode ? employeeSearchQuery : '',
    500
  );
  const debouncedEmployeeSearch = useDebounce(
    !isPlaceholderMode ? employeeSearchQuery : '',
    500
  );
  const placeholderLoadIdRef = useRef(0);
  const [useRegularAssignableEmployees, setUseRegularAssignableEmployees] = useState(false);
  const [timeConflictOpen, setTimeConflictOpen] = useState(false);
  const [timeConflictMessage, setTimeConflictMessage] = useState<string>(AVAILABLE_POST.DETAILS.CONFLICT.MESSAGE_DEFAULT);
  const bulkTimeConflictSnapshotRef = useRef<BulkTimeConflictSnapshot | null>(null);
  const lastSpecialEventFetchKeyRef = useRef<string>('');
  const today = formatDateToYYYYMMDD(new Date());
  const requestStartKey = useMemo(() => {
    const raw = request?.startDate?.trim();
    if (!raw) return '';
    return raw.includes('T') ? raw.split('T')[0]! : raw.slice(0, 10);
  }, [request?.startDate]);

  const requestEndKey = useMemo(() => {
    const raw = request?.endDate?.trim();
    if (!raw) return '';
    return raw.includes('T') ? raw.split('T')[0]! : raw.slice(0, 10);
  }, [request?.endDate]);

  /** Earliest selectable work date: same YYYY-MM-DD as request `startDate` (no Date/timezone conversion). */
  const workDateMinKey = useMemo(() => {
    if (!requestStartKey) return today;
    return requestStartKey;
  }, [requestStartKey, today]);

  const workDateMaxKey = useMemo(() => {
    if (requestEndKey) return requestEndKey;
    if (requestStartKey) return requestStartKey;
    return '';
  }, [requestEndKey, requestStartKey]);

  const transferSourceDate = useMemo(() => {
    const raw = transferSourcePostPosition?.dateOfWork;
    if (!raw) return '';
    return raw.includes('T') ? raw.split('T')[0] : raw;
  }, [transferSourcePostPosition]);

  // Get available dates from Redux state
  const availableDates = useAppSelector((state) =>
    post.postId ? state.postPosition.availableDatesByPostId[post.postId] || [] : []
  );
  const { assignableEmployeesByRequest, assignableEmployeesLoading, assignableEmployeesError } = useAppSelector(
    (state) => state.request
  );
  const { specialEventEmployees, specialEventEmployeesLoading, specialEventEmployeesError } = useAppSelector(
    (state) => state.tenureWaitingPosition
  );
  const isSpecialEventRequest = request?.isSpecialEvent === true;
  const isUsingRegularEmployeeSource = isSpecialEventRequest && useRegularAssignableEmployees;
  const employees = isUsingRegularEmployeeSource || !isSpecialEventRequest ? assignableEmployeesByRequest : specialEventEmployees;
  const isLoading = isUsingRegularEmployeeSource || !isSpecialEventRequest ? assignableEmployeesLoading : specialEventEmployeesLoading;
  const error = isUsingRegularEmployeeSource || !isSpecialEventRequest ? assignableEmployeesError : specialEventEmployeesError;
  /**
   * `onlyDates` must list every choosable day; the API often returns a sparse set (e.g. only days with
   * generated slots), which kept the rest of the month disabled. When we have request bounds, enumerate
   * every day from [workDateMin, request end] (or start if no end) within request bounds.
   */
  const selectableAvailableDates = useMemo(() => {
    const endCap = requestEndKey || requestStartKey;
    if (requestStartKey && endCap && endCap >= workDateMinKey) {
      return enumerateInclusiveYmdStringKeys(workDateMinKey, endCap);
    }
    return availableDates
      .map((d) => (d.includes('T') ? d.split('T')[0] : d))
      .filter((d) => d >= workDateMinKey);
  }, [availableDates, workDateMinKey, requestStartKey, requestEndKey]);

  // Fetch eligible employees and dates when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedEmployeeIds(new Set());
      setEmployeeSearchQuery('');
      setIsPlaceholderMode(false);
      isPlaceholderModeRef.current = false;
      setPlaceholderCards([]);
      setSelectedPlaceholderIds(new Set());
      setVisibilitySelectedIds(new Set());
      setPlaceholderTab('visible');
      setPlaceholderTabTotal(0);
      setShowPlaceholderValidationErrors(false);
      setUseRegularAssignableEmployees(false);
      const fromOpenJobs = initialWorkDate?.trim() ?? '';
      setSelectedDate(
        isTransferVariant ? transferSourceDate : fromOpenJobs || requestStartKey || ''
      );

      // Fetch dates for the post
      if (post.postId) {
        dispatch(fetchPostPositionsDatesByPostId(post.postId));
      }
    }
  }, [
    isOpen,
    post.postId,
    dispatch,
    isTransferVariant,
    transferSourceDate,
    isSpecialEventRequest,
    request?.requestID,
    post,
    requestStartKey,
    initialWorkDate,
  ]);

  useEffect(() => {
    if (!isOpen || isPlaceholderMode) return;
    if (isSpecialEventRequest && !useRegularAssignableEmployees) return;
    const requestIdForEmployees = readAssignModalRequestId(post, request);
    if (!requestIdForEmployees) return;
    dispatch(
      fetchAssignableEmployeesByRequestThunk({
        requestId: requestIdForEmployees,
        searchTerm: debouncedEmployeeSearch.trim() || undefined,
      })
    );
  }, [
    isOpen,
    isPlaceholderMode,
    isSpecialEventRequest,
    useRegularAssignableEmployees,
    debouncedEmployeeSearch,
    request?.requestID,
    post,
    dispatch,
  ]);

  useEffect(() => {
    const requestIdForEmployees = readAssignModalRequestId(post, request);
    const workDate = (selectedDate || '').trim();

    if (!isOpen) return;
    if (useRegularAssignableEmployees) {
      dispatch(clearSpecialEventEmployees());
      return;
    }
    if (!isSpecialEventRequest) return;
    if (!requestIdForEmployees || !workDate) {
      dispatch(clearSpecialEventEmployees());
      return;
    }

    const fetchKey = `${requestIdForEmployees}|${workDate}`;
    if (lastSpecialEventFetchKeyRef.current === fetchKey) return;
    lastSpecialEventFetchKeyRef.current = fetchKey;

    dispatch(fetchSpecialEventEmployeesThunk({ requestId: requestIdForEmployees, dateOfWork: workDate }));
  }, [isOpen, isSpecialEventRequest, useRegularAssignableEmployees, request?.requestID, post, selectedDate, dispatch]);

  useEffect(() => {
    if (!isOpen || !isSpecialEventRequest) return;
    setSelectedEmployeeIds(new Set());
  }, [isOpen, isSpecialEventRequest, useRegularAssignableEmployees]);

  useEffect(() => {
    if (!isOpen) {
      lastSpecialEventFetchKeyRef.current = '';
      dispatch(clearSpecialEventEmployees());
      return;
    }
    if (!isOpen || !isTransferVariant || !transferSourceDate) return;
    setSelectedDate(transferSourceDate);
  }, [isOpen, isTransferVariant, transferSourceDate, dispatch]);

  // If we have no request start, pick first eligible day once the list is ready
  useEffect(() => {
    if (isTransferVariant) return;
    if (lockWorkDate && (initialWorkDate?.trim() ?? '')) return;
    if (requestStartKey) return;
    if (selectableAvailableDates.length > 0 && !selectedDate) {
      setSelectedDate(selectableAvailableDates[0]!);
    }
  }, [
    selectableAvailableDates,
    requestStartKey,
    selectedDate,
    isTransferVariant,
    lockWorkDate,
    initialWorkDate,
  ]);

  useEffect(() => {
    if (!isOpen || !lockWorkDate) return;
    const ymd = initialWorkDate?.trim() ?? '';
    if (ymd) setSelectedDate(ymd);
  }, [isOpen, lockWorkDate, initialWorkDate]);

  useEffect(() => {
    if (!isOpen) {
      setTimeConflictOpen(false);
      bulkTimeConflictSnapshotRef.current = null;
      setTimeConflictMessage(AVAILABLE_POST.DETAILS.CONFLICT.MESSAGE_DEFAULT);
    }
  }, [isOpen]);

  const selectedEmployees = useMemo(
    () => employees.filter((emp) => selectedEmployeeIds.has(emp.employeeID)),
    [employees, selectedEmployeeIds]
  );

  /** Special-event waiting list has no search API — keep local filter only for that source. */
  const displayedEmployees = useMemo(() => {
    if (!isSpecialEventRequest || useRegularAssignableEmployees) return employees;
    const q = employeeSearchQuery.trim().toLowerCase();
    if (!q) return employees;
    const qDigits = q.replace(/\D/g, '');
    return employees.filter((emp) => {
      const first = (emp.firstName || '').toLowerCase();
      const last = (emp.lastName || '').toLowerCase();
      const fullComma = formatLastNameCommaFirstName(emp.firstName, emp.lastName, '').toLowerCase();
      const fullSpace = `${first} ${last}`.trim();
      if (fullComma.includes(q) || fullSpace.includes(q) || first.includes(q) || last.includes(q)) {
        return true;
      }
      if (String(emp.badgeNumber ?? '').includes(q)) return true;
      if (emp.employeeNumber && String(emp.employeeNumber).toLowerCase().includes(q)) {
        return true;
      }
      if (emp.username && emp.username.toLowerCase().includes(q)) return true;
      if (qDigits.length > 0) {
        const phoneDigits = (emp.primaryPhone || '').replace(/\D/g, '');
        if (phoneDigits.includes(qDigits)) return true;
      }
      return false;
    });
  }, [employees, employeeSearchQuery, isSpecialEventRequest, useRegularAssignableEmployees]);

  const handleEmployeeToggle = (employeeId: string) => {
    if (isPlaceholderMode) return;
    setSelectedEmployeeIds((prev) => {
      if (variant === 'transfer') {
        if (prev.has(employeeId)) {
          return new Set<string>();
        }
        return new Set([employeeId]);
      }
      const newSet = new Set(prev);
      if (newSet.has(employeeId)) {
        newSet.delete(employeeId);
      } else {
        newSet.add(employeeId);
      }
      return newSet;
    });
  };

  const handlePlaceholderToggle = (placeholderId: string) => {
    const card = placeholderCards.find((c) => c.id === placeholderId);
    if (card?.placeholderStatus === PlaceholderStatus.Hidden || card?.placeholderStatus === PlaceholderStatus.Archived) return;
    setVisibilitySelectedIds(new Set());
    setSelectedPlaceholderIds((prev) => {
      // Transfer moves a single assignment, so placeholders are single-select like employees.
      if (isTransferVariant) {
        return prev.has(placeholderId) ? new Set<string>() : new Set([placeholderId]);
      }
      const next = new Set(prev);
      if (next.has(placeholderId)) next.delete(placeholderId);
      else next.add(placeholderId);
      return next;
    });
  };

  const handleVisibilityToggle = (placeholderId: string) => {
    setSelectedPlaceholderIds(new Set());
    setVisibilitySelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(placeholderId)) next.delete(placeholderId);
      else next.add(placeholderId);
      return next;
    });
  };

  const loadPlaceholdersForTab = useCallback(
    (tab: PlaceholderVisibilityTab, searchTerm?: string, page = 1) => {
      const status =
        tab === 'visible'
          ? PlaceholderStatus.Visible
          : tab === 'hidden'
            ? PlaceholderStatus.Hidden
            : tab === 'archived'
              ? PlaceholderStatus.Archived
              : null;
      const term = searchTerm?.trim() ?? '';
      const append = page > 1 && !term;
      const requestId = ++placeholderLoadIdRef.current;
      if (append) setPlaceholderLoadingMore(true);
      else {
        setPlaceholderPage(1);
        setPlaceholderHasMore(false);
      }

      const request = term
        ? dispatch(searchPlaceholdersThunk({ searchTerm: term, status }))
        : dispatch(
            fetchPlaceholdersThunk({
              status,
              page,
              pageSize: DEFAULT_TABLE_PAGE_SIZE,
            })
          );
      void request
        .unwrap()
        .then(({ items, totalRecords }) => {
          if (requestId !== placeholderLoadIdRef.current) return;
          if (!isPlaceholderModeRef.current) return;
          setPlaceholderTabTotal(totalRecords);
          setPlaceholderPage(page);
          // Search returns the full filtered set (no paging on that endpoint).
          setPlaceholderHasMore(
            !term && page * DEFAULT_TABLE_PAGE_SIZE < totalRecords
          );
          setPlaceholderCards((prev) => {
            // Keep unsaved local drafts on All/Visible only — never on Hidden/Archived.
            const localOnly =
              tab === 'hidden' || tab === 'archived'
                ? []
                : prev.filter((c) => !c.placeholderId?.trim());
            const nextItems = items.map((p) => createPlaceholderCard(p));
            if (!append) return [...nextItems, ...localOnly];

            const seen = new Set(
              prev.map((c) => c.placeholderId?.trim()).filter(Boolean) as string[]
            );
            const appended = nextItems.filter((c) => {
              const id = c.placeholderId?.trim();
              if (!id || seen.has(id)) return false;
              seen.add(id);
              return true;
            });
            const serverCards = prev.filter((c) => Boolean(c.placeholderId?.trim()));
            return [...serverCards, ...appended, ...localOnly];
          });
          if (!append) {
            setSelectedPlaceholderIds(new Set());
            setVisibilitySelectedIds(new Set());
          }
        })
        .catch(() => {
          /* toast handled in thunk */
        })
        .finally(() => {
          if (requestId === placeholderLoadIdRef.current) {
            setPlaceholderLoadingMore(false);
          }
        });
    },
    [dispatch]
  );

  const loadMorePlaceholders = useCallback(() => {
    if (
      !isPlaceholderMode ||
      isLoadingPlaceholders ||
      placeholderLoadingMore ||
      !placeholderHasMore ||
      debouncedPlaceholderSearch.trim()
    ) {
      return;
    }
    loadPlaceholdersForTab(placeholderTab, debouncedPlaceholderSearch, placeholderPage + 1);
  }, [
    debouncedPlaceholderSearch,
    isLoadingPlaceholders,
    isPlaceholderMode,
    loadPlaceholdersForTab,
    placeholderHasMore,
    placeholderLoadingMore,
    placeholderPage,
    placeholderTab,
  ]);

  const handlePlaceholderTabChange = useCallback(
    (value: string) => {
      const next: PlaceholderVisibilityTab =
        value === 'all' || value === 'hidden' || value === 'archived' ? value : 'visible';
      setPlaceholderTab(next);
      setPlaceholderCards([]);
      setPlaceholderTabTotal(0);
      setPlaceholderPage(1);
      setPlaceholderHasMore(false);
      setSelectedPlaceholderIds(new Set());
      setVisibilitySelectedIds(new Set());
    },
    []
  );

  /** Shared by assign and transfer: switching to placeholder mode reloads placeholders and drops employee selection. */
  const handlePlaceholderModeChange = useCallback((enabled: boolean) => {
    isPlaceholderModeRef.current = enabled;
    setIsPlaceholderMode(enabled);
    setPlaceholderCards([]);
    setPlaceholderTabTotal(0);
    setPlaceholderPage(1);
    setPlaceholderHasMore(false);
    setSelectedPlaceholderIds(new Set());
    setVisibilitySelectedIds(new Set());
    setPlaceholderTab('visible');
    setShowPlaceholderValidationErrors(false);
    setEmployeeSearchQuery('');
    if (!enabled) return;

    setSelectedEmployeeIds(new Set());
  }, []);

  useEffect(() => {
    if (!isOpen || !isPlaceholderMode) return;
    loadPlaceholdersForTab(placeholderTab, debouncedPlaceholderSearch, 1);
  }, [isOpen, isPlaceholderMode, placeholderTab, debouncedPlaceholderSearch, loadPlaceholdersForTab]);

  /**
   * Infinite scroll for the placeholder grid — same IntersectionObserver approach as Daily Administration.
   * Root is the modal body (overflow scroll), not the viewport.
   */
  useEffect(() => {
    const root = placeholderBodyRef.current;
    const sentinel = placeholderLoadMoreSentinelRef.current;
    if (!root || !sentinel) return;
    if (
      !isPlaceholderMode ||
      !placeholderHasMore ||
      isLoadingPlaceholders ||
      placeholderLoadingMore ||
      debouncedPlaceholderSearch.trim()
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMorePlaceholders();
        }
      },
      { root, rootMargin: '120px 0px', threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [
    debouncedPlaceholderSearch,
    isLoadingPlaceholders,
    isPlaceholderMode,
    loadMorePlaceholders,
    placeholderHasMore,
    placeholderLoadingMore,
    placeholderCards.length,
  ]);

  /** 409: open dialog and stash bulk payload + conflicting ids on ref for Yes/No handlers. */
  const applyBulkTimeConflictRejection = useCallback((err: unknown) => {
    const c = err as Partial<BulkAssignTimeConflictRejected> | undefined;
    if (c?.kind !== 'timeConflict' || !c.bulkAssignData) return false;
    const conflictingIds = Array.isArray(c.conflictingEmployeeIds) ? c.conflictingEmployeeIds.map(String) : [];
    bulkTimeConflictSnapshotRef.current = { bulk: c.bulkAssignData, conflictingIds };
    setTimeConflictMessage(getBulkTimeConflictModalMessage(c));
    setTimeConflictOpen(true);
    return true;
  }, []);

  const visibilityAction = useMemo(() => {
    let hideCount = 0;
    let unhideCount = 0;
    const placeholders: Record<string, PlaceholderStatus> = {};
    for (const card of placeholderCards) {
      if (!visibilitySelectedIds.has(card.id)) continue;
      if (card.placeholderStatus === PlaceholderStatus.Archived) continue;
      const id = card.placeholderId?.trim();
      if (card.placeholderStatus === PlaceholderStatus.Hidden) {
        unhideCount += 1;
        if (id) placeholders[id] = PlaceholderStatus.Visible;
      } else {
        hideCount += 1;
        if (id) placeholders[id] = PlaceholderStatus.Hidden;
      }
    }
    return { hideCount, unhideCount, placeholders };
  }, [placeholderCards, visibilitySelectedIds]);

  const archivePlaceholders = useMemo(() => {
    const placeholders: Record<string, PlaceholderStatus> = {};
    for (const card of placeholderCards) {
      if (!selectedPlaceholderIds.has(card.id)) continue;
      const id = card.placeholderId?.trim();
      if (!id || card.placeholderStatus === PlaceholderStatus.Archived) continue;
      placeholders[id] = PlaceholderStatus.Archived;
    }
    return placeholders;
  }, [placeholderCards, selectedPlaceholderIds]);

  const handleArchiveSelected = async () => {
    const ids = Object.keys(archivePlaceholders);
    if (ids.length === 0) return;
    try {
      await dispatch(
        updatePlaceholdersVisibilityThunk({ placeholders: archivePlaceholders })
      ).unwrap();
      setSelectedPlaceholderIds(new Set());
      loadPlaceholdersForTab(placeholderTab, debouncedPlaceholderSearch);
    } catch {
      /* toast handled in thunk */
    }
  };

  const handleVisibilityApply = async () => {
    const { placeholders } = visibilityAction;
    if (Object.keys(placeholders).length === 0) return;

    try {
      await dispatch(updatePlaceholdersVisibilityThunk({ placeholders })).unwrap();
      setVisibilitySelectedIds(new Set());
      loadPlaceholdersForTab(placeholderTab, debouncedPlaceholderSearch);
    } catch {
      /* toast handled in thunk */
    }
  };

  const handleAssign = async () => {
    if (Object.keys(visibilityAction.placeholders).length > 0) {
      await handleVisibilityApply();
      return;
    }
    if ((!isPlaceholderMode && selectedEmployeeIds.size === 0) || !post.postId || !selectedDate) {
      if (!selectedDate) {
        dispatch(showToast('Please select a date', 'error'));
      }
      return;
    }
    if (isPlaceholderMode && !hasAnyPlaceholderName) {
      setShowPlaceholderValidationErrors(true);
      return;
    }
    if (isPlaceholderMode && (hasIncompletePlaceholderName || hasInvalidPlaceholderFields)) {
      setShowPlaceholderValidationErrors(true);
      return;
    }

    setIsAssigning(true);
    try {
      const isTransferFlow = variant === 'transfer';
      const sourcePostPositionId = transferSourcePostPosition?.postPositionId?.trim();
      if (isTransferFlow) {
        if (!sourcePostPositionId) {
          dispatch(showToast('Cannot transfer: missing source assignment.', 'error'));
          setIsAssigning(false);
          return;
        }
        const selectedCount = isPlaceholderMode
          ? selectedPlaceholderIds.size
          : selectedEmployeeIds.size;
        if (selectedCount !== 1) {
          dispatch(
            showToast(
              isPlaceholderMode
                ? 'Transfer requires exactly one selected placeholder.'
                : 'Transfer requires exactly one selected employee.',
              'error'
            )
          );
          setIsAssigning(false);
          return;
        }
      }

      const bulkPayload: BulkAssignPostPositionRequest = {
        postID: post.postId,
        dateOfWork: selectedDate,
        employeeIDs: isPlaceholderMode ? [] : Array.from(selectedEmployeeIds),
        ...(isPlaceholderMode ? { isPlaceholder: true, placeholders: placeholderItems } : {}),
        ...(isTransferFlow && sourcePostPositionId ? { isTransfer: true, sourcePostPositionId } : {}),
      };

      await dispatch(bulkAssignPostPositionsThunk(bulkPayload)).unwrap();

      const assignedDate = selectedDate;
      onAssignSuccess?.(assignedDate);
      onClose();
      setSelectedEmployeeIds(new Set());
      setIsPlaceholderMode(false);
      isPlaceholderModeRef.current = false;
      setPlaceholderCards([]);
      setSelectedPlaceholderIds(new Set());
      setVisibilitySelectedIds(new Set());
      setSelectedDate('');
    } catch (error: unknown) {
      if (applyBulkTimeConflictRejection(error)) return;
      console.error('Failed to assign employees:', error);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleCancelTimeConflict = useCallback(async () => {
    if (isAssigning) return;
    setTimeConflictOpen(false);
    const snapshot = bulkTimeConflictSnapshotRef.current;
    bulkTimeConflictSnapshotRef.current = null;
    const followUp = snapshot ? bulkAssignPayloadAfterDecliningConflict(snapshot) : null;
    if (!followUp) return;

    setIsAssigning(true);
    try {
      await dispatch(bulkAssignPostPositionsThunk(followUp)).unwrap();
      const assignedDate = followUp.dateOfWork;
      onAssignSuccess?.(assignedDate);
      onClose();
      setSelectedEmployeeIds(new Set());
      setIsPlaceholderMode(false);
      isPlaceholderModeRef.current = false;
      setPlaceholderCards([]);
      setSelectedPlaceholderIds(new Set());
      setVisibilitySelectedIds(new Set());
      setSelectedDate('');
    } catch (e: unknown) {
      if (applyBulkTimeConflictRejection(e)) return;
      console.error('Failed to assign remaining employees after declining time conflict:', e);
    } finally {
      setIsAssigning(false);
    }
  }, [isAssigning, dispatch, onAssignSuccess, onClose, applyBulkTimeConflictRejection]);

  const handleConfirmTimeConflict = useCallback(async () => {
    const snapshot = bulkTimeConflictSnapshotRef.current;
    if (!snapshot?.bulk) {
      setTimeConflictOpen(false);
      bulkTimeConflictSnapshotRef.current = null;
      return;
    }
    setTimeConflictOpen(false);
    setIsAssigning(true);
    try {
      await dispatch(bulkAssignPostPositionsThunk({ ...snapshot.bulk, confirmConflict: true })).unwrap();
      bulkTimeConflictSnapshotRef.current = null;
      const assignedDate = snapshot.bulk.dateOfWork;
      onAssignSuccess?.(assignedDate);
      onClose();
      setSelectedEmployeeIds(new Set());
      setIsPlaceholderMode(false);
      isPlaceholderModeRef.current = false;
      setPlaceholderCards([]);
      setSelectedPlaceholderIds(new Set());
      setVisibilitySelectedIds(new Set());
      setSelectedDate('');
    } catch (e: unknown) {
      if (applyBulkTimeConflictRejection(e)) return;
      console.error('Failed to assign after time-conflict confirm:', e);
    } finally {
      setIsAssigning(false);
    }
  }, [dispatch, onAssignSuccess, onClose, applyBulkTimeConflictRejection]);

  const modalTitle = isTransferVariant ? 'Transfer Employees' : 'Assign Employees';
  const placeholderCount = placeholderItems.length;
  const { hideCount, unhideCount, placeholders: visibilityPlaceholders } = visibilityAction;
  const visibilityCount = Object.keys(visibilityPlaceholders).length;
  const primaryActionLabel = (() => {
    if (isPlaceholderMode && visibilityCount > 0) {
      const plural = (n: number) => (n !== 1 ? 's' : '');
      if (hideCount > 0 && unhideCount > 0) {
        return `Hide ${hideCount} / Unhide ${unhideCount}`;
      }
      if (unhideCount > 0) {
        return `Unhide ${unhideCount} Placeholder${plural(unhideCount)}`;
      }
      return `Hide ${hideCount} Placeholder${plural(hideCount)}`;
    }
    if (isTransferVariant) {
      return isPlaceholderMode ? 'Transfer Placeholder' : 'Transfer Employee';
    }
    if (isPlaceholderMode) {
      return `Add ${placeholderCount} Placeholder${placeholderCount !== 1 ? 's' : ''}`;
    }
    return `Assign ${selectedEmployeeIds.size} Employee${selectedEmployeeIds.size !== 1 ? 's' : ''}`;
  })();

  const placeholderTabOptions = useMemo(() => {
    const withCount = (label: string, id: PlaceholderVisibilityTab) =>
      placeholderTab === id ? `${label} (${placeholderTabTotal})` : label;
    return [
      {
        id: 'all',
        label: withCount(REQUESTER.ASSIGN_EMPLOYEES.PLACEHOLDER_TAB_ALL, 'all'),
      },
      {
        id: 'visible',
        label: withCount(REQUESTER.ASSIGN_EMPLOYEES.PLACEHOLDER_TAB_VISIBLE, 'visible'),
      },
      {
        id: 'hidden',
        label: withCount(REQUESTER.ASSIGN_EMPLOYEES.PLACEHOLDER_TAB_HIDDEN, 'hidden'),
      },
      {
        id: 'archived',
        label: withCount(REQUESTER.ASSIGN_EMPLOYEES.PLACEHOLDER_TAB_ARCHIVED, 'archived'),
      },
    ];
  }, [placeholderTab, placeholderTabTotal]);

  return (
    <>
      <SMSModal
        open={isOpen}
        onClose={onClose}
        title={modalTitle}
        size="large"
        className="requester-list__assign-employees-modal"
        contentClassName="requester-list__assign-employees-modal-content"
        disablePaperScroll
      >
        <div className="assign-employees">
          {/* Static header (date picker + search) */}
          <div className="assign-employees__header">
            <div className="assign-employees__filters-row">
              <div className="assign-employees__date">
                <SMSDatePicker
                  label="Work Date"
                  value={selectedDate}
                  onChange={setSelectedDate}
                  placeholder={
                    isTransferVariant
                      ? 'Work date is fixed for transfer'
                      : lockWorkDate
                        ? OPEN_JOBS_PAGE.WORK_DATE_LOCKED_PLACEHOLDER
                        : 'Select a date'
                  }
                  required
                  minDate={workDateMinKey}
                  maxDate={workDateMaxKey || undefined}
                  onlyDates={lockedWorkDateYmd ? [lockedWorkDateYmd] : selectableAvailableDates}
                  disabled={workDatePickerDisabled}
                />
              </div>
              <div className="assign-employees__search">
                <SMSTextField
                  fullWidth
                  size="small"
                  label="Search"
                  value={employeeSearchQuery}
                  onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                  placeholder={
                    isPlaceholderMode
                      ? REQUESTER.ASSIGN_EMPLOYEES.PLACEHOLDER_SEARCH_PLACEHOLDER
                      : 'Name, badge, or phone'
                  }
                  inputProps={{
                    'aria-label': isPlaceholderMode ? 'Filter placeholders' : 'Filter employees',
                  }}
                />
              </div>
              <div
                className="assign-employees__source-toggle"
                style={{ display: 'flex', alignItems: 'center', paddingTop: '0.25rem' }}
              >
                <SMSSwitch
                  label="Add Placeholder"
                  checked={isPlaceholderMode}
                  onChange={(e) => handlePlaceholderModeChange(e.target.checked)}
                />
              </div>
              {isSpecialEventRequest && (
                <div
                  className="assign-employees__source-toggle"
                  style={{ display: 'flex', alignItems: 'center', paddingTop: '0.25rem' }}
                >
                  <SMSSwitch
                    label={REQUESTER.ASSIGN_EMPLOYEES.ALL_ASSIGNABLE_EMPLOYEES}
                    checked={useRegularAssignableEmployees}
                    onChange={(e) => setUseRegularAssignableEmployees(e.target.checked)}
                  />
                </div>
              )}
            </div>
            {isPlaceholderMode && (
              <div className="assign-employees__placeholder-tabs">
                <SMSTabs
                  options={placeholderTabOptions}
                  value={placeholderTab}
                  onChange={handlePlaceholderTabChange}
                  size="small"
                  distribution="content"
                />
              </div>
            )}
            {/* Selected Employees Pills */}
            {!isPlaceholderMode && selectedEmployees.length > 0 && (
              <div className="assign-employees__selected">
                <div className="assign-employees__selected-label">
                  {isTransferVariant ? 'Selected employee' : `Selected Employees (${selectedEmployees.length})`}
                </div>
                <div className="assign-employees__selected-list">
                  {selectedEmployees.map((emp) => {
                    const fullName = formatLastNameCommaFirstName(emp.firstName, emp.lastName, 'Unknown');
                    const initials = `${emp.firstName?.[0] || ''}${emp.lastName?.[0] || ''}`.toUpperCase() || '?';

                    return (
                      <div key={emp.employeeID} className="assign-employees__selected-chip">
                        <div className="assign-employees__selected-avatar">{initials}</div>
                        <div className="assign-employees__selected-text">
                          <div className="assign-employees__selected-name">{fullName}</div>
                          {emp.badgeNumber && (
                            <div className="assign-employees__selected-badge">Badge: {emp.badgeNumber}</div>
                          )}
                        </div>
                        <SMSIconButton
                          size="small"
                          className="assign-employees__selected-remove"
                          onClick={() => handleEmployeeToggle(emp.employeeID)}
                          aria-label="Remove selected employee"
                          title="Remove selected employee"
                          type="button"
                        >
                          <SMSIcon name="close" size="sm" />
                        </SMSIconButton>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Scrolling body (placeholder cards or employee grid) */}
          <div className="assign-employees__body" ref={placeholderBodyRef}>
            {isPlaceholderMode ? (
              isLoadingPlaceholders && !placeholderLoadingMore ? (
                <SMSBox sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <SMSLoader loadingText="Loading placeholders..." aria-label="Loading placeholders..." />
                </SMSBox>
              ) : (
              <>
              <PlaceholderCardGrid
                cards={placeholderCards}
                onChange={setPlaceholderCards}
                selectedIds={selectedPlaceholderIds}
                onToggleSelect={handlePlaceholderToggle}
                visibilitySelectedIds={visibilitySelectedIds}
                onToggleVisibilitySelect={handleVisibilityToggle}
                showAddCard={placeholderTab !== 'hidden' && placeholderTab !== 'archived'}
                disabled={isAssigning || isSavingPlaceholders}
                showValidationErrors={showPlaceholderValidationErrors}
              />
              {placeholderHasMore && !debouncedPlaceholderSearch.trim() && (
                <div
                  ref={placeholderLoadMoreSentinelRef}
                  className="daily-admin-load-more-sentinel"
                  role="status"
                  aria-live="polite"
                  aria-busy={placeholderLoadingMore}
                >
                  {placeholderLoadingMore && (
                    <SMSBox sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
                      <SMSLoader loadingText="Loading more..." aria-label="Loading more placeholders..." />
                    </SMSBox>
                  )}
                </div>
              )}
              </>
              )
            ) : (
            <SMSGrid container spacing={1} className="assign-employees__grid">
              {isLoading ? (
                <SMSGrid item xs={12}>
                  <SMSBox sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <SMSLoader loadingText="Loading employees..." aria-label="Loading employees..." />
                  </SMSBox>
                </SMSGrid>
              ) : error ? (
                <SMSGrid item xs={12}>
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--error-color)' }}>{error}</div>
                </SMSGrid>
              ) : employees.length === 0 && !employeeSearchQuery.trim() ? (
                <SMSGrid item xs={12}>
                  <div style={{ textAlign: 'center', padding: '2rem' }}>No employees found</div>
                </SMSGrid>
              ) : displayedEmployees.length === 0 ? (
                <SMSGrid item xs={12}>
                  <div style={{ textAlign: 'center', padding: '2rem' }}>No employees match your search</div>
                </SMSGrid>
              ) : (
                displayedEmployees.map((employee) => {
                  const isSelected = selectedEmployeeIds.has(employee.employeeID);
                  // Convert EmployeeResponse to PostPositionResponse format for EmployeeCard
                  const positionData: PostPositionResponse = {
                    postPositionId: '',
                    postID: post.postId || '',
                    badgeNumber: employee.badgeNumber,
                    firstName: employee.firstName,
                    lastName: employee.lastName,
                    primaryPhone: employee.primaryPhone,
                    dateOfWork: '', // Post no longer has a date - dateOfWork comes from PostPosition
                    postStartTime: post.postStartTime,
                    lengthOfWork: readAssignModalPostLength(post),
                    equipmentRequired: false,
                    postPositionStatus: PostPositionStatus.Waiting,
                    isUniquePerPosition: false,
                  };
                  const profilePhotoDataUrl =
                    employee.profilePhotoBase64 && employee.profilePhotoContentType
                      ? `data:${employee.profilePhotoContentType};base64,${employee.profilePhotoBase64}`
                      : null;

                  return (
                    <SMSGrid item xs={12} sm={6} md={4} lg={3} xl={2} key={employee.employeeID}>
                      <EmployeeCard
                        position={positionData}
                        profilePhotoDataUrl={profilePhotoDataUrl}
                        showCheckbox={true}
                        isChecked={isSelected}
                        onCheckboxChange={() => handleEmployeeToggle(employee.employeeID)}
                        showCloseButton={false}
                      />
                    </SMSGrid>
                  );
                })
              )}
            </SMSGrid>
            )}
          </div>

          {/* Footer Actions */}
          <div className="assign-employees__footer">
            {isPlaceholderMode && (placeholderTab === 'all' || placeholderTab === 'visible') ? (
              <SMSButton
                color="error"
                onClick={() => void handleArchiveSelected()}
                disabled={
                  Object.keys(archivePlaceholders).length === 0 || isAssigning || isSavingPlaceholders
                }
                leftIcon={<SMSIcon name="archive" size="sm" />}
              >
                {`${REQUESTER.ASSIGN_EMPLOYEES.PLACEHOLDER_ARCHIVE_SELECTED} (${Object.keys(archivePlaceholders).length})`}
              </SMSButton>
            ) : (
              <span />
            )}
            <div className="assign-employees__footer-actions">
              <SMSButton onClick={onClose} disabled={isAssigning || isSavingPlaceholders}>
                Cancel
              </SMSButton>
              <SMSButton
                onClick={handleAssign}
                disabled={
                  (isPlaceholderMode
                    ? selectedPlaceholderCards.length === 0 && visibilityCount === 0
                    : selectedEmployeeIds.size === 0) ||
                  isAssigning ||
                  isSavingPlaceholders ||
                  (visibilityCount === 0 && !selectedDate)
                }
                loading={isAssigning || (isPlaceholderMode && isSavingPlaceholders)}
              >
                {primaryActionLabel}
              </SMSButton>
            </div>
          </div>
        </div>
      </SMSModal>
      <SMSConfirmDialog
        open={timeConflictOpen}
        onClose={handleCancelTimeConflict}
        title={AVAILABLE_POST.DETAILS.CONFLICT.TITLE}
        message={timeConflictMessage}
        confirmText={AVAILABLE_POST.DETAILS.CONFLICT.CONFIRM}
        cancelText={AVAILABLE_POST.DETAILS.CONFLICT.CANCEL}
        onConfirm={() => void handleConfirmTimeConflict()}
        variant="warning"
        confirmButtonColor="primary"
        loading={isAssigning}
        loadingMessage={AVAILABLE_POST.DETAILS.TAKE_POST_CONFIRM.LOADING}
      />
    </>
  );
};
