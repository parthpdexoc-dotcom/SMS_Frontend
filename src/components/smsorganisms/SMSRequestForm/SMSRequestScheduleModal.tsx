import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  SMSBox,
  SMSButton,
  SMSCheckbox,
  SMSDatePicker,
  SMSDropdown,
  SMSGrid,
  SMSStack,
  SMSTimePicker,
  SMSTypography,
} from '@/components/smsatoms';
import { SMSModal as Modal } from '@/components/smsorganisms/SMSModal';
import { SMSConfirmDialog } from '@/components/smsmolecules';
import { REQUEST, FIELD_NAMES } from '@/constants/strings';
import {
  ReleaseAs,
  RequestStatus,
  type RequestScheduleDto,
  type ScheduleReleaseHours,
} from '@/types/request';
import { formatDateShort } from '@/utils';
import {
  formatTimeToHHmm,
  addLocalDateTimeHours,
  formatDateToYYYYMMDD,
  addHoursToNow,
  enumerateInclusiveYmdStringKeys,
} from '@/utils/dateTimeUtils';

/** Inclusive YYYY-MM-DD range overlap. */
function scheduleRangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

/** "Release for" mode: fixed hour offset from schedule time, or custom (manual process date/time). Empty = no selection. */
export type ReleaseForMode = '' | '1' | '24' | '48' | '72' | 'custom';

const SCHEDULE_RELEASE_FOR_ALL_OPTIONS: { value: ReleaseForMode; label: string }[] = [
  { value: '1', label: REQUEST.FORM.SCHEDULE_RELEASE_1_HOUR },
  { value: '24', label: REQUEST.FORM.SCHEDULE_RELEASE_24_HOUR },
  { value: '48', label: REQUEST.FORM.SCHEDULE_RELEASE_48_HOUR },
  { value: '72', label: REQUEST.FORM.SCHEDULE_RELEASE_72_HOUR },
  { value: 'custom', label: REQUEST.FORM.SCHEDULE_AFTER_CUSTOM },
];

/** "Release for" options allowed for a given calendar-day gap from schedule date to period start date. */
function getReleaseForAllowedByDayGap(gap: number): ReleaseForMode[] {
  if (gap <= 0) return ['1', 'custom'];
  if (gap === 1) return ['1', '24', 'custom'];
  if (gap === 2) return ['1', '24', '48', 'custom'];
  return ['1', '24', '48', '72', 'custom'];
}

const parseScheduleReleaseHours = (raw: unknown): ScheduleReleaseHours | null => {
  const n = Number(raw);
  if (n === 2) return 24;
  if (n === 0 || n === 1 || n === 24 || n === 48 || n === 72) return n as ScheduleReleaseHours;
  return null;
};

export const REQUEST_SCHEDULE_STATUS_OPTIONS = [
  { value: RequestStatus.Pending.toString(), label: 'Pending' },
  { value: RequestStatus.ReleaseNow.toString(), label: 'Release Now' },
  { value: RequestStatus.ReleasedOn.toString(), label: 'Released On' },
  { value: RequestStatus.Cancelled.toString(), label: 'Cancelled' },
  { value: RequestStatus.Completed.toString(), label: 'Completed' },
];

export const RELEASE_AS_OPTIONS = [
  { value: ReleaseAs.Open.toString(), label: 'Open' },
  { value: ReleaseAs.TenureBased.toString(), label: 'Tenure Based' },
  { value: ReleaseAs.Managed.toString(), label: 'Managed' },
  { value: ReleaseAs.Preferred.toString(), label: 'Preferred' },
];

/** "Schedule after" in the request schedule modal: hours from *now* at save, or custom date/time. Empty = no selection. */
export type ScheduleAfterMode = '' | '1' | '24' | '48' | '72' | 'custom';

const SCHEDULE_AFTER_DROPDOWN_OPTIONS: { value: ScheduleAfterMode; label: string }[] = [
  { value: '1', label: REQUEST.FORM.SCHEDULE_RELEASE_1_HOUR },
  { value: '24', label: REQUEST.FORM.SCHEDULE_RELEASE_24_HOUR },
  { value: '48', label: REQUEST.FORM.SCHEDULE_RELEASE_48_HOUR },
  { value: '72', label: REQUEST.FORM.SCHEDULE_RELEASE_72_HOUR },
  { value: 'custom', label: REQUEST.FORM.SCHEDULE_AFTER_CUSTOM },
];

const SCHEDULE_AFTER_OFFSET_MODES: ScheduleAfterMode[] = ['1', '24', '48', '72'];

/**
 * Full calendar days from local `todayK` to `periodStartK` (0 = same day, 1 = start is tomorrow, …).
 * YYYY-MM-DD only. Past start or invalid returns 0.
 */
function dayGapToPeriodStart(todayK: string, periodStartK: string): number {
  const t = (todayK ?? '').trim().slice(0, 10);
  const s = (periodStartK ?? '').trim().slice(0, 10);
  if (!s || s < t) return 0;
  if (s === t) return 0;
  const range = enumerateInclusiveYmdStringKeys(t, s);
  if (range.length < 2) return 0;
  return range.length - 1;
}

/** “Schedule after” options allowed for a given day-gap from today to period start. */
function getScheduleAfterAllowedByDayGap(gap: number): ScheduleAfterMode[] {
  if (gap <= 0) return ['1', 'custom'];
  if (gap === 1) return ['1', 'custom'];
  if (gap === 2) return ['1', '24', 'custom'];
  if (gap === 3) return ['1', '24', '48', 'custom'];
  return ['1', '24', '48', '72', 'custom'];
}

function isScheduleAfterOffsetMode(m: ScheduleAfterMode): m is '1' | '24' | '48' | '72' {
  return SCHEDULE_AFTER_OFFSET_MODES.includes(m);
}

function toFiniteNumber(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const requiresProcessFields = (releaseAs: ReleaseAs | null | undefined): boolean => {
  const ra = toFiniteNumber(releaseAs);
  return ra === ReleaseAs.TenureBased || ra === ReleaseAs.Preferred;
};

export const requiresScheduleReleaseHours = (
  requestStatus: RequestStatus | null | undefined,
  releaseAs: ReleaseAs | null | undefined
): boolean =>
  toFiniteNumber(requestStatus) === RequestStatus.ReleasedOn &&
  toFiniteNumber(releaseAs) === ReleaseAs.TenureBased;

function isReleasedOnStatus(status: unknown): boolean {
  return toFiniteNumber(status) === RequestStatus.ReleasedOn;
}

function startOfLocalDayMs(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

/** Earliest selectable schedule time when schedule date is the current calendar day (15-min ceiling). */
function scheduleTimeMinIfScheduleDateIsToday(
  requestStatus: RequestStatus,
  scheduleDate: string
): string | undefined {
  if (!isReleasedOnStatus(requestStatus)) return undefined;
  const sd = normalizeScheduleDateToYYYYMMDDKey(scheduleDate);
  const todayK = formatDateToYYYYMMDD(new Date());
  if (!sd || sd !== todayK) return undefined;
  const n = new Date();
  return ceilTimeToQuarterHour(`${n.getHours()}:${String(n.getMinutes()).padStart(2, '0')}`);
}

function dateOnlyFromYYYYMMDD(s: string): Date | null {
  const t = s.trim().slice(0, 10);
  const parts = t.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Normalize schedule/process date strings to a local YYYY-MM-DD key comparable across pickers and API.
 * Bare `YYYY-MM-DD` is returned as-is (avoid `Date` parsing, which treats that as UTC midnight).
 * ISO strings with a time component use the local calendar day of that instant.
 */
function normalizeScheduleDateToYYYYMMDDKey(raw: string | undefined | null): string {
  const t = raw?.trim() ?? '';
  if (!t) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return '';
  return formatDateToYYYYMMDD(d);
}

/** SMSTimePicker uses 15-minute steps; min time must round up so a valid slot exists. */
function ceilTimeToQuarterHour(hhmm: string): string {
  const m = hhmm.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return hhmm;
  let h = parseInt(m[1], 10);
  let min = parseInt(m[2], 10);
  if (Number.isNaN(h) || Number.isNaN(min)) return hhmm;
  if (min % 15 === 0) return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  let nextMin = Math.ceil(min / 15) * 15;
  if (nextMin >= 60) {
    h += 1;
    nextMin = 0;
  }
  if (h > 23) return '23:45';
  return `${String(h).padStart(2, '0')}:${String(nextMin).padStart(2, '0')}`;
}

function localDateTimeMs(yyyyMmDd: string, hhmm: string): number | null {
  const d = yyyyMmDd?.trim().slice(0, 10);
  const t = formatTimeToHHmm(hhmm);
  if (!d || !t) return null;
  const [Y, M, D] = d.split('-').map(Number);
  const [h, m] = t.split(':').map(Number);
  if ([Y, M, D, h, m].some((x) => Number.isNaN(x))) return null;
  const dt = new Date(Y, M - 1, D, h, m, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt.getTime();
}

/** Earliest 15-minute process time strictly after schedule time when process date equals schedule date. */
function quarterHourStrictlyAfterSchedule(scheduledHHmm: string): string {
  const t = formatTimeToHHmm(scheduledHHmm);
  if (!t) return '00:15';
  const [h, m] = t.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return '00:15';
  const totalMins = h * 60 + m + 1;
  const quartered = Math.ceil(totalMins / 15) * 15;
  const nh = Math.floor(quartered / 60);
  const nm = quartered % 60;
  if (nh >= 24) return '23:45';
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

export type RequestScheduleModalDraft = {
  startDate: string;
  endDate: string;
  isActive: boolean;
  releaseAs: ReleaseAs;
  requestStatus: RequestStatus;
  /** For Released On: fixed offsets compute schedule from *now* at save; `custom` shows date/time pickers. */
  scheduleAfter: ScheduleAfterMode;
  scheduleDate: string;
  scheduledTime: string;
  processDate: string;
  processTime: string;
  releaseHours: ScheduleReleaseHours | null;
  /** For Release for (TenureBased): fixed hour offsets auto-compute process date/time; `custom` = manual entry. */
  releaseForMode: ReleaseForMode;
  /** When true, auto-generate leaves this schedule unchanged. */
  preserveOnRegenerate: boolean;
};

export function shouldDefaultPreserveOnRegenerate(
  requestStatus: RequestStatus,
  releaseAs: ReleaseAs
): boolean {
  return requestStatus === RequestStatus.ReleaseNow && releaseAs === ReleaseAs.Open;
}

function withReleaseNowOpenPreserveDefault(draft: RequestScheduleModalDraft): RequestScheduleModalDraft {
  if (!shouldDefaultPreserveOnRegenerate(draft.requestStatus, draft.releaseAs)) {
    return draft;
  }
  return { ...draft, preserveOnRegenerate: true };
}

function clampProcessTimeAfterScheduleSameDay(d: RequestScheduleModalDraft): RequestScheduleModalDraft {
  if (!requiresProcessFields(d.releaseAs) || !isReleasedOnStatus(d.requestStatus)) return d;
  const sk = normalizeScheduleDateToYYYYMMDDKey(d.scheduleDate);
  const pk = normalizeScheduleDateToYYYYMMDDKey(d.processDate);
  if (!sk || !pk || sk !== pk || !d.scheduledTime?.trim()) return d;
  const minT = quarterHourStrictlyAfterSchedule(d.scheduledTime);
  const cur = formatTimeToHHmm(d.processTime);
  const m = formatTimeToHHmm(minT) || minT;
  if (!cur || !cur.trim() || cur < m) return { ...d, processTime: minT };
  return d;
}

export const emptyRequestScheduleModalDraft = (): RequestScheduleModalDraft => ({
  startDate: '',
  endDate: '',
  isActive: true,
  releaseAs: ReleaseAs.Open,
  requestStatus: RequestStatus.Pending,
  scheduleAfter: '',
  scheduleDate: '',
  scheduledTime: '',
  processDate: '',
  processTime: '',
  releaseHours: null,
  releaseForMode: '',
  preserveOnRegenerate: false,
});

function withProcessFromSchedulePlusReleaseHours(draft: RequestScheduleModalDraft): RequestScheduleModalDraft {
  const { releaseHours, scheduleDate, scheduledTime, requestStatus, releaseAs } = draft;
  if (releaseHours == null || !requiresScheduleReleaseHours(requestStatus, releaseAs)) {
    return draft;
  }
  const calc = addLocalDateTimeHours(scheduleDate, scheduledTime, releaseHours);
  if (!calc) {
    return { ...draft, processDate: '', processTime: '' };
  }
  return { ...draft, processDate: calc.date, processTime: calc.time };
}

/**
 * When status is Released On, if period Start Date is **before** the release schedule calendar day
 * (e.g. after choosing 48h in “Schedule after”), move it up to that day. If start is already
 * **on or after** that day, do not change it. Empty start is filled to the schedule day. If end
 * is before the schedule day, it is set to the schedule day string.
 */
function alignStartDateToScheduleDate(d: RequestScheduleModalDraft): RequestScheduleModalDraft {
  if (!isReleasedOnStatus(d.requestStatus)) return d;
  const schedK = normalizeScheduleDateToYYYYMMDDKey(d.scheduleDate);
  if (!schedK) return d;
  const raw = d.scheduleDate?.trim() ?? '';
  const startValue = /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : schedK;

  let next = d;
  const startK = normalizeScheduleDateToYYYYMMDDKey(d.startDate);
  if (!startK) {
    next = { ...next, startDate: startValue };
  } else if (startK < schedK) {
    next = { ...next, startDate: startValue };
  }
  const endK = normalizeScheduleDateToYYYYMMDDKey(next.endDate);
  if (endK && endK < schedK) {
    next = { ...next, endDate: startValue };
  }
  return next;
}

/** Recomputes schedule (and derived process) from *current* time + N hours; used for save and for preview after changing the "Schedule after" control. */
function applyScheduleAfterOffsetToDraft(d: RequestScheduleModalDraft): RequestScheduleModalDraft {
  if (!isReleasedOnStatus(d.requestStatus) || d.scheduleAfter === 'custom' || d.scheduleAfter === '') {
    return d;
  }
  const hMap: Record<string, number> = { '1': 1, '24': 24, '48': 48, '72': 72 };
  const h = hMap[d.scheduleAfter];
  if (h == null) return d;
  const c = addHoursToNow(h);
  let next: RequestScheduleModalDraft = { ...d, scheduleDate: c.date, scheduledTime: c.time };
  next = withProcessFromSchedulePlusReleaseHours(next);
  next = clampProcessTimeAfterScheduleSameDay(next);
  return alignStartDateToScheduleDate(next);
}

export const scheduleReleaseHoursLabel = (hours: ScheduleReleaseHours | null): string => {
  if (hours == null) return '-';
  switch (hours) {
    case 0:
      return REQUEST.FORM.SCHEDULE_RELEASE_FROM_SCHEDULED_TIME;
    case 1:
      return REQUEST.FORM.SCHEDULE_RELEASE_1_HOUR;
    case 24:
      return REQUEST.FORM.SCHEDULE_RELEASE_24_HOUR;
    case 48:
      return REQUEST.FORM.SCHEDULE_RELEASE_48_HOUR;
    case 72:
      return REQUEST.FORM.SCHEDULE_RELEASE_72_HOUR;
    default:
      return '-';
  }
};

export const readScheduleReleaseHoursFromDto = (r: RequestScheduleDto): ScheduleReleaseHours | null => {
  const rec = r as unknown as Record<string, unknown>;
  const raw =
    rec.releaseHours ??
    rec.ReleaseHours ??
    rec.scheduleReleaseHours ??
    rec.ScheduleReleaseHours;
  return parseScheduleReleaseHours(raw);
};

/**
 * Computes the hour difference (processDateTime − scheduleDateTime) for custom "Release for" mode.
 * Returns the value rounded to two decimal places, or null if any input is missing/invalid.
 */
function computeCustomReleaseHours(
  scheduleDate: string,
  scheduledTime: string,
  processDate: string,
  processTime: string
): number | null {
  const schedK = normalizeScheduleDateToYYYYMMDDKey(scheduleDate);
  const procK = normalizeScheduleDateToYYYYMMDDKey(processDate);
  const schedT = formatTimeToHHmm(scheduledTime);
  const procT = formatTimeToHHmm(processTime);
  if (!schedK || !procK || !schedT || !procT) return null;
  const schedMs = localDateTimeMs(schedK, schedT);
  const procMs = localDateTimeMs(procK, procT);
  if (schedMs == null || procMs == null) return null;
  const diffHours = (procMs - schedMs) / (1000 * 60 * 60);
  return Math.floor(diffHours);
}

export interface RequestScheduleSavePayload {
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  releaseAs: ReleaseAs;
  requestStatus: RequestStatus;
  scheduleDate: string | null;
  scheduledTime: string | null;
  processDate: string | null;
  processTime: string | null;
  /** Fixed-offset hours (1 / 24 / 48 / 72) or a computed decimal value when Release for = Custom. */
  releaseHours: number | null;
  preserveOnRegenerate: boolean;
}

type ModalFieldErrors = {
  scheduleDate?: string;
  scheduledTime?: string;
  processDate?: string;
  processTime?: string;
  releaseHours?: string;
  periodStart?: string;
  periodEnd?: string;
  requestStatus?: string;
};

export interface SMSRequestScheduleModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (payload: RequestScheduleSavePayload) => void;
  initialDraft: RequestScheduleModalDraft;
  selectedType: string;
  boundStartDate: string;
  boundEndDate: string;
  /** YYYY-MM-DD; schedule period start cannot be before the request start (same as `boundStartDate`). */
  addScheduleStartMinDate?: string;
  today: Date;
  minProcessDate: Date;
  isLoading: boolean;
  requestSchedulesLoading: boolean;
  releaseAsDropdownOptions: { value: string; label: string }[];
  parentFieldErrors: { startDate?: string; endDate?: string };
  /** Other schedules (excluding the row being edited) for overlap checks and disabling occupied days. */
  otherScheduleRanges: { start: string; end: string }[];
  /** When true, primary action is "Save" (editing a row) instead of "Add" (new row). */
  isEditing: boolean;
}

export const SMSRequestScheduleModal: React.FC<SMSRequestScheduleModalProps> = ({
  open,
  onClose,
  onSave,
  initialDraft,
  selectedType,
  boundStartDate,
  boundEndDate,
  addScheduleStartMinDate,
  today,
  minProcessDate,
  isLoading,
  requestSchedulesLoading,
  releaseAsDropdownOptions,
  parentFieldErrors,
  otherScheduleRanges,
  isEditing,
}) => {
  const isNone = selectedType === 'NONE';
  const [draft, setDraft] = useState<RequestScheduleModalDraft>(initialDraft);

  /**
   * Max selectable release schedule day: the period **Start date** (inclusive with min=today), not the end date.
   */
  const scheduleDateMaxDate = useMemo(() => {
    if (isNone) {
      const raw = boundStartDate?.trim();
      if (!raw) return undefined;
      const d = dateOnlyFromYYYYMMDD(raw);
      if (!d) return undefined;
      d.setHours(0, 0, 0, 0);
      return d;
    }
    const ps = draft.startDate?.trim();
    if (!ps) return undefined;
    const d = dateOnlyFromYYYYMMDD(ps);
    if (!d) return undefined;
    d.setHours(0, 0, 0, 0);
    return d;
  }, [isNone, boundStartDate, draft.startDate]);

  /** Release schedule day: never earlier than the calendar “today” passed in (independent of period start). */
  const scheduleReleaseDateMinDate = useMemo(() => {
    const t = new Date(today);
    t.setHours(0, 0, 0, 0);
    return t;
  }, [today]);

  /** Min (today) and max (period start) must both be enforced; custom `shouldDisableDate` can override MUI max in some cases. */
  const shouldDisableReleaseScheduleDate = useCallback(
    (day: Date) => {
      const t = startOfLocalDayMs(day);
      if (t < startOfLocalDayMs(scheduleReleaseDateMinDate)) return true;
      if (scheduleDateMaxDate && t > startOfLocalDayMs(scheduleDateMaxDate)) return true;
      return false;
    },
    [scheduleReleaseDateMinDate, scheduleDateMaxDate]
  );

  const effectiveScheduleEndKey = useMemo(() => {
    const raw = isNone ? boundEndDate : draft.endDate;
    return normalizeScheduleDateToYYYYMMDDKey(raw);
  }, [isNone, boundEndDate, draft.endDate]);

  const effectiveScheduleStartKey = useMemo(() => {
    const raw = isNone ? boundStartDate : draft.startDate;
    return normalizeScheduleDateToYYYYMMDDKey(raw);
  }, [isNone, boundStartDate, draft.startDate]);

  /** Same calendar day as date pickers / request form (prop), not `new Date()` on every render. */
  const todayKey = useMemo(() => formatDateToYYYYMMDD(today), [today]);

  /** Full calendar days from local today to the effective period start (drives “Schedule after” options). */
  const periodStartDayGap = useMemo(
    () => dayGapToPeriodStart(todayKey, effectiveScheduleStartKey),
    [todayKey, effectiveScheduleStartKey]
  );

  const scheduleAfterDropdownOptions = useMemo(() => {
    const allowed = new Set(
      getScheduleAfterAllowedByDayGap(periodStartDayGap) as string[]
    );
    return SCHEDULE_AFTER_DROPDOWN_OPTIONS.filter((o) => allowed.has(o.value));
  }, [periodStartDayGap]);

  /** Calendar-day gap from the release schedule date to the period start date (drives "Release for" options). */
  const scheduleToStartDayGap = useMemo(() => {
    const schedK = normalizeScheduleDateToYYYYMMDDKey(draft.scheduleDate);
    const startRaw = isNone ? boundStartDate : draft.startDate;
    const startK = normalizeScheduleDateToYYYYMMDDKey(startRaw);
    if (!schedK || !startK) return 0;
    return dayGapToPeriodStart(schedK, startK);
  }, [draft.scheduleDate, isNone, boundStartDate, draft.startDate]);

  const releaseForDropdownOptions = useMemo(() => {
    const allowed = new Set(getReleaseForAllowedByDayGap(scheduleToStartDayGap) as string[]);
    return SCHEDULE_RELEASE_FOR_ALL_OPTIONS.filter((o) => allowed.has(o.value));
  }, [scheduleToStartDayGap]);

  /**
   * Completed is not allowed while the schedule end (local calendar day) is still strictly after today.
   * Uses fresh "today" whenever the effective end key changes (opening modal / editing dates).
   */
  const completedStatusDisallowed = useMemo(() => {
    if (!open || !effectiveScheduleEndKey) return false;
    return effectiveScheduleEndKey > todayKey;
  }, [open, effectiveScheduleEndKey, todayKey]);

  /** Released On: start date must be on or after today (local calendar); past start disables it. */
  const releasedOnStatusDisallowed = useMemo(() => {
    if (!open || !effectiveScheduleStartKey) return false;
    return effectiveScheduleStartKey < todayKey;
  }, [open, effectiveScheduleStartKey, todayKey]);

  /**
   * Tenure Based is only valid when the schedule period start is on or after today;
   * for a past start date, remove it from Release As (aligns with request form rules).
   */
  const releaseAsDropdownOptionsEffective = useMemo(() => {
    const startBeforeToday =
      Boolean(effectiveScheduleStartKey) && effectiveScheduleStartKey < todayKey;
    if (!startBeforeToday) return releaseAsDropdownOptions;
    return releaseAsDropdownOptions.filter(
      (o) => parseInt(o.value, 10) !== ReleaseAs.TenureBased
    );
  }, [releaseAsDropdownOptions, effectiveScheduleStartKey, todayKey]);

  /** Per-option disabled rules for release status (see SMSDropdown: single-select + disabled uses Select, not Autocomplete). */
  const releaseStatusDropdownOptions = useMemo(
    () =>
      REQUEST_SCHEDULE_STATUS_OPTIONS.map((o) => {
        const val = Number(o.value);
        return {
          ...o,
          disabled:
            (completedStatusDisallowed && val === RequestStatus.Completed) ||
            (releasedOnStatusDisallowed && val === RequestStatus.ReleasedOn),
        };
      }),
    [completedStatusDisallowed, releasedOnStatusDisallowed]
  );

  /** Status + [when Released On: schedule after, schedule date, schedule time] + release-as. */
  const releasedOn = isReleasedOnStatus(draft.requestStatus);
  const preserveOnRegenerateLocked = shouldDefaultPreserveOnRegenerate(
    draft.requestStatus ?? RequestStatus.Pending,
    draft.releaseAs ?? ReleaseAs.Open
  );
  const scheduleControlRowGridSx = useMemo(() => {
    if (!releasedOn) {
      return {
        display: 'grid',
        width: '100%',
        columnGap: 1.5,
        rowGap: 1.5,
        alignItems: 'end' as const,
        gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
      };
    }
    return {
      display: 'grid',
      width: '100%',
      columnGap: 1.5,
      rowGap: 1.5,
      alignItems: 'end' as const,
      gridTemplateColumns: {
        xs: '1fr',
        sm: 'repeat(2, minmax(0, 1fr))',
        md: 'repeat(5, minmax(0, 1fr))',
      },
    };
  }, [releasedOn]);

  const scheduleDateTimeFieldDisabled =
    isLoading ||
    !releasedOn ||
    draft.scheduleAfter === '' ||
    isScheduleAfterOffsetMode(draft.scheduleAfter);

  const [isReleaseAsEditable, setIsReleaseAsEditable] = useState(false);
  const [originalReleaseAs, setOriginalReleaseAs] = useState<ReleaseAs>(ReleaseAs.Open);
  const [modalErrors, setModalErrors] = useState<ModalFieldErrors>({});
  const [pendingReleaseAsChange, setPendingReleaseAsChange] = useState<{
    payload: RequestScheduleSavePayload;
    startDate: string;
    endDate: string;
    releaseAsLabel: string;
  } | null>(null);

  /** Preserves custom schedule so switching to an hours offset and back to Custom can restore. */
  const lastCustomScheduleRef = useRef<{ date: string; time: string }>({ date: '', time: '' });
  const submitLockRef = useRef(false);

  useEffect(() => {
    if (!open || !requestSchedulesLoading) submitLockRef.current = false;
  }, [open, requestSchedulesLoading]);

  useLayoutEffect(() => {
    if (!open) return;
    const rawAfter = (initialDraft.scheduleAfter ?? '') as ScheduleAfterMode;
    const startKey = isNone
      ? normalizeScheduleDateToYYYYMMDDKey(boundStartDate)
      : normalizeScheduleDateToYYYYMMDDKey(initialDraft.startDate);
    const tk = formatDateToYYYYMMDD(today);
    const gap = dayGapToPeriodStart(tk, startKey);
    const allowed = new Set(
      getScheduleAfterAllowedByDayGap(gap) as string[]
    );
    const invalid =
      rawAfter !== '' && !allowed.has(rawAfter);
    const scheduleAfter: ScheduleAfterMode = invalid ? '' : rawAfter;

    // Use only the explicitly persisted releaseForMode; never auto-derive from releaseHours.
    const releaseForMode: ReleaseForMode = (initialDraft as RequestScheduleModalDraft).releaseForMode || '';

    setDraft({
      ...initialDraft,
      scheduleAfter,
      releaseForMode,
      ...(invalid ? { scheduleDate: '', scheduledTime: '' } : {}),
    });
    setOriginalReleaseAs(initialDraft.releaseAs);
    setIsReleaseAsEditable(false);
    setPendingReleaseAsChange(null);
    setModalErrors({});
    const a = (invalid ? '' : (initialDraft.scheduleDate ?? '')).trim();
    const b = (invalid ? '' : (initialDraft.scheduledTime ?? '')).trim();
    if (scheduleAfter === 'custom' && a && b) {
      lastCustomScheduleRef.current = { date: a, time: formatTimeToHHmm(b) || b };
    } else {
      lastCustomScheduleRef.current = { date: '', time: '' };
    }
  }, [open, initialDraft, isNone, boundStartDate, today]);

  /** Clear “Schedule after” when the day-gap makes the current value invalid. */
  useEffect(() => {
    if (!open) return;
    setDraft((p) => {
      if (!p.scheduleAfter) return p;
      const allowed = new Set(
        getScheduleAfterAllowedByDayGap(periodStartDayGap) as string[]
      );
      if (allowed.has(p.scheduleAfter)) return p;
      return { ...p, scheduleAfter: '', scheduleDate: '', scheduledTime: '' };
    });
  }, [open, periodStartDayGap]);

  /** Clear "Release for" when the schedule-to-start gap makes the current hour option invalid. */
  useEffect(() => {
    if (!open) return;
    setDraft((p) => {
      if (!p.releaseForMode || p.releaseForMode === 'custom') return p;
      const allowed = new Set(getReleaseForAllowedByDayGap(scheduleToStartDayGap) as string[]);
      if (allowed.has(p.releaseForMode)) return p;
      return { ...p, releaseForMode: '', releaseHours: null, processDate: '', processTime: '' };
    });
  }, [open, scheduleToStartDayGap]);

  /** Keep ref in sync when the user edits date/time in Custom mode. */
  useEffect(() => {
    if (!open || draft.scheduleAfter !== 'custom') return;
    const a = (draft.scheduleDate ?? '').trim();
    const b = (draft.scheduledTime ?? '').trim();
    if (a && b) {
      const t = formatTimeToHHmm(b) || b;
      lastCustomScheduleRef.current = { date: a, time: t };
    }
  }, [open, draft.scheduleAfter, draft.scheduleDate, draft.scheduledTime]);

  /**
   * Past schedule start disables Released On — fall back to Release Now and clear schedule fields.
   */
  useEffect(() => {
    if (!open) return;

    if (!releasedOnStatusDisallowed) return;

    setDraft((prev) => {
      if (!isReleasedOnStatus(prev.requestStatus)) return prev;
      return withReleaseNowOpenPreserveDefault({
        ...prev,
        requestStatus: RequestStatus.ReleaseNow,
        scheduleAfter: '',
        scheduleDate: '',
        scheduledTime: '',
        releaseHours: null,
        releaseForMode: '' as ReleaseForMode,
      });
    });
    setModalErrors((prev) => ({ ...prev, requestStatus: undefined }));
  }, [open, releasedOnStatusDisallowed]);

  useEffect(() => {
    if (!open) return;
    if (releaseAsDropdownOptionsEffective.length === 0) return;
    const allowed = new Set(releaseAsDropdownOptionsEffective.map((opt) => opt.value));
    setDraft((prev) => {
      const cur = String(prev.releaseAs ?? ReleaseAs.Open);
      if (allowed.has(cur)) return prev;
      const firstAllowed = parseInt(
        releaseAsDropdownOptionsEffective[0].value,
        10
      ) as ReleaseAs;
      return {
        ...prev,
        releaseAs: firstAllowed,
        ...(!requiresProcessFields(firstAllowed)
          ? { processDate: '', processTime: '' }
          : {}),
        ...(!requiresScheduleReleaseHours(prev.requestStatus, firstAllowed)
          ? { releaseHours: null, releaseForMode: '' as ReleaseForMode }
          : {}),
      };
    });
  }, [open, releaseAsDropdownOptionsEffective]);

  const releaseAsChangeConfirmationMessage = useMemo(() => {
    if (!pendingReleaseAsChange) return '';
    return REQUEST.FORM.CONFIRM_RELEASE_AS_CHANGE_MESSAGE.replace(
      '{releaseAs}',
      pendingReleaseAsChange.releaseAsLabel
    )
      .replace('{startDate}', pendingReleaseAsChange.startDate)
      .replace('{endDate}', pendingReleaseAsChange.endDate);
  }, [pendingReleaseAsChange]);

  const calculatedProcessFloor = useMemo(() => {
    if (!requiresScheduleReleaseHours(draft.requestStatus, draft.releaseAs)) return null;
    if (draft.releaseHours == null) return null;
    return addLocalDateTimeHours(draft.scheduleDate, draft.scheduledTime, draft.releaseHours);
  }, [
    draft.releaseAs,
    draft.releaseHours,
    draft.requestStatus,
    draft.scheduleDate,
    draft.scheduledTime,
  ]);

  const effectiveMinProcessDate = useMemo(() => {
    const base = new Date(minProcessDate);
    base.setHours(0, 0, 0, 0);
    const calcDate = calculatedProcessFloor?.date;
    if (!calcDate) return minProcessDate;
    const cd = dateOnlyFromYYYYMMDD(calcDate);
    if (!cd) return minProcessDate;
    cd.setHours(0, 0, 0, 0);
    return cd.getTime() > base.getTime() ? cd : minProcessDate;
  }, [minProcessDate, calculatedProcessFloor]);

  /** Earliest selectable process day in the calendar (no extra save validation vs schedule date). */
  const processDateMinDate = useMemo(() => {
    // In custom mode: minimum is the schedule date so the user can pick
    // any date in the schedule date → start date window.
    if (
      draft.releaseForMode === 'custom' &&
      requiresProcessFields(draft.releaseAs) &&
      isReleasedOnStatus(draft.requestStatus) &&
      draft.scheduleDate?.trim()
    ) {
      const sk = normalizeScheduleDateToYYYYMMDDKey(draft.scheduleDate);
      const sd = sk ? dateOnlyFromYYYYMMDD(sk) : null;
      if (sd) {
        sd.setHours(0, 0, 0, 0);
        return sd;
      }
    }

    const candidates: Date[] = [];

    // Base: minProcessDate prop (and calculated floor from schedule + release hours).
    const base = new Date(effectiveMinProcessDate);
    base.setHours(0, 0, 0, 0);
    candidates.push(base);

    // When an hour-offset mode is active, process date cannot be before the schedule date.
    if (
      requiresProcessFields(draft.releaseAs) &&
      isReleasedOnStatus(draft.requestStatus) &&
      draft.scheduleDate?.trim() &&
      draft.releaseForMode !== 'custom'
    ) {
      const sk = normalizeScheduleDateToYYYYMMDDKey(draft.scheduleDate);
      const sd = sk ? dateOnlyFromYYYYMMDD(sk) : null;
      if (sd) {
        sd.setHours(0, 0, 0, 0);
        candidates.push(sd);
      }
    }

    return candidates.reduce((max, d) => (d.getTime() > max.getTime() ? d : max));
  }, [
    draft.releaseAs,
    draft.requestStatus,
    draft.scheduleDate,
    draft.releaseForMode,
    effectiveMinProcessDate,
  ]);

  const processTimeMinForPicker = useMemo(() => {
    if (!calculatedProcessFloor?.date || !calculatedProcessFloor.time) return undefined;
    const pd = normalizeScheduleDateToYYYYMMDDKey(draft.processDate);
    const fd = normalizeScheduleDateToYYYYMMDDKey(calculatedProcessFloor.date);
    if (!pd || !fd || pd !== fd) return undefined;
    return ceilTimeToQuarterHour(calculatedProcessFloor.time);
  }, [calculatedProcessFloor, draft.processDate]);

  /** When process date equals release schedule date, process time must be strictly after scheduled time. */
  const processTimeMinAfterScheduleSameDay = useMemo(() => {
    if (!isReleasedOnStatus(draft.requestStatus)) return undefined;
    if (!draft.scheduleDate?.trim() || !draft.scheduledTime?.trim()) return undefined;
    const sch = normalizeScheduleDateToYYYYMMDDKey(draft.scheduleDate);
    const pd = normalizeScheduleDateToYYYYMMDDKey(draft.processDate);
    if (!sch || !pd || sch !== pd) return undefined;
    return quarterHourStrictlyAfterSchedule(draft.scheduledTime);
  }, [draft.requestStatus, draft.scheduleDate, draft.scheduledTime, draft.processDate]);

  const processTimeCombinedMin = useMemo(() => {
    const a = processTimeMinForPicker;
    const b = processTimeMinAfterScheduleSameDay;
    if (!a) return b;
    if (!b) return a;
    const av = formatTimeToHHmm(a) || a;
    const bv = formatTimeToHHmm(b) || b;
    if (!av || !bv) return a || b;
    return av >= bv ? a : b;
  }, [processTimeMinForPicker, processTimeMinAfterScheduleSameDay]);

  const scheduleTimeMinIfToday = useMemo(
    () => scheduleTimeMinIfScheduleDateIsToday(draft.requestStatus, draft.scheduleDate),
    [draft.requestStatus, draft.scheduleDate]
  );

  /** Process date/time are read-only when an hour offset is selected (auto-computed); editable only when Custom. */
  const processFieldsDisabledByReleaseForMode =
    requiresScheduleReleaseHours(draft.requestStatus, draft.releaseAs) && draft.releaseForMode !== 'custom';

  /** Latest selectable process day: cannot exceed the period start date. */
  const processDateMaxDate = useMemo(() => {
    const startRaw = isNone ? boundStartDate : draft.startDate;
    if (!startRaw?.trim()) return undefined;
    const startK = normalizeScheduleDateToYYYYMMDDKey(startRaw);
    if (!startK) return undefined;
    const startD = dateOnlyFromYYYYMMDD(startK);
    if (!startD) return undefined;
    startD.setHours(0, 0, 0, 0);
    return startD;
  }, [isNone, boundStartDate, draft.startDate]);

  const disableProcessDateBeforeEffectiveMin = useCallback(
    (day: Date) => {
      if (startOfLocalDayMs(day) < startOfLocalDayMs(processDateMinDate)) return true;
      if (processDateMaxDate && startOfLocalDayMs(day) > startOfLocalDayMs(processDateMaxDate)) return true;
      return false;
    },
    [processDateMinDate, processDateMaxDate]
  );

  /** Cannot start a new period on a day that already lies inside another schedule. */
  const disableSchedulePeriodStartDay = useCallback(
    (day: Date) => {
      const k = formatDateToYYYYMMDD(day);
      return otherScheduleRanges.some((o) => k >= o.start && k <= o.end);
    },
    [otherScheduleRanges]
  );

  /** Min period start: request lower bound, and (Released On) the release schedule calendar day. */
  const periodStartDateMinForPicker = useMemo((): string | undefined => {
    if (isNone) return undefined;
    const requestMin = (addScheduleStartMinDate || '').trim().slice(0, 10);
    if (isReleasedOnStatus(draft.requestStatus)) {
      const sk = normalizeScheduleDateToYYYYMMDDKey(draft.scheduleDate);
      if (sk) {
        if (!requestMin) return sk;
        return sk >= requestMin ? sk : requestMin;
      }
    }
    return requestMin || undefined;
  }, [isNone, draft.requestStatus, draft.scheduleDate, addScheduleStartMinDate]);

  const shouldDisablePeriodStartDate = useCallback(
    (day: Date) => {
      if (disableSchedulePeriodStartDay(day)) return true;
      if (isNone || !isReleasedOnStatus(draft.requestStatus)) return false;
      const sk = normalizeScheduleDateToYYYYMMDDKey(draft.scheduleDate);
      if (!sk) return false;
      return formatDateToYYYYMMDD(day) < sk;
    },
    [disableSchedulePeriodStartDay, isNone, draft.requestStatus, draft.scheduleDate]
  );

  /** End date is invalid if [schedule start, day] overlaps any other schedule. */
  const disableSchedulePeriodEndDay = useCallback(
    (day: Date) => {
      const endK = formatDateToYYYYMMDD(day);
      const startK = draft.startDate?.trim().slice(0, 10);
      if (!startK) return false;
      if (endK < startK) return true;
      return otherScheduleRanges.some((o) => scheduleRangesOverlap(startK, endK, o.start, o.end));
    },
    [draft.startDate, otherScheduleRanges]
  );

  const commitSave = useCallback(
    (payload: RequestScheduleSavePayload) => {
      if (submitLockRef.current || requestSchedulesLoading) return;
      submitLockRef.current = true;
      onSave(payload);
    },
    [onSave, requestSchedulesLoading]
  );

  const handleSave = useCallback(() => {
    setModalErrors({});

    if (draft.requestStatus === RequestStatus.Completed && completedStatusDisallowed) {
      setModalErrors({ requestStatus: REQUEST.ERRORS.REQUEST_SCHEDULE_COMPLETED_NOT_BEFORE_END });
      return;
    }

    if (isReleasedOnStatus(draft.requestStatus) && releasedOnStatusDisallowed) {
      setModalErrors({ requestStatus: REQUEST.ERRORS.REQUEST_SCHEDULE_RELEASED_ON_PAST_START });
      return;
    }

    if (isReleasedOnStatus(draft.requestStatus) && !draft.scheduleAfter) {
      return;
    }

    if (!isNone) {
      const periodStart = draft.startDate?.trim().slice(0, 10);
      const periodEnd = draft.endDate?.trim().slice(0, 10);
      if (periodStart && periodEnd && periodEnd < periodStart) {
        setModalErrors({ periodEnd: REQUEST.ERRORS.END_DATE_INVALID });
        return;
      }
      if (periodStart && periodEnd) {
        const overlaps = otherScheduleRanges.some((o) =>
          scheduleRangesOverlap(periodStart, periodEnd, o.start, o.end)
        );
        if (overlaps) {
          setModalErrors({
            periodStart: REQUEST.ERRORS.SCHEDULE_RANGE_OVERLAPS,
            periodEnd: REQUEST.ERRORS.SCHEDULE_RANGE_OVERLAPS,
          });
          return;
        }
      }
    }

    const saveDraft = applyScheduleAfterOffsetToDraft(draft);

    const effectiveScheduleProcessTime =
      requiresProcessFields(saveDraft.releaseAs) && (!saveDraft.processTime || !saveDraft.processTime.trim())
        ? '00:00'
        : saveDraft.processTime || null;

    const effectiveScheduleStart = isNone ? boundStartDate?.trim() || null : saveDraft.startDate?.trim() || null;
    const effectiveScheduleEnd = isNone ? boundEndDate?.trim() || null : saveDraft.endDate?.trim() || null;

    const schedulePayload: RequestScheduleSavePayload = {
      startDate: effectiveScheduleStart,
      endDate: effectiveScheduleEnd,
      isActive: saveDraft.isActive,
      releaseAs: saveDraft.releaseAs,
      requestStatus: saveDraft.requestStatus,
      scheduleDate: saveDraft.scheduleDate || null,
      scheduledTime: saveDraft.scheduledTime || null,
      processDate: saveDraft.processDate || null,
      processTime: effectiveScheduleProcessTime,
      releaseHours: requiresScheduleReleaseHours(saveDraft.requestStatus, saveDraft.releaseAs)
        ? saveDraft.releaseForMode === 'custom'
          ? computeCustomReleaseHours(
              saveDraft.scheduleDate ?? '',
              saveDraft.scheduledTime ?? '',
              saveDraft.processDate ?? '',
              effectiveScheduleProcessTime ?? ''
            )
          : saveDraft.releaseHours
        : null,
      preserveOnRegenerate: shouldDefaultPreserveOnRegenerate(saveDraft.requestStatus, saveDraft.releaseAs)
        ? true
        : saveDraft.preserveOnRegenerate,
    };

    if (saveDraft.releaseAs !== originalReleaseAs) {
      const releaseAsLabel =
        RELEASE_AS_OPTIONS.find((option) => option.value === String(saveDraft.releaseAs))?.label ?? '-';
      setPendingReleaseAsChange({
        payload: schedulePayload,
        startDate: effectiveScheduleStart ? formatDateShort(effectiveScheduleStart) : '-',
        endDate: effectiveScheduleEnd ? formatDateShort(effectiveScheduleEnd) : '-',
        releaseAsLabel,
      });
      return;
    }

    commitSave(schedulePayload);
  }, [
    boundEndDate,
    boundStartDate,
    commitSave,
    completedStatusDisallowed,
    releasedOnStatusDisallowed,
    draft,
    isNone,
    originalReleaseAs,
    otherScheduleRanges,
  ]);

  /** Save is disabled instead of showing required / release-for validation errors. */
  const scheduleModalSaveDisabled = useMemo(() => {
    if (isReleasedOnStatus(draft.requestStatus) && !draft.scheduleAfter) return true;
    const d = applyScheduleAfterOffsetToDraft(draft);
    if (requiresProcessFields(draft.releaseAs)) {
      if (!d.processDate?.trim() || !d.processTime?.trim()) return true;
      if (
        isReleasedOnStatus(d.requestStatus) &&
        d.scheduleDate?.trim() &&
        d.scheduledTime?.trim()
      ) {
        const sk = normalizeScheduleDateToYYYYMMDDKey(d.scheduleDate);
        const pk = normalizeScheduleDateToYYYYMMDDKey(d.processDate);
        if (sk && pk && sk === pk) {
          const st = formatTimeToHHmm(d.scheduledTime);
          const pt = formatTimeToHHmm(d.processTime);
          if (st && pt) {
            const schedMs = localDateTimeMs(sk, st);
            const procMs = localDateTimeMs(pk, pt);
            if (schedMs != null && procMs != null && procMs <= schedMs) return true;
          }
        }
      }
    }
    if (isReleasedOnStatus(draft.requestStatus)) {
      if (!d.scheduleDate?.trim() || !d.scheduledTime?.trim()) return true;
      if (draft.scheduleAfter === 'custom') {
        const minSt = scheduleTimeMinIfScheduleDateIsToday(draft.requestStatus, d.scheduleDate ?? '');
        if (minSt) {
          const cur = formatTimeToHHmm(d.scheduledTime);
          if (cur && cur < minSt) return true;
        }
      }
    }
    if (requiresScheduleReleaseHours(draft.requestStatus, draft.releaseAs) && draft.releaseHours == null && draft.releaseForMode !== 'custom') {
      return true;
    }
    const effProcessFloorFromSchedule =
      requiresScheduleReleaseHours(draft.requestStatus, draft.releaseAs) && d.releaseHours != null
        ? addLocalDateTimeHours(d.scheduleDate, d.scheduledTime, d.releaseHours)
        : null;
    if (
      effProcessFloorFromSchedule &&
      requiresProcessFields(draft.releaseAs) &&
      d.processDate?.trim() &&
      d.processTime?.trim()
    ) {
      const pt = formatTimeToHHmm(d.processTime);
      if (pt) {
        const procDay = normalizeScheduleDateToYYYYMMDDKey(d.processDate);
        const procMs = procDay ? localDateTimeMs(procDay, pt) : null;
        const floorDay = normalizeScheduleDateToYYYYMMDDKey(effProcessFloorFromSchedule.date);
        const floorMs = floorDay
          ? localDateTimeMs(
              floorDay,
              formatTimeToHHmm(effProcessFloorFromSchedule.time) || effProcessFloorFromSchedule.time
            )
          : null;
        if (procMs != null && floorMs != null && procMs < floorMs) return true;
      }
    }
    return false;
  }, [draft, releasedOnStatusDisallowed]);

  return (
    <>
      <Modal
        isOpen={open}
        onClose={onClose}
        title={REQUEST.FORM.REQUEST_SCHEDULE}
        size="large"
      >
        <SMSStack spacing={1.5} sx={{ width: '100%' }}>
          <SMSGrid container spacing={1.5} sx={{ width: '100%', m: 0 }}>
            <SMSGrid item xs={12} md={6}>
              <SMSDatePicker
                label={REQUEST.FORM.START_DATE}
                id={FIELD_NAMES.START_DATE}
                value={isNone ? boundStartDate : draft.startDate}
                onChange={(value) => {
                  setDraft((p) => {
                    const startKey = normalizeScheduleDateToYYYYMMDDKey(value);
                    const next: RequestScheduleModalDraft = { ...p, startDate: value };
                    if (!startKey) {
                      return next;
                    }
                    const endKey = normalizeScheduleDateToYYYYMMDDKey(p.endDate);
                    if (endKey && endKey < startKey) {
                      return { ...next, endDate: value };
                    }
                    return next;
                  });
                  setModalErrors((prev) => ({ ...prev, periodStart: undefined, periodEnd: undefined }));
                }}
                placeholder={REQUEST.FORM.START_DATE}
                disabled={isLoading || isNone}
                error={modalErrors.periodStart ?? parentFieldErrors.startDate}
                required
                minDate={isNone ? undefined : periodStartDateMinForPicker}
                maxDate={isNone ? undefined : boundEndDate || undefined}
                shouldDisableDate={isNone ? undefined : shouldDisablePeriodStartDate}
              />
            </SMSGrid>
            <SMSGrid item xs={12} md={6}>
              <SMSDatePicker
                label={REQUEST.FORM.END_DATE}
                id={FIELD_NAMES.END_DATE}
                value={isNone ? boundEndDate : draft.endDate}
                onChange={(value) => {
                  setDraft((p) => ({ ...p, endDate: value }));
                  setModalErrors((prev) => ({
                    ...prev,
                    periodStart: undefined,
                    periodEnd: undefined,
                    requestStatus: undefined,
                  }));
                }}
                placeholder={REQUEST.FORM.END_DATE}
                disabled={isLoading || isNone}
                error={modalErrors.periodEnd ?? parentFieldErrors.endDate}
                required
                minDate={
                  isNone ? undefined : draft.startDate || addScheduleStartMinDate
                }
                maxDate={isNone ? undefined : boundEndDate || undefined}
                shouldDisableDate={isNone ? undefined : disableSchedulePeriodEndDay}
              />
            </SMSGrid>

            <SMSGrid item xs={12}>
              <SMSBox sx={scheduleControlRowGridSx}>
                <SMSBox sx={{ minWidth: 0, width: '100%' }}>
                  <SMSDropdown
                    label={REQUEST.FORM.RELEASE_STATUS}
                    options={releaseStatusDropdownOptions}
                    value={String(draft.requestStatus ?? RequestStatus.Pending)}
                    onChange={(e) => {
                      const next = parseInt(e.target.value as string, 10) as RequestStatus;
                      if (next === RequestStatus.ReleasedOn && releasedOnStatusDisallowed) {
                        return;
                      }
                      if (next === RequestStatus.Completed && completedStatusDisallowed) {
                        return;
                      }
                      setDraft((p) =>
                        withReleaseNowOpenPreserveDefault({
                          ...p,
                          requestStatus: next,
                          ...(next !== RequestStatus.ReleasedOn
                            ? {
                                scheduleDate: '',
                                scheduledTime: '',
                                scheduleAfter: '' as ScheduleAfterMode,
                              }
                            : {}),
                          ...(!requiresScheduleReleaseHours(next, p.releaseAs)
                            ? { releaseHours: null, releaseForMode: '' as ReleaseForMode }
                            : {}),
                        })
                      );
                      setModalErrors((prev) => {
                        const cleared = { ...prev, requestStatus: undefined };
                        if (next !== RequestStatus.ReleasedOn) {
                          return {
                            ...cleared,
                            releaseHours: undefined,
                            scheduleDate: undefined,
                            scheduledTime: undefined,
                          };
                        }
                        return { ...cleared, releaseHours: undefined };
                      });
                    }}
                    placeholder={REQUEST.FORM.RELEASE_STATUS}
                    includePlaceholderOption={false}
                    disabled={isLoading}
                    required
                    name={FIELD_NAMES.RELEASE_STATUS}
                    id={FIELD_NAMES.RELEASE_STATUS}
                    error={
                      Boolean(modalErrors.requestStatus) &&
                      modalErrors.requestStatus !==
                        REQUEST.ERRORS.GENERATE_SCHEDULE_RELEASE_STATUS_DISABLED
                    }
                    helperText={
                      modalErrors.requestStatus ===
                      REQUEST.ERRORS.GENERATE_SCHEDULE_RELEASE_STATUS_DISABLED
                        ? undefined
                        : modalErrors.requestStatus
                    }
                    searchable={false}
                    fullWidth
                  />
                </SMSBox>
                {isReleasedOnStatus(draft.requestStatus) && (
                  <SMSBox sx={{ minWidth: 0, width: '100%' }}>
                    <SMSDropdown
                      options={scheduleAfterDropdownOptions}
                      label={REQUEST.FORM.SCHEDULE_AFTER}
                      value={draft.scheduleAfter}
                      onChange={(e) => {
                        const v = String(e.target.value ?? '') as ScheduleAfterMode;
                        if (v === '') {
                          lastCustomScheduleRef.current = { date: '', time: '' };
                          setDraft((p) => ({
                            ...p,
                            scheduleAfter: '',
                            scheduleDate: '',
                            scheduledTime: '',
                          }));
                          setModalErrors((prev) => ({
                            ...prev,
                            scheduleDate: undefined,
                            scheduledTime: undefined,
                            processDate: undefined,
                            processTime: undefined,
                          }));
                          return;
                        }
                        if (v === 'custom') {
                          setDraft((p) => {
                            const r = lastCustomScheduleRef.current;
                            if (r.date && r.time) {
                              let next: RequestScheduleModalDraft = {
                                ...p,
                                scheduleAfter: 'custom',
                                scheduleDate: r.date,
                                scheduledTime: r.time,
                              };
                              next = withProcessFromSchedulePlusReleaseHours(next);
                              next = clampProcessTimeAfterScheduleSameDay(next);
                              return alignStartDateToScheduleDate(next);
                            }
                            return { ...p, scheduleAfter: 'custom' };
                          });
                          return;
                        }
                        if (isScheduleAfterOffsetMode(v)) {
                          setDraft((p) => {
                            if (p.scheduleAfter === 'custom' && p.scheduleDate?.trim() && p.scheduledTime?.trim()) {
                              const td = p.scheduleDate.trim();
                              const tt = formatTimeToHHmm(p.scheduledTime) || p.scheduledTime;
                              lastCustomScheduleRef.current = { date: td, time: tt };
                            }
                            return applyScheduleAfterOffsetToDraft({ ...p, scheduleAfter: v });
                          });
                          setModalErrors((prev) => ({
                            ...prev,
                            scheduleDate: undefined,
                            scheduledTime: undefined,
                            processDate: undefined,
                            processTime: undefined,
                          }));
                        }
                      }}
                      placeholder={REQUEST.FORM.SCHEDULE_AFTER_PLACEHOLDER}
                      includePlaceholderOption={false}
                      disabled={isLoading}
                      name="scheduleAfter"
                      id="scheduleAfter"
                      searchable={false}
                      fullWidth
                    />
                  </SMSBox>
                )}
                {isReleasedOnStatus(draft.requestStatus) && (
                  <SMSBox sx={{ minWidth: 0, width: '100%' }}>
                    <SMSDatePicker
                      label={REQUEST.FORM.SCHEDULE_DATE}
                      id={FIELD_NAMES.SCHEDULE_DATE}
                      value={draft.scheduleDate}
                      onChange={(value) => {
                        setDraft((p) => {
                          let next = withProcessFromSchedulePlusReleaseHours({ ...p, scheduleDate: value });
                          const minT = scheduleTimeMinIfScheduleDateIsToday(
                            p.requestStatus,
                            value?.trim() ?? ''
                          );
                          if (minT) {
                            const cur = formatTimeToHHmm(next.scheduledTime);
                            if (cur && cur < minT) next = { ...next, scheduledTime: minT };
                          }
                          next = clampProcessTimeAfterScheduleSameDay(next);
                          return alignStartDateToScheduleDate(next);
                        });
                        if (value && modalErrors.scheduleDate) {
                          setModalErrors((prev) => ({ ...prev, scheduleDate: undefined }));
                        }
                        setModalErrors((prev) => ({ ...prev, processDate: undefined, processTime: undefined }));
                      }}
                      placeholder={REQUEST.FORM.SCHEDULE_DATE}
                      disabled={scheduleDateTimeFieldDisabled}
                      name={FIELD_NAMES.SCHEDULE_DATE}
                      error={modalErrors.scheduleDate}
                      minDate={scheduleReleaseDateMinDate}
                      maxDate={scheduleDateMaxDate}
                      shouldDisableDate={shouldDisableReleaseScheduleDate}
                    />
                  </SMSBox>
                )}
                {isReleasedOnStatus(draft.requestStatus) && (
                  <SMSBox sx={{ minWidth: 0, width: '100%' }}>
                    <SMSTimePicker
                      label={REQUEST.FORM.SCHEDULE_TIME}
                      value={formatTimeToHHmm(draft.scheduledTime)}
                      onChange={(value) => {
                        setDraft((p) => {
                          let t = value || '';
                          const minT = scheduleTimeMinIfScheduleDateIsToday(p.requestStatus, p.scheduleDate);
                          if (minT && t) {
                            const vt = formatTimeToHHmm(t);
                            const m = formatTimeToHHmm(minT) || minT;
                            if (vt && m && vt < m) t = m;
                          }
                          return clampProcessTimeAfterScheduleSameDay(
                            withProcessFromSchedulePlusReleaseHours({ ...p, scheduledTime: t })
                          );
                        });
                        if (value && modalErrors.scheduledTime) {
                          setModalErrors((prev) => ({ ...prev, scheduledTime: undefined }));
                        }
                        setModalErrors((prev) => ({ ...prev, processDate: undefined, processTime: undefined }));
                      }}
                      placeholder={REQUEST.FORM.SCHEDULE_TIME}
                      disabled={scheduleDateTimeFieldDisabled}
                      name={FIELD_NAMES.SCHEDULE_TIME}
                      id={FIELD_NAMES.SCHEDULE_TIME}
                      error={modalErrors.scheduledTime}
                      min={
                        draft.scheduleAfter === 'custom' && releasedOn ? scheduleTimeMinIfToday : undefined
                      }
                      fullWidth
                    />
                  </SMSBox>
                )}
                <SMSBox sx={{ minWidth: 0, width: '100%' }}>
                  <SMSDropdown
                    label={REQUEST.FORM.RELEASE_AS}
                    options={releaseAsDropdownOptionsEffective}
                    value={String(draft.releaseAs ?? ReleaseAs.Open)}
                    onChange={(e) => {
                      const nextRa = parseInt(e.target.value as string, 10) as ReleaseAs;
                      setDraft((p) =>
                        withReleaseNowOpenPreserveDefault({
                          ...p,
                          releaseAs: nextRa,
                          ...(!requiresScheduleReleaseHours(p.requestStatus, nextRa)
                            ? { releaseHours: null, releaseForMode: '' as ReleaseForMode }
                            : {}),
                        })
                      );
                      if (nextRa !== ReleaseAs.TenureBased) {
                        setModalErrors((prev) => ({ ...prev, releaseHours: undefined }));
                      }
                    }}
                    placeholder={REQUEST.FORM.RELEASE_AS}
                    includePlaceholderOption={false}
                    disabled={isLoading || !isReleaseAsEditable}
                    name={FIELD_NAMES.RELEASE_AS}
                    id={FIELD_NAMES.RELEASE_AS}
                    fullWidth
                  />
                </SMSBox>
              </SMSBox>
            </SMSGrid>
            <SMSGrid item xs={12}>
              <SMSCheckbox
                label={REQUEST.FORM.SCHEDULE_PRESERVE_ON_REGENERATE}
                checked={preserveOnRegenerateLocked ? true : draft.preserveOnRegenerate}
                onChange={(checked) =>
                  setDraft((p) => ({ ...p, preserveOnRegenerate: checked }))
                }
                disabled={isLoading || preserveOnRegenerateLocked}
              />
            </SMSGrid>
            {requiresScheduleReleaseHours(draft.requestStatus, draft.releaseAs) && (
              <SMSGrid item xs={12} sm={12} md={8}>
                <SMSStack spacing={1} sx={{ width: '100%' }}>
                  <SMSStack
                    direction="row"
                    spacing={2}
                    alignItems="center"
                    flexWrap="wrap"
                    useFlexGap
                    sx={{ width: '100%' }}
                  >
                    <SMSTypography
                      variant="body1"
                      component="span"
                      sx={{
                        flexShrink: 0,
                        color: 'text.primary',
                        fontWeight: 500,
                        fontSize: '1.0625rem',
                      }}
                    >
                      {REQUEST.FORM.RELEASE_FOR}
                    </SMSTypography>
                    <SMSBox
                      sx={{
                        flex: '0 1 auto',
                        minWidth: { xs: '100%', sm: 200 },
                        width: { xs: '100%', sm: 'auto' },
                        maxWidth: { sm: 360 },
                      }}
                    >
                      <SMSDropdown
                        options={releaseForDropdownOptions}
                        value={draft.releaseForMode}
                        onChange={(e) => {
                          const v = String(e.target.value ?? '') as ReleaseForMode;
                          if (!v) {
                            setDraft((p) => ({ ...p, releaseForMode: '', releaseHours: null, processDate: '', processTime: '' }));
                            return;
                          }
                          if (v === 'custom') {
                            setDraft((p) => ({ ...p, releaseForMode: 'custom', releaseHours: null }));
                            setModalErrors((prev) => ({ ...prev, releaseHours: undefined }));
                            return;
                          }
                          const n = parseInt(v, 10);
                          if (n === 1 || n === 24 || n === 48 || n === 72) {
                            setDraft((p) =>
                              withProcessFromSchedulePlusReleaseHours({
                                ...p,
                                releaseForMode: v,
                                releaseHours: n as ScheduleReleaseHours,
                              })
                            );
                            setModalErrors((prev) => ({
                              ...prev,
                              releaseHours: undefined,
                              processDate: undefined,
                              processTime: undefined,
                            }));
                          }
                        }}
                        placeholder={REQUEST.FORM.RELEASE_FOR_PLACEHOLDER}
                        includePlaceholderOption={false}
                        disabled={isLoading || !draft.scheduleDate?.trim()}
                        searchable={false}
                        error={Boolean(modalErrors.releaseHours)}
                        fullWidth
                      />
                    </SMSBox>
                    <SMSTypography
                      variant="body1"
                      component="span"
                      color="text.primary"
                      sx={{
                        flexShrink: 0,
                        minWidth: { xs: '100%', sm: 'auto' },
                        fontSize: '1.0625rem',
                        fontWeight: 500,
                      }}
                    >
                      {draft.releaseForMode !== 'custom' ? REQUEST.FORM.SCHEDULE_RELEASE_FROM_SCHEDULED_TIME : ''}
                    </SMSTypography>
                  </SMSStack>
                  {modalErrors.releaseHours && (
                    <SMSTypography variant="caption" color="error" sx={{ display: 'block' }}>
                      {modalErrors.releaseHours}
                    </SMSTypography>
                  )}
                </SMSStack>
              </SMSGrid>
            )}
            {requiresProcessFields(draft.releaseAs) && (
              <>
                <SMSGrid item xs={12} sm={6}>
                  <SMSDatePicker
                    label={REQUEST.FORM.TENURE_START_DATE}
                    id={FIELD_NAMES.TENURE_START_DATE}
                    value={draft.processDate || ''}
                    onChange={(value) => {
                      setDraft((p) => {
                        const next = { ...p, processDate: value };
                        const vk = normalizeScheduleDateToYYYYMMDDKey(value);
                        const mins: string[] = [];
                        const floor = calculatedProcessFloor;
                        if (floor?.date && vk && vk === normalizeScheduleDateToYYYYMMDDKey(floor.date)) {
                          mins.push(ceilTimeToQuarterHour(floor.time));
                        }
                        if (
                          isReleasedOnStatus(p.requestStatus) &&
                          p.scheduleDate?.trim() &&
                          p.scheduledTime?.trim() &&
                          vk &&
                          vk === normalizeScheduleDateToYYYYMMDDKey(p.scheduleDate)
                        ) {
                          mins.push(quarterHourStrictlyAfterSchedule(p.scheduledTime));
                        }
                        const minT =
                          mins.length > 0
                            ? mins.reduce((a, b) =>
                                (formatTimeToHHmm(a) || a) >= (formatTimeToHHmm(b) || b) ? a : b
                              )
                            : undefined;
                        if (minT) {
                          const cur = formatTimeToHHmm(p.processTime);
                          const m = formatTimeToHHmm(minT) || minT;
                          if (cur && cur < m) next.processTime = minT;
                        }
                        return next;
                      });
                    }}
                    placeholder={REQUEST.FORM.TENURE_START_DATE}
                    disabled={isLoading || processFieldsDisabledByReleaseForMode}
                    name={FIELD_NAMES.TENURE_START_DATE}
                    error={modalErrors.processDate}
                    minDate={processDateMinDate}
                    maxDate={processDateMaxDate}
                    shouldDisableDate={disableProcessDateBeforeEffectiveMin}
                  />
                </SMSGrid>
                <SMSGrid item xs={12} sm={6}>
                  <SMSTimePicker
                    label={REQUEST.FORM.TENURE_START_TIME}
                    value={draft.processTime || ''}
                    onChange={(value) => {
                      setDraft((p) => {
                        let t = value || '';
                        const minT = processTimeCombinedMin;
                        if (minT && t) {
                          const v = formatTimeToHHmm(t);
                          const m = formatTimeToHHmm(minT) || minT;
                          if (v && m && v < m) t = m;
                        }
                        return { ...p, processTime: t };
                      });
                    }}
                    placeholder={REQUEST.FORM.TENURE_START_TIME}
                    disabled={isLoading || processFieldsDisabledByReleaseForMode}
                    name={FIELD_NAMES.TENURE_START_TIME}
                    id={FIELD_NAMES.TENURE_START_TIME}
                    error={modalErrors.processTime}
                    min={processTimeCombinedMin}
                    fullWidth
                  />
                </SMSGrid>
              </>
            )}
          </SMSGrid>

          <SMSBox sx={{ display: 'flex', justifyContent: 'flex-end', pt: 1 }}>
            <SMSStack direction="row" spacing={1} justifyContent="flex-end">
              <SMSButton variant="outlined" color="primary" type="button" onClick={onClose}>
                {REQUEST.FORM.CANCEL_BUTTON}
              </SMSButton>
              <SMSButton
                variant="outlined"
                color="primary"
                type="button"
                disabled={isLoading || isReleaseAsEditable}
                onClick={() => setIsReleaseAsEditable(true)}
              >
                {REQUEST.FORM.UPDATE_RELEASE_AS}
              </SMSButton>
              <SMSButton
                variant="contained"
                color="primary"
                type="button"
                disabled={requestSchedulesLoading || scheduleModalSaveDisabled}
                onClick={handleSave}
              >
                {isEditing
                  ? REQUEST.FORM.UPDATE_REQUEST_SCHEDULE
                  : REQUEST.FORM.SAVE_REQUEST_SCHEDULE}
              </SMSButton>
            </SMSStack>
          </SMSBox>
        </SMSStack>
      </Modal>

      <SMSConfirmDialog
        open={!!pendingReleaseAsChange}
        onClose={() => setPendingReleaseAsChange(null)}
        onConfirm={() => {
          if (!pendingReleaseAsChange) return;
          const { payload } = pendingReleaseAsChange;
          setPendingReleaseAsChange(null);
          commitSave(payload);
        }}
        title={REQUEST.FORM.CONFIRM_RELEASE_AS_CHANGE_TITLE}
        message={releaseAsChangeConfirmationMessage}
        confirmText={REQUEST.FORM.CONFIRM_RELEASE_AS_CHANGE_CONFIRM_BUTTON}
        cancelText={REQUEST.FORM.CONFIRM_RELEASE_AS_CHANGE_CANCEL_BUTTON}
        variant="warning"
      />
    </>
  );
};
