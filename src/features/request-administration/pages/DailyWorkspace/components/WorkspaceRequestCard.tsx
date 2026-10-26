import React from 'react';
import { SMSBox, SMSIcon } from '@/components/smsatoms';
import { DAILY_ADMINISTRATION, DAILY_WORKSPACE, INVOICE_GRID } from '@/constants/strings';
import type { RequestInRequesterListDto } from '@/types/request';
import { formatRequestDateDisplay, RequestTypeDisplay } from '../../RequesterList/requestCardHelpers';
import { WorkspaceIconButton } from './WorkspaceIconButton';
import { WorkspaceStatusPill } from './WorkspaceStatusPill';

export interface WorkspaceRequestCardActions {
  onClone: (request: RequestInRequesterListDto) => void;
  onEdit: (request: RequestInRequesterListDto) => void;
  onSchedule: (request: RequestInRequesterListDto) => void;
  onInvoice: (request: RequestInRequesterListDto) => void;
  onDelete: (request: RequestInRequesterListDto) => void;
  onMore: (el: HTMLElement, request: RequestInRequesterListDto) => void;
  onProjectClick?: (request: RequestInRequesterListDto) => void;
}

export interface WorkspaceRequestCardProps {
  request: RequestInRequesterListDto;
  selected: boolean;
  highlighted?: boolean;
  layout: 'grid' | 'list';
  onSelect: (requestId: string | null) => void;
  /** Omit for select-only cards (e.g. Employee Location). */
  actions?: WorkspaceRequestCardActions;
}

export const WorkspaceRequestCard: React.FC<WorkspaceRequestCardProps> = ({
  request,
  selected,
  highlighted,
  layout,
  onSelect,
  actions,
}) => {
  const projectNumber = (request.projectNumber ?? '').trim();
  const isListView = layout === 'list';
  const requestId = request.requestId;

  const handleSelect = () => onSelect(selected ? null : requestId);

  const projectCell = (
    <SMSBox className="daily-workspace__card-project">
      {projectNumber ? (
        <button
          type="button"
          className="daily-workspace__project-link"
          title={projectNumber}
          aria-label={`${DAILY_ADMINISTRATION.PROJECT_NUMBER_LABEL}: ${projectNumber}`}
          onClick={(event) => {
            event.stopPropagation();
            actions?.onProjectClick?.(request);
          }}
        >
          {projectNumber}
        </button>
      ) : (
        <span>—</span>
      )}
    </SMSBox>
  );

  const datesCell = (
    <SMSBox className="daily-workspace__card-dates">
      <span>
        <small>{DAILY_WORKSPACE.REQUEST_LIST_COLUMNS.FROM}</small>
        {formatRequestDateDisplay(request.startDate)}
      </span>
      <span>
        <small>{DAILY_WORKSPACE.REQUEST_LIST_COLUMNS.TO}</small>
        {formatRequestDateDisplay(request.endDate)}
      </span>
    </SMSBox>
  );

  const scheduleCell = (
    <SMSBox className="daily-workspace__card-schedule">
      {typeof request.requestType === 'object' && request.requestType ? (
        <RequestTypeDisplay request={{ requestType: request.requestType }} />
      ) : (
        <span className="level-2-request__data-value level-2-request__data-value--type badge--grey">
          {typeof request.requestType === 'string' && request.requestType
            ? request.requestType
            : '—'}
        </span>
      )}
    </SMSBox>
  );

  const actionsCell = actions ? (
    <SMSBox className="daily-workspace__card-foot" onClick={(e) => e.stopPropagation()}>
      <SMSBox className="daily-workspace__actions dw-icon-btn-group">
        <WorkspaceIconButton
          title={DAILY_WORKSPACE.ACTIONS.CLONE_REQUEST}
          onClick={() => actions.onClone(request)}
        >
          <SMSIcon name="content_copy" size="sm" />
        </WorkspaceIconButton>
        <WorkspaceIconButton
          title={DAILY_WORKSPACE.ACTIONS.EDIT_REQUEST}
          onClick={() => actions.onEdit(request)}
        >
          <SMSIcon name="edit" size="sm" />
        </WorkspaceIconButton>
        <WorkspaceIconButton
          title={DAILY_WORKSPACE.ACTIONS.SCHEDULE}
          onClick={() => actions.onSchedule(request)}
        >
          <SMSIcon name="calendar" size="sm" />
        </WorkspaceIconButton>
        <WorkspaceIconButton
          title={INVOICE_GRID.REQUEST_SCOPE.CREATE_INVOICE}
          disabled={!projectNumber}
          onClick={() => actions.onInvoice(request)}
        >
          <SMSIcon name="receipt_long" size="sm" />
        </WorkspaceIconButton>
        <WorkspaceIconButton
          danger
          title={DAILY_WORKSPACE.ACTIONS.DELETE_REQUEST}
          onClick={() => actions.onDelete(request)}
        >
          <SMSIcon name="delete" size="sm" />
        </WorkspaceIconButton>
        <WorkspaceIconButton
          title={DAILY_WORKSPACE.ACTIONS.MORE_REQUEST}
          onClick={(e) => actions.onMore(e.currentTarget, request)}
        >
          <SMSIcon name="more_vert" size="sm" />
        </WorkspaceIconButton>
      </SMSBox>
    </SMSBox>
  ) : null;

  if (isListView) {
    return (
      <SMSBox
        className={`daily-workspace__card${selected ? ' is-selected' : ''}${highlighted ? ' is-highlighted' : ''}`}
        onClick={handleSelect}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleSelect();
          }
        }}
      >
        <SMSBox className="daily-workspace__card-top">
          {projectCell}
          <h3 className="daily-workspace__card-title">{(request.name || '').trim() || request.requestId}</h3>
          {datesCell}
          <SMSBox className="daily-workspace__card-status">
            <WorkspaceStatusPill variant="neutral">
              {request.releaseStatus || '—'}
            </WorkspaceStatusPill>
          </SMSBox>
          <span className="daily-workspace__card-post-count">{request.postCount ?? 0}</span>
          {scheduleCell}
        </SMSBox>
        {actionsCell}
      </SMSBox>
    );
  }

  return (
    <SMSBox
      className={`daily-workspace__card${selected ? ' is-selected' : ''}${highlighted ? ' is-highlighted' : ''}`}
      onClick={handleSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleSelect();
        }
      }}
    >
      <SMSBox className="daily-workspace__card-top">
        <h3 className="daily-workspace__card-title">{(request.name || '').trim() || request.requestId}</h3>
        <SMSBox className="daily-workspace__card-meta">
          <span className="daily-workspace__card-meta-dates">
            {formatRequestDateDisplay(request.startDate)} –{' '}
            {formatRequestDateDisplay(request.endDate)}
          </span>
        </SMSBox>
        <SMSBox className="daily-workspace__card-status-posts">
          <WorkspaceStatusPill variant="neutral">
            {request.releaseStatus || '—'}
          </WorkspaceStatusPill>
          <span className="daily-workspace__card-meta-posts">
            {DAILY_WORKSPACE.POSTS_COUNT.replace('{count}', String(request.postCount ?? 0))}
          </span>
        </SMSBox>
        {scheduleCell}
      </SMSBox>
      {actionsCell}
    </SMSBox>
  );
};
