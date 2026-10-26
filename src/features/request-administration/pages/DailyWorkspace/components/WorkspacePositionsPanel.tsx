import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Skeleton } from '@mui/material';
import {
  SMSBox,
  SMSButton,
  SMSDropdown,
  SMSIcon,
  SMSIconButton,
  SMSPagination,
  SMSTypography,
  type SMSDropdownOption,
} from '@/components/smsatoms';
import { SMSConfirmDialog } from '@/components/smsmolecules';
import { DAILY_ADMINISTRATION, DAILY_WORKSPACE, POST_POSITION } from '@/constants/strings';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchAvailablePostCallSignsThunk } from '@/store/slices/postCallSignSlice';
import {
  swapPostPositionCallSignsThunk,
  updatePostPositionCallSignThunk,
} from '@/store/slices/postPositionSlice';
import { showToast } from '@/store/slices/toastSlice';
import type { PostCallSign } from '@/types/postCallSign';
import { POST_POSITION_POST_CALL_SIGN_ID_FIELD_NAME, POST_POSITION_CALL_SIGN_FIELD_NAME, isDefineCallSignEnabled } from '@/types/postPosition';
import { availablePostCallSignCacheKey } from '@/types/postCallSign';
import type { PostInRequestListDto, PostPositionInRequestListDto } from '@/types/request';
import { formatDateShort } from '@/utils';
import { extractYyyyMmDdPrefix } from '@/utils/dateTimeUtils';
import { PostPositionStatus } from '@/types/postPosition';
import { renderPostPositionStatusPill, renderLabeledStatusPill } from '@/utils/postPositionStatusPill';
import { WorkspaceIconButton } from './WorkspaceIconButton';

export type PositionsPaging = { page: number; pageSize: number };

export interface WorkspacePositionsGroupData {
  post: PostInRequestListDto;
  rows: PostPositionInRequestListDto[];
  totalRecords: number;
}

export interface WorkspacePositionsPanelProps {
  groups: WorkspacePositionsGroupData[];
  loadingByPostId: Record<string, boolean>;
  collapsedPostIds: Set<string>;
  pagingByPostId: Record<string, PositionsPaging>;
  defaultPaging: PositionsPaging;
  postFilterDatesByPostId?: Record<string, string[]>;
  loadingPostCollectDatesByPost?: Record<string, boolean>;
  onOpenPostDateCalendar?: (postId: string, anchorEl: HTMLElement) => void;
  onEnsurePostCollectDates?: (postId: string) => void;
  onToggleCollapse: (postId: string) => void;
  onPageChange: (postId: string, page: number) => void;
  onPageSizeChange: (postId: string, pageSize: number) => void;
  onUnassign: (row: PostPositionInRequestListDto, postId: string) => void;
  onTransfer: (row: PostPositionInRequestListDto, postId: string) => void;
  onMore: (el: HTMLElement, row: PostPositionInRequestListDto, postId: string) => void;
  /** Refresh positions for a post after call-sign edit/swap. */
  onPositionsRefresh?: (postId: string) => void;
  /** Per-post Assigned History mode (`isViewHistory` on by-post/filter). */
  viewHistoryByPostId?: Record<string, boolean>;
  onToggleViewHistory?: (postId: string) => void;
  positionMenuRowId?: string | null;
}

type SwapSelection = {
  postId: string;
  row: PostPositionInRequestListDto;
};

const canSwapCallSign = (row: PostPositionInRequestListDto): boolean =>
  row.status === PostPositionStatus.Assigned;

const getCallSignLabel = (row: PostPositionInRequestListDto): string => {
  const trimmed = (row.callSign ?? '').trim();
  return trimmed || POST_POSITION.CALL_SIGN.EMPTY_OPTION;
};

const readPostCallSignId = (row: PostPositionInRequestListDto): string =>
  String(row.postCallSignId ?? '').trim();

const resolvePostCallSignIdForRow = (
  row: PostPositionInRequestListDto,
  availableCallSigns: PostCallSign[]
): string => {
  const fromRow = readPostCallSignId(row);
  if (fromRow) return fromRow;
  const callSign = (row.callSign ?? '').trim();
  if (!callSign) return '';
  const match = availableCallSigns.find((item) => (item.callSign ?? '').trim() === callSign);
  return String(match?.postCallSignID ?? '').trim();
};

const isSameWorkDate = (
  left: PostPositionInRequestListDto,
  right: PostPositionInRequestListDto
): boolean =>
  (extractYyyyMmDdPrefix(left.dateOfWork) ?? '') === (extractYyyyMmDdPrefix(right.dateOfWork) ?? '');

function renderEmployeeTypeCell(row: PostPositionInRequestListDto): React.ReactNode {
  if (row.isPlaceholder === true) {
    return renderLabeledStatusPill(DAILY_ADMINISTRATION.PLACEHOLDER_EMPLOYEE_TYPE_LABEL, {
      bgcolor: 'grey.300',
      color: 'text.secondary',
      borderColor: 'grey.300',
    });
  }
  const employeeType = row.employeeType?.trim();
  return employeeType || '—';
}

export const WorkspacePositionsPanel: React.FC<WorkspacePositionsPanelProps> = ({
  groups,
  loadingByPostId,
  collapsedPostIds,
  pagingByPostId,
  defaultPaging,
  postFilterDatesByPostId = {},
  loadingPostCollectDatesByPost = {},
  onOpenPostDateCalendar,
  onEnsurePostCollectDates,
  onToggleCollapse,
  onPageChange,
  onPageSizeChange,
  onUnassign,
  onTransfer,
  onMore,
  onPositionsRefresh,
  viewHistoryByPostId = {},
  onToggleViewHistory,
  positionMenuRowId = null,
}) => {
  const dispatch = useAppDispatch();
  const [editingCallSignId, setEditingCallSignId] = useState<string | null>(null);
  const [editingCallSignPostId, setEditingCallSignPostId] = useState<string>('');
  const [editingCallSignValue, setEditingCallSignValue] = useState<string>('');
  const editingCallSignValueRef = useRef('');
  const editStartTimeRef = useRef(0);
  const [isSavingCallSign, setIsSavingCallSign] = useState(false);
  const [swapSource, setSwapSource] = useState<SwapSelection | null>(null);
  const [swapTarget, setSwapTarget] = useState<SwapSelection | null>(null);

  const isSwappingCallSigns = useAppSelector((state) => state.postPosition.isSwappingCallSigns);

  const editingCallSignRow = useMemo(() => {
    if (!editingCallSignId) return null;
    for (const group of groups) {
      const row = group.rows.find((r) => r.postPositionId === editingCallSignId);
      if (row) return row;
    }
    return null;
  }, [groups, editingCallSignId]);

  const editingCallSignDateOfWork = extractYyyyMmDdPrefix(editingCallSignRow?.dateOfWork) ?? '';
  const availableCallSignsCacheKey =
    editingCallSignId && editingCallSignPostId && editingCallSignDateOfWork
      ? availablePostCallSignCacheKey(editingCallSignPostId, editingCallSignDateOfWork)
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

  useEffect(() => {
    if (!editingCallSignId || !editingCallSignRow) return;
    const isDefineCallSign = isDefineCallSignEnabled(editingCallSignRow, groups.find((g) => g.post.postId === editingCallSignPostId)?.post);
    if (!isDefineCallSign) return;
    const resolvedId = resolvePostCallSignIdForRow(editingCallSignRow, availableCallSigns);
    if (!resolvedId || editingCallSignValueRef.current === resolvedId) return;
    if (!editingCallSignValueRef.current || editingCallSignValueRef.current === editingCallSignValue) {
      editingCallSignValueRef.current = resolvedId;
      setEditingCallSignValue(resolvedId);
    }
  }, [availableCallSigns, editingCallSignId, editingCallSignPostId, editingCallSignRow, editingCallSignValue, groups]);

  const cancelEditCallSign = useCallback(() => {
    editingCallSignValueRef.current = '';
    setEditingCallSignId(null);
    setEditingCallSignPostId('');
    setEditingCallSignValue('');
  }, []);

  const cancelSwapCallSign = useCallback(() => {
    setSwapSource(null);
    setSwapTarget(null);
  }, []);

  useEffect(() => {
    if (!swapSource || swapTarget) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        cancelSwapCallSign();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cancelSwapCallSign, swapSource, swapTarget]);

  const startEditCallSign = useCallback(
    (row: PostPositionInRequestListDto, postId: string) => {
      editStartTimeRef.current = Date.now();
      setSwapSource(null);
      setSwapTarget(null);
      const isDefineCallSign = isDefineCallSignEnabled(row, groups.find((g) => g.post.postId === postId)?.post);
      const initialVal = isDefineCallSign ? readPostCallSignId(row) : (row.callSign ?? '');
      editingCallSignValueRef.current = initialVal;
      setEditingCallSignId(row.postPositionId);
      setEditingCallSignPostId(postId);
      setEditingCallSignValue(initialVal);
      if (isDefineCallSign) {
        const workDate = extractYyyyMmDdPrefix(row.dateOfWork) ?? '';
        if (postId && workDate) {
          void dispatch(
            fetchAvailablePostCallSignsThunk({
              postId,
              dateOfWork: workDate,
            })
          );
        }
      }
    },
    [dispatch, groups]
  );

  const tryCommitCallSign = useCallback(
    async (row: PostPositionInRequestListDto, postId: string, rawValue: string, isDefineCallSign: boolean = true) => {
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
        await dispatch(
          updatePostPositionCallSignThunk({
            postPositionId: row.postPositionId,
            fieldValue: trimmedVal || '',
            fieldName,
          })
        ).unwrap();
        setEditingCallSignId((currentId) => {
          if (currentId === row.postPositionId) {
            setEditingCallSignValue('');
            setEditingCallSignPostId('');
            return null;
          }
          return currentId;
        });
        onPositionsRefresh?.(postId);
      } catch (error) {
        console.error('Failed to update call sign:', error);
      } finally {
        setIsSavingCallSign(false);
      }
    },
    [
      availableCallSigns,
      cancelEditCallSign,
      dispatch,
      editingCallSignId,
      isSavingCallSign,
      onPositionsRefresh,
    ]
  );

  const handleSwapCallSignClick = useCallback(
    (row: PostPositionInRequestListDto, postId: string, event: React.MouseEvent<HTMLElement>) => {
      event.stopPropagation();
      if (isSwappingCallSigns || isSavingCallSign || editingCallSignId) return;
      if (!canSwapCallSign(row)) return;

      if (!swapSource) {
        setSwapSource({ postId, row });
        return;
      }

      if (swapSource.row.postPositionId === row.postPositionId) {
        cancelSwapCallSign();
      }
    },
    [
      cancelSwapCallSign,
      editingCallSignId,
      isSavingCallSign,
      isSwappingCallSigns,
      swapSource,
    ]
  );

  const handleSwapTargetRowClick = useCallback(
    (
      row: PostPositionInRequestListDto,
      postId: string,
      event: React.MouseEvent<HTMLTableRowElement>
    ) => {
      if (!swapSource || isSwappingCallSigns || isSavingCallSign || editingCallSignId) {
        return;
      }

      const target = event.target as HTMLElement;
      if (target.closest('button, a, input, select, textarea, [role="menuitem"]')) {
        return;
      }

      const sourceId = swapSource.row.postPositionId;
      const targetId = row.postPositionId;
      if (!sourceId || !targetId || sourceId === targetId) return;
      if (swapSource.postId !== postId) return;
      if (!canSwapCallSign(row)) return;

      if (!isSameWorkDate(swapSource.row, row)) {
        dispatch(showToast(POST_POSITION.CALL_SIGN.SWAP_SAME_DATE_REQUIRED, 'warning'));
        return;
      }

      setSwapTarget({ postId, row });
    },
    [
      dispatch,
      editingCallSignId,
      isSavingCallSign,
      isSwappingCallSigns,
      swapSource,
    ]
  );

  const handleConfirmSwapCallSign = useCallback(async () => {
    const id1 = swapSource?.row.postPositionId?.trim();
    const id2 = swapTarget?.row.postPositionId?.trim();
    const postId = swapSource?.postId;
    if (!id1 || !id2 || !postId) return;

    try {
      await dispatch(
        swapPostPositionCallSignsThunk({
          postPositionId1: id1,
          postPositionId2: id2,
        })
      ).unwrap();
      cancelSwapCallSign();
      onPositionsRefresh?.(postId);
    } catch {
      // Toast handled in slice
    }
  }, [cancelSwapCallSign, dispatch, onPositionsRefresh, swapSource, swapTarget]);

  const getSwapRowClassName = useCallback(
    (row: PostPositionInRequestListDto, postId: string): string | undefined => {
      if (!swapSource) return undefined;
      const rowId = row.postPositionId;
      const sourceId = swapSource.row.postPositionId;
      if (rowId && sourceId && rowId === sourceId) {
        return 'daily-workspace__row--swap-source';
      }
      if (
        swapSource.postId === postId &&
        canSwapCallSign(row) &&
        isSameWorkDate(swapSource.row, row) &&
        rowId !== sourceId
      ) {
        return 'daily-workspace__row--swap-target';
      }
      if (swapSource.postId !== postId || !isSameWorkDate(swapSource.row, row)) {
        return 'daily-workspace__row--swap-disabled';
      }
      return undefined;
    },
    [swapSource]
  );

  const swapConfirmMessage = useMemo(() => {
    if (!swapSource || !swapTarget) return '';
    return POST_POSITION.CALL_SIGN.SWAP_CONFIRM_MESSAGE.replace(
      '{callSign1}',
      getCallSignLabel(swapSource.row)
    )
      .replace('{employee1}', swapSource.row.employeeName?.trim() || '—')
      .replace('{callSign2}', getCallSignLabel(swapTarget.row))
      .replace('{employee2}', swapTarget.row.employeeName?.trim() || '—');
  }, [swapSource, swapTarget]);

  const renderCallSignCell = (row: PostPositionInRequestListDto, postId: string) => {
    const isEditing = editingCallSignId === row.postPositionId;

    if (isEditing) {
      const isDefineCallSign = isDefineCallSignEnabled(row, groups.find((g) => g.post.postId === postId)?.post);
      if (isDefineCallSign) {
        return (
          <SMSDropdown
            size="small"
            value={editingCallSignValue}
            options={callSignDropdownOptions}
            onChange={(e) => {
              const next = String(e.target.value);
              editingCallSignValueRef.current = next;
              setEditingCallSignValue(next);
            }}
            onClose={() => {
              if (isSavingCallSign || editingCallSignId !== row.postPositionId) return;
              void tryCommitCallSign(row, postId, editingCallSignValueRef.current, true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                cancelEditCallSign();
              }
            }}
            disabled={isSavingCallSign || isLoadingAvailableCallSigns}
            searchable={false}
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
            editingCallSignValueRef.current = next;
            setEditingCallSignValue(next);
          }}
          onBlur={() => {
            if (Date.now() - editStartTimeRef.current < 300) return;
            if (isSavingCallSign || editingCallSignId !== row.postPositionId) return;
            void tryCommitCallSign(row, postId, editingCallSignValueRef.current, false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void tryCommitCallSign(row, postId, editingCallSignValueRef.current, false);
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
    const isSwapSource = swapSource?.row.postPositionId === row.postPositionId;
    const showSwapButton =
      canSwapCallSign(row) && (!swapSource || isSwapSource);
    const isSwapSelectionActive = Boolean(swapSource);
    const showEditCallSignButton = !isSwapSelectionActive;
    const isEditDisabled =
      isSwappingCallSigns ||
      isSavingCallSign ||
      (editingCallSignId != null && editingCallSignId !== row.postPositionId);

    return (
      <SMSBox
        className={[
          'daily-workspace__call-sign-cell',
          isSwapSource ? 'daily-workspace__call-sign-cell--swap-active' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <span className="daily-workspace__call-sign-display">{displayValue}</span>
        {(showSwapButton || showEditCallSignButton) && (
          <SMSBox className="daily-workspace__call-sign-actions">
            {showSwapButton && (
              <SMSIconButton
                tone="primary"
                variant="plain"
                size="small"
                className={[
                  'daily-workspace__call-sign-swap',
                  isSwapSource ? 'daily-workspace__call-sign-swap--active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                disabled={isSwappingCallSigns || isSavingCallSign || Boolean(editingCallSignId)}
                onClick={(event) => handleSwapCallSignClick(row, postId, event)}
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
                className="daily-workspace__call-sign-edit"
                disabled={isEditDisabled}
                onClick={(event) => {
                  event.stopPropagation();
                  startEditCallSign(row, postId);
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
  };

  return (
    <SMSBox className="daily-workspace__positions-stack">
      {groups.map(({ post, rows, totalRecords }) => {
        const postId = post.postId ?? '';
        const postLoading = Boolean(postId && loadingByPostId[postId]);
        const isGroupCollapsed = Boolean(postId && collapsedPostIds.has(postId));
        const paging = postId ? pagingByPostId[postId] ?? defaultPaging : defaultPaging;
        const tableRows = rows;
        const showSwapToolbar =
          Boolean(swapSource && !swapTarget && swapSource.postId === postId);

        return (
          <SMSBox
            key={postId || post.postTitle}
            className={`daily-workspace__positions-group${isGroupCollapsed ? ' is-collapsed' : ''}`}
          >
            <SMSBox
              className="daily-workspace__positions-group-header"
              role={isGroupCollapsed ? 'button' : undefined}
              tabIndex={isGroupCollapsed ? 0 : undefined}
              onClick={
                isGroupCollapsed ? () => onToggleCollapse(postId) : undefined
              }
              onKeyDown={
                isGroupCollapsed
                  ? (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onToggleCollapse(postId);
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
                  onToggleCollapse(postId);
                }}
              >
                <SMSIcon
                  name={isGroupCollapsed ? 'chevron-right' : 'expand_more'}
                  size="sm"
                />
              </WorkspaceIconButton>
              <h3 className="daily-workspace__positions-group-title">
                {post.postTitle || DAILY_WORKSPACE.SELECT_POST}
              </h3>
              <SMSBox className="daily-workspace__positions-group-tools">
                {postId && onOpenPostDateCalendar && (
                  <button
                    type="button"
                    className="daily-workspace__date-picker-trigger"
                    aria-haspopup="dialog"
                    aria-label={DAILY_ADMINISTRATION.OPEN_POSITION_DATES}
                    title={DAILY_ADMINISTRATION.OPEN_POSITION_DATES}
                    disabled={loadingPostCollectDatesByPost[postId] === true}
                    onClick={(event) => {
                      event.stopPropagation();
                      onEnsurePostCollectDates?.(postId);
                      onOpenPostDateCalendar(postId, event.currentTarget);
                    }}
                  >
                    <SMSIcon name="calendar" size="sm" />
                    {(postFilterDatesByPostId[postId]?.length ?? 0) > 0 && (
                      <span className="daily-workspace__date-picker-badge">
                        {postFilterDatesByPostId[postId]!.length}
                      </span>
                    )}
                  </button>
                )}
                <span className="daily-workspace__positions-group-count">{totalRecords}</span>
              </SMSBox>
            </SMSBox>

            {!isGroupCollapsed && (
              <SMSBox className="daily-workspace__positions-group-body">
                {postLoading ? (
                  <Skeleton variant="rounded" height={120} />
                ) : rows.length === 0 ? (
                  <SMSBox className="daily-workspace__empty daily-workspace__empty--in-group">
                    {DAILY_WORKSPACE.NO_POSITIONS}
                  </SMSBox>
                ) : (
                  <>
                    {showSwapToolbar && (
                      <SMSBox className="daily-workspace__swap-toolbar">
                        <SMSTypography
                          variant="body2"
                          className="daily-workspace__swap-toolbar-text"
                        >
                          {POST_POSITION.CALL_SIGN.SWAP_SELECT_TARGET}
                        </SMSTypography>
                        <SMSButton
                          type="button"
                          variant="contained"
                          color="primary"
                          size="small"
                          className="daily-workspace__swap-cancel"
                          onClick={cancelSwapCallSign}
                          disabled={isSwappingCallSigns}
                        >
                          {POST_POSITION.CALL_SIGN.SWAP_CANCEL}
                        </SMSButton>
                      </SMSBox>
                    )}
                    <SMSBox className="daily-workspace__table-wrap">
                      <table className="daily-workspace__table">
                        <thead>
                          <tr>
                            <th className="daily-workspace__table-col--call-sign">
                              {DAILY_WORKSPACE.POSITION_TABLE.CALL_SIGN}
                            </th>
                            <th className="daily-workspace__table-col--employee-name">
                              {DAILY_WORKSPACE.POSITION_TABLE.EMPLOYEE_NAME}
                            </th>
                            <th className="daily-workspace__table-col--date">
                              {DAILY_WORKSPACE.POSITION_TABLE.DATE_OF_WORK}
                            </th>
                            <th className="daily-workspace__table-col--employee-type">
                              {DAILY_WORKSPACE.POSITION_TABLE.EMPLOYEE_TYPE}
                            </th>
                            <th className="daily-workspace__table-col--badge">
                              {DAILY_WORKSPACE.POSITION_TABLE.BADGE_NUMBER}
                            </th>
                            <th className="daily-workspace__table-col--phone">
                              {DAILY_WORKSPACE.POSITION_TABLE.PHONE}
                            </th>
                            <th className="daily-workspace__table-col--status">
                              <SMSBox className="daily-workspace__status-header">
                                <span>{DAILY_WORKSPACE.POSITION_TABLE.STATUS}</span>
                                {onToggleViewHistory ? (
                                  <SMSIconButton
                                    type="button"
                                    tone={viewHistoryByPostId[postId] ? 'primary' : 'default'}
                                    size="small"
                                    variant={viewHistoryByPostId[postId] ? 'outlined' : 'plain'}
                                    allowWhenSuspended
                                    className={
                                      viewHistoryByPostId[postId]
                                        ? 'daily-workspace__view-history-btn daily-workspace__view-history-btn--active'
                                        : 'daily-workspace__view-history-btn'
                                    }
                                    title={
                                      viewHistoryByPostId[postId]
                                        ? DAILY_ADMINISTRATION.HIDE_HISTORY
                                        : DAILY_ADMINISTRATION.VIEW_HISTORY
                                    }
                                    aria-label={
                                      viewHistoryByPostId[postId]
                                        ? DAILY_ADMINISTRATION.HIDE_HISTORY
                                        : DAILY_ADMINISTRATION.VIEW_HISTORY
                                    }
                                    aria-pressed={Boolean(viewHistoryByPostId[postId])}
                                    disabled={postLoading}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      onToggleViewHistory(postId);
                                    }}
                                  >
                                    <SMSIcon
                                      name={
                                        viewHistoryByPostId[postId]
                                          ? 'current_assigned'
                                          : 'assigned_history'
                                      }
                                      size="md"
                                    />
                                  </SMSIconButton>
                                ) : null}
                              </SMSBox>
                            </th>
                            <th className="daily-workspace__table-col--action">
                              {DAILY_WORKSPACE.POSITION_TABLE.ACTION}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {tableRows.map((row) => {
                            const swapRowClass = getSwapRowClassName(row, postId);
                            const employeeName = row.employeeName?.trim() || '—';
                            const isCancellationPending =
                              row.status === PostPositionStatus.CancellationPending;
                            const isAssigned = row.status === PostPositionStatus.Assigned;
                            return (
                              <tr
                                key={row.postPositionId}
                                className={swapRowClass}
                                onClick={
                                  swapSource
                                    ? (event) => handleSwapTargetRowClick(row, postId, event)
                                    : undefined
                                }
                              >
                                <td className="daily-workspace__table-col--call-sign">
                                  {renderCallSignCell(row, postId)}
                                </td>
                                <td className="daily-workspace__table-col--employee-name">
                                  <span
                                    className="daily-workspace__employee-name"
                                    title={employeeName}
                                  >
                                    {employeeName}
                                  </span>
                                </td>
                                <td className="daily-workspace__table-col--date">
                                  {row.dateOfWork ? formatDateShort(row.dateOfWork) : '—'}
                                </td>
                                <td className="daily-workspace__table-col--employee-type">
                                  {renderEmployeeTypeCell(row)}
                                </td>
                                <td className="daily-workspace__table-col--badge">
                                  {row.badgeNumber || '—'}
                                </td>
                                <td className="daily-workspace__table-col--phone">
                                  {row.phone || '—'}
                                </td>
                                <td className="daily-workspace__table-col--status">
                                  {renderPostPositionStatusPill(row.status, 'post-position', {
                                    layout: 'nowrap',
                                  })}
                                </td>
                                <td className="daily-workspace__table-col--action">
                                  <SMSBox className="daily-workspace__table-actions">
                                    <WorkspaceIconButton
                                      danger={!isCancellationPending}
                                      title={
                                        isCancellationPending
                                          ? POST_POSITION.ASSIGNMENTS_AND_WAITING
                                              .ACTION_APPROVE_CANCELLATION
                                          : DAILY_WORKSPACE.UNASSIGN
                                      }
                                      aria-label={
                                        isCancellationPending
                                          ? POST_POSITION.ASSIGNMENTS_AND_WAITING
                                              .ACTION_APPROVE_CANCELLATION
                                          : DAILY_WORKSPACE.UNASSIGN
                                      }
                                      onClick={() => onUnassign(row, postId)}
                                    >
                                      <SMSIcon
                                        name={
                                          isCancellationPending ? 'check_circle' : 'person_remove'
                                        }
                                        size="sm"
                                      />
                                    </WorkspaceIconButton>
                                    {isAssigned && (
                                      <>
                                        <WorkspaceIconButton
                                          title={DAILY_WORKSPACE.TRANSFER}
                                          onClick={() => onTransfer(row, postId)}
                                        >
                                          <SMSIcon name="swap_horiz" size="sm" />
                                        </WorkspaceIconButton>
                                        <WorkspaceIconButton
                                          title={DAILY_WORKSPACE.ACTIONS.MORE_POSITION}
                                          aria-haspopup="true"
                                          aria-expanded={
                                            positionMenuRowId === row.postPositionId
                                          }
                                          onClick={(e) => onMore(e.currentTarget, row, postId)}
                                        >
                                          <SMSIcon name="more_vert" size="sm" />
                                        </WorkspaceIconButton>
                                      </>
                                    )}
                                  </SMSBox>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </SMSBox>
                    {totalRecords > 0 && (
                      <SMSPagination
                        className="daily-workspace__positions-pagination sms-pagination"
                        variant="compact"
                        currentPage={paging.page}
                        pageSize={paging.pageSize}
                        totalItems={totalRecords}
                        loading={postLoading}
                        onPageChange={(page) => {
                          if (!postId) return;
                          onPageChange(postId, page);
                        }}
                        onPageSizeChange={(pageSize) => {
                          if (!postId) return;
                          onPageSizeChange(postId, pageSize);
                        }}
                      />
                    )}
                  </>
                )}
              </SMSBox>
            )}
          </SMSBox>
        );
      })}

      <SMSConfirmDialog
        open={Boolean(swapSource && swapTarget)}
        title={POST_POSITION.CALL_SIGN.SWAP_CONFIRM_TITLE}
        message={swapConfirmMessage}
        confirmText={POST_POSITION.CALL_SIGN.SWAP_ARIA_LABEL}
        cancelText={POST_POSITION.CALL_SIGN.SWAP_CANCEL}
        onConfirm={() => {
          void handleConfirmSwapCallSign();
        }}
        onClose={() => setSwapTarget(null)}
        variant="default"
        loading={isSwappingCallSigns}
      />
    </SMSBox>
  );
};
