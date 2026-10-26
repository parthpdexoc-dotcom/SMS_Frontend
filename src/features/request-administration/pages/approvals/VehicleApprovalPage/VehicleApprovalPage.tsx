import { SMSButton, SMSGrid, SMSCard, SMSIcon, SMSChip, SMSLoader, SMSTextArea, SMSTypography } from '@/components/smsatoms';
import { SMSDataDisplay } from '@/components/smsmolecules';
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
import { buildAvailableJobsLandingPathWithQuery } from '@/constants/availableJobsRouteTabs';
import { MENU_ITEMS, POST_POSITION, ROUTING_GROUP } from '@/constants/strings';
import {
  submitVehicleApprovalDetailThunk,
  fetchVehicleApprovalRequestDetailThunk,
} from '@/store/slices/approvalDetailSlice';
import { fetchRequestRoutingGroupsByRequestIdThunk } from '@/store/slices/requestApprovalRoutingSlice';
import '@/styles/forms.css';
import './VehicleApprovalPage.css';

export const VehicleApprovalPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const params = useParams<{ requestId?: string; routingGroupId?: string }>();

  // Read IDs from path params first (no param names in URL), then state, then query string.
  const navState = (location.state ?? null) as
    | {
        requestId?: string;
        routingGroupId?: string;
      }
    | null;

  const requestIdFromPath = params.requestId ?? '';
  const routingGroupIdFromPath = params.routingGroupId ?? '';
  const requestIdFromState = navState?.requestId;
  const routingGroupIdFromState = navState?.routingGroupId;

  const requestIdFromQuery =
    requestIdFromPath || searchParams.get('requestId') || requestIdFromState || '';
  const routingGroupIdEffective =
    routingGroupIdFromPath ||
    searchParams.get('routingGroupId') ||
    routingGroupIdFromState ||
    '';

  const isPermitApprovalFlow = location.pathname.includes('/admin/permit-approval');
  const approvalTypeForFlow = isPermitApprovalFlow
    ? ApprovalType.PremitApproval
    : ApprovalType.VehicleApproval;

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

  // Redirect query-based URLs to path-only so param names (requestId, routingGroupId) are removed from the URL.
  const hasPathParams = !!(params.requestId && params.routingGroupId);
  const fromQuery =
    searchParams.get('requestId') ||
    searchParams.get('routingGroupId');
  useEffect(() => {
    if (hasPathParams || !fromQuery) return;
    if (requestIdFromQuery && routingGroupIdEffective) {
      const base = isPermitApprovalFlow ? '/admin/permit-approval' : '/admin/vehicle-approval';
      navigate(`${base}/${requestIdFromQuery}/${routingGroupIdEffective}`, { replace: true });
    }
  }, [
    hasPathParams,
    fromQuery,
    requestIdFromQuery,
    routingGroupIdEffective,
    navigate,
    isPermitApprovalFlow,
  ]);

  const isApproved = approvalState.approved === true;
  const isRejected = approvalState.approved === false;

  const hasApprovalContext =
    !!requestIdFromQuery && !!routingGroupIdEffective;

  const stripTrailingColon = (label: string): string =>
    label.replace(/\s*:$/, '');

  const requesterHeader = stripTrailingColon(POST_POSITION.DETAIL_MODAL.REQUESTER_INFO);
  const requestDetailsHeader = stripTrailingColon(POST_POSITION.DETAIL_MODAL.REQUEST_DETAILS);
  const postDetailsHeader = stripTrailingColon(POST_POSITION.DETAIL_MODAL.POST_DETAILS);

  const pageTitle = isPermitApprovalFlow
    ? ROUTING_GROUP.FORM.APPROVAL_TYPE_PERMIT
    : MENU_ITEMS.VEHICLE_APPROVAL;
  const pageSubtitle = isPermitApprovalFlow
    ? 'Review and record the decision for this permit request.'
    : 'Review and record the decision for this vehicle utilization request.';
  const summaryKindLabel = isPermitApprovalFlow ? 'Permit Request' : 'Vehicle Utilization Request';

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
          type: approvalTypeForFlow,
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

      navigate(
        isPermitApprovalFlow
          ? '/admin/permit-approval/confirmation'
          : '/admin/vehicle-approval/confirmation',
        { replace: true }
      );
    })();
  };

  // Load routing groups for this request so the Approval Routing list
  // reflects all routing groups configured on the request.
  useEffect(() => {
    if (!requestIdFromQuery) {
      setRoutingGroups([]);
      return;
    }

    let cancelled = false;

    const loadRoutingGroups = async (): Promise<void> => {
      try {
        let mapped:
          | {
              id: string;
              label: string;
              description: string;
              rank: number;
              approvalType: ApprovalType;
              hasFinalAuthority: boolean;
            }[]
          | undefined;

        const apiGroups = await dispatch(
          fetchRequestRoutingGroupsByRequestIdThunk(requestIdFromQuery)
        ).unwrap();

        if (cancelled) return;

        mapped = apiGroups
          .filter((g) => g.approverID)
          .map((g) => ({
            id: g.approverID,
            label: g.routingGroupName?.trim() || 'Routing Group',
            // Placeholder until we surface per-group status/assignee information.
            description: 'Not Yet Assigned',
            rank: g.rank,
            approvalType: g.approvalType as ApprovalType,
            hasFinalAuthority:
              g.requestApproverHasFinalAuthority ?? false,
          }));

        if (!mapped) return;

        setRoutingGroups(mapped);

        // If no routing group is currently selected, default to the first one.
        if (!approvalState.routeToID && mapped[0]?.id) {
          setApprovalState((prev: ApprovalDetail) => ({
            ...prev,
            routeToID: mapped[0]?.id ?? prev.routeToID,
          }));
        }
      } catch (error) {
        // Non-critical; just log for debugging.
        // eslint-disable-next-line no-console
        console.error(
          'VehicleApprovalPage: failed to load routing groups for request',
          error
        );
      }
    };

    void loadRoutingGroups();

    return () => {
      cancelled = true;
    };
  }, [requestIdFromQuery, approvalState.routeToID]);

  // Load any existing approval detail when request + routing group are known.
  // This lets us pre-populate IDs on the approval payload using the
  // consolidated ApprovalDetail/approval-request-detail API.
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
            approvalType: approvalTypeForFlow,
          })
        ).unwrap();

        if (!existing || cancelled) return;

        setApprovalDetail(existing);

        setApprovalState((prev: ApprovalDetail) => ({
          ...prev,
          // The consolidated detail API echoes back the request + routing group IDs.
          requestID: existing.requestId ?? prev.requestID,
          routeToID: existing.routingGroupId ?? prev.routeToID,
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('Forbidden')) {
          navigate('/forbidden', { replace: true });
          return;
        }
        // Non-critical; just log for debugging
        // eslint-disable-next-line no-console
        console.error('VehicleApprovalPage: failed to load existing detail', error);
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
  }, [requestIdFromQuery, approvalState.routeToID, approvalTypeForFlow, dispatch, navigate]);

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

  const vehiclesRequiredDisplay =
    approvalDetail?.requestVehicleInfo?.vehiclesRequired != null
      ? String(approvalDetail.requestVehicleInfo.vehiclesRequired)
      : '-';

  const vehicleTypeDisplay =
    approvalDetail?.requestVehicleInfo?.vehicleType?.trim() || '-';

  const postDetails = approvalDetail?.postDetails ?? [];
  const hasPostDetails = postDetails.length > 0;

  // Derive per-routing-group approval status from the consolidated
  // ApprovalDetail/approval-request-detail response.
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
        title={pageTitle}
        subtitle="Loading approval request..."
        hideBackButton
      >
        <div style={{ padding: '2rem', display: 'flex', justifyContent: 'center' }}>
          <SMSLoader aria-label="Loading" />
        </div>
      </SMSFormPage>
    );
  }

  // When the current approver has already submitted, show the "Vehicle Approval Recorded" confirmation screen (no form).
  if (!isDetailLoading && approvalDetail?.alreadySubmittedByCurrentApprover) {
    return (
      <SMSFormPage
        title={isPermitApprovalFlow ? 'Permit Approval Recorded' : 'Vehicle Approval Recorded'}
        subtitle="Your approval decision has been recorded successfully."
        hideBackButton
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
            alignItems: 'flex-start',
          }}
        >
          <p style={{ margin: 0 }}>
            {isPermitApprovalFlow
              ? 'Thank you. Your decision for this permit request has been saved. You may now close this window or return to the main dashboard.'
              : 'Thank you. Your decision for this vehicle utilization request has been saved. You may now close this window or return to the main dashboard.'}
          </p>
          <SMSButton
            onClick={() => navigate(buildAvailableJobsLandingPathWithQuery())}
            type="button"
          >
            Back to Available Jobs
          </SMSButton>
        </div>
      </SMSFormPage>
    );
  }

  return (
    <SMSFormPage
      title={pageTitle}
      subtitle={pageSubtitle}
      hideBackButton
    >
      <SMSGrid container spacing={2} className="vehicle-approval" sx={{ alignItems: 'flex-start' }}>
        <SMSGrid item xs={12}>
        <section className="app-form__section vehicle-approval__section vehicle-approval__summary-section">
          <div className="vehicle-approval__summary">
            <div className="vehicle-approval__summary-left">
              <div className="vehicle-approval__summary-title">
                <SMSTypography variant="h6">{summaryKindLabel}</SMSTypography>
              </div>
              <div className="vehicle-approval__summary-row">
                <SMSDataDisplay
                  label="Request ID"
                  value={approvalState.requestID || '-'}
                  variant="inline"
                  labelVariant="body2"
                  valueVariant="body2"
                  labelFontWeight={600}
                />
                <SMSChip
                  className="vehicle-approval__request-status-chip"
                  size="small"
                  label="Request Received"
                  icon={<SMSIcon name="info" size="sm" />}
                />
              </div>
            </div>
            <div className="vehicle-approval__summary-right">
              <SMSIcon name="calendar" size="sm" className="vehicle-approval__summary-icon" />
              <SMSDataDisplay
                label="Received"
                value="-"
                variant="inline"
                labelVariant="caption"
                valueVariant="caption"
                labelFontWeight={600}
              />
            </div>
          </div>
        </section>
        </SMSGrid>

        <SMSGrid
          item
          xs={12}
          md={8}
          className="vehicle-approval__left"
          sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}
        >
          <section className="app-form__section vehicle-approval__section">
            <SMSTypography className="app-form__section-title" variant="h6">
              {requesterHeader}
            </SMSTypography>
            <div className="vehicle-approval__details-stack">
              <SMSDataDisplay
                label="Organization"
                value={isDetailLoading ? '-' : organizationName}
                variant="inline"
                labelVariant="body2"
                valueVariant="body2"
                labelFontWeight={600}
                className="vehicle-approval__data-display"
              />
              <SMSDataDisplay
                label="Contact"
                value={isDetailLoading ? '-' : contactDisplay}
                variant="inline"
                labelVariant="body2"
                valueVariant="body2"
                labelFontWeight={600}
                className="vehicle-approval__data-display"
              />
              <SMSDataDisplay
                label="Email"
                value={isDetailLoading ? '-' : emailDisplay}
                variant="inline"
                labelVariant="body2"
                valueVariant="body2"
                labelFontWeight={600}
                className="vehicle-approval__data-display"
              />
            </div>
          </section>

          <section className="app-form__section vehicle-approval__section">
            <SMSTypography className="app-form__section-title" variant="h6">
              {requestDetailsHeader}
            </SMSTypography>
            <div className="vehicle-approval__details-stack">
              <SMSDataDisplay
                label={POST_POSITION.DETAIL_MODAL.REQUESTED_DATE}
                value={isDetailLoading ? '-' : requestedDateDisplay}
                variant="inline"
                labelVariant="body2"
                valueVariant="body2"
                labelFontWeight={600}
                className="vehicle-approval__data-display"
              />
              <SMSDataDisplay
                label={POST_POSITION.DETAIL_MODAL.VEHICLES_REQUIRED}
                value={isDetailLoading ? '-' : vehiclesRequiredDisplay}
                variant="inline"
                labelVariant="body2"
                valueVariant="body2"
                labelFontWeight={600}
                className="vehicle-approval__data-display"
              />
              <SMSDataDisplay
                label="Vehicle Type"
                value={isDetailLoading ? '-' : vehicleTypeDisplay}
                variant="inline"
                labelVariant="body2"
                valueVariant="body2"
                labelFontWeight={600}
                className="vehicle-approval__data-display"
              />
              <SMSDataDisplay
                label="Description"
                value="-"
                variant="inline"
                labelVariant="body2"
                valueVariant="body2"
                labelFontWeight={600}
                className="vehicle-approval__data-display"
              />
            </div>
          </section>

          {(isDetailLoading || hasPostDetails) && (
            <section className="app-form__section vehicle-approval__section">
              <SMSTypography className="app-form__section-title" variant="h6">
                {postDetailsHeader}
              </SMSTypography>
              <div className="vehicle-approval__post-list">
                {isDetailLoading && (
                  <SMSCard className="vehicle-approval__post-card" padding="sm" elevation={1}>
                    <div className="vehicle-approval__post-header">
                      <div className="vehicle-approval__post-header-main">
                        <SMSTypography className="vehicle-approval__post-title" variant="body1" fontWeight={600}>
                          Post
                        </SMSTypography>
                        <SMSDataDisplay
                          label="Start Time"
                          value="-"
                          variant="inline"
                          labelVariant="body2"
                          valueVariant="body2"
                          labelFontWeight={600}
                        />
                      </div>
                      <SMSDataDisplay
                        label="Vehicle Assignment"
                        value="TBD"
                        variant="inline"
                        labelVariant="body2"
                        valueVariant="body2"
                        labelFontWeight={600}
                        className="vehicle-approval__post-subtitle"
                      />
                    </div>
                    <div className="vehicle-approval__post-meta">
                      <SMSTypography variant="body2" color="text.secondary">
                        -
                      </SMSTypography>
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
                            <SMSTypography className="vehicle-approval__post-title" variant="body1" fontWeight={600}>
                              <span className="vehicle-approval__post-number">{index + 1}</span>
                              {post.postTitle?.trim() || `Post ${index + 1}`}
                            </SMSTypography>
                            <SMSDataDisplay
                              label="Start Time"
                              value={post.postStartTime?.trim() || '-'}
                              variant="inline"
                              labelVariant="body2"
                              valueVariant="body2"
                              labelFontWeight={600}
                            />
                          </div>
                          <SMSDataDisplay
                            label="Vehicle Assignment"
                            value="TBD"
                            variant="inline"
                            labelVariant="body2"
                            valueVariant="body2"
                            labelFontWeight={600}
                            className="vehicle-approval__post-subtitle"
                          />
                        </div>
                        <div className="vehicle-approval__post-meta">
                          <SMSTypography variant="body2" color="text.secondary">
                            {post.location?.trim() || '-'}
                          </SMSTypography>
                        </div>
                      </SMSCard>
                    ))}
                  </>
                )}
              </div>
            </section>
          )}
        </SMSGrid>

        <SMSGrid
          item
          xs={12}
          md={4}
          className="vehicle-approval__right"
          sx={{ display: 'flex', flexDirection: 'column', gap: 1.2, minWidth: 0 }}
        >
          <SMSCard className="vehicle-approval__routing-card" padding="md" elevation={1}>
            <div className="vehicle-approval__routing-header">
              <SMSTypography className="vehicle-approval__routing-title" variant="h6">
                Approval Routing
              </SMSTypography>
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
                        <SMSTypography variant="body2" fontWeight={600}>
                          {group.label}
                        </SMSTypography>
                      </div>
                      <div className="vehicle-approval__routing-description">
                        <SMSTypography variant="caption" color="text.secondary">
                          {description}
                        </SMSTypography>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </SMSCard>

          <SMSCard className="vehicle-approval__comment-card" padding="md" elevation={1}>
            <div className="vehicle-approval__comment-header">
              <SMSTypography className="vehicle-approval__comment-title" variant="h6">
                Approver Comments
              </SMSTypography>
            </div>
            <SMSTextArea
              rows={4}
              placeholder="Add an optional comment for this approval..."
              value={approvalState.vehApproverComments ?? ''}
              onChange={handleCommentsChange}
              name="vehApproverComments"
              id="vehApproverComments"
              fullWidth
            />
          </SMSCard>

          <div className="vehicle-approval__actions">
            <SMSButton
              fullWidth
              className={`vehicle-approval__action-button${
                isApproved ? ' vehicle-approval__action-button--active' : ''
              }`}
              onClick={() => handleDecision(true)}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Approve Request'}
            </SMSButton>
            <SMSButton
              variant="outlined"
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

