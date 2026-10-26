import React from 'react';
import type { DataTableColumn } from '@/components/smsorganisms';
import { SMSDataTableWrapper, SMSModal, SMSPostInformationModal } from '@/components/smsorganisms';
import {
  SMSBox,
  SMSButton,
  SMSIcon,
  SMSIconButton,
  SMSStackRow,
  SMSTypography,
} from '@/components/smsatoms';
import {
  SMSCloseForm,
  SMSConfirmDialog,
  SMSEmployeeAssignmentFilters,
  ClosePostRefundDialogs,
} from '@/components/smsmolecules';
import type { ClosePostRefundFlowState } from '@/components/smsmolecules/ClosePostRefundDialogs';
import { SMSViewDetailsEquipmentSection } from '@/components/smsmolecules/SMSViewDetailsEquipmentSection/SMSViewDetailsEquipmentSection';
import { coalescePostPositionId } from '@/components/smsmolecules/SMSCloseForm/closeFormRowUtils';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchEmployeeOptionsThunk } from '@/store/slices/employeeSlice';
import { fetchRequesterOptionsThunk } from '@/store/slices/requesterSlice';
import { showToast } from '@/store/slices/toastSlice';
import { fetchAvailablePostDetails } from '@/store/slices/availablePostSlice';
import { acceptSplitRequestThunk, declineSplitRequestThunk } from '@/store/slices/splitRequestSlice';
import {
  closePostPositionWithEquipmentThunk,
  splitPostPositionWithEquipmentThunk,
  parseSplitPostTimeConflictRejection,
} from '@/store/slices/postPositionSlice';
import { closeRefundFlowFromResult } from '@/utils/closePostRefundFlow';
import { getJobsReadyToClose } from '@/services/jobsReadyToCloseService';
import { downloadRequestFile } from '@/services/fileUploadService';
import type { EmployeePostListingItem } from '@/types/employeePostListingItem';
import type { Post } from '@/types/post';
import type { RequestResponse } from '@/types/request';
import type { RequesterResponse } from '@/types/requester';
import type { FileUploadDto } from '@/types/fileUpload';
import type { PostEquipmentDto } from '@/services/postEquipmentService';
import type { ViewDetailsLatestPostNoteMapped } from '@/utils/mapRequestViewDetails';
import {
  CloseFormSubmitDeferredError,
  type EquipmentDetail,
  type PostCloseFormData,
  type QuestionnaireSubmission,
  type VehicleDetail,
} from '@/types/postCloseForm';
import { AVAILABLE_POST, INVOICE_GRID, POST_GRID_COLUMNS, POST_POSITION } from '@/constants/strings';
import { PostPositionStatus } from '@/types/postPosition';
import { formatDateShort, formatLastNameCommaFirstName, getPostGridTimeColumns } from '@/utils';
import { getLocalTodayYyyyMmDd } from '@/utils/dateTimeUtils';
import { useDebounce } from '@/hooks/useDebounceSearch';
import { DEFAULT_TABLE_PAGE_SIZE, FILTERED_GRID_MAX_BODY_HEIGHT } from '@/constants/tablePagination';
import './UnclosedAssignments.css';

const DEFAULT_PAGE_SIZE = DEFAULT_TABLE_PAGE_SIZE;

const formatDateCell = (value?: string | null): string => {
  if (value == null || !String(value).trim()) return '-';
  return formatDateShort(String(value).trim()) || '-';
};

export interface UnclosedAssignmentsProps {
  showPlaceholders?: boolean;
  onShowPlaceholdersChange?: (checked: boolean) => void;
}

/** Department-admin view of ongoing assigned posts that are ready to close. */
export const UnclosedAssignments: React.FC<UnclosedAssignmentsProps> = ({
  showPlaceholders = false,
  onShowPlaceholdersChange,
}) => {
  const dispatch = useAppDispatch();

  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebounce(search, 500);

  // Applied date filters drive the request; draft state lives in the inputs
  // until the user clicks Apply Filter (mirrors Close Assignments UX).
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [draftStartDate, setDraftStartDate] = React.useState('');
  const [draftEndDate, setDraftEndDate] = React.useState('');

  const [employeeFilter, setEmployeeFilter] = React.useState('');
  const rawEmployeeOptions = useAppSelector((state) => state.employee.employeeOptions);
  const employeeOptions = React.useMemo(
    () => rawEmployeeOptions.map((opt) => ({ value: opt.id, label: opt.label })),
    [rawEmployeeOptions]
  );
  const [requesterFilter, setRequesterFilter] = React.useState('');
  const rawRequesterOptions = useAppSelector((state) => state.requester.requesterOptions);
  const requesterOptions = React.useMemo(
    () => rawRequesterOptions.map((opt) => ({ value: opt.id, label: opt.label })),
    [rawRequesterOptions]
  );

  const employeeNameById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const opt of employeeOptions) {
      const key = opt.value.trim().toLowerCase();
      if (!key) continue;
      map.set(key, opt.label);
    }
    return map;
  }, [employeeOptions]);

  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);

  const [rows, setRows] = React.useState<EmployeePostListingItem[]>([]);
  const [totalItems, setTotalItems] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  // Bumped by a successful Close Job / Split Job to force the list effect to re-run.
  const [reloadKey, setReloadKey] = React.useState(0);
  const reloadJobsList = React.useCallback(() => setReloadKey((k) => k + 1), []);

  /** Stable "today" cap for the date pickers (recomputed once per mount). */
  const today = React.useMemo(() => getLocalTodayYyyyMmDd(), []);

  // ─── View Details modal state ─────────────────────────────────────────────
  // Counter guards against stale fetches when the user opens a second row
  // before the first request resolves.
  const viewDetailsRequestIdRef = React.useRef(0);
  const [detailModalOpen, setDetailModalOpen] = React.useState(false);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [detailSelectedPost, setDetailSelectedPost] = React.useState<EmployeePostListingItem | null>(null);
  const [detailPostData, setDetailPostData] = React.useState<Post | null>(null);
  const [detailRequestData, setDetailRequestData] = React.useState<RequestResponse | null>(null);
  const [detailRequesterData, setDetailRequesterData] = React.useState<RequesterResponse | null>(null);
  const [detailRequestFiles, setDetailRequestFiles] = React.useState<FileUploadDto[]>([]);
  const [detailSpecialEventMessage, setDetailSpecialEventMessage] = React.useState<string | null>(null);
  const [detailLatestNote, setDetailLatestNote] = React.useState<ViewDetailsLatestPostNoteMapped | null>(null);
  const [detailEquipmentRaw, setDetailEquipmentRaw] = React.useState<PostEquipmentDto[]>([]);
  const [detailShowVehicle, setDetailShowVehicle] = React.useState(false);
  const [detailShowEquipment, setDetailShowEquipment] = React.useState(false);

  const handleCloseDetailModal = React.useCallback(() => {
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

  const handleViewDetails = React.useCallback(
    async (row: EmployeePostListingItem) => {
      const reqId = ++viewDetailsRequestIdRef.current;
      setDetailSelectedPost(row);
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
        const details = await dispatch(fetchAvailablePostDetails(row)).unwrap();
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
        // Backfill totals/availability into the selected row from the details payload.
        setDetailSelectedPost((prev) => {
          const base = prev ?? row;
          const next: EmployeePostListingItem = { ...base };
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

  const detailModalEquipmentExtra = React.useMemo(() => {
    if (!detailModalOpen || !detailSelectedPost) return null;
    if (detailEquipmentRaw.length === 0 && !detailShowVehicle && !detailShowEquipment) {
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
  }, [detailModalOpen, detailSelectedPost, detailEquipmentRaw, detailShowVehicle, detailShowEquipment]);

  /** Resolve a human-readable employee name from a row using the same fallback chain as the column. */
  const resolveRowEmployeeName = React.useCallback(
    (row: EmployeePostListingItem): string => {
      const fromApi = row.employeeName?.trim();
      if (fromApi) return fromApi;
      const employeeId = String(row.employeeID ?? '').trim().toLowerCase();
      if (employeeId) {
        const matched = employeeNameById.get(employeeId);
        if (matched) return matched;
      }
      const fromParts = formatLastNameCommaFirstName(row.firstName ?? '', row.lastName ?? '', ' ').trim();
      if (fromParts) return fromParts;
      if (row.badgeNumber?.trim()) return row.badgeNumber.trim();
      return '-';
    },
    [employeeNameById]
  );

  // ─── Close Job / Split Job modal state (mirrors PostPositionByStatusList) ─
  const [closeRow, setCloseRow] = React.useState<EmployeePostListingItem | null>(null);
  const closeRowRef = React.useRef<EmployeePostListingItem | null>(null);
  React.useEffect(() => {
    closeRowRef.current = closeRow;
  }, [closeRow]);

  const [closeFormMode, setCloseFormMode] = React.useState<'close' | 'split'>('close');
  /** Set synchronously when opening the modal so submit always matches Close vs Split (dashboard pattern). */
  const closeFormModeRef = React.useRef<'close' | 'split'>('close');

  /**
   * Assigned employee on this list row (API `employeeID`). Used by `SMSCloseForm` seed data and for
   * "Allow self split" — the split segment stays with the worker on the job, not the signed-in admin token.
   */
  const closeFormEmployeeId = React.useMemo(() => {
    if (!closeRow) return '';
    return String(closeRow.employeeID ?? '').trim();
  }, [closeRow]);
  const [splitTimeConflictOpen, setSplitTimeConflictOpen] = React.useState(false);
  const [splitTimeConflictMessage, setSplitTimeConflictMessage] = React.useState('');
  const pendingSplitSubmitRef = React.useRef<{
    data: PostCloseFormData;
    equipmentDetails: EquipmentDetail[];
    vehicleDetails: VehicleDetail[];
    questionnaireSubmissions?: QuestionnaireSubmission[];
  } | null>(null);
  const [closeRefundFlow, setCloseRefundFlow] = React.useState<ClosePostRefundFlowState | null>(null);
  const refundStrings = INVOICE_GRID.PAYMENT.REFUND_PAYMENT_ALLOCATION;

  const handleCloseClick = React.useCallback((row: EmployeePostListingItem) => {
    closeFormModeRef.current = 'close';
    setCloseFormMode('close');
    setCloseRow(row);
  }, []);

  const handleSplitClick = React.useCallback((row: EmployeePostListingItem) => {
    closeFormModeRef.current = 'split';
    setCloseFormMode('split');
    setCloseRow(row);
  }, []);

  const handleAcceptSplit = React.useCallback(
    async (postPositionId: string) => {
      if (!postPositionId) return;
      await dispatch(acceptSplitRequestThunk(postPositionId));
      reloadJobsList();
    },
    [dispatch, reloadJobsList]
  );

  const handleDeclineSplit = React.useCallback(
    async (postPositionId: string) => {
      if (!postPositionId) return;
      await dispatch(declineSplitRequestThunk(postPositionId));
      reloadJobsList();
    },
    [dispatch, reloadJobsList]
  );

  const handleCloseFormModal = React.useCallback(() => {
    setCloseRow(null);
    closeFormModeRef.current = 'close';
  }, []);

  const handleCloseFormSubmit = React.useCallback(
    async (
      data: PostCloseFormData,
      equipmentDetails?: EquipmentDetail[],
      vehicleDetails?: VehicleDetail[],
      questionnaireSubmissions?: QuestionnaireSubmission[]
    ) => {
      const row = closeRowRef.current;
      if (!row) {
        dispatch(showToast('No job row is active; close or reopen the form and try again.', 'error'));
        return;
      }

      const isSplit = closeFormModeRef.current === 'split';
      const successMsg = isSplit ? POST_POSITION.CLOSE_FORM.SUCCESS_SPLIT : POST_POSITION.CLOSE_FORM.SUCCESS_CLOSE;
      const errorMsg = isSplit ? POST_POSITION.CLOSE_FORM.ERROR_SPLIT : POST_POSITION.CLOSE_FORM.ERROR_CLOSE;

      const rawRow = row as unknown as Record<string, unknown>;
      const effectivePostPositionId =
        coalescePostPositionId(row, rawRow) || String(data.postPositionId ?? '').trim();
      if (!effectivePostPositionId) {
        dispatch(showToast('Job position ID is missing; cannot close or split this row.', 'error'));
        return;
      }

      const payloadData: PostCloseFormData = {
        ...data,
        postPositionId: effectivePostPositionId,
      };

      const closeArgs = {
        data: payloadData,
        equipmentDetails: equipmentDetails || [],
        vehicleDetails: vehicleDetails || [],
        questionnaireSubmissions: questionnaireSubmissions || [],
      };

      try {
        if (isSplit) {
          await dispatch(splitPostPositionWithEquipmentThunk(closeArgs)).unwrap();
        } else {
          const result = await dispatch(closePostPositionWithEquipmentThunk(closeArgs)).unwrap();
          if (!result.success) {
            const refundFlow = closeRefundFlowFromResult(result, closeArgs);
            if (refundFlow) {
              setCloseRow(null);
              setCloseRefundFlow(refundFlow);
              return;
            }
            dispatch(showToast(refundStrings.MISSING_INVOICE, 'error'));
            return;
          }
        }
        setCloseRow(null);
        dispatch(showToast(successMsg, 'success'));
        reloadJobsList();
      } catch (err: unknown) {
        const conflict = isSplit ? parseSplitPostTimeConflictRejection(err) : null;
        if (conflict) {
          // Defer the submit; user must confirm the time-overlap dialog before we retry.
          pendingSplitSubmitRef.current = {
            data: payloadData,
            equipmentDetails: equipmentDetails || [],
            vehicleDetails: vehicleDetails || [],
            questionnaireSubmissions,
          };
          setSplitTimeConflictMessage(
            conflict.message?.trim() || AVAILABLE_POST.DETAILS.CONFLICT.MESSAGE_DEFAULT
          );
          setSplitTimeConflictOpen(true);
          throw new CloseFormSubmitDeferredError();
        }
        const message =
          typeof err === 'string' ? err : err instanceof Error ? err.message : errorMsg;
        dispatch(showToast(message, 'error'));
        throw err;
      }
    },
    [dispatch, reloadJobsList]
  );

  const handleCancelSplitTimeConflict = React.useCallback(() => {
    setSplitTimeConflictOpen(false);
    pendingSplitSubmitRef.current = null;
  }, []);

  const handleConfirmSplitTimeConflict = React.useCallback(async () => {
    const pending = pendingSplitSubmitRef.current;
    const row = closeRowRef.current;
    if (!pending || !row) {
      setSplitTimeConflictOpen(false);
      return;
    }
    setSplitTimeConflictOpen(false);
    const rawRow = row as unknown as Record<string, unknown>;
    const effectivePostPositionId =
      coalescePostPositionId(row, rawRow) || String(pending.data.postPositionId ?? '').trim();
    try {
      await dispatch(
        splitPostPositionWithEquipmentThunk({
          ...pending,
          data: { ...pending.data, postPositionId: effectivePostPositionId },
          confirmConflict: true,
        })
      ).unwrap();
      pendingSplitSubmitRef.current = null;
      setCloseRow(null);
      dispatch(showToast(POST_POSITION.CLOSE_FORM.SUCCESS_SPLIT, 'success'));
      reloadJobsList();
    } catch (err) {
      const message =
        typeof err === 'string'
          ? err
          : err instanceof Error
            ? err.message
            : POST_POSITION.CLOSE_FORM.ERROR_SPLIT;
      dispatch(showToast(message, 'error'));
    }
  }, [dispatch, reloadJobsList]);

  const handleApplyDateFilters = React.useCallback(() => {
    setStartDate(draftStartDate);
    setEndDate(draftEndDate);
    setCurrentPage(1);
  }, [draftStartDate, draftEndDate]);

  /** Reset every filter to its initial empty state and re-fetch from page 1. */
  const handleClearFilters = React.useCallback(() => {
    setSearch('');
    onShowPlaceholdersChange?.(false);
    setEmployeeFilter('');
    setRequesterFilter('');
    setDraftStartDate('');
    setDraftEndDate('');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  }, [onShowPlaceholdersChange]);

  const hasActiveFilters =
    search !== '' ||
    showPlaceholders ||
    employeeFilter !== '' ||
    requesterFilter !== '' ||
    draftStartDate !== '' ||
    draftEndDate !== '' ||
    startDate !== '' ||
    endDate !== '';

  // Reset to page 1 whenever a filter that affects the result set changes.
  React.useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, employeeFilter, requesterFilter, startDate, endDate, showPlaceholders]);

  const handleEmployeeSearchInputChange = React.useCallback(
    (value: string) => dispatch(fetchEmployeeOptionsThunk({ searchTerm: value })).unwrap(),
    [dispatch]
  );

  React.useEffect(() => {
    dispatch(fetchRequesterOptionsThunk({}));
  }, [dispatch]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getJobsReadyToClose({
      page: currentPage,
      pageSize,
      ...(debouncedSearch.trim() ? { searchTerm: debouncedSearch.trim() } : {}),
      ...(employeeFilter ? { employeeId: employeeFilter } : {}),
      ...(requesterFilter ? { requesterId: requesterFilter } : {}),
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
      ...(showPlaceholders ? { isPlaceholder: true } : {}),
    })
      .then((res) => {
        if (cancelled) return;
        setRows(res.data ?? []);
        setTotalItems(typeof res.totalRecords === 'number' ? res.totalRecords : (res.data?.length ?? 0));
      })
      .catch((e) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : 'Failed to load jobs ready to close';
        setError(msg);
        setRows([]);
        setTotalItems(0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentPage, pageSize, debouncedSearch, employeeFilter, requesterFilter, startDate, endDate, showPlaceholders, reloadKey]);

  const columns = React.useMemo<DataTableColumn<EmployeePostListingItem>[]>(
    () => [
      {
        key: 'employeeName',
        label: 'Employee Name',
        render: (_v, row) => {
          const fromApi = row.employeeName?.trim();
          if (fromApi) return fromApi;
          const employeeId = String(row.employeeID ?? '').trim().toLowerCase();
          if (employeeId) {
            const matched = employeeNameById.get(employeeId);
            if (matched) return matched;
          }
          const fromParts = formatLastNameCommaFirstName(row.firstName ?? '', row.lastName ?? '', ' ').trim();
          if (fromParts) return fromParts;
          if (row.badgeNumber?.trim()) return row.badgeNumber.trim();
          return '-';
        },
      },
      {
        key: 'startDate',
        label: POST_GRID_COLUMNS.DATE,
        render: (_v, row) => formatDateCell(row.startDate),
      },
      ...getPostGridTimeColumns<EmployeePostListingItem>(),
      {
        key: 'requesterTitle',
        label: POST_GRID_COLUMNS.REQUESTER,
        render: (_v, row) => row.requesterTitle?.trim() || '-',
      },
      {
        key: 'postTitle',
        label: POST_GRID_COLUMNS.TITLE,
        render: (value) => String(value || '-'),
      },
      {
        key: 'action',
        label: POST_POSITION.BY_STATUS_LIST.COLUMNS.ACTION,
        align: 'left',
        render: (_v, row) => {
          const status = Number(
            row.postPositionStatus ??
              (row as unknown as { PostPositionStatus?: number }).PostPositionStatus ??
              NaN
          );
          const isSplitPending = status === PostPositionStatus.SplitDecisionPending;
          const showSplit = row.isPlaceholder !== true && !showPlaceholders;

          const viewButton = (
            <SMSIconButton
              type="button"
              size="small"
              tone="primary"
              variant="outlined"
              allowWhenSuspended
              aria-label={POST_POSITION.BY_STATUS_LIST.BUTTONS.VIEW_DETAILS}
              title={POST_POSITION.BY_STATUS_LIST.BUTTONS.VIEW_DETAILS}
              onClick={() => void handleViewDetails(row)}
            >
              <SMSIcon name="eye" size="sm" />
            </SMSIconButton>
          );

          const closeButton = (
            <SMSButton
              size="small"
              allowWhenSuspended
              aria-label={POST_POSITION.BY_STATUS_LIST.BUTTONS.CLOSE_POST}
              title={POST_POSITION.BY_STATUS_LIST.BUTTONS.CLOSE_POST}
              onClick={() => handleCloseClick(row)}
            >
              {POST_POSITION.BY_STATUS_LIST.BUTTONS.CLOSE_POST}
            </SMSButton>
          );

          const splitButton = showSplit ? (
            <SMSButton
              size="small"
              allowWhenSuspended
              aria-label={POST_POSITION.BY_STATUS_LIST.BUTTONS.SPLIT}
              title={POST_POSITION.BY_STATUS_LIST.BUTTONS.SPLIT}
              onClick={() => handleSplitClick(row)}
            >
              {POST_POSITION.BY_STATUS_LIST.BUTTONS.SPLIT}
            </SMSButton>
          ) : null;

          const postPositionId = String(row.postPositionId ?? '').trim();
          const acceptDeclineButtons = (
            <>
              <SMSIconButton
                type="button"
                size="small"
                allowWhenSuspended
                aria-label={POST_POSITION.BY_STATUS_LIST.BUTTONS.ACCEPT}
                title={POST_POSITION.BY_STATUS_LIST.BUTTONS.ACCEPT}
                onClick={() => void handleAcceptSplit(postPositionId)}
              >
                <SMSIcon name="check" size="sm" />
              </SMSIconButton>
              <SMSIconButton
                type="button"
                size="small"
                tone="success"
                allowWhenSuspended
                aria-label="Decline"
                title="Decline"
                onClick={() => void handleDeclineSplit(postPositionId)}
              >
                <SMSIcon name="close" size="sm" />
              </SMSIconButton>
            </>
          );

          return (
            <SMSStackRow gap="xs" className="jobs-ready-to-close__actions">
              {viewButton}
              {isSplitPending ? acceptDeclineButtons : <>{closeButton}{splitButton}</>}
            </SMSStackRow>
          );
        },
      },
    ],
    [employeeNameById, showPlaceholders, handleViewDetails, handleCloseClick, handleSplitClick, handleAcceptSplit,handleDeclineSplit
    ]
  );

  return (
    <SMSBox className="requester-list__content jobs-ready-to-close">
      <SMSEmployeeAssignmentFilters
        idPrefix="jobs-ready-to-close"
        className="jobs-ready-to-close__filters"
        search={search}
        onSearchChange={setSearch}
        employee={employeeFilter}
        onEmployeeChange={setEmployeeFilter}
        employeeOptions={employeeOptions}
        requester={requesterFilter}
        onRequesterChange={setRequesterFilter}
        requesterOptions={requesterOptions}
        employeeServerSideSearch
        onEmployeeSearchInputChange={handleEmployeeSearchInputChange}
        startDate={draftStartDate}
        onStartDateChange={setDraftStartDate}
        startMaxDate={today}
        endDate={draftEndDate}
        onEndDateChange={setDraftEndDate}
        endMaxDate={today}
        onApply={handleApplyDateFilters}
        onClear={handleClearFilters}
        clearDisabled={!hasActiveFilters}
      />

      {error ? <SMSTypography className="jobs-ready-to-close__error">{error}</SMSTypography> : null}

      <SMSDataTableWrapper<EmployeePostListingItem>
        columns={columns}
        data={rows}
        loading={loading}
        emptyMessage="No jobs ready to close."
        tableClassName="requester-list__table jobs-ready-to-close__table"
        maxBodyHeight={FILTERED_GRID_MAX_BODY_HEIGHT}
        pagination={{
          currentPage,
          pageSize,
          totalItems,
          serverSide: true,
          onPageChange: setCurrentPage,
          onPageSizeChange: (newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          },
        }}
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

      {closeRow && (
        <SMSModal
          isOpen
          onClose={handleCloseFormModal}
          title={
            closeFormMode === 'split'
              ? POST_POSITION.CLOSE_FORM.SPLIT_TITLE
              : POST_POSITION.CLOSE_FORM.TITLE
          }
          size="xl"
          className="modal--scrollable-content"
        >
          <SMSCloseForm
            postPosition={closeRow}
            employeeName={resolveRowEmployeeName(closeRow)}
            employeeID={closeFormEmployeeId}
            isSplitMode={closeFormMode === 'split'}
            onSubmit={handleCloseFormSubmit}
            onCancel={handleCloseFormModal}
            allowWhenSuspended
          />
        </SMSModal>
      )}

      <SMSConfirmDialog
        open={splitTimeConflictOpen}
        onClose={handleCancelSplitTimeConflict}
        title={AVAILABLE_POST.DETAILS.CONFLICT.TITLE}
        message={splitTimeConflictMessage}
        confirmText={AVAILABLE_POST.DETAILS.CONFLICT.CONFIRM}
        cancelText={AVAILABLE_POST.DETAILS.CONFLICT.CANCEL}
        onConfirm={() => void handleConfirmSplitTimeConflict()}
        variant="warning"
        confirmButtonColor="primary"
      />

      <ClosePostRefundDialogs
        flow={closeRefundFlow}
        onClose={() => setCloseRefundFlow(null)}
        onAfterRefund={async (pendingClose) => {
          try {
            const result = await dispatch(closePostPositionWithEquipmentThunk(pendingClose)).unwrap();
            if (!result.success) {
              const refundFlow = closeRefundFlowFromResult(result, pendingClose);
              if (refundFlow) {
                setCloseRefundFlow(refundFlow);
                return;
              }
              dispatch(showToast(refundStrings.MISSING_INVOICE, 'error'));
              return;
            }
            setCloseRefundFlow(null);
            dispatch(showToast(POST_POSITION.CLOSE_FORM.SUCCESS_CLOSE, 'success'));
            reloadJobsList();
          } catch {
            // Error toast handled in thunk
          }
        }}
      />
    </SMSBox>
  );
};

export default UnclosedAssignments;
