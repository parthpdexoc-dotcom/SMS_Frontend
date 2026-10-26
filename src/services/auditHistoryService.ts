import { apiGet } from '@/utils/apiClient';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';
import type { PageParam, AuditFilter } from '@/types/common';
import { expectOkReadText, parseJsonText } from '@/services/textPlainJson';
import type {
  AuditChangedField,
  AuditHistoryRow,
} from '@/utils/auditHistoryUtils';
import {
  buildAuditDisplayNameFilterOptions,
  buildAuditEntityIdFilterOptions,
} from '@/utils/auditHistoryUtils';
import type { PostWorkflowAuditResult } from '@/types/postWorkflowAudit';
import { parseEmployeePostListingItem } from '@/utils/employeePostListingItem';

export enum AuditHistoryTable {
  Requester = 0,
  Post = 1,
  Request = 2,
  PostPosition = 3,
  Employee = 4,
  ClosedPostPosition = 5,
  ClosedPostPositionEquipment = 6,
  /** Align with backend `Audit` table index for request schedule history. */
  RequestSchedule = 7,
  Payment = 21,
  PaymentAllocation = 22,
  RequesterLedger = 23,
  Invoice = 24,
  InvoiceDetail = 25,
  PaymentType = 26,
  /** Placeholder profiles (`GET /Audit/getall/27`). */
  Placeholder = 27,
  /** Email templates (`GET /Audit/getall/28` and `GET /Audit/getall/28/{emailTemplateId}`). */
  EmailTemplate = 28,
}

type PagedListDto<T> = {
  data?: T[];
  Data?: T[];
  items?: T[];
  Items?: T[];
  totalRecords?: number;
  TotalRecords?: number;
};

type AuditHistoryApiRow = {
  EntityId?: unknown;
  entityId?: unknown;
  Displayname?: unknown;
  displayName?: unknown;
  ChangedOn?: unknown;
  changedOn?: unknown;
  ChangedFields?: unknown;
  changedFields?: unknown;
  Action?: unknown;
  action?: unknown;
  UserId?: unknown;
  userId?: unknown;
  CorrelationId?: unknown;
  correlationId?: unknown;
  /** Closed job position audit (`table` = 5). */
  auditId?: unknown;
  AuditId?: unknown;
  closedPostPositionId?: unknown;
  ClosedPostPositionId?: unknown;
  employeeName?: unknown;
  EmployeeName?: unknown;
  date?: unknown;
  Date?: unknown;
  startTime?: unknown;
  StartTime?: unknown;
  endTime?: unknown;
  EndTime?: unknown;
  hoursWorked?: unknown;
  HoursWorked?: unknown;
  hoursRequired?: unknown;
  HoursRequired?: unknown;
  jobTitle?: unknown;
  JobTitle?: unknown;
  type?: unknown;
  Type?: unknown;
};

export type AuditHistoryResult = {
  data: AuditHistoryRow[];
  totalRecords: number;
};

const normalizeChangedFields = (value: unknown): AuditChangedField[] => {
  if (Array.isArray(value)) {
    return value as AuditChangedField[];
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? (parsed as AuditChangedField[]) : [];
    } catch {
      return [];
    }
  }
  return [];
};

const toNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const s = value.trim();
  return s.length > 0 ? s : undefined;
};

const toStringOrEmpty = (value: unknown): string => {
  if (value == null) return '';
  return String(value);
};

const toNumberOrDefault = (value: unknown, fallback = 0): number => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const normalizeAuditRow = (raw: AuditHistoryApiRow): AuditHistoryRow => {
  const closedPostPositionId = toNonEmptyString(
    raw.closedPostPositionId ?? raw.ClosedPostPositionId
  );
  const employeeName = toNonEmptyString(raw.employeeName ?? raw.EmployeeName);
  const jobTitle = toNonEmptyString(raw.jobTitle ?? raw.JobTitle);
  const auditIdRaw = raw.auditId ?? raw.AuditId;
  const auditId =
    auditIdRaw == null || auditIdRaw === ''
      ? undefined
      : toNumberOrDefault(auditIdRaw, Number.NaN);
  const hasValidAuditId = auditId != null && Number.isFinite(auditId);

  return {
    EntityId: toStringOrEmpty(
      raw.EntityId ?? raw.entityId ?? closedPostPositionId ?? (hasValidAuditId ? String(auditId) : '')
    ),
    Displayname: toNonEmptyString(raw.Displayname ?? raw.displayName ?? employeeName ?? jobTitle),
    ChangedOn: toStringOrEmpty(raw.ChangedOn ?? raw.changedOn),
    ChangedFields: normalizeChangedFields(raw.ChangedFields ?? raw.changedFields),
    Action: toNumberOrDefault(raw.Action ?? raw.action),
    UserId: toStringOrEmpty(raw.UserId ?? raw.userId),
    CorrelationId: toStringOrEmpty(raw.CorrelationId ?? raw.correlationId),
    AuditId: hasValidAuditId ? auditId : undefined,
    EmployeeName: employeeName,
    Date: toNonEmptyString(raw.date ?? raw.Date),
    StartTime: toNonEmptyString(raw.startTime ?? raw.StartTime),
    EndTime: toNonEmptyString(raw.endTime ?? raw.EndTime),
    HoursWorked: toNonEmptyString(raw.hoursWorked ?? raw.HoursWorked),
    HoursRequired: toNonEmptyString(raw.hoursRequired ?? raw.HoursRequired),
    JobTitle: jobTitle,
    Type: toNonEmptyString(raw.type ?? raw.Type),
  };
};

const extractRowsFromPaged = (parsed: unknown): AuditHistoryApiRow[] => {
  if (!parsed || typeof parsed !== 'object') return [];
  const p = parsed as PagedListDto<AuditHistoryApiRow>;
  const rows = p.data ?? p.Data ?? p.items ?? p.Items;
  return Array.isArray(rows) ? rows : [];
};

const extractTotalFromPaged = (parsed: unknown): number | undefined => {
  if (!parsed || typeof parsed !== 'object') return undefined;
  const p = parsed as PagedListDto<unknown>;
  const total = p.totalRecords ?? p.TotalRecords;
  return typeof total === 'number' ? total : undefined;
};

/** Single-entity audit: `GET .../getall/{table}/{entityId}`. */
export const getAuditHistory = async (
  table: AuditHistoryTable,
  entityId: string,
  filters?: AuditFilter
): Promise<AuditHistoryResult> => {
  const queryParams = buildPaginationQueryParams(filters);
  if (filters?.startDate) {
    queryParams.append('startDate', filters.startDate);
  }
  if (filters?.endDate) {
    queryParams.append('endDate', filters.endDate);
  }
  if (filters?.changedOn) {
    queryParams.append('changedOn', filters.changedOn);
  }
  const query = queryParams.toString();
  const endpoint = `/Audit/getall/${table}/${encodeURIComponent(entityId)}${query ? `?${query}` : ''}`;
  const response = await apiGet(endpoint);
  const text = await expectOkReadText(response, 'Failed to fetch audit history');
  const parsed = parseJsonText<unknown>(text);

  if (Array.isArray(parsed)) {
    const rows = (parsed as AuditHistoryApiRow[]).map((row) => normalizeAuditRow(row));
    return { data: rows, totalRecords: rows.length };
  }

  const pagedRows = extractRowsFromPaged(parsed);
  if (pagedRows.length > 0) {
    const normalized = pagedRows.map((row) => normalizeAuditRow(row));
    return {
      data: normalized,
      totalRecords: extractTotalFromPaged(parsed) ?? normalized.length,
    };
  }

  return {
    data: [],
    totalRecords: extractTotalFromPaged(parsed) ?? 0,
  };
};

/**
 * IA Admin / Operator / Department Admin → `GET .../getall/{table}?page=&pageSize=` (department from token).
 * Other roles → `GET .../getall/{table}/employee/{employeeId}?page=&pageSize=`.
 */
export type GetAllAuditByTableScope =
  | { kind: 'department' }
  | { kind: 'employee'; employeeId: string };

const buildGetAllAuditListEndpoint = (
  table: AuditHistoryTable,
  queryParams: URLSearchParams,
  scope?: GetAllAuditByTableScope
): string => {
  const query = queryParams.toString();
  const qs = query ? `?${query}` : '';

  if (scope?.kind === 'employee') {
    const id = scope.employeeId.trim();
    return `/Audit/getall/${table}/employee/${encodeURIComponent(id)}${qs}`;
  }

  if (scope?.kind === 'department') {
    const q = queryParams.toString();
    return `/Audit/getall/${table}${q ? `?${q}` : ''}`;
  }

  return `/Audit/getall/${table}${qs}`;
};

/** Paged audit rows for a logical table (`GET .../getall/{table}` or employee-scoped path). */
export const getAllAuditByTable = async (
  table: AuditHistoryTable,
  filters?: AuditFilter,
  scope?: GetAllAuditByTableScope
): Promise<AuditHistoryResult> => {
  if (scope?.kind === 'employee' && !scope.employeeId.trim()) {
    return { data: [], totalRecords: 0 };
  }
  const queryParams = buildPaginationQueryParams(filters);
  if (filters?.startDate) {
    queryParams.append('startDate', filters.startDate);
  }
  if (filters?.endDate) {
    queryParams.append('endDate', filters.endDate);
  }
  if (filters?.changedOn) {
    queryParams.append('changedOn', filters.changedOn);
  }
  const endpoint = buildGetAllAuditListEndpoint(table, queryParams, scope);
  const response = await apiGet(endpoint);
  const text = await expectOkReadText(response, 'Failed to fetch audit log');
  const parsed = parseJsonText<unknown>(text);

  if (Array.isArray(parsed)) {
    const rows = (parsed as AuditHistoryApiRow[]).map((row) => normalizeAuditRow(row));
    return { data: rows, totalRecords: rows.length };
  }

  const pagedRows = extractRowsFromPaged(parsed);
  if (pagedRows.length > 0) {
    const normalized = pagedRows.map((row) => normalizeAuditRow(row));
    return {
      data: normalized,
      totalRecords: extractTotalFromPaged(parsed) ?? normalized.length,
    };
  }

  return {
    data: [],
    totalRecords: extractTotalFromPaged(parsed) ?? 0,
  };
};

/**
 * Department-scoped audit list with optional entity filter (department resolved from auth token).
 * - No filter: `GET .../getall/{table}?page=…`
 * - Request / Requester / Post + filter: `GET .../getall/{table}/{entityId}` (single-entity audit)
 * - Other tables + filter: `GET .../getall/{table}/employee/{employeeId}`
 */
export const getAuditLogForDepartmentFilter = async (
  table: AuditHistoryTable,
  filters: AuditFilter | undefined,
  filterEntityId: string | undefined
): Promise<AuditHistoryResult> => {
  const id = filterEntityId?.trim();
  if (!id) {
    return getAllAuditByTable(table, filters, { kind: 'department' });
  }
  return getAuditHistory(table, id, filters);
};

/**
 * Display-name filter dropdown for any audit table: same `/Audit/getall/{table}` as the grid.
 * Unique labels from Displayname (fallback EmployeeName / JobTitle); value === label for searchTerm filtering.
 */
export const getAuditDisplayNameFilterOptions = async (
  table: AuditHistoryTable
): Promise<{ value: string; label: string }[]> => {
  const { data } = await getAllAuditByTable(
    table,
    { page: 1, pageSize: 5000 },
    { kind: 'department' }
  );
  if (table === AuditHistoryTable.EmailTemplate) {
    return buildAuditEntityIdFilterOptions(data);
  }
  return buildAuditDisplayNameFilterOptions(data);
};

/** Department-scoped audit list/search via `GET /Audit/search` (optional searchTerm, entity filter, changedOn). */
export const searchAuditHistory = async (
  table: AuditHistoryTable,
  searchTerm: string,
  filters?: AuditFilter,
  filterEntityId?: string
): Promise<AuditHistoryResult> => {
  const queryParams = buildPaginationQueryParams(filters);
  if (searchTerm && searchTerm.trim()) {
    queryParams.append('searchTerm', searchTerm.trim());
  }
  if (filters?.startDate) {
    queryParams.append('startDate', filters.startDate);
  }
  if (filters?.endDate) {
    queryParams.append('endDate', filters.endDate);
  }
  if (filters?.changedOn) {
    queryParams.append('changedOn', filters.changedOn);
  }
  const entityFilterId = filterEntityId?.trim();
  if (entityFilterId) {
    queryParams.append('entityId', entityFilterId);
  }
  queryParams.append('table', String(table));
  const query = queryParams.toString();
  const endpoint = `/Audit/search${query ? `?${query}` : ''}`;
  const response = await apiGet(endpoint);
  const text = await expectOkReadText(response, 'Failed to search audit history');
  const parsed = parseJsonText<unknown>(text);

  if (Array.isArray(parsed)) {
    const rows = (parsed as AuditHistoryApiRow[]).map((row) => normalizeAuditRow(row));
    return { data: rows, totalRecords: rows.length };
  }

  const pagedRows = extractRowsFromPaged(parsed);
  if (pagedRows.length > 0) {
    const normalized = pagedRows.map((row) => normalizeAuditRow(row));
    return {
      data: normalized,
      totalRecords: extractTotalFromPaged(parsed) ?? normalized.length,
    };
  }

  return {
    data: [],
    totalRecords: extractTotalFromPaged(parsed) ?? 0,
  };
};

export const getPostWorkflowAudits = async (
  pagination?: PageParam,
  status: string | number | boolean = '1',
  /** Optional scoped employee filter sent as `employeeId` query param. */
  employeeId?: string
): Promise<PostWorkflowAuditResult> => {
  const queryParams = buildPaginationQueryParams(pagination);
  queryParams.set('status', String(status));
  const scoped = employeeId?.trim();
  if (scoped) {
    queryParams.set('employeeId', scoped);
  }
  const query = queryParams.toString();
  const endpoint = `/Audit/post-workflow${query ? `?${query}` : ''}`;
  const response = await apiGet(endpoint);
  const text = await expectOkReadText(response, 'Failed to fetch failed transactions');
  const parsed = parseJsonText<unknown>(text);

  if (Array.isArray(parsed)) {
    const rows = parsed.map((row) => parseEmployeePostListingItem(row));
    return { data: rows, totalRecords: rows.length };
  }

  const pagedRows = extractRowsFromPaged(parsed);
  if (pagedRows.length > 0) {
    const normalized = pagedRows.map((row) => parseEmployeePostListingItem(row));
    return {
      data: normalized,
      totalRecords: extractTotalFromPaged(parsed) ?? normalized.length,
    };
  }

  return {
    data: [],
    totalRecords: extractTotalFromPaged(parsed) ?? 0,
  };
};

