import { apiGet, apiPost } from '@/utils/apiClient';
import { expectOkReadText, parseJsonText, readResponseOk } from '@/services/textPlainJson';
import { TenureMetricType } from '@/types/departmentPolicy';
import type {
  TenureInterestedEmployeeRow,
  TenureJobsDashboardGroup,
  TenureJobsDashboardRow,
} from '@/types/tenureJobsDashboard';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';

export interface TenureJobsDashboardResult {
  groups: TenureJobsDashboardGroup[];
  totalRecords: number;
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

/** Optional date — omit when API sends null */
function pickOptionalDateYmd(raw: Record<string, unknown>, ...keys: string[]): string {
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

/** Display as HH:mm from API TimeOnly / ISO fragment */
function formatTimeOnly(raw: unknown): string {
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

function normalizeTenureJobRow(raw: Record<string, unknown>): TenureJobsDashboardRow {
  const startTimeRaw = raw.startTime ?? raw.StartTime;
  const endTimeRaw = raw.endTime ?? raw.EndTime;

  return {
    postID: pickStr(raw, 'postID', 'PostId', 'postId'),
    postTitle: pickStr(raw, 'postTitle', 'PostTitle'),
    dateOfWork: pickDateYmd(raw, 'dateOfWork', 'DateOfWork'),
    startTime: formatTimeOnly(startTimeRaw),
    endTime: formatTimeOnly(endTimeRaw),
    minimumHoursRequired: pickInt(raw, 'minimumHoursRequired', 'MinimumHoursRequired'),
    location: pickStr(raw, 'location', 'Location'),
    totalPostPositions: pickInt(raw, 'totalPostPositions', 'TotalPostPositions'),
  };
}

function normalizeGroup(raw: Record<string, unknown>): TenureJobsDashboardGroup {
  const jobsRaw = raw.tenureJobs ?? raw.TenureJobs;
  const list = Array.isArray(jobsRaw) ? jobsRaw : [];
  const procTimeRaw = raw.processTime ?? raw.ProcessTime;
  return {
    requestID: pickStr(raw, 'requestID', 'RequestId', 'requestId'),
    requestTitle: pickStr(raw, 'requestTitle', 'RequestTitle'),
    requestUniqueNumber: pickStr(
      raw,
      'requestUniqueNumber',
      'RequestUniqueNumber',
      'projectNumber',
      'ProjectNumber'
    ),
    requesterName: pickStr(raw, 'requesterName', 'RequesterName'),
    dateOfWork: pickDateYmd(raw, 'dateOfWork', 'DateOfWork'),
    processDate: pickOptionalDateYmd(raw, 'processDate', 'ProcessDate'),
    processTime: formatTimeOnly(procTimeRaw),
    tenureJobs: list.map((row) => normalizeTenureJobRow(row as Record<string, unknown>)),
  };
}

/**
 * GET /Request/tenure-jobs-dashboard/{startDate}/{endDate}?page=&pageSize=
 * DateOfWork rows are generated for dates in the inclusive range startDate–endDate.
 * (RequesterManagerOnly — PagedList of requester groups.)
 */
export async function getTenureJobsDashboard(params: {
  startDate: string;
  endDate: string;
  page: number;
  pageSize: number;
}): Promise<TenureJobsDashboardResult> {
  const qs = buildPaginationQueryParams({ page: params.page, pageSize: params.pageSize });
  const start = params.startDate.trim();
  const end = params.endDate.trim();
  const endpoint = `/Request/tenure-jobs-dashboard/${start}/${end}?${qs.toString()}`;

  const response = await apiGet(endpoint);
  const responseText = await expectOkReadText(response, 'Failed to load tenure jobs');
  const p = parseJsonText<Record<string, unknown>>(responseText);
  const rawList = p.data ?? p.Data ?? p.items ?? p.Items;
  const list = Array.isArray(rawList)
    ? rawList.map((row) => normalizeGroup(row as Record<string, unknown>))
    : [];
  const totalRaw = p.totalRecords ?? p.TotalRecords;
  const totalRecords = typeof totalRaw === 'number' && !Number.isNaN(totalRaw) ? totalRaw : list.length;
  const errRaw = p.error ?? p.Error;
  const listMessage = typeof errRaw === 'string' && errRaw.trim() ? errRaw.trim() : null;

  return {
    groups: list,
    totalRecords,
    listMessage,
  };
}

function pickEmployeeNumberStr(raw: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = raw[k];
    if (v == null) continue;
    if (typeof v === 'number' && !Number.isNaN(v)) return String(v);
    if (typeof v === 'string' && v.trim() !== '') return v.trim();
  }
  return '';
}

/** Normalize `statisticsByLabel` keys to lowercase `l{n}` and numeric values. */
function normalizeStatisticsByLabel(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const nk = k.trim().toLowerCase();
    if (!/^l\d+$/.test(nk)) continue;
    const num =
      typeof v === 'number' && !Number.isNaN(v)
        ? v
        : typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))
          ? Number(v)
          : 0;
    out[nk] = num;
  }
  return out;
}

function normalizeTenureInterestedEmployeeRow(
  raw: Record<string, unknown>,
  index: number
): TenureInterestedEmployeeRow {
  const waitingPostPositionId = pickStr(
    raw,
    'waitingPostPositionId',
    'WaitingPostPositionId'
  ).trim();

  const employeeId = pickStr(
    raw,
    'employeeID',
    'EmployeeID',
    'employeeId',
    'EmployeeId'
  ).trim();

  const id =
    waitingPostPositionId ||
    employeeId ||
    pickStr(raw, 'id', 'Id').trim() ||
    `interested-${index}`;

  const last = pickStr(raw, 'lastName', 'LastName');
  const first = pickStr(raw, 'firstName', 'FirstName');
  let composed = '';
  if (last && first) composed = `${last}, ${first}`;
  else if (last || first) composed = (last || first).trim();

  const employeeName =
    pickStr(
      raw,
      'employeeName',
      'EmployeeName',
      'fullName',
      'FullName',
      'displayName',
      'DisplayName',
      'employee',
      'Employee'
    ).trim() || composed;

  const statsRaw =
    raw.statisticsByLabel ?? raw.StatisticsByLabel ?? raw.statistics ?? raw.Statistics;

  const tt = pickInt(raw, 'tenureType', 'TenureType');
  let tenureType: TenureMetricType | null = null;
  if (tt === TenureMetricType.Assignments) tenureType = TenureMetricType.Assignments;
  else if (tt === TenureMetricType.Hours) tenureType = TenureMetricType.Hours;

  return {
    id,
    waitingPostPositionId,
    employeeName,
    employeeNumber: pickEmployeeNumberStr(
      raw,
      'employeeNumber',
      'EmployeeNumber',
      'badgeNumber',
      'BadgeNumber',
      'employeeNum',
      'EmployeeNum'
    ),
    rank: pickStr(
      raw,
      'rank',
      'Rank',
      'rankTitle',
      'RankTitle',
      'jobTitle',
      'JobTitle',
      'employeeTypeName',
      'EmployeeTypeName'
    ),
    statisticsByLabel: normalizeStatisticsByLabel(statsRaw),
    tenureType,
    hasAppliedInTenure: raw.hasAppliedInTenure === true || raw.HasAppliedInTenure === true,
  };
}

/**
 * GET /Request/interested-list/{postId}/{dateOfWork}
 * DateOfWork: YYYY-MM-DD. Returns interested employees on the waiting list for that post and date.
 */
export async function getTenureExpressInterestList(
  postId: string,
  dateOfWork: string
): Promise<TenureInterestedEmployeeRow[]> {
  const pid = postId.trim();
  const dow = dateOfWork.trim();
  if (!pid || !/^\d{4}-\d{2}-\d{2}$/.test(dow)) {
    throw new Error('Invalid post or date of work');
  }
  const endpoint = `/Request/interested-list/${encodeURIComponent(pid)}/${encodeURIComponent(dow)}`;
  const response = await apiGet(endpoint);
  const responseText = await expectOkReadText(response, 'Failed to load interested list');
  const parsed = parseJsonText<unknown>(responseText);
  const list = Array.isArray(parsed) ? parsed : [];
  return list.map((row, i) =>
    normalizeTenureInterestedEmployeeRow(row as Record<string, unknown>, i)
  );
}

/**
 * POST /Request/process-tenure-waiting-list-for-waiting-post
 * Body: JSON string of the waiting-post-position Guid (same as scheduled job processing).
 */
export async function processTenureWaitingListForWaitingPost(
  waitingPostPositionId: string
): Promise<unknown> {
  const id = waitingPostPositionId.trim();
  if (!id) {
    throw new Error('Waiting post position id is required.');
  }
  const response = await apiPost('/Request/process-tenure-waiting-list-for-waiting-post', id, {});
  const text = await readResponseOk(response, 'Failed to assign employee from waiting list');
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return parseJsonText<unknown>(trimmed);
  } catch {
    return trimmed;
  }
}
