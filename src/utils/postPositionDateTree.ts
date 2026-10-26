import {
  extractYyyyMmDdPrefix,
  getDefaultYearMonthFromYmdDates,
  toSortedUniqueYmdDates,
} from '@/utils/dateTimeUtils';

/** Year → month (MM) → sorted YYYY-MM-DD dates. */
export type PostPositionDateTree = Record<string, Record<string, string[]>>;

export function normalizePostPositionDate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const ymd = trimmed.includes('T') ? trimmed.split('T')[0]! : trimmed;
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
}

export function buildPostPositionDateTree(dates: ReadonlyArray<string>): PostPositionDateTree {
  const tree: PostPositionDateTree = {};
  for (const raw of dates) {
    const date = normalizePostPositionDate(raw);
    if (!date) continue;
    const [year, month] = date.split('-');
    if (!tree[year]) tree[year] = {};
    if (!tree[year][month]) tree[year][month] = [];
    if (!tree[year][month].includes(date)) tree[year][month].push(date);
  }
  Object.values(tree).forEach((months) => {
    Object.values(months).forEach((days) => days.sort());
  });
  return tree;
}

export function postPositionYearExpandKey(postId: string, year: string): string {
  return `${postId}:${year}`;
}

export function postPositionMonthExpandKey(postId: string, year: string, month: string): string {
  return `${postId}:${year}-${month}`;
}

export function postPositionDayExpandKey(postId: string, date: string): string {
  return `${postId}:${date}`;
}

export function postPositionMonthSelectionCacheKey(
  postId: string,
  year: string,
  month: string,
  selectedDates: readonly string[]
): string {
  const sorted = [...selectedDates].sort().join(',');
  return `${postId}|${year}-${month}|${sorted}`;
}

/** Cache key for post employee list — empty dates means unfiltered (`GET by-post/{id}`). */
export function postPositionFilterCacheKey(
  postId: string,
  selectedDates: readonly string[]
): string {
  if (selectedDates.length === 0) return `${postId}|*`;
  return `${postId}|${[...selectedDates].sort().join(',')}`;
}

/** All selected work dates for a post (`postId:YYYY-MM-DD` keys). */
export function getSelectedDatesForPost(
  selectedDayKeys: ReadonlySet<string>,
  postId: string
): string[] {
  const prefix = `${postId}:`;
  return [...selectedDayKeys]
    .filter((key) => key.startsWith(prefix))
    .map((key) => key.slice(prefix.length))
    .filter((date) => Boolean(extractYyyyMmDdPrefix(date)))
    .sort();
}

export function getSelectedDatesForPostMonth(
  selectedDayKeys: ReadonlySet<string>,
  postId: string,
  year: string,
  month: string
): string[] {
  const monthPrefix = `${year}-${month}-`;
  return getSelectedDatesForPost(selectedDayKeys, postId).filter((date) =>
    date.startsWith(monthPrefix)
  );
}

export function getDatesForYearMonth(
  dates: ReadonlyArray<string>,
  year: string,
  month: string
): string[] {
  const monthPrefix = `${year}-${month}-`;
  return dates
    .map((d) => normalizePostPositionDate(d))
    .filter((d): d is string => d != null && d.startsWith(monthPrefix))
    .sort();
}

export interface PostPositionMonthGroup {
  year: string;
  month: string;
  dates: string[];
}

/** Flatten collect-dates into month groups (ascending). */
export function listPostPositionMonths(
  dates: ReadonlyArray<string>
): PostPositionMonthGroup[] {
  const tree = buildPostPositionDateTree(dates);
  const groups: PostPositionMonthGroup[] = [];
  Object.keys(tree)
    .sort((a, b) => Number(a) - Number(b))
    .forEach((year) => {
      Object.keys(tree[year] ?? {})
        .sort((a, b) => Number(a) - Number(b))
        .forEach((month) => {
          groups.push({ year, month, dates: [...(tree[year][month] ?? [])] });
        });
    });
  return groups;
}

/** Prefer today's year/month when it has dates; otherwise nearest available month. */
export function resolveDefaultPostPositionYearMonth(
  months: ReadonlyArray<PostPositionMonthGroup>
): { year: string; month: string } | null {
  if (months.length === 0) return null;
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const exact = months.find((m) => m.year === year && m.month === month);
  if (exact) return { year: exact.year, month: exact.month };
  const sameYear = months.find((m) => m.year === year);
  if (sameYear) return { year: sameYear.year, month: sameYear.month };
  return { year: months[0].year, month: months[0].month };
}

/** Available dates for the default (current) calendar month. */
export function getDefaultMonthCollectDates(dates: ReadonlyArray<string>): string[] {
  const normalized = toSortedUniqueYmdDates(dates);
  const ym = getDefaultYearMonthFromYmdDates(normalized);
  if (!ym) return [];
  const prefix = `${ym.year}-${ym.month}-`;
  return normalized.filter((d) => d.startsWith(prefix));
}

/** e.g. Apr '26 (6) */
export function formatPostPositionMonthPill(
  year: string,
  month: string,
  count: number
): string {
  const n = Number.parseInt(month, 10);
  const short =
    Number.isFinite(n) && n >= 1 && n <= 12
      ? new Date(2000, n - 1, 1).toLocaleString('en-US', { month: 'short' })
      : month;
  return `${short} '${year.slice(-2)} (${count})`;
}

export function parseYearMonthFromDate(date: string): { year: string; month: string } | null {
  const normalized = normalizePostPositionDate(date);
  if (!normalized) return null;
  const [year, month] = normalized.split('-');
  if (!year || !month) return null;
  return { year, month };
}

export function formatPostPositionMonthLabel(monthNum: string): string {
  const n = Number.parseInt(monthNum, 10);
  if (Number.isFinite(n) && n >= 1 && n <= 12) {
    return new Date(2000, n - 1, 1).toLocaleString('en-US', { month: 'long' });
  }
  return monthNum;
}

export function formatPostPositionWeekdayShort(date: string): string {
  const normalized = normalizePostPositionDate(date);
  if (!normalized) return '';
  const [year, month, day] = normalized.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleString('en-US', { weekday: 'short' });
}

export function getPostPositionDayNumber(date: string): string {
  const normalized = normalizePostPositionDate(date);
  if (!normalized) return '';
  const day = normalized.split('-')[2];
  return day ? String(Number(day)) : '';
}

/** Human-readable label for a single selected post-position date in filter chips. */
export function formatPostPositionFilterDate(date: string): string {
  const normalized = normalizePostPositionDate(date);
  if (!normalized) return date;
  const [year, month, day] = normalized.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function countDatesInYear(tree: PostPositionDateTree, year: string): number {
  const months = tree[year] ?? {};
  return Object.values(months).reduce((sum, days) => sum + days.length, 0);
}

export interface PostMonthDayGroup {
  postId: string;
  year: string;
  month: string;
  dates: string[];
}

/** Group selected day keys (`postId:YYYY-MM-DD`) by post + month for position reloads. */
export function groupExpandedDaysByPostMonth(dayKeys: Iterable<string>): PostMonthDayGroup[] {
  const groups = new Map<string, PostMonthDayGroup>();
  for (const dayKey of dayKeys) {
    const separatorIndex = dayKey.indexOf(':');
    if (separatorIndex <= 0) continue;
    const postId = dayKey.slice(0, separatorIndex);
    const date = dayKey.slice(separatorIndex + 1);
    const parsed = parseYearMonthFromDate(date);
    if (!postId || !parsed) continue;
    const groupKey = `${postId}|${parsed.year}-${parsed.month}`;
    const existing = groups.get(groupKey);
    if (existing) {
      if (!existing.dates.includes(date)) existing.dates.push(date);
    } else {
      groups.set(groupKey, {
        postId,
        year: parsed.year,
        month: parsed.month,
        dates: [date],
      });
    }
  }
  return [...groups.values()].map((group) => ({
    ...group,
    dates: [...group.dates].sort(),
  }));
}
