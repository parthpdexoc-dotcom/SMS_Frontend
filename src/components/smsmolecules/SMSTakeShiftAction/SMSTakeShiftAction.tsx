import React, { useCallback, useState } from 'react';
import { SMSButton, SMSIcon, SMSIconButton } from '@/components/smsatoms';
import { SMSConfirmDialog } from '@/components/smsmolecules';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  applySpecialEventRequestThunk,
  assignPostToMeThunk,
  fetchAvailablePosts,
  fetchWaitingListPosts,
} from '@/store/slices/availablePostSlice';
import { upsertWaitingPostPositionThunk } from '@/store/slices/tenureWaitingPositionSlice';
import { AVAILABLE_POST } from '@/constants/strings';
import { ReleaseAs } from '@/types/request';
import type { EmployeePostListingItem } from '@/types/employeePostListingItem';
import { isSuspendedEmployeeActive } from '@/utils';

type TakeShiftMode = 'icon' | 'button';

export interface SMSTakeShiftActionProps {
  post: EmployeePostListingItem;
  mode: TakeShiftMode;
  disabled?: boolean;
  /**
   * Called after a successful assign, after the list refresh has been dispatched.
   * Use this to close modals, etc.
   */
  onSuccess?: () => void;
}

type AssignRejectError = {
  status: number;
  message?: string;
  requiresConfirmation?: boolean;
  requiresAvailablePostRetry?: boolean;
};

export const SMSTakeShiftAction: React.FC<SMSTakeShiftActionProps> = ({ post, mode, disabled, onSuccess }) => {
  const dispatch = useAppDispatch();
  const { searchModel, showWaitingPosts, listPage, listPageSize, waitingListPage, waitingListPageSize } =
    useAppSelector((s) => s.availablePost);
  const releaseAs = Number(searchModel.releaseAs) as ReleaseAs;
  const user = useAppSelector((s) => s.auth.user);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [conflictMessage, setConflictMessage] = useState<string>(AVAILABLE_POST.DETAILS.CONFLICT.MESSAGE_DEFAULT);
  const [cancelledFallbackOpen, setCancelledFallbackOpen] = useState(false);
  const [cancelledFallbackMessage, setCancelledFallbackMessage] = useState<string>(
    AVAILABLE_POST.DETAILS.CANCELLED_SLOT_FALLBACK.MESSAGE_DEFAULT
  );
  const [submitting, setSubmitting] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [resultVariant, setResultVariant] = useState<'success' | 'error'>('success');
  const [resultMessage, setResultMessage] = useState<string>('');
  const [refreshOnOk, setRefreshOnOk] = useState(false);

  const effectiveDisabled = disabled || submitting || isSuspendedEmployeeActive(user);
  const isSpecialEvent = post.isSpecialEvent === true;
  /** Tenure-based available list (not special event): same label as waiting-list apply, not "Take Job". */
  const showApplyInWaitingLabel =
    !isSpecialEvent && (showWaitingPosts || releaseAs === ReleaseAs.TenureBased);
  /** Tenure Based + Available Job list (not Waiting Jobs view): "normal" rows use Express Interest, not Apply In Waiting. */
  const useExpressInterestLabel =
    showApplyInWaitingLabel && !showWaitingPosts && releaseAs === ReleaseAs.TenureBased;
  /** In sync with the apply-in-waiting button: express-interest flow vs legacy copy (never mix title and message from different flows). */
  const applyInWaitingOrExpressConfirm = useExpressInterestLabel
    ? AVAILABLE_POST.DETAILS.EXPRESS_INTEREST_CONFIRM
    : AVAILABLE_POST.DETAILS.APPLY_IN_WAITING_CONFIRM;
  const actionIconName = isSpecialEvent
    ? 'event'
    : showApplyInWaitingLabel
      ? 'hourglass_top'
      : 'check_circle';

  const refreshList = useCallback(() => {
    if (showWaitingPosts) {
      dispatch(
        fetchWaitingListPosts({
          searchModel,
          pagination: { page: waitingListPage, pageSize: waitingListPageSize },
        })
      );
      return;
    }

    dispatch(
      fetchAvailablePosts({
        searchModel,
        pagination: { page: listPage, pageSize: listPageSize },
      })
    );
  }, [dispatch, searchModel, showWaitingPosts, listPage, listPageSize, waitingListPage, waitingListPageSize]);

  const doAssign = useCallback(
    async (opts?: { confirmConflict?: boolean; omitPostPositionId?: boolean }) => {
      const confirmConflict = opts?.confirmConflict ?? false;
      const omitPostPositionId = opts?.omitPostPositionId ?? false;
      setSubmitting(true);
      try {
        if (isSpecialEvent) {
          const res = await dispatch(
            applySpecialEventRequestThunk({
              requestID: post.requestID,
              dateOfWork: post.startDate,
              suppressToast: true,
            })
          ).unwrap();
          setResultVariant('success');
          setResultMessage(
            res?.message || AVAILABLE_POST.DETAILS.SPECIAL_EVENT_REQUEST.RESULT_DEFAULT_SUCCESS
          );
        } else if (showWaitingPosts) {
          const res = await dispatch(
            upsertWaitingPostPositionThunk({
              postID: post.postID,
              dateOfWork: post.startDate,
              releaseAs: searchModel.releaseAs,
              confirmConflict,
              suppressToast: true,
            })
          ).unwrap();
          setResultVariant('success');
          setResultMessage(res?.message || AVAILABLE_POST.DETAILS.TAKE_POST_CONFIRM.RESULT.DEFAULT_SUCCESS_MESSAGE);
        } else {
          const res = await dispatch(
            assignPostToMeThunk({
              postID: post.postID,
              dateOfWork: post.startDate,
              startDate: post.startDate,
              releaseAs: searchModel.releaseAs,
              confirmConflict,
              suppressToast: true,
              postPositionId: post.postPositionId?.trim() ?? undefined,
              omitPostPositionId,
            })
          ).unwrap();
          setResultVariant('success');
          setResultMessage(res?.message || AVAILABLE_POST.DETAILS.TAKE_POST_CONFIRM.RESULT.DEFAULT_SUCCESS_MESSAGE);
        }

        setConfirmOpen(false);
        setConflictOpen(false);
        setCancelledFallbackOpen(false);
        setRefreshOnOk(true);
        setResultOpen(true);
      } catch (e: unknown) {
        const err = e as AssignRejectError;
        if (err?.status === 409 && err?.requiresConfirmation) {
          setConflictMessage(err.message || AVAILABLE_POST.DETAILS.CONFLICT.MESSAGE_DEFAULT);
          setConfirmOpen(false);
          setConflictOpen(true);
          setCancelledFallbackOpen(false);
        } else if (!isSpecialEvent && !showWaitingPosts && Number(err?.status) === 422 && err?.requiresAvailablePostRetry) {
          setCancelledFallbackMessage(
            err.message || AVAILABLE_POST.DETAILS.CANCELLED_SLOT_FALLBACK.MESSAGE_DEFAULT
          );
          setConfirmOpen(false);
          setConflictOpen(false);
          setCancelledFallbackOpen(true);
        } else {
          setResultVariant('error');
          const anyE = e as { message?: string };
          setResultMessage(
            err?.message ||
              (anyE?.message ? String(anyE.message) : '') ||
              (isSpecialEvent
                ? AVAILABLE_POST.DETAILS.SPECIAL_EVENT_REQUEST.RESULT_DEFAULT_ERROR
                : AVAILABLE_POST.DETAILS.TAKE_POST_CONFIRM.RESULT.DEFAULT_ERROR_MESSAGE)
          );
          setRefreshOnOk(false);
          setResultOpen(true);
          setConfirmOpen(false);
          setConflictOpen(false);
          setCancelledFallbackOpen(false);
        }
      } finally {
        setSubmitting(false);
      }
    },
    [
      dispatch,
      isSpecialEvent,
      post.startDate,
      post.postID,
      post.postPositionId,
      post.requestID,
      refreshList,
      searchModel.releaseAs,
      showWaitingPosts,
    ]
  );

  const openConfirm = () => setConfirmOpen(true);

  return (
    <>
      {mode === 'icon' ? (
        <SMSIconButton
          size="small"
          aria-label={
            isSpecialEvent
              ? AVAILABLE_POST.DETAILS.SPECIAL_EVENT_REQUEST.ICON_ARIA
              : AVAILABLE_POST.LIST.ICON_ACTIONS.APPLY_ARIA
          }
          onClick={openConfirm}
          disabled={effectiveDisabled}
          sx={{
            borderRadius: 1,
            color: isSpecialEvent ? 'secondary.main' : showApplyInWaitingLabel ? 'warning.main' : 'success.main',
          }}
        >
          <SMSIcon name={actionIconName} size="sm" />
        </SMSIconButton>
      ) : (
        <SMSButton
          onClick={openConfirm}
          disabled={effectiveDisabled}
          endIcon={!submitting ? <SMSIcon name={actionIconName} size="sm" /> : undefined}
        >
          {submitting
            ? AVAILABLE_POST.DETAILS.BUTTONS.APPLYING
            : isSpecialEvent
              ? AVAILABLE_POST.DETAILS.SPECIAL_EVENT_REQUEST.BUTTON
              : showApplyInWaitingLabel
                ? useExpressInterestLabel
                  ? AVAILABLE_POST.CARD.EXPRESS_INTEREST_BUTTON
                  : AVAILABLE_POST.CARD.APPLY_BUTTON
                : AVAILABLE_POST.DETAILS.BUTTONS.TAKE_POST}
        </SMSButton>
      )}

      <SMSConfirmDialog
        open={confirmOpen}
        onClose={() => (submitting ? undefined : setConfirmOpen(false))}
        title={
          isSpecialEvent
            ? AVAILABLE_POST.DETAILS.SPECIAL_EVENT_REQUEST.CONFIRM_TITLE
            : showApplyInWaitingLabel
              ? applyInWaitingOrExpressConfirm.TITLE
              : AVAILABLE_POST.DETAILS.TAKE_POST_CONFIRM.TITLE
        }
        message={
          isSpecialEvent
            ? AVAILABLE_POST.DETAILS.SPECIAL_EVENT_REQUEST.CONFIRM_MESSAGE
            : showApplyInWaitingLabel
              ? applyInWaitingOrExpressConfirm.MESSAGE
              : AVAILABLE_POST.DETAILS.TAKE_POST_CONFIRM.MESSAGE
        }
        confirmText={AVAILABLE_POST.DETAILS.TAKE_POST_CONFIRM.CONFIRM}
        cancelText={AVAILABLE_POST.DETAILS.TAKE_POST_CONFIRM.CANCEL}
        onConfirm={() => void doAssign()}
        variant="info"
        loading={submitting}
        loadingMessage={AVAILABLE_POST.DETAILS.TAKE_POST_CONFIRM.LOADING}
      />

      {/* Shown only after the user confirms "Take job" and the assign call returns 409; message is the server time-conflict text (PostDto/AvailablePostResultDto). */}
      <SMSConfirmDialog
        open={conflictOpen}
        onClose={() => (submitting ? undefined : setConflictOpen(false))}
        title={AVAILABLE_POST.DETAILS.CONFLICT.TITLE}
        message={conflictMessage}
        confirmText={AVAILABLE_POST.DETAILS.CONFLICT.CONFIRM}
        cancelText={AVAILABLE_POST.DETAILS.CONFLICT.CANCEL}
        onConfirm={() => void doAssign({ confirmConflict: true })}
        variant="warning"
        confirmButtonColor="primary"
        loading={submitting}
        loadingMessage={AVAILABLE_POST.DETAILS.TAKE_POST_CONFIRM.LOADING}
      />

      <SMSConfirmDialog
        open={cancelledFallbackOpen}
        onClose={() => (submitting ? undefined : setCancelledFallbackOpen(false))}
        title={AVAILABLE_POST.DETAILS.CANCELLED_SLOT_FALLBACK.TITLE}
        message={cancelledFallbackMessage}
        confirmText={AVAILABLE_POST.DETAILS.CANCELLED_SLOT_FALLBACK.CONFIRM}
        cancelText={AVAILABLE_POST.DETAILS.CANCELLED_SLOT_FALLBACK.CANCEL}
        onConfirm={() => {
          setCancelledFallbackOpen(false);
          void doAssign({ omitPostPositionId: true });
        }}
        variant="warning"
        loading={submitting}
        loadingMessage={AVAILABLE_POST.DETAILS.TAKE_POST_CONFIRM.LOADING}
      />

      <SMSConfirmDialog
        open={resultOpen}
        onClose={() => {
          setResultOpen(false);
        }}
        onConfirm={() => {
          if (refreshOnOk && resultVariant === 'success') {
            refreshList();
            onSuccess?.();
          }
          setResultOpen(false);
          setRefreshOnOk(false);
        }}
        title={
          resultVariant === 'success'
            ? AVAILABLE_POST.DETAILS.TAKE_POST_CONFIRM.RESULT.SUCCESS_TITLE
            : AVAILABLE_POST.DETAILS.TAKE_POST_CONFIRM.RESULT.ERROR_TITLE
        }
        message={resultMessage}
        confirmText={AVAILABLE_POST.DETAILS.TAKE_POST_CONFIRM.RESULT.OK}
        cancelText={AVAILABLE_POST.DETAILS.TAKE_POST_CONFIRM.RESULT.OK}
        variant={resultVariant}
        showCancel={false}
      />
    </>
  );
};

export default SMSTakeShiftAction;

