import React, { useCallback, useMemo, useState } from 'react';
import { SMSBox, SMSButton, SMSIcon, SMSIconButton, SMSTypography } from '@/components/smsatoms';
import { SMSConfirmDialog } from '@/components/smsmolecules';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { applySpecialEventRequestThunk, fetchAvailablePosts, fetchWaitingListPosts } from '@/store/slices/availablePostSlice';
import { AVAILABLE_POST } from '@/constants/strings';
import type { EmployeePostListingItem } from '@/types/employeePostListingItem';
import { isSuspendedEmployeeActive } from '@/utils';

type SpecialEventMode = 'icon' | 'button';

export interface SMSSpecialEventApplyActionProps {
  post: EmployeePostListingItem;
  mode: SpecialEventMode;
  disabled?: boolean;
  onSuccess?: () => void;
}

export const SMSSpecialEventApplyAction: React.FC<SMSSpecialEventApplyActionProps> = ({
  post,
  mode,
  disabled,
  onSuccess,
}) => {
  const dispatch = useAppDispatch();
  const { searchModel, showWaitingPosts, listPage, listPageSize, waitingListPage, waitingListPageSize } =
    useAppSelector((s) => s.availablePost);
  const user = useAppSelector((s) => s.auth.user);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [resultVariant, setResultVariant] = useState<'success' | 'error'>('success');
  const [resultMessage, setResultMessage] = useState<string>('');
  const [refreshOnOk, setRefreshOnOk] = useState(false);

  const effectiveDisabled = disabled || submitting || isSuspendedEmployeeActive(user);

  const actionKey = useMemo(
    () => `se:${(post.requestID ?? '').trim()}:${String(post.startDate ?? '').slice(0, 10)}`,
    [post.requestID, post.startDate]
  );
  const isAssigning = useAppSelector((s) => Boolean(s.availablePost.assigningPostIds[actionKey]));

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

  const doApply = useCallback(async () => {
    setSubmitting(true);
    try {
      const res = await dispatch(
        applySpecialEventRequestThunk({
          requestID: post.requestID,
          dateOfWork: post.startDate,
          suppressToast: true,
        })
      ).unwrap();

      setResultVariant('success');
      setResultMessage(res?.message || AVAILABLE_POST.DETAILS.SPECIAL_EVENT_REQUEST.RESULT_DEFAULT_SUCCESS);
      setConfirmOpen(false);
      setRefreshOnOk(true);
      setResultOpen(true);
    } catch (e: unknown) {
      const anyE = e as { message?: string };
      setResultVariant('error');
      setResultMessage(
        (typeof anyE?.message === 'string' && anyE.message.trim() ? anyE.message : '') ||
          AVAILABLE_POST.DETAILS.SPECIAL_EVENT_REQUEST.RESULT_DEFAULT_ERROR
      );
      setConfirmOpen(false);
      setRefreshOnOk(false);
      setResultOpen(true);
    } finally {
      setSubmitting(false);
    }
  }, [dispatch, post.requestID, post.startDate]);

  const openConfirm = () => setConfirmOpen(true);

  const specialEventTitle = (post.postTitle ?? '').trim() || 'Special Event Request';
  const totalAvailable = Number(post.availablePositions ?? 0);

  return (
    <>
      {mode === 'icon' ? (
        <SMSIconButton
          size="small"
          aria-label={AVAILABLE_POST.DETAILS.SPECIAL_EVENT_REQUEST.ICON_ARIA}
          onClick={openConfirm}
          disabled={effectiveDisabled || isAssigning}
          sx={{ borderRadius: 1, color: 'secondary.main' }}
        >
          <SMSIcon name="event" size="sm" />
        </SMSIconButton>
      ) : (
        <SMSButton
          onClick={openConfirm}
          disabled={effectiveDisabled || isAssigning}
          endIcon={!submitting ? <SMSIcon name="event" size="sm" /> : undefined}
        >
          {submitting ? AVAILABLE_POST.DETAILS.BUTTONS.APPLYING : AVAILABLE_POST.DETAILS.SPECIAL_EVENT_REQUEST.BUTTON}
        </SMSButton>
      )}

      <SMSConfirmDialog
        open={confirmOpen}
        onClose={() => (submitting ? undefined : setConfirmOpen(false))}
        title={AVAILABLE_POST.DETAILS.SPECIAL_EVENT_REQUEST.CONFIRM_TITLE}
        message="You are signing up to work at this event. You cannot select a specific job assignment."
        confirmText={AVAILABLE_POST.DETAILS.TAKE_POST_CONFIRM.CONFIRM}
        cancelText={AVAILABLE_POST.DETAILS.TAKE_POST_CONFIRM.CANCEL}
        onConfirm={() => void doApply()}
        variant="info"
        loading={submitting}
        loadingMessage={AVAILABLE_POST.DETAILS.TAKE_POST_CONFIRM.LOADING}
      >
        <SMSBox sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <SMSTypography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {specialEventTitle}
          </SMSTypography>
          <SMSTypography variant="body1" sx={{ mt: 0.75 }}>
            There are {totalAvailable} positions available. Assignments vary in locations and hours.
          </SMSTypography>
          <SMSTypography variant="body1" sx={{ mt: 1 }}>
            The actual job/post location assignments will be assigned by the Department Administrator closer to the event date.
            You will be notified of your final assignment at that time.
          </SMSTypography>
        </SMSBox>
      </SMSConfirmDialog>

      <SMSConfirmDialog
        open={resultOpen}
        onClose={() => setResultOpen(false)}
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

export default SMSSpecialEventApplyAction;

