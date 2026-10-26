import React, { useMemo } from 'react';
import { SMSBox } from '@/components/smsatoms';
import { DAILY_WORKSPACE_REQUEST_TYPES } from '@/constants/dailyWorkspaceFilters';
import { DAILY_ADMINISTRATION } from '@/constants/strings';
import { RequestStatus, RequestTypes } from '@/types/request';

export const WORKSPACE_STATUS_OPTIONS: ReadonlyArray<{ value: RequestStatus; label: string }> = [
  { value: RequestStatus.Pending, label: DAILY_ADMINISTRATION.STATUS_FILTER.OPTIONS.PENDING },
  { value: RequestStatus.ReleaseNow, label: DAILY_ADMINISTRATION.STATUS_FILTER.OPTIONS.RELEASE_NOW },
  { value: RequestStatus.ReleasedOn, label: DAILY_ADMINISTRATION.STATUS_FILTER.OPTIONS.RELEASED_ON },
  { value: RequestStatus.Cancelled, label: DAILY_ADMINISTRATION.STATUS_FILTER.OPTIONS.CANCELLED },
  { value: RequestStatus.Completed, label: DAILY_ADMINISTRATION.STATUS_FILTER.OPTIONS.COMPLETED },
];

const WORKSPACE_TYPE_LABELS: Record<RequestTypes, string> = {
  [RequestTypes.OneTime]: DAILY_ADMINISTRATION.REQUEST_TYPE_FILTER.OPTIONS.ONE_TIME,
  [RequestTypes.Daily]: DAILY_ADMINISTRATION.REQUEST_TYPE_FILTER.OPTIONS.DAILY,
  [RequestTypes.Weekly]: DAILY_ADMINISTRATION.REQUEST_TYPE_FILTER.OPTIONS.WEEKLY,
  [RequestTypes.Monthly]: DAILY_ADMINISTRATION.REQUEST_TYPE_FILTER.OPTIONS.MONTHLY,
  [RequestTypes.Custom]: DAILY_ADMINISTRATION.REQUEST_TYPE_FILTER.OPTIONS.CUSTOM,
};

export const WORKSPACE_TYPE_OPTIONS: ReadonlyArray<{ value: RequestTypes; label: string }> =
  DAILY_WORKSPACE_REQUEST_TYPES.map((value) => ({
    value,
    label: WORKSPACE_TYPE_LABELS[value],
  }));

export type WorkspaceFilterChipsVariant = 'page' | 'list';

export interface WorkspaceFilterChipsProps {
  requestStatuses: RequestStatus[];
  requestTypes: RequestTypes[];
  onToggleStatus: (status: RequestStatus) => void;
  onToggleType: (type: RequestTypes) => void;
  /** `page` uses daily-workspace__* classes; `list` uses daily-workspace-list__* */
  variant?: WorkspaceFilterChipsVariant;
  /** Show both groups stacked (list) or inline segments (page). */
  layout?: 'inline' | 'stacked';
  showType?: boolean;
  showStatus?: boolean;
  className?: string;
}

function classesFor(variant: WorkspaceFilterChipsVariant) {
  if (variant === 'list') {
    return {
      panels: 'daily-workspace-list__chip-panels',
      group: 'daily-workspace-list__chip-group',
      label: 'daily-workspace-list__chip-label',
      chips: 'daily-workspace-list__chips',
      chip: 'daily-workspace-list__chip',
    };
  }
  return {
    panels: 'daily-workspace__filter-chips',
    group: 'daily-workspace__filter-segment',
    label: 'daily-workspace__filter-label',
    chips: 'daily-workspace__chips',
    chip: 'daily-workspace__chip',
  };
}

export const WorkspaceFilterChips: React.FC<WorkspaceFilterChipsProps> = ({
  requestStatuses,
  requestTypes,
  onToggleStatus,
  onToggleType,
  variant = 'page',
  layout = 'inline',
  showType = true,
  showStatus = true,
  className = '',
}) => {
  const cx = classesFor(variant);
  const selectedStatusSet = useMemo(() => new Set(requestStatuses), [requestStatuses]);
  const selectedTypeSet = useMemo(() => new Set(requestTypes), [requestTypes]);

  const typeGroup = showType ? (
    <SMSBox
      className={cx.group}
      role="group"
      aria-label={DAILY_ADMINISTRATION.REQUEST_TYPE_FILTER.GROUP_ARIA_LABEL}
    >
      <span className={cx.label}>{DAILY_ADMINISTRATION.REQUEST_TYPE_FILTER.GROUP_LABEL}</span>
      <SMSBox className={cx.chips} role="list">
        {WORKSPACE_TYPE_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className={cx.chip}
            data-active={selectedTypeSet.has(value)}
            aria-pressed={selectedTypeSet.has(value)}
            onClick={() => onToggleType(value)}
          >
            {label}
          </button>
        ))}
      </SMSBox>
    </SMSBox>
  ) : null;

  const statusGroup = showStatus ? (
    <SMSBox
      className={cx.group}
      role="group"
      aria-label={DAILY_ADMINISTRATION.STATUS_FILTER.GROUP_ARIA_LABEL}
    >
      <span className={cx.label}>{DAILY_ADMINISTRATION.STATUS_FILTER.GROUP_LABEL}</span>
      <SMSBox className={cx.chips} role="list">
        {WORKSPACE_STATUS_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className={cx.chip}
            data-active={selectedStatusSet.has(value)}
            aria-pressed={selectedStatusSet.has(value)}
            onClick={() => onToggleStatus(value)}
          >
            {label}
          </button>
        ))}
      </SMSBox>
    </SMSBox>
  ) : null;

  if (layout === 'stacked') {
    return (
      <SMSBox className={`${cx.panels} ${className}`.trim()}>
        {typeGroup}
        {statusGroup}
      </SMSBox>
    );
  }

  return (
    <>
      {typeGroup}
      {typeGroup && statusGroup ? (
        <span className="daily-workspace__filter-divider" aria-hidden="true" />
      ) : null}
      {statusGroup}
    </>
  );
};
