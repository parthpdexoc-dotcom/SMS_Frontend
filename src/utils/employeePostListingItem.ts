import type { EmployeePostListingItem } from '@/types/employeePostListingItem';
import { PostPositionStatus } from '@/types/postPosition';

function readString(raw: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = raw[k];
    if (v == null) continue;
    return String(v);
  }
  return '';
}

function readStringNull(raw: Record<string, unknown>, ...keys: string[]): string | null {
  const s = readString(raw, ...keys).trim();
  return s === '' ? null : s;
}

function readNumber(raw: Record<string, unknown>, ...keys: string[]): number {
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
    if (typeof v === 'string' && v.trim() !== '') {
      const n = Number(v);
      if (!Number.isNaN(n)) return n;
    }
  }
  return 0;
}

function readNumberNull(raw: Record<string, unknown>, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = raw[k];
    if (v == null) continue;
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
    if (typeof v === 'string' && v.trim() !== '') {
      const n = Number(v);
      if (!Number.isNaN(n)) return n;
    }
  }
  return null;
}

/**
 * Display title on list DTOs: API sends `title` / `Title` (value depends on `isSpecialEvent`), or nested `post` / `Post.title`.
 */
export function readPostTitleFromRow(o: Record<string, unknown>): string {
  const direct = readStringNull(o, 'postTitle', 'PostTitle', 'title', 'Title');
  if (direct) return direct;
  const titleKeys = ['title', 'Title'] as const;
  for (const k of titleKeys) {
    const v = o[k];
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  const post = (o.post ?? o.Post) as Record<string, unknown> | undefined;
  if (post && typeof post === 'object') {
    for (const k of titleKeys) {
      const v = post[k];
      if (v == null) continue;
      const s = String(v).trim();
      if (s) return s;
    }
  }
  return '';
}

function readBooleanNull(raw: Record<string, unknown>, ...keys: string[]): boolean | null {
  for (const k of keys) {
    const v = raw[k];
    if (v == null) continue;
    if (typeof v === 'boolean') return v;
    if (v === 'true') return true;
    if (v === 'false') return false;
    return Boolean(v);
  }
  return null;
}

function readBoolean(raw: Record<string, unknown>, ...keys: string[]): boolean {
  return readBooleanNull(raw, ...keys) ?? false;
}

/**
 * Parse one JSON object into {@link EmployeePostListingItem}.
 * Accepts camelCase or PascalCase property names from the API.
 */
export function parseEmployeePostListingItem(raw: unknown): EmployeePostListingItem {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid employee post listing row');
  }
  const o = raw as Record<string, unknown>;
  const nestedEmployee = (o.employee ?? o.Employee) as Record<string, unknown> | undefined;
  const readEmployeeField = (rootKeys: string[], nestedKeys: string[]): string | null => {
    const fromRoot = readStringNull(o, ...rootKeys);
    if (fromRoot) return fromRoot;
    if (nestedEmployee && typeof nestedEmployee === 'object') {
      return readStringNull(nestedEmployee, ...nestedKeys);
    }
    return null;
  };

  const startDateRaw = readString(
    o,
    'startDate',
    'StartDate',
    'dateOfWork',
    'DateOfWork',
    'workStartDate',
    'WorkStartDate'
  ).slice(0, 10);
  const postLoc = readStringNull(o, 'postLocation', 'PostLocation', 'location', 'Location', 'workLocation', 'WorkLocation');
  const nestedPost = (o.post ?? o.Post) as Record<string, unknown> | undefined;
  const postEndTimeFromNested =
    nestedPost && typeof nestedPost === 'object'
      ? readStringNull(nestedPost, 'postEndTime', 'PostEndTime', 'endTime', 'EndTime')
      : null;
  const postEndTime =
    readStringNull(
      o,
      'postEndTime',
      'PostEndTime',
      'endTime',
      'EndTime'
    ) ?? postEndTimeFromNested;
  const workStartTime = readStringNull(o, 'workStartTime', 'WorkStartTime');
  const workEndTime = readStringNull(o, 'workEndTime', 'WorkEndTime');

  const closedPpId = readStringNull(o, 'closedPostPositionID', 'ClosedPostPositionID');
  const fromPostPosStatus = readNumber(o, 'postPositionStatus', 'PostPositionStatus');
  const fromStatus = readNumberNull(o, 'status', 'Status');
  let postPositionStatus: number;
  if (fromPostPosStatus > 0) {
    postPositionStatus = fromPostPosStatus;
  } else if (fromStatus != null && fromStatus > 0) {
    if (closedPpId) {
      // GET .../ClosedPostPosition/.../close-assignments — status uses ClosedPostPositionStatus (1=Closed, 2=Unclosed).
      if (fromStatus === 1) postPositionStatus = PostPositionStatus.Closed;
      else if (fromStatus === 2) postPositionStatus = PostPositionStatus.Unclosed;
      else postPositionStatus = fromStatus;
    } else {
      postPositionStatus = fromStatus;
    }
  } else {
    postPositionStatus = 0;
  }

  return {
    requestID: readString(o, 'requestID', 'RequestID'),
    postID: readString(o, 'postID', 'PostID'),
    postTitle: readPostTitleFromRow(o),
    postLocation: postLoc,
    postLength: readNumber(o, 'postLength', 'PostLength', 'lengthOfWork', 'LengthOfWork'),
    hoursWorked: readNumberNull(o, 'hoursWorked', 'HoursWorked'),
    totalPositions: readNumber(o, 'totalPositions', 'TotalPositions', 'totalPostPositions', 'TotalPostPositions'),
    availablePositions: readNumberNull(o, 'availablePositions', 'AvailablePositions'),
    isSpecialEvent: readBooleanNull(o, 'isSpecialEvent', 'IsSpecialEvent'),
    showVehicle: readBooleanNull(o, 'showVehicle', 'ShowVehicle'),
    showEquipment: readBooleanNull(o, 'showEquipment', 'ShowEquipment'),
    releaseAs: readNumber(o, 'releaseAs', 'ReleaseAs'),
    postPositionId: readStringNull(o, 'postPositionId', 'PostPositionId', 'postPositionID', 'PostPositionID'),
    postPositionStatus,
    parentPostPositionId: readStringNull(o, 'parentPostPositionId', 'ParentPostPositionId'),
    isSplit: readBooleanNull(o, 'isSplit', 'IsSplit'),
    splitPostPositionID: readStringNull(o, 'splitPostPositionID', 'SplitPostPositionID', 'splitPostPositionId'),
    startDate: startDateRaw,
    dayOfWeek: readStringNull(o, 'dayOfWeek', 'DayOfWeek', 'dayofweek', 'Dayofweek'),
    jobRank: readStringNull(o, 'jobRank', 'JobRank', 'jobrank', 'Jobrank'),
    payCodeValue: readStringNull(o, 'payCodeValue', 'PayCodeValue'),
    startTime: readString(o, 'startTime', 'StartTime', 'postStartTime', 'PostStartTime', 'workStartTime', 'WorkStartTime'),
    postEndTime,
    workStartTime,
    workEndTime,
    closedPostPositionID: readStringNull(o, 'closedPostPositionID', 'ClosedPostPositionID'),
    waitingPostPositionId: readStringNull(o, 'waitingPostPositionId', 'WaitingPostPositionId'),
    orderNumber: readNumber(o, 'orderNumber', 'OrderNumber'),
    hasAppliedInTenure: readBoolean(o, 'hasAppliedInTenure', 'HasAppliedInTenure'),
    processingStatus: readNumber(o, 'processingStatus', 'ProcessingStatus'),
    requestTitle: readStringNull(o, 'requestTitle', 'RequestTitle'),
    requesterID: readStringNull(o, 'requesterID', 'RequesterID', 'requesterId', 'RequesterId'),
    requesterTitle: readStringNull(
      o,
      'requesterTitle',
      'RequesterTitle',
      'requesterName',
      'RequesterName'
    ),
    failureReason: readStringNull(o, 'failureReason', 'FailureReason'),
    employeeID: readEmployeeField(
      [
        'employeeID',
        'EmployeeID',
        'employeeId',
        'EmployeeId',
        'assignedEmployeeID',
        'AssignedEmployeeID',
        'assignedEmployeeId',
        'AssignedEmployeeId',
      ],
      ['employeeID', 'EmployeeID', 'employeeId', 'EmployeeId']
    ),
    employeeName: readEmployeeField(
      [
        'employeeName',
        'EmployeeName',
        'assignedEmployeeName',
        'AssignedEmployeeName',
        'fullName',
        'FullName',
      ],
      ['employeeName', 'EmployeeName', 'fullName', 'FullName']
    ),
    cancelledBy: readStringNull(o, 'cancelledBy'),
    firstName: readEmployeeField(['firstName', 'FirstName'], ['firstName', 'FirstName']),
    lastName: readEmployeeField(['lastName', 'LastName'], ['lastName', 'LastName']),
    badgeNumber: readEmployeeField(['badgeNumber', 'BadgeNumber'], ['badgeNumber', 'BadgeNumber']),
    wasUnclosed: readBooleanNull(o, 'wasUnclosed', 'WasUnclosed', 'wasunclosed', 'WASUNCLOSED'),
    isUncloseDisabled: readBooleanNull(
      o,
      'isUncloseDisabled',
      'IsUncloseDisabled',
      'disableUnclose',
      'DisableUnclose'
    ),
    isPlaceholder: readBooleanNull(o, 'isPlaceholder', 'IsPlaceholder'),
    closeBy: readStringNull(o, 'closeBy', 'CloseBy'),
    createdBy: readStringNull(o, 'createdBy', 'CreatedBy'),
  };
}

/** Stable key for assign loading state when `postID` may be empty (special-event rows). */
export function getListingItemActionKey(post: EmployeePostListingItem): string {
  const req = post.requestID.trim();
  const date = post.startDate.slice(0, 10);
  if (post.isSpecialEvent === true && req) {
    return `se:${req}:${date}`;
  }
  const pid = post.postID.trim();
  return pid || `se:${req}:${date}`;
}
