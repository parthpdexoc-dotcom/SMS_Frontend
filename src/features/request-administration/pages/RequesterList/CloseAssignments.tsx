import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { DataTableColumn } from '@/components/smsorganisms';
import { SMSDataTableWrapper, SMSPostInformationModal } from '@/components/smsorganisms';
import {
  SMSBox,
  SMSButton,
  SMSIcon,
  SMSIconButton,
  SMSStack,
  SMSTypography,
} from '@/components/smsatoms';
import { SMSModal } from '@/components/smsorganisms';
import { SMSCloseForm, UnclosePostRefundDialogs } from '@/components/smsmolecules';
import type { UnclosePostRefundFlowState } from '@/components/smsmolecules';
import { uncloseRefundFlowFromResult } from '@/utils/closePostRefundFlow';
import { SMSEmployeeAssignmentFilters } from '@/components/smsmolecules';
import { SMSViewDetailsEquipmentSection } from '@/components/smsmolecules/SMSViewDetailsEquipmentSection/SMSViewDetailsEquipmentSection';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { closePostPositionWithEquipmentThunk, fetchMyCloseAssignmentsThunk, unclosePostPositionThunk } from '@/store/slices/postPositionSlice';
import { navigateToInvoiceModifyConflict } from '@/utils/invoiceModifyConflict';
import type { InvoiceConflictEditPayload, PendingCloseJobAction } from '@/utils/invoiceModifyConflict';
import { fetchAvailablePostDetails } from '@/store/slices/availablePostSlice';
import { fetchEmployeeOptionsThunk } from '@/store/slices/employeeSlice';
import { fetchRequesterOptionsThunk } from '@/store/slices/requesterSlice';
import { showToast } from '@/store/slices/toastSlice';
import { getClosedPostPositionDetails, type ClosedPostPositionDetailsResponse } from '@/services/closedPostPositionEquipmentService';
import { downloadRequestFile } from '@/services/fileUploadService';
import type { EmployeePostListingItem } from '@/types/employeePostListingItem';
import type {
  EquipmentDetail,
  PostCloseFormData,
  QuestionnaireSubmission,
  VehicleDetail,
} from '@/types/postCloseForm';
import type { Post } from '@/types/post';
import type { RequestResponse } from '@/types/request';
import type { RequesterResponse } from '@/types/requester';
import type { FileUploadDto } from '@/types/fileUpload';
import type { PostEquipmentDto } from '@/services/postEquipmentService';
import type { ViewDetailsLatestPostNoteMapped } from '@/utils/mapRequestViewDetails';
import { AVAILABLE_POST, INVOICE_GRID, POST_GRID_COLUMNS, POST_POSITION } from '@/constants/strings';
import { formatDateShort, formatLastNameCommaFirstName, getPostGridTimeColumns } from '@/utils';
import { hasRole, UserRoleType } from '@/types/userRole';
import { useDebounce } from '@/hooks/useDebounceSearch';
import { DEFAULT_TABLE_PAGE_SIZE, FILTERED_GRID_MAX_BODY_HEIGHT } from '@/constants/tablePagination';
import './CloseAssignments.css';

const DEFAULT_PAGE_SIZE = DEFAULT_TABLE_PAGE_SIZE;

const getTypeLabel = (status?: number): string => {
  switch (status) {
    case 1:
      return 'Assigned';
    case 2:
      return 'Closed';
    case 11:
      return 'Unclosed';
    case 4:
      return 'Closed And Split';
    case 3:
      return 'Cancelled';
    default:
      return '-';
  }
};

const isUncloseDisabledByApi = (row: EmployeePostListingItem): boolean => {
  if (row.wasUnclosed === true || row.isUncloseDisabled === true) return true;
  const raw = row as unknown as Record<string, unknown>;
  const flag =
    (raw.wasUnclosed as boolean | undefined) ??
    (raw.WasUnclosed as boolean | undefined) ??
    (raw.wasunclosed as boolean | undefined) ??
    (raw.isUncloseDisabled as boolean | undefined) ??
    (raw.IsUncloseDisabled as boolean | undefined) ??
    (raw.disableUnclose as boolean | undefined) ??
    (raw.DisableUnclose as boolean | undefined);
  return flag === true;
};

const formatCloseAssignmentTableDate = (value?: string | null): string => {
  if (value == null || !String(value).trim()) return '-';
  return formatDateShort(String(value).trim()) || '-';
};

const resolveExistingClosedPostPositionId = (row: EmployeePostListingItem | null | undefined): string | null => {
  if (!row) return null;
  const raw = row as unknown as Record<string, unknown>;
  const value =
    row.closedPostPositionID ??
    (raw.closedPostPositionId as string | undefined) ??
    (raw.closedPostPositionID as string | undefined) ??
    (raw.ClosedPostPositionID as string | undefined) ??
    row.postPositionId ??
    (raw.postPositionID as string | undefined) ??
    (raw.PostPositionID as string | undefined);
  if (!value) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
};

const resolveClosedPostPositionIdFromDetails = (
  details: ClosedPostPositionDetailsResponse | null | undefined
): string | null => {
  if (!details) return null;
  const cp = (details as any)?.closedPostPosition ?? (details as any)?.ClosedPostPosition ?? null;
  if (!cp || typeof cp !== 'object') return null;
  const value =
    cp.closedPostPositionID ??
    cp.closedPostPositionId ??
    cp.ClosedPostPositionID ??
    cp.ClosedPostPositionId ??
    null;
  if (!value) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
};

const resolvePostPositionIdFromDetails = (
  details: ClosedPostPositionDetailsResponse | null | undefined
): string | null => {
  if (!details) return null;
  const cp = (details as any)?.closedPostPosition ?? (details as any)?.ClosedPostPosition ?? null;
  if (!cp || typeof cp !== 'object') return null;
  const value =
    cp.postPositionID ??
    cp.postPositionId ??
    cp.PostPositionID ??
    cp.PostPositionId ??
    cp.parentPostPositionId ??
    cp.ParentPostPositionID ??
    null;
  if (!value) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
};

export interface CloseAssignmentsProps {
  showPlaceholders?: boolean;
  onShowPlaceholdersChange?: (checked: boolean) => void;
}

export const CloseAssignments: React.FC<CloseAssignmentsProps> = ({
  showPlaceholders = false,
  onShowPlaceholdersChange,
}) => {
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebounce(search, 500);
  // Applied date filters (used for fetch/filtering logic)
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  // Draft date values in inputs (only applied when user clicks Apply Filter)
  const [draftStartDate, setDraftStartDate] = React.useState('');
  const [draftEndDate, setDraftEndDate] = React.useState('');
  // Holds selected employeeID from dropdown ('' = no employee filter)
  const [employeeNameFilter, setEmployeeNameFilter] = React.useState('');
  const [requesterFilter, setRequesterFilter] = React.useState('');
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);
  const rawEmployeeOptions = useAppSelector((state) => state.employee.employeeOptions);
  const employeeOptions = React.useMemo(
    () => rawEmployeeOptions.map((opt) => ({ value: opt.id, label: opt.label })),
    [rawEmployeeOptions]
  );
  const rawRequesterOptions = useAppSelector((state) => state.requester.requesterOptions);
  const requesterOptions = React.useMemo(
    () => rawRequesterOptions.map((opt) => ({ value: opt.id, label: opt.label })),
    [rawRequesterOptions]
  );
  const employeeNameById = React.useMemo(() => {
    const map = new Map<string, string>();
    employeeOptions.forEach((option) => {
      const key = option.value.trim();
      if (!key) return;
      map.set(key.toLowerCase(), option.label);
    });
    return map;
  }, [employeeOptions]);

  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const departmentConfig = useAppSelector((state) =>
    user?.departmentID ? state.departmentConfiguration.configByDepartmentId[user.departmentID] ?? null : null
  );
  const isDepartmentAdministratorRole = Boolean(
    user?.isSuperUser === true ||
      hasRole(user?.roles, UserRoleType.SuperUser) ||
      hasRole(user?.roles, UserRoleType.Admin) ||
      hasRole(user?.roles, UserRoleType.DepartmentAdmin)
  );
  const allowAdminEditClosedAssignments =
    departmentConfig?.enableDepartmentEditEmployeesClosedAssignments === true;
  const canDepartmentAdminEditClosedAssignments =
    !isDepartmentAdministratorRole || allowAdminEditClosedAssignments;
  const attributeCloseSaveToAdministrator =
    isDepartmentAdministratorRole && allowAdminEditClosedAssignments;
  const rows = useAppSelector((state) => state.postPosition.closeAssignments);
  const loading = useAppSelector((state) => state.postPosition.closeAssignmentsLoading);
  const error = useAppSelector((state) => state.postPosition.closeAssignmentsError) ?? '';
  const totalItems = useAppSelector((state) => state.postPosition.closeAssignmentsPagination.totalItems);
  const employeeName =
    formatLastNameCommaFirstName(user?.firstName, user?.lastName) ||
    user?.fullName ||
    user?.username ||
    '-';
  const employeeID = user?.employeeID ?? '';

  const [closeFormRow, setCloseFormRow] = React.useState<EmployeePostListingItem | null>(null);
  const [closeDetailsData, setCloseDetailsData] = React.useState<ClosedPostPositionDetailsResponse | null>(null);
  const [unclosingIds, setUnclosingIds] = React.useState<Set<string>>(new Set());
  const [uncloseRefundFlow, setUncloseRefundFlow] = React.useState<UnclosePostRefundFlowState | null>(null);

  const refundStrings = INVOICE_GRID.PAYMENT.REFUND_PAYMENT_ALLOCATION;

  const redirectToModifyInvoice = React.useCallback(
    (conflict: Parameters<typeof navigateToInvoiceModifyConflict>[1]) => {
      navigateToInvoiceModifyConflict(navigate, conflict);
    },
    [navigate]
  );

  const redirectToModifyInvoiceFromRefund = React.useCallback(
    (
      refund: {
        invoiceId?: string;
        closedPostPositionId?: string;
        editPayload?: InvoiceConflictEditPayload;
      },
      pendingAction?: PendingCloseJobAction
    ) => {
      const invoiceId = refund.invoiceId?.trim();
      if (!invoiceId) {
        dispatch(showToast(refundStrings.MISSING_INVOICE, 'error'));
        return;
      }
      redirectToModifyInvoice({
        invoiceId,
        closedPostPositionId: refund.closedPostPositionId,
        editPayload: refund.editPayload,
        pendingAction,
      });
    },
    [dispatch, redirectToModifyInvoice, refundStrings.MISSING_INVOICE]
  );

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
        // Backfill totals/availability from the details payload onto the selected row.
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

  const handleApplyDateFilters = React.useCallback(() => {
    setStartDate(draftStartDate);
    setEndDate(draftEndDate);
    setCurrentPage(1);
  }, [draftStartDate, draftEndDate, startDate, endDate]);

  /** Reset every filter to its initial empty state and re-fetch from page 1. */
  const handleClearFilters = React.useCallback(() => {
    setSearch('');
    onShowPlaceholdersChange?.(false);
    setEmployeeNameFilter('');
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
    employeeNameFilter !== '' ||
    requesterFilter !== '' ||
    draftStartDate !== '' ||
    draftEndDate !== '' ||
    startDate !== '' ||
    endDate !== '';

  const listFilters = React.useMemo(
    () => ({
      page: currentPage,
      pageSize,
      isOngoing: false as const,
      ...(debouncedSearch.trim() ? { searchTerm: debouncedSearch.trim() } : {}),
      ...(employeeNameFilter ? { employeeID: employeeNameFilter } : {}),
      ...(requesterFilter ? { requesterID: requesterFilter } : {}),
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
      ...(showPlaceholders ? { isPlaceholder: true } : {}),
    }),
    [currentPage, pageSize, debouncedSearch, employeeNameFilter, requesterFilter, startDate, endDate, showPlaceholders]
  );

  const handleEmployeeSearchInputChange = React.useCallback(
    (value: string) => dispatch(fetchEmployeeOptionsThunk({ searchTerm: value })).unwrap(),
    [dispatch]
  );

  React.useEffect(() => {
    dispatch(fetchRequesterOptionsThunk({}));
  }, [dispatch]);

  const handleCloseFormModalClose = React.useCallback(() => {
    setCloseFormRow(null);
    setCloseDetailsData(null);
  }, []);

  const handleEdit = React.useCallback(
    async (row: EmployeePostListingItem) => {
      // For closed assignments, always prefer the closedPostPositionID from details response.
      const fallbackClosedPostPositionId = resolveExistingClosedPostPositionId(row);
      if (!fallbackClosedPostPositionId) {
        dispatch(showToast('Job position not found', 'error'));
        return;
      }
      let details: ClosedPostPositionDetailsResponse | null = null;
      try {
        details = await getClosedPostPositionDetails(String(row.postPositionId || ''));
        setCloseDetailsData(details ?? null);
      } catch {
        setCloseDetailsData(null);
      }
      const closedPostPositionId =
        resolveClosedPostPositionIdFromDetails(details) ?? fallbackClosedPostPositionId;
      setCloseFormRow({
        ...row,
        // Keep original postPositionId for close endpoint lookup.
        postPositionId: row.postPositionId ?? row.parentPostPositionId ?? '',
        closedPostPositionID: closedPostPositionId,
      });
    },
    [dispatch]
  );

  const handleUnclose = React.useCallback(async (row: EmployeePostListingItem) => {
    const postPositionId = row.postPositionId ?? row.parentPostPositionId ?? null;
    if (!postPositionId) {
      dispatch(showToast('Job position not found', 'error'));
      return;
    }
    const normalizedId = String(postPositionId);
    if (unclosingIds.has(normalizedId) || isUncloseDisabledByApi(row)) {
      return;
    }

    try {
      setUnclosingIds((prev) => new Set(prev).add(normalizedId));
      const result = await dispatch(unclosePostPositionThunk(normalizedId)).unwrap();
      if (!result.success) {
        const refundFlow = uncloseRefundFlowFromResult(result, normalizedId);
        if (refundFlow) {
          setUncloseRefundFlow(refundFlow);
          return;
        }
        dispatch(showToast(refundStrings.MISSING_INVOICE, 'error'));
        return;
      }
      dispatch(showToast('Job position unclosed successfully', 'success'));
      await dispatch(fetchMyCloseAssignmentsThunk({ filters: listFilters })).unwrap();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to unclose job position';
      dispatch(showToast(message, 'error'));
    } finally {
      setUnclosingIds((prev) => {
        const next = new Set(prev);
        next.delete(normalizedId);
        return next;
      });
    }
  }, [dispatch, listFilters, unclosingIds, refundStrings.MISSING_INVOICE]);

  const handleCloseFormSubmit = React.useCallback(
    async (
      data: PostCloseFormData,
      equipmentDetails?: EquipmentDetail[],
      vehicleDetails?: VehicleDetail[],
      questionnaireSubmissions?: QuestionnaireSubmission[]
    ) => {
      try {
        const rawRow = (closeFormRow ?? {}) as Record<string, unknown>;
        const effectivePostPositionId =
          resolvePostPositionIdFromDetails(closeDetailsData) ??
          closeFormRow?.parentPostPositionId ??
          (rawRow.parentPostPositionID as string | undefined) ??
          closeFormRow?.postPositionId ??
          (rawRow.postPositionID as string | undefined) ??
          data.postPositionId;
        const existingClosedPostPositionId =
          resolveClosedPostPositionIdFromDetails(closeDetailsData) ??
          resolveExistingClosedPostPositionId(closeFormRow) ??
          data.parentClosedPostPositionID ??
          data.closedPostPositionID ??
          null;
        const payloadData: PostCloseFormData = {
          ...data,
          postPositionId: effectivePostPositionId,
          closedPostPositionID: null,
          parentClosedPostPositionID: existingClosedPostPositionId,
          ...(attributeCloseSaveToAdministrator ? { editedByDepartmentAdministrator: true } : {}),
        };

        const closeArgs = {
          data: payloadData,
          equipmentDetails: equipmentDetails ?? [],
          vehicleDetails: vehicleDetails ?? [],
          questionnaireSubmissions,
        };

        const result = await dispatch(closePostPositionWithEquipmentThunk(closeArgs)).unwrap();
        if (!result.success) {
          setCloseFormRow(null);
          setCloseDetailsData(null);
          redirectToModifyInvoiceFromRefund(result.refund, { kind: 'editClose', closeArgs });
          return;
        }

        setCloseFormRow(null);
        setCloseDetailsData(null);
        await dispatch(fetchMyCloseAssignmentsThunk({ filters: listFilters })).unwrap();
        dispatch(showToast('Close assignment saved', 'success'));
      } catch {
        // Error toast handled in thunk
      }
    },
    [dispatch, listFilters, closeFormRow, closeDetailsData, attributeCloseSaveToAdministrator, redirectToModifyInvoiceFromRefund]
  );

  React.useEffect(() => {
    dispatch(fetchMyCloseAssignmentsThunk({ filters: listFilters }));
  }, [dispatch, listFilters]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, employeeNameFilter, requesterFilter, startDate, endDate, showPlaceholders]);


  
  const columns = React.useMemo<DataTableColumn<EmployeePostListingItem>[]>(() => [
    {
      key: 'closeBy',
      label: 'Employee Name',
      render: (_value: unknown, row: EmployeePostListingItem) => {
        const closeBy = row.closeBy?.trim();
        if (closeBy) return closeBy;
        const fromApi = row.employeeName?.trim();
        if (fromApi) return fromApi;
        const employeeId = String(row.employeeID ?? '').trim().toLowerCase();
        if (employeeId) {
          const matchedName = employeeNameById.get(employeeId);
          if (matchedName) return matchedName;
        }
        const fromParts = formatLastNameCommaFirstName(
          row.firstName ?? '',
          row.lastName ?? '',
          ' '
        ).trim();
        if (fromParts) return fromParts;
        if (row.badgeNumber?.trim()) return row.badgeNumber.trim();
        return row.createdBy?.trim() || '-';
      },
    },
    {
      key: 'startDate',
      label: POST_GRID_COLUMNS.DATE,
      render: (_value: unknown, row: EmployeePostListingItem) => formatCloseAssignmentTableDate(row.startDate),
    },
    ...getPostGridTimeColumns<EmployeePostListingItem>({ showHoursWorkedAndRequired: true }),
    {
      key: 'requesterTitle',
      label: POST_GRID_COLUMNS.REQUESTER,
      render: (_value: unknown, row: EmployeePostListingItem) => row.requesterTitle?.trim() || '-',
    },
    {
      key: 'postTitle',
      label: POST_GRID_COLUMNS.TITLE,
      render: (value: unknown) => String(value || '-'),
    },
    {
      key: 'postPositionStatus',
      label: 'Type',
      render: (value: unknown) => getTypeLabel(value as number),
    },
    {
      key: 'action',
      label: 'Action',
      render: (_value: unknown, row: EmployeePostListingItem) => {
        const rowId = String(row.postPositionId ?? row.parentPostPositionId ?? '');
        const isUnclosing = rowId.length > 0 && unclosingIds.has(rowId);
        const isDisabledFromApi = isUncloseDisabledByApi(row);
        const isUncloseDisabled = isDisabledFromApi || isUnclosing;
        const editDisabled = !canDepartmentAdminEditClosedAssignments;
        return (
          <SMSStack direction="row" spacing={0} className="close-assignments__actions">
            <SMSIconButton
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
            <SMSIconButton
              className="level-1-requester__icon-btn"
              size="small"
              tone="primary"
              onClick={() => handleEdit(row)}
              aria-label="Edit"
              title="Edit"
              disabled={editDisabled}
            >
              <SMSIcon name="edit" size="sm" />
            </SMSIconButton>
            <SMSButton
              onClick={() => handleUnclose(row)}
              disabled={isUncloseDisabled}
              title={isDisabledFromApi ? 'Unclose is disabled' : isUnclosing ? 'Unclosing...' : 'Unclose'}
            >
              {isUnclosing ? 'Unclosing...' : 'Unclose'}
            </SMSButton>
          </SMSStack>
        );
      },
    },
  ], [handleEdit, handleUnclose, handleViewDetails, unclosingIds, employeeNameById, canDepartmentAdminEditClosedAssignments]);

  return (
    <SMSBox className="requester-list__content close-assignments">
      <SMSEmployeeAssignmentFilters
        idPrefix="close-assignments"
        className="close-assignments__filters"
        search={search}
        onSearchChange={setSearch}
        employee={employeeNameFilter}
        onEmployeeChange={setEmployeeNameFilter}
        employeeOptions={employeeOptions}
        requester={requesterFilter}
        onRequesterChange={setRequesterFilter}
        requesterOptions={requesterOptions}
        employeeServerSideSearch
        onEmployeeSearchInputChange={handleEmployeeSearchInputChange}
        startDate={draftStartDate}
        onStartDateChange={setDraftStartDate}
        endDate={draftEndDate}
        onEndDateChange={setDraftEndDate}
        onApply={handleApplyDateFilters}
        onClear={handleClearFilters}
        clearDisabled={!hasActiveFilters}
      />

      {error ? <SMSTypography className="close-assignments__error">{error}</SMSTypography> : null}

      <SMSDataTableWrapper<EmployeePostListingItem>
        columns={columns}
        data={rows}
        loading={loading}
        emptyMessage="No closed assignments found."
        tableClassName="requester-list__table close-assignments__table"
        maxBodyHeight={FILTERED_GRID_MAX_BODY_HEIGHT}
        pagination={{
          currentPage,
          pageSize,
          totalItems: totalItems,
          serverSide: true,
          onPageChange: setCurrentPage,
          onPageSizeChange: (newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          },
        }}
      />

      {closeFormRow && (
        <SMSModal
          isOpen={true}
          onClose={handleCloseFormModalClose}
          title="Close Assignment"
          size="xl"
        >
          <SMSCloseForm
            postPosition={closeFormRow}
            employeeName={employeeName}
            employeeID={employeeID}
            closedDetailsData={closeDetailsData}
            hideQuestionnaireIfNoClosedSubmission={true}
            disableQuestionnaire={true}
            isSplitMode={false}
            onSubmit={handleCloseFormSubmit}
            onCancel={handleCloseFormModalClose}
          />
        </SMSModal>
      )}

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

      <UnclosePostRefundDialogs
        flow={uncloseRefundFlow}
        onClose={() => setUncloseRefundFlow(null)}
        onAfterRefund={async (postPositionId) => {
          const result = await dispatch(unclosePostPositionThunk(postPositionId)).unwrap();
          if (!result.success) {
            const refundFlow = uncloseRefundFlowFromResult(result, postPositionId);
            if (refundFlow) {
              setUncloseRefundFlow(refundFlow);
              return;
            }
            dispatch(showToast(refundStrings.MISSING_INVOICE, 'error'));
            return;
          }
          setUncloseRefundFlow(null);
          dispatch(showToast('Job position unclosed successfully', 'success'));
          await dispatch(fetchMyCloseAssignmentsThunk({ filters: listFilters })).unwrap();
        }}
      />
    </SMSBox>
  );
};
