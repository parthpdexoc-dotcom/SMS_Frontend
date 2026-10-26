import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import './SMSPostInformationModal.css';

import {
  SMSBox,
  SMSIcon,
  SMSIconButton,
  SMSStack,
  SMSTypography,
  SMSGrid,
  SMSCard,
  SMSButton,
  SMSFileTypeBadge,
  SMSLoader,
} from '@/components/smsatoms';
import { SMSModal } from '@/components/smsorganisms';
import { SMSDataDisplay } from '@/components/smsmolecules';
import { AVAILABLE_POST, MESSAGES, POST_POSITION } from '@/constants/strings';
import {
  formatCurrency,
  formatDateShort,
  formatDuration,
  formatLastNameCommaFirstName,
  formatPhoneNumber,
  formatTimeToHHmm,
  getPostEndTime,
} from '@/utils';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { clearAllNotes, clearLatestNotes, fetchAllPostNotes } from '@/store/slices/postNoteSlice';
import type { ViewDetailsLatestPostNoteMapped } from '@/utils/mapRequestViewDetails';

import type { EmployeePostListingItem } from '@/types/employeePostListingItem';

/** Row passed into the modal when full {@link Post} is not loaded yet. */
export type SMSPostInformationModalSelectedPost = Pick<
  EmployeePostListingItem,
  | 'postID'
  | 'postTitle'
  | 'postLength'
  | 'startDate'
  | 'startTime'
  | 'postEndTime'
  | 'payCodeValue'
  | 'postLocation'
  | 'totalPositions'
  | 'availablePositions'
  | 'isSpecialEvent'
> & {
  postDescription?: string;
  postNotes?: string;
  assignedEmployeeName?: string | null;
  callSign?: string;
};
import type { RequestResponse } from '@/types/request';
import type { RequesterResponse } from '@/types/requester';
import type { Post } from '@/types/post';
import type { FileUploadDto } from '@/types/fileUpload';

export interface SMSPostInformationModalProps {
  open: boolean;
  onClose: () => void;
  isLoading?: boolean;
  statusMessage?: string | null;
  title?: string;
  /** Optional extra buttons rendered next to the modal close button. */
  extraActions?: React.ReactNode;
  /** Fallback row data (used when postData is missing). */
  selectedPost?: SMSPostInformationModalSelectedPost | null;
  requestData?: RequestResponse | null;
  requesterData?: RequesterResponse | null;
  postData?: Post | null;
  requestFiles?: FileUploadDto[];
  /** If provided, shows attachment download icons. Otherwise shows just names. */
  onDownloadFile?: (file: FileUploadDto) => void;
  /** Show "OK" confirmation for latest note (used for taken/waiting contexts). */
  requireLatestNoteConfirmation?: boolean;
  showEndTime?: boolean;
  showTotalPositions?: boolean;
  showAvailablePositions?: boolean;
  /** When true, shows Call Sign (hidden on Available Jobs; pass only for assigned/post-position contexts). */
  showCallSign?: boolean;
  footerLeftAction?: React.ReactNode;
  /** Special-event preview mode: keep requester/request details and replace post details with informational message. */
  specialEventMode?: boolean;
  /**
   * When set (from `GET /Request/view-details` field `SpecialEventJobDetailsMessage`), shown as Job Details body
   * instead of built-in copy. Ignored unless `specialEventMode` is true.
   */
  specialEventJobDetailsMessage?: string | null;
  /** Optional block above requester / request sections (e.g. My History closed job records table). */
  extraContentTop?: React.ReactNode;
  /** Optional block below main post/request sections (e.g. equipment / vehicle details). */
  extraContent?: React.ReactNode;
  /**
   * Latest post note from `GET /Request/view-details` (`LatestPostNote`). When set, the modal does not call
   * `GET /PostNotes/{postId}/latest-notes`.
   */
  latestPostNoteFromDetails?: ViewDetailsLatestPostNoteMapped | null;
  /** Prefer Date/Time/Duration from post-position row instead of post-level data. */
  preferPostPositionFields?: boolean;
}

export const SMSPostInformationModal: React.FC<SMSPostInformationModalProps> = ({
  open,
  onClose,
  isLoading = false,
  statusMessage = null,
  title = AVAILABLE_POST.DETAILS.TITLE,
  extraActions,
  selectedPost,
  requestData,
  requesterData,
  postData,
  requestFiles = [],
  onDownloadFile,
  requireLatestNoteConfirmation = false,
  showEndTime = true,
  showTotalPositions = false,
  showAvailablePositions = false,
  showCallSign = false,
  footerLeftAction,
  specialEventMode = false,
  specialEventJobDetailsMessage = null,
  extraContentTop,
  extraContent,
  latestPostNoteFromDetails = null,
  preferPostPositionFields = false,
}) => {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const { allNotes, isLoading: isPostNotesLoading } = useAppSelector((state) => state.postNote);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [acknowledgedLatestNoteId, setAcknowledgedLatestNoteId] = useState<string | null>(null);

  // Typography tuning for this shared modal:
  // - Keep labels readable
  // - Increase value size for better visibility
  const labelVariant: React.ComponentProps<typeof SMSTypography>['variant'] = 'body1';
  const valueVariant: React.ComponentProps<typeof SMSTypography>['variant'] = 'body1';
  const fieldSpacing = 0.25;
  const postStartTimeRaw = preferPostPositionFields
    ? (selectedPost?.startTime ?? postData?.postStartTime ?? '')
    : (postData?.postStartTime ?? selectedPost?.startTime ?? '');
  const postDurationMinutes = preferPostPositionFields
    ? (selectedPost?.postLength ?? postData?.postLength ?? null)
    : (postData?.postLength ?? selectedPost?.postLength ?? null);
  const postEndTimeRaw = preferPostPositionFields
    ? (selectedPost?.postEndTime ?? postData?.postEndTime ?? '')
    : (postData?.postEndTime ?? selectedPost?.postEndTime ?? '');
  const postStartTime = formatTimeToHHmm(postStartTimeRaw);
  const postEndTime = postEndTimeRaw
    ? formatTimeToHHmm(postEndTimeRaw)
    : getPostEndTime(postStartTimeRaw, postDurationMinutes);
  const payCodeParts = [
    postData?.payCodeValue ?? selectedPost?.payCodeValue,
    postData?.payCodeDescription,
  ]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean);
  const payCodeDisplay =
    payCodeParts.length > 1 && payCodeParts[0] === payCodeParts[1]
      ? payCodeParts[0]
      : payCodeParts.join(' - ');
  const payRateDisplay =
    postData?.postPayRate != null && !Number.isNaN(Number(postData.postPayRate))
      ? formatCurrency(postData.postPayRate, AVAILABLE_POST.COMMON.EMPTY_VALUE)
      : AVAILABLE_POST.COMMON.EMPTY_VALUE;
  const isPremiumDisplay =
    postData?.isPremiumPaidEvent === true
      ? MESSAGES.YES
      : postData?.isPremiumPaidEvent === false
        ? MESSAGES.NO
        : AVAILABLE_POST.COMMON.EMPTY_VALUE;
  const jobContactName =
    postData?.firstName || postData?.lastName
      ? `${postData.lastName || ''}, ${postData.firstName || ''}`.trim()
      : AVAILABLE_POST.COMMON.EMPTY_VALUE;
  const assignedEmployeeName = String(selectedPost?.assignedEmployeeName ?? '').trim();
  const postDateOfWork = selectedPost?.startDate ?? '';
  const fallbackPost = selectedPost as unknown as Record<string, unknown> | null;
  const listingLocation =
    selectedPost?.postLocation != null ? String(selectedPost.postLocation).trim() : '';
  const postLocation =
    (postData?.postLocation && String(postData.postLocation).trim()) ||
    listingLocation ||
    String((fallbackPost?.postLocation ?? fallbackPost?.PostLocation ?? '') as string);
  const postDescription =
    postData?.postDescription ??
    ((fallbackPost?.postDescription ?? fallbackPost?.PostDescription) as string | undefined) ??
    '';
  const totalPositions =
    postData?.totalPostPositions ??
    ((fallbackPost?.totalPositions ?? fallbackPost?.TotalPositions) as number | undefined) ??
    null;
  const availablePositions =
    ((fallbackPost?.availablePositions ?? fallbackPost?.AvailablePositions) as number | undefined) ??
    null;
  const callSign = String(
    postData?.postCallSign ??
      selectedPost?.callSign ??
      (fallbackPost?.callSign ?? fallbackPost?.CallSign ?? '')
  ).trim();
  const callSignDisplay = callSign || AVAILABLE_POST.COMMON.EMPTY_VALUE;
  const jobDetailsHeaderTitle =
    postData?.postTitle || selectedPost?.postTitle || AVAILABLE_POST.COMMON.EMPTY_VALUE;
  const modalPostId = String(postData?.postId ?? selectedPost?.postID ?? '');
  const latestNoteId = (latestPostNoteFromDetails?.postNoteID ?? null) as string | null;
  const postNotes = useMemo(() => {
    const fromDetails = (latestPostNoteFromDetails?.notes ?? '').trim();
    if (fromDetails) return fromDetails;
    const fallbackNotes = (fallbackPost?.postNotes ?? fallbackPost?.PostNotes) as string | undefined;
    return (((postData as any)?.postNotes as string | undefined) ?? fallbackNotes ?? '').trim();
  }, [latestPostNoteFromDetails?.notes, postData, fallbackPost]);
  const needsLatestNoteOk =
    requireLatestNoteConfirmation &&
    !!latestNoteId &&
    acknowledgedLatestNoteId !== latestNoteId;
  const showNotesSection = postNotes.length > 0 || needsLatestNoteOk;

  useEffect(() => {
    if (!open) {
      dispatch(clearLatestNotes());
      dispatch(clearAllNotes());
      setHistoryOpen(false);
    }
  }, [dispatch, open]);

  useEffect(() => {
    // New latest note should require a fresh explicit acknowledgement.
    if (latestNoteId && acknowledgedLatestNoteId && latestNoteId !== acknowledgedLatestNoteId) {
      setAcknowledgedLatestNoteId(null);
    }
  }, [latestNoteId, acknowledgedLatestNoteId]);

  return (
    <SMSModal
      open={open}
      onClose={onClose}
      title={title}
      size="lg-xl"
      actions={(
        <SMSStack direction="row" justifyContent="flex-end" spacing={1}>
          {extraActions}
          <SMSBox>{footerLeftAction}</SMSBox>
          <SMSButton
            allowWhenSuspended
            variant="outlined"
            onClick={onClose}
          >
            {AVAILABLE_POST.DETAILS.BUTTONS.CLOSE}
          </SMSButton>
        </SMSStack>
      )}
    >
      <SMSStack spacing={1.25}>
        {isLoading ? (
          <SMSBox sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 6 }}>
            <SMSLoader loadingText={AVAILABLE_POST.DETAILS.LOADING} aria-label={AVAILABLE_POST.DETAILS.LOADING} />
          </SMSBox>
        ) : statusMessage ? (
          <SMSTypography variant="body2" color="text.secondary">
            {statusMessage}
          </SMSTypography>
        ) : (
          <>
            {extraContentTop ? <SMSBox sx={{ mt: 1 }}>{extraContentTop}</SMSBox> : null}
            <SMSGrid container spacing={1.5}>
              <SMSGrid item xs={12} md={6}>
                <SMSCard sx={{ p: 1.25, height: '100%' }}>
                  <SMSStack direction="row" spacing={1} alignItems="center">
                    <SMSTypography variant="subtitle1" className="modal-header heading-color" sx={{ fontWeight: 700 }}>
                      {AVAILABLE_POST.DETAILS.SECTIONS.REQUESTER}: {requesterData?.name || AVAILABLE_POST.COMMON.EMPTY_VALUE}
                    </SMSTypography>
                  </SMSStack>

                  <SMSStack spacing={1} sx={{ mt: 0.75 }}>
                    <SMSDataDisplay
                      label=""
                      value={
                        requestData
                          ? formatLastNameCommaFirstName(requestData.firstName, requestData.lastName)
                          : AVAILABLE_POST.COMMON.EMPTY_VALUE
                      }
                      icon="person_outline"
                      variant="inline"
                      valueVariant={valueVariant}
                      spacing={fieldSpacing}
                    />
                    <SMSDataDisplay
                      label=""
                      value={requesterData?.phone ? formatPhoneNumber(requesterData.phone) : AVAILABLE_POST.COMMON.EMPTY_VALUE}
                      icon="phone"
                      variant="inline"
                      valueVariant={valueVariant}
                      spacing={fieldSpacing}
                    />
                    <SMSDataDisplay
                      label=""
                      value={requesterData?.email || AVAILABLE_POST.COMMON.EMPTY_VALUE}
                      icon="email"
                      variant="inline"
                      valueVariant={valueVariant}
                      spacing={fieldSpacing}
                    />
                    <SMSDataDisplay
                      label=""
                      value={
                        <SMSBox
                          sx={{
                            whiteSpace: 'normal',
                            wordBreak: 'break-word',
                            maxWidth: '120px',
                          }}>
                          {requesterData?.address || AVAILABLE_POST.COMMON.EMPTY_VALUE}
                        </SMSBox>
                      }
                      icon="home"
                      variant="inline"
                      valueVariant={valueVariant}
                      spacing={fieldSpacing}
                    />
                  </SMSStack>
                </SMSCard>
              </SMSGrid>

              <SMSGrid item xs={12} md={6}>
                <SMSCard sx={{ p: 1.25, height: '100%' }}>
                  <SMSStack direction="row" spacing={1} alignItems="center">
                    <SMSTypography variant="subtitle1" className="modal-header heading-color" sx={{ fontWeight: 700 }}>
                      {AVAILABLE_POST.DETAILS.SECTIONS.REQUEST} : {requestData?.title || AVAILABLE_POST.COMMON.EMPTY_VALUE}
                    </SMSTypography>
                  </SMSStack>

                  <SMSStack spacing={0.5} sx={{ mt: 0.75 }}>
                    <SMSDataDisplay
                      value={
                        requestData?.firstName || requestData?.lastName
                          ? `${requestData.lastName  || ''}, ${requestData.firstName || ''}`.trim()
                          : AVAILABLE_POST.COMMON.EMPTY_VALUE
                      }
                      icon="person"
                      variant="default"
                      labelVariant={labelVariant}
                      valueVariant={valueVariant}
                      spacing={fieldSpacing}
                    />
                    <SMSDataDisplay
                      value={requestData?.primaryEmail || AVAILABLE_POST.COMMON.EMPTY_VALUE}
                      icon="email"
                      variant="default"
                      labelVariant={labelVariant}
                      valueVariant={valueVariant}
                      spacing={fieldSpacing}
                    />
                    <SMSDataDisplay
                      value={requestData?.primaryPhone ? formatPhoneNumber(requestData.primaryPhone) : AVAILABLE_POST.COMMON.EMPTY_VALUE}
                      icon="phone"
                      variant="default"
                      labelVariant={labelVariant}
                      valueVariant={valueVariant}
                      spacing={fieldSpacing}
                    />
                    <SMSDataDisplay
                      value={requestData?.location || AVAILABLE_POST.COMMON.EMPTY_VALUE}
                      icon="location_on"
                      variant="default"
                      labelVariant={labelVariant}
                      valueVariant={valueVariant}
                      spacing={fieldSpacing}
                    />
                    <SMSDataDisplay
                      value={requestData?.postLocationsAreStationary ? POST_POSITION.DETAIL_MODAL.POST_LOCATIONS_STATIONARY_YES : POST_POSITION.DETAIL_MODAL.POST_LOCATIONS_STATIONARY_NO}
                      icon="map"
                      variant="inline"
                      labelVariant={labelVariant}
                      valueVariant={valueVariant}
                      spacing={fieldSpacing}
                      valueSx={{ color: 'error.main' }}
                      iconColor={theme.palette.error.main}
                    />
                  </SMSStack>
                </SMSCard>
              </SMSGrid>
              <SMSGrid item xs={12} md={12}>
                <SMSCard sx={{ p: 1.25, height: '100%' }}>
                  <SMSStack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                    <SMSTypography variant="subtitle1" className="modal-header heading-color" sx={{ fontWeight: 700 }}>
                      {AVAILABLE_POST.DETAILS.SECTIONS.POST}
                      {!specialEventMode && (
                        <>
                          {' '}
                          : {jobDetailsHeaderTitle}
                        </>
                      )}
                    </SMSTypography>
                    {!specialEventMode && assignedEmployeeName && (
                      <SMSStack direction="row" spacing={0.75} alignItems="center" sx={{ pr: 4 }}>
                        <SMSIcon name="badge" size="sm" />
                        <SMSTypography variant="subtitle1" className="modal-header heading-color" sx={{ fontWeight: 700 }}>
                          {assignedEmployeeName}
                        </SMSTypography>
                      </SMSStack>
                    )}
                  </SMSStack>

                  {specialEventMode ? (
                    <SMSStack spacing={1} sx={{ mt: 1 }}>
                      {specialEventJobDetailsMessage?.trim() ? (
                        <SMSTypography
                          variant={valueVariant}
                          sx={{
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            overflowWrap: 'anywhere',
                          }}
                        >
                          {specialEventJobDetailsMessage.trim()}
                        </SMSTypography>
                      ) : (
                        <>
                          <SMSTypography variant={valueVariant}>
                            There are{' '}
                            {availablePositions ?? totalPositions ?? 0} positions available. Assignments vary in
                            locations and hours.
                          </SMSTypography>
                          <SMSTypography variant={valueVariant}>
                            You are signing up to work at the event, you cannot select a specific job/post assignment.
                          </SMSTypography>
                          <SMSTypography variant={valueVariant}>
                            The actual job/post location assignments will be assigned by the Department Administrator
                            closer to the event date. You will be notified of your final assignment at that time.
                          </SMSTypography>
                        </>
                      )}
                    </SMSStack>
                  ) : (
                  <SMSStack spacing={1} sx={{ mt: 1 }}>
                    <SMSGrid container spacing={0} alignItems="flex-start">
                      <SMSGrid item xs={12} sm={6} md={3} mb={1}>
                        <SMSDataDisplay
                          label={AVAILABLE_POST.DETAILS.FIELDS.DateOfWork}
                          value={postDateOfWork ? formatDateShort(postDateOfWork) : AVAILABLE_POST.COMMON.EMPTY_VALUE}
                          icon="calendar"
                          variant="icon-left-vertical"
                          labelVariant={labelVariant}
                          valueVariant={valueVariant}
                          spacing={fieldSpacing}
                        />
                      </SMSGrid>

                      <SMSGrid item xs={12} sm={6} md={3} mb={1}>
                        <SMSDataDisplay
                          label={AVAILABLE_POST.DETAILS.FIELDS.START_TIME}
                          value={postStartTime || AVAILABLE_POST.COMMON.EMPTY_VALUE}
                          icon="clock"
                          variant="icon-left-vertical"
                          labelVariant={labelVariant}
                          valueVariant={valueVariant}
                          spacing={fieldSpacing}
                        />
                      </SMSGrid>

                      {showEndTime && (
                        <SMSGrid item xs={12} sm={6} md={3} mb={1}>
                          <SMSDataDisplay
                            label={AVAILABLE_POST.DETAILS.FIELDS.END_TIME}
                            value={postEndTime || AVAILABLE_POST.COMMON.EMPTY_VALUE}
                            icon="clock"
                            variant="icon-left-vertical"
                            labelVariant={labelVariant}
                            valueVariant={valueVariant}
                            spacing={fieldSpacing}
                          />
                        </SMSGrid>
                      )}

                      <SMSGrid item xs={12} sm={6} md={3} mb={1}>
                        <SMSDataDisplay
                          label={AVAILABLE_POST.DETAILS.FIELDS.DURATION}
                          value={postDurationMinutes != null ? formatDuration(postDurationMinutes) : AVAILABLE_POST.COMMON.EMPTY_VALUE}
                          icon="schedule"
                          variant="icon-left-vertical"
                          labelVariant={labelVariant}
                          valueVariant={valueVariant}
                          spacing={fieldSpacing}
                        />
                      </SMSGrid>
                    </SMSGrid>

                    <SMSGrid container spacing={0} alignItems="flex-start">
                      <SMSGrid item xs={12} sm={6} md={3} mb={1}>
                        <SMSDataDisplay
                          label={AVAILABLE_POST.DETAILS.FIELDS.PAY_CODE}
                          value={payCodeDisplay || AVAILABLE_POST.COMMON.EMPTY_VALUE}
                          icon="payments"
                          variant="icon-left-vertical"
                          labelVariant={labelVariant}
                          valueVariant={valueVariant}
                          spacing={fieldSpacing}
                        />
                      </SMSGrid>
                      <SMSGrid item xs={12} sm={6} md={3} mb={1}>
                        <SMSDataDisplay
                          label={AVAILABLE_POST.DETAILS.FIELDS.PAY_RATE}
                          value={payRateDisplay}
                          icon="attach_money"
                          variant="icon-left-vertical"
                          labelVariant={labelVariant}
                          valueVariant={valueVariant}
                          spacing={fieldSpacing}
                        />
                      </SMSGrid>
                      <SMSGrid item xs={12} sm={6} md={3} mb={1}>
                        <SMSDataDisplay
                          label={AVAILABLE_POST.DETAILS.FIELDS.IS_PREMIUM}
                          value={isPremiumDisplay}
                          icon="star"
                          variant="icon-left-vertical"
                          labelVariant={labelVariant}
                          valueVariant={valueVariant}
                          spacing={fieldSpacing}
                        />
                      </SMSGrid>
                    </SMSGrid>

                    <SMSGrid container spacing={0} alignItems="flex-start">
                      <SMSGrid item xs={12} mb={0.5}>
                        <SMSTypography variant={labelVariant} className="heading-color" sx={{ fontWeight: 600 }}>
                          {AVAILABLE_POST.DETAILS.FIELDS.JOB_CONTACT}
                        </SMSTypography>
                      </SMSGrid>
                      <SMSGrid item xs={12} sm={6} md={3} mb={1}>
                        <SMSDataDisplay
                          label=""
                          value={jobContactName}
                          icon="person"
                          variant="inline"
                          valueVariant={valueVariant}
                          spacing={fieldSpacing}
                        />
                      </SMSGrid>
                      <SMSGrid item xs={12} sm={6} md={3} mb={1}>
                        <SMSDataDisplay
                          label=""
                          value={
                            <SMSBox
                              sx={{
                                whiteSpace: 'normal',
                                wordBreak: 'break-word',
                                overflowWrap: 'anywhere',
                                pr: 3,
                              }}
                            >
                              {postData?.primaryEmail || AVAILABLE_POST.COMMON.EMPTY_VALUE}
                            </SMSBox>
                          }
                          icon="email"
                          variant="inline"
                          valueVariant={valueVariant}
                          spacing={fieldSpacing}
                        />
                      </SMSGrid>
                      <SMSGrid item xs={12} sm={6} md={3} mb={1}>
                        <SMSDataDisplay
                          label=""
                          value={postData?.primaryPhone ? formatPhoneNumber(postData.primaryPhone) : AVAILABLE_POST.COMMON.EMPTY_VALUE}
                          icon="phone"
                          variant="inline"
                          valueVariant={valueVariant}
                          spacing={fieldSpacing}
                        />
                      </SMSGrid>

                      <SMSGrid item xs={12} mb={0.5} sx={{ mt: 0.5 }}>
                        <SMSTypography variant={labelVariant} className="heading-color" sx={{ fontWeight: 600 }}>
                          {AVAILABLE_POST.DETAILS.FIELDS.JOB_LOCATION}
                        </SMSTypography>
                      </SMSGrid>
                      <SMSGrid item xs={12} mb={1}>
                        <SMSDataDisplay
                          label=""
                          value={
                            <SMSBox
                              sx={{
                                whiteSpace: 'normal',
                                wordBreak: 'break-word',
                                overflowWrap: 'anywhere',
                              }}
                            >
                              {postLocation || AVAILABLE_POST.COMMON.EMPTY_VALUE}
                            </SMSBox>
                          }
                          icon="location_on"
                          variant="inline"
                          valueVariant={valueVariant}
                          spacing={fieldSpacing}
                        />
                      </SMSGrid>

                      <SMSGrid item xs={12}>
                        <SMSBox sx={{ height: '1px', backgroundColor: 'divider', my: 1 }} />
                      </SMSGrid>

                      <SMSGrid item xs={12}>
                        <SMSDataDisplay
                          label={AVAILABLE_POST.DETAILS.FIELDS.DESCRIPTION}
                          value={
                            <SMSBox
                              sx={{
                                whiteSpace: 'normal',
                                wordBreak: 'break-word',
                                overflowWrap: 'anywhere',
                              }}
                            >
                              {postDescription || AVAILABLE_POST.COMMON.EMPTY_VALUE}
                            </SMSBox>
                          }
                          icon="description"
                          variant="icon-left-vertical"
                          labelVariant={labelVariant}
                          valueVariant={valueVariant}
                          spacing={fieldSpacing}
                          fullWidth
                        />
                      </SMSGrid>
                    </SMSGrid>

                    <SMSGrid container spacing={0} alignItems="flex-start">
                      {showAvailablePositions && (
                        <SMSGrid item xs={12} sm={6} md={3} sx={{ mb: 2 }}>
                          <SMSDataDisplay
                            label={AVAILABLE_POST.DETAILS.FIELDS.AVAILABLE_POSITIONS}
                            value={
                              availablePositions != null
                                ? String(availablePositions)
                                : AVAILABLE_POST.COMMON.EMPTY_VALUE
                            }
                            icon="people"
                            variant="icon-left-vertical"
                            labelVariant={labelVariant}
                            valueVariant={valueVariant}
                            spacing={fieldSpacing}
                            labelSx={{ whiteSpace: 'nowrap' }}
                          />
                        </SMSGrid>
                      )}

                      {showTotalPositions && (
                        <SMSGrid item xs={12} sm={6} md={3}>
                          <SMSDataDisplay
                            label={AVAILABLE_POST.DETAILS.FIELDS.TOTAL_POSITIONS}
                            value={totalPositions != null ? String(totalPositions) : AVAILABLE_POST.COMMON.EMPTY_VALUE}
                            icon="group"
                            variant="icon-left-vertical"
                            labelVariant={labelVariant}
                            valueVariant={valueVariant}
                            spacing={fieldSpacing}
                          />
                        </SMSGrid>
                      )}

                      {showCallSign && (
                        <SMSGrid item xs={12} sm={6} md={3}>
                          <SMSDataDisplay
                            label={AVAILABLE_POST.DETAILS.FIELDS.CALL_SIGN}
                            value={callSignDisplay}
                            icon="radio"
                            variant="icon-left-vertical"
                            labelVariant={labelVariant}
                            valueVariant={valueVariant}
                            spacing={fieldSpacing}
                          />
                        </SMSGrid>
                      )}
                    </SMSGrid>

                    {extraContent && (
                      <SMSBox sx={{ mt: 1.5 }}>
                        {extraContent}
                      </SMSBox>
                    )}

                    {showNotesSection && (
                      <SMSCard variant="outlined" sx={{ p: 1 }}>
                        <SMSStack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                          <SMSStack direction="row" spacing={0.75} alignItems="center">
                            <SMSIcon name="note" size="xs" />
                            <SMSTypography variant={labelVariant} className="heading-color">
                              {AVAILABLE_POST.DETAILS.FIELDS.NOTES}
                            </SMSTypography>
                          </SMSStack>
                          <SMSStack direction="row" spacing={0.5} alignItems="center">
                            {!!modalPostId && (
                              <SMSIconButton
                                size="small"
                                tone="primary"
                                aria-label={AVAILABLE_POST.DETAILS.VIEW_PREVIOUS_NOTES_ARIA}
                                onClick={() => {
                                  setHistoryOpen(true);
                                  dispatch(fetchAllPostNotes(modalPostId));
                                }}
                                sx={{ p: 0.25 }}
                              >
                                <SMSIcon name="list" size="xs" />
                              </SMSIconButton>
                            )}
                            {needsLatestNoteOk && (
                              <SMSButton
                                variant="outlined"
                                allowWhenSuspended
                                onClick={() => setAcknowledgedLatestNoteId(latestNoteId)}
                              >
                                OK
                              </SMSButton>
                            )}
                          </SMSStack>
                        </SMSStack>
                        <SMSTypography
                          variant={valueVariant}
                          sx={{
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            overflowWrap: 'anywhere',
                            maxHeight: 84,
                            overflowY: 'auto',
                          }}
                        >
                          {postNotes || AVAILABLE_POST.COMMON.EMPTY_VALUE}
                        </SMSTypography>
                      </SMSCard>
                    )}
                  </SMSStack>
                  )}

                  {requestFiles.length > 0 && (
                    <SMSBox sx={{ mt: 1.25 }}>
                      <SMSTypography variant="caption" color="text.secondary">
                        {AVAILABLE_POST.DETAILS.FIELDS.ATTACHMENTS}
                      </SMSTypography>
                      <SMSStack direction="row" spacing={0.75} sx={{ mt: 0.75, flexWrap: 'wrap' }}>
                        {requestFiles.map((f) => (
                          <SMSStack key={f.fileUploadedId} direction="row" spacing={0.75} alignItems="center">
                            {onDownloadFile ? (
                              <SMSIconButton
                                size="small"
                                allowWhenSuspended
                                aria-label={`${AVAILABLE_POST.DETAILS.DOWNLOAD.ACTION} ${f.fileName}`}
                                onClick={() => onDownloadFile(f)}
                                sx={{ p: 0.125, borderRadius: '10px' }}
                              >
                                <SMSFileTypeBadge
                                  fileName={f.fileName}
                                  typeOfFile={f.typeOfFile}
                                  size="sm"
                                />
                              </SMSIconButton>
                            ) : (
                              <SMSFileTypeBadge
                                fileName={f.fileName}
                                typeOfFile={f.typeOfFile}
                                size="sm"
                              />
                            )}
                          </SMSStack>
                        ))}
                      </SMSStack>
                    </SMSBox>
                  )}
                </SMSCard>
              </SMSGrid>
            </SMSGrid>
          </>
        )}
      </SMSStack>
      <SMSModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title={AVAILABLE_POST.DETAILS.NOTES_HISTORY_TITLE}
        size="small"
        actions={
          <SMSStack direction="row" justifyContent="flex-end">
            <SMSButton
              allowWhenSuspended
              variant="outlined"
              onClick={() => setHistoryOpen(false)}
            >
              {AVAILABLE_POST.DETAILS.BUTTONS.CLOSE}
            </SMSButton>
          </SMSStack>
        }
      >
        <SMSStack spacing={1}>
          {isPostNotesLoading ? (
            <SMSBox sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <SMSLoader loadingText={AVAILABLE_POST.DETAILS.LOADING} aria-label={AVAILABLE_POST.DETAILS.LOADING} />
            </SMSBox>
          ) : allNotes.length === 0 ? (
            <SMSTypography variant="body2" color="text.secondary">
              {AVAILABLE_POST.COMMON.EMPTY_VALUE}
            </SMSTypography>
          ) : (
            allNotes.map((n, idx) => (
              <SMSCard key={n.postNoteID ?? `${n.postID}-${idx}`} sx={{ p: 1 }}>
                <SMSTypography variant="body2">{n.notes || AVAILABLE_POST.COMMON.EMPTY_VALUE}</SMSTypography>
              </SMSCard>
            ))
          )}
        </SMSStack>
      </SMSModal>
    </SMSModal>
  );
};

export default SMSPostInformationModal;

