import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  SMSBox,
  SMSButton,
  SMSDatePicker,
  SMSSegmentedStatusFilter,
  SMSTypography,
} from '@/components/smsatoms';
import { SMSConfirmDialog } from '@/components/smsmolecules';
import { SMSModal, SMSDataTableWrapper, SMSDataTableActions, type DataTableColumn } from '@/components/smsorganisms';
import { REQUEST_SCHEDULE_PAGE_SIZE } from '@/constants/tablePagination';
import { DAILY_ADMINISTRATION, REQUEST } from '@/constants/strings';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  clearRequestScheduleState,
  deleteRequestScheduleThunk,
  fetchRequestSchedulesByRequestIdThunk,
  upsertRequestScheduleThunk,
} from '@/store/slices/requestScheduleSlice';
import {
  ReleaseAs,
  RequestStatus,
  RequestTypes,
  type RequestResponse,
  type RequestScheduleDto,
} from '@/types/request';
import { formatDateShort, formatDateToYYYYMMDD, formatTimeToHHmm } from '@/utils';
import {
  SMSRequestScheduleModal,
  emptyRequestScheduleModalDraft,
  readScheduleReleaseHoursFromDto,
  RELEASE_AS_OPTIONS,
  REQUEST_SCHEDULE_STATUS_OPTIONS,
  requiresScheduleReleaseHours,
  scheduleReleaseHoursLabel,
  type RequestScheduleModalDraft,
  type RequestScheduleSavePayload,
} from '@/components/smsorganisms/SMSRequestForm/SMSRequestScheduleModal';
import '@/components/smsorganisms/SMSRequestForm/SMSRequestForm.css';
import './RequestScheduleListModal.css';

type MainRecurrenceType = 'NONE' | 'DAY' | 'WEEK' | 'MONTH' | 'CUSTOM';
type ScheduleTimeBand = 'old' | 'ongoing' | 'future';

const SCHEDULE_LEGEND_ITEMS = [
  { label: REQUEST.FORM.SCHEDULE_ROW_COLOR_OLD, sx: { bgcolor: '#f3d6dc' } },
  { label: REQUEST.FORM.SCHEDULE_ROW_COLOR_ONGOING, sx: { bgcolor: '#f3d7b0' } },
  { label: REQUEST.FORM.SCHEDULE_ROW_COLOR_FUTURE, sx: { bgcolor: '#d9efd4' } },
] as const;

function getSelectedTypeFromRequest(request: RequestResponse): MainRecurrenceType {
  const type = request.requestType?.requestType;
  switch (type) {
    case RequestTypes.Daily:
      return 'DAY';
    case RequestTypes.Weekly:
      return 'WEEK';
    case RequestTypes.Monthly:
      return 'MONTH';
    case RequestTypes.Custom:
      return 'CUSTOM';
    default:
      return 'NONE';
  }
}

function leadingYyyyMmDdKey(value?: string | null): string {
  const t = value?.trim() ?? '';
  if (!t) return '';
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(t);
  return m ? m[1]! : t;
}

function isYyyyMmDdKey(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function localDateFromYyyyMmDd(ymd: string): Date | null {
  if (!isYyyyMmDdKey(ymd)) return null;
  const [y, m, d] = ymd.split('-').map(Number);
  if ([y, m, d].some((n) => Number.isNaN(n))) return null;
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Latest end for a start: the day before the same date three months later. */
function scheduleFilterMaxEnd(startYmd: string): string {
  const start = localDateFromYyyyMmDd(startYmd);
  if (!start) return startYmd;
  const limit = new Date(start.getFullYear(), start.getMonth() + 3, start.getDate());
  limit.setDate(limit.getDate() - 1);
  return formatDateToYYYYMMDD(limit);
}

/** Earliest start for an end: the day after the same date three months earlier. */
function scheduleFilterMinStart(endYmd: string): string {
  const end = localDateFromYyyyMmDd(endYmd);
  if (!end) return endYmd;
  const limit = new Date(end.getFullYear(), end.getMonth() - 3, end.getDate());
  limit.setDate(limit.getDate() + 1);
  return formatDateToYYYYMMDD(limit);
}

/** This month's 1st through the last day of next month. */
function defaultScheduleFilterRange(): { start: string; end: string } {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 2, 0);
  return { start: formatDateToYYYYMMDD(start), end: formatDateToYYYYMMDD(end) };
}

/** Keeps end on or after start, and the selected span inside a 3-month window. */
function clampScheduleFilterRange(
  start: string,
  end: string,
  edited: 'start' | 'end'
): { start: string; end: string } {
  if (!isYyyyMmDdKey(start) || !isYyyyMmDdKey(end)) return { start, end };
  let nextStart = start;
  let nextEnd = end;
  if (nextEnd < nextStart) {
    if (edited === 'start') nextEnd = nextStart;
    else nextStart = nextEnd;
  }
  if (nextEnd > scheduleFilterMaxEnd(nextStart)) {
    if (edited === 'start') nextEnd = scheduleFilterMaxEnd(nextStart);
    else nextStart = scheduleFilterMinStart(nextEnd);
  }
  return { start: nextStart, end: nextEnd };
}

function scheduleRangeKey(value?: string | null): string {
  return leadingYyyyMmDdKey(value);
}

function classifyScheduleTimeBand(
  startStr: string | null | undefined,
  endStr: string | null | undefined,
  todayYmd: string
): ScheduleTimeBand | null {
  const s = scheduleRangeKey(startStr);
  const e = scheduleRangeKey(endStr);
  if (!isYyyyMmDdKey(s) || !isYyyyMmDdKey(e)) return null;
  if (e < todayYmd) return 'old';
  if (s > todayYmd) return 'future';
  return 'ongoing';
}

function scheduleOverlapsRequestWindow(
  scheduleStart: string | null | undefined,
  scheduleEnd: string | null | undefined,
  requestStartStr: string,
  requestEndStr: string
): boolean {
  const s = scheduleRangeKey(scheduleStart);
  const e = scheduleRangeKey(scheduleEnd);
  const rs = scheduleRangeKey(requestStartStr);
  const re = scheduleRangeKey(requestEndStr);
  if (!s || !e || !rs || !re) return false;
  return s <= re && e >= rs;
}

interface ScheduleRow {
  requestScheduleID: string;
  startDate: string;
  endDate: string;
  releaseStatus: string;
  scheduleDate: string;
  scheduleTime: string;
  releaseHours: string;
  releaseAs: string;
  processDate: string;
  processTime: string;
  isInactive: boolean;
  scheduleTimeBand: ScheduleTimeBand | null;
  raw: RequestScheduleDto;
}

export interface RequestScheduleListModalProps {
  isOpen: boolean;
  request: RequestResponse | null;
  onClose: () => void;
  viewOnly?: boolean;
}

export const RequestScheduleListModal: React.FC<RequestScheduleListModalProps> = ({
  isOpen,
  request,
  onClose,
  viewOnly = false,
}) => {
  const dispatch = useAppDispatch();
  const { schedules, totalRecords, isLoading: schedulesLoading } = useAppSelector((state) => state.requestSchedule);

  const [scheduleStatusFilter, setScheduleStatusFilter] = useState<'active' | 'inactive'>('active');
  const [scheduleFilter, setScheduleFilter] = useState(defaultScheduleFilterRange);
  const [schedulePage, setSchedulePage] = useState(1);
  const [schedulePageSize, setSchedulePageSize] = useState(REQUEST_SCHEDULE_PAGE_SIZE);
  const [isScheduleEditorOpen, setIsScheduleEditorOpen] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [scheduleModalInitialDraft, setScheduleModalInitialDraft] = useState<RequestScheduleModalDraft>(
    emptyRequestScheduleModalDraft()
  );
  const [schedulePendingDelete, setSchedulePendingDelete] = useState<string | null>(null);
  const [overlapSchedules, setOverlapSchedules] = useState<RequestScheduleDto[] | null>(null);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const todayYmd = useMemo(() => formatDateToYYYYMMDD(today), [today]);
  const minProcessDate = today;

  const boundStartDate = scheduleRangeKey(request?.startDate) || '';
  const boundEndDate = scheduleRangeKey(request?.endDate) || '';
  const selectedType = request ? getSelectedTypeFromRequest(request) : 'NONE';
  const requestId = request?.requestID;

  useEffect(() => {
    if (!isOpen || !requestId) return;
    setScheduleStatusFilter('active');
    setScheduleFilter(defaultScheduleFilterRange());
    setSchedulePage(1);
    setSchedulePageSize(REQUEST_SCHEDULE_PAGE_SIZE);
    setIsScheduleEditorOpen(false);
    setEditingScheduleId(null);
    setSchedulePendingDelete(null);
    setOverlapSchedules(null);
    return () => {
      dispatch(clearRequestScheduleState());
    };
  }, [dispatch, isOpen, requestId]);

  useEffect(() => {
    if (!isOpen || !requestId) return;
    void dispatch(
      fetchRequestSchedulesByRequestIdThunk({
        requestId,
        startDate: scheduleFilter.start,
        endDate: scheduleFilter.end,
        pagination: {
          page: schedulePage,
          pageSize: schedulePageSize,
        },
      })
    );
  }, [dispatch, isOpen, requestId, schedulePage, schedulePageSize, scheduleFilter.start, scheduleFilter.end]);

  useEffect(() => {
    if (!isScheduleEditorOpen || !requestId) return;
    let cancelled = false;
    void dispatch(
      fetchRequestSchedulesByRequestIdThunk({
        requestId,
        updateState: false,
        pagination: { page: 1, pageSize: 1000 },
      })
    )
      .unwrap()
      .then((page) => {
        if (!cancelled) setOverlapSchedules(page.data);
      })
      .catch(() => {
        // The open page stays the overlap source when the full list cannot be loaded.
      });
    return () => {
      cancelled = true;
    };
  }, [dispatch, isScheduleEditorOpen, requestId]);

  const reloadSchedulePage = useCallback(() => {
    if (!requestId) return Promise.resolve();
    return dispatch(
      fetchRequestSchedulesByRequestIdThunk({
        requestId,
        startDate: scheduleFilter.start,
        endDate: scheduleFilter.end,
        pagination: {
          page: schedulePage,
          pageSize: schedulePageSize,
        },
      })
    ).unwrap();
  }, [dispatch, requestId, schedulePage, schedulePageSize, scheduleFilter.start, scheduleFilter.end]);

  const scheduleRows: ScheduleRow[] = useMemo(() => {
    if (!request) return [];

    return schedules.map((schedule) => {
      const rowId = schedule.requestScheduleID ?? `schedule-${schedule.startDate}-${schedule.endDate}`;
      const releaseStatusLabel =
        REQUEST_SCHEDULE_STATUS_OPTIONS.find((option) => option.value === String(schedule.requestStatus))
          ?.label ?? '-';
      const releaseAsLabel =
        RELEASE_AS_OPTIONS.find((option) => option.value === String(schedule.releaseAs))?.label ?? '-';
      const endDateValue = schedule.endDate ? new Date(scheduleRangeKey(schedule.endDate)) : null;
      if (endDateValue) endDateValue.setHours(0, 0, 0, 0);
      const calendarEnded = endDateValue ? endDateValue.getTime() < today.getTime() : false;
      const inRequestWindow = scheduleOverlapsRequestWindow(
        schedule.startDate,
        schedule.endDate,
        boundStartDate,
        boundEndDate
      );
      const isInactive = calendarEnded && !inRequestWindow;

      return {
        requestScheduleID: rowId,
        startDate: schedule.startDate ? formatDateShort(schedule.startDate) : '-',
        endDate: schedule.endDate ? formatDateShort(schedule.endDate) : '-',
        releaseStatus: releaseStatusLabel,
        scheduleDate: schedule.scheduleDate ? formatDateShort(schedule.scheduleDate) : '-',
        scheduleTime: schedule.scheduledTime ? formatTimeToHHmm(schedule.scheduledTime) : '-',
        releaseHours: requiresScheduleReleaseHours(schedule.requestStatus, schedule.releaseAs)
          ? scheduleReleaseHoursLabel(readScheduleReleaseHoursFromDto(schedule))
          : '-',
        releaseAs: releaseAsLabel,
        processDate: schedule.processDate ? formatDateShort(schedule.processDate) : '-',
        processTime: schedule.processTime ? formatTimeToHHmm(schedule.processTime) : '-',
        isInactive,
        scheduleTimeBand: classifyScheduleTimeBand(schedule.startDate, schedule.endDate, todayYmd),
        raw: schedule,
      };
    });
  }, [boundEndDate, boundStartDate, request, schedules, today, todayYmd]);

  const activeScheduleRows = useMemo(
    () => scheduleRows.filter((row) => !row.isInactive),
    [scheduleRows]
  );
  const inactiveScheduleRows = useMemo(
    () => scheduleRows.filter((row) => row.isInactive),
    [scheduleRows]
  );

  const filteredScheduleRows = useMemo(() => {
    return scheduleStatusFilter === 'active' ? activeScheduleRows : inactiveScheduleRows;
  }, [activeScheduleRows, inactiveScheduleRows, scheduleStatusFilter]);

  const otherScheduleRanges = useMemo(() => {
    const source = overlapSchedules ?? schedules;
    return source
      .filter((schedule) => schedule.requestScheduleID !== editingScheduleId)
      .map((schedule) => {
        const start = scheduleRangeKey(schedule.startDate);
        const end = scheduleRangeKey(schedule.endDate);
        return start && end ? { start, end } : null;
      })
      .filter((range): range is { start: string; end: string } => range != null);
  }, [editingScheduleId, overlapSchedules, schedules]);

  const getScheduleRowClassName = useCallback((row: ScheduleRow) => {
    if (!row.scheduleTimeBand) return undefined;
    return `request-form__schedule-row--${row.scheduleTimeBand}`;
  }, []);

  const renderScheduleCell = (value: React.ReactNode, isInactive = false) => (
    <SMSBox
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        width: '100%',
        opacity: isInactive ? 0.45 : 1,
        color: isInactive ? 'text.disabled' : 'text.primary',
      }}
    >
      {value}
    </SMSBox>
  );

  const scheduleColumns: DataTableColumn<ScheduleRow>[] = useMemo(
    () => [
      {
        key: 'startDate',
        label: REQUEST.FORM.START_DATE,
        render: (_value, row) => renderScheduleCell(row.startDate, row.isInactive),
      },
      {
        key: 'endDate',
        label: REQUEST.FORM.END_DATE,
        render: (_value, row) => renderScheduleCell(row.endDate, row.isInactive),
      },
      {
        key: 'releaseStatus',
        label: REQUEST.FORM.RELEASE_STATUS,
        align: 'left',
        render: (_value, row) => renderScheduleCell(row.releaseStatus, row.isInactive),
      },
      {
        key: 'scheduleDate',
        label: REQUEST.FORM.SCHEDULE_DATE,
        render: (_value, row) => renderScheduleCell(row.scheduleDate, row.isInactive),
      },
      {
        key: 'scheduleTime',
        label: REQUEST.FORM.SCHEDULE_TIME,
        render: (_value, row) => renderScheduleCell(row.scheduleTime, row.isInactive),
      },
      {
        key: 'releaseHours',
        label: REQUEST.FORM.RELEASE_FOR,
        render: (_value, row) => renderScheduleCell(row.releaseHours, row.isInactive),
      },
      {
        key: 'releaseAs',
        label: REQUEST.FORM.RELEASE_AS,
        render: (_value, row) => renderScheduleCell(row.releaseAs, row.isInactive),
      },
      {
        key: 'processDate',
        label: REQUEST.FORM.TENURE_START_DATE,
        render: (_value, row) => renderScheduleCell(row.processDate, row.isInactive),
      },
      {
        key: 'processTime',
        label: REQUEST.FORM.TENURE_START_TIME,
        render: (_value, row) => renderScheduleCell(row.processTime, row.isInactive),
      },
      {
        key: 'action',
        label: REQUEST.FORM.ACTION,
        render: (_value, row) =>
          !viewOnly && !row.isInactive ? (
            <SMSDataTableActions
              onEdit={() => {
                const schedule = row.raw;
                setEditingScheduleId(row.requestScheduleID);
                setScheduleModalInitialDraft({
                  startDate: schedule.startDate ?? '',
                  endDate: schedule.endDate ?? '',
                  isActive: schedule.isActive !== false,
                  releaseAs: schedule.releaseAs ?? ReleaseAs.Open,
                  requestStatus: schedule.requestStatus ?? RequestStatus.Pending,
                  scheduleAfter:
                    schedule.requestStatus === RequestStatus.ReleasedOn &&
                    Boolean((schedule.scheduleDate ?? '').trim() || (schedule.scheduledTime ?? '').trim())
                      ? 'custom'
                      : '',
                  scheduleDate: schedule.scheduleDate ?? '',
                  scheduledTime: schedule.scheduledTime ?? '',
                  processDate: schedule.processDate ?? '',
                  processTime: schedule.processTime ?? '',
                  releaseHours: requiresScheduleReleaseHours(schedule.requestStatus, schedule.releaseAs)
                    ? readScheduleReleaseHoursFromDto(schedule)
                    : null,
                  releaseForMode: '',
                  preserveOnRegenerate: schedule.preserveOnRegenerate === true,
                });
                setIsScheduleEditorOpen(true);
              }}
              onDelete={() => {
                if (row.raw.requestScheduleID) setSchedulePendingDelete(row.raw.requestScheduleID);
              }}
            />
          ) : null,
      },
    ],
    [dispatch, viewOnly]
  );

  const openAddScheduleModal = useCallback(() => {
    if (!request) return;
    const primary = schedules[0] ?? request.requestSchedule;
    setEditingScheduleId(null);
    setScheduleModalInitialDraft({
      startDate: boundStartDate,
      endDate: boundEndDate,
      isActive: true,
      releaseAs: primary?.releaseAs ?? ReleaseAs.Open,
      requestStatus: primary?.requestStatus ?? RequestStatus.Pending,
      scheduleAfter: '',
      scheduleDate: primary?.scheduleDate ?? '',
      scheduledTime: primary?.scheduledTime ?? '',
      processDate: primary?.processDate ?? formatDateToYYYYMMDD(minProcessDate),
      processTime: primary?.processTime ?? '',
      releaseHours: null,
      releaseForMode: '',
      preserveOnRegenerate: false,
    });
    setIsScheduleEditorOpen(true);
  }, [boundEndDate, boundStartDate, minProcessDate, request, schedules]);

  const closeScheduleEditor = useCallback(() => {
    setIsScheduleEditorOpen(false);
    setEditingScheduleId(null);
  }, []);

  const persistSchedule = useCallback(
    async (payload: RequestScheduleSavePayload) => {
      if (!request) return;

      const existing = editingScheduleId
        ? schedules.find((schedule) => schedule.requestScheduleID === editingScheduleId)
        : undefined;

      const dto: RequestScheduleDto = {
        ...(existing ?? {
          requestId: request.requestID,
          releaseAs: payload.releaseAs,
          requestStatus: payload.requestStatus,
        }),
        requestScheduleID: existing?.requestScheduleID,
        requestId: request.requestID,
        startDate: payload.startDate,
        endDate: payload.endDate,
        isActive: payload.isActive,
        releaseAs: payload.releaseAs,
        requestStatus: payload.requestStatus,
        scheduleDate: payload.scheduleDate,
        scheduledTime: payload.scheduledTime,
        processDate: payload.processDate,
        processTime: payload.processTime,
        releaseHours: payload.releaseHours as RequestScheduleDto['releaseHours'],
        preserveOnRegenerate: payload.preserveOnRegenerate,
      };

      try {
        await dispatch(upsertRequestScheduleThunk(dto)).unwrap();
        closeScheduleEditor();
        await reloadSchedulePage();
      } catch {
        // Toast handled in thunk
      }
    },
    [closeScheduleEditor, dispatch, editingScheduleId, reloadSchedulePage, request, schedules]
  );

  const confirmDeleteSchedule = async () => {
    if (!schedulePendingDelete) return;
    const scheduleId = schedulePendingDelete;
    const pageToReload = schedulePage;
    try {
      await dispatch(deleteRequestScheduleThunk(scheduleId)).unwrap();
      void reloadSchedulePage()
        .then((page) => {
          if (page && page.data.length === 0 && pageToReload > 1) {
            setSchedulePage(pageToReload - 1);
          }
        })
        .catch(() => undefined);
    } catch {
      // Toast handled in thunk.
    }
    setSchedulePendingDelete(null);
  };

  const modalTitle = request
    ? `${DAILY_ADMINISTRATION.SCHEDULE_MODAL_TITLE} — ${request.title}`
    : DAILY_ADMINISTRATION.SCHEDULE_MODAL_TITLE;

  return (
    <>
      <SMSModal
        isOpen={isOpen}
        onClose={onClose}
        title={modalTitle}
        size="xl"
        fullWidth
        className="request-schedule-list-modal"
      >
        <SMSBox className="request-schedule-list-modal__panel">
          <SMSBox
            sx={{
              py: 1,
              display: 'flex',
              flexWrap: 'nowrap',
              alignItems: 'flex-end',
              gap: 1.5,
              width: '100%',
              overflowX: 'auto',
            }}
          >
            <SMSBox component="span" sx={{ fontWeight: 700, flexShrink: 0, pb: 1 }}>
              {REQUEST.FORM.REQUEST_SCHEDULE}
            </SMSBox>
            <SMSBox sx={{ width: 168, flexShrink: 0, '& > .MuiBox-root': { marginTop: 0 } }}>
              <SMSDatePicker
                label={REQUEST.FORM.START_DATE}
                id="request-schedule-modal-filter-start"
                value={scheduleFilter.start}
                minDate={scheduleFilterMinStart(scheduleFilter.end)}
                maxDate={scheduleFilter.end}
                onChange={(value) => {
                  if (!isYyyyMmDdKey(value)) return;
                  setScheduleFilter((current) => clampScheduleFilterRange(value, current.end, 'start'));
                  setSchedulePage(1);
                }}
              />
            </SMSBox>
            <SMSBox sx={{ width: 168, flexShrink: 0, '& > .MuiBox-root': { marginTop: 0 } }}>
              <SMSDatePicker
                label={REQUEST.FORM.END_DATE}
                id="request-schedule-modal-filter-end"
                value={scheduleFilter.end}
                minDate={scheduleFilter.start}
                maxDate={scheduleFilterMaxEnd(scheduleFilter.start)}
                onChange={(value) => {
                  if (!isYyyyMmDdKey(value)) return;
                  setScheduleFilter((current) => clampScheduleFilterRange(current.start, value, 'end'));
                  setSchedulePage(1);
                }}
              />
            </SMSBox>
            <SMSBox
              sx={{
                display: 'flex',
                alignItems: 'center',
                columnGap: 1.5,
                flexShrink: 0,
                marginLeft: 'auto',
                pb: 1,
              }}
              aria-label="Schedule row color legend"
            >
              {SCHEDULE_LEGEND_ITEMS.map(({ label, sx: swatchSx }) => (
                <SMSBox key={label} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                  <SMSBox
                    component="span"
                    aria-hidden
                    sx={{
                      width: 14,
                      height: 14,
                      borderRadius: '3px',
                      flexShrink: 0,
                      ...swatchSx,
                    }}
                  />
                  <SMSTypography
                    component="span"
                    variant="body2"
                    color="text.secondary"
                    sx={{ lineHeight: 1.2, fontSize: '0.8125rem', whiteSpace: 'nowrap' }}
                  >
                    {label}
                  </SMSTypography>
                </SMSBox>
              ))}
            </SMSBox>
            <SMSBox sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0, pb: 0.25 }}>
              <SMSSegmentedStatusFilter
                value={scheduleStatusFilter}
                onChange={(value) => {
                  if (value === 'active' || value === 'inactive') {
                    setScheduleStatusFilter(value);
                    setSchedulePage(1);
                  }
                }}
                activeLabel={REQUEST.FORM.ACTIVE}
                inactiveLabel={REQUEST.FORM.INACTIVE}
                allowClear={false}
                ariaLabel="Request schedule status filter"
              />
              {!viewOnly && (
                <SMSButton onClick={openAddScheduleModal} disabled={!request}>
                  {`+ ${REQUEST.FORM.ADD_REQUEST_SCHEDULE}`}
                </SMSButton>
              )}
            </SMSBox>
          </SMSBox>

          <SMSDataTableWrapper
            embedded
            tableClassName="request-form__schedule-table"
            columns={scheduleColumns}
            data={filteredScheduleRows}
            getRowClassName={getScheduleRowClassName}
            showHeaderWhenEmpty
            loading={schedulesLoading}
            pagination={{
              serverSide: true,
              currentPage: schedulePage,
              pageSize: schedulePageSize,
              totalItems: totalRecords,
              onPageChange: setSchedulePage,
              onPageSizeChange: (size) => {
                setSchedulePageSize(size);
                setSchedulePage(1);
              },
            }}
          />
        </SMSBox>
      </SMSModal>

      <SMSRequestScheduleModal
        key={
          isScheduleEditorOpen
            ? `${editingScheduleId ?? 'new'}|${scheduleModalInitialDraft.startDate}|${scheduleModalInitialDraft.endDate}`
            : 'closed'
        }
        open={isScheduleEditorOpen}
        onClose={closeScheduleEditor}
        onSave={persistSchedule}
        initialDraft={scheduleModalInitialDraft}
        selectedType={selectedType}
        boundStartDate={boundStartDate}
        boundEndDate={boundEndDate}
        addScheduleStartMinDate={boundStartDate}
        otherScheduleRanges={otherScheduleRanges}
        today={today}
        minProcessDate={minProcessDate}
        isLoading={schedulesLoading}
        requestSchedulesLoading={schedulesLoading}
        releaseAsDropdownOptions={RELEASE_AS_OPTIONS}
        parentFieldErrors={{}}
        isEditing={Boolean(editingScheduleId)}
      />
      <SMSConfirmDialog
        open={schedulePendingDelete != null}
        onClose={() => setSchedulePendingDelete(null)}
        onConfirm={confirmDeleteSchedule}
        title={DAILY_ADMINISTRATION.DELETE_SCHEDULE_TITLE}
        message={DAILY_ADMINISTRATION.DELETE_SCHEDULE_MESSAGE}
        confirmText={DAILY_ADMINISTRATION.DELETE_SCHEDULE_CONFIRM}
        cancelText={DAILY_ADMINISTRATION.DELETE_SCHEDULE_CANCEL}
        variant="error"
      />
    </>
  );
};
