/**
 * Row / date helpers and default form seed for the close job form.
 */
import { formatTimeToHHmm, timeStringToMinutes, formatDateToYYYYMMDD } from '@/utils/dateTimeUtils';
import { addDays, isValid, parseISO, startOfDay } from 'date-fns';
import type { PostCloseFormData } from '@/types/postCloseForm';
import type { PostPositionResponse } from '@/types/postPosition';
import type { EmployeePostListingItem } from '@/types/employeePostListingItem';

export const WORK_START_PICKER_DAY_FORMAT = 'yyyy-MM-dd';

export const minutesToHHmm = (totalMinutes: number): string => {
  const safeMinutes = Math.max(0, totalMinutes);
  const hh = String(Math.floor(safeMinutes / 60)).padStart(2, '0');
  const mm = String(safeMinutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
};

/**
 * Clock time when the closed segment ends: work start time + "hours worked" duration (as HH:mm).
 * Used to prefill split job position start (new segment starts when the first ends).
 * Rolls the calendar date when the sum crosses midnight.
 */
export function splitEndTimeFromWorkStartAndDuration(
  workStartDateYmd: string,
  workStartTime: string,
  hoursWorkedAsDuration: string
): { date: string; time: string } | null {
  const day = String(workStartDateYmd || '').split('T')[0].trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const t0 = formatTimeToHHmm(workStartTime) ?? '';
  const dur = formatTimeToHHmm(hoursWorkedAsDuration) ?? '';
  if (!t0 || !dur) return null;
  const startM = timeStringToMinutes(t0);
  const durM = timeStringToMinutes(dur);
  const total = startM + durM;
  const dayOffset = Math.floor(total / 1440);
  const endM = total % 1440;
  const time = minutesToHHmm(endM);
  if (dayOffset === 0) {
    return { date: day, time };
  }
  const base = parseISO(day);
  if (!isValid(base)) {
    return { date: day, time };
  }
  return { date: formatDateToYYYYMMDD(addDays(base, dayOffset)), time };
}

/** Calendar day at local midnight for range checks (value matches SMSDatePicker `YYYY-MM-DD`). */
export const parseDayOnlyLocal = (dateStr: string | undefined | null): Date | null => {
  if (dateStr == null || String(dateStr).trim() === '') return null;
  const day = String(dateStr).trim().split('T')[0]!;
  const d = parseISO(day);
  return isValid(d) ? startOfDay(d) : null;
};

/**
 * First non-empty trimmed id — list DTOs may put the operative id on `parentPostPositionId` only.
 * Used by `getDefaultFormData` and `SMSCloseForm` so bootstrap, view-details, and submit all use the same id.
 */
export function coalescePostPositionId(
  postPosition: PostPositionResponse | EmployeePostListingItem,
  raw: Record<string, unknown>
): string {
  const listing = postPosition as EmployeePostListingItem;
  const resp = postPosition as PostPositionResponse;
  const candidates: unknown[] = [
    raw.postPositionId,
    raw.PostPositionID,
    raw.parentPostPositionId,
    raw.ParentPostPositionId,
    listing.postPositionId,
    listing.parentPostPositionId,
    resp.postPositionId,
  ];
  for (const v of candidates) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s !== '') return s;
  }
  return '';
}

/** Normalize row from list (API may return PascalCase). */
export const getDefaultFormData = (
  postPosition: PostPositionResponse | EmployeePostListingItem,
  employeeName: string,
  employeeID: string
): PostCloseFormData => {
  const raw = postPosition as unknown as Record<string, unknown>;
  const now = new Date();
  const dateStr = formatDateToYYYYMMDD(now);
  const timeStr = now.toTimeString().slice(0, 5);
  const postPositionId = coalescePostPositionId(postPosition, raw);
  const postID = String(postPosition.postID ?? raw.PostID ?? '').trim();
  const postTitle = String(postPosition.postTitle ?? raw.PostTitle ?? '').trim();
  const dateOfWork = String(
    raw.startDate ??
      raw.StartDate ??
      (postPosition as PostPositionResponse).startDate ??
      (postPosition as PostPositionResponse).dateOfWork ??
      (postPosition as EmployeePostListingItem).startDate ??
      raw.DateOfWork ??
      ''
  ).split('T')[0];
  const postStartTime = String(
    raw.startTime ??
      raw.StartTime ??
      (postPosition as PostPositionResponse).postStartTime ??
      (postPosition as EmployeePostListingItem).startTime ??
      raw.PostStartTime ??
      ''
  );
  const postEndTimeRaw =
    (postPosition as PostPositionResponse).postEndTime ??
    raw.postEndTime ??
    raw.PostEndTime ??
    '';
  return {
    postPositionId: postPositionId || '',
    employeeID,
    employeeName,
    postID: postID || '',
    postTitle: postTitle || '',
    workStartDate: dateOfWork || '',
    workStartTime: formatTimeToHHmm(postStartTime) ?? '',
    workEndTime: formatTimeToHHmm(String(postEndTimeRaw)) ?? '',
    hoursWorked: '',
    workedOnDuty: false,
    comment: '',
    requestedStartDate: dateOfWork || '',
    requestedStartTime: formatTimeToHHmm(postStartTime) ?? '',
    closeBy: employeeName,
    closeDateTime: `${dateStr} ${timeStr}`,
    isMinimumDue: false,
    minimumHoursDue: '',
    reimburseStatus: '',
    payRate: '',
    reimbursePayRate: '',

    departmentEquipment: '',
    isWorked: true,
    noWorkReason: '',
    isUnPaidBreakTime: false,
    breakTime: '',
    equipmentUsedIsVehicle: false,
    vehicleOwnedBy: '',
    vehNumber: '',
    startMileage: '',
    endMileage: '',
    usedEquipmentQuantity: '',
    equipmentUsedHours: '',
    paidHours: '',
    splitEmployeeID: '',
    splitEmployeeName: '',
    splitStartDate: dateOfWork || dateStr,
    splitStartTime: timeStr,
    splitEndTime: formatTimeToHHmm(String(postEndTimeRaw)) ?? '',
  };
};

/** Work-day string for close form: detail rows use `dateOfWork`; unified list rows use `startDate`. */
export function closeFormWorkDateString(pp: PostPositionResponse | EmployeePostListingItem): string {
  if ('dateOfWork' in pp && pp.dateOfWork != null && String(pp.dateOfWork).trim() !== '') {
    return String(pp.dateOfWork).trim().split('T')[0] ?? '';
  }
  if ('startDate' in pp && pp.startDate != null) {
    return String(pp.startDate).trim().split('T')[0] ?? '';
  }
  return '';
}

export function closeFormScheduledStartTime(pp: PostPositionResponse | EmployeePostListingItem): string | undefined {
  if ('postStartTime' in pp && pp.postStartTime != null && String(pp.postStartTime).trim() !== '') {
    return String(pp.postStartTime).trim();
  }
  if ('startTime' in pp && pp.startTime != null && String(pp.startTime).trim() !== '') {
    return String(pp.startTime).trim();
  }
  return undefined;
}

/**
 * {@link mapPostPositionListViewDetails} expects an employee list row; normalize from either list row or post-position detail DTO.
 */
export function viewDetailsQueryRow(pp: PostPositionResponse | EmployeePostListingItem): EmployeePostListingItem {
  if (typeof (pp as EmployeePostListingItem).orderNumber === 'number') {
    return pp as EmployeePostListingItem;
  }
  const r = pp as PostPositionResponse;
  const raw = pp as unknown as Record<string, unknown>;
  const startDate = closeFormWorkDateString(pp) || String(r.dateOfWork ?? '').trim().split('T')[0] || '';
  const startTime = closeFormScheduledStartTime(pp) || String(r.postStartTime ?? '').trim() || '';
  const postId = String(r.postID ?? raw.PostID ?? '').trim();
  const reqId = String(r.requestID ?? raw.RequestID ?? '').trim();
  const ppId = String(r.postPositionId ?? raw.PostPositionID ?? raw.postPositionID ?? '').trim() || null;
  const isSpecialEventRaw = raw.isSpecialEvent ?? raw.IsSpecialEvent;
  return {
    requestID: reqId,
    postID: postId,
    postTitle: String(r.postTitle ?? ''),
    postLocation: r.postLocation ?? null,
    postLength: Number(r.postLength ?? r.lengthOfWork ?? 0),
    totalPositions: Number(r.totalPostPositions ?? 0),
    availablePositions: null,
    isSpecialEvent: isSpecialEventRaw === true ? true : isSpecialEventRaw === false ? false : null,
    releaseAs: 0,
    postPositionId: ppId,
    postPositionStatus: r.postPositionStatus ?? 0,
    parentPostPositionId: (r.parentPostPositionId ?? null) as string | null,
    isSplit: raw.isSplit === true ? true : raw.isSplit === false ? false : null,
    splitPostPositionID: (r.splitPostPositionID ?? null) as string | null,
    showVehicle: (raw.showVehicle as boolean | null | undefined) ?? (raw.ShowVehicle as boolean | null | undefined) ?? null,
    showEquipment:
      (raw.showEquipment as boolean | null | undefined) ?? (raw.ShowEquipment as boolean | null | undefined) ?? null,
    startDate,
    startTime,
    closedPostPositionID: (r.closedPostPositionID ?? null) as string | null,
    waitingPostPositionId: null,
    orderNumber: 0,
    hasAppliedInTenure: false,
    processingStatus: 0,
    requestTitle: null,
    failureReason: null,
    employeeID: r.employeeID,
  };
}
