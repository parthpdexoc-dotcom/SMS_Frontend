import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
    PostPositionResponse,
    PostPositionStatus,
    POST_READY_TO_CLOSE_STATUS_FILTER,
    postPositionListStateKey,
} from '@/types/postPosition';
import type { EmployeePostListingItem } from '@/types/employeePostListingItem';
import type { DataTableColumn } from '@/components/smsorganisms';
import { SMSDataTableWrapper } from '@/components/smsorganisms';
import { SMSModal as Modal } from '@/components/smsorganisms';
import { SMSRosterModal } from '@/components/smsorganisms';
import { SMSCloseForm, SMSConfirmDialog, ClosePostRefundDialogs } from '@/components/smsmolecules';
import type { ClosePostRefundFlowState } from '@/components/smsmolecules/ClosePostRefundDialogs';
import { SMSBox, SMSButton, SMSCard, SMSGrid, SMSIcon, SMSIconButton, SMSStack, SMSTextArea, SMSTypography } from '@/components/smsatoms';
import { SMSTabs, type SMSTabOption } from '@/components/smsatoms/SMSTabs';
import { SMSPostInformationModal, SMSModal } from '@/components/smsorganisms';
import { POST_POSITION, AVAILABLE_POST, INVOICE_GRID } from '@/constants/strings';
import { DEFAULT_TABLE_PAGE_SIZE, FILTERED_GRID_MAX_BODY_HEIGHT } from '@/constants/tablePagination';
import type { SMSPostInformationModalSelectedPost } from '@/components/smsorganisms/SMSPostInformationModal/SMSPostInformationModal';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
    fetchPostPositionsByStatus,
    fetchLatestClosedPerPostPositionPaged,
    setPaginationByStatus,
    closePostPositionWithEquipmentThunk,
    splitPostPositionWithEquipmentThunk,
    parseSplitPostTimeConflictRejection,
    cancelPostPositionThunk,
    revokePostPositionCancellationThunk,
} from '@/store/slices/postPositionSlice';
import { closeRefundFlowFromResult } from '@/utils/closePostRefundFlow';
import { sendAssignPostEmailThunk } from '@/store/slices/sendAssignPostEmailSlice';
import { acceptSplitRequestThunk, declineSplitRequestThunk } from '@/store/slices/splitRequestSlice';
import { formatDateWithDayOfWeek, getPostGridTimeColumns, formatLastNameCommaFirstName, isSuspendedEmployeeActive } from '@/utils';
import { formatDateToYYYYMMDD } from '@/utils/dateTimeUtils';
import { renderPostPositionStatusPill } from '@/utils/postPositionStatusPill';
import { PostCloseFormData, CloseFormSubmitDeferredError } from '@/types/postCloseForm';
import { RequestResponse } from '@/types/request';
import { RequesterResponse } from '@/types/requester';
import { Post } from '@/types/post';
import { showToast } from '@/store/slices/toastSlice';
import { getPostPositionsByStatus } from '@/services/postPositionService';
import { getRequestViewDetails } from '@/services/requestViewDetailsService';
import { mapPostPositionListViewDetails } from '@/utils/mapRequestViewDetails';
import type { ViewDetailsLatestPostNoteMapped } from '@/utils/mapRequestViewDetails';
import type { PostEquipmentDto } from '@/services/postEquipmentService';
import { SMSViewDetailsEquipmentSection } from '@/components/smsmolecules/SMSViewDetailsEquipmentSection/SMSViewDetailsEquipmentSection';
import { getClosedPostPositionDetails, getClosedPostPositionDetailsList } from '@/services/closedPostPositionEquipmentService';
import {
    ClosedHistoryPostsDataGrid,
    ClosedHistoryVehiclesEquipmentBody,
    normalizeClosedPostDetailsList,
} from './closedHistoryPostDetails';
import type {
    ClosedPostDetailsHistoryEntry,
    ClosedPostQuestionnaireAnswer,
    ClosedPostQuestionnaireSubmission,
} from '@/types/closedPostHistoryDetails';
import { downloadRequestFile } from '@/services/fileUploadService';
import type { FileUploadDto } from '@/types/fileUpload';
import { EquipmentDetail, VehicleDetail, QuestionnaireSubmission } from '@/types/postCloseForm';
import './PostPositionByStatusList.css';
import '@/components/smsorganisms/SMSAvailablePostList/SMSAvailablePostList.css';
import { ScheduledJobCalendar } from '@/components/smsmolecules/ScheduledJobCalendar';
import { startOfMonth } from 'date-fns';

const SCHEDULED_JOB_CALENDAR_PAGE_SIZE = 1000;
/** Calendar API: assigned + cancellation pending (matches chip colors / popover rules). */
const SCHEDULED_JOB_CALENDAR_STATUSES = [PostPositionStatus.Assigned, PostPositionStatus.CancellationPending];
/** Temporary UI toggle: keep cancel-reason logic, hide input field. */
const SHOW_CANCELLATION_REASON_INPUT = false;

interface PostPositionByStatusListProps {
    /**
     * Backend `PostPositionStatus` filter for this list (e.g. 1 Assigned, 2 Closed, 3 Cancelled, 6 Declined).
     */
    statusEnum: number;
    /**
     * Whether to request ongoing records (isOngoing=true) or history (isOngoing=false)
     * This is passed as the isOngoing query parameter to the API.
     */
    isOngoing: boolean;
    title?: string;
    underTitleContent?: React.ReactNode;
    /** Optional override to view posts for a specific employee (e.g. supervisor view). */
    employeeId?: string;
    /** Optional override for employee display name in close/split forms. */
    employeeNameOverride?: string;
    /** When true, show only supervisor posts (IsSupervisorPost). */
    onlySupervisor?: boolean;
}

/** List/grid row from paged status APIs (unified `EmployeePostListingItemDto`). */
type PostPositionListRow = EmployeePostListingItem;

const EMPTY_ARRAY: PostPositionListRow[] = [];

/** Display answer for closed-history modal: prefer API `optionText`, else parse JSON option id array. */
function closedHistoryAnswerDisplay(a: ClosedPostQuestionnaireAnswer): string {
    if (a.optionText != null && String(a.optionText).trim() !== '') {
        return String(a.optionText).trim();
    }
    const raw = a.answer ?? '';
    if (!raw) return '-';
    if (raw.startsWith('[') && raw.endsWith(']')) {
        try {
            const arr = JSON.parse(raw) as string[];
            if (Array.isArray(arr) && arr.length > 0) {
                return arr.join(', ');
            }
        } catch {
            /* keep raw */
        }
    }
    return raw || '-';
}

const getTitleByStatus = (statusEnum: number, isOngoing: boolean): string => {
    switch (statusEnum) {
        case 1:
            return isOngoing
                ? AVAILABLE_POST.TAB_TITLES.CLOSE_POST
                : AVAILABLE_POST.TAB_TITLES.SCHEDULED_POST;
        case 2:
            return AVAILABLE_POST.TAB_TITLES.CLOSE_POST;
        default:
            return POST_POSITION.BY_STATUS_LIST.DEFAULT_TITLE;
    }
};

export const PostPositionByStatusList: React.FC<PostPositionByStatusListProps> = ({
    statusEnum,
    isOngoing,
    title,
    underTitleContent,
    employeeId,
    employeeNameOverride,
    onlySupervisor,
}) => {
    const dispatch = useAppDispatch();
    const [rosterModalOpen, setRosterModalOpen] = useState(false);
    const [rosterPostId, setRosterPostId] = useState<string>('');
    const [rosterDateOfWork, setRosterDateOfWork] = useState<string>('');
    const [closeRow, setCloseRow] = useState<PostPositionListRow | null>(null);
    const [closeFormMode, setCloseFormMode] = useState<'close' | 'split'>('close');
    const [splitTimeConflictOpen, setSplitTimeConflictOpen] = useState(false);
    const [splitTimeConflictMessage, setSplitTimeConflictMessage] = useState('');
    const pendingSplitSubmitRef = useRef<{
        data: PostCloseFormData;
        equipmentDetails: EquipmentDetail[];
        vehicleDetails: VehicleDetail[];
        questionnaireSubmissions?: QuestionnaireSubmission[];
    } | null>(null);
    const [closeRefundFlow, setCloseRefundFlow] = useState<ClosePostRefundFlowState | null>(null);
    const refundStrings = INVOICE_GRID.PAYMENT.REFUND_PAYMENT_ALLOCATION;
    const [pendingCancellationRow, setPendingCancellationRow] = useState<PostPositionListRow | null>(null);
    const [cancellationReason, setCancellationReason] = useState('');

    // Detail modal state
    const [selectedPost, setSelectedPost] = useState<PostPositionListRow | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [requestData, setRequestData] = useState<RequestResponse | null>(null);
    const [requesterData, setRequesterData] = useState<RequesterResponse | null>(null);
    const [postData, setPostData] = useState<Post | null>(null);
    /** Full API response from with-post (includes dateOfWork from PostPosition) */
    const [postDetailsFromApi, setPostDetailsFromApi] = useState<PostPositionResponse | null>(null);
    const [requestFiles, setRequestFiles] = useState<FileUploadDto[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [closedPostDetailsList, setClosedPostDetailsList] = useState<ClosedPostDetailsHistoryEntry[]>([]);
    const [closedVehiclesEquipmentModal, setClosedVehiclesEquipmentModal] = useState<{
        entryLabel: string;
        vehicleItems: Record<string, unknown>[];
        equipmentItems: Record<string, unknown>[];
    } | null>(null);
    const [isQuestionnairePopupOpen, setIsQuestionnairePopupOpen] = useState(false);
    const [closedQuestionnaireSubmissions, setClosedQuestionnaireSubmissions] = useState<
        ClosedPostQuestionnaireSubmission[]
    >([]);
    const viewDetailsRequestIdRef = useRef(0);
    /** Raw merged request + post equipment (same source as CloseForm `requestEquipmentRaw`). */
    const [detailModalEquipmentRaw, setDetailModalEquipmentRaw] = useState<PostEquipmentDto[]>([]);
    const [specialEventJobDetailsMessage, setSpecialEventJobDetailsMessage] = useState<string | null>(null);
    /** Root ViewDetailsDto.AvailablePositions for details modal "X out of Y" when present. */
    const [detailModalAvailablePositions, setDetailModalAvailablePositions] = useState<number | null>(null);
    const [latestPostNoteFromDetails, setLatestPostNoteFromDetails] = useState<ViewDetailsLatestPostNoteMapped | null>(
        null
    );

    const [scheduleView, setScheduleView] = useState<'table' | 'calendar'>('table');
    const [calendarVisibleMonth, setCalendarVisibleMonth] = useState<Date>(() => startOfMonth(new Date()));
    const [calendarRows, setCalendarRows] = useState<PostPositionListRow[]>([]);
    const [calendarLoading, setCalendarLoading] = useState(false);
    const [calendarError, setCalendarError] = useState<string | null>(null);

    const listStateKey = useMemo(() => postPositionListStateKey(statusEnum, isOngoing), [statusEnum, isOngoing]);

    const positions = useAppSelector((state) => state.postPosition.positionsByStatus[listStateKey] || EMPTY_ARRAY);
    const loading = useAppSelector((state) => state.postPosition.loadingByStatus[listStateKey] || false);
    const pagination = useAppSelector(
        (state) => state.postPosition.paginationByStatus[listStateKey] || { currentPage: 1, pageSize: DEFAULT_TABLE_PAGE_SIZE, totalItems: 0 }
    );
    const cancellingPostPositionId = useAppSelector((state) => state.postPosition.cancellingPostPositionId);
    const revokingCancellationPostPositionId = useAppSelector(
        (state) => state.postPosition.revokingCancellationPostPositionId
    );
    const sendingInvitePostPositionId = useAppSelector((state) => state.sendAssignPostEmail.sendingInvitePostPositionId);
    const user = useAppSelector((state) => state.auth.user);

    const displayTitle = title || getTitleByStatus(statusEnum, isOngoing);
    // Declined Split history tab: PostPositionStatus.Declined = 6 (history = isOngoing === false)
    const isDeclinedSplitHistoryTab =
        statusEnum === 6 && isOngoing === false && title === AVAILABLE_POST.TAB_TITLES.MY_HISTORY;
    // Closed history tab in My History should include both Closed (2) and ClosedAndSplit (4)
    const isClosedHistoryMyHistory =
        statusEnum === 2 && isOngoing === false && title === AVAILABLE_POST.TAB_TITLES.MY_HISTORY;
    const isScheduledJobTab = statusEnum === PostPositionStatus.Assigned && isOngoing === false;
    const isPostReadyToCloseTab = statusEnum === 1 && isOngoing === true;
    const isEmployeeScheduledJobsTab = statusEnum === 1 && isOngoing === false;
    const fetchStatuses = useMemo(
        () =>
            isScheduledJobTab
                ? [PostPositionStatus.Assigned, PostPositionStatus.CancellationPending]
                : isPostReadyToCloseTab
                ? [...POST_READY_TO_CLOSE_STATUS_FILTER]
                : isClosedHistoryMyHistory
                    ? [2, 4] // Closed + ClosedAndSplit for Closed Posts history tab
                    : undefined,
        [isScheduledJobTab, isPostReadyToCloseTab, isClosedHistoryMyHistory]
    );

    const employeeName =
        employeeNameOverride ||
        formatLastNameCommaFirstName(user?.firstName, user?.lastName) ||
        user?.fullName ||
        user?.username ||
        '-';
    const employeeID = employeeId ?? user?.employeeID ?? '';
    const isSuspendedActive = isSuspendedEmployeeActive(user);
    /** Suspension still blocks scheduled-post actions; Ready to Close (close/split/accept/decline) stays enabled. */
    const suspendBlocksPostPositionActions = isSuspendedActive && !isPostReadyToCloseTab;
    const allowEmployeeCancellation = user?.allowEmployeeCancellation === true;
    const enableEmployeeSplittingPosts = user?.enableEmployeeSplittingPosts === true;

    const handleCancelClick = useCallback(
        (row: PostPositionListRow) => {
            if (!row?.postPositionId) {
                dispatch(showToast('Job position not found', 'error'));
                return;
            }
            setCancellationReason('');
            setPendingCancellationRow(row);
        },
        [dispatch]
    );

    const handleRevokeCancellation = useCallback(
        async (row: PostPositionListRow) => {
            if (!row?.postPositionId) {
                dispatch(showToast('Job position not found', 'error'));
                return;
            }
            const id = row.postPositionId;
            try {
                await dispatch(
                    revokePostPositionCancellationThunk({
                        postPositionId: id,
                        filters: {
                            page: pagination.currentPage,
                            pageSize: pagination.pageSize,
                            isOngoing,
                            ...(employeeId && { employeeID: employeeId }),
                        },
                    })
                ).unwrap();

                if (isEmployeeScheduledJobsTab && scheduleView === 'calendar') {
                    setCalendarRows((prev) =>
                        prev.map((p) =>
                            String(p.postPositionId) === String(id)
                                ? { ...p, postPositionStatus: PostPositionStatus.Assigned }
                                : p
                        )
                    );
                }
                setSelectedPost((prev) =>
                    prev && String(prev.postPositionId) === String(id)
                        ? { ...prev, postPositionStatus: PostPositionStatus.Assigned }
                        : prev
                );
                setPostDetailsFromApi((prev) =>
                    prev && String(prev.postPositionId) === String(id)
                        ? { ...prev, postPositionStatus: PostPositionStatus.Assigned }
                        : prev
                );
            } catch {
                /* Error toast is dispatched inside revokePostPositionCancellationThunk */
            }
        },
        [
            dispatch,
            pagination.currentPage,
            pagination.pageSize,
            isOngoing,
            employeeId,
            isEmployeeScheduledJobsTab,
            scheduleView,
        ]
    );

    const handleCloseCancellationDialog = useCallback(() => {
        setCancellationReason('');
        setPendingCancellationRow(null);
    }, []);

    const handleSendInviteClick = useCallback(async (row: PostPositionListRow) => {
        const id = row.postPositionId;
        if (!id) return;
        dispatch(sendAssignPostEmailThunk(id));
    }, [dispatch]);

    const handleCalendarOpenRoster = useCallback((row: PostPositionListRow) => {
        if (row.postID && row.startDate) {
            const dateStr =
                typeof row.startDate === 'string'
                    ? row.startDate.split('T')[0]
                    : formatDateToYYYYMMDD(new Date(row.startDate));
            setRosterPostId(row.postID);
            setRosterDateOfWork(dateStr);
            setRosterModalOpen(true);
        }
    }, []);

    const handleConfirmCancellation = useCallback(async () => {
        if (!pendingCancellationRow?.postPositionId) {
            dispatch(showToast('Job position not found', 'error'));
            setPendingCancellationRow(null);
            return;
        }
        const reasonTrim = cancellationReason.trim();
        const reasonPayload = reasonTrim === '' ? null : reasonTrim;

        const cancelledPostPositionId = pendingCancellationRow.postPositionId;

        try {
            await dispatch(
                cancelPostPositionThunk({
                    postPositionId: cancelledPostPositionId,
                    cancellationReason: reasonPayload,
                    statusEnum,
                    filters: {
                        page: pagination.currentPage,
                        pageSize: pagination.pageSize,
                        isOngoing,
                        ...(employeeId && { employeeID: employeeId }),
                    },
                })
            ).unwrap();

            if (isEmployeeScheduledJobsTab && scheduleView === 'calendar') {
                setCalendarRows((prev) =>
                    prev.map((p) =>
                        String(p.postPositionId) === String(cancelledPostPositionId)
                            ? { ...p, postPositionStatus: PostPositionStatus.CancellationPending }
                            : p
                    )
                );
            }

            setSelectedPost((prev) =>
                prev && String(prev.postPositionId) === String(cancelledPostPositionId)
                    ? { ...prev, postPositionStatus: PostPositionStatus.CancellationPending }
                    : prev
            );
            setPostDetailsFromApi((prev) =>
                prev && String(prev.postPositionId) === String(cancelledPostPositionId)
                    ? { ...prev, postPositionStatus: PostPositionStatus.CancellationPending }
                    : prev
            );

            setCancellationReason('');
            setPendingCancellationRow(null);
        } catch {
            /* Error toast is dispatched inside cancelPostPositionThunk */
        }
    }, [
        dispatch,
        pendingCancellationRow,
        cancellationReason,
        statusEnum,
        pagination.currentPage,
        pagination.pageSize,
        isOngoing,
        employeeId,
        isEmployeeScheduledJobsTab,
        scheduleView,
    ]);

    const handleCloseClick = useCallback((row: PostPositionListRow) => {
        setCloseFormMode('close');
        setCloseRow(row);
    }, []);

    const handleSplitClick = useCallback((row: PostPositionListRow) => {
        setCloseFormMode('split');
        setCloseRow(row);
    }, []);

    const handleCloseFormModal = useCallback(() => {
        setCloseRow(null);
    }, []);

    const handleAcceptSplit = useCallback(async (postPositionId: string) => {
        if (postPositionId) {
            await dispatch(acceptSplitRequestThunk(postPositionId));
        } else {
            dispatch(showToast('Unable to find split request information', 'error'));
        }
    }, [dispatch]);

    const handleDeclineSplit = useCallback(async (postPositionId: string) => {
        if (postPositionId) {
            await dispatch(declineSplitRequestThunk(postPositionId));
        } else {
            dispatch(showToast('Unable to find split request information', 'error'));
        }
    }, [dispatch]);

    const handleViewDetails = useCallback(async (post: PostPositionListRow) => {
        const requestId = ++viewDetailsRequestIdRef.current;

        setSelectedPost(post);
        setIsDetailModalOpen(true);
        setLoadingDetails(true);
        setRequestData(null);
        setRequesterData(null);
        setPostData(null);
        setPostDetailsFromApi(null);
        setRequestFiles([]);
        setClosedPostDetailsList([]);
        setDetailModalEquipmentRaw([]);
        setSpecialEventJobDetailsMessage(null);
        setDetailModalAvailablePositions(null);
        setLatestPostNoteFromDetails(null);

        try {
            // My History → Closed Posts: closed record(s) + equipment for grid in post details modal
            if (isClosedHistoryMyHistory) {
                try {
                    const candidatePostPositionIds = Array.from(
                        new Set(
                            [
                                post.postPositionId,
                                (post as unknown as Record<string, unknown>)?.postPositionID as string | undefined,
                                post.parentPostPositionId,
                                (post as unknown as Record<string, unknown>)?.parentPostPositionID as string | undefined,
                            ]
                                .map((v) => String(v ?? '').trim())
                                .filter((v) => v.length > 0)
                        )
                    );

                    let listRaw: Awaited<ReturnType<typeof getClosedPostPositionDetailsList>> = [];
                    let single: Awaited<ReturnType<typeof getClosedPostPositionDetails>> = null;

                    for (const pid of candidatePostPositionIds) {
                        try {
                            const listResult = await getClosedPostPositionDetailsList(pid);
                            if (Array.isArray(listResult) && listResult.length > 0) {
                                listRaw = listResult;
                                break;
                            }
                            // Fallback to single endpoint when list is empty for this candidate.
                            const singleResult = await getClosedPostPositionDetails(pid);
                            if (singleResult) {
                                single = singleResult;
                                break;
                            }
                        } catch {
                            // Try next candidate id.
                        }
                    }
                    const normalized = normalizeClosedPostDetailsList(
                        (Array.isArray(listRaw) ? listRaw : []) as ClosedPostDetailsHistoryEntry[],
                        single
                            ? {
                                  closedPostPosition: (single.closedPostPosition ?? null) as Record<string, unknown> | null,
                                  equipments: single.equipments,
                                  questionnaireSubmissions: (single as Record<string, unknown>)
                                      .questionnaireSubmissions as ClosedPostDetailsHistoryEntry['questionnaireSubmissions'],
                              }
                            : null
                    );
                    setClosedPostDetailsList(normalized);
                    const qsEntry = normalized.find(
                        (e) => Array.isArray(e.questionnaireSubmissions) && e.questionnaireSubmissions!.length > 0
                    );
                    setClosedQuestionnaireSubmissions(qsEntry?.questionnaireSubmissions ?? []);
                } catch {
                    setClosedPostDetailsList([]);
                    setClosedQuestionnaireSubmissions([]);
                }
            }

            const dateOfWork = String(post.startDate ?? '').trim().slice(0, 10) || undefined;

            const dto = await getRequestViewDetails({
                postPositionId: post.postPositionId?.trim() || undefined,
                postId: post.postID?.trim() || undefined,
                requestId: post.requestID?.trim() || undefined,
                dateOfWork,
                isSpecialEvent:
                    post.isSpecialEvent === true ? true : post.isSpecialEvent === false ? false : undefined,
            });
            const mapped = mapPostPositionListViewDetails(post, dto);
            setPostDetailsFromApi(mapped.postDetailsFromApi);
            setPostData(mapped.postData);
            setRequestData(mapped.requestData);
            setRequesterData(mapped.requesterData);
            setRequestFiles(mapped.files);
            setDetailModalEquipmentRaw(mapped.detailModalEquipmentRaw);
            setSpecialEventJobDetailsMessage(mapped.specialEventJobDetailsMessage ?? null);
            setDetailModalAvailablePositions(mapped.viewDetailsAvailablePositions);
            setLatestPostNoteFromDetails(mapped.latestPostNote ?? null);
        } catch {
            dispatch(showToast(POST_POSITION.BY_STATUS_LIST.LOAD_DETAILS_ERROR, 'error'));
        } finally {
            if (viewDetailsRequestIdRef.current !== requestId) return;

            setLoadingDetails(false);
        }
    }, [dispatch, isClosedHistoryMyHistory]);
    const selectedAvailablePost = useMemo<SMSPostInformationModalSelectedPost | null>(() => {
        if (!selectedPost) return null;
        const resolvedTotalPositions =
            postDetailsFromApi?.totalPostPositions ?? selectedPost.totalPositions ?? 0;
        const workDate = String(
            postDetailsFromApi?.dateOfWork ??
                postDetailsFromApi?.startDate ??
                selectedPost.startDate ??
                ''
        ).slice(0, 10);
        return {
            postID: selectedPost.postID,
            postTitle: postDetailsFromApi?.postTitle ?? selectedPost.postTitle ?? '',
            startTime: postDetailsFromApi?.postStartTime ?? selectedPost.startTime,
            payCodeValue: postData?.payCodeValue ?? selectedPost.payCodeValue ?? null,
            postLength:
                postDetailsFromApi?.postLength ??
                postDetailsFromApi?.lengthOfWork ??
                selectedPost.postLength,
            startDate: workDate,
            postLocation: postDetailsFromApi?.postLocation ?? selectedPost.postLocation,
            postDescription: postDetailsFromApi?.postDescription,
            postNotes: postDetailsFromApi?.postNotes,
            assignedEmployeeName:
                formatLastNameCommaFirstName(postDetailsFromApi?.employeeFirstName, postDetailsFromApi?.employeeLastName) ??
                selectedPost.employeeName ??
                null,
            totalPositions: resolvedTotalPositions,
            availablePositions: selectedPost.availablePositions ?? resolvedTotalPositions,
            isSpecialEvent: selectedPost.isSpecialEvent,
            callSign: postDetailsFromApi?.callSign ?? postData?.postCallSign,
        };
    }, [selectedPost, postDetailsFromApi, postData]);

    const closedDetailsPopupContent = useMemo<React.ReactNode>(() => {
        if (!isClosedHistoryMyHistory || !selectedPost) return null;
        return (
            <ClosedHistoryPostsDataGrid
                key={selectedPost.postPositionId || selectedPost.postID || 'closed-history'}
                entries={closedPostDetailsList}
                selectedPost={selectedPost}
                onOpenVehiclesEquipment={setClosedVehiclesEquipmentModal}
            />
        );
    }, [isClosedHistoryMyHistory, selectedPost, closedPostDetailsList]);

    const detailModalEquipmentSection = useMemo(() => {
        if (!selectedPost) return null;
        return (
            <SMSViewDetailsEquipmentSection
                equipmentRaw={detailModalEquipmentRaw}
                postPositionDetails={postDetailsFromApi}
            />
        );
    }, [selectedPost, detailModalEquipmentRaw, postDetailsFromApi]);

    const detailModalCombinedExtraContent = useMemo(() => detailModalEquipmentSection ?? undefined, [detailModalEquipmentSection]);

    const handleCloseDetailModal = useCallback(() => {
        setIsDetailModalOpen(false);
        setSelectedPost(null);
        setRequestData(null);
        setRequesterData(null);
        setPostData(null);
        setPostDetailsFromApi(null);
        setRequestFiles([]);
        setLoadingDetails(false);
        setClosedPostDetailsList([]);
        setClosedQuestionnaireSubmissions([]);
        setIsQuestionnairePopupOpen(false);
        setClosedVehiclesEquipmentModal(null);
        setDetailModalEquipmentRaw([]);
        setSpecialEventJobDetailsMessage(null);
        setDetailModalAvailablePositions(null);
        setLatestPostNoteFromDetails(null);
    }, []);

    const handlePageChange = useCallback(
        (page: number) => {
            dispatch(setPaginationByStatus({ statusEnum, isOngoing, pagination: { currentPage: page } }));
        },
        [dispatch, statusEnum, isOngoing]
    );

    const handlePageSizeChange = useCallback(
        (newPageSize: number) => {
            dispatch(
                setPaginationByStatus({ statusEnum, isOngoing, pagination: { pageSize: newPageSize, currentPage: 1 } })
            );
        },
        [dispatch, statusEnum, isOngoing]
    );

    const handleCloseFormSubmit = useCallback(
        async (
            data: PostCloseFormData,
            equipmentDetails?: EquipmentDetail[],
            vehicleDetails?: VehicleDetail[],
            questionnaireSubmissions?: QuestionnaireSubmission[]
        ) => {
            const isSplit = closeFormMode === 'split';
            const successMsg = isSplit ? POST_POSITION.CLOSE_FORM.SUCCESS_SPLIT : POST_POSITION.CLOSE_FORM.SUCCESS_CLOSE;
            const errorMsg = isSplit ? POST_POSITION.CLOSE_FORM.ERROR_SPLIT : POST_POSITION.CLOSE_FORM.ERROR_CLOSE;
            const closeArgs = {
                data,
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
                dispatch(
                    fetchPostPositionsByStatus({
                        statusEnum,
                        ...(isPostReadyToCloseTab && { statuses: [...POST_READY_TO_CLOSE_STATUS_FILTER] }),
                        filters: {
                            page: pagination.currentPage,
                            pageSize: pagination.pageSize,
                            isOngoing,
                            ...(employeeId && { employeeID: employeeId }),
                        },
                    })
                );
            } catch (err: unknown) {
                const conflict = isSplit ? parseSplitPostTimeConflictRejection(err) : null;
                if (conflict) {
                    pendingSplitSubmitRef.current = {
                        data,
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
        [
            dispatch,
            closeFormMode,
            statusEnum,
            isPostReadyToCloseTab,
            pagination.currentPage,
            pagination.pageSize,
            isOngoing,
            employeeId,
        ]
    );

    const handleCancelSplitTimeConflict = useCallback(() => {
        setSplitTimeConflictOpen(false);
        pendingSplitSubmitRef.current = null;
    }, []);

    const handleConfirmSplitTimeConflict = useCallback(async () => {
        const pending = pendingSplitSubmitRef.current;
        if (!pending) {
            setSplitTimeConflictOpen(false);
            return;
        }
        setSplitTimeConflictOpen(false);
        try {
            await dispatch(
                splitPostPositionWithEquipmentThunk({
                    ...pending,
                    confirmConflict: true,
                })
            ).unwrap();
            pendingSplitSubmitRef.current = null;
            setCloseRow(null);
            dispatch(showToast(POST_POSITION.CLOSE_FORM.SUCCESS_SPLIT, 'success'));
            dispatch(
                fetchPostPositionsByStatus({
                    statusEnum,
                    ...(isPostReadyToCloseTab && { statuses: [...POST_READY_TO_CLOSE_STATUS_FILTER] }),
                    filters: {
                        page: pagination.currentPage,
                        pageSize: pagination.pageSize,
                        isOngoing,
                        ...(employeeId && { employeeID: employeeId }),
                    },
                })
            );
        } catch (err: unknown) {
            const message =
                typeof err === 'string'
                    ? err
                    : err instanceof Error
                      ? err.message
                      : POST_POSITION.CLOSE_FORM.ERROR_SPLIT;
            dispatch(showToast(message, 'error'));
        }
    }, [
        dispatch,
        statusEnum,
        isPostReadyToCloseTab,
        pagination.currentPage,
        pagination.pageSize,
        isOngoing,
        employeeId,
    ]);

    useEffect(() => {
        if (isClosedHistoryMyHistory) {
            dispatch(
                fetchLatestClosedPerPostPositionPaged({
                    statusEnum,
                    isOngoing,
                    filters: {
                        page: pagination.currentPage,
                        pageSize: pagination.pageSize,
                        ...(employeeId && { employeeId }),
                    },
                })
            );
            return;
        }
        dispatch(
            fetchPostPositionsByStatus({
                statusEnum,
                ...(fetchStatuses && { statuses: fetchStatuses }),
                filters: {
                    page: pagination.currentPage,
                    pageSize: pagination.pageSize,
                    isOngoing,
                    ...(employeeId && { employeeID: employeeId }),
                },
            })
        );
    }, [
        dispatch,
        statusEnum,
        pagination.currentPage,
        pagination.pageSize,
        isOngoing,
        employeeId,
        fetchStatuses,
        isClosedHistoryMyHistory,
    ]);

    const listStr = POST_POSITION.BY_STATUS_LIST;
    const colStr = listStr.COLUMNS;
    const btnStr = listStr.BUTTONS;

    const filteredPositions: PostPositionListRow[] = useMemo(() => {
        if (!onlySupervisor) return positions;
        return positions.filter((p) => {
            const raw = p as unknown as Record<string, unknown>;
            return raw.isSupervisorPost === true || raw.IsSupervisorPost === true;
        });
    }, [positions, onlySupervisor]);

    const columns: DataTableColumn<PostPositionListRow>[] = useMemo(() => {
        const baseColumns: DataTableColumn<PostPositionListRow>[] = [
            {
                key: 'startDate',
                label: colStr.DATE,
                render: (value: any, row: PostPositionListRow) =>
                    value ? (
                        <SMSBox sx={{ whiteSpace: 'pre-line', lineHeight: 1.2 }}>
                            {formatDateWithDayOfWeek(String(value), row.dayOfWeek)}
                        </SMSBox>
                    ) : '---',
            },
            // My History → Closed Jobs shows actual work start/end times instead of scheduled post times.
            ...getPostGridTimeColumns<PostPositionListRow>({ useWorkTimes: isClosedHistoryMyHistory }),
            {
                key: 'postTitle',
                label: colStr.TITLE,
                render: (value: any) => value || '-',
            },
        ];

        // Scheduled Posts (status 1, history/isOngoing === false): add Type column showing ReleaseAs from API
        if (isEmployeeScheduledJobsTab) {
            baseColumns.push({
                key: 'postPositionStatus',
                label: colStr.STATUS ?? 'Status',
                render: (value: any, row: PostPositionListRow) => {
                    const raw = value ?? row.postPositionStatus ?? (row as any).PostPositionStatus;
                    return (
                        <SMSBox
                            className="post-position-by-status-list__status-pill-wrap"
                            sx={{
                                width: '100%',
                                maxWidth: '100%',
                                minWidth: 0,
                                textAlign: 'center',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                            }}
                        >
                            {renderPostPositionStatusPill(raw)}
                        </SMSBox>
                    );
                },
            });
        }

        if (statusEnum === 1) {
            baseColumns.push(
                {
                    key: 'requiresEquipment',
                    label: colStr.REQUIRES_EQUIPMENT,
                    render: (value: unknown, row: PostPositionListRow) => {
                        const equipmentReq = row.showEquipment ?? value;
                        if (equipmentReq === true || String(equipmentReq) === 'true') return listStr.YES;
                        if (equipmentReq === false || String(equipmentReq) === 'false') return listStr.NO;
                        return '-';
                    },
                },
                {
                    key: 'requiresVehicle',
                    label: colStr.REQUIRES_VEHICLE,
                    render: (value: unknown, row: PostPositionListRow) => {
                        const vehicleReq = row.showVehicle ?? value;
                        if (vehicleReq === true || String(vehicleReq) === 'true') return listStr.YES;
                        if (vehicleReq === false || String(vehicleReq) === 'false') return listStr.NO;
                        return '-';
                    },
                }
            );
        }

        if (statusEnum === 1) {
            const isPostReadyToCloseTab = isOngoing === true;
            baseColumns.push({
                key: 'action',
                label: colStr.ACTION,
                render: (_value: any, row: PostPositionListRow) => {
                    // For non-ready-to-close views, keep existing View + Cancel behavior.
                    if (!isPostReadyToCloseTab) {
                        const handleRosterClick = () => {
                            if (row.postID && row.startDate) {
                                // Format date to YYYY-MM-DD
                                const dateStr = typeof row.startDate === 'string'
                                    ? row.startDate.split('T')[0]
                                    : formatDateToYYYYMMDD(new Date(row.startDate));
                                setRosterPostId(row.postID);
                                setRosterDateOfWork(dateStr);
                                setRosterModalOpen(true);
                            }
                        };

                        return (
                            <div className="post-position-by-status-list__actions">
                                <SMSStack direction="row" spacing={0.5} justifyContent="center" alignItems="center">
                                    <SMSIconButton
                                        size="small"
                                        tone="primary"
                                        aria-label={btnStr.VIEW_DETAILS}
                                        title={btnStr.VIEW_DETAILS}
                                        allowWhenSuspended
                                        onClick={() => handleViewDetails(row)}
                                    >
                                        <SMSIcon name="eye" size="sm" />
                                    </SMSIconButton>
                                    {row.postID && row.startDate && (
                                        <SMSIconButton
                                            size="small"
                                            tone="info"
                                            allowWhenSuspended
                                            onClick={handleRosterClick}
                                            title="View Roster"
                                            aria-label="View Roster"
                                        >
                                            <SMSIcon name="description" size="sm" />
                                        </SMSIconButton>
                                    )}
                                    {Number(row.postPositionStatus) === PostPositionStatus.CancellationPending ? null : (
                                        <SMSIconButton
                                            size="small"
                                            tone="primary"
                                            aria-label="Add To Calendar"
                                            title="Add To Calendar"
                                            onClick={() => handleSendInviteClick(row)}
                                            disabled={suspendBlocksPostPositionActions || sendingInvitePostPositionId === row.postPositionId}
                                        >
                                            <SMSIcon name="send" size="sm" />
                                        </SMSIconButton>
                                    )}
                                    {allowEmployeeCancellation &&
                                    Number(row.postPositionStatus) !== PostPositionStatus.CancellationPending ? (
                                        <SMSButton
                                            aria-label={btnStr.CANCEL_POST}
                                            title={btnStr.CANCEL_POST}
                                            onClick={() => handleCancelClick(row)}
                                            disabled={suspendBlocksPostPositionActions || cancellingPostPositionId === row.postPositionId}
                                        >
                                            {btnStr.CANCEL_POST}
                                        </SMSButton>
                                    ) : null}
                                    {Number(row.postPositionStatus) === PostPositionStatus.CancellationPending ? (
                                        <SMSButton
                                            aria-label={btnStr.REVOKE_CANCELLATION}
                                            title={btnStr.REVOKE_CANCELLATION}
                                            onClick={() => handleRevokeCancellation(row)}
                                            disabled={
                                                suspendBlocksPostPositionActions ||
                                                revokingCancellationPostPositionId === row.postPositionId
                                            }
                                        >
                                            {btnStr.REVOKE_CANCELLATION}
                                        </SMSButton>
                                    ) : null}
                                    
                                </SMSStack>
                            </div>
                        );
                    }

                    // Post Ready To Close (ongoing) tab: show View Details, Close, Split (and Accept/Decline when applicable).
                    // Check conditions for showing three-dots menu:
                    // 1. postPositionStatus === SplitDecisionPending (5)
                    // 2. splitStatus === 0 (or isSplit === false)
                    // 3. parentPostPositionId is not null
                    // 4. splitPostPositionID is not null
                    const postPositionStatus = row.postPositionStatus;
                    const ext = row as unknown as { splitStatus?: number; isSplit?: boolean | null };
                    const splitStatus = ext.splitStatus;
                    const isSplit = row.isSplit ?? ext.isSplit;
                    // API returns camelCase: parentPostPositionId
                    const parentPostPositionId = row.parentPostPositionId ?? (row as any).parentPostPositionId;
                    // API returns PascalCase: splitPostPositionID
                    const splitPostPositionID = row.splitPostPositionID ?? (row as any).splitPostPositionID;
                    // closedPostPositionID might not be in response, use splitPostPositionID as fallback
                    const closedPostPositionID = row.closedPostPositionID ?? (row as any).closedPostPositionID ?? splitPostPositionID;

                    // splitStatus === 0 means pending, or isSplit === false when splitStatus is undefined
                    const isPendingSplit = splitStatus === 0 || (splitStatus === undefined && isSplit === false);

                    const shouldShowAcceptDecline =
                        Number(postPositionStatus) === PostPositionStatus.SplitDecisionPending &&
                        isPendingSplit &&
                        parentPostPositionId != null &&
                        parentPostPositionId !== '' &&
                        splitPostPositionID != null &&
                        splitPostPositionID !== '';

                    // If conditions are met, show View Details, Accept (no Close/Split here)
                    // Use postPositionId for accept endpoint.
                    const postPositionId = row.postPositionId;
                    if (shouldShowAcceptDecline && closedPostPositionID && postPositionId) {
                        return (
                            <div className="post-position-by-status-list__actions">
                                <SMSStack direction="row" spacing={0.5} justifyContent="center" alignItems="center">
                                    <SMSIconButton
                                        size="small"
                                        tone="primary"
                                        aria-label={btnStr.VIEW_DETAILS}
                                        title={btnStr.VIEW_DETAILS}
                                        allowWhenSuspended
                                        onClick={() => handleViewDetails(row)}
                                    >
                                        <SMSIcon name="eye" size="sm" />
                                    </SMSIconButton>
                                    <SMSIconButton
                                        size="small"
                                        aria-label={btnStr.ACCEPT}
                                        title={btnStr.ACCEPT}
                                        allowWhenSuspended
                                        onClick={() => handleAcceptSplit(postPositionId)}
                                        disabled={suspendBlocksPostPositionActions}
                                    >
                                        <SMSIcon name="check" size="sm" />
                                    </SMSIconButton>
                                    <SMSIconButton
                                        size="small"
                                        tone="success"
                                        aria-label="Decline"
                                        title="Decline"
                                        allowWhenSuspended
                                        onClick={() => handleDeclineSplit(postPositionId)}
                                        disabled={suspendBlocksPostPositionActions}
                                    >
                                        <SMSIcon name="close" size="sm" />
                                    </SMSIconButton>
                                </SMSStack>
                            </div>
                        );
                    }

                    // Otherwise, show the normal Close/Split buttons
                    return (
                        <div className="post-position-by-status-list__actions">
                            <SMSStack direction="row" spacing={0.5} justifyContent="center" alignItems="center">
                                <SMSIconButton
                                    size="small"
                                    tone="primary"
                                    aria-label={btnStr.VIEW_DETAILS}
                                    title={btnStr.VIEW_DETAILS}
                                    allowWhenSuspended
                                    onClick={() => handleViewDetails(row)}
                                >
                                    <SMSIcon name="eye" size="sm" />
                                </SMSIconButton>
                                <SMSButton
                                    aria-label={btnStr.CLOSE_POST}
                                    title={btnStr.CLOSE_POST}
                                    allowWhenSuspended={isSuspendedActive && isPostReadyToCloseTab}
                                    onClick={() => handleCloseClick(row)}
                                    disabled={suspendBlocksPostPositionActions}
                                >
                                    {btnStr.CLOSE_POST}
                                </SMSButton>
                                {enableEmployeeSplittingPosts &&
                                Number(row.postPositionStatus) !== PostPositionStatus.Unclosed ? (
                                    <SMSButton
                                        allowWhenSuspended={isSuspendedActive && isPostReadyToCloseTab}
                                        onClick={() => handleSplitClick(row)}
                                        disabled={suspendBlocksPostPositionActions}
                                    >
                                        {btnStr.SPLIT}
                                    </SMSButton>
                                ) : null}
                            </SMSStack>
                        </div>
                    );
                },
            });
        }

        if (statusEnum === 2) {
            const isHistoryView = title === AVAILABLE_POST.TAB_TITLES.MY_HISTORY;

            if (isHistoryView) {
                baseColumns.push({
                    key: 'action',
                    label: colStr.ACTION,
                    render: (_value: any, row: PostPositionListRow) => {
                        return (
                            <div className="post-position-by-status-list__actions">
                                <SMSIconButton
                                    size="small"
                                    tone="primary"
                                    aria-label={btnStr.VIEW_DETAILS}
                                    title={btnStr.VIEW_DETAILS}
                                    allowWhenSuspended
                                    onClick={() => handleViewDetails(row)}
                                >
                                    <SMSIcon name="eye" size="sm" />
                                </SMSIconButton>
                            </div>
                        );
                    },
                });
            } else {
                baseColumns.push({
                    key: 'action',
                    label: colStr.ACTION,
                    render: (_value: any, row: PostPositionListRow) => {
                        return (
                            <div className="post-position-by-status-list__actions">
                                <SMSButton
                                    allowWhenSuspended
                                    onClick={() => handleViewDetails(row)}
                                >
                                    {btnStr.VIEW_DETAILS}
                                </SMSButton>
                                <SMSButton
                                    onClick={() => handleCloseClick(row)}
                                >
                                    {btnStr.CLOSE_POST}
                                </SMSButton>
                                <SMSButton
                                    onClick={() => handleSplitClick(row)}
                                >
                                    {btnStr.SPLIT}
                                </SMSButton>
                            </div>
                        );
                    },
                });
            }
        }

        // Cancelled posts in My History (status 3, history): show View Details
        if (statusEnum === 3 && title === AVAILABLE_POST.TAB_TITLES.MY_HISTORY) {
            baseColumns.push({
                key: 'action',
                label: colStr.ACTION,
                render: (_value: any, row: PostPositionListRow) => (
                    <div className="post-position-by-status-list__actions">
                        <SMSIconButton
                            size="small"
                            tone="primary"
                            aria-label={btnStr.VIEW_DETAILS}
                            title={btnStr.VIEW_DETAILS}
                            allowWhenSuspended
                            onClick={() => handleViewDetails(row)}
                        >
                            <SMSIcon name="eye" size="sm" />
                        </SMSIconButton>
                    </div>
                ),
            });
        }

        // Declined Split history tab (status 6, history "My History"): show View Details only
        if (isDeclinedSplitHistoryTab) {
            baseColumns.push({
                key: 'action',
                label: colStr.ACTION,
                render: (_value: any, row: PostPositionListRow) => (
                    <div className="post-position-by-status-list__actions">
                        <SMSIconButton
                            size="small"
                            tone="primary"
                            aria-label={btnStr.VIEW_DETAILS}
                            title={btnStr.VIEW_DETAILS}
                            allowWhenSuspended
                            onClick={() => handleViewDetails(row)}
                        >
                            <SMSIcon name="eye" size="sm" />
                        </SMSIconButton>
                    </div>
                ),
            });
        }

        return baseColumns;
    }, [statusEnum, title, isOngoing, allowEmployeeCancellation, enableEmployeeSplittingPosts, handleCancelClick, handleRevokeCancellation, handleSendInviteClick, sendingInvitePostPositionId, handleCloseClick, handleSplitClick, handleAcceptSplit, handleDeclineSplit, handleViewDetails, colStr.ACTION, isDeclinedSplitHistoryTab, btnStr.VIEW_DETAILS, btnStr.ACCEPT, btnStr.CANCEL_POST, btnStr.REVOKE_CANCELLATION, btnStr.CLOSE_POST, btnStr.SPLIT, colStr, listStr, suspendBlocksPostPositionActions, isSuspendedActive, isPostReadyToCloseTab, isEmployeeScheduledJobsTab, isClosedHistoryMyHistory, revokingCancellationPostPositionId, cancellingPostPositionId]);

    const filteredCalendarPositions: PostPositionListRow[] = useMemo(() => {
        if (!onlySupervisor) return calendarRows;
        return calendarRows.filter((p) => {
            const raw = p as unknown as Record<string, unknown>;
            return raw.isSupervisorPost === true || raw.IsSupervisorPost === true;
        });
    }, [calendarRows, onlySupervisor]);

    useEffect(() => {
        if (!isEmployeeScheduledJobsTab || scheduleView !== 'calendar') return;
        let cancelled = false;
        setCalendarLoading(true);
        setCalendarError(null);
        getPostPositionsByStatus(SCHEDULED_JOB_CALENDAR_STATUSES, {
            page: 1,
            pageSize: SCHEDULED_JOB_CALENDAR_PAGE_SIZE,
            isOngoing: false,
            ...(employeeId && { employeeID: employeeId }),
        })
            .then((res) => {
                if (cancelled) return;
                setCalendarRows(res.data ?? []);
            })
            .catch(() => {
                if (!cancelled) {
                    setCalendarError(AVAILABLE_POST.SCHEDULED_JOB_CALENDAR.FETCH_ERROR);
                    setCalendarRows([]);
                }
            })
            .finally(() => {
                if (!cancelled) setCalendarLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [isEmployeeScheduledJobsTab, scheduleView, employeeId]);

    const scheduleViewTabOptions = useMemo<SMSTabOption[]>(() => {
        const c = AVAILABLE_POST.SCHEDULED_JOB_CALENDAR;
        return [
            { id: 'table', label: c.VIEW_TABLE, icon: 'list' },
            { id: 'calendar', label: c.VIEW_CALENDAR, icon: 'calendar' },
        ];
    }, []);

    return (
        <div className="post-position-by-status-list">
            <div className="post-position-by-status-list__header">
                <SMSStack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    flexWrap="wrap"
                    spacing={2}
                    sx={{ width: '100%', gap: 2 }}
                >
                    <h2 className="post-position-by-status-list__title">{displayTitle}</h2>
                    {isEmployeeScheduledJobsTab ? (
                        <SMSTabs
                            options={scheduleViewTabOptions}
                            value={scheduleView}
                            onChange={(id) => setScheduleView(id as 'table' | 'calendar')}
                            size="small"
                            distribution="content"
                        />
                    ) : null}
                </SMSStack>
                {underTitleContent && (
                    <div className="post-position-by-status-list__under-title">
                        {underTitleContent}
                    </div>
                )}
                {/* Add button can be added here if needed in the future */}
            </div>
            {isEmployeeScheduledJobsTab && scheduleView === 'calendar' ? (
                <>
                    {calendarError ? (
                        <SMSTypography variant="body2" color="error" sx={{ mb: 2 }}>
                            {calendarError}
                        </SMSTypography>
                    ) : null}
                    <ScheduledJobCalendar
                        positions={filteredCalendarPositions}
                        visibleMonth={calendarVisibleMonth}
                        onMonthChange={setCalendarVisibleMonth}
                        onViewFullDetails={handleViewDetails}
                        scheduledActions={{
                            onOpenRoster: handleCalendarOpenRoster,
                            onSendInvite: handleSendInviteClick,
                            sendInviteDisabled: suspendBlocksPostPositionActions,
                            sendingInvitePostPositionId,
                            onCancelJob: handleCancelClick,
                            allowEmployeeCancellation,
                            suspendBlocksCancellation: suspendBlocksPostPositionActions,
                            cancellingPostPositionId,
                            onRevokeCancellation: handleRevokeCancellation,
                            revokingCancellationPostPositionId,
                        }}
                        loading={calendarLoading}
                    />
                </>
            ) : (
            <div className="post-position-by-status-list__table" data-post-cols={columns.length}>
                <SMSDataTableWrapper
                    columns={columns}
                    data={filteredPositions}
                    loading={loading}
                    emptyMessage={POST_POSITION.TABLE.NO_DATA}
                    maxBodyHeight={FILTERED_GRID_MAX_BODY_HEIGHT}
                    pagination={{
                        currentPage: pagination.currentPage,
                        pageSize: pagination.pageSize,
                        totalItems: pagination.totalItems,
                        serverSide: true,
                        onPageChange: handlePageChange,
                        onPageSizeChange: handlePageSizeChange,
                    }}
                />
            </div>
            )}

            {closeRow && (
                <Modal
                    isOpen={!!closeRow}
                    onClose={handleCloseFormModal}
                    title={closeFormMode === 'split' ? POST_POSITION.CLOSE_FORM.SPLIT_TITLE : POST_POSITION.CLOSE_FORM.TITLE}
                    size="xl"
                    className="modal--scrollable-content"
                >
                    <SMSCloseForm
                        postPosition={closeRow}
                        employeeName={employeeName}
                        employeeID={employeeID}
                        isSplitMode={closeFormMode === 'split'}
                        onSubmit={handleCloseFormSubmit}
                        onCancel={handleCloseFormModal}
                        allowWhenSuspended={isSuspendedActive && isPostReadyToCloseTab}
                    />
                </Modal>
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
                        dispatch(
                            fetchPostPositionsByStatus({
                                statusEnum,
                                ...(isPostReadyToCloseTab && { statuses: [...POST_READY_TO_CLOSE_STATUS_FILTER] }),
                                filters: {
                                    page: pagination.currentPage,
                                    pageSize: pagination.pageSize,
                                    isOngoing,
                                    ...(employeeId && { employeeID: employeeId }),
                                },
                            })
                        );
                    } catch {
                        // Error toast handled in thunk
                    }
                }}
            />
            {selectedPost && selectedAvailablePost && (
                <SMSPostInformationModal
                    open={isDetailModalOpen}
                    onClose={handleCloseDetailModal}
                    isLoading={loadingDetails}
                    title={POST_POSITION.DETAIL_MODAL.TITLE}
                    preferPostPositionFields
                    specialEventMode={selectedPost.isSpecialEvent === true}
                    specialEventJobDetailsMessage={specialEventJobDetailsMessage}
                    latestPostNoteFromDetails={latestPostNoteFromDetails}
                    footerLeftAction={
                        isPostReadyToCloseTab &&
                        Number(selectedPost.postPositionStatus) !== PostPositionStatus.SplitDecisionPending ? (
                            <SMSStack
                                direction="row"
                                spacing={0.5}
                                alignItems="center"
                                flexWrap="wrap"
                                justifyContent="flex-end"
                            >
                                <SMSButton
                                    aria-label={btnStr.CLOSE_POST}
                                    title={btnStr.CLOSE_POST}
                                    allowWhenSuspended={isSuspendedActive && isPostReadyToCloseTab}
                                    onClick={() => {
                                        const row = selectedPost;
                                        if (!row) return;
                                        handleCloseDetailModal();
                                        handleCloseClick(row);
                                    }}
                                    disabled={suspendBlocksPostPositionActions}
                                >
                                    {btnStr.CLOSE_POST}
                                </SMSButton>
                                {enableEmployeeSplittingPosts &&
                                Number(selectedPost.postPositionStatus) !== PostPositionStatus.Unclosed ? (
                                    <SMSButton
                                        aria-label={btnStr.SPLIT}
                                        title={btnStr.SPLIT}
                                        allowWhenSuspended={isSuspendedActive && isPostReadyToCloseTab}
                                        onClick={() => {
                                            const row = selectedPost;
                                            if (!row) return;
                                            handleCloseDetailModal();
                                            handleSplitClick(row);
                                        }}
                                        disabled={suspendBlocksPostPositionActions}
                                    >
                                        {btnStr.SPLIT}
                                    </SMSButton>
                                ) : null}
                            </SMSStack>
                        ) : undefined
                    }
                    selectedPost={{
                        postID: selectedPost.postID,
                        postTitle: postDetailsFromApi?.postTitle ?? selectedPost.postTitle ?? '-',
                        startTime: isClosedHistoryMyHistory
                            ? String(closedPostDetailsList[0]?.closedPostPosition?.postStartTime ?? '')
                            : postDetailsFromApi?.postStartTime ?? selectedPost.startTime,
                        postEndTime: isClosedHistoryMyHistory
                            ? String(closedPostDetailsList[0]?.closedPostPosition?.postEndTime ?? '')
                            : postDetailsFromApi?.postEndTime ?? selectedPost.postEndTime,
                        payCodeValue: postData?.payCodeValue ?? selectedPost.payCodeValue ?? null,
                        postLength:
                            postDetailsFromApi?.postLength ??
                            postDetailsFromApi?.lengthOfWork ??
                            selectedPost.postLength,
                        startDate: String(
                            postDetailsFromApi?.dateOfWork ??
                                postDetailsFromApi?.startDate ??
                                selectedPost.startDate ??
                                ''
                        ).slice(0, 10),
                        postLocation: postDetailsFromApi?.postLocation ?? selectedPost.postLocation,
                        postDescription: postDetailsFromApi?.postDescription,
                        postNotes: postDetailsFromApi?.postNotes,
                        assignedEmployeeName:
                            formatLastNameCommaFirstName(postDetailsFromApi?.employeeFirstName, postDetailsFromApi?.employeeLastName) ??
                            selectedPost.employeeName ??
                            null,
                        totalPositions:
                            postDetailsFromApi?.totalPostPositions ?? selectedPost.totalPositions,
                        availablePositions:
                            detailModalAvailablePositions ?? selectedPost.availablePositions ?? null,
                        isSpecialEvent: selectedPost.isSpecialEvent,
                        callSign: postDetailsFromApi?.callSign ?? postData?.postCallSign,
                    }}
                    requestData={requestData}
                    requesterData={requesterData}
                    postData={postData}
                    requestFiles={requestFiles}
                    showTotalPositions
                    showAvailablePositions
                    showCallSign
                    extraActions={
                        isClosedHistoryMyHistory && closedQuestionnaireSubmissions.length > 0 ? (
                            <>
                                <SMSButton
                                    allowWhenSuspended
                                    onClick={() => setIsQuestionnairePopupOpen(true)}
                                    endIcon={<SMSIcon name="assignment" size="sm" />}
                                >
                                    {POST_POSITION.BY_STATUS_LIST.CLOSED_HISTORY_TABLE.QUESTIONNAIRE_DETAILS}
                                </SMSButton>
                            </>
                        ) : undefined
                    }
                    onDownloadFile={async (file) => {
                        const requestID = requestData?.requestID ?? selectedPost?.requestID ?? '';
                        const requesterID = requestData?.requesterID ?? '';
                        if (!requestID || !requesterID) return;
                        try {
                            await downloadRequestFile(requesterID, requestID, file.fileUploadedId, file.fileName);
                        } catch {
                            dispatch(showToast('Failed to download file', 'error'));
                        }
                    }}
                    extraContentTop={closedDetailsPopupContent}
                    extraContent={detailModalCombinedExtraContent}
                />
            )}
            {selectedPost && isClosedHistoryMyHistory && (
                <SMSModal
                    open={!!closedVehiclesEquipmentModal}
                    onClose={() => setClosedVehiclesEquipmentModal(null)}
                    title={POST_POSITION.BY_STATUS_LIST.CLOSED_HISTORY_TABLE.VEHICLES_EQUIPMENT_MODAL_TITLE}
                    size="large"
                >
                    <div className="available-post-list__modal-content">
                        {closedVehiclesEquipmentModal ? (
                            <ClosedHistoryVehiclesEquipmentBody
                                entryLabel={closedVehiclesEquipmentModal.entryLabel}
                                vehicleItems={closedVehiclesEquipmentModal.vehicleItems}
                                equipmentItems={closedVehiclesEquipmentModal.equipmentItems}
                            />
                        ) : null}
                    </div>
                </SMSModal>
            )}
            {selectedPost && isClosedHistoryMyHistory && (
                <SMSModal
                    open={isQuestionnairePopupOpen}
                    onClose={() => setIsQuestionnairePopupOpen(false)}
                    title={POST_POSITION.BY_STATUS_LIST.CLOSED_HISTORY_TABLE.QUESTIONNAIRE_DETAILS}
                    size="large"
                >
                    <div className="available-post-list__modal-content">
                        {closedQuestionnaireSubmissions.length === 0 ? (
                            <SMSCard sx={{ p: 2 }}>
                                <SMSTypography variant="body2" color="text.secondary">
                                    No questionnaire data found.
                                </SMSTypography>
                            </SMSCard>
                        ) : (
                            <SMSStack spacing={1.5}>
                                {closedQuestionnaireSubmissions.map((submission, submissionIdx) => (
                                    <SMSCard
                                        key={submission.questionnaireId ?? `q-${submissionIdx}`}
                                        variant="outlined"
                                        sx={{ p: 1.5 }}
                                    >
                                        <SMSStack spacing={1}>
                                            <SMSTypography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                                {submission.questionnaireTitle?.trim()
                                                    || `Questionnaire ${submissionIdx + 1}`}
                                            </SMSTypography>
                                            <SMSStack direction="row" spacing={1} alignItems="center">
                                                <SMSIcon name="assignment" size="sm" />
                                                <SMSTypography variant="body2" color="text.secondary">
                                                    Questionnaire:
                                                </SMSTypography>
                                                <SMSTypography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                                                    {submission.questionnaireTitle?.trim()
                                                        || submission.questionnaireId
                                                        || '-'}
                                                </SMSTypography>
                                            </SMSStack>
                                            {Array.isArray(submission.answers) && submission.answers.length > 0 ? (
                                                <SMSGrid container spacing={2}>
                                                    {submission.answers.map((a, answerIdx) => (
                                                        <SMSGrid item xs={12} md={6} key={`${submissionIdx}-${a.questionId ?? answerIdx}`}>
                                                            <SMSCard variant="outlined" sx={{ p: 1.25 }}>
                                                                <SMSStack spacing={1}>
                                                                    <SMSStack direction="row" spacing={1} alignItems="center">
                                                                        <SMSIcon name="help_outline" size="sm" />
                                                                        <SMSTypography variant="body2" color="text.secondary">{`Question ${answerIdx + 1}:`}</SMSTypography>
                                                                        <SMSTypography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                                                                            {a.questionText?.trim()
                                                                                || a.questionId
                                                                                || '-'}
                                                                        </SMSTypography>
                                                                    </SMSStack>
                                                                    <SMSStack direction="row" spacing={1} alignItems="center">
                                                                        <SMSIcon name="check_circle_outline" size="sm" />
                                                                        <SMSTypography variant="body2" color="text.secondary">{`Answer ${answerIdx + 1}:`}</SMSTypography>
                                                                        <SMSTypography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                                                                            {closedHistoryAnswerDisplay(a)}
                                                                        </SMSTypography>
                                                                    </SMSStack>
                                                                </SMSStack>
                                                            </SMSCard>
                                                        </SMSGrid>
                                                    ))}
                                                </SMSGrid>
                                            ) : (
                                                <SMSTypography variant="body2" color="text.secondary">
                                                    No answers found for this questionnaire.
                                                </SMSTypography>
                                            )}
                                        </SMSStack>
                                    </SMSCard>
                                ))}
                            </SMSStack>
                        )}
                    </div>
                </SMSModal>
            )}

            {/* Roster Modal */}
            <SMSRosterModal
                isOpen={rosterModalOpen}
                onClose={() => {
                    setRosterModalOpen(false);
                    setRosterPostId('');
                    setRosterDateOfWork('');
                }}
                postId={rosterPostId}
                dateOfWork={rosterDateOfWork}
                disableCallSignUpdate={isEmployeeScheduledJobsTab}
            />

            <SMSConfirmDialog
                open={!!pendingCancellationRow}
                title={listStr.CANCEL_CONFIRMATION.TITLE}
                message={listStr.CANCEL_CONFIRMATION.MESSAGE}
                confirmText={listStr.CANCEL_CONFIRMATION.CONFIRM_BUTTON}
                cancelText={listStr.CANCEL_CONFIRMATION.CANCEL_BUTTON}
                onConfirm={handleConfirmCancellation}
                onClose={handleCloseCancellationDialog}
                variant="info"
                loading={
                    !!pendingCancellationRow?.postPositionId
                    && cancellingPostPositionId === pendingCancellationRow.postPositionId
                }
                loadingMessage="Processing..."
            >
                {SHOW_CANCELLATION_REASON_INPUT ? (
                    <SMSTextArea
                        label={listStr.CANCEL_CONFIRMATION.REASON_LABEL}
                        placeholder={listStr.CANCEL_CONFIRMATION.REASON_PLACEHOLDER}
                        value={cancellationReason}
                        onChange={(event) => setCancellationReason(event.target.value)}
                        minRows={3}
                        fullWidth
                        helperText=" "
                    />
                ) : null}
            </SMSConfirmDialog>
        </div>
    );
};
