import { formatDate, formatDateTime } from '@/utils';
import { extractYyyyMmDdPrefix, formatTimeToHHmm } from '@/utils/dateTimeUtils';

/** API `Action` numeric codes (matches backend contract). */
export const AUDIT_ACTION_CODE = {
  INSERT: 0,
  UPDATE: 1,
  DELETE: 2,
} as const;

export type AuditChangedField = {
  property: string;
  old: unknown;
  new: unknown;
};

export type AuditHistoryRow = {
  EntityId: string;
  Displayname?: string;
  ChangedOn: string;
  ChangedFields: AuditChangedField[];
  Action: number;
  UserId: string;
  CorrelationId: string;
  /** Closed job position audit list fields (`AuditHistoryTable.ClosedPostPosition`). */
  AuditId?: number;
  EmployeeName?: string;
  Date?: string;
  StartTime?: string;
  EndTime?: string;
  HoursWorked?: string;
  HoursRequired?: string;
  JobTitle?: string;
  Type?: string;
};

/** Map API `Action` to grid label: 0 -> INSERT, 1 -> UPDATE, 2 -> DELETE. */
export function formatAuditActionLabel(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  const n = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  if (Number.isNaN(n)) return String(value);
  switch (n) {
    case AUDIT_ACTION_CODE.INSERT:
      return 'INSERT';
    case AUDIT_ACTION_CODE.UPDATE:
      return 'UPDATE';
    case AUDIT_ACTION_CODE.DELETE:
      return 'DELETE';
    default:
      return String(value);
  }
}

export function getAuditDisplayName(row: AuditHistoryRow): string {
  return row.Displayname ?? '-';
}

/**
 * Unique filter options from audit rows for the Jobs/Request/… dropdown.
 *
 * API returns many history rows per entity, and many entities can share the same
 * Displayname (e.g. several jobs titled "Payrate Test"). Options are unique by
 * case-insensitive display name; value === label so the page can filter via
 * searchTerm (all matching names), not a single EntityId.
 */
export function buildAuditDisplayNameFilterOptions(
  rows: AuditHistoryRow[]
): { value: string; label: string }[] {
  const byLabel = new Map<string, { value: string; label: string }>();
  for (const row of rows) {
    const name = (row.Displayname ?? row.EmployeeName ?? row.JobTitle ?? '').trim();
    const label = name && name !== '-' ? name : String(row.EntityId ?? '').trim();
    if (!label) continue;
    const key = label.toLowerCase();
    // Keep first occurrence (API list is typically newest-first).
    if (!byLabel.has(key)) {
      byLabel.set(key, { value: label, label });
    }
  }

  return Array.from(byLabel.values()).sort((a, b) => a.label.localeCompare(b.label));
}

/** Filter options whose value is EntityId (email template audit: `GET /Audit/getall/28/{id}`). */
export function buildAuditEntityIdFilterOptions(
  rows: AuditHistoryRow[]
): { value: string; label: string }[] {
  const byId = new Map<string, { value: string; label: string }>();
  for (const row of rows) {
    const id = String(row.EntityId ?? '').trim();
    if (!id) continue;
    const name = (row.Displayname ?? '').trim();
    const label = name && name !== '-' ? name : id;
    if (!byId.has(id)) byId.set(id, { value: id, label });
  }
  return Array.from(byId.values()).sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Audit grid "Changed On" — date only (no time). String-based formatting; no browser timezone conversion.
 * Backend returns department-local values; this reformats YYYY-MM-DD[ T]HH:mm… → MM/DD/YYYY.
 */
export function formatAuditChangedOn(value: unknown): string {
  if (value === null || value === undefined) return '-';
  const t = String(value).trim();
  if (!t) return '-';
  return formatDate(t) || '-';
}

/** Audit "View Changes" old/new cells: `unknown` JSON primitives → common formatters or plain text. */
export function formatAuditCellValue(value: unknown, _property?: string): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? 'true' : 'false';

  if (typeof value === 'number') {
    return String(value);
  }

  if (typeof value !== 'string') return String(value);
  const t = value.trim();
  if (!t) return '-';

  if (extractYyyyMmDdPrefix(t)) {
    return formatDateTime(t) || '-';
  }
  const timeOnly = formatTimeToHHmm(t);
  if (timeOnly) return timeOnly;

  return t;
}

export function filterAuditHistoryByDateRange(
  rows: AuditHistoryRow[],
  startYyyyMmDd: string,
  endYyyyMmDd: string
): AuditHistoryRow[] {
  const start = startYyyyMmDd?.trim() ?? '';
  const end = endYyyyMmDd?.trim() ?? '';
  if (!start && !end) return rows;
  return rows.filter((row) => {
    const day = extractYyyyMmDdPrefix(row.ChangedOn);
    if (!day) return false;
    if (start && day < start) return false;
    if (end && day > end) return false;
    return true;
  });
}
