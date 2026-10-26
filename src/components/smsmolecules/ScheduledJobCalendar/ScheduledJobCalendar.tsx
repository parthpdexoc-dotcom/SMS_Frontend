import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Popover from '@mui/material/Popover';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PlaceIcon from '@mui/icons-material/Place';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import Box from '@mui/material/Box';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import type { DateCalendarProps } from '@mui/x-date-pickers/DateCalendar';
import type { DateView } from '@mui/x-date-pickers/models';
import { enUS } from 'date-fns/locale';
import type { EmployeePostListingItem } from '@/types/employeePostListingItem';
import { PostPositionStatus } from '@/types/postPosition';
import { AVAILABLE_POST, POST_POSITION } from '@/constants/strings';
import { SMSButton, SMSIconButton, SMSStack } from '@/components/smsatoms';
import { SMSIcon } from '@/components/smsatoms/SMSIcon';
import { formatTimeToHHmm, timeStringToMinutes } from '@/utils/dateTimeUtils';
import { formatPostGridEndTimeCell, formatPostGridStartTimeCell } from '@/utils/postGridColumns';
import { renderPostPositionStatusPill } from '@/utils/postPositionStatusPill';
import './ScheduledJobCalendar.css';

const S = AVAILABLE_POST.SCHEDULED_JOB_CALENDAR;
const listBtn = POST_POSITION.BY_STATUS_LIST.BUTTONS;

/** Same actions as Scheduled Job table row; wired from `PostPositionByStatusList`. */
export interface ScheduledJobCalendarScheduledActions {
  onOpenRoster: (row: EmployeePostListingItem) => void;
  onSendInvite: (row: EmployeePostListingItem) => void;
  sendInviteDisabled?: boolean;
  sendingInvitePostPositionId?: string | null;
  /** Cancel job — same visibility as table: `allowEmployeeCancellation` and not already cancellation-pending. */
  onCancelJob?: (row: EmployeePostListingItem) => void;
  allowEmployeeCancellation?: boolean;
  /** Mirrors `suspendBlocksPostPositionActions` on the scheduled tab. */
  suspendBlocksCancellation?: boolean;
  cancellingPostPositionId?: string | null;
  /** Restores Assigned when status is CancellationPending (table + calendar). */
  onRevokeCancellation?: (row: EmployeePostListingItem) => void;
  revokingCancellationPostPositionId?: string | null;
}

const MAX_BLOCKS_PER_CELL = 3;
/** Open popover quickly on hover so job details feel immediate. */
const HOVER_OPEN_MS = 200;
/** Delay before closing so the pointer can move from the job chip into the popover. */
const HOVER_CLOSE_MS = 140;

type CalendarDetailIcon = typeof AccessTimeIcon;

const MONTH_YEAR_VIEWS = ['month', 'year'] as const satisfies readonly DateView[];

function PopoverDetailSection({
  icon: Icon,
  label,
  value,
}: {
  icon: CalendarDetailIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="scheduled-job-calendar__popover-section">
      <Icon className="scheduled-job-calendar__popover-icon" fontSize="small" aria-hidden />
      <div className="scheduled-job-calendar__popover-section-text">
        <div className="scheduled-job-calendar__popover-label">{label}</div>
        <div className="scheduled-job-calendar__popover-value">{value}</div>
      </div>
    </div>
  );
}

function normalizedPostPositionStatus(post: EmployeePostListingItem): number {
  const raw = post as unknown as Record<string, unknown>;
  return Number(post.postPositionStatus ?? raw.PostPositionStatus ?? raw.postPositionStatus);
}

/** Assigned = green; cancellation pending = red; anything else = neutral (no per-job random colors). */
function blockColorsForPost(post: EmployeePostListingItem): { bg: string; border: string } {
  const st = normalizedPostPositionStatus(post);
  if (st === PostPositionStatus.CancellationPending) {
    return {
      bg: 'var(--danger-light, #fce7ea)',
      border: 'var(--danger-color, #c41e3a)',
    };
  }
  if (st === PostPositionStatus.Assigned) {
    return {
      bg: 'var(--success-light, #d1fae5)',
      border: 'var(--success-color, #10b981)',
    };
  }
  return {
    bg: 'var(--bg-secondary, #f8fafc)',
    border: 'var(--border-color, #e2e8f0)',
  };
}

function jobChipTitle(post: EmployeePostListingItem, jobTitle: string): string {
  const st = normalizedPostPositionStatus(post);
  if (st === PostPositionStatus.CancellationPending) {
    return `${jobTitle} (${S.STATUS_CANCELLATION_PENDING})`;
  }
  if (st === PostPositionStatus.Assigned) {
    return `${jobTitle} (${S.STATUS_ASSIGNED})`;
  }
  return jobTitle;
}

/** Slightly longer than `scheduled-job-calendar-status-wipe` in CSS so the layer isn’t cleared mid-animation. */
const STATUS_WIPE_MS = 950;

type CalendarJobChipProps = {
  post: EmployeePostListingItem;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onMouseLeave: () => void;
};

/** Left-to-right wipe when status becomes cancellation pending (e.g. after cancel API). */
function CalendarJobChip({ post, onClick, onMouseEnter, onMouseLeave }: CalendarJobChipProps) {
  const st = normalizedPostPositionStatus(post);
  const pendingCancel = st === PostPositionStatus.CancellationPending;
  const pal = blockColorsForPost(post);
  const startLabel = formatPostGridStartTimeCell(post);
  const title = (post.postTitle ?? '').trim() || S.UNTITLED_JOB;

  const prevStRef = useRef<number | undefined>(undefined);
  const prevStyleRef = useRef(pal);
  const [wipe, setWipe] = useState(false);
  const [underDuringWipe, setUnderDuringWipe] = useState<{ bg: string; border: string } | null>(null);

  useLayoutEffect(() => {
    const prev = prevStRef.current;
    if (
      prev !== undefined &&
      st === PostPositionStatus.CancellationPending &&
      prev !== PostPositionStatus.CancellationPending
    ) {
      setUnderDuringWipe({ ...prevStyleRef.current });
      setWipe(true);
      const t = window.setTimeout(() => {
        setWipe(false);
        setUnderDuringWipe(null);
      }, STATUS_WIPE_MS);
      prevStRef.current = st;
      prevStyleRef.current = { ...pal };
      return () => window.clearTimeout(t);
    }
    prevStRef.current = st;
    prevStyleRef.current = { ...pal };
    return undefined;
  }, [st, pal.bg, pal.border]);

  const showReveal = wipe && underDuringWipe;
  const bg = showReveal ? underDuringWipe!.bg : pal.bg;
  const border = showReveal ? underDuringWipe!.border : pal.border;

  return (
    <button
      type="button"
      className={`scheduled-job-calendar__block${pendingCancel ? ' scheduled-job-calendar__block--cancellation-pending' : ''}${
        showReveal ? ' scheduled-job-calendar__block--status-wipe' : ''
      }`}
      style={{ backgroundColor: bg, borderColor: border }}
      title={jobChipTitle(post, title)}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {showReveal ? (
        <span
          className="scheduled-job-calendar__block-reveal-layer"
          style={{ backgroundColor: pal.bg }}
          aria-hidden
        />
      ) : null}
      <span className="scheduled-job-calendar__block-content">
        <span className="scheduled-job-calendar__block-time">
          {startLabel === '-' ? '-' : startLabel}
        </span>
        <span className="scheduled-job-calendar__block-title">{title}</span>
      </span>
    </button>
  );
}

function calendarDayKeyFromListingRow(p: EmployeePostListingItem): string {
  const raw = String(p.startDate ?? '').trim();
  if (!raw) return '';
  const dateOnly = /^(\d{4}-\d{2}-\d{2})/.exec(raw)?.[1];
  return dateOnly ?? '';
}

/** Same week padding as the rendered grid (Sun–Sat), so jobs on trailing/leading days still appear. */
function calendarGridBounds(visibleMonth: Date) {
  const mStart = startOfMonth(visibleMonth);
  const mEnd = endOfMonth(visibleMonth);
  return {
    gridStart: startOfWeek(mStart, { weekStartsOn: 0 }),
    gridEnd: endOfWeek(mEnd, { weekStartsOn: 0 }),
  };
}

function monthPanelKey(visibleMonth: Date): string {
  return format(startOfMonth(visibleMonth), 'yyyy-MM');
}

function monthPanelSortOrder(key: string): number {
  const [y, m] = key.split('-').map((x) => parseInt(x, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m)) return 0;
  return y * 12 + (m - 1);
}

const MISSING_START_MINUTES = 24 * 60 + 1;

function postStartMinutesForSort(post: EmployeePostListingItem): number {
  const p = post as EmployeePostListingItem & { postStartTime?: string | null };
  const raw = p.postStartTime ?? p.startTime;
  if (raw == null || !String(raw).trim()) return MISSING_START_MINUTES;
  const normalized = formatTimeToHHmm(String(raw).trim());
  if (!normalized) return MISSING_START_MINUTES;
  return timeStringToMinutes(normalized);
}

function formatLongDateFromKey(dayKey: string): string {
  if (!dayKey) return '';
  const d = new Date(`${dayKey}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dayKey;
  return format(d, 'EEEE, MMMM d, yyyy', { locale: enUS });
}

export interface ScheduledJobCalendarProps {
  positions: EmployeePostListingItem[];
  visibleMonth: Date;
  onMonthChange: (next: Date) => void;
  onViewFullDetails: (row: EmployeePostListingItem) => void;
  /** When set, popover footer shows table-style icon actions (view / roster / send). */
  scheduledActions?: ScheduledJobCalendarScheduledActions;
  loading?: boolean;
}

export const ScheduledJobCalendar: React.FC<ScheduledJobCalendarProps> = ({
  positions,
  visibleMonth,
  onMonthChange,
  onViewFullDetails,
  scheduledActions,
  loading = false,
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [popoverPost, setPopoverPost] = useState<EmployeePostListingItem | null>(null);
  const [monthPickerAnchorEl, setMonthPickerAnchorEl] = useState<HTMLElement | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHoverTimer = useCallback(() => {
    if (hoverTimerRef.current != null) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }, []);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current != null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const openPopover = useCallback(
    (el: HTMLElement, post: EmployeePostListingItem) => {
      clearHoverTimer();
      clearCloseTimer();
      setAnchorEl(el);
      setPopoverPost(post);
    },
    [clearHoverTimer, clearCloseTimer]
  );

  const closePopover = useCallback(() => {
    clearHoverTimer();
    clearCloseTimer();
    setAnchorEl(null);
    setPopoverPost(null);
  }, [clearHoverTimer, clearCloseTimer]);

  const scheduleClosePopover = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      closePopover();
    }, HOVER_CLOSE_MS);
  }, [clearCloseTimer, closePopover]);

  useEffect(
    () => () => {
      clearHoverTimer();
      clearCloseTimer();
    },
    [clearHoverTimer, clearCloseTimer]
  );

  const monthPanelKeyValue = monthPanelKey(visibleMonth);
  const prevMonthPanelKeyRef = useRef<string | null>(null);
  let monthSlideEnterClass = '';
  if (
    prevMonthPanelKeyRef.current !== null &&
    prevMonthPanelKeyRef.current !== monthPanelKeyValue
  ) {
    monthSlideEnterClass =
      monthPanelSortOrder(monthPanelKeyValue) > monthPanelSortOrder(prevMonthPanelKeyRef.current)
        ? 'scheduled-job-calendar__month-panel--enter-next'
        : 'scheduled-job-calendar__month-panel--enter-prev';
  }
  useLayoutEffect(() => {
    prevMonthPanelKeyRef.current = monthPanelKeyValue;
  }, [monthPanelKeyValue]);

  const jobsByDay = useMemo(() => {
    const map = new Map<string, EmployeePostListingItem[]>();
    const { gridStart, gridEnd } = calendarGridBounds(visibleMonth);
    const rangeStart = format(gridStart, 'yyyy-MM-dd');
    const rangeEnd = format(gridEnd, 'yyyy-MM-dd');

    for (const p of positions) {
      const key = calendarDayKeyFromListingRow(p);
      if (!key || key < rangeStart || key > rangeEnd) continue;
      const list = map.get(key) ?? [];
      list.push(p);
      map.set(key, list);
    }

    for (const [, list] of map) {
      list.sort((a, b) => {
        const ma = postStartMinutesForSort(a);
        const mb = postStartMinutesForSort(b);
        if (ma !== mb) return ma - mb;
        return String(a.postPositionId ?? '').localeCompare(String(b.postPositionId ?? ''));
      });
    }
    return map;
  }, [positions, visibleMonth]);

  const calendarDays = useMemo(() => {
    const { gridStart, gridEnd } = calendarGridBounds(visibleMonth);
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [visibleMonth]);

  const weekdayLabels = useMemo(() => {
    const base = startOfWeek(new Date(), { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return format(d, 'EEE', { locale: enUS });
    });
  }, []);

  const handleDateCalendarChange = useCallback(
    (value: Date | null, selectionState?: string) => {
      if (value == null) return;
      if (selectionState === 'partial' || selectionState === 'shallow') return;
      const d = value instanceof Date ? value : new Date(value as unknown as string);
      if (Number.isNaN(d.getTime())) return;
      onMonthChange(startOfMonth(d));
      setMonthPickerAnchorEl(null);
    },
    [onMonthChange]
  ) as DateCalendarProps['onChange'];

  const handleBlockClick = useCallback(
    (e: React.MouseEvent<HTMLElement>, post: EmployeePostListingItem) => {
      e.stopPropagation();
      openPopover(e.currentTarget, post);
    },
    [openPopover]
  );

  const handleBlockMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLElement>, post: EmployeePostListingItem) => {
      clearCloseTimer();
      clearHoverTimer();
      hoverTimerRef.current = setTimeout(() => {
        openPopover(e.currentTarget, post);
      }, HOVER_OPEN_MS);
    },
    [clearCloseTimer, clearHoverTimer, openPopover]
  );

  const handleBlockMouseLeave = useCallback(() => {
    clearHoverTimer();
    scheduleClosePopover();
  }, [clearHoverTimer, scheduleClosePopover]);

  const popoverDayKey = popoverPost ? calendarDayKeyFromListingRow(popoverPost) : '';
  const popoverTimeRange = useMemo(() => {
    if (!popoverPost) return S.EMPTY_DETAIL;
    const start = formatPostGridStartTimeCell(popoverPost);
    const end = formatPostGridEndTimeCell(popoverPost);
    if (start === '-' && end === '-') return S.EMPTY_DETAIL;
    if (end === '-') return start;
    return `${start} - ${end}`;
  }, [popoverPost]);

  return (
    <div className="scheduled-job-calendar">
      <div className="scheduled-job-calendar__toolbar">
        <h2 className="scheduled-job-calendar__toolbar-title">
          {format(visibleMonth, 'MMMM yyyy', { locale: enUS })}
        </h2>
        <div className="scheduled-job-calendar__toolbar-controls">
          <SMSIconButton
            size="small"
            tone="default"
            aria-label={S.PREV_MONTH}
            title={S.PREV_MONTH}
            onClick={() => onMonthChange(addMonths(visibleMonth, -1))}
            disabled={loading}
          >
            <SMSIcon name="chevron_left" size="sm" />
          </SMSIconButton>
          <div className="scheduled-job-calendar__month-picker-wrap">
            <SMSIconButton
              size="small"
              tone="primary"
              aria-label={S.CHOOSE_MONTH_YEAR}
              title={S.CHOOSE_MONTH_YEAR}
              aria-expanded={Boolean(monthPickerAnchorEl)}
              aria-haspopup="dialog"
              disabled={loading}
              onClick={(e) => setMonthPickerAnchorEl(e.currentTarget)}
            >
              <SMSIcon name="calendar" size="sm" />
            </SMSIconButton>
            <Popover
              open={Boolean(monthPickerAnchorEl)}
              anchorEl={monthPickerAnchorEl}
              onClose={() => setMonthPickerAnchorEl(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              slotProps={{
                paper: {
                  className: 'scheduled-job-calendar__month-picker-paper',
                  elevation: 8,
                },
              }}
            >
              <Box className="scheduled-job-calendar__month-picker-inner">
                <DateCalendar
                  value={visibleMonth}
                  onChange={handleDateCalendarChange}
                  views={MONTH_YEAR_VIEWS}
                  openTo="month"
                  reduceAnimations
                />
              </Box>
            </Popover>
          </div>
          <SMSButton
            variant="outlined"
            onClick={() => onMonthChange(startOfMonth(new Date()))}
            disabled={loading}
          >
            {S.TODAY}
          </SMSButton>
          <SMSIconButton
            size="small"
            tone="default"
            aria-label={S.NEXT_MONTH}
            title={S.NEXT_MONTH}
            onClick={() => onMonthChange(addMonths(visibleMonth, 1))}
            disabled={loading}
          >
            <SMSIcon name="chevron_right" size="sm" />
          </SMSIconButton>
        </div>
      </div>

      <div className="scheduled-job-calendar__month-slide-viewport">
        <div
          key={monthPanelKeyValue}
          className={`scheduled-job-calendar__month-panel${monthSlideEnterClass ? ` ${monthSlideEnterClass}` : ''}`}
        >
          <div className="scheduled-job-calendar__weekdays" role="row">
            {weekdayLabels.map((label) => (
              <div key={label} className="scheduled-job-calendar__weekday" role="columnheader">
                {label}
              </div>
            ))}
          </div>

          <div className="scheduled-job-calendar__grid" role="grid" aria-busy={loading}>
            {calendarDays.map((day) => {
              const dayKey = format(day, 'yyyy-MM-dd');
              const inMonth = isSameMonth(day, visibleMonth);
              const todayCell = isToday(day);
              const jobs = jobsByDay.get(dayKey) ?? [];
              const visible = jobs.slice(0, MAX_BLOCKS_PER_CELL);
              const more = jobs.length - visible.length;

              return (
                <div
                  key={dayKey}
                  className={`scheduled-job-calendar__cell${inMonth ? '' : ' scheduled-job-calendar__cell--outside'}${
                    todayCell ? ' scheduled-job-calendar__cell--today' : ''
                  }`}
                  role="gridcell"
                  aria-current={todayCell ? 'date' : undefined}
                >
                  <span
                    className={`scheduled-job-calendar__day-num${
                      todayCell ? ' scheduled-job-calendar__day-num--today' : ''
                    }`}
                  >
                    {format(day, 'd')}
                  </span>
                  <div className="scheduled-job-calendar__blocks">
                    {visible.map((post) => (
                      <CalendarJobChip
                        key={`${post.postPositionId ?? post.postID}-${post.orderNumber}-${dayKey}`}
                        post={post}
                        onClick={(e) => handleBlockClick(e, post)}
                        onMouseEnter={(e) => handleBlockMouseEnter(e, post)}
                        onMouseLeave={handleBlockMouseLeave}
                      />
                    ))}
                    {more > 0 ? (
                      <span className="scheduled-job-calendar__more">{S.MORE_JOBS.replace('{n}', String(more))}</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <Popover
        open={Boolean(anchorEl) && Boolean(popoverPost)}
        anchorEl={anchorEl}
        onClose={closePopover}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        disableRestoreFocus
        /** Let the pointer pass through to the grid except on the paper (hover bridge chip → popover). */
        sx={{ pointerEvents: 'none' }}
        PaperProps={{
          className: 'scheduled-job-calendar__popover-paper',
          elevation: 8,
          onMouseEnter: clearCloseTimer,
          onMouseLeave: scheduleClosePopover,
          sx: { pointerEvents: 'auto' },
        }}
        BackdropProps={{
          invisible: true,
          sx: { pointerEvents: 'none' },
        }}
        disableEnforceFocus
      >
        {popoverPost ? (
          <>
            <h4 className="scheduled-job-calendar__popover-title">
              {(popoverPost.postTitle ?? '').trim() || S.UNTITLED_JOB}
            </h4>
            <p className="scheduled-job-calendar__popover-date">{formatLongDateFromKey(popoverDayKey)}</p>

            <div className="scheduled-job-calendar__popover-section">
              <FlagOutlinedIcon className="scheduled-job-calendar__popover-icon" fontSize="small" aria-hidden />
              <div className="scheduled-job-calendar__popover-section-text">
                <div className="scheduled-job-calendar__popover-label">{S.POPOVER_STATUS}</div>
                <div className="scheduled-job-calendar__popover-status-wrap">
                  {renderPostPositionStatusPill(popoverPost.postPositionStatus)}
                </div>
              </div>
            </div>

            <PopoverDetailSection icon={AccessTimeIcon} label={S.POPOVER_TIME} value={popoverTimeRange} />

            <PopoverDetailSection
              icon={PlaceIcon}
              label={S.POPOVER_LOCATION}
              value={(popoverPost.postLocation ?? '').trim() || S.EMPTY_DETAIL}
            />

            <PopoverDetailSection
              icon={InfoOutlinedIcon}
              label={S.POPOVER_DESCRIPTION}
              value={String(
                (popoverPost as EmployeePostListingItem & { postDescription?: string | null }).postDescription ?? ''
              ).trim() || S.EMPTY_DETAIL}
            />

            <div className="scheduled-job-calendar__popover-actions">
              {scheduledActions ? (
                <div className="scheduled-job-calendar__popover-action-bar">
                  <SMSStack
                      direction="row"
                      spacing={0.5}
                      justifyContent="center"
                      alignItems="center"
                      flexWrap="wrap"
                      sx={{ width: '100%' }}
                    >
                      <SMSIconButton
                        size="small"
                        tone="primary"
                        allowWhenSuspended
                        aria-label={listBtn.VIEW_DETAILS}
                        title={listBtn.VIEW_DETAILS}
                        onClick={() => {
                          onViewFullDetails(popoverPost);
                          closePopover();
                        }}
                      >
                        <SMSIcon name="eye" size="sm" />
                      </SMSIconButton>
                      {popoverPost.postID && popoverPost.startDate ? (
                        <SMSIconButton
                          size="small"
                          tone="info"
                          allowWhenSuspended
                          aria-label={S.VIEW_ROSTER}
                          title={S.VIEW_ROSTER}
                          onClick={() => {
                            scheduledActions.onOpenRoster(popoverPost);
                            closePopover();
                          }}
                        >
                          <SMSIcon name="description" size="sm" />
                        </SMSIconButton>
                      ) : null}
                      {Number(popoverPost.postPositionStatus) !== PostPositionStatus.CancellationPending ? (
                        <SMSIconButton
                          size="small"
                          tone="primary"
                          aria-label={S.ADD_TO_CALENDAR}
                          title={S.ADD_TO_CALENDAR}
                          disabled={
                            Boolean(scheduledActions.sendInviteDisabled) ||
                            scheduledActions.sendingInvitePostPositionId === popoverPost.postPositionId
                          }
                          onClick={() => {
                            scheduledActions.onSendInvite(popoverPost);
                            closePopover();
                          }}
                        >
                          <SMSIcon name="send" size="sm" />
                        </SMSIconButton>
                      ) : null}
                      {scheduledActions.onCancelJob &&
                      scheduledActions.allowEmployeeCancellation === true &&
                      Number(popoverPost.postPositionStatus) !== PostPositionStatus.CancellationPending ? (
                        <SMSButton
                          aria-label={listBtn.CANCEL_POST}
                          title={listBtn.CANCEL_POST}
                          disabled={
                            Boolean(scheduledActions.suspendBlocksCancellation) ||
                            scheduledActions.cancellingPostPositionId === popoverPost.postPositionId
                          }
                          onClick={() => {
                            scheduledActions.onCancelJob?.(popoverPost);
                            closePopover();
                          }}
                          endIcon={<SMSIcon name="cancel" size="sm" />}
                        >
                          {listBtn.CANCEL_POST}
                        </SMSButton>
                      ) : null}
                      {scheduledActions.onRevokeCancellation &&
                      Number(popoverPost.postPositionStatus) === PostPositionStatus.CancellationPending ? (
                        <SMSButton
                          aria-label={listBtn.REVOKE_CANCELLATION}
                          title={listBtn.REVOKE_CANCELLATION}
                          disabled={
                            Boolean(scheduledActions.suspendBlocksCancellation) ||
                            scheduledActions.revokingCancellationPostPositionId === popoverPost.postPositionId
                          }
                          onClick={() => {
                            scheduledActions.onRevokeCancellation?.(popoverPost);
                            closePopover();
                          }}
                        >
                          {listBtn.REVOKE_CANCELLATION}
                        </SMSButton>
                      ) : null}
                  </SMSStack>
                </div>
              ) : (
                <SMSButton
                  onClick={() => {
                    onViewFullDetails(popoverPost);
                    closePopover();
                  }}
                >
                  {S.VIEW_FULL_DETAILS}
                </SMSButton>
              )}
            </div>
          </>
        ) : null}
      </Popover>
    </div>
  );
};
