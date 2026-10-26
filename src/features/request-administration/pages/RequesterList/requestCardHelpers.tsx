import React from 'react';
import { formatDateShort, parseLocalDateFromString } from '@/utils';
import { ReleaseAs, RequestResponse, RequestScheduleDto, RequestStatus, type RequestTypeDto } from '@/types/request';
import { SMSWeekdayChips } from '@/components/smsorganisms';
import { WEEK_INDEX_LABELS } from '@/types/recurrence';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const ALL_WEEK_DAYS: number[] = [0, 1, 2, 3, 4, 5, 6];

function normalizeToDate(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function getCalendarDaysInRange(start: Date, end: Date): number {
  const s = normalizeToDate(start);
  const e = normalizeToDate(end);
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / MS_PER_DAY) + 1);
}

function normalizeDaysOfWeek(days: number[] | undefined): number[] {
  if (!days?.length) return [];
  return days
    .map(d => (d >= 0 && d <= 6 ? d : d - 1))
    .filter(d => d >= 0 && d <= 6);
}

function toMonthDayOrdinal(day: number): string {
  if (day === 1 || day === 21 || day === 31) return `${day}st`;
  if (day === 2 || day === 22) return `${day}nd`;
  if (day === 3 || day === 23) return `${day}rd`;
  return `${day}th`;
}

/** Count how many occurrence days fall in the request's date range (for total positions = positionsPerDay * this). */
export function getOccurrenceDayCount(req: RequestResponse): number {
  const start = req.startDate ? new Date(req.startDate) : null;
  const end = req.endDate ? new Date(req.endDate) : null;
  if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 1;

  const type = req.requestType?.requestType ?? 1;

  if (type === 1) return 1;
  if (type === 2) return getCalendarDaysInRange(start, end);

  if (type === 3) {
    const daysOfWeek = normalizeDaysOfWeek(req.requestType?.daysOfWeek);
    if (daysOfWeek.length === 0) return 1;
    const set = new Set(daysOfWeek);
    let count = 0;
    const cur = new Date(normalizeToDate(start));
    const endExclusive = normalizeToDate(end);
    endExclusive.setDate(endExclusive.getDate() + 1);
    while (cur < endExclusive) {
      if (set.has(cur.getDay())) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return Math.max(1, count);
  }

  if (type === 4) {
    const daysOfMonth = req.requestType?.daysOfMonth ?? [];
    if (daysOfMonth.length === 0) return 1;
    let count = 0;
    const cur = new Date(normalizeToDate(start));
    const endExclusive = normalizeToDate(end);
    endExclusive.setDate(endExclusive.getDate() + 1);
    const monthsSeen = new Set<string>();
    while (cur < endExclusive) {
      const key = `${cur.getFullYear()}-${cur.getMonth()}`;
      if (!monthsSeen.has(key)) {
        monthsSeen.add(key);
        const daysInMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate();
        daysOfMonth.forEach(d => {
          if (d >= 1 && d <= daysInMonth) count++;
        });
      }
      cur.setMonth(cur.getMonth() + 1);
      cur.setDate(1);
    }
    return Math.max(1, count);
  }

  return getCalendarDaysInRange(start, end);
}

const RELEASE_LABELS: Record<RequestStatus, string> = {
  [RequestStatus.Pending]: 'Pending',
  [RequestStatus.ReleaseNow]: 'Release Now',
  [RequestStatus.ReleasedOn]: 'Released On',
  [RequestStatus.Cancelled]: 'Cancelled',
  [RequestStatus.Completed]: 'Completed',
};

const NO_ACTIVE_SCHEDULE = 'No Active Schedule';

/** Request type 1 = One-Time / "Does not repeat" (see `getRequestTypeSummary`). */
function isDoNotRepeatRequestType(req: RequestResponse): boolean {
  return (req.requestType?.requestType ?? 1) === 1;
}

export function formatRequestDateDisplay(value?: string | null): string {
  if (value == null || !String(value).trim()) return 'N/A';
  return formatDateShort(String(value).trim()) || 'N/A';
}

/** True when today (local, start of day) lies on or between schedule start and end (inclusive). */
function isOngoingScheduleRange(startDate?: string | null, endDate?: string | null): boolean {
  const start = parseLocalDateFromString(startDate);
  const end = parseLocalDateFromString(endDate);
  if (!start || !end) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const t = today.getTime();
  return t >= start.getTime() && t <= end.getTime();
}

/** Request schedule whose range includes today: first match in `requestSchedules`, else singular `requestSchedule` if it qualifies. */
function getOngoingSchedule(req: RequestResponse) {
  const fromList = req.requestSchedules?.find((schedule) =>
    isOngoingScheduleRange(schedule.startDate, schedule.endDate)
  );
  if (fromList) return fromList;
  const single = req.requestSchedule;
  if (single && isOngoingScheduleRange(single.startDate, single.endDate)) {
    return single;
  }
  return undefined;
}

/** True when today (local, start of day) is strictly after the request's end date (request window finished). */
function isRequestPastEndDate(req: RequestResponse): boolean {
  const end = parseLocalDateFromString(req.endDate);
  if (!end) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.getTime() > end.getTime();
}

function collectSchedulesDeduped(req: RequestResponse): RequestScheduleDto[] {
  const seen = new Set<string>();
  const out: RequestScheduleDto[] = [];
  const push = (s: RequestScheduleDto | null | undefined) => {
    if (!s) return;
    const id = s.requestScheduleID;
    if (id) {
      if (seen.has(id)) return;
      seen.add(id);
    }
    out.push(s);
  };
  (req.requestSchedules ?? []).forEach(push);
  push(req.requestSchedule);
  return out;
}

/** Schedule with the latest end date (tie-break: latest start); used when the request date range has ended. */
function getLatestScheduleByEndDate(req: RequestResponse): RequestScheduleDto | undefined {
  const schedules = collectSchedulesDeduped(req);
  if (schedules.length === 0) return undefined;
  const scored = schedules.map((s) => ({
    s,
    endT: parseLocalDateFromString(s.endDate)?.getTime() ?? Number.NEGATIVE_INFINITY,
    startT: parseLocalDateFromString(s.startDate)?.getTime() ?? Number.NEGATIVE_INFINITY,
  }));
  scored.sort((a, b) => {
    if (b.endT !== a.endT) return b.endT - a.endT;
    return b.startT - a.startT;
  });
  return scored[0]?.s;
}

function requestStatusRawToLabel(statusRaw: unknown): string {
  if (statusRaw == null) {
    return 'Pending';
  }
  const n = Number(statusRaw);
  if (!Number.isFinite(n) || !(n in RELEASE_LABELS)) {
    return 'Pending';
  }
  return RELEASE_LABELS[n as RequestStatus];
}

/** Numeric release status used for filtering (Pending when there is no schedule). */
export function getReleaseStatusValue(req: RequestResponse): RequestStatus {
  const hasAnySchedule = (req.requestSchedules?.length ?? 0) > 0 || !!req.requestSchedule;
  if (!hasAnySchedule) {
    return RequestStatus.Pending;
  }

  if (isDoNotRepeatRequestType(req)) {
    const latest = getLatestScheduleByEndDate(req);
    if (!latest) return RequestStatus.Pending;
    const n = Number(latest.requestStatus);
    return Number.isFinite(n) ? (n as RequestStatus) : RequestStatus.Pending;
  }

  if (isRequestPastEndDate(req)) {
    const latest = getLatestScheduleByEndDate(req);
    if (!latest) return RequestStatus.Pending;
    const n = Number(latest.requestStatus);
    return Number.isFinite(n) ? (n as RequestStatus) : RequestStatus.Pending;
  }

  const ongoing = getOngoingSchedule(req);
  if (!ongoing) return RequestStatus.Pending;
  const n = Number(ongoing.requestStatus);
  return Number.isFinite(n) ? (n as RequestStatus) : RequestStatus.Pending;
}

export function getReleaseStatusLabel(req: RequestResponse): string {
  // No schedules anywhere on the request → show "No Active Schedule" instead of falling through to a
  // per-type branch. `requestSchedules` is the canonical list (Daily Administration list rows fan out
  // here, plus the existing Manage tab); `requestSchedule` is the singular legacy field used by older
  // detail responses. If neither has data, the request has nothing scheduled at all.
  const hasAnySchedule = (req.requestSchedules?.length ?? 0) > 0 || !!req.requestSchedule;
  if (!hasAnySchedule) {
    return NO_ACTIVE_SCHEDULE;
  }

  // Does not repeat: status comes from the latest schedule (by end/start date), not ongoing vs past window.
  if (isDoNotRepeatRequestType(req)) {
    const latest = getLatestScheduleByEndDate(req);
    if (!latest) {
      return NO_ACTIVE_SCHEDULE;
    }
    return requestStatusRawToLabel(latest.requestStatus);
  }

  if (isRequestPastEndDate(req)) {
    const latest = getLatestScheduleByEndDate(req);
    if (!latest) {
      return NO_ACTIVE_SCHEDULE;
    }
    return requestStatusRawToLabel(latest.requestStatus);
  }

  const ongoing = getOngoingSchedule(req);
  if (!ongoing) {
    return NO_ACTIVE_SCHEDULE;
  }
  return requestStatusRawToLabel(ongoing.requestStatus);
}

function formatReleaseAsValue(releaseAs: number | undefined | null): string {
  if (releaseAs === undefined || releaseAs === null) return '-';
  if (releaseAs === ReleaseAs.Cancelled) return 'Cancelled Posts';

  const enumKey = ReleaseAs[releaseAs];
  if (!enumKey) return String(releaseAs);

  return enumKey
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .replace(/^./, (ch) => ch.toUpperCase());
}

export function getReleaseAsLabel(req: RequestResponse): string {
  const schedule = isDoNotRepeatRequestType(req)
    ? getLatestScheduleByEndDate(req)
    : getOngoingSchedule(req);
  if (!schedule) {
    return '-';
  }
  return formatReleaseAsValue(schedule.releaseAs);
}

function getRequestTypeSummary(req: { requestType?: RequestTypeDto | null }): string {
  const type = req.requestType?.requestType ?? 1;
  const interval = req.requestType?.repeatEvery ?? 1;
  switch (type) {
    case 1: return 'One-Time';
    case 2: return 'Daily';
    case 3: return interval === 1 ? 'Every week' : `Every ${interval} weeks`;
    case 4: return interval === 1 ? 'Every month' : `Every ${interval} months`;
    case 5: return 'Custom';
    default: return 'Unknown';
  }
}

function getRequestTypeBadgeClass(req: { requestType?: RequestTypeDto | null }): string {
  const type = req.requestType?.requestType ?? 1;
  return type === 1 || type === 3 || type === 4 ? 'badge--orange' : 'badge--grey';
}

const weekdayChipsProps = { onChange: () => {}, disabled: true, showOnlySelected: true, showLabel: false } as const;

function renderWeekdayChips(selectedDays: number[]): React.ReactElement {
  return <SMSWeekdayChips selectedDays={selectedDays} {...weekdayChipsProps} />;
}

function getRequestDaysInfo(request: { requestType?: RequestTypeDto | null }): React.ReactNode | string {
  const type = request.requestType?.requestType;
  const rt = request.requestType;

  if (type === 2) return renderWeekdayChips(ALL_WEEK_DAYS);

  if (type === 3) {
    const days = normalizeDaysOfWeek(rt?.daysOfWeek);
    return days.length > 0 ? renderWeekdayChips(days) : null;
  }

  if (type === 4) {
    const weekDays = normalizeDaysOfWeek(rt?.daysOfWeek);
    if (weekDays.length > 0) {
      const weekIndex = rt?.weekIndex;
      const weekPhrase =
        weekIndex === 0
          ? 'Every week of '
          : weekIndex != null && WEEK_INDEX_LABELS[weekIndex]
            ? `${WEEK_INDEX_LABELS[weekIndex]} week of `
            : '';

      return (
        <>
          {weekPhrase && <span className="request-type__monthly-week-label">{weekPhrase}</span>}
          {renderWeekdayChips(weekDays)}
        </>
      );
    }
    const daysOfMonth = rt?.daysOfMonth;
    if (daysOfMonth?.length) {
      const text = [...daysOfMonth].sort((a, b) => a - b).map(toMonthDayOrdinal).join(', ');
      return text || 'N/A';
    }
    return null;
  }

  if (type === 5) return 'Custom Schedule';
  return null;
}

export interface RequestTypeDisplayProps {
  request: { requestType?: RequestTypeDto | null };
}

/** Renders the Request Type column content: summary pill + " on " + day chips (single line). */
export const RequestTypeDisplay: React.FC<RequestTypeDisplayProps> = ({ request }) => {
  const type = request.requestType?.requestType;
  const daysInfo = getRequestDaysInfo(request);
  const showOn = (type === 3 || type === 4) && daysInfo;

  return (
    <div className="level-2-request__data-value level-2-request__data-value--type-wrap">
      <span className={`level-2-request__data-value level-2-request__data-value--type ${getRequestTypeBadgeClass(request)}`}>
        {getRequestTypeSummary(request)}
      </span>
      {daysInfo && (
        <>
          {showOn && <span className="level-2-request__type-on"> on </span>}
          <div className="level-2-request__data-value--days">{daysInfo}</div>
        </>
      )}
    </div>
  );
};
