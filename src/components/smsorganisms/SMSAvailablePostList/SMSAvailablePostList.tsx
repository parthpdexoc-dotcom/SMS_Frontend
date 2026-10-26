import React, { useEffect, useLayoutEffect, useMemo, useCallback, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePagination } from '@/hooks/usePagination';
import { SMSBox, SMSButton, SMSIcon, SMSIconButton, SMSStack, SMSTypography } from '@/components/smsatoms';
import { SMSPostInformationModal } from '@/components/smsorganisms/SMSPostInformationModal';
import { SMSRosterModal } from '@/components/smsorganisms';
import {
  SMSDataTableWrapper,
  type DataTableColumn,
} from '@/components/smsorganisms/SMSDataTableWrapper/SMSDataTableWrapper';
import { SMSAvailablePostFilter, SMSConfirmDialog, SMSSpecialEventApplyAction, SMSTakeShiftAction } from '@/components/smsmolecules';
import { SMSViewDetailsEquipmentSection } from '@/components/smsmolecules/SMSViewDetailsEquipmentSection/SMSViewDetailsEquipmentSection';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchAvailablePosts, fetchWaitingListPosts, assignPostToMeThunk, fetchAvailablePostDetails } from '@/store/slices/availablePostSlice';
import { showToast } from '@/store/slices/toastSlice';
import { AVAILABLE_POST, POST_GRID_COLUMNS } from '@/constants/strings';
import { AVAILABLE_JOBS_ROUTE_TAB_ID } from '@/constants/availableJobsRouteTabs';
import { formatDateWithDayOfWeek, getPostGridTimeColumns } from '@/utils';
import type { EmployeePostListingItem } from '@/types/employeePostListingItem';
import { ReleaseAs } from '@/types/request';
import { RequestResponse } from '@/types/request';
import { RequesterResponse } from '@/types/requester';
import { Post } from '@/types/post';
import { downloadRequestFile } from '@/services/fileUploadService';
import type { FileUploadDto } from '@/types/fileUpload';
import type { ViewDetailsLatestPostNoteMapped } from '@/utils/mapRequestViewDetails';
import type { PostEquipmentDto } from '@/services/postEquipmentService';
import './SMSAvailablePostList.css';

export interface SMSAvailablePostListProps {
    /**
     * Supervisor Employee Jobs view: scope the list to this employee (sent as `employeeId`
     * on available-post / by-statuses) and hide take/apply actions (read-only).
     * Omit for the employee's own dashboard (JWT scope).
     */
    employeeId?: string;
}

export const SMSAvailablePostList: React.FC<SMSAvailablePostListProps> = ({ employeeId }) => {
    const readOnly = Boolean(employeeId);
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const {
        posts,
        totalRecords,
        listPage,
        listPageSize,
        isLoading,
        error,
        displayError,
        hasOutstandingReadyToClosePost,
        searchModel,
        filterAppliedAt,
        showWaitingPosts,
        waitingListPosts,
        waitingListTotalRecords,
        isWaitingListLoading,
        waitingListMessage,
    } = useAppSelector((state) => state.availablePost);
    // Wait for URL releaseAs to land in Redux so refresh does not fetch Open first.
    const urlReleaseAs = searchParams.get('releaseAs');
    const filtersReady =
        !urlReleaseAs ||
        Number.parseInt(urlReleaseAs, 10) === searchModel.releaseAs;
    const [selectedPost, setSelectedPost] = useState<EmployeePostListingItem | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDetailsLoading, setIsDetailsLoading] = useState(false);
    const [requestData, setRequestData] = useState<RequestResponse | null>(null);
    const [requesterData, setRequesterData] = useState<RequesterResponse | null>(null);
    const [postData, setPostData] = useState<Post | null>(null);
    const [requestFiles, setRequestFiles] = useState<FileUploadDto[]>([]);
    const [specialEventJobDetailsMessage, setSpecialEventJobDetailsMessage] = useState<string | null>(null);
    const [latestPostNoteFromDetails, setLatestPostNoteFromDetails] = useState<ViewDetailsLatestPostNoteMapped | null>(
        null
    );
    const [detailModalEquipmentRaw, setDetailModalEquipmentRaw] = useState<PostEquipmentDto[]>([]);
    const [viewDetailsShowVehicle, setViewDetailsShowVehicle] = useState(false);
    const [viewDetailsShowEquipment, setViewDetailsShowEquipment] = useState(false);
    const [isSpecialEventRosterOpen, setIsSpecialEventRosterOpen] = useState(false);
    const [specialEventRosterRequestId, setSpecialEventRosterRequestId] = useState('');
    const [specialEventRosterDate, setSpecialEventRosterDate] = useState('');
    const [confirmationDialog, setConfirmationDialog] = useState<{
        isOpen: boolean;
        message: string;
        post: EmployeePostListingItem | null;
    }>({ isOpen: false, message: '', post: null });

    const pagination = usePagination();

    const displayedPosts = showWaitingPosts ? waitingListPosts : posts;
    const displayedLoading =
        !filtersReady || (showWaitingPosts ? isWaitingListLoading : isLoading);
    const emptyMessage = showWaitingPosts
        ? (waitingListMessage || AVAILABLE_POST.LIST.NO_DATA)
        : (displayError || AVAILABLE_POST.LIST.NO_DATA);

    useEffect(() => {
        pagination.setTotalItems(showWaitingPosts ? waitingListTotalRecords : totalRecords);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showWaitingPosts, totalRecords, waitingListTotalRecords]);

    useLayoutEffect(() => {
        pagination.goToFirstPage();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterAppliedAt, showWaitingPosts]);

    useEffect(() => {
        if (!filtersReady) return;
        if (showWaitingPosts) {
            pagination.goToFirstPage();
            dispatch(
                fetchWaitingListPosts({
                    searchModel,
                    pagination: { page: 1, pageSize: pagination.pageSize },
                    employeeId,
                })
            );
            return;
        }
        pagination.goToFirstPage();
        dispatch(
            fetchAvailablePosts({
                searchModel,
                pagination: { page: 1, pageSize: pagination.pageSize },
                employeeId,
            })
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        dispatch,
        employeeId,
        filtersReady,
        searchModel.startDate,
        searchModel.numberOfDays,
        searchModel.releaseAs,
        searchModel.requester,
        searchModel.payCode,
        searchModel.managedGeneralIncludesPreferred,
        filterAppliedAt,
        showWaitingPosts,
    ]);

    const handleViewDetails = useCallback(async (post: EmployeePostListingItem) => {
        setSelectedPost(post);
        setIsModalOpen(true);
        setIsDetailsLoading(true);
        setRequestData(null);
        setRequesterData(null);
        setPostData(null);
        setRequestFiles([]);
        setSpecialEventJobDetailsMessage(null);
        setLatestPostNoteFromDetails(null);
        setDetailModalEquipmentRaw([]);
        setViewDetailsShowVehicle(false);
        setViewDetailsShowEquipment(false);

        try {
            const details = await dispatch(fetchAvailablePostDetails(post)).unwrap();
            setPostData(details.postData ?? null);
            setRequestData(details.requestData ?? null);
            setRequesterData(details.requesterData ?? null);
            setRequestFiles(details.files ?? []);
            setSpecialEventJobDetailsMessage(details.specialEventJobDetailsMessage ?? null);
            setLatestPostNoteFromDetails(details.latestPostNote ?? null);
            setDetailModalEquipmentRaw(details.detailModalEquipmentRaw ?? []);
            setViewDetailsShowVehicle(Boolean(details.viewDetailsShowVehicle));
            setViewDetailsShowEquipment(Boolean(details.viewDetailsShowEquipment));
            setSelectedPost((prev) => {
                const row = prev ?? post;
                if (!row) return prev;
                const next = { ...row };
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
        } catch (err) {
            dispatch(showToast(AVAILABLE_POST.DETAILS.ERROR_LOAD, 'error'));
        } finally {
            setIsDetailsLoading(false);
        }
    }, [dispatch]);

    const handleCloseModal = useCallback(() => {
        setIsModalOpen(false);
        setSelectedPost(null);
        setIsDetailsLoading(false);
        setRequestData(null);
        setRequesterData(null);
        setPostData(null);
        setRequestFiles([]);
        setSpecialEventJobDetailsMessage(null);
        setLatestPostNoteFromDetails(null);
        setDetailModalEquipmentRaw([]);
        setViewDetailsShowVehicle(false);
        setViewDetailsShowEquipment(false);
    }, []);

    const detailModalEquipmentExtra = useMemo(() => {
        if (!isModalOpen || !selectedPost) return null;
        if (
            detailModalEquipmentRaw.length === 0 &&
            !viewDetailsShowVehicle &&
            !viewDetailsShowEquipment
        ) {
            return null;
        }
        return (
            <SMSViewDetailsEquipmentSection
                equipmentRaw={detailModalEquipmentRaw}
                rootShowVehicle={viewDetailsShowVehicle}
                rootShowEquipment={viewDetailsShowEquipment}
                postPositionDetails={null}
            />
        );
    }, [
        isModalOpen,
        selectedPost,
        detailModalEquipmentRaw,
        viewDetailsShowVehicle,
        viewDetailsShowEquipment,
    ]);

    const handleConfirmConflict = useCallback(async () => {
        const postToAssign = confirmationDialog.post;
        if (!postToAssign) {
            setConfirmationDialog({ isOpen: false, message: '', post: null });
            return;
        }

        setConfirmationDialog({ isOpen: false, message: '', post: null });
        try {
            // Use the thunk instead of calling service directly
            await dispatch(
                assignPostToMeThunk({
                    postID: postToAssign.postID,
                    dateOfWork: postToAssign.startDate,
                    startDate: postToAssign.startDate,
                    confirmConflict: true,
                    releaseAs: searchModel.releaseAs,
                    ...(postToAssign.postPositionId?.trim()
                        ? { postPositionId: postToAssign.postPositionId.trim() }
                        : {}),
                })
            ).unwrap();
            
            // Success: Thunk already shows success toast, just refresh and close modal
            handleCloseModal();
            dispatch(
                fetchAvailablePosts({
                    searchModel,
                    pagination: { page: listPage, pageSize: listPageSize },
                })
            );
        } catch {
            // Error toast is already shown by the thunk, no need to show again
            // Just handle any additional logic if needed
        }
    }, [confirmationDialog.post, dispatch, handleCloseModal, searchModel, listPage, listPageSize]);

    const handleCancelConflict = useCallback(() => {
        setConfirmationDialog({ isOpen: false, message: '', post: null });
    }, []);

    const openSpecialEventRoster = useCallback((post: EmployeePostListingItem) => {
        setSpecialEventRosterRequestId(post.requestID ?? '');
        setSpecialEventRosterDate(String(post.startDate ?? '').slice(0, 10));
        setIsSpecialEventRosterOpen(true);
    }, []);
    
    const columns: DataTableColumn<EmployeePostListingItem>[] = useMemo(() => [
        {
            key: 'startDate',
            label: POST_GRID_COLUMNS.DATE,
            render: (_value: unknown, row: EmployeePostListingItem) =>
                row.startDate
                    ? (
                        <SMSBox sx={{ whiteSpace: 'pre-line', lineHeight: 1.2 }}>
                            {formatDateWithDayOfWeek(row.startDate, row.dayOfWeek)}
                        </SMSBox>
                    )
                    : AVAILABLE_POST.COMMON.EMPTY_VALUE,
        },
        ...getPostGridTimeColumns<EmployeePostListingItem>(),
        {
            key: 'payCodeValue',
            label: POST_GRID_COLUMNS.PAY_CODE,
            render: (_value: unknown, row: EmployeePostListingItem) =>
                row.payCodeValue?.trim() || AVAILABLE_POST.COMMON.EMPTY_VALUE,
        },
        {
            key: 'rank',
            label: POST_GRID_COLUMNS.RANK,
            render: (_value: unknown, row: EmployeePostListingItem) =>
                row.jobRank?.trim() || AVAILABLE_POST.COMMON.EMPTY_VALUE,
        },
        {
            key: 'requestTitle',
            label: POST_GRID_COLUMNS.REQUEST_TITLE,
            render: (_value: unknown, row: EmployeePostListingItem) =>
                row.requestTitle?.trim() || AVAILABLE_POST.COMMON.EMPTY_VALUE,
        },
        {
            key: 'postTitle',
            label: POST_GRID_COLUMNS.TITLE,
            render: (_value: unknown, row: EmployeePostListingItem) => {
                // Backend sends the display title in `title` (parsed into `postTitle`) for both special-event and post rows.
                return row.postTitle?.trim() || AVAILABLE_POST.COMMON.EMPTY_VALUE;
            },
        },
        {
            key: 'availablePositions',
            label: AVAILABLE_POST.LIST.COLUMNS.AVAILABLE,
            render: (_value: unknown, row: EmployeePostListingItem) =>
                `${row.availablePositions ?? 0}/${row.totalPositions}`,
        },
        ...(searchModel.releaseAs === ReleaseAs.Cancelled
            ? [
                  {
                      key: 'cancelledBy' as const,
                      label: AVAILABLE_POST.LIST.COLUMNS.CANCELLED_BY,
                      render: (_value: unknown, row: EmployeePostListingItem) =>
                          row.cancelledBy?.trim() || AVAILABLE_POST.COMMON.EMPTY_VALUE,
                  } satisfies DataTableColumn<EmployeePostListingItem>,
              ]
            : []),
        {
            key: 'action',
            label: AVAILABLE_POST.LIST.COLUMNS.ACTION,
            render: (_value: unknown, row: EmployeePostListingItem) => {
                return (
                    <SMSStack direction="row" spacing={1} justifyContent="center" alignItems="center">
                        <SMSIconButton
                            size="small"
                            tone="primary"
                            allowWhenSuspended
                            aria-label={AVAILABLE_POST.LIST.ICON_ACTIONS.VIEW_DETAILS_ARIA}
                            title={AVAILABLE_POST.LIST.ICON_ACTIONS.VIEW_DETAILS_ARIA}
                            onClick={() => handleViewDetails(row)}
                            sx={{
                                borderRadius: 1,
                            }}
                        >
                            <SMSIcon name="eye" size="sm" />
                        </SMSIconButton>
                        {row.isSpecialEvent === true && (
                            <SMSIconButton
                                size="small"
                                tone="info"
                                allowWhenSuspended
                                onClick={() => openSpecialEventRoster(row)}
                                title="View Roster"
                                aria-label="View Roster"
                            >
                                <SMSIcon name="description" size="sm" />
                            </SMSIconButton>
                        )}

                        {!readOnly &&
                            (row.isSpecialEvent === true ? (
                                <SMSSpecialEventApplyAction
                                    post={row}
                                    mode="button"
                                    disabled={false}
                                />
                            ) : (
                                <SMSTakeShiftAction
                                    post={row}
                                    mode="button"
                                    disabled={!showWaitingPosts && row.availablePositions === 0}
                                />
                            ))}
                    </SMSStack>
                );
            },
        },
    ], [handleViewDetails, openSpecialEventRoster, showWaitingPosts, searchModel.releaseAs, readOnly]);

    return (
        <SMSBox className="sms-available-post-list">
            <SMSBox>
                <SMSAvailablePostFilter showAllReleaseTabs={readOnly} />
            </SMSBox>

                <SMSBox component="main" className="sms-available-post-list__main">
                    <SMSTypography variant="h4" sx={{ mb: 1, fontWeight: 600, paddingTop: 1 }}>
                        {showWaitingPosts ? AVAILABLE_POST.LIST.VIEW_LABELS.WAITING : AVAILABLE_POST.LIST.VIEW_LABELS.AVAILABLE}
                    </SMSTypography>

                    {!readOnly && hasOutstandingReadyToClosePost && displayedPosts.length === 0 && !displayedLoading ? (
                        <SMSBox
                            sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: { xs: 4, md: 6 },
                                minHeight: { xs: '300px', md: '400px' },
                                maxWidth: 600,
                                margin: '0 auto',
                                textAlign: 'center',
                            }}
                        >
                            <SMSBox
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: { xs: 64, md: 80 },
                                    height: { xs: 64, md: 80 },
                                    borderRadius: '50%',
                                    backgroundColor: '#fff3e0',
                                    mb: 3,
                                }}
                            >
                                <SMSIcon name="warning" size="xl" color="#f57c00" />
                            </SMSBox>

                            <SMSTypography
                                variant="h5"
                                component="h3"
                                sx={{
                                    fontWeight: 600,
                                    color: 'text.primary',
                                    mb: 1.5,
                                }}
                            >
                                Outstanding Jobs Require Attention
                            </SMSTypography>

                            <SMSTypography
                                variant="body1"
                                color="text.secondary"
                                sx={{
                                    maxWidth: '500px',
                                    lineHeight: 1.6,
                                    mb: 3,
                                }}
                            >
                                {displayError}
                            </SMSTypography>

                            <SMSButton
                                variant="contained"
                                size="medium"
                                onClick={() => navigate(`/available-jobs/${AVAILABLE_JOBS_ROUTE_TAB_ID.JOB_READY_TO_CLOSE}`)}
                                leftIcon={<SMSIcon name="check_circle" size="sm" />}
                                sx={{
                                    textTransform: 'none',
                                    fontWeight: 600,
                                    borderRadius: '8px',
                                    px: 3,
                                }}
                            >
                                {AVAILABLE_POST.TABS.CLOSE_POST}
                            </SMSButton>
                        </SMSBox>
                    ) : (
                        <SMSDataTableWrapper<EmployeePostListingItem>
                            columns={columns}
                            data={displayedPosts}
                            loading={displayedLoading}
                            error={error}
                            emptyMessage={emptyMessage}
                            emptyTitle=""
                            emptyIcon="calendar"
                            showHeaderWhenEmpty={true}
                            maxBodyHeight="calc(100vh - 360px)"
                            tableClassName={`sms-available-post-list__data-table${
                                searchModel.releaseAs === ReleaseAs.Cancelled
                                    ? ' sms-available-post-list__data-table--cancelled-jobs'
                                    : ''
                            }`}
                            pagination={{
                                serverSide: true,
                                currentPage: pagination.currentPage,
                                pageSize: pagination.pageSize,
                                totalItems: pagination.totalItems,
                                onPageChange: (page) => {
                                    pagination.goToPage(page);
                                    if (showWaitingPosts) {
                                        dispatch(
                                            fetchWaitingListPosts({
                                                searchModel,
                                                pagination: { page, pageSize: pagination.pageSize },
                                                employeeId,
                                            })
                                        );
                                    } else {
                                        dispatch(
                                            fetchAvailablePosts({
                                                searchModel,
                                                pagination: { page, pageSize: pagination.pageSize },
                                                employeeId,
                                            })
                                        );
                                    }
                                },
                                onPageSizeChange: (newPageSize) => {
                                    pagination.setPageSize(newPageSize);
                                    pagination.goToFirstPage();
                                    if (showWaitingPosts) {
                                        dispatch(
                                            fetchWaitingListPosts({
                                                searchModel,
                                                pagination: { page: 1, pageSize: newPageSize },
                                                employeeId,
                                            })
                                        );
                                    } else {
                                        dispatch(
                                            fetchAvailablePosts({
                                                searchModel,
                                                pagination: { page: 1, pageSize: newPageSize },
                                                employeeId,
                                            })
                                        );
                                    }
                                },
                            }}
                        />
                    )}
            </SMSBox>

            {selectedPost && (
                <SMSPostInformationModal
                    open={isModalOpen}
                    onClose={handleCloseModal}
                    isLoading={isDetailsLoading}
                    selectedPost={selectedPost}
                    requestData={requestData}
                    requesterData={requesterData}
                    postData={postData}
                    requestFiles={requestFiles}
                    showAvailablePositions={true}
                    extraActions={
                        readOnly ? undefined : selectedPost.isSpecialEvent === true ? (
                            <SMSSpecialEventApplyAction
                                post={selectedPost}
                                mode="button"
                                disabled={isDetailsLoading}
                                onSuccess={handleCloseModal}
                            />
                        ) : (
                            <SMSTakeShiftAction
                                post={selectedPost}
                                mode="button"
                                disabled={
                                    isDetailsLoading ||
                                    (!showWaitingPosts && (selectedPost.availablePositions ?? 0) === 0)
                                }
                                onSuccess={handleCloseModal}
                            />
                        )
                    }
                    specialEventMode={selectedPost.isSpecialEvent === true}
                    specialEventJobDetailsMessage={specialEventJobDetailsMessage}
                    latestPostNoteFromDetails={latestPostNoteFromDetails}
                    onDownloadFile={async (file) => {
                        try {
                            const requesterId =
                                requestData?.requesterID?.trim() ||
                                selectedPost?.requesterID?.trim();
                            if (!requesterId) return;
                            await downloadRequestFile(
                                requesterId,
                                selectedPost.requestID,
                                file.fileUploadedId,
                                file.fileName
                            );
                        } catch (err) {
                            dispatch(showToast(AVAILABLE_POST.DETAILS.ERROR_DOWNLOAD, 'error'));
                        }
                    }}
                    extraContent={detailModalEquipmentExtra}
                />
            )}

            {/* Confirmation Dialog for Time Conflict */}
            <SMSConfirmDialog
                open={confirmationDialog.isOpen}
                onClose={handleCancelConflict}
                title={AVAILABLE_POST.DETAILS.CONFLICT.TITLE}
                message={confirmationDialog.message}
                confirmText={AVAILABLE_POST.DETAILS.CONFLICT.CONFIRM}
                cancelText={AVAILABLE_POST.DETAILS.CONFLICT.CANCEL}
                onConfirm={handleConfirmConflict}
                variant="warning"
            />

            <SMSRosterModal
                isOpen={isSpecialEventRosterOpen}
                onClose={() => setIsSpecialEventRosterOpen(false)}
                requestID={specialEventRosterRequestId}
                dateOfWork={specialEventRosterDate}
                draftMode
                disableCallSignUpdate
                disablePrint
                hideSearchSection
            />
        </SMSBox>
    );
};

export default SMSAvailablePostList;
