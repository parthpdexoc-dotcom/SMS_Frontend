import { RequestStatus, RequestTypes } from '@/types/request';
import { getDefaultDailyAdminDateRange } from '@/utils/dateTimeUtils';

export const DEFAULT_REQUESTER_WITH_REQUESTS_STATUSES: ReadonlyArray<RequestStatus> = [
  RequestStatus.Pending,
  RequestStatus.ReleaseNow,
  RequestStatus.ReleasedOn,
];

/** Default request-type filter: all schedule kinds (matches backend `RequestTypes` enum). */
export const DEFAULT_REQUESTER_WITH_REQUEST_TYPES: ReadonlyArray<RequestTypes> = [
  RequestTypes.OneTime,
  RequestTypes.Daily,
  RequestTypes.Weekly,
  RequestTypes.Monthly,
  RequestTypes.Custom,
];

/** Request types shown as chips on Daily Workspace (Custom has no chip). */
export const DAILY_WORKSPACE_REQUEST_TYPES: ReadonlyArray<RequestTypes> = [
  RequestTypes.OneTime,
  RequestTypes.Daily,
  RequestTypes.Weekly,
  RequestTypes.Monthly,
];

export const DEFAULT_DAILY_WORKSPACE_REQUEST_TYPES = DAILY_WORKSPACE_REQUEST_TYPES;

/** Default Daily Workspace filter bar — matches Daily Administration defaults. */
export function buildDailyWorkspaceFilterDefaults(): {
  startDate: string;
  endDate: string;
  requestStatuses: RequestStatus[];
  requestTypes: RequestTypes[];
} {
  const { startDate, endDate } = getDefaultDailyAdminDateRange();
  return {
    startDate,
    endDate,
    requestStatuses: [...DEFAULT_REQUESTER_WITH_REQUESTS_STATUSES],
    requestTypes: [...DEFAULT_DAILY_WORKSPACE_REQUEST_TYPES],
  };
}

export function isDailyWorkspaceRequestType(value: number): value is RequestTypes {
  return (DAILY_WORKSPACE_REQUEST_TYPES as readonly number[]).includes(value);
}

/** Parse request-type values from URL params or session storage. */
export function readDailyWorkspaceRequestTypes(values: unknown): RequestTypes[] {
  if (!Array.isArray(values)) {
    return [...DEFAULT_DAILY_WORKSPACE_REQUEST_TYPES];
  }

  const types: RequestTypes[] = [];
  for (const value of values) {
    if (typeof value === 'number' && isDailyWorkspaceRequestType(value)) {
      types.push(value);
    }
  }
  return types;
}
