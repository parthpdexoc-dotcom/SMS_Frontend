import { ApprovalType } from '@/types/vehicleApproval';

function getUiBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  const basePath = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
  return basePath ? `${window.location.origin}${basePath}` : window.location.origin;
}

/**
 * Full Vehicle Approval page URL for a request and routing group (for email links).
 * Uses path segments only (no query param names in URL).
 * @returns e.g. http://localhost:5173/sms/VehicleApproval/{requestId}/{routingGroupId}
 */
export function getVehicleApprovalLink(
  requestId: string,
  routingGroupId: string
): string {
  return (
    (getUiBaseUrl() || '') +
    `/VehicleApproval/${requestId}/${routingGroupId}`
  );
}

/**
 * Full Special Event Approval page URL for a request and routing group (for email links).
 * @returns e.g. http://localhost:5173/sms/SpecialEventApproval/{requestId}/{routingGroupId}, or path-only when window is unavailable.
 */
export function getSpecialEventApprovalLink(
  requestId: string,
  routingGroupId: string
): string {
  return (
    (getUiBaseUrl() || '') + `/SpecialEventApproval/${requestId}/${routingGroupId}`
  );
}

/**
 * Full Permit Approval page URL for a request and routing group (for email links).
 * @returns e.g. http://localhost:5173/sms/PermitApproval/{requestId}/{routingGroupId}
 */
export function getPermitApprovalLink(
  requestId: string,
  routingGroupId: string
): string {
  return (
    (getUiBaseUrl() || '') + `/PermitApproval/${requestId}/${routingGroupId}`
  );
}

/** Deep link URL for the next approver email, based on that routing group's approval type. */
export function getApprovalEmailLinkForType(
  approvalType: ApprovalType,
  requestId: string,
  routingGroupId: string
): string {
  switch (approvalType) {
    case ApprovalType.SpecialEventApproval:
      return getSpecialEventApprovalLink(requestId, routingGroupId);
    case ApprovalType.PremitApproval:
      return getPermitApprovalLink(requestId, routingGroupId);
    case ApprovalType.VehicleApproval:
    default:
      return getVehicleApprovalLink(requestId, routingGroupId);
  }
}
