import { apiGet } from '@/utils/apiClient';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';
import type { PageParam } from '@/types/common';
import { expectOkReadText, parseJsonText } from '@/services/textPlainJson';
import {
  PostPositionFlowEventType,
  type JobPositionFlowAction,
  type JobPositionFlowDetail,
  type JobPositionFlowEvent,
  type JobPositionFlowPagedResult,
  type JobPositionFlowStory,
} from '@/types/jobPositionFlowAudit';

type PagedListDto<T> = {
  data?: T[];
  Data?: T[];
  items?: T[];
  Items?: T[];
  totalRecords?: number;
  TotalRecords?: number;
};

/** `PostPositionFlowEventType` → UI action key. */
const EVENT_TYPE_TO_ACTION: Record<PostPositionFlowEventType, JobPositionFlowAction> = {
  [PostPositionFlowEventType.Created]: 'created',
  [PostPositionFlowEventType.SelfTaken]: 'self_taken',
  [PostPositionFlowEventType.AssignedByAdmin]: 'assigned_by_admin',
  [PostPositionFlowEventType.Transferred]: 'transferred',
  [PostPositionFlowEventType.UnassignedByAdmin]: 'unassigned_by_admin',
  [PostPositionFlowEventType.Closed]: 'closed',
  [PostPositionFlowEventType.ClosedAndSplit]: 'closed_and_split',
  [PostPositionFlowEventType.CancellationPending]: 'cancellation_pending',
  [PostPositionFlowEventType.Cancelled]: 'cancelled',
  [PostPositionFlowEventType.SplitAccepted]: 'split_accepted',
  [PostPositionFlowEventType.SplitDeclined]: 'split_declined',
  [PostPositionFlowEventType.Unclosed]: 'unclosed',
  [PostPositionFlowEventType.CancellationRevoked]: 'cancellation_revoked',
  [PostPositionFlowEventType.SplitPending]: 'split_pending',
  [PostPositionFlowEventType.AssignedByOther]: 'assigned_by_other',
  [PostPositionFlowEventType.AssignedBySystem]: 'assigned_by_system',
};

/** Enum member name (any casing) → `PostPositionFlowEventType` for string payloads. */
const EVENT_TYPE_NAME_TO_ENUM: Record<string, PostPositionFlowEventType> = {
  created: PostPositionFlowEventType.Created,
  selftaken: PostPositionFlowEventType.SelfTaken,
  assignedbyadmin: PostPositionFlowEventType.AssignedByAdmin,
  transferred: PostPositionFlowEventType.Transferred,
  unassignedbyadmin: PostPositionFlowEventType.UnassignedByAdmin,
  closed: PostPositionFlowEventType.Closed,
  closedandsplit: PostPositionFlowEventType.ClosedAndSplit,
  cancellationpending: PostPositionFlowEventType.CancellationPending,
  cancelled: PostPositionFlowEventType.Cancelled,
  splitaccepted: PostPositionFlowEventType.SplitAccepted,
  splitdeclined: PostPositionFlowEventType.SplitDeclined,
  unclosed: PostPositionFlowEventType.Unclosed,
  cancellationrevoked: PostPositionFlowEventType.CancellationRevoked,
  splitpending: PostPositionFlowEventType.SplitPending,
  assignedbyother: PostPositionFlowEventType.AssignedByOther,
  assignedbysystem: PostPositionFlowEventType.AssignedBySystem,
};

const toTrimmedString = (value: unknown): string => {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

const toOptionalString = (value: unknown): string | undefined => {
  const s = toTrimmedString(value);
  return s.length > 0 ? s : undefined;
};

const parseGuidLike = (value: unknown): string => toTrimmedString(value);

const normalizeEnumKey = (value: string): string =>
  value.toLowerCase().replace(/[\s_-]+/g, '');

const isPostPositionFlowEventType = (value: number): value is PostPositionFlowEventType =>
  Object.values(PostPositionFlowEventType).includes(value);

const resolveEventType = (raw: Record<string, unknown>): PostPositionFlowEventType | -1 => {
  const numeric = Number(raw.eventType ?? raw.EventType);
  if (Number.isFinite(numeric) && isPostPositionFlowEventType(numeric)) {
    return numeric;
  }

  const nameCandidates = [
    raw.eventTypeName,
    raw.EventTypeName,
    raw.action,
    raw.Action,
    typeof raw.eventType === 'string' ? raw.eventType : undefined,
    typeof raw.EventType === 'string' ? raw.EventType : undefined,
  ];

  for (const candidate of nameCandidates) {
    const key = normalizeEnumKey(toTrimmedString(candidate));
    if (key && EVENT_TYPE_NAME_TO_ENUM[key] != null) {
      return EVENT_TYPE_NAME_TO_ENUM[key];
    }
  }

  return -1;
};

const resolveAction = (eventType: PostPositionFlowEventType | -1): JobPositionFlowAction => {
  if (eventType !== -1) {
    return EVENT_TYPE_TO_ACTION[eventType];
  }
  return 'unknown';
};

/** Actor role from event type; assign kinds encode who assigned. */
const resolveActorRoleFromEventType = (
  eventType: PostPositionFlowEventType | -1
): JobPositionFlowEvent['actorRole'] | null => {
  if (eventType === -1) return null;
  switch (eventType) {
    case PostPositionFlowEventType.Created:
    case PostPositionFlowEventType.AssignedBySystem:
      return 'system';
    case PostPositionFlowEventType.AssignedByAdmin:
    case PostPositionFlowEventType.UnassignedByAdmin:
      return 'admin';
    case PostPositionFlowEventType.SelfTaken:
    case PostPositionFlowEventType.AssignedByOther:
      return 'employee';
    default:
      return null;
  }
};

const resolveActorRoleFromApiRole = (
  roleRaw: unknown
): JobPositionFlowEvent['actorRole'] | null => {
  const roleName = normalizeEnumKey(toTrimmedString(roleRaw));
  if (roleName === 'system' || roleName === '0') return 'system';
  if (roleName === 'admin' || roleName === '1') return 'admin';
  if (roleName === 'employee' || roleName === '2') return 'employee';
  return null;
};

const resolveActorRole = (
  eventType: PostPositionFlowEventType | -1,
  roleRaw: unknown,
  actorName: string
): JobPositionFlowEvent['actorRole'] => {
  return (
    resolveActorRoleFromEventType(eventType) ??
    resolveActorRoleFromApiRole(roleRaw) ??
    (normalizeEnumKey(actorName) === 'system' || !actorName ? 'system' : 'employee')
  );
};

const parseDetailNode = (item: unknown): JobPositionFlowDetail | null => {
  if (!item || typeof item !== 'object') return null;
  const row = item as Record<string, unknown>;
  const label = toTrimmedString(row.label ?? row.Label ?? row.key ?? row.Key ?? row.name ?? row.Name);
  const detailValue = toTrimmedString(
    row.value ?? row.Value ?? row.text ?? row.Text ?? row.detail ?? row.Detail
  );
  const nestedRaw = row.items ?? row.Items;
  const items = Array.isArray(nestedRaw)
    ? nestedRaw.map((child) => parseDetailNode(child)).filter((d): d is JobPositionFlowDetail => d != null)
    : undefined;

  if (!label && !detailValue && (!items || items.length === 0)) return null;

  return {
    label: label || 'Detail',
    value: detailValue,
    ...(items && items.length > 0 ? { items } : {}),
  };
};

const parseDetails = (value: unknown): JobPositionFlowDetail[] => {
  if (value == null) return [];

  let parsed: unknown = value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      parsed = JSON.parse(trimmed) as unknown;
    } catch {
      return [{ label: 'Details', value: trimmed }];
    }
  }

  if (Array.isArray(parsed)) {
    return parsed.map((item) => parseDetailNode(item)).filter((d): d is JobPositionFlowDetail => d != null);
  }

  if (typeof parsed === 'object') {
    return Object.entries(parsed as Record<string, unknown>).map(([key, v]) => ({
      label: key,
      value: toTrimmedString(v) || '',
    }));
  }

  return [];
};

const formatOccurredAt = (value: unknown): string => {
  const raw = toTrimmedString(value);
  if (!raw) return '—';
  return raw.replace('T', ' ').replace(/\.\d+Z?$/, '').replace(/Z$/, '');
};

export const normalizeJobPositionFlowEvent = (rawInput: unknown): JobPositionFlowEvent => {
  const raw = (rawInput && typeof rawInput === 'object' ? rawInput : {}) as Record<string, unknown>;
  const eventType = resolveEventType(raw);
  const action = resolveAction(eventType);

  const performedByRaw = raw.performedBy ?? raw.PerformedBy;
  const actorName =
    typeof performedByRaw === 'string'
      ? toOptionalString(performedByRaw) ??
        toOptionalString(raw.performedByName ?? raw.PerformedByName) ??
        (action === 'assigned_by_system' || action === 'created' ? 'System' : '—')
      : toOptionalString(raw.performedByName ?? raw.PerformedByName) ??
        (action === 'assigned_by_system' || action === 'created' ? 'System' : '—');

  const actorRole = resolveActorRole(
    eventType,
    raw.role ?? raw.Role ?? raw.actorRole ?? raw.ActorRole,
    actorName
  );

  const id =
    toOptionalString(raw.id ?? raw.Id) ??
    `${parseGuidLike(raw.postPositionId ?? raw.PostPositionId)}-${action}-${formatOccurredAt(
      raw.occurredAt ?? raw.OccurredAt ?? raw.recordedDate ?? raw.RecordedDate
    )}`;

  return {
    id,
    action,
    eventType,
    occurredAt: formatOccurredAt(
      raw.occurredAt ?? raw.OccurredAt ?? raw.recordedDate ?? raw.RecordedDate
    ),
    actorName,
    actorRole,
    employeeName: toOptionalString(raw.employeeName ?? raw.EmployeeName),
    summary: toOptionalString(raw.description ?? raw.Description ?? raw.summary ?? raw.Summary) ?? '—',
    details: parseDetails(raw.details ?? raw.Details ?? raw.detailsJson ?? raw.DetailsJson),
    postPositionId: toOptionalString(raw.postPositionId ?? raw.PostPositionId),
    relatedPostPositionId: toOptionalString(raw.relatedPostPositionId ?? raw.RelatedPostPositionId),
  };
};

export const normalizeJobPositionFlowStory = (rawInput: unknown): JobPositionFlowStory => {
  const raw = (rawInput && typeof rawInput === 'object' ? rawInput : {}) as Record<string, unknown>;
  const postPositionId = parseGuidLike(raw.postPositionId ?? raw.PostPositionId);
  const flowRoot = parseGuidLike(
    raw.flowRootPostPositionId ?? raw.FlowRootPostPositionId ?? postPositionId
  );
  const eventsRaw = raw.events ?? raw.Events;
  const events = Array.isArray(eventsRaw)
    ? eventsRaw.map((e) => normalizeJobPositionFlowEvent(e))
    : [];

  const workDate = toOptionalString(
    raw.workDate ?? raw.WorkDate ?? raw.date ?? raw.Date ?? raw.dateOfWork ?? raw.DateOfWork
  );
  const startTime = toOptionalString(raw.startTime ?? raw.StartTime) ?? '';
  const endTime = toOptionalString(raw.endTime ?? raw.EndTime) ?? '';
  const statusRaw = raw.currentStatus ?? raw.CurrentStatus ?? raw.status ?? raw.Status;
  const currentStatus =
    typeof statusRaw === 'number' ? String(statusRaw) : toOptionalString(statusRaw) ?? '—';

  return {
    id: toOptionalString(raw.id ?? raw.Id) || flowRoot || postPositionId || `flow-${Date.now()}`,
    flowRootPostPositionId: flowRoot,
    postPositionId,
    jobTitle:
      toOptionalString(raw.postTitle ?? raw.PostTitle ?? raw.jobTitle ?? raw.JobTitle) ?? '—',
    requestTitle: toOptionalString(raw.requestTitle ?? raw.RequestTitle),
    workDate: workDate ?? '—',
    startTime,
    endTime,
    currentStatus,
    employeeName: toOptionalString(raw.employeeName ?? raw.EmployeeName) ?? '—',
    events,
  };
};

const extractRows = (parsed: unknown): unknown[] => {
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== 'object') return [];
  const p = parsed as PagedListDto<unknown>;
  const rows = p.data ?? p.Data ?? p.items ?? p.Items;
  return Array.isArray(rows) ? rows : [];
};

const extractTotal = (parsed: unknown, fallback: number): number => {
  if (!parsed || typeof parsed !== 'object') return fallback;
  const p = parsed as PagedListDto<unknown>;
  const total = p.totalRecords ?? p.TotalRecords;
  return typeof total === 'number' ? total : fallback;
};

/** `GET /Audit/job-position-flow` — paged stories (events oldest → newest). */
export const getJobPositionFlows = async (
  pagination?: PageParam,
  search?: string
): Promise<JobPositionFlowPagedResult> => {
  const queryParams = buildPaginationQueryParams(pagination);
  const term = search?.trim();
  if (term) {
    queryParams.set('search', term);
  }
  const query = queryParams.toString();
  const endpoint = `/Audit/job-position-flow${query ? `?${query}` : ''}`;
  const response = await apiGet(endpoint);
  const text = await expectOkReadText(response, 'Failed to fetch job position flow audit');
  const parsed = parseJsonText<unknown>(text);
  const rows = extractRows(parsed).map((row) => normalizeJobPositionFlowStory(row));
  return {
    data: rows,
    totalRecords: extractTotal(parsed, rows.length),
  };
};

/** `GET /Audit/job-position-flow/{postPositionId}` — one story + timeline. */
export const getJobPositionFlowById = async (
  postPositionId: string
): Promise<JobPositionFlowStory> => {
  const id = postPositionId.trim();
  if (!id) {
    throw new Error('Post position id is required');
  }
  const endpoint = `/Audit/job-position-flow/${encodeURIComponent(id)}`;
  const response = await apiGet(endpoint);
  const text = await expectOkReadText(response, 'Failed to fetch job position flow');
  const parsed = parseJsonText<unknown>(text);
  return normalizeJobPositionFlowStory(parsed);
};
