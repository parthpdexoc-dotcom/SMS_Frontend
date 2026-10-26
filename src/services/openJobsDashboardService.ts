import { apiGet } from '@/utils/apiClient';
import { expectOkReadText, parseJsonText } from '@/services/textPlainJson';
import type {
  OpenJobsDashboardGroup,
  OpenJobsDashboardPostRow,
} from '@/types/openJobsDashboard';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';

export interface OpenJobsDashboardResult {
  groups: OpenJobsDashboardGroup[];
  totalRecords: number;
  /** Backend may set when there are no rows (same pattern as available-post). */
  listMessage: string | null;
}

function pickStr(raw: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = raw[k];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function pickInt(raw: Record<string, unknown>, ...keys: string[]): number {
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
    if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  }
  return 0;
}

/** YYYY-MM-DD from API DateOnly / ISO string */
function pickDateYmd(raw: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = raw[k];
    if (v == null) continue;
    const s = String(v).trim();
    if (!s) continue;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  return '';
}

/** Display as HH:mm from API TimeOnly / ISO fragment. */
function formatDashboardStartTime(raw: unknown): string {
  if (raw == null) return '';
  const s = String(raw).trim();
  if (!s) return '';
  if (s.length >= 5 && s[2] === ':') return s.slice(0, 5);
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
  return s;
}

function normalizeOpenJobPost(raw: Record<string, unknown>): OpenJobsDashboardPostRow {
  const startRaw = pickStr(raw, 'startDate', 'StartDate');
  let startDate = '';
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(startRaw);
  if (ymd) startDate = `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
  else startDate = startRaw.slice(0, 10);

  const timeRaw = raw.startTime ?? raw.StartTime;
  const endTimeRaw = raw.endTime ?? raw.EndTime;

  return {
    postID: pickStr(raw, 'postID', 'PostID'),
    postTitle: pickStr(raw, 'postTitle', 'PostTitle'),
    totalPostPositions: pickInt(raw, 'totalPostPositions', 'TotalPostPositions'),
    dayOfWeek: pickStr(raw, 'dayOfWeek', 'DayOfWeek'),
    startDate,
    startTimeDisplay: formatDashboardStartTime(timeRaw),
    endTimeDisplay: formatDashboardStartTime(endTimeRaw),
    open: pickInt(raw, 'open', 'Open'),
    filled: pickInt(raw, 'filled', 'Filled'),
    pendingCancellation: pickInt(raw, 'pendingCancellation', 'PendingCancellation'),
  };
}

function normalizeGroup(raw: Record<string, unknown>): OpenJobsDashboardGroup {
  const jobsRaw = raw.openJobs ?? raw.OpenJobs;
  const list = Array.isArray(jobsRaw) ? jobsRaw : [];
  return {
    requestID: pickStr(raw, 'requestID', 'RequestID'),
    requestTitle: pickStr(raw, 'requestTitle', 'RequestTitle'),
    requestUniqueNumber: pickStr(raw, 'requestUniqueNumber', 'RequestUniqueNumber'),
    requesterName: pickStr(raw, 'requesterName', 'RequesterName'),
    dateOfWork: pickDateYmd(raw, 'dateOfWork', 'DateOfWork'),
    totalPositions: pickInt(raw, 'totalPositions', 'TotalPositions'),
    totalOpen: pickInt(raw, 'totalOpen', 'TotalOpen'),
    totalFilled: pickInt(raw, 'totalFilled', 'TotalFilled'),
    totalCancel: pickInt(raw, 'totalCancel', 'TotalCancel'),
    openJobs: list.map((row) => normalizeOpenJobPost(row as Record<string, unknown>)),
  };
}

/**
 * GET /Request/open-jobs-dashboard/{startDate}/{endDate}?page=&pageSize=
 * (RequesterManagerOnly — PageParam on query; inclusive date range in route.)
 */
export async function getOpenJobsDashboard(params: {
  startDate: string;
  endDate: string;
  page: number;
  pageSize: number;
  searchTerm?: string;
  statusFilter?: string;
}): Promise<OpenJobsDashboardResult> {
  const qs = buildPaginationQueryParams({ page: params.page, pageSize: params.pageSize });
  const searchTerm = params.searchTerm?.trim();
  if (searchTerm) {
    qs.append('searchTerm', searchTerm);
  }
  const statusFilter = params.statusFilter?.trim();
  if (statusFilter) {
    qs.append('statusFilter', statusFilter);
  }
  const start = params.startDate.trim();
  const end = params.endDate.trim();
  const endpoint = `/Request/open-jobs-dashboard/${start}/${end}?${qs.toString()}`;

  const response = await apiGet(endpoint);
  const responseText = await expectOkReadText(response, 'Failed to load open jobs');
  const parsed = parseJsonText<Record<string, unknown>>(responseText);

  const rawList = parsed?.data ?? parsed?.Data;
  const list = Array.isArray(rawList)
    ? rawList.map((row) => normalizeGroup(row as Record<string, unknown>))
    : [];
  const totalRaw = parsed?.totalRecords ?? parsed?.TotalRecords;
  const totalRecords = typeof totalRaw === 'number' && !Number.isNaN(totalRaw) ? totalRaw : list.length;
  const errRaw = parsed?.error ?? parsed?.Error;
  const listMessage = typeof errRaw === 'string' && errRaw.trim() ? errRaw.trim() : null;

  return { groups: list, totalRecords, listMessage };
}
