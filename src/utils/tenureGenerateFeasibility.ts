import { MonthlyMode } from '@/types/recurrence';
import { addLocalDateTimeHours, extractYyyyMmDdPrefix, getLocalTodayYyyyMmDd } from '@/utils/dateTimeUtils';

const RELEASE_HOUR_OPTIONS = [1, 24, 48, 72] as const;

function parseYmd(ymd: string): Date {
  const [year, month, day] = ymd.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function formatYmd(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

/** Aligns with backend ResolveReleaseBeforeDate for weekly (Sunday-based week). */
function resolveWeeklyReleaseBeforeYmd(occurrenceStartYmd: string, releaseBeforeDay: number): string {
  const start = parseYmd(occurrenceStartYmd);
  const weekStart = addDays(start, -start.getDay());
  const day = releaseBeforeDay >= 0 && releaseBeforeDay <= 6 ? releaseBeforeDay : 0;
  const release = addDays(weekStart, day);
  return release >= start ? formatYmd(addDays(release, -7)) : formatYmd(release);
}

/** True when offer day + processing hours leaves no day before the work day in the week. */
export function tenureOfferRepeatsOnWorkDay(
  workDays: number[],
  weekStartDay: number,
  releaseBeforeDay: number,
  scheduledTime: string,
  releaseHours: number,
  anchorYmd: string
): boolean {
  const work = workDays.length > 0 ? workDays : [weekStartDay];
  let probe = parseYmd(anchorYmd);
  while (probe.getDay() !== weekStartDay) {
    probe = addDays(probe, 1);
  }
  const probeYmd = formatYmd(probe);
  const offerYmd = resolveWeeklyReleaseBeforeYmd(probeYmd, releaseBeforeDay);
  const process = addLocalDateTimeHours(offerYmd, scheduledTime, releaseHours);
  if (!process?.date) return true;

  const earliestOffset = Math.min(...work.map((day) => ((day - weekStartDay + 7) % 7)));
  const earliestWorkYmd = formatYmd(addDays(probe, earliestOffset));
  return process.date >= earliestWorkYmd;
}

export function resolveTenureFeasibilityAnchorYmd(startDate?: string | null): string {
  const today = getLocalTodayYyyyMmDd();
  const startKey = extractYyyyMmDdPrefix(startDate);
  if (startKey && startKey >= today) return startKey;
  return today;
}

/** Process/Offer preview for Configure Auto Schedule (weekly tenure): offer day from release-before weekday, not request start/today. */
export function resolveWeeklyTenureProcessPreview(
  requestStartYmd: string | null | undefined,
  _workDays: number[],
  weekStartDay: number,
  releaseBeforeDay: number,
  scheduledTime: string,
  releaseHours: number
): ReturnType<typeof addLocalDateTimeHours> {
  const time = scheduledTime.trim();
  if (!time || releaseHours <= 0) return null;

  const anchorYmd = resolveTenureFeasibilityAnchorYmd(requestStartYmd);
  let probe = parseYmd(anchorYmd);
  while (probe.getDay() !== weekStartDay) {
    probe = addDays(probe, 1);
  }
  const probeYmd = formatYmd(probe);
  const offerYmd = resolveWeeklyReleaseBeforeYmd(probeYmd, releaseBeforeDay);
  return addLocalDateTimeHours(offerYmd, time, releaseHours);
}

function getScheduleDayWithinMonth(year: number, month: number, day: number): string {
  const daysInMonth = new Date(year, month, 0).getDate();
  const effectiveDay = day < 1 ? 1 : Math.min(day, daysInMonth);
  return formatYmd(new Date(year, month - 1, effectiveDay));
}

/** Aligns with backend GetNthWeekdayOfMonth (n 1–4 exact week, 5 = last). */
function getNthWeekdayOfMonth(year: number, month: number, n: number, dayOfWeek: number): Date | null {
  if (n < 1 || n > 5) return null;
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstOfMonth = new Date(year, month - 1, 1);
  const firstMatch = 1 + ((dayOfWeek - firstOfMonth.getDay() + 7) % 7);
  if (n < 5) {
    const targetDay = firstMatch + (n - 1) * 7;
    if (targetDay > daysInMonth) return null;
    return new Date(year, month - 1, targetDay);
  }
  const last = new Date(year, month - 1, daysInMonth);
  return addDays(last, -((last.getDay() - dayOfWeek + 7) % 7));
}

/** Aligns with backend ResolveMonthlyReleaseBeforeDate for the first generated month window. */
function resolveMonthlyReleaseBeforeYmd(
  occurrenceStartYmd: string,
  monthlyMode: MonthlyMode,
  daysOfMonth: number[],
  weekIndex: number,
  daysOfWeek: number[]
): string | null {
  const start = parseYmd(occurrenceStartYmd);
  const previous = new Date(start.getFullYear(), start.getMonth() - 1, start.getDate());
  const year = previous.getFullYear();
  const month = previous.getMonth() + 1;

  if (monthlyMode === MonthlyMode.BY_PATTERN && daysOfWeek.length > 0) {
    const n = weekIndex === 0 ? 5 : weekIndex;
    const weekday = getNthWeekdayOfMonth(year, month, n, daysOfWeek[0]!);
    return weekday ? formatYmd(weekday) : null;
  }

  const configuredDay =
    daysOfMonth.length > 0 && daysOfMonth[0]! >= 1 ? daysOfMonth[0]! : start.getDate();
  return getScheduleDayWithinMonth(year, month, configuredDay);
}

/** Process/Offer preview for Configure Auto Schedule (monthly tenure). */
export function resolveMonthlyTenureProcessPreview(
  requestStartYmd: string | null | undefined,
  monthlyMode: MonthlyMode,
  daysOfMonth: number[],
  weekIndex: number,
  daysOfWeek: number[],
  scheduledTime: string,
  releaseHours: number
): ReturnType<typeof addLocalDateTimeHours> {
  const time = scheduledTime.trim();
  if (!time || releaseHours <= 0) return null;

  const occurrenceStartYmd = resolveTenureFeasibilityAnchorYmd(requestStartYmd);
  const offerYmd = resolveMonthlyReleaseBeforeYmd(
    occurrenceStartYmd,
    monthlyMode,
    daysOfMonth,
    weekIndex,
    daysOfWeek
  );
  if (!offerYmd) return null;
  return addLocalDateTimeHours(offerYmd, time, releaseHours);
}

export function getFeasibleReleaseBeforeDays(
  workDays: number[],
  weekStartDay: number,
  scheduledTime: string,
  releaseHours: number,
  anchorYmd: string
): number[] {
  const time = scheduledTime?.trim();
  if (!time || releaseHours <= 0) return [0, 1, 2, 3, 4, 5, 6];
  return [0, 1, 2, 3, 4, 5, 6].filter(
    (day) =>
      !tenureOfferRepeatsOnWorkDay(workDays, weekStartDay, day, time, releaseHours, anchorYmd)
  );
}

export function getFeasibleReleaseHours(
  workDays: number[],
  weekStartDay: number,
  releaseBeforeDay: number,
  scheduledTime: string,
  anchorYmd: string
): number[] {
  const time = scheduledTime?.trim();
  if (!time) return [...RELEASE_HOUR_OPTIONS];
  return RELEASE_HOUR_OPTIONS.filter(
    (hours) =>
      !tenureOfferRepeatsOnWorkDay(workDays, weekStartDay, releaseBeforeDay, time, hours, anchorYmd)
  );
}
