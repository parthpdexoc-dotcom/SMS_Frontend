import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { Menu, MenuItem } from '@mui/material';
import type { DataTableColumn } from '@/components/smsorganisms';
import {
  DAILY_ADMINISTRATION,
  INVOICE_GRID,
  PAYMENT_GRID,
  REQUESTER,
  REQUEST_FORM,
  REQUESTER_GRID_MENU,
  REQUESTER_STATEMENT_GRID,
  MENU_ITEMS,
  POST_POSITION,
} from '@/constants/strings';
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants/tablePagination';
import { RequestResponse, RequestStatus, RequestTypes } from '@/types/request';
import {
  deleteRequestThunk,
  cloneRequestThunk,
} from '@/store/slices/requestSlice';
import { fetchPostPositions, cancelPostPositionThunk, swapPostPositionCallSignsThunk } from '@/store/slices/postPositionSlice';
import {
  postPositionDayExpandKey,
  postPositionFilterCacheKey,
  getSelectedDatesForPost,
  getDefaultMonthCollectDates,
} from '@/utils/postPositionDateTree';
import {
  extractYyyyMmDdPrefix,
  getDefaultDailyAdminDateRange,
  getDefaultMonthPairYmdDates,
  mergeYmdIntoSortedDates,
  toSortedUniqueYmdDates,
} from '@/utils/dateTimeUtils';
import { isDailyWorkspacePath } from '@/utils/dailyWorkspaceSessionState';
import { upsertPlaceholderThunk } from '@/store/slices/placeholderSlice';
import { PostPositionResponse, PostPositionStatus } from '@/types/postPosition';
import { InvoicePreviewModal } from '@/components/smsmolecules/InvoicePreviewModal/InvoicePreviewModal';
import { SendEmailModal, type SendEmailContext } from '@/components/smsmolecules/SendEmailModal';
import { NotificationHistoryModal } from '@/components/smsmolecules/NotificationHistoryModal';
import { UploadFileModal } from '@/components/smsmolecules/UploadFileModal';
import {
  SMSButton,
  SMSIcon,
  SMSIconButton,
  SMSCheckbox,
  SMSLoader,
  SMSTypography,
  SMSStack,
  SMSBox,
  SMSTabs,
  SMSDropdown,
  type SMSDropdownOption,
  type SMSTabOption,
} from '@/components/smsatoms';
import { SMSConfirmDialog, SMSLoadingState } from '@/components/smsmolecules';
import { SMSAuditHistoryModal, SMSDataTableWrapper, SMSModal, RequestScheduleListModal } from '@/components/smsorganisms';
import {
  fetchRequesters,
  removeRequester,
  searchRequestersThunk,
  setPagination,
} from '@/store/slices/requesterSlice';
import { fetchQuestionnairesByDepartment } from '@/store/slices/questionnaireSlice';
import { fetchRequesterQuestionnairesByRequesterIdAsync } from '@/store/slices/requesterQuestionnaireSlice';
import { QuestionnaireResponse } from '@/types/questionnaire';
import {
  deleteRequesterQuestionnaire,
  getRequesterQuestionnairesByRequesterId,
  upsertRequesterQuestionnaire,
} from '@/services/questionnaireService';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  RequesterResponse,
  RequesterWithRequestsListResponse,
} from '@/types/requester';
import { getPosts } from '@/services/postService';
import {
  DEFAULT_REQUESTER_WITH_REQUESTS_STATUSES,
  DEFAULT_REQUESTER_WITH_REQUEST_TYPES,
  fetchRequesterWorkspaceList,
} from '@/services/requesterService';
import { fileUpload, getFilesOrFile } from '@/services/fileUploadService';
import type { FileUploadDto } from '@/types/fileUpload';
import { showToast } from '@/store/slices/toastSlice';
import './RequesterList.css';
import { SMSRosterModal } from '@/components/smsorganisms';
import { Post } from '@/types/post';
import { formatDateShort, formatLastNameCommaFirstName, formatPhoneNumber } from '@/utils';
import { buildRequesterScopedAdminRoute } from '@/utils/requesterAdminNavigation';
import {
  readPostPositionIsPlaceholder,
  renderLabeledStatusPill,
  renderPostPositionStatusPill,
} from '@/utils/postPositionStatusPill';
import {
  clearDailyAdminSessionState,
  hasDailyAdminSearchParams,
  readDailyAdminFromSearchParams,
  readDailyAdminSessionState,
  resolveDailyAdminFilters,
  stripDailyAdminSearchParams,
  writeDailyAdminSessionState,
} from '@/utils/dailyAdminSessionState';
import ReactDOM from 'react-dom';
import { EmployeeCard } from '@/components/smsmolecules/EmployeeCard';
import { CardEditModal, type CardEditDraft } from '@/components/smsmolecules/CardEditModal/CardEditModal';
import { buildPlaceholderUpsertPayload } from '@/services/placeholderService';
import { usePagination } from '@/hooks/usePagination';
import { useDebounce } from '@/hooks/useDebounceSearch';
import { ManageRequester } from './ManageRequester';
import { AssignEmployeesModal } from './AssignEmployeesModal';
import { ClosedUnclosedAssignments } from './ClosedUnclosedAssignments';
import { DailyAdministration } from './DailyAdministration';
import {
  type AuditHistoryRow,
} from '@/utils/auditHistoryUtils';
import { AuditHistoryTable, getAuditHistory } from '@/services/auditHistoryService';
import { updatePostPositionCallSign, POST_POSITION_POST_CALL_SIGN_ID_FIELD_NAME, POST_POSITION_CALL_SIGN_FIELD_NAME } from '@/services/postPositionService';
import { isDefineCallSignEnabled } from '@/types/postPosition';
import type { PostCallSign } from '@/types/postCallSign';
import { fetchAvailablePostCallSignsThunk } from '@/store/slices/postCallSignSlice';
import { availablePostCallSignCacheKey } from '@/types/postCallSign';
import { clonePostThunk, deletePostThunk } from '@/store/slices/postSlice';
import { fetchDepartmentConfigByDepartmentId } from '@/store/slices/departmentConfigurationSlice';
import { hasRole, UserRoleType } from '@/types/userRole';

/** Label for View History modal â€” same precedence as the Name column, plus billing / dept # fallbacks. */
const getRequesterNameForHistoryTitle = (row: RequesterResponse): string => {
  const candidates = [row.name, row.invoiceBillingName, row.departmentDefinedNumber];
  for (const c of candidates) {
    const s = typeof c === 'string' ? c.trim() : '';
    if (s) return s;
  }
  return String(row.requesterID ?? '').trim();
};

/**
 * Daily admin post employee list shows every post position with its real `Status` pill (incl. Cancelled / Closed),
 * so we no longer hide cancelled rows. Action buttons are suppressed per status by `isDailyAdminPostPositionActionsHidden`.
 */
const passThroughPostPositions = (positions: PostPositionResponse[]): PostPositionResponse[] => positions;

/** Default date selection when expanding a post in Daily Administration (GET by-post/{id}). */
function resolveDailyAdminDefaultPositionDates(collectDates: string[]): string[] {
  const monthPair = getDefaultMonthPairYmdDates(collectDates);
  if (monthPair.length > 0) return monthPair;
  const singleMonth = getDefaultMonthCollectDates(collectDates);
  if (singleMonth.length > 0) return singleMonth;
  return collectDates.length > 0 ? [...collectDates].sort() : [];
}

/** Keep collect dates inside the Daily Administration Start/End filter window. */
function clampCollectDatesToFilterRange(
  dates: readonly string[],
  startDate: string,
  endDate: string
): string[] {
  const start = extractYyyyMmDdPrefix(startDate);
  const end = extractYyyyMmDdPrefix(endDate);
  const normalized = toSortedUniqueYmdDates(dates);
  if (!start && !end) return normalized;
  return normalized.filter((d) => (!start || d >= start) && (!end || d <= end));
}

/** Read work date from camelCase or PascalCase API rows. */
function readPositionDateOfWork(row: PostPositionResponse | Record<string, unknown>): string {
  const raw = row as Record<string, unknown>;
  return String(raw.dateOfWork ?? raw.DateOfWork ?? '').trim();
}

/** Derive calendar dates from loaded rows when date APIs return empty for the filter range. */
function collectDatesFromPositions(
  positions: readonly PostPositionResponse[],
  startDate: string,
  endDate: string
): string[] {
  return clampCollectDatesToFilterRange(
    positions.map((row) => readPositionDateOfWork(row)),
    startDate,
    endDate
  );
}

/** Card edit initial state from a placeholder post position row (badge already stripped by API). */
const placeholderEditDraftFromRow = (row: PostPositionResponse): CardEditDraft => ({
  firstName: row.firstName?.trim() ?? '',
  lastName: row.lastName?.trim() ?? '',
  employeeNumber: row.badgeNumber?.trim() ?? '',
  contactNumber: row.primaryPhone ? String(row.primaryPhone) : '',
  enableInvoiceAndPayroll: row.enableInvoiceAndPayroll === true,
  isUniquePerPosition: row.isUniquePerPosition === true,
});

const getPostPositionStatusValue = (
  position: PostPositionResponse | null | undefined
): number => {
  if (!position) return Number.NaN;
  const raw = position as unknown as Record<string, unknown>;
  const value = position.postPositionStatus ?? raw.PostPositionStatus;
  return Number(value);
};

/** Daily admin post employee list: no Unassign / Transfer for terminal or moved rows. */
const DAILY_ADMIN_NO_ACTION_POST_POSITION_STATUSES: ReadonlySet<number> = new Set([
  PostPositionStatus.Closed,
  PostPositionStatus.Cancelled,
  PostPositionStatus.ClosedAndSplit,
  PostPositionStatus.Transferred,
  PostPositionStatus.SpecialEvent,
  PostPositionStatus.Declined,
]);

const isDailyAdminPostPositionActionsHidden = (position: PostPositionResponse): boolean =>
  DAILY_ADMIN_NO_ACTION_POST_POSITION_STATUSES.has(getPostPositionStatusValue(position));

const buildDailyAdminFilterDefaults = () => {
  const { startDate, endDate } = getDefaultDailyAdminDateRange();
  return {
    startDate,
    endDate,
    requestStatuses: DEFAULT_REQUESTER_WITH_REQUESTS_STATUSES.map((status) => Number(status)),
    requestTypes: DEFAULT_REQUESTER_WITH_REQUEST_TYPES.map((type) => Number(type)),
  };
};

const DAILY_REQUESTERS_PAGE_SIZE = DEFAULT_TABLE_PAGE_SIZE;

const toDateOnly = (value?: string | null): string => {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.includes('T') ? trimmed.split('T')[0] : trimmed.slice(0, 10);
};

const isSamePostPositionWorkDate = (
  left: PostPositionResponse,
  right: PostPositionResponse
): boolean => toDateOnly(left.dateOfWork) === toDateOnly(right.dateOfWork);

const canSwapPostPositionCallSign = (row: PostPositionResponse): boolean =>
  !isDailyAdminPostPositionActionsHidden(row) &&
  getPostPositionStatusValue(row) === PostPositionStatus.Assigned;

const getPostPositionCallSignLabel = (row: PostPositionResponse): string => {
  const trimmed = (row.callSign ?? '').trim();
  return trimmed || POST_POSITION.CALL_SIGN.EMPTY_OPTION;
};

const getPostPositionEmployeeLabel = (row: PostPositionResponse): string =>
  row.employeeName ??
  formatLastNameCommaFirstName(row.firstName, row.lastName, 'Unknown');

const readPostCallSignId = (row: PostPositionResponse): string => {
  const raw = row as unknown as Record<string, unknown>;
  return String(raw.postCallSignID ?? raw.PostCallSignID ?? '').trim();
};

const resolvePostCallSignIdForRow = (
  row: PostPositionResponse,
  availableCallSigns: PostCallSign[]
): string => {
  const fromRow = readPostCallSignId(row);
  if (fromRow) return fromRow;
  const callSign = (row.callSign ?? '').trim();
  if (!callSign) return '';
  const match = availableCallSigns.find((item) => (item.callSign ?? '').trim() === callSign);
  return String(match?.postCallSignID ?? '').trim();
};

// Post Employees Slider Component
const PostEmployeesSlider: React.FC<{
  postId: string;
  post: Post;
  request?: RequestResponse;
  /** Selected day (YYYY-MM-DD) when shown inside the Daily Administration date tree. */
  dateOfWork?: string;
  canTransferPost?: boolean;
  positions: PostPositionResponse[];
  /** Total rows from API when positions are paged server-side */
  totalRecords?: number;
  /** When true, Status column history mode is on (`isViewHistory=true`). */
  viewHistory?: boolean;
  onToggleViewHistory?: () => void;
  /** Soft reload — keep headers; body/pagination show loading. */
  isLoading?: boolean;
  onPositionUnassigned?: (
    pagination?: { page: number; pageSize: number },
    meta?: { refreshPostCounts?: boolean; includeDate?: string }
  ) => void | Promise<void>;
  onSendNotification?: (payload: {
    postPositionId: string;
    attachRequestId?: string;
    requesterId?: string;
  }) => void;
  onNotificationHistory?: (payload: {
    postPositionId: string;
    requestId?: string;
    requesterId?: string;
    title: string;
  }) => void;
}> = ({
  postId,
  post,
  request,
  dateOfWork,
  canTransferPost = false,
  positions,
  totalRecords,
  viewHistory = false,
  onToggleViewHistory,
  isLoading = false,
  onPositionUnassigned,
  onSendNotification,
  onNotificationHistory,
}) => {
  const dispatch = useAppDispatch();
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = React.useState(false);
  const [showRightArrow, setShowRightArrow] = React.useState(false);
  const [blurredCards, setBlurredCards] = React.useState<Set<number>>(new Set());
  const [unassigningPosition, setUnassigningPosition] = React.useState<PostPositionResponse | null>(null);
  const [isUnassignLoading, setIsUnassignLoading] = React.useState(false);
  const [viewMode] = React.useState<'cards' | 'table'>('table');
  const [editingCallSignId, setEditingCallSignId] = React.useState<string | null>(null);
  const [editingCallSignValue, setEditingCallSignValue] = React.useState<string>('');
  const editingCallSignValueRef = React.useRef('');
  const editStartTimeRef = React.useRef(0);
  /** Stops the seeding effect from restoring the row value after the user clears/changes the selection. */
  const hasUserEditedCallSignRef = React.useRef(false);
  const [isSavingCallSign, setIsSavingCallSign] = React.useState(false);
  const [swapSourcePosition, setSwapSourcePosition] = React.useState<PostPositionResponse | null>(null);
  const [swapTargetPosition, setSwapTargetPosition] = React.useState<PostPositionResponse | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = React.useState(false);
  /** Row from which Transfer was opened; drives bulk-assign `isTransfer` + `sourcePostPositionId`. */
  const [transferSourcePosition, setTransferSourcePosition] = React.useState<PostPositionResponse | null>(null);
  const [editingPlaceholderRow, setEditingPlaceholderRow] = React.useState<PostPositionResponse | null>(null);
  const [actionMenuAnchor, setActionMenuAnchor] = React.useState<HTMLElement | null>(null);
  const [actionMenuRow, setActionMenuRow] = React.useState<PostPositionResponse | null>(null);
  const placeholderSaving = useAppSelector((state) => state.placeholder.isSaving);
  const isSwappingCallSigns = useAppSelector((state) => state.postPosition.isSwappingCallSigns);

  const resolvedPostId = (postId || post.postId || '').trim();
  const editingCallSignRow = useMemo(
    () => positions.find((row) => row.postPositionId === editingCallSignId) ?? null,
    [positions, editingCallSignId]
  );
  const editingCallSignDateOfWork = toDateOnly(
    editingCallSignRow?.dateOfWork || dateOfWork
  );
  const availableCallSignsCacheKey =
    editingCallSignId && resolvedPostId && editingCallSignDateOfWork
      ? availablePostCallSignCacheKey(resolvedPostId, editingCallSignDateOfWork)
      : '';
  const availableCallSigns = useAppSelector((state) =>
    availableCallSignsCacheKey
      ? state.postCallSign.availableByKey[availableCallSignsCacheKey] ?? []
      : []
  );
  const isLoadingAvailableCallSigns = useAppSelector((state) =>
    availableCallSignsCacheKey
      ? state.postCallSign.availableLoadingByKey[availableCallSignsCacheKey] ?? false
      : false
  );

  const callSignDropdownOptions = useMemo((): SMSDropdownOption[] => {
    const seen = new Set<string>();
    const options: SMSDropdownOption[] = [
      { value: '', label: POST_POSITION.CALL_SIGN.EMPTY_OPTION },
    ];
    for (const item of availableCallSigns) {
      const postCallSignId = String(item.postCallSignID ?? '').trim();
      const callSign = (item.callSign ?? '').trim();
      if (!postCallSignId || !callSign || seen.has(postCallSignId)) continue;
      seen.add(postCallSignId);
      options.push({ value: postCallSignId, label: callSign });
    }
    const currentId = editingCallSignValue.trim();
    if (currentId && !seen.has(currentId)) {
      const label =
        availableCallSigns.find(
          (item) => String(item.postCallSignID ?? '').trim() === currentId
        )?.callSign?.trim() ||
        editingCallSignRow?.callSign?.trim() ||
        currentId;
      options.push({ value: currentId, label });
    }
    return options;
  }, [availableCallSigns, editingCallSignRow, editingCallSignValue]);

  React.useEffect(() => {
    if (!editingCallSignId || !editingCallSignRow || hasUserEditedCallSignRef.current) return;
    const isDefineCallSign = isDefineCallSignEnabled(editingCallSignRow, post);
    if (!isDefineCallSign) return;
    const resolvedId = resolvePostCallSignIdForRow(editingCallSignRow, availableCallSigns);
    if (!resolvedId || editingCallSignValueRef.current === resolvedId) return;
    editingCallSignValueRef.current = resolvedId;
    setEditingCallSignValue(resolvedId);
  }, [availableCallSigns, editingCallSignId, editingCallSignRow, post]);

  const pagination = usePagination({
    initialPage: 1,
    initialPageSize: DEFAULT_TABLE_PAGE_SIZE,
    totalItems: 0,
  });

  const resolvedTotalRecords =
    totalRecords !== undefined
      ? Math.max(totalRecords, positions.length)
      : positions.length;

  const serverSidePagination = resolvedTotalRecords > pagination.pageSize;

  React.useEffect(() => {
    pagination.goToFirstPage();
    pagination.setTotalItems(resolvedTotalRecords);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateOfWork, resolvedTotalRecords]);

  const checkScrollButtons = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      const hasScroll = scrollWidth > clientWidth + 5; // Add 5px threshold for rounding
      const isAtStart = scrollLeft <= 5;
      const isAtEnd = scrollLeft >= scrollWidth - clientWidth - 5;
      
      setShowLeftArrow(hasScroll && !isAtStart);
      setShowRightArrow(hasScroll && !isAtEnd);
    }
  };

  React.useEffect(() => {
    // Use multiple timeouts to ensure DOM is fully rendered and layout is calculated
    const timer1 = setTimeout(() => {
      checkScrollButtons();
    }, 100);
    
    const timer2 = setTimeout(() => {
      checkScrollButtons();
    }, 300);
    
    const container = scrollContainerRef.current;
    if (container) {
      // Force a layout recalculation
      void container.offsetHeight;
      
      container.addEventListener('scroll', checkScrollButtons);
      window.addEventListener('resize', checkScrollButtons);
      
      // Use MutationObserver to detect when content changes
      const observer = new MutationObserver(() => {
        setTimeout(checkScrollButtons, 50);
      });
      
      observer.observe(container, { childList: true, subtree: true, attributes: true });
      
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        container.removeEventListener('scroll', checkScrollButtons);
        window.removeEventListener('resize', checkScrollButtons);
        observer.disconnect();
      };
    }
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [positions]);

  // Detect partially visible cards and apply blur
  React.useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const checkCardVisibility = () => {
      const cards = container.querySelectorAll('.post-assigned-members__card');
      const containerRect = container.getBoundingClientRect();
      const blurredSet = new Set<number>();

      cards.forEach((card, index) => {
        const cardRect = card.getBoundingClientRect();
        
        // Check if card is partially visible
        const cardLeft = cardRect.left;
        const cardRight = cardRect.right;
        const containerLeft = containerRect.left;
        const containerRight = containerRect.right;

        // Card is partially visible if it extends beyond container bounds
        const isPartiallyVisible = 
          (cardLeft < containerLeft && cardRight > containerLeft) || // Partially visible on left
          (cardRight > containerRight && cardLeft < containerRight); // Partially visible on right

        if (isPartiallyVisible) {
          blurredSet.add(index);
        }
      });

      setBlurredCards(new Set(blurredSet));
    };

    // Initial check
    const timer = setTimeout(() => {
      checkCardVisibility();
    }, 100);

    // Check on scroll and resize
    container.addEventListener('scroll', checkCardVisibility);
    window.addEventListener('resize', checkCardVisibility);

    // Use Intersection Observer for more accurate detection
    const cards = container.querySelectorAll('.post-assigned-members__card');
    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        setBlurredCards((prevBlurred) => {
          const blurredSet = new Set(prevBlurred);
          
          entries.forEach((entry) => {
            const index = Array.from(cards).indexOf(entry.target as HTMLElement);
            if (index === -1) return;

            // If intersection ratio is less than 1, card is partially visible
            if (entry.intersectionRatio < 1 && entry.intersectionRatio > 0) {
              blurredSet.add(index);
            } else if (entry.intersectionRatio === 1) {
              blurredSet.delete(index);
            }
          });
          
          return blurredSet;
        });
      },
      {
        root: container,
        threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
      }
    );

    cards.forEach((card) => {
      intersectionObserver.observe(card);
    });

    return () => {
      clearTimeout(timer);
      container.removeEventListener('scroll', checkCardVisibility);
      window.removeEventListener('resize', checkCardVisibility);
      intersectionObserver.disconnect();
    };
  }, [positions]);

  const scrollLeft = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const firstCard = container.querySelector('.post-assigned-members__card') as HTMLElement;
      if (firstCard) {
        const cardWidth = firstCard.offsetWidth;
        const gap = parseInt(getComputedStyle(container).gap) || 16;
        const scrollAmount = cardWidth + gap;
        
        container.scrollBy({
          left: -scrollAmount,
          behavior: 'smooth'
        });
      } else {
        // Fallback to approximate width
        container.scrollBy({
          left: -250,
          behavior: 'smooth'
        });
      }
    }
  };

  const scrollRight = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const firstCard = container.querySelector('.post-assigned-members__card') as HTMLElement;
      if (firstCard) {
        const cardWidth = firstCard.offsetWidth;
        const gap = parseInt(getComputedStyle(container).gap) || 16;
        const scrollAmount = cardWidth + gap;
        
        container.scrollBy({
          left: scrollAmount,
          behavior: 'smooth'
        });
      } else {
        // Fallback to approximate width
        container.scrollBy({
          left: 250,
          behavior: 'smooth'
        });
      }
    }
  };

  const handleUnassignClick = (position: PostPositionResponse) => {
    setUnassigningPosition(position);
  };

  const handleTransferClick = React.useCallback((position: PostPositionResponse) => {
    setTransferSourcePosition(position);
    setIsAssignModalOpen(true);
  }, []);

  const handleSendNotificationClick = (position: PostPositionResponse) => {
    const postPositionId = position.postPositionId?.trim();
    if (postPositionId) {
      onSendNotification?.({
        postPositionId,
        attachRequestId: request?.requestID,
        requesterId: request?.requesterID,
      });
    }
  };

  const closeActionMenu = () => {
    setActionMenuAnchor(null);
    setActionMenuRow(null);
  };

  const openActionMenu = (event: React.MouseEvent<HTMLElement>, row: PostPositionResponse) => {
    event.stopPropagation();
    setActionMenuAnchor(event.currentTarget);
    setActionMenuRow(row);
  };

  const handleConfirmUnassign = async () => {
    if (!unassigningPosition?.postPositionId || isUnassignLoading) return;

    setIsUnassignLoading(true);
    try {
      await dispatch(cancelPostPositionThunk({
        postPositionId: unassigningPosition.postPositionId,
        cancellationReason: 'Cancelled from schedule.',
        isApproveCancellation: true,
      })).unwrap();
      setUnassigningPosition(null);
      // Refresh positions by calling the callback
      void onPositionUnassigned?.(
        {
        page: pagination.currentPage,
        pageSize: pagination.pageSize,
        },
        { refreshPostCounts: true }
      );
    } catch (error) {
      console.error('Failed to unassign post position:', error);
      // Keep the dialog open on error so user can retry
    } finally {
      setIsUnassignLoading(false);
    }
  };

  // Always show arrows if there are multiple cards
  const hasMultipleCards = positions.length > 1;
  const isApproveCancellationAction =
    unassigningPosition
      ? getPostPositionStatusValue(unassigningPosition) === PostPositionStatus.CancellationPending
      : false;
  const targetEmployeeName = unassigningPosition
    ? formatLastNameCommaFirstName(unassigningPosition.firstName, unassigningPosition.lastName, 'this employee')
    : 'this employee';
  const confirmationModalStrings = POST_POSITION.ASSIGNMENTS_AND_WAITING.CONFIRMATION_MODAL;

  const startEditCallSign = (row: PostPositionResponse) => {
    editStartTimeRef.current = Date.now();
    setSwapSourcePosition(null);
    setSwapTargetPosition(null);
    const isDefineCallSign = isDefineCallSignEnabled(row, post);
    const initialId = isDefineCallSign ? readPostCallSignId(row) : (row.callSign ?? '');
    hasUserEditedCallSignRef.current = false;
    editingCallSignValueRef.current = initialId;
    setEditingCallSignId(row.postPositionId);
    setEditingCallSignValue(initialId);
    if (isDefineCallSign) {
      const workDate = toDateOnly(row.dateOfWork || dateOfWork);
      if (resolvedPostId && workDate) {
        void dispatch(
          fetchAvailablePostCallSignsThunk({
            postId: resolvedPostId,
            dateOfWork: workDate,
          })
        );
      }
    }
  };

  const cancelEditCallSign = () => {
    hasUserEditedCallSignRef.current = false;
    editingCallSignValueRef.current = '';
    setEditingCallSignId(null);
    setEditingCallSignValue('');
  };

  const cancelSwapCallSign = React.useCallback(() => {
    setSwapSourcePosition(null);
    setSwapTargetPosition(null);
  }, []);

  React.useEffect(() => {
    if (!swapSourcePosition || swapTargetPosition) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        cancelSwapCallSign();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cancelSwapCallSign, swapSourcePosition, swapTargetPosition]);

  const handleSwapCallSignClick = React.useCallback(
    (row: PostPositionResponse, event: React.MouseEvent<HTMLElement>) => {
      event.stopPropagation();
      if (isSwappingCallSigns || isSavingCallSign || editingCallSignId) return;
      if (!canSwapPostPositionCallSign(row)) return;

      if (!swapSourcePosition) {
        setSwapSourcePosition(row);
        return;
      }

      if (swapSourcePosition.postPositionId === row.postPositionId) {
        cancelSwapCallSign();
      }
    },
    [
      cancelSwapCallSign,
      editingCallSignId,
      isSavingCallSign,
      isSwappingCallSigns,
      swapSourcePosition,
    ]
  );

  const handleSwapTargetRowClick = React.useCallback(
    (row: PostPositionResponse, event: React.MouseEvent<HTMLTableRowElement>) => {
      if (!swapSourcePosition || isSwappingCallSigns || isSavingCallSign || editingCallSignId) {
        return;
      }

      const target = event.target as HTMLElement;
      if (target.closest('button, a, input, select, textarea, [role="menuitem"]')) {
        return;
      }

      const sourceId = swapSourcePosition.postPositionId;
      const targetId = row.postPositionId;
      if (!sourceId || !targetId || sourceId === targetId) return;
      if (!canSwapPostPositionCallSign(row)) return;

      if (!isSamePostPositionWorkDate(swapSourcePosition, row)) {
        dispatch(showToast(POST_POSITION.CALL_SIGN.SWAP_SAME_DATE_REQUIRED, 'warning'));
        return;
      }

      setSwapTargetPosition(row);
    },
    [
      dispatch,
      editingCallSignId,
      isSavingCallSign,
      isSwappingCallSigns,
      swapSourcePosition,
    ]
  );

  const handleConfirmSwapCallSign = React.useCallback(async () => {
    const id1 = swapSourcePosition?.postPositionId?.trim();
    const id2 = swapTargetPosition?.postPositionId?.trim();
    if (!id1 || !id2) return;

    try {
      await dispatch(
        swapPostPositionCallSignsThunk({
          postPositionId1: id1,
          postPositionId2: id2,
        })
      ).unwrap();
      cancelSwapCallSign();
      void onPositionUnassigned?.(
        {
          page: pagination.currentPage,
          pageSize: pagination.pageSize,
        },
        { refreshPostCounts: false }
      );
    } catch {
      // Toast handled in slice
    }
  }, [
    cancelSwapCallSign,
    dispatch,
    onPositionUnassigned,
    pagination.currentPage,
    pagination.pageSize,
    swapSourcePosition,
    swapTargetPosition,
  ]);

  const getSwapCallSignRowClassName = React.useCallback(
    (row: PostPositionResponse): string | undefined => {
      if (!swapSourcePosition) return undefined;
      const rowId = row.postPositionId;
      const sourceId = swapSourcePosition.postPositionId;
      if (rowId && sourceId && rowId === sourceId) {
        return 'post-assigned-members__row--swap-source';
      }
      if (
        canSwapPostPositionCallSign(row) &&
        isSamePostPositionWorkDate(swapSourcePosition, row) &&
        rowId !== sourceId
      ) {
        return 'post-assigned-members__row--swap-target';
      }
      if (swapSourcePosition && !isSamePostPositionWorkDate(swapSourcePosition, row)) {
        return 'post-assigned-members__row--swap-disabled';
      }
      return undefined;
    },
    [swapSourcePosition]
  );

  const swapConfirmMessage = React.useMemo(() => {
    if (!swapSourcePosition || !swapTargetPosition) return '';
    return POST_POSITION.CALL_SIGN.SWAP_CONFIRM_MESSAGE.replace(
      '{callSign1}',
      getPostPositionCallSignLabel(swapSourcePosition)
    )
      .replace('{employee1}', getPostPositionEmployeeLabel(swapSourcePosition))
      .replace('{callSign2}', getPostPositionCallSignLabel(swapTargetPosition))
      .replace('{employee2}', getPostPositionEmployeeLabel(swapTargetPosition));
  }, [swapSourcePosition, swapTargetPosition]);

  const openEditPlaceholder = React.useCallback((row: PostPositionResponse) => {
    if (!readPostPositionIsPlaceholder(row)) return;
    const placeholderId = row.placeholderId?.trim();
    if (!placeholderId) {
      dispatch(showToast('Placeholder profile is missing for this assignment.', 'error'));
      return;
    }
    setEditingPlaceholderRow(row);
  }, [dispatch]);

  const closeEditPlaceholder = React.useCallback(() => {
    if (placeholderSaving) return;
    setEditingPlaceholderRow(null);
  }, [placeholderSaving]);

  const handleSavePlaceholder = React.useCallback(
    async (draft: CardEditDraft) => {
      if (!editingPlaceholderRow) return;
      const placeholderId = editingPlaceholderRow.placeholderId?.trim();
      if (!placeholderId) {
        dispatch(showToast('Placeholder profile is missing for this assignment.', 'error'));
        return;
      }
      try {
        await dispatch(
          upsertPlaceholderThunk(buildPlaceholderUpsertPayload(placeholderId, draft))
        ).unwrap();
        setEditingPlaceholderRow(null);
        void onPositionUnassigned?.(
          {
            page: pagination.currentPage,
            pageSize: pagination.pageSize,
          },
          { refreshPostCounts: false }
        );
      } catch {
        // Toast handled in slice
      }
    },
    [
      dispatch,
      editingPlaceholderRow,
      onPositionUnassigned,
      pagination.currentPage,
      pagination.pageSize,
    ]
  );

  /** Commit on dropdown close or text blur; handles DDL vs direct text call sign. */
  const tryCommitCallSign = React.useCallback(
    async (row: PostPositionResponse, rawValue: string, isDefineCallSign: boolean = true) => {
      if (isSavingCallSign) return;
      if (editingCallSignId !== row.postPositionId) return;
      const trimmedVal = rawValue.trim();
      const fieldName = isDefineCallSign
        ? POST_POSITION_POST_CALL_SIGN_ID_FIELD_NAME
        : POST_POSITION_CALL_SIGN_FIELD_NAME;
      const prevVal = isDefineCallSign
        ? resolvePostCallSignIdForRow(row, availableCallSigns)
        : (row.callSign ?? '').trim();
      if (trimmedVal === prevVal) {
        cancelEditCallSign();
        return;
      }
      if (!row.postPositionId) return;
      setIsSavingCallSign(true);
      try {
        await updatePostPositionCallSign(
          row.postPositionId,
          trimmedVal || '',
          fieldName
        );
        dispatch(showToast(POST_POSITION.CALL_SIGN.UPDATED, 'success'));
        hasUserEditedCallSignRef.current = false;
        setEditingCallSignId((currentId) => {
          if (currentId === row.postPositionId) {
            setEditingCallSignValue('');
            return null;
          }
          return currentId;
        });
        void onPositionUnassigned?.(
          {
          page: pagination.currentPage,
          pageSize: pagination.pageSize,
          },
          { refreshPostCounts: false }
        );
      } catch (error) {
        console.error('Failed to update call sign:', error);
        dispatch(showToast(POST_POSITION.CALL_SIGN.UPDATE_FAILED, 'error'));
      } finally {
        setIsSavingCallSign(false);
      }
    },
    [availableCallSigns, isSavingCallSign, editingCallSignId, dispatch, onPositionUnassigned]
  );

  // Table columns definition (DataTable format, matching Available Post list)
  const tableColumns: DataTableColumn<PostPositionResponse>[] = React.useMemo(() => [
    {
      key: 'callSign',
      label: 'Call Sign',
      render: (_value, row) => {
        const isEditing = editingCallSignId === row.postPositionId;

        if (isEditing) {
          const isDefineCallSign = isDefineCallSignEnabled(row, post);
          if (isDefineCallSign) {
            return (
              <SMSDropdown
                size="small"
                value={editingCallSignValue}
                options={callSignDropdownOptions}
                onChange={(e) => {
                  const next = String(e.target.value);
                  hasUserEditedCallSignRef.current = true;
                  editingCallSignValueRef.current = next;
                  setEditingCallSignValue(next);
                }}
                onClose={() => {
                  if (isSavingCallSign || editingCallSignId !== row.postPositionId) return;
                  void tryCommitCallSign(row, editingCallSignValueRef.current, true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    cancelEditCallSign();
                  }
                }}
                disabled={isSavingCallSign || isLoadingAvailableCallSigns}
                clearable
                autoFocus
                sx={{ minWidth: 140 }}
                aria-label={POST_POSITION.CALL_SIGN.EDIT_ARIA_LABEL}
              />
            );
          }
          return (
            <input
              type="text"
              className="post-assigned-members__call-sign-input"
              value={editingCallSignValue}
              onChange={(e) => {
                const next = e.target.value;
                hasUserEditedCallSignRef.current = true;
                editingCallSignValueRef.current = next;
                setEditingCallSignValue(next);
              }}
              onBlur={() => {
                if (Date.now() - editStartTimeRef.current < 300) return;
                if (isSavingCallSign || editingCallSignId !== row.postPositionId) return;
                void tryCommitCallSign(row, editingCallSignValueRef.current, false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void tryCommitCallSign(row, editingCallSignValueRef.current, false);
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  cancelEditCallSign();
                }
              }}
              disabled={isSavingCallSign}
              autoFocus
              maxLength={50}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                minWidth: '120px',
                padding: '6px 10px',
                fontSize: '0.875rem',
                borderRadius: '4px',
                border: '1px solid #1976d2',
                outline: 'none',
                boxSizing: 'border-box',
                backgroundColor: '#ffffff',
                color: '#333333',
                cursor: 'text',
              }}
              aria-label={POST_POSITION.CALL_SIGN.EDIT_ARIA_LABEL}
            />
          );
        }

        const displayValue = row.callSign ? String(row.callSign) : '-';
        const isSwapSource =
          swapSourcePosition?.postPositionId === row.postPositionId;
        const showSwapButton =
          canSwapPostPositionCallSign(row) && (!swapSourcePosition || isSwapSource);
        const isSwapSelectionActive = Boolean(swapSourcePosition);
        const showEditCallSignButton = !isSwapSelectionActive;
        const isEditDisabled =
          isSwappingCallSigns ||
          isSavingCallSign ||
          (editingCallSignId != null && editingCallSignId !== row.postPositionId);

        return (
          <SMSBox
            className={[
              'post-assigned-members__call-sign-cell',
              isSwapSource ? 'post-assigned-members__call-sign-cell--swap-active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <span className="post-assigned-members__call-sign-display">{displayValue}</span>
            {(showSwapButton || showEditCallSignButton) && (
              <SMSBox className="post-assigned-members__call-sign-actions">
                {showSwapButton && (
                  <SMSIconButton
                    tone="primary"
                    variant="plain"
                    size="small"
                    className={[
                      'post-assigned-members__call-sign-swap',
                      isSwapSource ? 'post-assigned-members__call-sign-swap--active' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    disabled={isSwappingCallSigns || isSavingCallSign || Boolean(editingCallSignId)}
                    onClick={(event) => handleSwapCallSignClick(row, event)}
                    aria-label={
                      isSwapSource
                        ? POST_POSITION.CALL_SIGN.SWAP_CANCEL
                        : POST_POSITION.CALL_SIGN.SWAP_ARIA_LABEL
                    }
                    title={
                      isSwapSource
                        ? POST_POSITION.CALL_SIGN.SWAP_CANCEL
                        : POST_POSITION.CALL_SIGN.SWAP_ARIA_LABEL
                    }
                  >
                    <SMSIcon name="swap_vert" size="md" />
                  </SMSIconButton>
                )}
                {showEditCallSignButton && (
                  <SMSIconButton
                    tone="primary"
                    variant="plain"
                    size="small"
                    className="post-assigned-members__call-sign-edit"
                    disabled={isEditDisabled}
                    onClick={(event) => {
                      event.stopPropagation();
                      startEditCallSign(row);
                    }}
                    aria-label={POST_POSITION.CALL_SIGN.EDIT_BUTTON_ARIA_LABEL}
                    title={POST_POSITION.CALL_SIGN.EDIT_BUTTON_ARIA_LABEL}
                  >
                    <SMSIcon name="edit" size="md" />
                  </SMSIconButton>
                )}
              </SMSBox>
            )}
          </SMSBox>
        );
      },
    },
    {
      key: 'name',
      label: 'Employee Name',
      render: (_value: unknown, row: PostPositionResponse) => {
        const displayName = row.employeeName ?? 'Unknown';
        if (!readPostPositionIsPlaceholder(row)) {
          return displayName;
        }
        return (
          <span
            className="post-assigned-members__employee-name-display"
            onClick={() => openEditPlaceholder(row)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openEditPlaceholder(row);
              }
            }}
            aria-label="Edit placeholder"
            title="Edit placeholder"
          >
            {displayName}
          </span>
        );
      },
    },
    {
      key: 'dateOfWork',
      label: 'Date Of Work',
      render: (value: unknown) => (value ? formatDateShort(String(value)) : '-'),
    },
    {
      key: 'employeeTypeName',
      label: 'Employee Type',
      render: (value: unknown, row: PostPositionResponse) => {
        if (readPostPositionIsPlaceholder(row)) {
          return renderLabeledStatusPill(DAILY_ADMINISTRATION.PLACEHOLDER_EMPLOYEE_TYPE_LABEL, {
            bgcolor: 'grey.300',
            color: 'text.secondary',
            borderColor: 'grey.300',
          });
        }
        return value ? String(value) : '-';
      },
    },
    {
      key: 'badgeNumber',
      label: 'Badge Number',
      render: (value: unknown) => (value ? String(value) : '-'),
    },
    {
      key: 'primaryPhone',
      label: 'Phone',
      render: (value: unknown) => {
        const formatted = value ? formatPhoneNumber(String(value)) : '';
        return formatted || '-';
      },
    },
    {
      key: 'postPositionStatus',
      label: (
        <SMSBox className="post-assigned-members__status-header">
          <span>Status</span>
          {onToggleViewHistory ? (
            <SMSIconButton
              type="button"
              tone={viewHistory ? 'primary' : 'default'}
              size="small"
              variant={viewHistory ? 'outlined' : 'plain'}
              allowWhenSuspended
              className={
                viewHistory
                  ? 'post-assigned-members__view-history-btn post-assigned-members__view-history-btn--active'
                  : 'post-assigned-members__view-history-btn'
              }
              title={
                viewHistory
                  ? DAILY_ADMINISTRATION.HIDE_HISTORY
                  : DAILY_ADMINISTRATION.VIEW_HISTORY
              }
              aria-label={
                viewHistory
                  ? DAILY_ADMINISTRATION.HIDE_HISTORY
                  : DAILY_ADMINISTRATION.VIEW_HISTORY
              }
              aria-pressed={viewHistory}
              disabled={isLoading}
              onClick={(event) => {
                event.stopPropagation();
                onToggleViewHistory();
              }}
            >
              <SMSIcon name={viewHistory ? 'current_assigned' : 'assigned_history'} size="md" />
            </SMSIconButton>
          ) : null}
        </SMSBox>
      ),
      noClamp: true,
      render: (_value: unknown, row: PostPositionResponse) =>
        renderPostPositionStatusPill(getPostPositionStatusValue(row), 'post-position', {
          layout: 'nowrap',
        }),
    },
    {
      key: 'action',
      label: 'Action',
      render: (_value: unknown, row: PostPositionResponse) => {
        if (isDailyAdminPostPositionActionsHidden(row)) {
          return '';
        }
        if (swapSourcePosition?.postPositionId === row.postPositionId) {
          return '';
        }
        const unassignLabel =
          getPostPositionStatusValue(row) === PostPositionStatus.CancellationPending
            ? POST_POSITION.ASSIGNMENTS_AND_WAITING.ACTION_APPROVE_CANCELLATION
            : POST_POSITION.ASSIGNMENTS_AND_WAITING.ACTION_UNASSIGN;
        const isAssigned = getPostPositionStatusValue(row) === PostPositionStatus.Assigned;
        return (
          <SMSBox
            className="post-assigned-members__actions"
            sx={{ display: 'flex', gap: 1, alignItems: 'center', justifyContent: 'center' }}
          >
            <SMSButton
              onClick={() => handleUnassignClick(row)}
            >
              {unassignLabel}
            </SMSButton>
            {canTransferPost && (
              <SMSButton
                onClick={() => handleTransferClick(row)}
              >
                Transfer
              </SMSButton>
            )}
            {isAssigned && (
              <SMSIconButton
                tone="default"
                size="small"
                aria-label="More Actions"
                aria-controls={actionMenuAnchor ? 'post-position-action-menu' : undefined}
                aria-haspopup="true"
                aria-expanded={actionMenuAnchor ? 'true' : undefined}
                onClick={(event) => openActionMenu(event, row)}
              >
                <SMSIcon name="more_vert" size="sm" />
              </SMSIconButton>
            )}
          </SMSBox>
        );
      },
    },
  ], [
    canTransferPost,
    callSignDropdownOptions,
    dispatch,
    editingCallSignId,
    editingCallSignValue,
    handleSwapCallSignClick,
    handleTransferClick,
    isLoadingAvailableCallSigns,
    isSavingCallSign,
    onToggleViewHistory,
    openEditPlaceholder,
    isLoading,
    swapSourcePosition,
    tryCommitCallSign,
    viewHistory,
  ]);

  return (
    <SMSBox className="post-assigned-members">
      {/* View Toggle Button */}
      <SMSBox className="post-assigned-members__header">
      </SMSBox>

      {viewMode === 'cards' ? (
        <>
          {hasMultipleCards && (
            <>
              <SMSButton
                className={`post-assigned-members__arrow post-assigned-members__arrow--left ${!showLeftArrow ? 'post-assigned-members__arrow--dimmed' : ''}`}
                onClick={scrollLeft}
                aria-label="Scroll left"
                disabled={!showLeftArrow}
                sx={{ display: 'flex' }}
                type="button"
                variant="outlined"
              >
                <SMSIcon name="arrowLeft" size="md" />
              </SMSButton>
              <SMSBox 
                className="post-assigned-members__container"
                ref={scrollContainerRef}
              >
                {positions.map((position, index) => (
                  <EmployeeCard
                    key={position.postPositionId}
                    position={position}
                    showCheckbox={false}
                    showCloseButton={!isDailyAdminPostPositionActionsHidden(position)}
                    onClose={() => handleUnassignClick(position)}
                    showEditLink={readPostPositionIsPlaceholder(position)}
                    onEdit={() => openEditPlaceholder(position)}
                    className={`post-assigned-members__card ${blurredCards.has(index) ? 'post-assigned-members__card--blurred' : ''}`}
                    statusAssigned={getPostPositionStatusValue(position) === PostPositionStatus.Assigned}
                  />
                ))}
              </SMSBox>
              <SMSButton
                className={`post-assigned-members__arrow post-assigned-members__arrow--right ${!showRightArrow ? 'post-assigned-members__arrow--dimmed' : ''}`}
                onClick={scrollRight}
                aria-label="Scroll right"
                disabled={!showRightArrow}
                sx={{ display: 'flex' }}
                type="button"
                variant="outlined"
              >
                <SMSIcon name="arrowRight" size="md" />
              </SMSButton>
            </>
          )}
          {!hasMultipleCards && (
            <SMSBox 
              className="post-assigned-members__container"
              ref={scrollContainerRef}
            >
              {positions.map((position) => (
                <EmployeeCard
                  key={position.postPositionId}
                  position={position}
                  showCheckbox={false}
                  showCloseButton={!isDailyAdminPostPositionActionsHidden(position)}
                  onClose={() => handleUnassignClick(position)}
                  showEditLink={readPostPositionIsPlaceholder(position)}
                  onEdit={() => openEditPlaceholder(position)}
                  className="post-assigned-members__card"
                  statusAssigned={getPostPositionStatusValue(position) === PostPositionStatus.Assigned}
                />
              ))}
            </SMSBox>
          )}
        </>
      ) : (
        <SMSBox className="post-assigned-members__table-wrapper">
          {swapSourcePosition && !swapTargetPosition && (
            <SMSBox className="post-assigned-members__swap-toolbar">
              <SMSTypography variant="body2" className="post-assigned-members__swap-toolbar-text">
                {POST_POSITION.CALL_SIGN.SWAP_SELECT_TARGET}
              </SMSTypography>
              <SMSButton
                type="button"
                variant="contained"
                color="primary"
                size="small"
                className="post-assigned-members__swap-cancel"
                onClick={cancelSwapCallSign}
                disabled={isSwappingCallSigns}
              >
                {POST_POSITION.CALL_SIGN.SWAP_CANCEL}
              </SMSButton>
            </SMSBox>
          )}
          <SMSBox className="post-assigned-members__table-container">
          <SMSDataTableWrapper<PostPositionResponse>
            columns={tableColumns}
            data={positions}
            loading={isLoading}
            preserveStructureWhileLoading
            emptyMessage="No employees assigned"
            showHeaderWhenEmpty={true}
            renderEmptyAsTable
            getRowClassName={getSwapCallSignRowClassName}
            onRowClick={swapSourcePosition ? handleSwapTargetRowClick : undefined}
            pagination={{
              currentPage: pagination.currentPage,
              pageSize: pagination.pageSize,
              totalItems: pagination.totalItems,
              serverSide: serverSidePagination,
              onPageChange: (page) => {
                pagination.goToPage(page);
                if (serverSidePagination) {
                  void onPositionUnassigned?.({ page, pageSize: pagination.pageSize }, { refreshPostCounts: false });
                }
              },
              onPageSizeChange: (newPageSize) => {
                pagination.setPageSize(newPageSize);
                pagination.goToFirstPage();
                const needsFetch =
                  serverSidePagination ||
                  resolvedTotalRecords > newPageSize;
                if (needsFetch) {
                  void onPositionUnassigned?.({ page: 1, pageSize: newPageSize }, { refreshPostCounts: false });
                }
              },
            }}
          />
          </SMSBox>
        </SMSBox>
      )}

      {/* Unassign Confirmation Dialog */}
      <SMSConfirmDialog
        open={!!unassigningPosition}
        title={
          isApproveCancellationAction
            ? confirmationModalStrings.APPROVE_CANCELLATION_TITLE
            : confirmationModalStrings.UNASSIGN_TITLE
        }
        message={
          isApproveCancellationAction
            ? confirmationModalStrings.APPROVE_CANCELLATION_MESSAGE.replace('{employeeName}', targetEmployeeName)
            : confirmationModalStrings.UNASSIGN_MESSAGE.replace('{employeeName}', targetEmployeeName)
        }
        confirmText={
          isApproveCancellationAction
            ? isUnassignLoading
              ? POST_POSITION.ASSIGNMENTS_AND_WAITING.ACTION_CANCELLING
              : POST_POSITION.ASSIGNMENTS_AND_WAITING.ACTION_APPROVE_CANCELLATION
            : POST_POSITION.ASSIGNMENTS_AND_WAITING.ACTION_UNASSIGN
        }
        cancelText={confirmationModalStrings.CANCEL_TEXT}
        onConfirm={handleConfirmUnassign}
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

      <SMSConfirmDialog
        open={Boolean(swapSourcePosition && swapTargetPosition)}
        title={POST_POSITION.CALL_SIGN.SWAP_CONFIRM_TITLE}
        message={swapConfirmMessage}
        confirmText={POST_POSITION.CALL_SIGN.SWAP_ARIA_LABEL}
        cancelText={POST_POSITION.CALL_SIGN.SWAP_CANCEL}
        onConfirm={() => {
          void handleConfirmSwapCallSign();
        }}
        onClose={() => setSwapTargetPosition(null)}
        variant="default"
        loading={isSwappingCallSigns}
      />

      <CardEditModal
        open={editingPlaceholderRow != null}
        initialValues={
          editingPlaceholderRow ? placeholderEditDraftFromRow(editingPlaceholderRow) : null
        }
        onClose={closeEditPlaceholder}
        onSave={handleSavePlaceholder}
        disabled={placeholderSaving}
        disableEnableInvoiceAndPayroll
        avatarLabel="?"
      />

      <AssignEmployeesModal
        isOpen={isAssignModalOpen}
        onClose={() => {
          setIsAssignModalOpen(false);
          setTransferSourcePosition(null);
        }}
        post={post}
        request={request}
        variant="transfer"
        transferSourcePostPosition={transferSourcePosition}
        initialWorkDate={dateOfWork}
        onAssignSuccess={(assignedDate) => {
          setIsAssignModalOpen(false);
          setTransferSourcePosition(null);
          void onPositionUnassigned?.(
            {
            page: pagination.currentPage,
            pageSize: pagination.pageSize,
            },
            { refreshPostCounts: true, includeDate: assignedDate }
          );
        }}
      />

      <Menu
        id="post-position-action-menu"
        anchorEl={actionMenuAnchor}
        open={!!actionMenuAnchor}
        onClose={closeActionMenu}
        disableScrollLock
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{ sx: { minWidth: 200 } }}
      >
        <MenuItem
          onClick={() => {
            if (actionMenuRow) handleSendNotificationClick(actionMenuRow);
            closeActionMenu();
          }}
        >
          {REQUESTER.ACTIONS.SEND_EMAIL}
        </MenuItem>
        <MenuItem
          onClick={() => {
            const postPositionId = actionMenuRow?.postPositionId?.trim();
            if (postPositionId) {
              onNotificationHistory?.({
                postPositionId,
                requestId: request?.requestID,
                requesterId: request?.requesterID,
                title: actionMenuRow?.employeeName?.trim() || postPositionId,
              });
            }
            closeActionMenu();
          }}
        >
          {REQUESTER.NOTIFICATION_HISTORY.MENU}
        </MenuItem>
      </Menu>
    </SMSBox>
  );
};


export interface RequesterListProps {
  className?: string;
}

// Post Action Menu Component
const PostActionMenu: React.FC<{
  post: Post;
  request?: RequestResponse;
  onDelete?: (post: Post) => void;
  onAssignSuccess?: (dateOfWork: string) => void | Promise<void>;
  onViewHistory?: (post: Post) => void;
  onSendNotification?: (payload: {
    postId: string;
    attachRequestId?: string;
    requesterId?: string;
  }) => void;
  onNotificationHistory?: (payload: {
    postId: string;
    requestId?: string;
    requesterId?: string;
    title: string;
  }) => void;
  returnPath?: string;
  activeTab?: string;
}> = ({ post, request, onDelete, onAssignSuccess, onViewHistory, onSendNotification, onNotificationHistory, returnPath: propsReturnPath, activeTab: propsActiveTab,}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const navigate = useNavigate();

  const handleClose = () => setAnchorEl(null);

  const handleActionClick = (action: string, post: Post) => {
    handleClose();
    if (action === 'notification_history') {
      if (post.postId) {
        onNotificationHistory?.({
          postId: post.postId,
          requestId: post.requestID ?? undefined,
          requesterId: request?.requesterID,
          title: post.postTitle ?? '',
        });
      }
      return;
    }
    if (!post.postId || !post.requestID) return;

    switch (action) {
      case 'view_history':
        onViewHistory?.(post);
        break;
      case 'create_post':
        navigate(`/personnel/job/create/${post.requestID}`, {
          state: { returnPath: propsReturnPath ?? '/personnel/requester/daily', tab: propsActiveTab ?? 'daily', parentPostId: post.postId }
        });
        break;
      case 'assign_employees':
        setIsAssignModalOpen(true);
        break;
      case 'view_post_position': {
        navigate(
          `/personnel/job-position/${post.postId}/assignments-waiting-list?dateOfWork=${encodeURIComponent(request?.startDate ?? '')}`,
          {
            state: {
              returnPath: propsReturnPath ?? '/personnel/requester/daily',
              tab: propsActiveTab ?? 'daily',
              postTitle: post.postTitle,
            },
          }
        );
        break;
      }
      case 'manage_vehicle':
        navigate(`/personnel/job/${post.requestID}/${post.postId}?mode=edit&step=2`, {
          state: { returnPath: propsReturnPath ?? '/personnel/requester/daily', tab: propsActiveTab ?? 'daily' }
        });
        break;
      case 'manage_equipment':
        navigate(`/personnel/job/${post.requestID}/${post.postId}?mode=edit&step=3`, {
          state: { returnPath: propsReturnPath ?? '/personnel/requester/daily', tab: propsActiveTab ?? 'daily' }
        });
        break;
      case 'block_dates':
        navigate('/admin/block-date', {
          state: {
            requestId: post.requestID,
            postId: post.postId,
            returnPath: propsReturnPath ?? '/personnel/requester/daily',
            tab: propsActiveTab ?? 'daily',
          },
        });
        break;
      case 'delete':
        if (onDelete) {
          onDelete(post);
        }
        break;
      case 'send_notification':
        if (post.postId) {
          onSendNotification?.({
            postId: post.postId,
            attachRequestId: request?.requestID,
            requesterId: request?.requesterID,
          });
        }
        break;
    }
  };

  const showVehicle = post.postRequiresVehicle;
  const showEquipment = post.postRequiresEquipment;

  return (
    <>
      <SMSBox className="post-action-menu" style={{ position: 'relative' }}>
        <SMSIconButton
          className="level-3-post-card__icon-btn level-3-post-card__icon-btn--menu"
          tone="default"
          onClick={(e) => { e.stopPropagation(); setAnchorEl(e.currentTarget); }}
          aria-label="More Actions"
          aria-controls={anchorEl ? 'post-action-menu' : undefined}
          aria-haspopup="true"
          aria-expanded={!!anchorEl}
          title="More Actions"
          size="small"
        >
          <SMSIcon name="more_vert" size="sm" />
        </SMSIconButton>
        <Menu
          id="post-action-menu"
          anchorEl={anchorEl}
          open={!!anchorEl}
          onClose={handleClose}
          disableScrollLock
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          PaperProps={{ sx: { minWidth: 200 } }}
        >
        {onViewHistory && (
          <MenuItem onClick={() => handleActionClick('view_history', post)}>
            {REQUESTER.BUTTON.VIEW_HISTORY}
          </MenuItem>
        )}
          {post.isSupervisorPost && (
            <MenuItem onClick={() => handleActionClick('create_post', post)}>{REQUESTER.ACTIONS.CREATE_POST}</MenuItem>
          )}
          <MenuItem onClick={() => handleActionClick('assign_employees', post)}>Assign Employees</MenuItem>
          <MenuItem onClick={() => handleActionClick('view_post_position', post)}>
            {POST_POSITION.ASSIGNMENTS_AND_WAITING.MENU_VIEW_POST_POSITION}
          </MenuItem>
          {showVehicle && (
            <MenuItem onClick={() => handleActionClick('manage_vehicle', post)}>Manage Job Vehicle</MenuItem>
          )}
          {showEquipment && (
            <MenuItem onClick={() => handleActionClick('manage_equipment', post)}>Manage Job Equipment</MenuItem>
          )}
          <MenuItem onClick={() => handleActionClick('block_dates', post)}>{MENU_ITEMS.BLOCK_DATE}</MenuItem>
          {onDelete && (
            <MenuItem onClick={() => handleActionClick('delete', post)}>Delete Job</MenuItem>
          )}
          <MenuItem onClick={() => handleActionClick('send_notification', post)}>
            {REQUESTER.ACTIONS.SEND_EMAIL}
          </MenuItem>
          <MenuItem onClick={() => handleActionClick('notification_history', post)}>
            {REQUESTER.NOTIFICATION_HISTORY.MENU}
          </MenuItem>
        </Menu>
      </SMSBox>
      <AssignEmployeesModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        post={post}
        request={request}
        onAssignSuccess={onAssignSuccess}
      />
    </>
  );
};

// Three-dot menu for requester row: Requester Restrict, Requester Manager
const RequesterRowActionMenu: React.FC<{
  row: RequesterResponse;
  hideRestrictAndInvoice?: boolean;
  returnPath?: string;
}> = ({ row, hideRestrictAndInvoice = false, returnPath }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const navigate = useNavigate();

  const handleClose = () => setAnchorEl(null);

  const handleAction = (path: string) => {
    if (
      path === INVOICE_GRID.INVOICE_LIST_PATH
      || path === PAYMENT_GRID.REQUESTER_PAYMENT_PATH
      || path === REQUESTER_STATEMENT_GRID.STATEMENT_LIST_PATH
    ) {
      const route = buildRequesterScopedAdminRoute(path, row, { returnPath });
      navigate(route.path, { state: route.state });
    } else {
      const state: { requesterId?: string; requesterName?: string } = {
        requesterId: row.requesterID,
        requesterName: row.name,
      };
      navigate(path, { state });
    }
    handleClose();
  };

  return (
    <SMSBox className="requester-row-action-menu" style={{ position: 'relative' }}>
      <SMSIconButton
        type="button"
        className="requester-list__view-button"
        onClick={(e: React.MouseEvent) => { e.stopPropagation(); setAnchorEl(e.currentTarget as HTMLElement); }}
        aria-label="More actions"
        title="More actions"
        aria-controls={anchorEl ? 'requester-row-action-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={!!anchorEl}
        size="small"
      >
        <SMSIcon name="more_vert" size="sm" />
      </SMSIconButton>
      <Menu
        id="requester-row-action-menu"
        anchorEl={anchorEl}
        open={!!anchorEl}
        onClose={handleClose}
        disableScrollLock
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{ sx: { minWidth: 180 } }}
      >
        {!hideRestrictAndInvoice && (
          <MenuItem onClick={() => handleAction('/admin/requester-restrict')}>
            {REQUESTER_GRID_MENU.REQUESTER_RESTRICT}
          </MenuItem>
        )}
        <MenuItem onClick={() => handleAction('/admin/requester-manager')}>{REQUESTER_GRID_MENU.REQUESTER_MANAGER}</MenuItem>
        {row.isRequesterAuthorized && (
          <MenuItem onClick={() => handleAction('/admin/requester-authorized')}>
            {REQUESTER_GRID_MENU.REQUESTER_AUTHORIZED}
          </MenuItem>
        )}
        {!hideRestrictAndInvoice && (
          <MenuItem onClick={() => handleAction(INVOICE_GRID.INVOICE_LIST_PATH)}>
            {REQUESTER_GRID_MENU.INVOICE}
          </MenuItem>
        )}
        {!hideRestrictAndInvoice && (
          <MenuItem onClick={() => handleAction(PAYMENT_GRID.REQUESTER_PAYMENT_PATH)}>
            {REQUESTER_GRID_MENU.PAYMENT}
          </MenuItem>
        )}
        {!hideRestrictAndInvoice && (
          <MenuItem onClick={() => handleAction(REQUESTER_STATEMENT_GRID.STATEMENT_LIST_PATH)}>
            {REQUESTER_GRID_MENU.STATEMENTS}
          </MenuItem>
        )}
      </Menu>
    </SMSBox>
  );
};

// Request Action Menu Component
const RequestActionMenu: React.FC<{
  request: RequestResponse;
  onCreatePost: (reqId: string) => void;
  onViewHistory?: (request: RequestResponse) => void;
  onOpenUploadModal?: (request: RequestResponse) => void;
  /** Daily Administration: open roster modal for this request. */
  onViewRoster?: (request: RequestResponse) => void;
  onSendNotification?: (req: RequestResponse) => void;
  onNotificationHistory?: (req: RequestResponse) => void;
  returnPath?: string;
  activeTab?: string;
  enableAttachFilesToRequests?: boolean;
}> = ({
  request,
  onCreatePost,
  onViewHistory,
  onOpenUploadModal,
  onViewRoster,
  onSendNotification,
  onNotificationHistory,
  returnPath: propsReturnPath,
  activeTab: propsActiveTab,
  enableAttachFilesToRequests,
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const navigate = useNavigate();

  const handleClose = () => setAnchorEl(null);

  const handleActionClick = (action: string, req: RequestResponse) => {
    switch (action) {
      case 'view_history':
        onViewHistory?.(req);
        break;
      case 'create_post':
        onCreatePost(req.requestID);
        break;
      case 'upload_files':
        console.log('upload_files', req);
        onOpenUploadModal?.(req);
        break;
      case 'add_vehicle':
        navigate(`/personnel/request/edit/${req.requestID}?step=2&mode=single`, {
          state: { returnPath: propsReturnPath ?? '/personnel/requester/daily', tab: propsActiveTab ?? 'daily' }
        });
        break;
      case 'equipment':
        navigate(`/personnel/request/edit/${req.requestID}?step=3&mode=single`, {
          state: { returnPath: propsReturnPath ?? '/personnel/requester/daily', tab: propsActiveTab ?? 'daily' }
        });
        break;
      case 'send_notification':
        onSendNotification?.(req);
        break;
      case 'notification_history':
        onNotificationHistory?.(req);
        break;
    }
    handleClose();
  };



  const showVehicle = request.requiresVehicle;
  const showEquipment = request.requiresEquipment;

  return (
    <SMSBox className="request-action-menu" style={{ position: 'relative' }}>
      <SMSIconButton
        className="level-2-request__icon-btn"
        tone="default"
        onClick={(e) => { e.stopPropagation(); setAnchorEl(e.currentTarget); }}
        aria-label="More Actions"
        aria-controls={anchorEl ? 'request-action-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={!!anchorEl}
        title="More Actions"
        size="small"
      >
        <SMSIcon name="more_vert" size="sm" />
      </SMSIconButton>
      <Menu
        id="request-action-menu"
        anchorEl={anchorEl}
        open={!!anchorEl}
        onClose={handleClose}
        disableScrollLock
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{ sx: { minWidth: 200 } }}
      >
        {onViewHistory && (
          <MenuItem onClick={() => handleActionClick('view_history', request)}>
            {REQUESTER.BUTTON.VIEW_HISTORY}
          </MenuItem>
        )}
        {onViewRoster && (
          <MenuItem
            onClick={() => {
              onViewRoster(request);
              handleClose();
            }}
          >
            {REQUESTER.ACTIONS.VIEW_ROSTER}
          </MenuItem>
        )}
        <MenuItem onClick={() => handleActionClick('create_post', request)}>{REQUESTER.ACTIONS.CREATE_POST}</MenuItem>
        {enableAttachFilesToRequests && (
           <MenuItem onClick={() => handleActionClick('upload_files', request)}>{REQUESTER.ACTIONS.ADD_FILE}</MenuItem>
         
        )}
        {showVehicle && (
          <MenuItem onClick={() => handleActionClick('add_vehicle', request)}>{REQUESTER.ACTIONS.MANAGE_VEHICLE}</MenuItem>
        )}
        {showEquipment && (
          <MenuItem onClick={() => handleActionClick('equipment', request)}>{REQUESTER.ACTIONS.MANAGE_EQUIPMENT}</MenuItem>
        )}
        <MenuItem onClick={() => handleActionClick('send_notification', request)}>
          {REQUESTER.ACTIONS.SEND_EMAIL}
        </MenuItem>
        <MenuItem onClick={() => handleActionClick('notification_history', request)}>
          {REQUESTER.NOTIFICATION_HISTORY.MENU}
        </MenuItem>
      </Menu>
    </SMSBox>
  );
};

// Request Types Mapping

const POST_LEVEL_INDENT_PX = 20;

const getPostLevelDepth = (level?: string): number => {
  if (!level) return 1;

  const segments = level
    .split('-')
    .map(segment => segment.trim())
    .filter(Boolean);

  if (segments.length === 0) return 1;
  if (segments.some(segment => !/^\d+$/.test(segment))) return 1;

  return segments.length;
};

const getPostIndentByLevel = (level?: string): number => {
  const depth = getPostLevelDepth(level);
  return Math.max(depth - 1, 0) * POST_LEVEL_INDENT_PX;
};


export const RequesterList: React.FC<RequesterListProps> = ({
  className = '',
}) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { requesters, isLoading, currentPage, pageSize, totalItems } = useAppSelector((state) => state.requester);
  const { questionnaires, isLoading: isLoadingQuestionnaires } = useAppSelector((state) => state.questionnaire);
  const [isSavingQuestionnaires, setIsSavingQuestionnaires] = useState(false);

  const [deletingItem, setDeletingItem] = useState<RequesterResponse | null>(null);
  const [deletingRequest, setDeletingRequest] = useState<RequestResponse | null>(null);
  const [deletingPost, setDeletingPost] = useState<Post | null>(null);
  const [departmentQuestionnaireModalOpen, setDepartmentQuestionnaireModalOpen] = useState(false);
  /**
   * View History modal: keep id for live lookup in `requesters`, plus click-time name if list lookup fails
   * (e.g. row key / sync edge cases).
   */
  const [viewHistorySelection, setViewHistorySelection] = useState<{
    requesterID: string;
    snapshotName: string;
  } | null>(null);
  const [viewHistoryAuditStartDate, setViewHistoryAuditStartDate] = useState('');
  const [viewHistoryAuditEndDate, setViewHistoryAuditEndDate] = useState('');
  const [viewHistoryAuditPage, setViewHistoryAuditPage] = useState(1);
  const [viewHistoryAuditPageSize, setViewHistoryAuditPageSize] = useState(10);
  const [viewHistoryAuditRows, setViewHistoryAuditRows] = useState<AuditHistoryRow[]>([]);
  const [viewHistoryAuditTotalItems, setViewHistoryAuditTotalItems] = useState(0);
  const [viewHistoryAuditLoading, setViewHistoryAuditLoading] = useState(false);
  const [requestHistorySelection, setRequestHistorySelection] = useState<{
    requestID: string;
    snapshotName: string;
  } | null>(null);
  const [requestHistoryStartDate, setRequestHistoryStartDate] = useState('');
  const [requestHistoryEndDate, setRequestHistoryEndDate] = useState('');
  const [requestHistoryPage, setRequestHistoryPage] = useState(1);
  const [requestHistoryPageSize, setRequestHistoryPageSize] = useState(10);
  const [requestHistoryRows, setRequestHistoryRows] = useState<AuditHistoryRow[]>([]);
  const [requestHistoryTotalItems, setRequestHistoryTotalItems] = useState(0);
  const [requestHistoryLoading, setRequestHistoryLoading] = useState(false);
  const [postHistorySelection, setPostHistorySelection] = useState<{
    postID: string;
    snapshotName: string;
  } | null>(null);
  const [postHistoryStartDate, setPostHistoryStartDate] = useState('');
  const [postHistoryEndDate, setPostHistoryEndDate] = useState('');
  const [postHistoryPage, setPostHistoryPage] = useState(1);
  const [postHistoryPageSize, setPostHistoryPageSize] = useState(10);
  const [postHistoryRows, setPostHistoryRows] = useState<AuditHistoryRow[]>([]);
  const [postHistoryTotalItems, setPostHistoryTotalItems] = useState(0);
  const [postHistoryLoading, setPostHistoryLoading] = useState(false);
  const [invoicePreviewOpen, setInvoicePreviewOpen] = useState(false);
  const [invoicePreviewRequest, setInvoicePreviewRequest] = useState<RequestResponse | null>(null);
  const [invoicePreviewRequestOptions, setInvoicePreviewRequestOptions] = useState<RequestResponse[]>([]);
  const [scheduleModalRequest, setScheduleModalRequest] = useState<RequestResponse | null>(null);
  const [sendEmailContext, setSendEmailContext] = useState<SendEmailContext | null>(null);
  const [notificationHistoryContext, setNotificationHistoryContext] = useState<{
    requestId?: string;
    postId?: string;
    postPositionId?: string;
    requesterId?: string;
    title: string;
  } | null>(null);
  const [rosterPostId, setRosterPostId] = useState('');
  const [rosterDateOfWork, setRosterDateOfWork] = useState('');
  const [selectedRequester, setSelectedRequester] = useState<RequesterResponse | null>(null);
  const [selectedQuestionnaires, setSelectedQuestionnaires] = useState<string[]>([]);
  const [departmentQuestionnaireLoading, setDepartmentQuestionnaireLoading] = useState(false);
  const { tab: tabFromPath, subtab: subtabFromPath, requesterId: rosterRequesterRouteParam, requestId: rosterRequestRouteParam } = useParams<{
    tab: string;
    subtab?: string;
    requesterId?: string;
    requestId?: string;
  }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const validTabs = ['manage', 'close-unclosed', 'daily'] as const;
  type RequesterListTab = (typeof validTabs)[number];
  const CLOSE_UNCLOSED_SUBTABS = ['closed', 'unclosed'] as const;
  // Legacy URLs (`/personnel/requester/close` and `/personnel/requester/jobs-ready-to-close`) now map
  // to the merged "Closed/Unclosed Assignment" tab; preserve sub-tab selection where possible.
  const legacyTabRedirect: Record<string, { tab: 'close-unclosed'; subtab?: 'closed' | 'unclosed' }> = {
    'close': { tab: 'close-unclosed', subtab: 'closed' },
    'jobs-ready-to-close': { tab: 'close-unclosed', subtab: 'unclosed' },
  };
  const legacyMatch = tabFromPath ? legacyTabRedirect[tabFromPath] : undefined;
  const resolveTabFromRoute = (): RequesterListTab => {
    if (legacyMatch) return legacyMatch.tab;
    if (tabFromPath && validTabs.includes(tabFromPath as RequesterListTab)) {
      return tabFromPath as RequesterListTab;
    }
    // `/personnel/requester/close-unclosed/:subtab` registers `:subtab` only (see AppContent routes).
    if (
      (subtabFromPath && (CLOSE_UNCLOSED_SUBTABS as readonly string[]).includes(subtabFromPath)) ||
      tabFromPath === 'close-unclosed'
    ) {
      return 'close-unclosed';
    }
    return 'manage';
  };
  const resolvedTab = resolveTabFromRoute();
  const [activeTab, setActiveTab] = useState(resolvedTab);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const { user } = useAppSelector((state) => state.auth);
  const departmentConfig = useAppSelector((state) =>
    user?.departmentID ? state.departmentConfiguration.configByDepartmentId[user.departmentID] ?? null : null
  );

  useEffect(() => {
    const departmentId = String(user?.departmentID ?? '').trim();
    if (!departmentId) return;
    void dispatch(fetchDepartmentConfigByDepartmentId(departmentId));
  }, [dispatch, user?.departmentID]);

  const isIAAdmin = hasRole(user?.roles, UserRoleType.IAAdmin);
  const isOperator = hasRole(user?.roles, UserRoleType.Operator);
  const isDepartmentAdmin = hasRole(user?.roles, UserRoleType.DepartmentAdmin);
  const isSuperUser = hasRole(user?.roles, UserRoleType.SuperUser) || user?.isSuperUser === true;
  const isRequesterManager = hasRole(user?.roles, UserRoleType.RequesterManager);
  const canTransferPost = isDepartmentAdmin || isIAAdmin || isOperator;
  const isRequesterManagerOnly =
    isRequesterManager && !isOperator && !isDepartmentAdmin && !isSuperUser;
  const canManageRequesters =
    isOperator || isDepartmentAdmin || isSuperUser;
  const viewOnlyRequesters = isIAAdmin && !canManageRequesters;
  const hideRequesterMasterActions = viewOnlyRequesters;

  const [manageSearchQuery, setManageSearchQuery] = useState('');
  const debouncedManageSearchQuery = useDebounce(manageSearchQuery, 500);

  const viewHistoryModalOpen = viewHistorySelection !== null;
  const requestHistoryModalOpen = requestHistorySelection !== null;
  const postHistoryModalOpen = postHistorySelection !== null;
  const viewHistoryModalTitle = useMemo(() => {
    if (!viewHistorySelection) return REQUESTER.BUTTON.VIEW_HISTORY;
    const row = requesters.find(
      (r) => String(r.requesterID) === String(viewHistorySelection.requesterID)
    );
    const display = row
      ? getRequesterNameForHistoryTitle(row)
      : viewHistorySelection.snapshotName.trim();
    return display
      ? REQUESTER.AUDIT.HISTORY_MODAL_TITLE.replace('{name}', display)
      : REQUESTER.BUTTON.VIEW_HISTORY;
  }, [viewHistorySelection, requesters]);
  const requestHistoryModalTitle = useMemo(() => {
    if (!requestHistorySelection) return REQUESTER.BUTTON.VIEW_HISTORY;
    const display = requestHistorySelection.snapshotName.trim();
    return display
      ? REQUESTER.AUDIT.HISTORY_MODAL_TITLE.replace('{name}', display)
      : REQUESTER.BUTTON.VIEW_HISTORY;
  }, [requestHistorySelection]);
  const postHistoryModalTitle = useMemo(() => {
    if (!postHistorySelection) return REQUESTER.BUTTON.VIEW_HISTORY;
    const display = postHistorySelection.snapshotName.trim();
    return display
      ? REQUESTER.AUDIT.HISTORY_MODAL_TITLE.replace('{name}', display)
      : REQUESTER.BUTTON.VIEW_HISTORY;
  }, [postHistorySelection]);

  const viewHistoryAuditTableData = viewHistoryAuditRows;

  // Fetch functions for history data
  const fetchRequesterHistory = () => {
    const requesterId = viewHistorySelection?.requesterID?.trim();
    if (!requesterId) {
      setViewHistoryAuditRows([]);
      setViewHistoryAuditTotalItems(0);
      setViewHistoryAuditLoading(false);
      return;
    }

    let cancelled = false;
    setViewHistoryAuditLoading(true);
    void getAuditHistory(AuditHistoryTable.Requester, requesterId, {
      page: viewHistoryAuditPage,
      pageSize: viewHistoryAuditPageSize,
      sortBy: 'ChangedOn',
      sortDirection: 'desc',
      ...(viewHistoryAuditStartDate.trim() ? { startDate: viewHistoryAuditStartDate.trim() } : {}),
      ...(viewHistoryAuditEndDate.trim() ? { endDate: viewHistoryAuditEndDate.trim() } : {}),
    })
      .then((result) => {
        if (cancelled) return;
        setViewHistoryAuditRows(result.data ?? []);
        setViewHistoryAuditTotalItems(result.totalRecords ?? 0);
      })
      .catch(() => {
        if (cancelled) return;
        setViewHistoryAuditRows([]);
        setViewHistoryAuditTotalItems(0);
        dispatch(showToast('Failed to load requester audit history.', 'error'));
      })
      .finally(() => {
        if (cancelled) return;
        setViewHistoryAuditLoading(false);
      });

    return () => {
      cancelled = true;
    };
  };

  const fetchRequestHistory = () => {
    const requestId = requestHistorySelection?.requestID?.trim();
    if (!requestId) {
      setRequestHistoryRows([]);
      setRequestHistoryTotalItems(0);
      setRequestHistoryLoading(false);
      return;
    }

    let cancelled = false;
    setRequestHistoryLoading(true);
    void getAuditHistory(AuditHistoryTable.Request, requestId, {
      page: requestHistoryPage,
      pageSize: requestHistoryPageSize,
      sortBy: 'ChangedOn',
      sortDirection: 'desc',
      ...(requestHistoryStartDate.trim() ? { startDate: requestHistoryStartDate.trim() } : {}),
      ...(requestHistoryEndDate.trim() ? { endDate: requestHistoryEndDate.trim() } : {}),
    })
      .then((result) => {
        if (cancelled) return;
        setRequestHistoryRows(result.data ?? []);
        setRequestHistoryTotalItems(result.totalRecords ?? 0);
      })
      .catch(() => {
        if (cancelled) return;
        setRequestHistoryRows([]);
        setRequestHistoryTotalItems(0);
        dispatch(showToast('Failed to load request audit history.', 'error'));
      })
      .finally(() => {
        if (cancelled) return;
        setRequestHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  };

  const fetchPostHistory = () => {
    const postId = postHistorySelection?.postID?.trim();
    if (!postId) {
      setPostHistoryRows([]);
      setPostHistoryTotalItems(0);
      setPostHistoryLoading(false);
      return;
    }

    let cancelled = false;
    setPostHistoryLoading(true);
    void getAuditHistory(AuditHistoryTable.Post, postId, {
      page: postHistoryPage,
      pageSize: postHistoryPageSize,
      sortBy: 'ChangedOn',
      sortDirection: 'desc',
      ...(postHistoryStartDate.trim() ? { startDate: postHistoryStartDate.trim() } : {}),
      ...(postHistoryEndDate.trim() ? { endDate: postHistoryEndDate.trim() } : {}),
    })
      .then((result) => {
        if (cancelled) return;
        setPostHistoryRows(result.data ?? []);
        setPostHistoryTotalItems(result.totalRecords ?? 0);
      })
      .catch(() => {
        if (cancelled) return;
        setPostHistoryRows([]);
        setPostHistoryTotalItems(0);
        dispatch(showToast('Failed to load job audit history.', 'error'));
      })
      .finally(() => {
        if (cancelled) return;
        setPostHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  };

  useEffect(() => {
    fetchRequesterHistory();
  }, [viewHistorySelection?.requesterID, viewHistoryAuditPage, viewHistoryAuditPageSize]);

  useEffect(() => {
    fetchRequestHistory();
  }, [requestHistorySelection?.requestID, requestHistoryPage, requestHistoryPageSize]);

  useEffect(() => {
    fetchPostHistory();
  }, [postHistorySelection?.postID, postHistoryPage, postHistoryPageSize]);

  useEffect(() => {
    const total = viewHistoryAuditTotalItems;
    const maxPage = Math.max(1, Math.ceil(total / viewHistoryAuditPageSize) || 1);
    if (viewHistoryAuditPage > maxPage) {
      setViewHistoryAuditPage(maxPage);
    }
  }, [viewHistoryAuditTotalItems, viewHistoryAuditPageSize, viewHistoryAuditPage]);
  useEffect(() => {
    const total = requestHistoryTotalItems;
    const maxPage = Math.max(1, Math.ceil(total / requestHistoryPageSize) || 1);
    if (requestHistoryPage > maxPage) {
      setRequestHistoryPage(maxPage);
    }
  }, [requestHistoryTotalItems, requestHistoryPageSize, requestHistoryPage]);
  useEffect(() => {
    const total = postHistoryTotalItems;
    const maxPage = Math.max(1, Math.ceil(total / postHistoryPageSize) || 1);
    if (postHistoryPage > maxPage) {
      setPostHistoryPage(maxPage);
    }
  }, [postHistoryTotalItems, postHistoryPageSize, postHistoryPage]);

  const viewHistoryAuditPagination = useMemo(
    () => ({
      currentPage: viewHistoryAuditPage,
      pageSize: viewHistoryAuditPageSize,
      totalItems: viewHistoryAuditTotalItems,
      serverSide: true,
      onPageChange: (page: number) => setViewHistoryAuditPage(page),
      onPageSizeChange: (newSize: number) => {
        setViewHistoryAuditPageSize(newSize);
        setViewHistoryAuditPage(1);
      },
    }),
    [viewHistoryAuditPage, viewHistoryAuditPageSize, viewHistoryAuditTotalItems]
  );
  const requestHistoryPagination = useMemo(
    () => ({
      currentPage: requestHistoryPage,
      pageSize: requestHistoryPageSize,
      totalItems: requestHistoryTotalItems,
      serverSide: true,
      onPageChange: (page: number) => setRequestHistoryPage(page),
      onPageSizeChange: (newSize: number) => {
        setRequestHistoryPageSize(newSize);
        setRequestHistoryPage(1);
      },
    }),
    [requestHistoryPage, requestHistoryPageSize, requestHistoryTotalItems]
  );
  const postHistoryPagination = useMemo(
    () => ({
      currentPage: postHistoryPage,
      pageSize: postHistoryPageSize,
      totalItems: postHistoryTotalItems,
      serverSide: true,
      onPageChange: (page: number) => setPostHistoryPage(page),
      onPageSizeChange: (newSize: number) => {
        setPostHistoryPageSize(newSize);
        setPostHistoryPage(1);
      },
    }),
    [postHistoryPage, postHistoryPageSize, postHistoryTotalItems]
  );

  useEffect(() => {
    if (resolvedTab !== activeTab) {
      setActiveTab(resolvedTab);
    }
  }, [resolvedTab, activeTab]);

  // URL normalization for the merged Closed/Unclosed tab:
  //   • Legacy `/personnel/requester/close` and `/personnel/requester/jobs-ready-to-close`
  //     get rewritten to `/personnel/requester/close-unclosed/<subtab>`.
  //   • Legacy `/personnel/requester/close-unclosed?subtab=<name>` query string is
  //     promoted to a path segment so deep links match `:tab/:subtab`.
  useEffect(() => {
    if (!tabFromPath) return;

    if (legacyMatch) {
      const params = new URLSearchParams(searchParams);
      params.delete('subtab');
      const qs = params.toString();
      const sub = legacyMatch.subtab ?? 'unclosed';
      navigate(`/personnel/requester/${legacyMatch.tab}/${sub}${qs ? `?${qs}` : ''}`, { replace: true });
      return;
    }

    if (tabFromPath === 'close-unclosed' && !subtabFromPath) {
      const querySubTab = searchParams.get('subtab');
      const sub = querySubTab === 'closed' ? 'closed' : 'unclosed';
      const params = new URLSearchParams(searchParams);
      params.delete('subtab');
      const qs = params.toString();
      navigate(`/personnel/requester/close-unclosed/${sub}${qs ? `?${qs}` : ''}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabFromPath, subtabFromPath]);

  useEffect(() => {
    if (viewOnlyRequesters && activeTab !== 'manage') {
      navigate('/personnel/requester/manage', { replace: true });
    }
  }, [viewOnlyRequesters, activeTab, navigate]);

  // Setup Portal and hide Header title
  useEffect(() => {
    const target = document.getElementById('header-center-portal');
    if (target) {
      setPortalTarget(target);
    }

    // Hide the original header title while this component is mounted
    const title = document.querySelector('.header__title') as HTMLElement;
    if (title) {
      title.style.display = 'none';
      title.setAttribute('aria-hidden', 'true');
    }

    return () => {
      // Restore title when unmounting
      if (title) {
        title.style.display = '';
        title.removeAttribute('aria-hidden');
      }
    };
  }, []);

  const initialDailyAdminRef = React.useRef<ReturnType<typeof resolveDailyAdminFilters> | null>(null);
  if (initialDailyAdminRef.current === null) {
    initialDailyAdminRef.current = resolveDailyAdminFilters(buildDailyAdminFilterDefaults());
  }
  const initialDailyAdmin = initialDailyAdminRef.current;

  // Daily Admin State loaded from Requester/with-requests endpoint
  const [dailyRequesterRows, setDailyRequesterRows] = useState<RequesterWithRequestsListResponse[]>([]);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailyLoadingMore, setDailyLoadingMore] = useState(false);
  const [dailyCurrentPage, setDailyCurrentPage] = useState(1);
  const [dailyHasMore, setDailyHasMore] = useState(false);
  /** Total requester rows from API (`PagedList.totalRecords`) for the current filters. */
  const [dailyTotalRequesters, setDailyTotalRequesters] = useState(0);
  const [cloneProcessingMessage, setCloneProcessingMessage] = useState<string | null>(null);
  const [dailyStartDate, setDailyStartDate] = useState(initialDailyAdmin.dailyStartDate);
  const [dailyEndDate, setDailyEndDate] = useState(initialDailyAdmin.dailyEndDate);
  const resetDailyDates = useCallback(() => {
    const { startDate, endDate } = getDefaultDailyAdminDateRange();
    setDailyStartDate(startDate);
    setDailyEndDate(endDate);
  }, []);
  const [dailySearchRequester, setDailySearchRequester] = useState(initialDailyAdmin.dailySearchRequester);
  const [dailyRequestStatuses, setDailyRequestStatuses] = useState<RequestStatus[]>(
    () => initialDailyAdmin.dailyRequestStatuses as RequestStatus[]
  );
  const [dailyRequestTypes, setDailyRequestTypes] = useState<RequestTypes[]>(
    () => initialDailyAdmin.dailyRequestTypes as RequestTypes[]
  );
  const debouncedDailySearchRequester = useDebounce(dailySearchRequester, 500);
  const dailyRequests = useMemo(
    () =>
      dailyRequesterRows.flatMap((requester) => requester.requests || []),
    [dailyRequesterRows]
  );

  /** `/personnel/requester/:tab/:requesterId/request/:requestId/roster?dateOfWork=YYYY-MM-DD` — date comes from backend roster-dates / picker. */
  const ROSTER_URL_DATE_QUERY = 'dateOfWork';
  const rosterModalFromRoute = Boolean(rosterRequestRouteParam?.trim() && rosterRequesterRouteParam?.trim());
  const effectiveRosterRequestId = rosterRequestRouteParam?.trim() ?? '';

  const rosterModalDateProp = useMemo(() => {
    if (!rosterModalFromRoute) return rosterDateOfWork;
    const fromQuery = searchParams.get(ROSTER_URL_DATE_QUERY)?.trim();
    return fromQuery || rosterDateOfWork.trim() || '';
  }, [rosterModalFromRoute, searchParams, rosterDateOfWork]);

  /** Keep local state in sync when URL query changes (picker / deep link). */
  useEffect(() => {
    if (!rosterModalFromRoute) return;
    const fromQuery = searchParams.get(ROSTER_URL_DATE_QUERY)?.trim();
    setRosterDateOfWork(fromQuery || '');
  }, [rosterModalFromRoute, searchParams]);

  /** Daily Workspace roster must stay under /personnel/daily-workspace (not Daily Administration). */
  useEffect(() => {
    if (!rosterModalFromRoute) return;
    const returnPath = (
      location.state as { returnPath?: string } | null
    )?.returnPath?.trim();
    if (!returnPath || !isDailyWorkspacePath(returnPath)) return;

    const requesterId = rosterRequesterRouteParam?.trim() ?? '';
    const requestId = effectiveRosterRequestId;
    if (!requesterId || !requestId) return;

    navigate(
      `/personnel/daily-workspace/${requesterId}/request/${requestId}/roster${location.search}`,
      { replace: true, state: location.state }
    );
  }, [
    rosterModalFromRoute,
    rosterRequesterRouteParam,
    effectiveRosterRequestId,
    location.search,
    location.state,
    navigate,
  ]);

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

  const [expandedRequesters, setExpandedRequesters] = useState<string[]>(
    () => initialDailyAdmin.expandedRequesters
  );
  const [expandedRequests, setExpandedRequests] = useState<string[]>(
    () => initialDailyAdmin.expandedRequests
  );

  const [postsByRequest, setPostsByRequest] = useState<Record<string, Post[]>>({});
  const [postCollectDatesByPost, setPostCollectDatesByPost] = useState<Record<string, string[]>>({});
  const [loadingPostCollectDatesByPost, setLoadingPostCollectDatesByPost] = useState<Record<string, boolean>>({});
  const [postPositionsByPostAndDate, setPostPositionsByPostAndDate] = useState<Record<string, PostPositionResponse[]>>({});
  const [filledPositionsByPostAndDate, setFilledPositionsByPostAndDate] = useState<Record<string, number>>({});
  const [loadingPostPositionsByPost, setLoadingPostPositionsByPost] = useState<Record<string, boolean>>({});
  /** Per-post View History toggle for GET `/PostPosition/by-post/{id}?isViewHistory=`. Default false. */
  const [viewHistoryByPostId, setViewHistoryByPostId] = useState<Record<string, boolean>>({});
  /** Selected work-date filter keys (`postId:YYYY-MM-DD`). Empty for a post = unfiltered employees. */
  const [expandedPostDays, setExpandedPostDays] = useState<Set<string>>(new Set());
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(
    () => new Set(initialDailyAdmin.expandedPosts)
  );
  /** Request IDs currently loading posts/positions (lazy load) */
  const [, setLoadingRequestIds] = useState<Record<string, boolean>>({});

  const [postsPaginationByRequest, setPostsPaginationByRequest] = useState<
    Record<string, { page: number; pageSize: number; totalRecords: number }>
  >({});
  const [pageSizeMenuAnchor, setPageSizeMenuAnchor] = useState<{ el: HTMLElement; requestID: string } | null>(null);

  const getPostsPagination = useCallback((requestID: string) => {
    const existing = postsPaginationByRequest[requestID] || {
      page: 1,
      pageSize: DEFAULT_TABLE_PAGE_SIZE,
      totalRecords: 0,
    };
    const totalPages = Math.max(1, Math.ceil(existing.totalRecords / existing.pageSize || 1));
    const safePage = Math.min(Math.max(existing.page, 1), totalPages);
    return { ...existing, totalPages, page: safePage };
  }, [postsPaginationByRequest]);

  const setPostsPagination = (
    requestID: string,
    values: Partial<{ page: number; pageSize: number; totalRecords: number }>
  ) => {
    setPostsPaginationByRequest((prev) => {
      const current = prev[requestID] || { page: 1, pageSize: DEFAULT_TABLE_PAGE_SIZE, totalRecords: 0 };
      const merged = { ...current, ...values };
      return {
        ...prev,
        [requestID]: merged,
      };
    });
  };

  /** On arrow click: call Post/by-request/{requestId} with backend paging; do not fetch positions here. */
  const loadPostsAndPositionsForRequest = useCallback(
    async (requestID: string, opts?: { page?: number; pageSize?: number }) => {
      setLoadingRequestIds(prev => ({ ...prev, [requestID]: true }));
      try {
        const currentPaging = getPostsPagination(requestID);
        const page = opts?.page ?? currentPaging.page ?? 1;
        const pageSize = opts?.pageSize ?? currentPaging.pageSize ?? DEFAULT_TABLE_PAGE_SIZE;

        const postsResponse = await getPosts({ requestID, page, pageSize });
        const posts = postsResponse.data || [];

        setPostsByRequest(prev => ({ ...prev, [requestID]: posts }));
        setPostsPagination(requestID, {
          page,
          pageSize,
          totalRecords: postsResponse.totalRecords ?? posts.length,
        });
      } catch (err) {
        console.error(`Failed to load posts for request ${requestID}`, err);
        setPostsByRequest(prev => ({ ...prev, [requestID]: [] }));
        setPostsPagination(requestID, { totalRecords: 0 });
      } finally {
        setLoadingRequestIds(prev => ({ ...prev, [requestID]: false }));
      }
    },
    [getPostsPagination]
  );

  const fetchDailyRequesterPage = useCallback(
    async (page: number, mode: 'replace' | 'append') => {
      const res = await fetchRequesterWorkspaceList({
        isDailyWorkspace: false,
        pageParam: {
          page,
          pageSize: DAILY_REQUESTERS_PAGE_SIZE,
          sortBy: 'requesterName',
          sortDirection: 'asc',
        },
        requestStatuses: dailyRequestStatuses.map((status) => Number(status)),
        requestTypes: dailyRequestTypes.map((type) => Number(type)),
        startDate: dailyStartDate ?? undefined,
        endDate: dailyEndDate ?? undefined,
        ...(debouncedDailySearchRequester.trim()
          ? { requesterName: debouncedDailySearchRequester.trim() }
          : {}),
        ...(dailyRequestStatuses.includes(RequestStatus.Completed)
          ? { includeCompleted: true }
          : {}),
      });
      const nextData = (res.data || []) as RequesterWithRequestsListResponse[];
      setDailyCurrentPage(page);
      setDailyTotalRequesters(res.totalRecords ?? 0);
      setDailyHasMore(page * DAILY_REQUESTERS_PAGE_SIZE < (res.totalRecords ?? 0));
      setDailyRequesterRows((prev) => {
        if (mode === 'replace') return nextData;
        const merged = [...prev];
        const seen = new Set(prev.map((row) => row.requesterID));
        nextData.forEach((row) => {
          if (!seen.has(row.requesterID)) {
            merged.push(row);
            seen.add(row.requesterID);
          }
        });
        return merged;
      });
    },
    [dailyRequestStatuses, dailyRequestTypes, dailyStartDate, dailyEndDate, debouncedDailySearchRequester]
  );

  const refreshDailyAdministrationData = useCallback(async () => {
    await fetchDailyRequesterPage(1, 'replace');
  }, [fetchDailyRequesterPage]);

  const loadMoreDailyRequesters = useCallback(async () => {
    if (dailyLoading || dailyLoadingMore || !dailyHasMore) return;
    setDailyLoadingMore(true);
    try {
      await fetchDailyRequesterPage(dailyCurrentPage + 1, 'append');
    } finally {
      setDailyLoadingMore(false);
    }
  }, [dailyLoading, dailyLoadingMore, dailyHasMore, dailyCurrentPage, fetchDailyRequesterPage]);

  useEffect(() => {
    if (activeTab === 'daily') {
      setDailyLoading(true);
      setDailyCurrentPage(1);
      setDailyHasMore(false);
      dailyLazyReloadKeyRef.current = null;
      const snap = dailyPersistSnapshotRef.current;
      if (
        snap.expandedRequesters.length > 0 ||
        snap.expandedRequests.length > 0 ||
        snap.expandedPosts.length > 0
      ) {
        dailyRestoreExpandedPendingRef.current = true;
      }
      // Clear lazy-loaded data when filters change so we don't show stale data
      setPostsByRequest({});
      setPostCollectDatesByPost({});
      setLoadingPostCollectDatesByPost({});
      setPostPositionsByPostAndDate({});
      setFilledPositionsByPostAndDate({});
      setLoadingPostPositionsByPost({});
      setExpandedPostDays(new Set());
      setLoadingRequestIds({});
      setPostsPaginationByRequest({});

      let cancelled = false;
      (async () => {
        try {
          await fetchDailyRequesterPage(1, 'replace');
        } catch (err) {
          console.error('Failed to load Daily Administration data', err);
          if (!cancelled) {
            setDailyRequesterRows([]);
            setDailyCurrentPage(1);
            setDailyTotalRequesters(0);
            setDailyHasMore(false);
          }
        } finally {
          if (!cancelled) setDailyLoading(false);
        }
      })();

      return () => {
        cancelled = true;
      };
    }
  }, [
    activeTab,
    dailyRequestStatuses,
    dailyRequestTypes,
    dailyStartDate,
    dailyEndDate,
    debouncedDailySearchRequester,
    fetchDailyRequesterPage,
  ]);

  /** Stable key for filter-driven list reloads — used to re-fetch lazy-loaded posts/positions after Clear / filter changes. */
  const dailyFilterKey = useMemo(
    () =>
      JSON.stringify({
        statuses: dailyRequestStatuses.map((status) => Number(status)),
        types: dailyRequestTypes.map((type) => Number(type)),
        start: dailyStartDate,
        end: dailyEndDate,
        search: debouncedDailySearchRequester.trim(),
      }),
    [dailyRequestStatuses, dailyRequestTypes, dailyStartDate, dailyEndDate, debouncedDailySearchRequester]
  );

  const dailyRequestStatusValues = useMemo(
    () => dailyRequestStatuses.map((status) => Number(status)),
    [dailyRequestStatuses]
  );

  const dailyIncludeCompleted = useMemo(
    () => dailyRequestStatuses.includes(RequestStatus.Completed),
    [dailyRequestStatuses]
  );

  /** Daily tab: hydrate filters + expand tree from sessionStorage (or legacy URL once), then keep URL clean. */
  const dailySessionHydratedRef = React.useRef(false);
  const dailySessionReadyForPersistRef = React.useRef(false);
  const dailyLazyReloadKeyRef = React.useRef<string | null>(null);
  /** After session restore, re-fetch lazy-loaded posts/dates once expanded state is committed. */
  const dailyRestoreExpandedPendingRef = React.useRef(
    initialDailyAdmin.expandedRequesters.length > 0 ||
      initialDailyAdmin.expandedRequests.length > 0 ||
      initialDailyAdmin.expandedPosts.length > 0
  );
  const dailyPersistSnapshotRef = React.useRef({
    dailySearchRequester: '',
    dailyStartDate: '',
    dailyEndDate: '',
    dailyRequestStatuses: [] as number[],
    dailyRequestTypes: [] as number[],
    expandedRequesters: [] as string[],
    expandedRequests: [] as string[],
    expandedPosts: [] as string[],
  });

  dailyPersistSnapshotRef.current = {
    dailySearchRequester,
    dailyStartDate,
    dailyEndDate,
    dailyRequestStatuses: dailyRequestStatuses.map((status) => Number(status)),
    dailyRequestTypes: dailyRequestTypes.map((type) => Number(type)),
    expandedRequesters,
    expandedRequests,
    expandedPosts: Array.from(expandedPosts),
  };

  useEffect(() => {
    return () => {
      writeDailyAdminSessionState(dailyPersistSnapshotRef.current);
    };
  }, []);

  useEffect(() => {
    if (activeTab !== 'daily') {
      dailySessionHydratedRef.current = false;
      dailySessionReadyForPersistRef.current = false;
      dailyLazyReloadKeyRef.current = null;
      dailyRestoreExpandedPendingRef.current = false;
      return;
    }

    dailySessionReadyForPersistRef.current = true;
    if (dailySessionHydratedRef.current) return;

    const fromSession = readDailyAdminSessionState();
    const fromUrl =
      !fromSession && hasDailyAdminSearchParams(searchParams)
        ? readDailyAdminFromSearchParams(searchParams)
        : null;

    dailySessionHydratedRef.current = true;

    if (!fromUrl) return;

    const { startDate, endDate } = getDefaultDailyAdminDateRange();
    setDailySearchRequester(fromUrl.dailySearchRequester);
    setDailyStartDate(fromUrl.dailyStartDate?.trim() || startDate);
    setDailyEndDate(fromUrl.dailyEndDate?.trim() || endDate);

    const exR = fromUrl.expandedRequesters;
    const exQ = fromUrl.expandedRequests;
    const exP = fromUrl.expandedPosts;
    if (exR.length > 0 || exQ.length > 0 || exP.length > 0) {
      setExpandedRequesters(exR);
      setExpandedRequests(exQ);
      setExpandedPosts(new Set(exP));
      dailyRestoreExpandedPendingRef.current = true;
      dailyLazyReloadKeyRef.current = null;
    }

    const onRosterDeepLink =
      location.pathname.includes('/request/') && location.pathname.endsWith('/roster');
    if (!onRosterDeepLink) {
      setSearchParams((prev) => stripDailyAdminSearchParams(prev), { replace: true });
    }
  }, [activeTab, location.pathname, searchParams, setSearchParams]);

  /** Persist Daily Administration UI to sessionStorage while on the daily tab (in-memory state is primary). */
  useEffect(() => {
    if (activeTab !== 'daily' || !dailySessionReadyForPersistRef.current) return;
    writeDailyAdminSessionState(dailyPersistSnapshotRef.current);
  }, [
    activeTab,
    dailySearchRequester,
    dailyStartDate,
    dailyEndDate,
    dailyRequestStatuses,
    dailyRequestTypes,
    expandedRequesters,
    expandedRequests,
    expandedPosts,
  ]);

  /** Daily state must not leak across side tabs (Manage / Closed-Unclosed). */
  const prevTabForDailyResetRef = React.useRef<RequesterListTab | null>(null);
  useEffect(() => {
    const prevTab = prevTabForDailyResetRef.current;
    prevTabForDailyResetRef.current = activeTab;
    if (prevTab !== 'daily' || activeTab === 'daily') return;

    clearDailyAdminSessionState();
    dailySessionHydratedRef.current = false;
    dailySessionReadyForPersistRef.current = false;
    dailyLazyReloadKeyRef.current = null;
    dailyRestoreExpandedPendingRef.current = false;

    setDailyRequesterRows([]);
    setDailyLoading(false);
    setDailyLoadingMore(false);
    setDailyCurrentPage(1);
    setDailyHasMore(false);
    setDailyTotalRequesters(0);
    resetDailyDates();
    setDailySearchRequester('');
    setDailyRequestStatuses([...DEFAULT_REQUESTER_WITH_REQUESTS_STATUSES]);
    setDailyRequestTypes([...DEFAULT_REQUESTER_WITH_REQUEST_TYPES]);
    setExpandedRequesters([]);
    setExpandedRequests([]);
    setExpandedPosts(new Set());
    setExpandedPostDays(new Set());
    setPostsByRequest({});
    setPostCollectDatesByPost({});
    setLoadingPostCollectDatesByPost({});
    setPostPositionsByPostAndDate({});
    setFilledPositionsByPostAndDate({});
    setLoadingPostPositionsByPost({});
    setPostsPaginationByRequest({});
  }, [activeTab, resetDailyDates]);

  // Restore manage tab search from URL when entering manage tab
  const prevTabForFiltersRef = React.useRef<string | null>(null);
  useEffect(() => {
    const prevTab = prevTabForFiltersRef.current;
    prevTabForFiltersRef.current = activeTab;
    if (prevTab !== 'manage' && activeTab === 'manage') {
      setManageSearchQuery(searchParams.get('search') ?? '');
    }
  }, [activeTab, searchParams]);

  // Sync manage tab search (search=) to URL when on manage tab
  useEffect(() => {
    if (activeTab !== 'manage') return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (debouncedManageSearchQuery.trim()) next.set('search', debouncedManageSearchQuery.trim());
        else next.delete('search');
        return next;
      },
      { replace: true }
    );
  }, [activeTab, debouncedManageSearchQuery]);


  /** Return path for Back from edit/add. Daily tab state is restored via sessionStorage, not query params. */
  const requesterListReturnPath = useMemo(() => {
    if (activeTab === 'close-unclosed') {
      const sub = subtabFromPath === 'closed' ? 'closed' : 'unclosed';
      return `/personnel/requester/close-unclosed/${sub}`;
    }
    const path = `/personnel/requester/${activeTab}`;
    if (activeTab === 'manage') {
      const params = new URLSearchParams();
      if (manageSearchQuery.trim()) params.set('search', manageSearchQuery.trim());
      const qs = params.toString();
      return qs ? `${path}?${qs}` : path;
    }
    return path;
  }, [activeTab, subtabFromPath, manageSearchQuery]);

  const openSendEmail = useCallback((context: SendEmailContext) => {
    setSendEmailContext(context);
  }, []);

  const closeSendEmail = useCallback(() => {
    setSendEmailContext(null);
  }, []);

  // Post Navigation Handlers (for future use)
  // const handleCreatePost = (reqID: string) => {
  //   navigate(`/personnel/post/create/${reqID}`);
  // };

  const handleEditPost = useCallback(
    (post: Post) => {
      if (post.postId && post.requestID) {
        navigate(`/personnel/job/${post.requestID}/${post.postId}?mode=edit`, {
          state: { returnPath: requesterListReturnPath, tab: activeTab }
        });
      }
    },
    [navigate, requesterListReturnPath, activeTab]
  );

  const handleClonePost = useCallback(
    async (post: Post) => {
      if (!post.postId) return;
      setCloneProcessingMessage('Cloning job...');
      try {
        const clonedPost = await dispatch(clonePostThunk(post.postId)).unwrap();
        const editRequestId = clonedPost.requestID ?? post.requestID;
        if (editRequestId) {
          await loadPostsAndPositionsForRequest(editRequestId);
        }
        if (clonedPost.postId && editRequestId) {
          navigate(`/personnel/job/${editRequestId}/${clonedPost.postId}?mode=edit`, {
            state: {
              returnPath: requesterListReturnPath,
              tab: activeTab,
              highlightCloneTimeFields: true,
              isCloned: true,
            },
          });
        }
      } catch (error) {
        console.error('Failed to clone job', error);
      } finally {
        setCloneProcessingMessage(null);
      }
    },
    [dispatch, loadPostsAndPositionsForRequest, navigate, requesterListReturnPath, activeTab]
  );

  const toggleRequesterExpand = useCallback(
    (requesterID: string) => {
      const isExpanding = !expandedRequesters.includes(requesterID);
      if (isExpanding) {
        setExpandedRequesters(prev => [...prev, requesterID]);
      } else {
        const requestIdsForRequester = dailyRequests
          .filter((r) => r.requesterID === requesterID)
          .map((r) => r.requestID);
        const postIdsToCollapse = new Set<string>();
        requestIdsForRequester.forEach((reqId) => {
          (postsByRequest[reqId] || []).forEach((p) => {
            if (p.postId) postIdsToCollapse.add(p.postId);
          });
        });
        setExpandedRequesters(prev => prev.filter((id) => id !== requesterID));
        setExpandedRequests(prev => prev.filter((reqId) => !requestIdsForRequester.includes(reqId)));
        setExpandedPosts(prev => {
          const next = new Set(prev);
          postIdsToCollapse.forEach((id) => next.delete(id));
          return next;
        });
      }
    },
    [expandedRequesters, dailyRequests, postsByRequest]
  );

  const toggleRequestExpand = useCallback(
    (id: string) => {
      const isExpanding = !expandedRequests.includes(id);
      if (isExpanding) {
        loadPostsAndPositionsForRequest(id);
        setExpandedRequests(prev => [...prev, id]);
      } else {
        const postIdsInRequest = (postsByRequest[id] || []).map((p) => p.postId).filter(Boolean) as string[];
        setExpandedRequests(prev => prev.filter((reqId) => reqId !== id));
        setExpandedPosts(prev => {
          const next = new Set(prev);
          postIdsInRequest.forEach((postId) => next.delete(postId));
          return next;
        });
      }
    },
    [expandedRequests, loadPostsAndPositionsForRequest, postsByRequest]
  );

  const clearPostDateTreeStateForPost = useCallback((postId: string) => {
    const expandPrefix = `${postId}:`;
    const cachePrefix = `${postId}|`;
    setExpandedPostDays((prev) => new Set([...prev].filter((key) => !key.startsWith(expandPrefix))));
    setPostCollectDatesByPost((prev) => {
      const next = { ...prev };
      delete next[postId];
      return next;
    });
    setLoadingPostCollectDatesByPost((prev) => {
      const next = { ...prev };
      delete next[postId];
      return next;
    });
    setLoadingPostPositionsByPost((prev) => {
      const next = { ...prev };
      delete next[postId];
      return next;
    });
    setPostPositionsByPostAndDate((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        if (key.startsWith(cachePrefix)) delete next[key];
      });
      return next;
    });
    setFilledPositionsByPostAndDate((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        if (key.startsWith(cachePrefix)) delete next[key];
      });
      return next;
    });
    setViewHistoryByPostId((prev) => {
      if (!(postId in prev)) return prev;
      const next = { ...prev };
      delete next[postId];
      return next;
    });
  }, []);

  const togglePostExpand = useCallback((postId: string) => {
    setExpandedPosts((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
        clearPostDateTreeStateForPost(postId);
      } else {
        next.add(postId);
      }
      return next;
    });
  }, [clearPostDateTreeStateForPost]);

  const loadPositionsForPost = useCallback(async (
    postId: string,
    selectedDates: string[],
    pagination?: { page: number; pageSize: number },
    options?: { isViewHistory?: boolean }
  ): Promise<{ positions: PostPositionResponse[]; dates: string[]; totalRecords: number }> => {
    const sorted = [...selectedDates].sort();
    const cacheKey = postPositionFilterCacheKey(postId, sorted);
    const filterStart = extractYyyyMmDdPrefix(dailyStartDate) ?? undefined;
    const filterEnd = extractYyyyMmDdPrefix(dailyEndDate) ?? undefined;
    const isViewHistory = options?.isViewHistory ?? viewHistoryByPostId[postId] ?? false;
    setLoadingPostPositionsByPost((prev) => ({ ...prev, [postId]: true }));

    try {
      const positionsResponse = await dispatch(
        fetchPostPositions({
          postId,
          page: pagination?.page ?? 1,
          pageSize: pagination?.pageSize ?? DEFAULT_TABLE_PAGE_SIZE,
          // Always send Daily Administration Start/End (default or user-selected).
          ...(filterStart ? { startDate: filterStart } : {}),
          ...(filterEnd ? { endDate: filterEnd } : {}),
          ...(sorted.length > 0 ? { dates: sorted } : {}),
          requestStatuses: dailyRequestStatusValues,
          ...(dailyIncludeCompleted ? { includeCompleted: true } : {}),
          isViewHistory,
        })
      ).unwrap();
      const pagePayload = positionsResponse.data;
      const rawPositions = passThroughPostPositions(pagePayload?.data || []);
      // Keep UI in sync with filter Start/End even if API returns out-of-range rows.
      const positions =
        filterStart && filterEnd
          ? rawPositions.filter((row) => {
              const workDate = extractYyyyMmDdPrefix(readPositionDateOfWork(row));
              return Boolean(workDate && workDate >= filterStart && workDate <= filterEnd);
            })
          : rawPositions;
      const total =
        filterStart && filterEnd && positions.length !== rawPositions.length
          ? positions.length
          : (pagePayload?.totalRecords ?? positions.length);
      const dates = clampCollectDatesToFilterRange(
        pagePayload?.dates?.length
          ? pagePayload.dates
          : positions.map((row) => readPositionDateOfWork(row)),
        dailyStartDate,
        dailyEndDate
      );

      setPostCollectDatesByPost((prev) => ({ ...prev, [postId]: dates }));
      setPostPositionsByPostAndDate((prev) => ({ ...prev, [cacheKey]: positions }));
      setFilledPositionsByPostAndDate((prev) => ({ ...prev, [cacheKey]: total }));
      return { positions, dates, totalRecords: total };
    } catch (err) {
      console.error(`Failed to load positions for post ${postId}`, err);
      setPostPositionsByPostAndDate((prev) => ({ ...prev, [cacheKey]: [] }));
      setFilledPositionsByPostAndDate((prev) => {
        const next = { ...prev };
        delete next[cacheKey];
        return next;
      });
      return { positions: [], dates: [], totalRecords: 0 };
    } finally {
      setLoadingPostPositionsByPost((prev) => ({ ...prev, [postId]: false }));
    }
  }, [
    dispatch,
    dailyStartDate,
    dailyEndDate,
    dailyRequestStatusValues,
    dailyIncludeCompleted,
    viewHistoryByPostId,
  ]);

  const handleTogglePostViewHistory = useCallback(
    (postId: string, selectedDates: string[]) => {
      const id = postId.trim();
      if (!id) return;
      const next = !(viewHistoryByPostId[id] ?? false);
      setViewHistoryByPostId((prev) => ({ ...prev, [id]: next }));
      void loadPositionsForPost(id, selectedDates, undefined, { isViewHistory: next });
    },
    [loadPositionsForPost, viewHistoryByPostId]
  );

  /**
   * Expand post with one GET `/PostPosition/by-post/{id}`.
   * Calendar dates come from `dates` on that response; rows come from `data`.
   */
  const loadPostEmployeesAndExpand = useCallback(async (postId: string) => {
    setExpandedPosts((prev) => new Set(prev).add(postId));
    setLoadingPostCollectDatesByPost((prev) => ({ ...prev, [postId]: true }));
    setPostCollectDatesByPost((prev) => {
      const next = { ...prev };
      delete next[postId];
      return next;
    });

    try {
      const loaded = await loadPositionsForPost(postId, []);
      const dates = loaded.dates.length > 0
        ? loaded.dates
        : collectDatesFromPositions(loaded.positions, dailyStartDate, dailyEndDate);
      setPostCollectDatesByPost((prev) => ({ ...prev, [postId]: dates }));

      const datesToLoad = resolveDailyAdminDefaultPositionDates(dates);
      setExpandedPostDays((prev) => {
        const next = new Set([...prev].filter((key) => !key.startsWith(`${postId}:`)));
        datesToLoad.forEach((date) => next.add(postPositionDayExpandKey(postId, date)));
        return next;
      });

      const selectedKey = postPositionFilterCacheKey(postId, datesToLoad);
      const unfilteredKey = postPositionFilterCacheKey(postId, []);
      if (selectedKey === unfilteredKey) return;

      const selectedSet = new Set(datesToLoad);
      const visible = loaded.positions.filter((row) => {
        const workDate = extractYyyyMmDdPrefix(readPositionDateOfWork(row));
        return Boolean(workDate && selectedSet.has(workDate));
      });
      const responseIsComplete = loaded.positions.length >= loaded.totalRecords;
      setPostPositionsByPostAndDate((prev) => ({ ...prev, [selectedKey]: visible }));
      setFilledPositionsByPostAndDate((prev) => ({
        ...prev,
        [selectedKey]: responseIsComplete ? visible.length : loaded.totalRecords,
      }));
    } catch (err) {
      console.error(`Failed to expand post ${postId}`, err);
      setPostCollectDatesByPost((prev) => ({ ...prev, [postId]: [] }));
    } finally {
      setLoadingPostCollectDatesByPost((prev) => ({ ...prev, [postId]: false }));
    }
  }, [dailyStartDate, dailyEndDate, loadPositionsForPost]);

  const applyPostFilterDatesState = useCallback((postId: string, dates: string[]) => {
    setExpandedPosts((prev) => new Set(prev).add(postId));
    setExpandedPostDays((prev) => {
      const next = new Set([...prev].filter((key) => !key.startsWith(`${postId}:`)));
      dates.forEach((date) => next.add(postPositionDayExpandKey(postId, date)));
      return next;
    });
  }, []);

  const refreshPostPositions = useCallback(async (
    postId: string,
    selectedDates: string[],
    requestID: string,
    pagination?: { page: number; pageSize: number },
    meta?: { refreshPostCounts?: boolean; includeDate?: string }
  ) => {
    const dates = meta?.includeDate
      ? mergeYmdIntoSortedDates(selectedDates, meta.includeDate)
      : selectedDates;
    if (dates.length !== selectedDates.length) {
      applyPostFilterDatesState(postId, dates);
    }
    await loadPositionsForPost(postId, dates, pagination);
    if (meta?.refreshPostCounts && requestID) {
      await loadPostsAndPositionsForRequest(requestID);
    }
  }, [applyPostFilterDatesState, loadPositionsForPost, loadPostsAndPositionsForRequest]);

  const handleRosterCallSignUpdated = useCallback((postId: string) => {
    const id = postId?.trim();
    if (!id || !expandedPosts.has(id)) return;
    const selected = getSelectedDatesForPost(expandedPostDays, id);
    void loadPositionsForPost(id, selected);
  }, [expandedPosts, expandedPostDays, loadPositionsForPost]);

  /** Replace date filter for a post (one or more months, or cleared) and reload employees. */
  const selectPostFilterDates = useCallback((postId: string, dates: string[]) => {
    const sorted = [...dates].sort();
    applyPostFilterDatesState(postId, sorted);
    if (sorted.length === 0) {
      const cacheKey = postPositionFilterCacheKey(postId, []);
      setPostPositionsByPostAndDate((prev) => ({ ...prev, [cacheKey]: [] }));
      setFilledPositionsByPostAndDate((prev) => ({ ...prev, [cacheKey]: 0 }));
      return;
    }
    void loadPositionsForPost(postId, sorted);
  }, [applyPostFilterDatesState, loadPositionsForPost]);

  const togglePostFilterDate = useCallback((postId: string, date: string) => {
    const key = postPositionDayExpandKey(postId, date);
    setExpandedPosts((prev) => new Set(prev).add(postId));
    setExpandedPostDays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      const selected = getSelectedDatesForPost(next, postId);
      void loadPositionsForPost(postId, selected);
      return next;
    });
  }, [loadPositionsForPost]);

  const reloadExpandedDailyTreeData = useCallback(
    (reloadAll: boolean) => {
      expandedRequests.forEach((requestID) => {
        if (reloadAll || postsByRequest[requestID] === undefined) {
          void loadPostsAndPositionsForRequest(requestID);
        }
      });
      Array.from(expandedPosts).forEach((postId) => {
        // Expand in flight — loadPostEmployeesAndExpand will fetch dates + positions.
        if (loadingPostCollectDatesByPost[postId] === true) return;

        const selected = getSelectedDatesForPost(expandedPostDays, postId);
        if (selected.length === 0) {
          // No date filter yet (session restore / stale) — re-run expand so GET by-post/{id} runs.
          const hasPositionsCache = Object.keys(postPositionsByPostAndDate).some((key) =>
            key.startsWith(`${postId}|`)
          );
          if (reloadAll || postCollectDatesByPost[postId] === undefined || !hasPositionsCache) {
            void loadPostEmployeesAndExpand(postId);
          }
          return;
        }

        const cacheKey = postPositionFilterCacheKey(postId, selected);
        if (
          reloadAll ||
          postCollectDatesByPost[postId] === undefined ||
          postPositionsByPostAndDate[cacheKey] === undefined
        ) {
          void loadPositionsForPost(postId, selected);
        }
      });
    },
    [
      expandedRequests,
      expandedPosts,
      expandedPostDays,
      postsByRequest,
      postCollectDatesByPost,
      loadingPostCollectDatesByPost,
      postPositionsByPostAndDate,
      loadPostsAndPositionsForRequest,
      loadPositionsForPost,
      loadPostEmployeesAndExpand,
    ]
  );

  /** After a filter-driven requester reload, re-fetch posts/dates for nodes still expanded in the tree. */
  useEffect(() => {
    if (activeTab !== 'daily' || dailyLoading) return;
    if (!dailySessionHydratedRef.current) return;

    const hasExpandedTree =
      expandedRequesters.length > 0 ||
      expandedRequests.length > 0 ||
      expandedPosts.size > 0 ||
      expandedPostDays.size > 0;

    const filterChanged = dailyLazyReloadKeyRef.current !== dailyFilterKey;
    let reloadAllExpanded = filterChanged;

    if (dailyRestoreExpandedPendingRef.current) {
      if (!hasExpandedTree) return;
      dailyRestoreExpandedPendingRef.current = false;
      reloadAllExpanded = true;
    } else if (!filterChanged) {
      const needsHeal =
        expandedRequests.some((id) => postsByRequest[id] === undefined) ||
        Array.from(expandedPosts).some((id) => {
          // Expand / position load in flight — not a heal case.
          if (loadingPostCollectDatesByPost[id] === true) return false;
          if (loadingPostPositionsByPost[id] === true) return false;
          const selected = getSelectedDatesForPost(expandedPostDays, id);
          if (selected.length === 0) return postCollectDatesByPost[id] === undefined;
          const cacheKey = postPositionFilterCacheKey(id, selected);
          return postPositionsByPostAndDate[cacheKey] === undefined;
        });
      if (!needsHeal) return;
    }

    dailyLazyReloadKeyRef.current = dailyFilterKey;
    reloadExpandedDailyTreeData(reloadAllExpanded);
  }, [
    activeTab,
    dailyLoading,
    dailyFilterKey,
    expandedRequesters,
    expandedRequests,
    expandedPosts,
    expandedPostDays,
    postsByRequest,
    postCollectDatesByPost,
    loadingPostCollectDatesByPost,
    postPositionsByPostAndDate,
    loadingPostPositionsByPost,
    reloadExpandedDailyTreeData,
  ]);

  const handleCollapseAll = useCallback(() => {
    setExpandedRequesters([]);
    setExpandedRequests([]);
    setExpandedPosts(new Set());
    setExpandedPostDays(new Set());
  }, []);




  const handleCreatePost = useCallback(
    (reqID: string) => {
      navigate(`/personnel/job/create/${reqID}`, {
        state: { returnPath: requesterListReturnPath, tab: activeTab }
      });
    },
    [navigate, requesterListReturnPath, activeTab]
  );

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadModalRequest, setUploadModalRequest] = useState<RequestResponse | null>(null);
  const [uploadModalExistingFiles, setUploadModalExistingFiles] = useState<FileUploadDto[]>([]);

  useEffect(() => {
    if (!uploadModalOpen || !uploadModalRequest?.requestID || !uploadModalRequest?.requesterID) {
      setUploadModalExistingFiles([]);
      return;
    }
    let mounted = true;
    getFilesOrFile(uploadModalRequest.requesterID, uploadModalRequest.requestID)
      .then((list) => { if (mounted) setUploadModalExistingFiles(list ?? []); })
      .catch(() => { if (mounted) setUploadModalExistingFiles([]); });
    return () => { mounted = false; };
  }, [uploadModalOpen, uploadModalRequest?.requestID, uploadModalRequest?.requesterID]);

  const handleFileUpload = async (request: RequestResponse, files: File[]) => {
    if (files.length === 0) return;
    if (!request.requesterID) {
      dispatch(showToast('Cannot upload: request is missing requester.', 'error'));
      return;
    }
    try {
      await fileUpload(request.requesterID, request.requestID, files);
      dispatch(showToast(`${files.length} file(s) saved for request ${request.requestID}`, 'success'));
      const updated = await getFilesOrFile(request.requesterID, request.requestID);
      setUploadModalExistingFiles(updated ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload files';
      dispatch(showToast(message, 'error'));
    }
  };

  const handleUploadModalClose = () => {
    setUploadModalOpen(false);
    setUploadModalRequest(null);
    setUploadModalExistingFiles([]);
  };

  const handleEditRequest = useCallback(
    (requestID: string) => {
      navigate(`/personnel/request/edit/${requestID}`, {
        state: { returnPath: requesterListReturnPath, tab: activeTab }
      });
    },
    [navigate, requesterListReturnPath, activeTab]
  );

  const handleCloneRequest = useCallback(
    async (request: RequestResponse) => {
      setCloneProcessingMessage('Cloning request...');
      try {
        const created = await dispatch(cloneRequestThunk(request.requestID)).unwrap();
        const newRequestId = created.requestID;
        if (activeTab === 'daily') {
          setDailyLoading(true);
          refreshDailyAdministrationData()
            .catch((err) => console.error('Failed to refresh requests after clone', err))
            .finally(() => setDailyLoading(false));
        }
        if (newRequestId) {
          navigate(`/personnel/request/edit/${newRequestId}`, {
            state: { returnPath: requesterListReturnPath, tab: activeTab, isCloned: true },
          });
        }
      } catch (error) {
        console.error('Failed to clone request', error);
      } finally {
        setCloneProcessingMessage(null);
      }
    },
    [dispatch, activeTab, refreshDailyAdministrationData, navigate, requesterListReturnPath]
  );

  // Group requests by requester. Daily Administration filters are applied server-side by requester-with-requests.
  const groupedByRequester = useMemo(() => {
    const grouped: Record<
      string,
      { requester: RequesterResponse | null; requests: RequestResponse[]; hasUnpaidInvoice?: boolean }
    > = {};

    dailyRequesterRows.forEach((requesterRow) => {
      const requesterID = requesterRow.requesterID;
      const requesterName = requesterRow.requesterName || '';

      const filteredRequests = requesterRow.requests || [];

      if (filteredRequests.length === 0) return;

      grouped[requesterID] = {
        requester: {
          requesterID,
          name: requesterName,
        },
        requests: filteredRequests,
        hasUnpaidInvoice: Boolean(requesterRow.hasUnpaidInvoice),
      };
    });

    return grouped;
  }, [dailyRequesterRows]);

  // Define tab items (view-only requesters see only Manage Requesters)
  const tabItems: SMSTabOption[] = useMemo(
    () =>
      viewOnlyRequesters
        ? [{ id: 'manage', label: 'Manage Requesters', icon: 'group' }]
        : [
            { id: 'manage', label: 'Manage Requesters', icon: 'group' },
            { id: 'close-unclosed', label: 'Unclosed/Closed Assignment', icon: 'assignment_turned_in' },
            { id: 'daily', label: 'Daily Administration', icon: 'admin_panel_settings' },
          ],
    [viewOnlyRequesters]
  );

  useEffect(() => {
    // Only fetch requesters when on the manage tab
    if (activeTab === 'manage') {
      const searchTerm = debouncedManageSearchQuery.trim();
      const params = {
        page: currentPage,
        pageSize,
        ...(searchTerm ? { searchTerm } : {}),
      };
      if (searchTerm) {
        dispatch(searchRequestersThunk(params));
      } else {
        dispatch(fetchRequesters(params));
      }
    }
  }, [dispatch, currentPage, pageSize, activeTab, debouncedManageSearchQuery]);

  const handleAdd = useCallback(() => {
    navigate('/personnel/requester/add', {
      state: { returnPath: requesterListReturnPath, tab: activeTab }
    });
  }, [navigate, requesterListReturnPath, activeTab]);

  const handleViewProfile = useCallback(
    (item: RequesterResponse) => {
      navigate(`/personnel/requester/view/${item.requesterID}`, {
        state: { returnPath: requesterListReturnPath, tab: activeTab }
      });
    },
    [navigate, requesterListReturnPath, activeTab]
  );

  const handleEdit = useCallback(
    (item: RequesterResponse) => {
      navigate(`/personnel/requester/edit/${item.requesterID}`, {
        state: { returnPath: requesterListReturnPath, tab: activeTab }
      });
    },
    [navigate, requesterListReturnPath, activeTab]
  );

  const handleDelete = useCallback((item: RequesterResponse) => {
    setDeletingItem(item);
    setDeletingRequest(null);
    setDeletingPost(null);
  }, []);

  const handleCreateRequest = useCallback(
    (item: RequesterResponse) => {
      navigate(`/personnel/request/add/${item.requesterID}`, {
        state: { returnPath: requesterListReturnPath, tab: activeTab }
      });
    },
    [navigate, requesterListReturnPath, activeTab]
  );

  const handleRequesterInvoice = useCallback((_requester: RequesterResponse, requests: RequestResponse[]) => {
    setInvoicePreviewRequest(null);
    setInvoicePreviewRequestOptions(requests);
    setInvoicePreviewOpen(true);
  }, []);

  const handleNavigateToRequesterPayment = useCallback(
    (requester: RequesterResponse) => {
      const route = buildRequesterScopedAdminRoute(PAYMENT_GRID.REQUESTER_PAYMENT_PATH, requester, {
        returnPath: requesterListReturnPath,
      });
      navigate(route.path, { state: route.state });
    },
    [activeTab, navigate, requesterListReturnPath]
  );

  const handleDailyScheduleClick = useCallback((request: RequestResponse, e: React.MouseEvent) => {
    e.stopPropagation();
    setScheduleModalRequest(request);
  }, []);

  const handleDailyProjectNumberClick = useCallback(
    (request: RequestResponse, _requester: RequesterResponse, e: React.MouseEvent) => {
      e.stopPropagation();
      navigate(INVOICE_GRID.INVOICE_LIST_PATH, {
        state: {
          request,
          returnTab: activeTab,
          returnPath: requesterListReturnPath,
        },
      });
    },
    [activeTab, navigate, requesterListReturnPath]
  );

  const handleCreateRequestInvoice = useCallback((request: RequestResponse) => {
    setInvoicePreviewRequestOptions([]);
    setInvoicePreviewRequest(request);
    setInvoicePreviewOpen(true);
  }, []);

  const handleDepartmentQuestionnaire = useCallback(async (item: RequesterResponse) => {
    setSelectedRequester(item);
    setSelectedQuestionnaires([]);
    setDepartmentQuestionnaireLoading(true);
    setDepartmentQuestionnaireModalOpen(true);
    try {
      await dispatch(fetchQuestionnairesByDepartment({ page: 1, pageSize: 1000 })).unwrap();
      const result = await dispatch(fetchRequesterQuestionnairesByRequesterIdAsync(item.requesterID)).unwrap();
      setSelectedQuestionnaires(result.map((rq) => rq.questionnaireId));
    } catch {
      setSelectedQuestionnaires([]);
    } finally {
      setDepartmentQuestionnaireLoading(false);
    }
  }, [dispatch]);

  const handleSaveQuestionnaire = async () => {
    if (!selectedRequester?.requesterID) {
      dispatch(showToast('Requester not selected', 'error'));
      return;
    }

    setIsSavingQuestionnaires(true);
    try {
      const existing = await getRequesterQuestionnairesByRequesterId(selectedRequester.requesterID);
      const existingByQuestionnaireId = new Map(
        existing.map((item) => [item.questionnaireId, item.requesterQuestionnaireId])
      );

      const selectedSet = new Set(selectedQuestionnaires);
      const toDelete = existing.filter((item) => !selectedSet.has(item.questionnaireId));
      const toAdd = selectedQuestionnaires.filter((id) => !existingByQuestionnaireId.has(id));

      await Promise.all([
        ...toDelete.map((item) => deleteRequesterQuestionnaire(item.requesterQuestionnaireId)),
        ...toAdd.map((questionnaireId) =>
          upsertRequesterQuestionnaire({
            requesterId: selectedRequester.requesterID,
            questionnaireId,
          })
        ),
      ]);

      dispatch(showToast('Questionnaires saved successfully', 'success'));
      setDepartmentQuestionnaireModalOpen(false);
      setSelectedQuestionnaires([]);
    } catch (error) {
      console.error('Failed to save questionnaires:', error);
      dispatch(showToast('Failed to save questionnaires', 'error'));
    } finally {
      setIsSavingQuestionnaires(false);
    }
  };

  const handleCloseDeleteDialog = useCallback(() => {
    setDeletingItem(null);
    setDeletingRequest(null);
    setDeletingPost(null);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    try {
      if (deletingPost && deletingPost.postId) {
        await dispatch(deletePostThunk(deletingPost.postId)).unwrap();
        if (deletingPost.requestID) {
          const requestId = deletingPost.requestID;
          const existingPosts = postsByRequest[requestId] || [];
          const deletedIds = new Set<string>();
          const queue: string[] = [deletingPost.postId];

          // Build the deleted subtree from current UI data (parent + descendants).
          while (queue.length > 0) {
            const currentId = queue.shift();
            if (!currentId || deletedIds.has(currentId)) continue;
            deletedIds.add(currentId);
            existingPosts.forEach((post) => {
              if (post.postParentID === currentId && post.postId) {
                queue.push(post.postId);
              }
            });
          }

          setPostsByRequest((prev) => {
            const existing = prev[requestId] || [];
            const updatedPosts = existing.filter((p) => !p.postId || !deletedIds.has(p.postId));
            return { ...prev, [requestId]: updatedPosts };
          });

          setExpandedPosts((prev) => {
            const next = new Set(prev);
            deletedIds.forEach((id) => next.delete(id));
            return next;
          });

          deletedIds.forEach((id) => clearPostDateTreeStateForPost(id));

          // Keep pagination metadata responsive immediately, then re-sync from backend.
          const currentPaging = getPostsPagination(requestId);
          setPostsPagination(requestId, {
            totalRecords: Math.max(0, currentPaging.totalRecords - deletedIds.size),
          });

          await loadPostsAndPositionsForRequest(requestId, {
            page: currentPaging.page,
            pageSize: currentPaging.pageSize,
          });
        }
        if (activeTab === 'daily') {
          await refreshDailyAdministrationData();
        }
        setDeletingPost(null);
      } else if (deletingRequest) {
        await dispatch(deleteRequestThunk(deletingRequest.requestID)).unwrap();
        const deletedRequestId = deletingRequest.requestID;
        setPostsByRequest((prev) => {
          const next = { ...prev };
          delete next[deletedRequestId];
          return next;
        });
        if (activeTab === 'daily') {
          setDailyLoading(true);
          refreshDailyAdministrationData()
            .catch((err) => console.error('Failed to refresh requests after delete', err))
            .finally(() => setDailyLoading(false));
        }
        setDeletingRequest(null);
      } else if (deletingItem) {
        await dispatch(removeRequester({ id: deletingItem.requesterID, name: '' })).unwrap();
        if (activeTab === 'manage') {
          const searchTerm = debouncedManageSearchQuery.trim();
          const params = {
            page: currentPage,
            pageSize,
            ...(searchTerm ? { searchTerm } : {}),
          };
          if (searchTerm) {
            dispatch(searchRequestersThunk(params));
          } else {
            dispatch(fetchRequesters(params));
          }
        }
        setDeletingItem(null);
      }
    } catch (error) {
      console.error('Failed to delete item:', error);
    }
  }, [
    deletingPost,
    deletingRequest,
    deletingItem,
    postsByRequest,
    dispatch,
    activeTab,
    refreshDailyAdministrationData,
    getPostsPagination,
    setPostsPagination,
    loadPostsAndPositionsForRequest,
    currentPage,
    pageSize,
    debouncedManageSearchQuery,
  ]);

  const handleTabChange = useCallback(
    (tabId: string) => {
      if (!validTabs.includes(tabId as RequesterListTab)) return;
      const nextTab = tabId as RequesterListTab;
      setActiveTab(nextTab);
      // The merged Closed/Unclosed tab keeps its inner pill in the URL path
      // (default to `/unclosed`); strip any stale ?subtab= when leaving.
      const closeUnclosedSubtab =
        subtabFromPath === 'closed' || subtabFromPath === 'unclosed' ? subtabFromPath : 'unclosed';
      const path =
        nextTab === 'close-unclosed'
          ? `/personnel/requester/close-unclosed/${closeUnclosedSubtab}`
          : `/personnel/requester/${nextTab}`;
      if (nextTab === 'daily') {
        navigate(path, { replace: true });
        return;
      }
      const params = new URLSearchParams(searchParams);
      if (params.has('subtab')) params.delete('subtab');
      const qs = params.toString();
      navigate(`${path}${qs ? `?${qs}` : ''}`, { replace: true });
    },
    [navigate, searchParams, subtabFromPath]
  );

  const handlePageChange = useCallback(
    (page: number) => {
      dispatch(setPagination({ page }));
    },
    [dispatch]
  );

  const handlePageSizeChange = useCallback(
    (newPageSize: number) => {
      dispatch(setPagination({ pageSize: newPageSize, page: 1 }));
    },
    [dispatch]
  );

  const columns: DataTableColumn<RequesterResponse>[] = useMemo(() => [
    {
      key: 'name',
      label: REQUESTER.TABLE.COLUMNS.NAME,
      render: (_value, row) => row.name || '-',
    },
    {
      key: 'primaryContact',
      label: 'Primary Contact',
      render: (_value, row) => row.primaryContact || '-',
    },
    {
      key: 'phone',
      label: REQUESTER.TABLE.COLUMNS.PHONE,
      render: (_value, row) => {
        const formatted = row.phone ? formatPhoneNumber(row.phone) : '';
        return formatted || '-';
      },
    },
    ...(!hideRequesterMasterActions
      ? [
          {
            key: 'actions',
            label: REQUESTER.TABLE.COLUMNS.ACTION,
            render: (_value: unknown, row: RequesterResponse) => (
              <SMSBox className="requester-list__actions requester-list__actions--row data-table__cell--no-clamp">
                <SMSIconButton
                  className="level-1-requester__icon-btn"
                  tone="secondary"
                  onClick={() => {
                    setViewHistorySelection({
                      requesterID: String(row.requesterID ?? ''),
                      snapshotName: getRequesterNameForHistoryTitle(row),
                    });
                  }}
                  title={REQUESTER.BUTTON.VIEW_HISTORY}
                  aria-label={REQUESTER.BUTTON.VIEW_HISTORY}
                  size="small"
                >
                  <SMSIcon name="history" size="sm" />
                </SMSIconButton>
                <SMSIconButton
                  className="level-1-requester__icon-btn"
                  tone="success"
                  onClick={() => handleCreateRequest(row)}
                  aria-label="Create Request"
                  size="small"
                  title={REQUESTER.BUTTON.CREATE_REQUEST}
                >
                  <SMSIcon name="add" size="sm" />
                </SMSIconButton>
                {!isRequesterManagerOnly && (
                  <SMSIconButton
                    className="level-1-requester__icon-btn"
                    tone="primary"
                    onClick={() => handleEdit(row)}
                    aria-label={REQUESTER.BUTTON.EDIT}
                    size="small"
                    title={REQUESTER.BUTTON.EDIT}
                  >
                    <SMSIcon name="edit" size="sm" />
                  </SMSIconButton>
                )}
                {!isRequesterManagerOnly && (
                  <SMSIconButton
                    className="level-1-requester__icon-btn"
                    tone="error"
                    onClick={() => handleDelete(row)}
                    aria-label="Delete"
                    size="small"
                    title={REQUESTER.BUTTON.DELETE}
                  >
                    <SMSIcon name="delete" size="sm" />
                  </SMSIconButton>
                )}
                <SMSIconButton
                  className="level-1-requester__icon-btn"
                  tone="secondary"
                  onClick={() => handleDepartmentQuestionnaire(row)}
                  aria-label="Department Questionnaire"
                  size="small"
                  title={REQUESTER.BUTTON.DEPARTMENT_QUESTIONNAIRE}
                >
                  <SMSIcon name="description" size="sm" />
                </SMSIconButton>
                <RequesterRowActionMenu
                  row={row}
                  hideRestrictAndInvoice={isRequesterManagerOnly}
                  returnPath={requesterListReturnPath}
                />
              </SMSBox>
            ),
          },
        ]
      : []),
  ], [hideRequesterMasterActions, isRequesterManagerOnly, handleCreateRequest, handleEdit, handleDelete, handleDepartmentQuestionnaire, requesterListReturnPath]);

  // Render content based on active tab
  const renderTabContent = () => {
    switch (activeTab) {
      case 'manage':
        return (
          <ManageRequester
            requesters={requesters}
            columns={columns}
            isLoading={isLoading}
            viewOnlyRequesters={hideRequesterMasterActions}
            canAddRequester={!isRequesterManagerOnly}
            onAdd={handleAdd}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            currentPage={currentPage}
            pageSize={pageSize}
            totalItems={totalItems}
            searchValue={manageSearchQuery}
            onSearchChange={setManageSearchQuery}
          />
        );

      case 'close-unclosed':
        return <ClosedUnclosedAssignments />;

      case 'daily':
        return (
          <DailyAdministration
            viewOnlyRequesters={viewOnlyRequesters}
            dailySearchRequester={dailySearchRequester}
            setDailySearchRequester={setDailySearchRequester}
            dailyStartDate={dailyStartDate}
            setDailyStartDate={setDailyStartDate}
            dailyEndDate={dailyEndDate}
            setDailyEndDate={setDailyEndDate}
            resetDailyDates={resetDailyDates}
            dailyRequestStatuses={dailyRequestStatuses}
            setDailyRequestStatuses={setDailyRequestStatuses}
            dailyRequestTypes={dailyRequestTypes}
            setDailyRequestTypes={setDailyRequestTypes}
            dailyLoading={dailyLoading}
            dailyLoadingMore={dailyLoadingMore}
            dailyHasMore={dailyHasMore}
            dailyTotalRequesters={dailyTotalRequesters}
            onLoadMoreRequesters={loadMoreDailyRequesters}
            groupedByRequester={groupedByRequester}
            expandedRequesters={expandedRequesters}
            toggleRequesterExpand={toggleRequesterExpand}
            postsByRequest={postsByRequest}
            expandedRequests={expandedRequests}
            toggleRequestExpand={toggleRequestExpand}
            getPostsPagination={getPostsPagination}
            setPostsPagination={setPostsPagination}
            loadPostsAndPositionsForRequest={loadPostsAndPositionsForRequest}
            pageSizeMenuAnchor={pageSizeMenuAnchor}
            setPageSizeMenuAnchor={setPageSizeMenuAnchor}
            expandedPosts={expandedPosts}
            togglePostExpand={togglePostExpand}
            loadPostEmployeesAndExpand={loadPostEmployeesAndExpand}
            postCollectDatesByPost={postCollectDatesByPost}
            loadingPostCollectDatesByPost={loadingPostCollectDatesByPost}
            ensurePostCollectDates={(postId) => {
              if (loadingPostCollectDatesByPost[postId] === true) return;
              const existing = postCollectDatesByPost[postId];
              // `[]` is a stale empty cache — re-run expand so dates can be derived from rows.
              if (existing === undefined) {
                void loadPostEmployeesAndExpand(postId);
                return;
              }
              if (existing.length === 0) {
                void loadPostEmployeesAndExpand(postId);
              }
            }}
            expandedPostDays={expandedPostDays}
            selectPostFilterDates={selectPostFilterDates}
            togglePostFilterDate={togglePostFilterDate}
            refreshPostPositions={refreshPostPositions}
            postPositionsByPostAndDate={postPositionsByPostAndDate}
            filledPositionsByPostAndDate={filledPositionsByPostAndDate}
            loadingPostPositionsByPost={loadingPostPositionsByPost}
            setDeletingPost={setDeletingPost}
            setDeletingRequest={setDeletingRequest}
            setDeletingItem={setDeletingItem}
            handleCollapseAll={handleCollapseAll}
            requesterListReturnPath={requesterListReturnPath}
            activeTab={activeTab}
            handleViewProfile={handleViewProfile}
            handleEdit={handleEdit}
            handleCreateRequest={handleCreateRequest}
            handleRequesterInvoice={handleRequesterInvoice}
            onRequesterPayment={handleNavigateToRequesterPayment}
            handleCloneRequest={handleCloneRequest}
            handleEditRequest={handleEditRequest}
            handleCreatePost={handleCreatePost}
            handleEditPost={handleEditPost}
            handleClonePost={handleClonePost}
            setInvoicePreviewRequest={setInvoicePreviewRequest}
            setInvoicePreviewOpen={setInvoicePreviewOpen}
            onScheduleClick={handleDailyScheduleClick}
            onProjectNumberClick={handleDailyProjectNumberClick}
            onCreateRequestInvoice={handleCreateRequestInvoice}
            navigate={navigate}
            getPostIndentByLevel={getPostIndentByLevel}
            renderRequestActionMenu={(request) => (
              <RequestActionMenu
                request={request}
                onCreatePost={handleCreatePost}
                onViewHistory={(req) => {
                  setRequestHistorySelection({
                    requestID: String(req.requestID ?? ''),
                    snapshotName: req.title?.trim() || String(req.requestID ?? ''),
                  });
                }}
                onViewRoster={(req) => {
                  setRosterPostId('');
                  const requesterId = String(req.requesterID ?? '').trim();
                  const requestId = String(req.requestID ?? '').trim();
                  const start = String(req.startDate ?? '').trim().slice(0, 10);
                  setRosterDateOfWork(start);
                  const qs = start ? `?${ROSTER_URL_DATE_QUERY}=${encodeURIComponent(start)}` : '';
                  navigate(`/personnel/requester/${activeTab}/${requesterId}/request/${requestId}/roster${qs}`);
                }}
                onOpenUploadModal={(request) => { setUploadModalRequest(request); setUploadModalOpen(true); }}
                onSendNotification={(req) =>
                  openSendEmail({
                    requestId: req.requestID,
                    attachRequestId: req.requestID,
                    requesterId: req.requesterID,
                  })
                }
                onNotificationHistory={(req) =>
                  setNotificationHistoryContext({
                    requestId: req.requestID,
                    requesterId: req.requesterID,
                    title: req.title?.trim() || String(req.requestID ?? ''),
                  })
                }
                returnPath={requesterListReturnPath}
                activeTab={activeTab}
                enableAttachFilesToRequests={departmentConfig?.enableAttachFilesToRequests ?? false}
              />
            )}
            renderPostActionMenu={(post, request) => (
              <PostActionMenu
                post={post}
                request={request}
                returnPath={requesterListReturnPath}
                activeTab={activeTab}
                onViewHistory={(p) => {
                  setPostHistorySelection({
                    postID: String(p.postId ?? ''),
                    snapshotName: p.postTitle?.trim() || String(p.postId ?? ''),
                  });
                }}
                onAssignSuccess={async (assignedDate) => {
                  if (!post.postId) return;
                  const selected = getSelectedDatesForPost(expandedPostDays, post.postId);
                  selectPostFilterDates(
                    post.postId,
                    mergeYmdIntoSortedDates(selected, assignedDate)
                  );
                  if (request.requestID) await loadPostsAndPositionsForRequest(request.requestID);
                }}
                onSendNotification={({ postId, attachRequestId, requesterId }) =>
                  openSendEmail({ postId, attachRequestId, requesterId })
                }
                onNotificationHistory={({ postId, requestId, requesterId, title }) =>
                  setNotificationHistoryContext({ postId, requestId, requesterId, title })
                }
              />
            )}
            renderPostEmployeesSlider={(postId, post, request, selectedDates, positions, totalRecords, onPositionUnassigned, sliderKey, isLoading) => (
              <PostEmployeesSlider
                key={sliderKey}
                postId={postId}
                post={post}
                request={request}
                dateOfWork={selectedDates[0]}
                canTransferPost={canTransferPost}
                positions={positions}
                totalRecords={totalRecords}
                viewHistory={viewHistoryByPostId[postId] ?? false}
                onToggleViewHistory={() => handleTogglePostViewHistory(postId, selectedDates)}
                isLoading={Boolean(isLoading)}
                onPositionUnassigned={onPositionUnassigned}
                onSendNotification={({ postPositionId, attachRequestId, requesterId }) =>
                  openSendEmail({ postPositionId, attachRequestId, requesterId })
                }
                onNotificationHistory={({ postPositionId, requestId, requesterId, title }) =>
                  setNotificationHistoryContext({ postPositionId, requestId, requesterId, title })
                }
              />
            )}
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      {portalTarget &&
        ReactDOM.createPortal(
          <SMSBox className="header-tabs-portal">
            <SMSTabs
              options={tabItems}
              value={activeTab}
              onChange={handleTabChange}
              distribution="content"
              fontSize="1rem"
            />
          </SMSBox>,
          portalTarget
        )}
    <SMSBox className={`requester-list ${className}`}>
      {/* Main Content Area */}
      <SMSBox className="requester-list__tab-content">
        {renderTabContent()}
      </SMSBox>

      {cloneProcessingMessage && (
        <SMSBox className="requester-list__clone-overlay" role="status" aria-live="polite">
          <SMSBox className="requester-list__clone-overlay-card">
            <SMSLoadingState message={cloneProcessingMessage} />
          </SMSBox>
        </SMSBox>
      )}

      {/* Delete Confirmation */}
      <SMSConfirmDialog
        open={!!deletingItem || !!deletingRequest || !!deletingPost}
        title={
          deletingPost
            ? POST_POSITION.MESSAGES.DELETE_POST_TITLE
            : deletingRequest
              ? REQUEST_FORM.CONFIRM.DELETE_REQUEST_TITLE
              : REQUESTER.CONFIRM.DELETE_REQUESTER_TITLE
        }
        message={
          deletingPost
            ? POST_POSITION.MESSAGES.DELETE_POST_MESSAGE.replace('{title}', deletingPost.postTitle)
            : deletingRequest
              ? REQUEST_FORM.CONFIRM.DELETE_REQUEST_MESSAGE.replace('{title}', deletingRequest.title)
              : REQUESTER.CONFIRM.DELETE_REQUESTER_MESSAGE.replace('{name}', deletingItem?.name ?? '')
        }
        confirmText={REQUESTER_GRID_MENU.DELETE_CONFIRM}
        cancelText={REQUESTER_GRID_MENU.DELETE_CANCEL}
        onConfirm={handleConfirmDelete}
        onClose={handleCloseDeleteDialog}
        variant="error"
      />

      <SMSAuditHistoryModal
        open={viewHistoryModalOpen}
        onClose={() => {
          setViewHistorySelection(null);
          setViewHistoryAuditStartDate('');
          setViewHistoryAuditEndDate('');
          setViewHistoryAuditPage(1);
          setViewHistoryAuditPageSize(10);
          setViewHistoryAuditTotalItems(0);
        }}
        title={viewHistoryModalTitle}
        rows={viewHistoryAuditTableData}
        loading={viewHistoryAuditLoading}
        emptyMessage={REQUESTER.TABLE.NO_DATA}
        startDate={viewHistoryAuditStartDate}
        endDate={viewHistoryAuditEndDate}
        onStartDateChange={setViewHistoryAuditStartDate}
        onEndDateChange={setViewHistoryAuditEndDate}
        onApplyFilter={() => {
          const start = viewHistoryAuditStartDate.trim();
          const end = viewHistoryAuditEndDate.trim();
          if (start && end && start > end) {
            dispatch(showToast(REQUESTER.AUDIT.DATE_RANGE_INVALID, 'error'));
            return;
          }
          setViewHistoryAuditPage(1);
          fetchRequesterHistory();
        }}
        pagination={viewHistoryAuditPagination}
      />

      <SMSAuditHistoryModal
        open={requestHistoryModalOpen}
        onClose={() => {
          setRequestHistorySelection(null);
          setRequestHistoryStartDate('');
          setRequestHistoryEndDate('');
          setRequestHistoryPage(1);
          setRequestHistoryPageSize(10);
          setRequestHistoryTotalItems(0);
        }}
        title={requestHistoryModalTitle}
        rows={requestHistoryRows}
        loading={requestHistoryLoading}
        emptyMessage={REQUESTER.TABLE.NO_DATA}
        startDate={requestHistoryStartDate}
        endDate={requestHistoryEndDate}
        onStartDateChange={setRequestHistoryStartDate}
        onEndDateChange={setRequestHistoryEndDate}
        onApplyFilter={() => {
          const start = requestHistoryStartDate.trim();
          const end = requestHistoryEndDate.trim();
          if (start && end && start > end) {
            dispatch(showToast(REQUESTER.AUDIT.DATE_RANGE_INVALID, 'error'));
            return;
          }
          setRequestHistoryPage(1);
          fetchRequestHistory();
        }}
        pagination={requestHistoryPagination}
      />

      <SMSAuditHistoryModal
        open={postHistoryModalOpen}
        onClose={() => {
          setPostHistorySelection(null);
          setPostHistoryStartDate('');
          setPostHistoryEndDate('');
          setPostHistoryPage(1);
          setPostHistoryPageSize(10);
          setPostHistoryTotalItems(0);
        }}
        title={postHistoryModalTitle}
        rows={postHistoryRows}
        loading={postHistoryLoading}
        emptyMessage={REQUESTER.TABLE.NO_DATA}
        startDate={postHistoryStartDate}
        endDate={postHistoryEndDate}
        onStartDateChange={setPostHistoryStartDate}
        onEndDateChange={setPostHistoryEndDate}
        onApplyFilter={() => {
          const start = postHistoryStartDate.trim();
          const end = postHistoryEndDate.trim();
          if (start && end && start > end) {
            dispatch(showToast(REQUESTER.AUDIT.DATE_RANGE_INVALID, 'error'));
            return;
          }
          setPostHistoryPage(1);
          fetchPostHistory();
        }}
        pagination={postHistoryPagination}
      />

      {/* Department Questionnaire Modal */}
      <SMSModal
        open={departmentQuestionnaireModalOpen}
        onClose={() => setDepartmentQuestionnaireModalOpen(false)}
        title="Department Questionnaire"
        size="small"
      >
        <SMSStack spacing={2}>
          <SMSBox>
            {(departmentQuestionnaireLoading || isLoadingQuestionnaires) ? (
              <SMSBox sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <SMSLoader loadingText="Loading questionnaires..." aria-label="Loading questionnaires..." />
              </SMSBox>
            ) : questionnaires.length > 0 ? (
              <SMSStack spacing={1.5}>
                {questionnaires.map((questionnaire: QuestionnaireResponse) => (
                  <SMSCheckbox
                    key={questionnaire.questionnaireId}
                    label={questionnaire.title}
                    checked={selectedQuestionnaires.includes(questionnaire.questionnaireId)}
                    onChange={() => {
                      if (selectedQuestionnaires.includes(questionnaire.questionnaireId)) {
                        setSelectedQuestionnaires((prev: string[]) => prev.filter((id: string) => id !== questionnaire.questionnaireId));
                      } else {
                        setSelectedQuestionnaires((prev: string[]) => [...prev, questionnaire.questionnaireId]);
                      }
                    }}
                  />
                ))}
              </SMSStack>
            ) : (
              <SMSTypography variant="body1">No questionnaires available.</SMSTypography>
            )}
          </SMSBox>

          <SMSStack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 2 }}>
            <SMSButton
              variant="outlined"
              onClick={() => setDepartmentQuestionnaireModalOpen(false)}
            >
              Cancel
            </SMSButton>
            <SMSButton
              onClick={handleSaveQuestionnaire}
              disabled={isSavingQuestionnaires}
            >
              {isSavingQuestionnaires ? 'Saving...' : 'Save'}
            </SMSButton>
          </SMSStack>
        </SMSStack>
      </SMSModal>

      {/* Invoice Preview Modal (from requester daily: show Generate Invoice button) */}
      <RequestScheduleListModal
        isOpen={Boolean(scheduleModalRequest)}
        request={scheduleModalRequest}
        viewOnly={viewOnlyRequesters}
        onClose={() => setScheduleModalRequest(null)}
      />

      <InvoicePreviewModal
        isOpen={invoicePreviewOpen}
        request={invoicePreviewRequest ?? undefined}
        requestOptions={invoicePreviewRequestOptions}
        paymentReturnPath={requesterListReturnPath}
        onClose={() => {
          setInvoicePreviewOpen(false);
          setInvoicePreviewRequest(null);
          setInvoicePreviewRequestOptions([]);
        }}
        onGenerateInvoice={() => {
          setInvoicePreviewOpen(false);
          setInvoicePreviewRequest(null);
          setInvoicePreviewRequestOptions([]);
        }}
      />

      <SMSRosterModal
        key={rosterModalFromRoute ? `route-roster-${effectiveRosterRequestId}` : 'roster-modal'}
        isOpen={rosterModalFromRoute}
        onClose={() => {
          const workspaceReturnPath = (
            location.state as { returnPath?: string } | null
          )?.returnPath?.trim();
          if (workspaceReturnPath && isDailyWorkspacePath(workspaceReturnPath)) {
            navigate(workspaceReturnPath, { replace: true });
          } else {
            navigate(`/personnel/requester/${resolvedTab}`, { replace: true });
          }
          setRosterPostId('');
          setRosterDateOfWork('');
        }}
        postId={rosterPostId}
        requestID={effectiveRosterRequestId}
        dateOfWork={rosterModalDateProp}
        onDateOfWorkChange={rosterModalFromRoute ? syncRosterDateToUrl : undefined}
        onCallSignUpdated={handleRosterCallSignUpdated}
      />

      <UploadFileModal
        isOpen={uploadModalOpen}
        onClose={handleUploadModalClose}
        onUpload={(files) => uploadModalRequest && handleFileUpload(uploadModalRequest, files)}
        existingFiles={uploadModalExistingFiles}
        requestID={uploadModalRequest?.requestID ?? undefined}
        requesterID={uploadModalRequest?.requesterID ?? undefined}
        onDeletedFile={
          uploadModalRequest?.requestID && uploadModalRequest?.requesterID
            ? () =>
                getFilesOrFile(uploadModalRequest.requesterID, uploadModalRequest.requestID)
                  .then(setUploadModalExistingFiles)
                  .catch(() => setUploadModalExistingFiles([]))
            : undefined
        }
      />

      <SendEmailModal
        isOpen={!!sendEmailContext}
        onClose={closeSendEmail}
        context={sendEmailContext}
      />

      <NotificationHistoryModal
        isOpen={notificationHistoryContext != null}
        onClose={() => setNotificationHistoryContext(null)}
        requestId={notificationHistoryContext?.requestId}
        postId={notificationHistoryContext?.postId}
        postPositionId={notificationHistoryContext?.postPositionId}
        requesterId={notificationHistoryContext?.requesterId}
        title={notificationHistoryContext?.title}
      />

    </SMSBox>
    </>
  );
};

