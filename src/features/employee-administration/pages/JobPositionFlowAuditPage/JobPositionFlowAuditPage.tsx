import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import Typography from '@mui/material/Typography';
import { SMSBox, SMSButton, SMSChip, SMSGrid, SMSIcon, SMSIconButton } from '@/components/smsatoms';
import { SMSDataTableWrapper, SMSModal, type DataTableColumn } from '@/components/smsorganisms';
import { buildAvailableJobsLandingPathWithQuery } from '@/constants/availableJobsRouteTabs';
import { DEFAULT_TABLE_PAGE_SIZE, PAGE_GRID_MAX_BODY_HEIGHT } from '@/constants/tablePagination';
import { DASHBOARD } from '@/constants/strings';
import { useDebounce } from '@/hooks/useDebounceSearch';
import { usePagination } from '@/hooks/usePagination';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  clearSelectedJobPositionFlow,
  fetchJobPositionFlowByIdThunk,
  fetchJobPositionFlowsThunk,
} from '@/store/slices/jobPositionFlowAuditSlice';
import { isSuperUserSession, usesDepartmentScopedAuditList } from '@/utils/roleMenuContributions';
import {
  renderPostPositionStatusPill,
  resolvePostPositionStatusValue,
} from '@/utils/postPositionStatusPill';
import type {
  JobPositionFlowAction,
  JobPositionFlowDetail,
  JobPositionFlowEvent,
  JobPositionFlowStory,
} from '@/types/jobPositionFlowAudit';
import './JobPositionFlowAuditPage.css';

const L = DASHBOARD.AUDIT_LOG;
const F = L.JOB_POSITION_FLOW;

type FlowTone = 'neutral' | 'assign' | 'self' | 'close' | 'split' | 'cancel' | 'warn';

const normalizeDetailLabelKey = (label: string): string =>
  label.trim().toLowerCase().replace(/[\s_-]+/g, '');

const isAssignmentTypeDetail = (label: string): boolean =>
  normalizeDetailLabelKey(label) === normalizeDetailLabelKey(F.ASSIGNMENT_TYPE_LABEL);

const parseCommaSeparatedValues = (value: string): string[] =>
  value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

const renderFlowStatusPill = (status: unknown) =>
  renderPostPositionStatusPill(resolvePostPositionStatusValue(status), 'post-position', {
    layout: 'nowrap',
    compact: true,
  });

const renderDetailValue = (detail: JobPositionFlowDetail): React.ReactNode => {
  if (isAssignmentTypeDetail(detail.label)) {
    const parts = parseCommaSeparatedValues(detail.value);
    if (parts.length === 0) return '—';
    return (
      <div className="job-position-flow__assignment-type-chips">
        {parts.map((part) => (
          <SMSChip
            key={part}
            label={part}
            size="small"
            variant="outlined"
            color="primary"
            clickable={false}
          />
        ))}
      </div>
    );
  }
  return detail.value || '—';
};

const ACTION_META: Record<
  JobPositionFlowAction,
  { label: string; icon: string; tone: FlowTone }
> = {
  created: { label: F.ACTION_CREATED, icon: 'add_circle', tone: 'neutral' },
  self_taken: { label: F.ACTION_SELF_TAKEN, icon: 'front_hand', tone: 'self' },
  assigned_by_admin: { label: F.ACTION_ASSIGNED_BY_ADMIN, icon: 'person_add', tone: 'assign' },
  assigned_by_other: { label: F.ACTION_ASSIGNED_BY_OTHER, icon: 'person_add', tone: 'self' },
  assigned_by_system: { label: F.ACTION_ASSIGNED_BY_SYSTEM, icon: 'person_add', tone: 'neutral' },
  transferred: { label: F.ACTION_TRANSFERRED, icon: 'swap_horiz', tone: 'assign' },
  unassigned_by_admin: { label: F.ACTION_UNASSIGNED_BY_ADMIN, icon: 'person_remove', tone: 'warn' },
  closed: { label: F.ACTION_CLOSED, icon: 'check_circle', tone: 'close' },
  closed_and_split: { label: F.ACTION_CLOSED_AND_SPLIT, icon: 'call_split', tone: 'split' },
  cancellation_pending: { label: F.ACTION_CANCELLATION_PENDING, icon: 'hourglass_top', tone: 'warn' },
  cancelled: { label: F.ACTION_CANCELLED, icon: 'cancel', tone: 'cancel' },
  split_accepted: { label: F.ACTION_SPLIT_ACCEPTED, icon: 'call_split', tone: 'split' },
  split_declined: { label: F.ACTION_SPLIT_DECLINED, icon: 'cancel', tone: 'cancel' },
  unclosed: { label: F.ACTION_UNCLOSED, icon: 'restart_alt', tone: 'warn' },
  cancellation_revoked: { label: F.ACTION_CANCELLATION_REVOKED, icon: 'undo', tone: 'neutral' },
  split_pending: { label: F.ACTION_SPLIT_PENDING, icon: 'hourglass_top', tone: 'warn' },
  unknown: { label: F.ACTION_UNKNOWN, icon: 'info', tone: 'neutral' },
};

const formatTimeRange = (start: string, end: string): string => {
  if (!start && !end) return '—';
  if (!start) return end;
  if (!end) return start;
  return `${start} – ${end}`;
};

const formatDetailLabel = (label: string): string => {
  const trimmed = label.trim();
  if (!trimmed) return label;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

const FlowDetailRows: React.FC<{
  details: JobPositionFlowDetail[];
  keyPrefix: string;
  nested?: boolean;
}> = ({ details, keyPrefix, nested = false }) => (
  <>
    {details.map((d, index) => {
      const hasItems = Boolean(d.items && d.items.length > 0);
      const rowKey = `${keyPrefix}-${d.label}-${index}`;
      if (hasItems) {
        return (
          <div key={rowKey} className="job-position-flow__detail-group">
            <div
              className={`job-position-flow__detail-row${
                nested ? ' job-position-flow__detail-row--nested' : ''
              }`}
            >
              <dt>{formatDetailLabel(d.label)}</dt>
              <dd>{renderDetailValue(d)}</dd>
            </div>
            <dl className="job-position-flow__details-nested">
              <FlowDetailRows details={d.items!} keyPrefix={rowKey} nested />
            </dl>
          </div>
        );
      }
      return (
        <div
          key={rowKey}
          className={`job-position-flow__detail-row${
            nested ? ' job-position-flow__detail-row--nested' : ''
          }`}
        >
          <dt>{formatDetailLabel(d.label)}</dt>
          <dd>{renderDetailValue(d)}</dd>
        </div>
      );
    })}
  </>
);

const FlowTimeline: React.FC<{ events: JobPositionFlowEvent[] }> = ({ events }) => (
  <ol className="job-position-flow__timeline" aria-label={F.TIMELINE_ARIA}>
    {events.map((event, index) => {
      const meta = ACTION_META[event.action] ?? ACTION_META.unknown;
      const isLast = index === events.length - 1;
      return (
        <li
          key={event.id}
          className={`job-position-flow__step job-position-flow__step--${meta.tone}${
            isLast ? ' job-position-flow__step--latest' : ''
          }`}
        >
          <div className="job-position-flow__rail" aria-hidden="true">
            <span className="job-position-flow__dot">
              <SMSIcon name={meta.icon} size="sm" />
            </span>
            {!isLast ? <span className="job-position-flow__line" /> : null}
          </div>
          <div className="job-position-flow__card">
            {event.summary ? (
              <p className="job-position-flow__summary">{event.summary}</p>
            ) : null}
            <dl className="job-position-flow__details">
              <FlowDetailRows details={event.details} keyPrefix={event.id} />
              <div className="job-position-flow__detail-row job-position-flow__detail-row--when">
                <dt>{F.COLUMN_DATE_TIME}</dt>
                <dd>
                  <time dateTime={event.occurredAt}>{event.occurredAt || '—'}</time>
                </dd>
              </div>
            </dl>
          </div>
        </li>
      );
    })}
  </ol>
);

export const JobPositionFlowAuditPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const { stories, selectedStory, isLoading, isLoadingDetail, totalItems } = useAppSelector(
    (state) => state.jobPositionFlowAudit
  );
  const departmentAuditList = usesDepartmentScopedAuditList(user);
  const [modalOpen, setModalOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState('');
  const debouncedSearch = useDebounce(localSearch, 500);
  const pagination = usePagination({
    initialPage: 1,
    initialPageSize: DEFAULT_TABLE_PAGE_SIZE,
    totalItems: 0,
  });

  useEffect(() => {
    pagination.setTotalItems(totalItems);
  }, [totalItems, pagination.setTotalItems]);

  useEffect(() => {
    pagination.goToFirstPage();
  }, [debouncedSearch, pagination.goToFirstPage]);

  useEffect(() => {
    if (!departmentAuditList) return;
    void dispatch(
      fetchJobPositionFlowsThunk({
        pagination: {
          page: pagination.currentPage,
          pageSize: pagination.pageSize,
        },
        search: debouncedSearch,
      })
    );
  }, [
    dispatch,
    departmentAuditList,
    pagination.currentPage,
    pagination.pageSize,
    debouncedSearch,
  ]);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    dispatch(clearSelectedJobPositionFlow());
  }, [dispatch]);

  const openFlow = useCallback(
    (row: JobPositionFlowStory) => {
      setModalOpen(true);
      void dispatch(fetchJobPositionFlowByIdThunk(row.postPositionId));
    },
    [dispatch]
  );

  const columns: DataTableColumn<JobPositionFlowStory>[] = useMemo(
    () => [
      {
        key: 'jobTitle',
        label: F.COLUMN_JOB_TITLE,
        render: (_v, row) => row.jobTitle,
      },
      {
        key: 'workDate',
        label: F.COLUMN_DATE,
        render: (_v, row) => row.workDate,
      },
      {
        key: 'startTime',
        label: F.COLUMN_TIME,
        render: (_v, row) => formatTimeRange(row.startTime, row.endTime),
      },
      {
        key: 'employeeName',
        label: F.COLUMN_EMPLOYEE,
        render: (_v, row) => row.employeeName,
      },
      {
        key: 'currentStatus',
        label: F.COLUMN_STATUS,
        noClamp: true,
        render: (_v, row) => renderFlowStatusPill(row.currentStatus),
      },
      {
        key: 'viewFlow',
        label: F.COLUMN_FLOW,
        align: 'center',
        noClamp: true,
        render: (_v, row) => (
          <div className="sms-myhistory-style-actions">
            <SMSIconButton
              size="small"
              tone="primary"
              allowWhenSuspended
              title={F.VIEW_FLOW}
              aria-label={F.VIEW_FLOW}
              onClick={(e) => {
                e.stopPropagation();
                openFlow(row);
              }}
            >
              <SMSIcon name="history" size="sm" />
            </SMSIconButton>
          </div>
        ),
      },
    ],
    [openFlow]
  );

  if (isSuperUserSession(user)) {
    return <Navigate to="/admin/department" replace />;
  }
  if (!departmentAuditList) {
    return <Navigate to={buildAvailableJobsLandingPathWithQuery()} replace />;
  }

  const modalStory = selectedStory;

  return (
    <>
      <SMSGrid container spacing={2} className="audit-log-page job-position-flow-page">
        <SMSGrid item xs={12}>
          <SMSBox className="audit-log-page__header">
            <Typography variant="h4" component="h1" className="audit-log-page__title">
              {L.JOB_POSITION_FLOW_LOG}
            </Typography>
          </SMSBox>
        </SMSGrid>

        <SMSGrid item xs={12}>
          <SMSDataTableWrapper<JobPositionFlowStory>
            data={stories}
            columns={columns}
            loading={isLoading}
            renderEmptyAsTable
            getRowKey={(row) => row.id || row.postPositionId}
            searchable
            searchPlaceholder={F.SEARCH_PLACEHOLDER}
            searchValue={localSearch}
            onSearchChange={setLocalSearch}
            searchAppliedOnServer
            responsiveMode="auto"
            tableClassName="audit-log-page__data-table job-position-flow-page__data-table"
            maxBodyHeight={PAGE_GRID_MAX_BODY_HEIGHT}
            emptyMessage={L.NO_DATA}
            pagination={{
              serverSide: true,
              currentPage: pagination.currentPage,
              pageSize: pagination.pageSize,
              totalItems: pagination.totalItems,
              onPageChange: (page) => pagination.goToPage(page),
              onPageSizeChange: (newPageSize) => {
                pagination.setPageSize(newPageSize);
                pagination.goToFirstPage();
              },
            }}
          />
        </SMSGrid>
      </SMSGrid>

      <SMSModal
        open={modalOpen}
        onClose={closeModal}
        title={modalStory ? modalStory.jobTitle : ''}
        maxWidth="md"
        fullWidth
      >
        <SMSBox className="job-position-flow__modal-body">
          {isLoadingDetail && !modalStory ? (
            <p className="job-position-flow__loading">{F.LOADING}</p>
          ) : null}
          {modalStory ? (
            <>
              <div className="job-position-flow__meta">
                <div>
                  <span className="job-position-flow__meta-label">{F.COLUMN_DATE}</span>
                  <span>{modalStory.workDate || '—'}</span>
                </div>
                <div>
                  <span className="job-position-flow__meta-label">{F.COLUMN_TIME}</span>
                  <span>{formatTimeRange(modalStory.startTime, modalStory.endTime)}</span>
                </div>
                <div>
                  <span className="job-position-flow__meta-label">{F.COLUMN_EMPLOYEE}</span>
                  <span>{modalStory.employeeName || '—'}</span>
                </div>
                <div>
                  <span className="job-position-flow__meta-label">{F.COLUMN_STATUS}</span>
                  {renderFlowStatusPill(modalStory.currentStatus)}
                </div>
              </div>
              {isLoadingDetail ? (
                <p className="job-position-flow__loading">{F.LOADING}</p>
              ) : (
                <FlowTimeline events={modalStory.events} />
              )}
            </>
          ) : null}
          <div className="job-position-flow__modal-actions">
            <SMSButton allowWhenSuspended onClick={closeModal}>
              {F.CLOSE}
            </SMSButton>
          </div>
        </SMSBox>
      </SMSModal>
    </>
  );
};
