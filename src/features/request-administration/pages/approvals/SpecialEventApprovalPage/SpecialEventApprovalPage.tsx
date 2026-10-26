import { SMSButton, SMSGrid, SMSCard, SMSIcon, SMSLoader, SMSTextArea } from '@/components/smsatoms';
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { SMSFormPage } from '@/components/smsorganisms';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  ApprovalDetail,
  ApprovalRequestDetailResponseDto,
  ApprovalType,
  VehicleApprovalPostDetailDto,
} from '@/types/vehicleApproval';
import { getApprovalEmailLinkForType } from '@/utils/vehicleApprovalLinkUtils';
import { sendVehicleApprovalEmailThunk } from '@/store/slices/requestSlice';
import { MENU_ITEMS, POST_POSITION } from '@/constants/strings';
import {
  submitVehicleApprovalDetailThunk,
  fetchVehicleApprovalRequestDetailThunk,
} from '@/store/slices/approvalDetailSlice';
import { fetchRequestRoutingGroupsByRequestIdThunk } from '@/store/slices/requestApprovalRoutingSlice';
import '@/styles/forms.css';
import './SpecialEventApprovalPage.css';

export const SpecialEventApprovalPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const navState = (location.state ?? null) as
    | {
        requestId?: string;
        routingGroupId?: string;
      }
    | null;

  const requestIdFromState = navState?.requestId;
  const routingGroupIdFromState = navState?.routingGroupId;

  const requestIdFromQuery =
    searchParams.get('requestId') || requestIdFromState || '';
  const routingGroupIdEffective =
    searchParams.get('routingGroupId') ||
    routingGroupIdFromState ||
    '';

  const [approvalState, setApprovalState] = useState<ApprovalDetail>({
    departmentID: user?.departmentID || '',
    approvalDetailID: null,
    requestID: requestIdFromQuery,
    routeToID: routingGroupIdEffective,
    vehApproverComments: '',
    approved: null,
  });

  const [approvalDetail, setApprovalDetail] =
    useState<ApprovalRequestDetailResponseDto | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const { detailError, isSubmitting } = useAppSelector(
    (state) => state.vehicleApprovalDetail
  );
  const [routingGroups, setRoutingGroups] = useState<
    Array<{
      id: string;
      label: string;
      description: string;
      rank: number;
      approvalType: ApprovalType;
      hasFinalAuthority: boolean;
    }>
  >([]);
  const [routingGroupStatuses, setRoutingGroupStatuses] = useState<
    Record<string, boolean | null>
  >({});

  const isApproved = approvalState.approved === true;
  const isRejected = approvalState.approved === false;

  const hasApprovalContext =
    !!requestIdFromQuery && !!routingGroupIdEffective;

  const handleCommentsChange: React.ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement> = (
    event
  ) => {
    const value = event.target.value;
    setApprovalState((prev: ApprovalDetail) => ({
      ...prev,
      vehApproverComments: value,
    }));
  };

  const handleDecision = (approved: boolean) => {
    if (isSubmitting) return;
    const next: ApprovalDetail = {
      ...approvalState,
      approved,
    };
    if (
      !next.departmentID ||
      !next.requestID ||
      !next.routeToID ||
      next.approved === null
    ) {
      return;
    }
    setApprovalState(next);

    void (async () => {
      const currentRoutingGroup = routingGroups.find(
        (g) => g.id === next.routeToID
      );
      const isFinalAuthority =
        currentRoutingGroup?.hasFinalAuthority ?? false;

      await dispatch(
        submitVehicleApprovalDetailThunk({
          departmentID: next.departmentID,
          requestID: next.requestID,
          routeToID: next.routeToID,
          vehicleApproverComments: next.vehApproverComments?.trim() || null,
          approved: next.approved ?? false,
          finalApproval: isFinalAuthority,
          type: ApprovalType.SpecialEventApproval,
        })
      ).unwrap();

      const sortedGroups = [...routingGroups].sort(
        (a, b) => a.rank - b.rank
      );
      const currentIndex = sortedGroups.findIndex(
        (g) => g.id === next.routeToID
      );
      const nextGroup =
        currentIndex >= 0 ? sortedGroups[currentIndex + 1] : undefined;

      if (nextGroup) {
        try {
          const systemUrl = getApprovalEmailLinkForType(
            nextGroup.approvalType,
            next.requestID,
            nextGroup.id
          );
          await dispatch(
            sendVehicleApprovalEmailThunk({
              requestId: next.requestID,
              routingGroupId: nextGroup.id,
              systemUrl,
            })
          ).unwrap();
        } catch {
          // Non-blocking; failures are handled by request slice error state.
        }
      }

      navigate('/admin/special-event-approval/confirmation', {
        replace: true,
      });
    })();
  };

  useEffect(() => {
    if (!requestIdFromQuery) {
      setRoutingGroups([]);
      return;
    }

    let cancelled = false;

    const loadRoutingGroups = async (): Promise<void> => {
      try {
        const apiGroups = await dispatch(
          fetchRequestRoutingGroupsByRequestIdThunk(requestIdFromQuery)
        ).unwrap();

        if (cancelled) return;

        const mapped = apiGroups
          .filter((g) => g.approverID)
          .map((g) => ({
            id: g.approverID,
            label: g.routingGroupName?.trim() || 'Routing Group',
            description: 'Not Yet Assigned',
            rank: g.rank,
            approvalType: g.approvalType as ApprovalType,
            hasFinalAuthority: g.requestApproverHasFinalAuthority ?? false,
          }));

        setRoutingGroups(mapped);

        if (!approvalState.routeToID && mapped[0]?.id) {
          setApprovalState((prev: ApprovalDetail) => ({
            ...prev,
            routeToID: mapped[0]?.id ?? prev.routeToID,
          }));
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(
          'SpecialEventApprovalPage: failed to load routing groups for request',
          error
        );
      }
    };

    void loadRoutingGroups();

    return () => {
      cancelled = true;
    };
  }, [requestIdFromQuery, approvalState.routeToID]);

  const stripTrailingColon = (label: string): string =>
    label.replace(/\s*:$/, '');

  const requesterHeader = stripTrailingColon(POST_POSITION.DETAIL_MODAL.REQUESTER_INFO);
  const requestDetailsHeader = 'Special Event Approval Request';
  const postDetailsHeader = stripTrailingColon(POST_POSITION.DETAIL_MODAL.POST_DETAILS);

  useEffect(() => {
    if (!requestIdFromQuery || !approvalState.routeToID) return;

    let cancelled = false;

    setIsDetailLoading(true);
    setApprovalDetail(null);

    const loadExistingDetail = async (): Promise<void> => {
      try {
        const existing = await dispatch(
          fetchVehicleApprovalRequestDetailThunk({
            requestId: requestIdFromQuery,
            routingGroupId: approvalState.routeToID,
            approvalType: ApprovalType.SpecialEventApproval,
          })
        ).unwrap();

        if (!existing || cancelled) return;

        setApprovalDetail(existing);

        setApprovalState((prev: ApprovalDetail) => ({
          ...prev,
          requestID: existing.requestId ?? prev.requestID,
          routeToID: existing.routingGroupId ?? prev.routeToID,
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('Forbidden')) {
          navigate('/forbidden', { replace: true });
          return;
        }
        // eslint-disable-next-line no-console
        console.error('SpecialEventApprovalPage: failed to load existing detail', error);
      } finally {
        if (!cancelled) {
          setIsDetailLoading(false);
        }
      }
    };

    void loadExistingDetail();

    return () => {
      cancelled = true;
    };
  }, [requestIdFromQuery, approvalState.routeToID]);

  const organizationName =
    approvalDetail?.requesterInfo?.name?.trim() || '-';

  const contactDisplay =
    approvalDetail && approvalDetail.requesterInfo
      ? approvalDetail.requesterInfo.contact
      : '-';

  const emailDisplay =
    approvalDetail?.requesterInfo?.email?.trim() || '-';

  const requestedDateDisplay =
    approvalDetail?.requestVehicleInfo?.requestedDate?.trim() || '-';

  const postDetails = approvalDetail?.postDetails ?? [];
  const hasPostDetails = postDetails.length > 0;

  useEffect(() => {
    if (!approvalDetail?.approvalRouting) return;

    const statusMap: Record<string, boolean | null> = {};

    for (const item of approvalDetail.approvalRouting) {
      statusMap[item.routingGroupId] = item.isApproved;
    }

    setRoutingGroupStatuses(statusMap);
  }, [approvalDetail]);

  useEffect(() => {
    if (!hasApprovalContext) {
      navigate('/forbidden', { replace: true });
    }
  }, [hasApprovalContext, navigate]);

  // Wait for API result before showing the approval screen (avoid flashing the form with empty data or before 403/redirect).
  const waitingForDetail =
    hasApprovalContext &&
    (isDetailLoading || (approvalDetail === null && !detailError));
  if (waitingForDetail) {
    return (
      <SMSFormPage
        title={MENU_ITEMS.SPECIAL_EVENT_APPROVAL}
        subtitle="Loading approval request..."
        hideBackButton
      >
        <div style={{ padding: '2rem', display: 'flex', justifyContent: 'center' }}>
          <SMSLoader aria-label="Loading" />
        </div>
      </SMSFormPage>
    );
  }

  return (
    <SMSFormPage
      title={MENU_ITEMS.SPECIAL_EVENT_APPROVAL}
      subtitle="Review and record the decision for this special event request."
      hideBackButton
    >
      <SMSGrid container spacing={2} className="vehicle-approval" sx={{ alignItems: 'flex-start' }}>
        <SMSGrid item xs={12}>
        <section className="app-form__section vehicle-approval__section vehicle-approval__summary-section">
          <div className="vehicle-approval__summary">
            <div className="vehicle-approval__summary-left">
              <div className="vehicle-approval__summary-title">
                Special Event Approval Request
              </div>
              <div className="vehicle-approval__summary-row">
                <span className="vehicle-approval__summary-label">Request ID</span>
                <span className="vehicle-approval__summary-value">
                  {approvalState.requestID || '-'}
                </span>
                <span className="vehicle-approval__status-pill">
                  <SMSIcon name="info" size="sm" className="vehicle-approval__status-icon" />
                  <span>Request Received</span>
                </span>
              </div>
            </div>
            <div className="vehicle-approval__summary-right">
              <SMSIcon name="calendar" size="sm" className="vehicle-approval__summary-icon" />
              <span className="vehicle-approval__summary-received-label">Received</span>
              <span className="vehicle-approval__summary-received-value">-</span>
            </div>
          </div>
        </section>
        </SMSGrid>

        <SMSGrid item xs={12} md={8} className="vehicle-approval__left">
          <section className="app-form__section vehicle-approval__section">
            <div className="app-form__section-title">
              {requesterHeader}
            </div>
            <SMSGrid container rowSpacing={0.5} columnSpacing={1.5} className="vehicle-approval__details-grid">
              <SMSGrid item xs={12} sm={6} md={4}>
              <div className="vehicle-approval__detail">
                <span className="vehicle-approval__detail-label">Organization</span>
                <span className="vehicle-approval__detail-value">
                  {isDetailLoading ? '-' : organizationName}
                </span>
              </div>
              </SMSGrid>
              <SMSGrid item xs={12} sm={6} md={4}>
              <div className="vehicle-approval__detail">
                <span className="vehicle-approval__detail-label">Contact</span>
                <span className="vehicle-approval__detail-value">
                  {isDetailLoading ? '-' : contactDisplay}
                </span>
              </div>
              </SMSGrid>
              <SMSGrid item xs={12} sm={6} md={4}>
              <div className="vehicle-approval__detail">
                <span className="vehicle-approval__detail-label">Email</span>
                <span className="vehicle-approval__detail-value">
                  {isDetailLoading ? '-' : emailDisplay}
                </span>
              </div>
              </SMSGrid>
            </SMSGrid>
          </section>

          <section className="app-form__section vehicle-approval__section">
            <div className="app-form__section-title">
              {requestDetailsHeader}
            </div>
            <SMSGrid container rowSpacing={0.5} columnSpacing={1.5} className="vehicle-approval__details-grid">
              <SMSGrid item xs={12} sm={6} md={4}>
              <div className="vehicle-approval__detail">
                <span className="vehicle-approval__detail-label">
                  {POST_POSITION.DETAIL_MODAL.REQUESTED_DATE}
                </span>
                <span className="vehicle-approval__detail-value">
                  {isDetailLoading ? '-' : requestedDateDisplay}
                </span>
              </div>
              </SMSGrid>
              <SMSGrid item xs={12}>
              <div className="vehicle-approval__detail vehicle-approval__detail--full">
                <span className="vehicle-approval__detail-label">Description</span>
                <span className="vehicle-approval__detail-value">-</span>
              </div>
              </SMSGrid>
            </SMSGrid>
          </section>

          <section className="app-form__section vehicle-approval__section">
            <div className="app-form__section-title">
              {postDetailsHeader}
            </div>
            <div className="vehicle-approval__post-list">
              {isDetailLoading && (
                <SMSCard className="vehicle-approval__post-card" padding="sm" elevation={1}>
                  <div className="vehicle-approval__post-header">
                    <div className="vehicle-approval__post-header-main">
                      <div className="vehicle-approval__post-title">Post</div>
                      <div className="vehicle-approval__post-start-time">
                        Start Time: -
                      </div>
                    </div>
                    <div className="vehicle-approval__post-subtitle">
                      Assignment: TBD
                    </div>
                  </div>
                  <div className="vehicle-approval__post-meta">
                    <span>-</span>
                  </div>
                </SMSCard>
              )}

              {!isDetailLoading && hasPostDetails && (
                <>
                  {postDetails.map((post: VehicleApprovalPostDetailDto, index: number) => (
                    <SMSCard
                      key={`${post.postTitle || 'post'}-${index}`}
                      className="vehicle-approval__post-card"
                      padding="sm"
                      elevation={1}
                    >
                      <div className="vehicle-approval__post-header">
                        <div className="vehicle-approval__post-header-main">
                          <div className="vehicle-approval__post-title">
                            {post.postTitle?.trim() || `Post ${index + 1}`}
                          </div>
                          <div className="vehicle-approval__post-start-time">
                            Start Time{' '}
                            {post.postStartTime?.trim() || '-'}
                          </div>
                        </div>
                        <div className="vehicle-approval__post-subtitle">
                          Assignment: TBD
                        </div>
                      </div>
                      <div className="vehicle-approval__post-meta">
                        <span>{post.location?.trim() || '-'}</span>
                      </div>
                    </SMSCard>
                  ))}
                </>
              )}

              {!isDetailLoading && !hasPostDetails && (
                <SMSCard className="vehicle-approval__post-card" padding="sm" elevation={1}>
                  <div className="vehicle-approval__post-header">
                    <div className="vehicle-approval__post-header-main">
                      <div className="vehicle-approval__post-title">
                        Post
                      </div>
                      <div className="vehicle-approval__post-start-time">
                        Start Time: -
                      </div>
                    </div>
                    <div className="vehicle-approval__post-subtitle">
                      Assignment: TBD
                    </div>
                  </div>
                  <div className="vehicle-approval__post-meta">
                    <span>-</span>
                  </div>
                </SMSCard>
              )}
            </div>
          </section>
        </SMSGrid>

        <SMSGrid item xs={12} md={4} className="vehicle-approval__right">
          <SMSCard className="vehicle-approval__routing-card" padding="md" elevation={1}>
            <div className="vehicle-approval__routing-header">
              <span className="vehicle-approval__routing-title">Approval Routing</span>
            </div>
            <div className="vehicle-approval__routing-list">
              {routingGroups.map((group) => {
                const status = routingGroupStatuses[group.id] ?? null;

                const statusClass =
                  status === true
                    ? ' vehicle-approval__routing-item--approved'
                    : status === false
                    ? ' vehicle-approval__routing-item--rejected'
                    : '';

                const selectedClass =
                  approvalState.routeToID === group.id
                    ? ' vehicle-approval__routing-item--selected'
                    : '';

                const description =
                  status === true
                    ? 'Approved'
                    : status === false
                    ? 'Rejected'
                    : group.description;

                return (
                  <div
                    key={group.id}
                    className={`vehicle-approval__routing-item${selectedClass}${statusClass}`}
                  >
                    <div className="vehicle-approval__routing-icon">
                      <SMSIcon name="group" size="sm" />
                    </div>
                    <div className="vehicle-approval__routing-text">
                      <div className="vehicle-approval__routing-label">
                        {group.label}
                      </div>
                      <div className="vehicle-approval__routing-description">
                        {description}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </SMSCard>

          <SMSCard className="vehicle-approval__comment-card" padding="md" elevation={1}>
            <div className="vehicle-approval__comment-header">
              <span className="vehicle-approval__comment-title">Approver Comments</span>
            </div>
            <SMSTextArea
              rows={4}
              placeholder="Add an optional comment for this approval..."
              value={approvalState.vehApproverComments ?? ''}
              onChange={handleCommentsChange}
              name="vehApproverComments"
              id="specialEventApproverComments"
              fullWidth
            />
          </SMSCard>

          <div className="vehicle-approval__actions">
            <SMSButton color="success"
              fullWidth
              className={`vehicle-approval__action-button${
                isApproved ? ' vehicle-approval__action-button--active' : ''
              }`}
              onClick={() => handleDecision(true)}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Approve Request'}
            </SMSButton>
            <SMSButton color="error"
              fullWidth
              className={`vehicle-approval__action-button${
                isRejected ? ' vehicle-approval__action-button--active' : ''
              }`}
              onClick={() => handleDecision(false)}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Reject Request'}
            </SMSButton>
          </div>
        </SMSGrid>
      </SMSGrid>
    </SMSFormPage>
  );
};

