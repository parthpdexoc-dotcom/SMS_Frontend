/**
 * Date and time utility functions
 */

/** Leading `YYYY-MM-DD` from API datetime strings; no timezone conversion. */
export function extractYyyyMmDdPrefix(value: string | null | undefined): string | null {
  const t = value?.trim();
  if (!t) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/**
 * Parses a datetime string into separate date and time components
 * @param dateTimeString - ISO datetime string or null/undefined
 * @returns Object with scheduleDate (YYYY-MM-DD) and scheduleTime (HH:mm) strings
 */
export const parseScheduleDateAndTime = (
  dateTimeString: string | null | undefined
): { scheduleDate: string; scheduleTime: string } => {
  if (!dateTimeString) {
    return { scheduleDate: '', scheduleTime: '' };
  }
  const t = dateTimeString.trim();
  return {
    scheduleDate: extractYyyyMmDdPrefix(t) ?? '',
    scheduleTime: formatTimeToHHmm(t),
  };
};

/**
 * Combines date and time strings into an ISO datetime string
 * @param date - Date string in YYYY-MM-DD format
 * @param time - Time string in HH:mm format
 * @returns ISO datetime string or null if invalid
 */
export const combineDateAndTime = (date: string, time: string): string | null => {
  // Trim whitespace and check if both are provided
  const trimmedDate = date?.trim() || '';
  const trimmedTime = time?.trim() || '';

  if (!trimmedDate || !trimmedTime) {
    return null;
  }

  try {
    // Ensure time format is HH:mm (add :00 for seconds if needed)
    const timeParts = trimmedTime.split(':');
    const formattedTime =
      timeParts.length === 2
        ? `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}:00`
        : trimmedTime;

    // Combine date and time: YYYY-MM-DDTHH:mm:ss
    const dateTimeString = `${trimmedDate}T${formattedTime}`;

    const dateTime = new Date(dateTimeString);

    if (isNaN(dateTime.getTime())) {
      return null;
    }

    const isoString = dateTime.toISOString();
    return isoString;
  } catch (error) {
    return null;
  }
};

/**
 * Converts minutes to time string in HH:MM format
 * Used for displaying duration as time (e.g., 90 minutes = "01:30", 1440 = "24:00")
 * @param minutes - Number of minutes (0–1440 inclusive for a full calendar-day span)
 * @returns Time string in HH:MM format
 */
export const minutesToTimeString = (minutes: number): string => {
  const m = Math.max(0, Math.min(minutes ?? 0, 24 * 60));
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
};

/**
 * Converts time string in HH:MM format to minutes
 * Used for converting duration input back to minutes for storage
 * @param timeStr - Time string in HH:MM format (e.g., "01:30", "24:00" = 1440)
 * @returns Number of minutes (0–1440; "24:00" is exactly one full day)
 */
export const timeStringToMinutes = (timeStr: string): number => {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return 0;
  const hours = parseInt(match[1], 10);
  const mins = parseInt(match[2], 10);
  if (isNaN(hours) || isNaN(mins)) return 0;
  if (hours === 24 && mins === 0) return 24 * 60;
  if (hours > 23 || hours < 0) return 0;
  return Math.min(24 * 60 - 1, hours * 60 + mins);
};

/**
 * Normalizes a time string to HH:mm (no seconds). Strips `:ss` from HH:mm:ss input; pads hours/minutes.
 * @param timeStr - Time string in HH:mm or HH:mm:ss format
 * @returns HH:mm or empty string for null/empty input
 */
export const formatTimeToHHmm = (timeStr: string | null | undefined): string => {
  if (!timeStr || !timeStr.trim()) {
    return '';
  }

  // Typing mistakes like "08::00" → "08:00"
  const s = timeStr.trim().replace(/:{2,}/g, ':');

  // ISO or space-separated datetime clock (e.g. 1970-01-01T02:00:00, 2026-03-21 06:59:05).
  const isoClock =
    s.match(/T(\d{1,2}):(\d{2})(?::(\d{2}))?/) ?? s.match(/\s(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (isoClock) {
    const hh = String(parseInt(isoClock[1], 10)).padStart(2, '0');
    const mm = String(parseInt(isoClock[2], 10)).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  // If already in HH:mm format, return as is
  if (/^\d{1,2}:\d{2}$/.test(s)) {
    return s;
  }
  
  // If in HH:mm:ss format, extract first 5 characters (HH:mm)
  if (/^\d{1,2}:\d{2}:\d{2}/.test(s)) {
    return s.substring(0, 5);
  }

  // Try to parse and format
  const parts = s.split(':');
  if (parts.length >= 2) {
    const hours = parts[0].padStart(2, '0');
    const minutes = parts[1].padStart(2, '0');
    return `${hours}:${minutes}`;
  }
  
  return '';
};

/**
 * Minutes between two clock times (HH:mm); supports overnight when end is before start on the clock.
 * Same clock time is invalid (returns null), matching job duration behavior in SMSPostForm.
 */
export const durationMinutesClockToClock = (start: string, end: string): number | null => {
  const s0 = formatTimeToHHmm(start) ?? '';
  const e0 = formatTimeToHHmm(end) ?? '';
  if (!s0 || !e0) return null;
  const s = timeStringToMinutes(s0);
  const e = timeStringToMinutes(e0);
  if (s === e) return null;
  if (e > s) return e - s;
  return 24 * 60 - s + e;
};

/**
 * Formats a Date object to YYYY-MM-DD string format
 * @param date - Date object to format
 * @returns Date string in YYYY-MM-DD format
 */
export const formatDateToYYYYMMDD = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Today's calendar date in the runtime local timezone (`YYYY-MM-DD`).
 * Use for date picker defaults and min/max "today" clamps — not `Date#toISOString()` (UTC calendar day).
 */
export function getLocalTodayYyyyMmDd(): string {
  return formatDateToYYYYMMDD(new Date());
}

/**
 * Generate-schedule date range: if request start is in the past, use today.
 * Returns YYYY-MM-DD strings for the generate API.
 */
export function resolveGenerateScheduleDateRange(
  startDate?: string | null,
  endDate?: string | null
): { startDate?: string; endDate?: string } {
  const end = (endDate ?? '').trim() || undefined;
  const rawStart = (startDate ?? '').trim();
  if (!rawStart) {
    return { startDate: undefined, endDate: end };
  }
  const today = getLocalTodayYyyyMmDd();
  return {
    startDate: rawStart < today ? today : rawStart,
    endDate: end,
  };
}

/** First/last calendar days for the default month pair (current month → next month). */
export function getDefaultMonthPairDateRange(): { startDate: string; endDate: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  return {
    startDate: formatDateToYYYYMMDD(new Date(year, month, 1)),
    endDate: formatDateToYYYYMMDD(new Date(year, month + 2, 0)),
  };
}

/** Daily Administration filter bar defaults — alias of {@link getDefaultMonthPairDateRange}. */
export function getDefaultDailyAdminDateRange(): { startDate: string; endDate: string } {
  return getDefaultMonthPairDateRange();
}

/** Release Schedule default: first day of this month through the last day two months ahead. */
export function getDefaultReleaseScheduleDateRange(): { startDate: string; endDate: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  return {
    startDate: formatDateToYYYYMMDD(new Date(year, month, 1)),
    endDate: formatDateToYYYYMMDD(new Date(year, month + 3, 0)),
  };
}

/** Add a work date to a sorted list when missing; no-op when invalid or already present. */
export function mergeYmdIntoSortedDates(dates: readonly string[], value: string): string[] {
  const ymd = extractYyyyMmDdPrefix(value);
  if (!ymd || dates.includes(ymd)) return [...dates].sort();
  return [...dates, ymd].sort();
}

/** Unique sorted `YYYY-MM-DD` values from mixed API date strings. */
export function toSortedUniqueYmdDates(dates: readonly string[]): string[] {
  return [...new Set(dates.map(extractYyyyMmDdPrefix).filter((d): d is string => d != null))].sort();
}

/**
 * Default calendar month for a sorted `YYYY-MM-DD` list: current month when present,
 * else first month in the current year, else the earliest month in the list.
 */
export function getDefaultYearMonthFromYmdDates(
  dates: readonly string[]
): { year: string; month: string } | null {
  if (dates.length === 0) return null;
  const today = getLocalTodayYyyyMmDd();
  const year = today.slice(0, 4);
  const month = today.slice(5, 7);
  const monthPrefix = `${year}-${month}-`;
  if (dates.some((d) => d.startsWith(monthPrefix))) return { year, month };
  const yearPrefix = `${year}-`;
  const inYear = dates.filter((d) => d.startsWith(yearPrefix));
  if (inYear.length > 0) return { year, month: inYear[0]!.slice(5, 7) };
  return { year: dates[0]!.slice(0, 4), month: dates[0]!.slice(5, 7) };
}

/**
 * From available `YYYY-MM-DD` values, returns those in the default **month pair**
 * (primary month + the following month).
 *
 * - No `year`: primary month from {@link getDefaultYearMonthFromYmdDates}, then +1 month.
 * - With `year`: same rule scoped to that calendar year (for Position Dates year pills).
 *
 * @see getDefaultMonthPairDateRange — start/end bounds for the Daily Administration filter bar
 */
export function getDefaultMonthPairYmdDates(
  dates: readonly string[],
  year?: string
): string[] {
  const normalized = toSortedUniqueYmdDates(dates);
  if (normalized.length === 0) return [];

  let targetYear: string;
  let month: string;

  if (year) {
    const inYear = normalized.filter((d) => d.startsWith(`${year}-`));
    if (inYear.length === 0) return [];

    const today = getLocalTodayYyyyMmDd();
    targetYear = year;
    month =
      year === today.slice(0, 4) && inYear.some((d) => d.startsWith(`${year}-${today.slice(5, 7)}-`))
        ? today.slice(5, 7)
        : inYear[0]!.slice(5, 7);
  } else {
    const ym = getDefaultYearMonthFromYmdDates(normalized);
    if (!ym) return [];
    targetYear = ym.year;
    month = ym.month;
  }

  const monthNum = Number(month);
  const yearNum = Number(targetYear);
  const nextYear = monthNum === 12 ? String(yearNum + 1) : targetYear;
  const nextMonth = monthNum === 12 ? '01' : String(monthNum + 1).padStart(2, '0');

  const prefixes = [`${targetYear}-${month}-`, `${nextYear}-${nextMonth}-`];
  return normalized.filter((d) => prefixes.some((prefix) => d.startsWith(prefix)));
}

function isLeapYearGregorian(y: number): boolean {
  if (y % 400 === 0) return true;
  if (y % 100 === 0) return false;
  return y % 4 === 0;
}

function daysInMonthGregorian(y: number, m: number): number {
  if (m === 2) return isLeapYearGregorian(y) ? 29 : 28;
  if (m === 4 || m === 6 || m === 9 || m === 11) return 30;
  return 31;
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function ymdKeyFromParts(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function addOneYmdPart(y: number, m: number, d: number): { y: number; m: number; d: number } {
  const maxD = daysInMonthGregorian(y, m);
  if (d < maxD) return { y, m, d: d + 1 };
  if (m < 12) return { y, m: m + 1, d: 1 };
  return { y: y + 1, m: 1, d: 1 };
}

/**
 * Inclusive YYYY-MM-DD list from `startKey` to `endKey` using the date **strings only** (proleptic Gregorian;
 * no `Date` / timezone conversion). Invalid keys return an empty list.
 */
export const enumerateInclusiveYmdStringKeys = (startKey: string, endKey: string): string[] => {
  const s = startKey?.trim().slice(0, 10);
  const e = endKey?.trim().slice(0, 10);
  if (!s || !e) return [];
  if (s > e) return [];
  const m1 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  const m2 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(e);
  if (!m1 || !m2) return [];
  let y = parseInt(m1[1], 10);
  let mo = parseInt(m1[2], 10);
  let d = parseInt(m1[3], 10);
  if ([y, mo, d].some((n) => Number.isNaN(n)) || mo < 1 || mo > 12 || d < 1) return [];
  const eY = parseInt(m2[1], 10);
  const eM = parseInt(m2[2], 10);
  const eD = parseInt(m2[3], 10);
  if ([eY, eM, eD].some((n) => Number.isNaN(n)) || eM < 1 || eM > 12 || eD < 1) return [];
  if (d > daysInMonthGregorian(y, mo) || eD > daysInMonthGregorian(eY, eM)) return [];

  const out: string[] = [];
  for (;;) {
    const k = ymdKeyFromParts(y, mo, d);
    if (k > e) break;
    out.push(k);
    if (k === e) break;
    const next = addOneYmdPart(y, mo, d);
    y = next.y;
    mo = next.m;
    d = next.d;
  }
  return out;
};

/**
 * Adds hours to a calendar date + clock time in the local timezone.
 * Used e.g. for process date/time = schedule date/time + release offset hours.
 *
 * @param dateStr - YYYY-MM-DD
 * @param timeStr - HH:mm or HH:mm:ss (normalized via formatTimeToHHmm)
 * @param hoursToAdd - Whole hours to add (may be 0)
 * @returns YYYY-MM-DD and HH:mm in local time, or null if inputs are invalid
 */
export const addLocalDateTimeHours = (
  dateStr: string,
  timeStr: string | null | undefined,
  hoursToAdd: number
): { date: string; time: string } | null => {
  const d = dateStr?.trim();
  const t = formatTimeToHHmm(timeStr);
  if (!d || !t || hoursToAdd == null || Number.isNaN(hoursToAdd)) {
    return null;
  }
  const parts = d.split('-').map((x) => parseInt(x, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    return null;
  }
  const [y, mo, day] = parts;
  const tm = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!tm) {
    return null;
  }
  const hh = parseInt(tm[1], 10);
  const mm = parseInt(tm[2], 10);
  if (Number.isNaN(hh) || Number.isNaN(mm)) {
    return null;
  }
  const dt = new Date(y, mo - 1, day, hh, mm, 0, 0);
  if (Number.isNaN(dt.getTime())) {
    return null;
  }
  dt.setTime(dt.getTime() + hoursToAdd * 60 * 60 * 1000);
  return {
    date: formatDateToYYYYMMDD(dt),
    time: `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`,
  };
};

const QUARTER_HOUR_MINUTES = 15;

/**
 * Snaps a local {@link Date} to the next 15-minute boundary (0, 15, 30, 45) such that
 * the result is always **>=** the input instant. Used with the 15-minute time picker
 * so "now + N hours" is never shown as an earlier quarter slot (e.g. 15:38 → 15:45, not 15:30).
 */
function localCeilToNextQuarterHour(d: Date): void {
  const y = d.getFullYear();
  const mo = d.getMonth();
  const day = d.getDate();
  const dayStart = new Date(y, mo, day, 0, 0, 0, 0);
  const minutesSince = (d.getTime() - dayStart.getTime()) / 60_000;
  const ceiled = Math.ceil(minutesSince / QUARTER_HOUR_MINUTES) * QUARTER_HOUR_MINUTES;
  d.setTime(dayStart.getTime() + ceiled * 60_000);
}

/**
 * Now (local) plus a whole number of hours; used e.g. for "schedule after N hours" from current time.
 * The time is rounded **up** to a 15-minute step so the displayed value is always at least
 * the true offset (matches SMSTimePicker slots).
 */
export const addHoursToNow = (hoursToAdd: number): { date: string; time: string } => {
  if (hoursToAdd == null || Number.isNaN(hoursToAdd)) {
    return { date: formatDateToYYYYMMDD(new Date()), time: '00:00' };
  }
  const dt = new Date();
  dt.setTime(dt.getTime() + hoursToAdd * 60 * 60 * 1000);
  localCeilToNextQuarterHour(dt);
  return {
    date: formatDateToYYYYMMDD(dt),
    time: `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`,
  };
};

/**
 * Calculates the post end time for display based on a start time and duration in minutes.
 * Returns a string in HH:mm format or an empty string when calculation is not possible.
 *
 * @param startTime - Post start time string (typically "HH:mm:ss" or "HH:mm")
 * @param durationMinutes - Post length in minutes
 */
export const getPostEndTime = (
  startTime: string | null | undefined,
  durationMinutes: number | string | null | undefined
): string => {
  const mins = Number(durationMinutes);
  if (!startTime || !Number.isFinite(mins) || mins <= 0) {
    return '';
  }

  const normalized = formatTimeToHHmm(startTime);
  if (!normalized) return '';

  // Clock arithmetic on a 24h circle (same semantics as job duration elsewhere).
  // Avoids Date()/locale parsing bugs where incomplete ISO strings yield Invalid Date or wrong TZ,
  // which previously forced a fallback to explicit "00:00" from the API.
  const startM = timeStringToMinutes(normalized);
  const endM = (startM + mins) % (24 * 60);
  return minutesToTimeString(endM);
};

/** Normalizes HH:mm to HH:mm:ss for TimeOnly-style API fields. */
export function formatHhMmToApiTimeOnly(hhMm: string | null | undefined): string | null {
  const normalized = formatTimeToHHmm(hhMm);
  if (!normalized) return null;
  const m = normalized.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = String(parseInt(m[1], 10)).padStart(2, '0');
  const mm = String(parseInt(m[2], 10)).padStart(2, '0');
  return `${hh}:${mm}:00`;
}

/**
 * Resolves PostEndTime for save payloads: combine explicit end time with start + duration.
 * Treats lone "00:00" as unset when start + postLength imply a different end (common default).
 */
export function resolvePostEndTimeForPayload(
  postStartTime: string | null | undefined,
  postLength: number | null | undefined,
  postEndTime: string | null | undefined
): string | null {
  const len = Number(postLength);
  const derived =
    Number.isFinite(len) && len > 0 ? getPostEndTime(postStartTime, len) : '';
  let explicit = formatTimeToHHmm(postEndTime ?? '');

  // Do not send midnight as the end time when duration implies another clock time (e.g. 03:00 + 300m → 08:00).
  if (explicit === '00:00' && derived && derived !== '00:00') {
    explicit = '';
  }

  const chosen = explicit || derived;
  if (!chosen) return null;
  return formatHhMmToApiTimeOnly(chosen);
}

/**
 * Same as {@link resolvePostEndTimeForPayload}, then guarantees a value from start + length when resolution fails.
 */
export function ensurePostEndTimeForPayload(
  postStartTime: string | null | undefined,
  postLength: number | null | undefined,
  postEndTime: string | null | undefined
): string | null {
  const resolved = resolvePostEndTimeForPayload(postStartTime, postLength, postEndTime);
  if (resolved) return resolved;

  const len = Number(postLength);
  if (!Number.isFinite(len) || len <= 0) return null;
  const fromLength = getPostEndTime(postStartTime, len);
  if (!fromLength) return null;
  return formatHhMmToApiTimeOnly(fromLength);
}

/**
 * Formats duration from minutes to "X hr Y min" format
 */
export const formatDuration = (minutes: number | null | undefined): string => {
  if (minutes === null || minutes === undefined || minutes === 0) {
    return '0 min';
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) {
    return `${remainingMinutes} min`;
  }

  if (remainingMinutes === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${remainingMinutes} min`;
};

/**
 * Formats duration from minutes to "X hrs Y mins" format with proper singular/plural handling
 * (e.g. 340 → "5 hrs 40 mins", 60 → "1 hr", 90 → "1 hr 30 mins", 1 → "1 min").
 */
export const formatDurationHrsMins = (minutes: number | null | undefined): string => {
  if (minutes === null || minutes === undefined || Number.isNaN(Number(minutes))) {
    return '0 mins';
  }

  const total = Math.max(0, Math.floor(Number(minutes)));
  const hours = Math.floor(total / 60);
  const remainingMinutes = total % 60;

  const hrLabel = hours === 1 ? 'hr' : 'hrs';
  const minLabel = remainingMinutes === 1 ? 'min' : 'mins';

  if (hours === 0) {
    return `${remainingMinutes} ${minLabel}`;
  }

  if (remainingMinutes === 0) {
    return `${hours} ${hrLabel}`;
  }

  return `${hours} ${hrLabel} ${remainingMinutes} ${minLabel}`;
};


