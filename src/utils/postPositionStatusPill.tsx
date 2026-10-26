import React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import { SMSBox } from '@/components/smsatoms';
import { AUDIT_ACTION_CODE, formatAuditActionLabel } from '@/utils/auditHistoryUtils';
import type { PostPositionResponse } from '@/types/postPosition';
import { PostPositionStatus } from '@/types/postPosition';

/** `audit`: API action 0–2 (INSERT/UPDATE/DELETE). `post-position`: workflow / position status codes. */
export type StatusPillContext = 'post-position' | 'audit';

/** `wrap`: shrink to column and break long labels. `nowrap`: one line (use when the table scrolls horizontally). */
export type StatusPillLayout = 'wrap' | 'nowrap';

export type StatusPillOptions = {
  layout?: StatusPillLayout;
  /** Smaller padding/font for tight table action cells. */
  compact?: boolean;
  /** Override default status label (e.g. shorter text in action column). */
  label?: string;
};

const PILL_COMPACT_SX: SxProps<Theme> = {
  px: 0.625,
  py: 0.25,
  fontSize: '0.625rem',
  letterSpacing: 0,
  lineHeight: 1.2,
};

function parseAuditActionCode(value: unknown): number {
  if (value === null || value === undefined || value === '') return Number.NaN;
  return typeof value === 'number' ? value : Number.parseInt(String(value), 10);
}

const PILL_VISUAL_SX: SxProps<Theme> = {
  boxSizing: 'border-box',
  px: 1.25,
  py: 0.5,
  borderRadius: 999,
  border: '1px solid',
  fontSize: '0.75rem',
  fontWeight: 700,
  letterSpacing: '0.02em',
  lineHeight: 1.25,
  textTransform: 'uppercase',
  textAlign: 'left',
};

const PILL_WRAP_SX: SxProps<Theme> = {
  display: 'block',
  /** Shrink to short labels; cap to parent so long labels wrap instead of widening the layout. */
  width: 'fit-content',
  maxWidth: '100%',
  minWidth: 0,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  wordBreak: 'normal',
};

const PILL_NOWRAP_SX: SxProps<Theme> = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 'max-content',
  maxWidth: 'none',
  minWidth: 'max-content',
  flexShrink: 0,
  whiteSpace: 'nowrap',
  overflowWrap: 'normal',
  wordBreak: 'keep-all',
};

export const renderLabeledStatusPill = (
  label: string,
  toneSx: SxProps<Theme>,
  options?: StatusPillOptions
): React.ReactNode => {
  const nowrap = options?.layout === 'nowrap';
  const compactSx = options?.compact ? PILL_COMPACT_SX : null;
  if (nowrap) {
    return (
      <SMSBox
        component="span"
        className="status-pill status-pill--nowrap"
        sx={[PILL_VISUAL_SX, compactSx, PILL_NOWRAP_SX, toneSx] as SxProps<Theme>}
      >
        {label}
      </SMSBox>
    );
  }
  return (
    <SMSBox component="span" sx={[PILL_VISUAL_SX, compactSx, PILL_WRAP_SX, toneSx] as SxProps<Theme>}>
      <SMSBox component="span" sx={{ display: 'block', maxWidth: '100%', overflowWrap: 'anywhere', minWidth: 0 }}>
        {label}
      </SMSBox>
    </SMSBox>
  );
};

const normalizeStatusKey = (value: string): string =>
  value.toLowerCase().replace(/[\s_-]+/g, '');

/** Labels for `SMS.Generic.Enums.PostPositionStatus` (every numeric member). */
const STATUS_LABELS: Record<number, string> = {
  [PostPositionStatus.Assigned]: 'Assigned',
  [PostPositionStatus.Closed]: 'Closed',
  [PostPositionStatus.Cancelled]: 'Cancelled',
  [PostPositionStatus.ClosedAndSplit]: 'Closed And Split',
  [PostPositionStatus.SplitDecisionPending]: 'Split Decision Pending',
  [PostPositionStatus.Declined]: 'Declined',
  [PostPositionStatus.Waiting]: 'Waiting',
  [PostPositionStatus.Unclosed]: 'Unclosed',
  [PostPositionStatus.Transferred]: 'Transferred',
  [PostPositionStatus.CancellationPending]: 'Cancellation Pending',
  [PostPositionStatus.SpecialEvent]: 'Special Event',
};

/** Grouping aligned with pill colors — used by pills and `EmployeeCard` border tone. */
export type PostPositionStatusCardTone = 'success' | 'info' | 'warning' | 'danger' | 'neutral';

export function getPostPositionStatusCardTone(status: number): PostPositionStatusCardTone {
  if (!Number.isFinite(status)) return 'neutral';
  if (status === PostPositionStatus.Assigned) return 'success';
  if (
    status === PostPositionStatus.Closed ||
    status === PostPositionStatus.ClosedAndSplit ||
    status === PostPositionStatus.Transferred ||
    status === PostPositionStatus.Unclosed
  ) {
    return 'info';
  }
  if (status === PostPositionStatus.Cancelled || status === PostPositionStatus.Declined) {
    return 'danger';
  }
  if (
    status === PostPositionStatus.Waiting ||
    status === PostPositionStatus.CancellationPending ||
    status === PostPositionStatus.SplitDecisionPending ||
    status === PostPositionStatus.SpecialEvent
  ) {
    return 'warning';
  }
  return 'neutral';
}

export function getPostPositionStatusDisplayLabel(status: number): string {
  if (!Number.isFinite(status)) return 'Unknown';
  return STATUS_LABELS[status] ?? `Status ${status}`;
}

const STATUS_KEY_TO_ENUM: Record<string, PostPositionStatus> = Object.fromEntries(
  Object.entries(STATUS_LABELS).map(([code, label]) => [normalizeStatusKey(label), Number(code)])
) as Record<string, PostPositionStatus>;

/** Resolves API status (numeric code, numeric string, or display name) to `PostPositionStatus`. */
export function resolvePostPositionStatusValue(status: unknown): number {
  if (status === null || status === undefined || status === '') return Number.NaN;
  if (typeof status === 'number' && Number.isFinite(status)) return status;
  const asNum = Number(status);
  if (Number.isFinite(asNum)) return asNum;
  const key = normalizeStatusKey(String(status));
  const mapped = STATUS_KEY_TO_ENUM[key];
  if (mapped != null) return mapped;
  return Number.NaN;
}

/** Reads placeholder flag from API camelCase or PascalCase. */
export function readPostPositionIsPlaceholder(position: PostPositionResponse): boolean {
  if (position.isPlaceholder === true) return true;
  const raw = position as unknown as Record<string, unknown>;
  const v = raw.isPlaceholder ?? raw.IsPlaceholder;
  return v === true || v === 'true';
}

/** Reads numeric status from API camelCase or PascalCase. */
export function readPostPositionStatusValue(position: PostPositionResponse): number {
  const raw = position as unknown as Record<string, unknown>;
  const v = position.postPositionStatus ?? raw.PostPositionStatus;
  const n = Number(v);
  return Number.isFinite(n) ? n : Number.NaN;
}

const getStatusToneSx = (status: number, context: StatusPillContext = 'post-position'): SxProps<Theme> => {
  if (context === 'audit') {
    if (status === AUDIT_ACTION_CODE.INSERT) {
      return { bgcolor: 'success.50', color: 'success.dark', borderColor: 'success.200' };
    }
    if (status === AUDIT_ACTION_CODE.UPDATE) {
      return { bgcolor: '#fff7e6', color: '#b45309', borderColor: '#f7d9a2' };
    }
    if (status === AUDIT_ACTION_CODE.DELETE) {
      return { bgcolor: 'error.50', color: 'error.dark', borderColor: 'error.200' };
    }
    return { bgcolor: 'grey.100', color: 'text.secondary', borderColor: 'grey.300' };
  }
  const cat = getPostPositionStatusCardTone(status);
  if (cat === 'success') {
    return { bgcolor: 'success.50', color: 'success.dark', borderColor: 'success.200' };
  }
  if (cat === 'info') {
    return { bgcolor: 'info.50', color: 'info.dark', borderColor: 'info.200' };
  }
  if (cat === 'danger') {
    return { bgcolor: 'error.50', color: 'error.dark', borderColor: 'error.200' };
  }
  if (cat === 'warning') {
    return { bgcolor: 'warning.50', color: 'warning.dark', borderColor: 'warning.200' };
  }
  return { bgcolor: 'grey.100', color: 'text.secondary', borderColor: 'grey.300' };
};

export const renderPostPositionStatusPill = (
  statusValue: unknown,
  context: StatusPillContext = 'post-position',
  options?: StatusPillOptions
): React.ReactNode => {
  if (context === 'audit') {
    const label = formatAuditActionLabel(statusValue);
    const code = parseAuditActionCode(statusValue);
    const toneSx = getStatusToneSx(code, 'audit');
    return renderLabeledStatusPill(label, toneSx, options);
  }
  const status = Number(statusValue);
  const label = options?.label ?? getPostPositionStatusDisplayLabel(status);
  const toneSx = getStatusToneSx(status, 'post-position');
  return renderLabeledStatusPill(label, toneSx, options);
};
