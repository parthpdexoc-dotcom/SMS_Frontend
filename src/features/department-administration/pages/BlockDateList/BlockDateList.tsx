import { SMSButton, SMSIcon, SMSIconButton } from '@/components/smsatoms';
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SMSDataTableWrapper, SMSModal as Modal } from '@/components/smsorganisms';
import { SMSConfirmDialog } from '@/components/smsmolecules';
import { useDebounce } from '@/hooks/useDebounceSearch';
import { BLOCK_DATE } from '@/constants/strings';
import { BlockDateResponse, BlockDateListProps } from '@/types/blockDate';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchBlockDates, removeBlockDate, searchBlockDatesThunk, setPagination } from '@/store/slices/blockDateSlice';
import { fetchRequests } from '@/store/slices/requestSlice';
import { fetchPosts } from '@/store/slices/postSlice';
import { SMSBlockDateForm } from '@/components/smsmolecules/SMSBlockDateForm';
import { formatDateTime } from '@/utils';
import { resolveWorkspaceReturnPath } from '@/utils/dailyWorkspaceSessionState';
import './BlockDateList.css';

export type { BlockDateListProps } from '@/types/blockDate';

const isEndDatePassed = (endDateTime: string | null | undefined): boolean => {
  if (!endDateTime) return false;
  const d = new Date(endDateTime);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
};

type DisplayRow = {
  __raw: BlockDateResponse;
  short: string;
  long: string;
  requestID: string | null;
  postID: string | null;
};

const REQUESTER_LIST_PATH = '/personnel/requester/daily';

export const BlockDateList: React.FC<BlockDateListProps> = ({ className = '' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const { blockDates, isLoading, totalItems, currentPage, pageSize } = useAppSelector((state) => state.blockDate);
  const { requests } = useAppSelector((state) => state.request);
  const { postsByRequestId } = useAppSelector((state) => state.post);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<BlockDateResponse | null>(null);
  const [deletingRow, setDeletingRow] = useState<BlockDateResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 500);


  // When navigated from a specific post (via Daily Admin → Post → "Block Dates"),
  // we receive the parent request/post ids in location.state.
  // Use these values to scope the grid so it only shows block dates
  // for that particular post (or, as a fallback, the request).
  const { lockedRequestID, lockedPostID, returnPath } = useMemo(() => {
    const state = (location.state || {}) as {
      requestId?: string;
      postId?: string;
      returnPath?: string;
      requesterId?: string;
    } | null;
    const workspaceReturn = resolveWorkspaceReturnPath(state);
    return {
      lockedRequestID: state?.requestId ?? null,
      lockedPostID: state?.postId ?? null,
      returnPath: workspaceReturn ?? state?.returnPath?.trim() ?? REQUESTER_LIST_PATH,
    };
  }, [location.state]);

  // Build common pagination parameters for API calls
  const paginationParams = useMemo(() => ({
    postId: lockedPostID || undefined,
    page: currentPage,
    pageSize
  }), [lockedPostID, currentPage, pageSize]);

  // Load block dates and lookup data with explicit pagination
  const refetchBlockDates = useMemo(
    () => () => {
      const searchTerm = debouncedSearchQuery.trim();
      if (searchTerm) {
        dispatch(searchBlockDatesThunk({ 
          ...paginationParams,
          searchTerm 
        }));
      } else {
        dispatch(fetchBlockDates(paginationParams));
      }
    },
    [dispatch, debouncedSearchQuery, paginationParams]
  );

  useEffect(() => {
    refetchBlockDates();
    dispatch(fetchRequests({ page: 1, pageSize: 1000 }));
  }, [dispatch, refetchBlockDates]);

  // Since we're now using server-side pagination, we don't need client-side filtering
  // The server will handle filtering by postId when provided
  const tableRows = useMemo<DisplayRow[]>(() => {
    return blockDates.map((r) => ({
      __raw: r,
      short: formatDateTime(r.startDateTime, '-'),
      long: formatDateTime(r.endDateTime, '-'),
      requestID: r.requestID ?? null,
      postID: r.postID ?? null,
    }));
  }, [blockDates]);

  const handlePageChange = (page: number) => {
    dispatch(setPagination({ page }));
  };

  const handlePageSizeChange = (newPageSize: number) => {
    dispatch(setPagination({ pageSize: newPageSize, page: 1 }));
  };

  useEffect(() => {
    if (debouncedSearchQuery) {
      // Reset to first page when searching
      dispatch(setPagination({ page: 1 }));
    }
  }, [debouncedSearchQuery, dispatch]);

  // Load posts for each request that appears in block dates so postMap has post titles on load
  useEffect(() => {
    const requestIds = [...new Set(blockDates.map((b) => b.requestID).filter(Boolean))] as string[];
    requestIds.forEach((requestID) => {
      if (!postsByRequestId?.[requestID]) {
        dispatch(fetchPosts({ requestID, page: 1, pageSize: 1000 }));
      }
    });
  }, [dispatch, blockDates, postsByRequestId]);

  const requestMap = useMemo(() => {
    const map = new Map<string, string>();
    requests.forEach((r) => map.set(r.requestID, r.title || r.requestID));
    return map;
  }, [requests]);

  const allPosts = useMemo(() => {
    const map = postsByRequestId || {};
    return Object.values(map).flat();
  }, [postsByRequestId]);

  const postMap = useMemo(() => {
    const map = new Map<string, string>();
    allPosts.forEach((p) => {
      const id = p.postId ?? '';
      if (id) map.set(id, p.postTitle || id);
    });
    return map;
  }, [allPosts]);


  const tableColumns = useMemo(
    () => [
      {
        key: 'requestID',
        label: BLOCK_DATE.TABLE.COLUMNS.REQUEST,
        render: (value: string | null) => (value ? requestMap.get(value) ?? value : '-'),
      },
      {
        key: 'postID',
        label: BLOCK_DATE.TABLE.COLUMNS.POST,
        render: (value: string | null) => (value ? postMap.get(value) ?? value : '-'),
      },
      {
        key: 'short',
        label: BLOCK_DATE.TABLE.COLUMNS.TITLE,
        render: (value: unknown) => String(value ?? '-'),
      },
      {
        key: 'long',
        label: BLOCK_DATE.TABLE.COLUMNS.DESCRIPTION,
        render: (value: unknown) => String(value ?? '-'),
      },
      {
        key: 'action',
        label: BLOCK_DATE.TABLE.COLUMNS.ACTION,
        render: (_value: unknown, row: DisplayRow) => {
          if (isEndDatePassed(row.__raw.endDateTime)) {
            return null;
          }
          return (
            <div className="block-date-list__actions">
              <SMSIconButton
                size="small"
                tone="primary"
                onClick={() => {
                  setEditingRow(row.__raw);
                  setIsModalOpen(true);
                }}
                className="block-date-list__edit-button"
                title={BLOCK_DATE.BUTTON.EDIT}
                aria-label={BLOCK_DATE.BUTTON.EDIT}
              >
                <SMSIcon name="edit" size="sm" />
              </SMSIconButton>
              <SMSButton color="error"
                onClick={() => setDeletingRow(row.__raw)}
                className="block-date-list__delete-button"
                title={BLOCK_DATE.BUTTON.DELETE}
                aria-label={BLOCK_DATE.BUTTON.DELETE}
              >
                <SMSIcon name="delete" size="sm" />
              </SMSButton>
            </div>
          );
        },
      },
    ],
    [requestMap, postMap]
  );

  const handleAddClick = () => {
    setEditingRow(null);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingRow(null);
  };

  const handleFormSuccess = (_data: BlockDateResponse) => {
    refetchBlockDates();
    setIsModalOpen(false);
    setEditingRow(null);
  };

  // Create initial data for form when navigating from a post with request/post IDs
  const getInitialFormData = (): BlockDateResponse | null => {
    if (editingRow) {
      return editingRow;
    }
    // If we have locked request/post IDs from navigation, pre-fill the form
    if (lockedRequestID || lockedPostID) {
      return {
        blockDateId: '', // Empty string so it's not treated as edit mode (Boolean('') === false)
        requestID: lockedRequestID || null,
        postID: lockedPostID || null,
        startDateTime: '', // Empty strings for dates - form will handle this
        endDateTime: '',
        createdDate: null,
        createdUserID: null,
        createdBy: null,
        editedDate: null,
        editedUserID: null,
        editedBy: null,
      };
    }
    return null;
  };

  const handleDeleteConfirm = async () => {
    if (!deletingRow) return;
    try {
      await dispatch(removeBlockDate(deletingRow.blockDateId)).unwrap();
      setDeletingRow(null);
      refetchBlockDates();
    } catch (error) {
      console.error('Error deleting block date:', error);
      // Error shown via toast from slice
    }
  };

  const handleDeleteCancel = () => setDeletingRow(null);

  return (
    <div className={`block-date-list ${className}`}>
      <div className="block-date-list__header">
        <button
          type="button"
          onClick={() => navigate(returnPath)}
          className="form-page__back-button"
          aria-label="Back to Requester List"
        >
          <SMSIcon name="arrowLeft" size="md" />
        </button>
        <h1 className="block-date-list__title">{BLOCK_DATE.TABLE.TITLE}</h1>
        <SMSButton
          onClick={handleAddClick}
          className="block-date-list__add-button"
        >
          <SMSIcon name="plus" size="sm" />
          {BLOCK_DATE.BUTTON.ADD_NEW}
        </SMSButton>
      </div>

      <SMSDataTableWrapper<DisplayRow>
        columns={tableColumns}
        data={tableRows}
        emptyMessage={BLOCK_DATE.TABLE.NO_DATA}
        loading={isLoading}
        showHeaderWhenEmpty={true}
        renderEmptyAsTable
        tableClassName="block-date-list__table"
        searchable={true}
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchAppliedOnServer
        searchableColumns={['requestID', 'postID', 'short', 'long']}
        maxBodyHeight="max(320px, calc(100vh - 360px))"
        pagination={{
          currentPage,
          pageSize,
          totalItems,
          onPageChange: handlePageChange,
          onPageSizeChange: handlePageSizeChange,
        }}
      />

      <Modal
        open={isModalOpen}
        onClose={handleModalClose}
        title={editingRow ? BLOCK_DATE.EDIT_TITLE : BLOCK_DATE.TITLE}
        size="large"
      >
        <SMSBlockDateForm
          initialData={getInitialFormData()}
          onSuccess={handleFormSuccess}
          onCancel={handleModalClose}
          disableRequest={!!lockedRequestID}
          disablePost={!!lockedPostID}
        />
      </Modal>

      <SMSConfirmDialog
        open={!!deletingRow}
        title={BLOCK_DATE.CONFIRM.DELETE_TITLE}
        message={BLOCK_DATE.CONFIRM.DELETE_MESSAGE}
        confirmText={BLOCK_DATE.CONFIRM.DELETE_CONFIRM}
        cancelText={BLOCK_DATE.CONFIRM.DELETE_CANCEL}
        onConfirm={handleDeleteConfirm}
        onClose={handleDeleteCancel}
        variant="error"
        loading={isLoading}
      />
    </div>
  );
};
