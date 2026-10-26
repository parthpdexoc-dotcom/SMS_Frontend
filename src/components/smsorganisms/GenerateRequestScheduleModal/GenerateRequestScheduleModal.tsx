import React, { useEffect, useMemo, useState } from 'react';
import {
  SMSBox,
  SMSButton,
  SMSDatePicker,
  SMSDropdown,
  SMSIcon,
  SMSStack,
  SMSTimePicker,
  SMSTypography,
} from '@/components/smsatoms';
import { SMSModal } from '@/components/smsorganisms';
import { SHORT_WEEKDAYS } from '@/components/smsorganisms/SMSRequestForm/Recurrence/WeekdayChips';
import { MonthDayCalendar } from '@/components/smsorganisms/SMSRequestForm/Recurrence/MonthDayCalendar';
import { RELEASE_AS_OPTIONS } from '@/components/smsorganisms/SMSRequestForm/SMSRequestScheduleModal';
import { REQUEST } from '@/constants/strings';
import { getRequestScheduleGenerationByRequestId } from '@/services/requestScheduleService';
import { MonthlyMode } from '@/types/recurrence';
import { ReleaseAs, RequestTypes } from '@/types/request';
import { formatDateShort } from '@/utils';
import {
  extractYyyyMmDdPrefix,
  formatDateToYYYYMMDD,
  formatTimeToHHmm,
  getLocalTodayYyyyMmDd,
} from '@/utils/dateTimeUtils';
import {
  getFeasibleReleaseBeforeDays,
  getFeasibleReleaseHours,
  resolveMonthlyTenureProcessPreview,
  resolveTenureFeasibilityAnchorYmd,
  resolveWeeklyTenureProcessPreview,
} from '@/utils/tenureGenerateFeasibility';
import '@/components/smsorganisms/SMSRequestForm/Recurrence/RecurrenceSection.css';
import './GenerateRequestScheduleModal.css';

const WEEK_INDEX_OPTIONS = [
  { value: '1', label: 'First' },
  { value: '2', label: 'Second' },
  { value: '3', label: 'Third' },
  { value: '4', label: 'Fourth' },
  { value: '5', label: 'Last' },
];

type TenureSelectOption = { value: string; label: string; disabled?: boolean };

const WEEKDAY_OPTIONS: TenureSelectOption[] = SHORT_WEEKDAYS.map((d) => ({
  value: String(d.value),
  label: d.label,
}));

const TENURE_RELEASE_FOR_OPTIONS: TenureSelectOption[] = [
  { value: '1', label: REQUEST.FORM.SCHEDULE_RELEASE_1_HOUR },
  { value: '24', label: REQUEST.FORM.SCHEDULE_RELEASE_24_HOUR },
  { value: '48', label: REQUEST.FORM.SCHEDULE_RELEASE_48_HOUR },
  { value: '72', label: REQUEST.FORM.SCHEDULE_RELEASE_72_HOUR },
];

const REQUEST_TYPE_LABELS: Record<number, string> = {
  [RequestTypes.OneTime]: 'Does not repeat',
  [RequestTypes.Daily]: 'Every day',
  [RequestTypes.Weekly]: 'Every week',
  [RequestTypes.Monthly]: 'Every month',
  [RequestTypes.Custom]: 'Custom...',
};

function resolveRequestType(value: RequestTypes | string | null | undefined): RequestTypes | null {
  if (value == null) return null;
  if (typeof value === 'number') return value as RequestTypes;
  switch (String(value).toUpperCase()) {
    case 'DAY':
    case String(RequestTypes.Daily):
      return RequestTypes.Daily;
    case 'WEEK':
    case String(RequestTypes.Weekly):
      return RequestTypes.Weekly;
    case 'MONTH':
    case String(RequestTypes.Monthly):
      return RequestTypes.Monthly;
    case 'CUSTOM':
    case String(RequestTypes.Custom):
      return RequestTypes.Custom;
    case 'NONE':
    case String(RequestTypes.OneTime):
      return RequestTypes.OneTime;
    default:
      return null;
  }
}

export interface GenerateRequestSchedulePayload {
  daysOfWeek?: number[];
  daysOfMonth?: number[];
  monthlyMode?: MonthlyMode;
  weekIndex?: number;
  /** HH:mm schedule time for each generated Released On row. */
  scheduledTime?: string;
  /** Tenure Available for hours. Custom is not offered. */
  releaseHours?: number;
}

export interface GenerateRequestScheduleModalProps {
  open: boolean;
  onClose: () => void;
  onGenerate: (payload: GenerateRequestSchedulePayload) => void | Promise<void>;
  requestType: RequestTypes | string | null | undefined;
  releaseAs?: ReleaseAs | null;
  startDate?: string;
  endDate?: string;
  initialDaysOfWeek?: number[];
  initialDaysOfMonth?: number[];
  initialMonthlyMode?: MonthlyMode | null;
  initialWeekIndex?: number | null;
  /** When set, the saved generation row for this request is bound into the form. */
  requestId?: string | null;
  /** Request work days (recurrence). The offer day is chosen separately in this modal. */
  workDaysOfWeek?: number[];
  /** Department week start. 0 = Sunday. */
  weekStartsOn?: number;
  isLoading?: boolean;
}

export const GenerateRequestScheduleModal: React.FC<GenerateRequestScheduleModalProps> = ({
  open,
  onClose,
  onGenerate,
  requestType,
  releaseAs = ReleaseAs.Open,
  startDate = '',
  endDate = '',
  initialDaysOfWeek = [],
  initialDaysOfMonth = [],
  initialMonthlyMode = MonthlyMode.BY_DATE,
  initialWeekIndex = 1,
  requestId,
  workDaysOfWeek = [],
  weekStartsOn = 0,
  isLoading = false,
}) => {
  const [error, setError] = useState<string | undefined>();
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [daysOfMonth, setDaysOfMonth] = useState<number[]>([1]);
  const [monthlyMode, setMonthlyMode] = useState<MonthlyMode>(MonthlyMode.BY_DATE);
  const [weekIndex, setWeekIndex] = useState(1);
  const [scheduledTime, setScheduledTime] = useState('');
  const [releaseForMode, setReleaseForMode] = useState('');
  const isTenure = releaseAs === ReleaseAs.TenureBased;

  const resolvedRequestType = useMemo(() => resolveRequestType(requestType), [requestType]);
  const isWeekly = resolvedRequestType === RequestTypes.Weekly;
  const isMonthly = resolvedRequestType === RequestTypes.Monthly;
  const showPattern = isWeekly || isMonthly;

  const displayRequestType =
    resolvedRequestType != null ? REQUEST_TYPE_LABELS[resolvedRequestType] ?? '-' : '-';
  const displayReleaseAs =
    RELEASE_AS_OPTIONS.find((o) => o.value === String(releaseAs ?? ReleaseAs.Open))?.label ?? '-';
  const displayStartDate = startDate ? formatDateShort(startDate) || '-' : '-';
  const displayEndDate = endDate ? formatDateShort(endDate) || '-' : '-';
  const todayYmd = getLocalTodayYyyyMmDd();
  const startDateYmd = extractYyyyMmDdPrefix(startDate);
  const isStartDatePast = Boolean(startDateYmd && startDateYmd < todayYmd);
  const pastStartNote = isStartDatePast
    ? REQUEST.FORM.GENERATE_SCHEDULE_PAST_START_ACTIVE.replace(
        '{today}',
        formatDateShort(todayYmd) || todayYmd
      )
    : REQUEST.FORM.GENERATE_SCHEDULE_PAST_START_NOTE;

  const detailItems = [
    { label: REQUEST.FORM.REQUEST_TYPE, value: displayRequestType },
    { label: REQUEST.FORM.START_DATE, value: displayStartDate },
    { label: REQUEST.FORM.END_DATE, value: displayEndDate },
    { label: REQUEST.FORM.RELEASE_AS, value: displayReleaseAs },
  ];

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const apply = (
      daysOfWeek: number[],
      daysOfMonth: number[],
      monthlyMode: MonthlyMode | null | undefined,
      weekIndex: number | null | undefined,
      scheduledTime: string | null | undefined
    ) => {
      setError(undefined);
      setDaysOfWeek(daysOfWeek.length > 0 ? [daysOfWeek[0]!] : []);
      setDaysOfMonth(daysOfMonth.length > 0 ? [...daysOfMonth] : [1]);
      setMonthlyMode(monthlyMode ?? MonthlyMode.BY_DATE);
      setWeekIndex(weekIndex != null && weekIndex >= 1 ? weekIndex : 1);
      setScheduledTime(formatTimeToHHmm(scheduledTime) || '');
    };

    apply(initialDaysOfWeek, initialDaysOfMonth, initialMonthlyMode, initialWeekIndex, '');

    const id = requestId?.trim();
    if (!id) return;

    void getRequestScheduleGenerationByRequestId(id)
      .then((row) => {
        if (cancelled || !row) return;
        const modeValue = row.releaseBeforeMonthlyMode;
        const monthlyMode =
          modeValue === MonthlyMode.BY_PATTERN ||
          modeValue === 2 ||
          String(modeValue).toLowerCase() === 'bypattern'
            ? MonthlyMode.BY_PATTERN
            : MonthlyMode.BY_DATE;
        apply(
          row.releaseBeforeDaysOfWeek ?? [],
          row.releaseBeforeDaysOfMonth ?? [],
          monthlyMode,
          row.releaseBeforeWeekIndex,
          row.scheduledTime
        );
      })
      .catch(() => {
        // Keep the request-form defaults when no generation row exists yet.
      });

    return () => {
      cancelled = true;
    };
  }, [open, requestId, initialDaysOfWeek, initialDaysOfMonth, initialMonthlyMode, initialWeekIndex]);

  const releaseHours = releaseForMode === '1' || releaseForMode === '24' || releaseForMode === '48' || releaseForMode === '72'
    ? Number(releaseForMode)
    : null;

  const tenureAnchorYmd = useMemo(() => resolveTenureFeasibilityAnchorYmd(startDate), [startDate]);
  const scheduleTimeHhMm = formatTimeToHHmm(scheduledTime);

  const releaseWeekdayOptions = useMemo(() => {
    if (!isTenure || !isWeekly || !scheduleTimeHhMm || releaseHours == null) {
      return WEEKDAY_OPTIONS;
    }
    const feasible = new Set(
      getFeasibleReleaseBeforeDays(
        workDaysOfWeek,
        weekStartsOn,
        scheduleTimeHhMm,
        releaseHours,
        tenureAnchorYmd
      )
    );
    return WEEKDAY_OPTIONS.map((option) => ({
      ...option,
      disabled: !feasible.has(Number(option.value)),
    }));
  }, [isTenure, isWeekly, scheduleTimeHhMm, releaseHours, workDaysOfWeek, weekStartsOn, tenureAnchorYmd]);

  const tenureReleaseForOptions = useMemo(() => {
    if (!isTenure || !isWeekly || !scheduleTimeHhMm || daysOfWeek.length === 0) {
      return TENURE_RELEASE_FOR_OPTIONS;
    }
    const feasible = new Set(
      getFeasibleReleaseHours(
        workDaysOfWeek,
        weekStartsOn,
        daysOfWeek[0]!,
        scheduleTimeHhMm,
        tenureAnchorYmd
      )
    );
    return TENURE_RELEASE_FOR_OPTIONS.map((option) => ({
      ...option,
      disabled: !feasible.has(Number(option.value)),
    }));
  }, [
    isTenure,
    isWeekly,
    scheduleTimeHhMm,
    daysOfWeek,
    workDaysOfWeek,
    weekStartsOn,
    tenureAnchorYmd,
  ]);

  useEffect(() => {
    if (!open || !isTenure || !isWeekly) return;
    const enabledDays = releaseWeekdayOptions.filter((option) => !option.disabled);
    if (enabledDays.length === 0) return;
    const current = daysOfWeek[0];
    const currentDisabled = releaseWeekdayOptions.some(
      (option) => Number(option.value) === current && option.disabled
    );
    if (current == null || currentDisabled) {
      setDaysOfWeek([Number(enabledDays[0]!.value)]);
    }
  }, [open, isTenure, isWeekly, releaseWeekdayOptions, daysOfWeek]);

  useEffect(() => {
    if (!open || !isTenure || !isWeekly) return;
    const enabledHours = tenureReleaseForOptions.filter((option) => !option.disabled);
    if (enabledHours.length === 0) return;
    const currentDisabled = tenureReleaseForOptions.some(
      (option) => option.value === releaseForMode && option.disabled
    );
    if (!releaseForMode || currentDisabled) {
      setReleaseForMode(enabledHours[0]!.value);
    }
  }, [open, isTenure, isWeekly, tenureReleaseForOptions, releaseForMode]);

  useEffect(() => {
    if (!open || !isTenure || !isMonthly || releaseForMode) return;
    setReleaseForMode(TENURE_RELEASE_FOR_OPTIONS[0]!.value);
  }, [open, isTenure, isMonthly, releaseForMode]);

  const processPreview = useMemo(() => {
    if (!isTenure || releaseHours == null || !scheduleTimeHhMm) return null;
    if (isWeekly && daysOfWeek.length > 0) {
      return resolveWeeklyTenureProcessPreview(
        startDate,
        workDaysOfWeek,
        weekStartsOn,
        daysOfWeek[0]!,
        scheduleTimeHhMm,
        releaseHours
      );
    }
    if (isMonthly) {
      if (monthlyMode === MonthlyMode.BY_DATE && (daysOfMonth[0] ?? 0) >= 1) {
        return resolveMonthlyTenureProcessPreview(
          startDate,
          monthlyMode,
          daysOfMonth,
          weekIndex,
          daysOfWeek,
          scheduleTimeHhMm,
          releaseHours
        );
      }
      if (monthlyMode === MonthlyMode.BY_PATTERN && daysOfWeek.length > 0 && weekIndex >= 1) {
        return resolveMonthlyTenureProcessPreview(
          startDate,
          monthlyMode,
          daysOfMonth,
          weekIndex,
          daysOfWeek,
          scheduleTimeHhMm,
          releaseHours
        );
      }
    }
    return null;
  }, [
    isTenure,
    isWeekly,
    isMonthly,
    releaseHours,
    scheduleTimeHhMm,
    startDate,
    workDaysOfWeek,
    weekStartsOn,
    daysOfWeek,
    monthlyMode,
    daysOfMonth,
    weekIndex,
  ]);

  const hasFeasibleTenurePattern = useMemo(() => {
    if (!isTenure || !isWeekly) return true;
    if (!scheduleTimeHhMm || releaseHours == null) return false;
    return (
      releaseWeekdayOptions.some((option) => !option.disabled) &&
      tenureReleaseForOptions.some((option) => !option.disabled)
    );
  }, [
    isTenure,
    isWeekly,
    scheduleTimeHhMm,
    releaseHours,
    releaseWeekdayOptions,
    tenureReleaseForOptions,
  ]);

  const canSubmit = useMemo(() => {
    if (!formatTimeToHHmm(scheduledTime)) return false;
    if (isTenure && releaseHours == null) return false;
    if (isTenure && !hasFeasibleTenurePattern) return false;
    if (isWeekly) return daysOfWeek.length > 0;
    if (isMonthly) {
      if (monthlyMode === MonthlyMode.BY_DATE) return (daysOfMonth[0] ?? 0) >= 1;
      return daysOfWeek.length > 0 && weekIndex >= 1;
    }
    return true;
  }, [
    isWeekly,
    isMonthly,
    isTenure,
    hasFeasibleTenurePattern,
    releaseHours,
    daysOfWeek,
    daysOfMonth,
    monthlyMode,
    weekIndex,
    scheduledTime,
  ]);

  const handleGenerate = async () => {
    setError(undefined);
    const time = formatTimeToHHmm(scheduledTime);
    if (!time) {
      setError(REQUEST.ERRORS.SCHEDULE_TIME_REQUIRED);
      return;
    }
    if (isTenure && releaseHours == null) {
      setError(REQUEST.ERRORS.SCHEDULE_RELEASE_HOURS_REQUIRED);
      return;
    }
    if (isWeekly && daysOfWeek.length === 0) {
      setError(REQUEST.ERRORS.GENERATE_SCHEDULE_DAYS_REQUIRED);
      return;
    }
    if (isMonthly) {
      if (monthlyMode === MonthlyMode.BY_DATE && !(daysOfMonth[0] >= 1 && daysOfMonth[0] <= 31)) {
        setError(REQUEST.ERRORS.GENERATE_SCHEDULE_DAYS_REQUIRED);
        return;
      }
      if (monthlyMode === MonthlyMode.BY_PATTERN && daysOfWeek.length === 0) {
        setError(REQUEST.ERRORS.GENERATE_SCHEDULE_DAYS_REQUIRED);
        return;
      }
    }

    const payload: GenerateRequestSchedulePayload = {
      scheduledTime: time,
      ...(isTenure && releaseHours != null ? { releaseHours } : {}),
    };
    if (isWeekly) {
      payload.daysOfWeek = daysOfWeek;
    } else if (isMonthly) {
      payload.monthlyMode = monthlyMode;
      if (monthlyMode === MonthlyMode.BY_DATE) {
        payload.daysOfMonth = [daysOfMonth[0] ?? 1];
      } else {
        payload.daysOfWeek = daysOfWeek;
        payload.weekIndex = weekIndex;
      }
    }

    await onGenerate(payload);
  };

  return (
    <>
    <SMSModal
      isOpen={open}
      onClose={onClose}
      title={REQUEST.FORM.GENERATE_REQUEST_SCHEDULE}
      size="md"
    >
      <SMSStack spacing={2} className="generate-schedule-modal" sx={{ width: '100%', pt: 0.5 }}>
        <SMSBox className="generate-schedule-modal__section">
          <SMSBox className="generate-schedule-modal__section-header">
            <SMSIcon name="document" size="sm" />
            <span>{REQUEST.FORM.GENERATE_REQUEST_DETAILS}</span>
          </SMSBox>
          <SMSBox className="generate-schedule-modal__section-body">
            <SMSBox className="generate-schedule-modal__details-row">
              {detailItems.map((item) => (
                <SMSBox key={item.label} className="generate-schedule-modal__detail">
                  <span className="generate-schedule-modal__detail-label">{item.label}</span>
                  <span className="generate-schedule-modal__detail-value">{item.value}</span>
                </SMSBox>
              ))}
            </SMSBox>
            <SMSBox
              className={`generate-schedule-modal__note${
                isStartDatePast ? ' generate-schedule-modal__note--active' : ''
              }`}
              role="note"
            >
              {pastStartNote}
            </SMSBox>
          </SMSBox>
        </SMSBox>

        {showPattern && (
          <SMSBox className="generate-schedule-modal__section">
            <SMSBox className="generate-schedule-modal__section-header">
              <SMSIcon name="calendar" size="sm" />
              <span>{REQUEST.FORM.GENERATE_SCHEDULE_PATTERN}</span>
            </SMSBox>
            <SMSBox className="generate-schedule-modal__section-body generate-schedule-modal__pattern-body">
              {isWeekly ? (
                <SMSBox className="generate-schedule-modal__pattern-row--weekly">
                  <SMSBox className="generate-schedule-modal__pattern-day">
                    <span className="generate-schedule-modal__pattern-label">
                      {REQUEST.FORM.RELEASE_BEFORE_DAY}
                    </span>
                    <label className="recurrence-radio-row">
                      <span className="radio-label-text">On</span>
                      <div className="recurrence-radio-dropdown-wrapper">
                        <SMSDropdown
                          options={releaseWeekdayOptions}
                          value={daysOfWeek.length > 0 ? String(daysOfWeek[0]) : ''}
                          onChange={(e) => setDaysOfWeek([Number(e.target.value)])}
                          placeholder="Day"
                        />
                      </div>
                      <span className="radio-label-text">day</span>
                    </label>
                  </SMSBox>
                  <SMSBox className="generate-schedule-modal__time">
                    <span className="generate-schedule-modal__time-label">
                      {REQUEST.FORM.SCHEDULE_TIME}
                      <SMSTypography component="span" color="error" sx={{ ml: 0.25 }}>
                        *
                      </SMSTypography>
                    </span>
                    <SMSTimePicker
                      value={formatTimeToHHmm(scheduledTime)}
                      onChange={(value) => {
                        setScheduledTime(value || '');
                        if (value && error === REQUEST.ERRORS.SCHEDULE_TIME_REQUIRED) {
                          setError(undefined);
                        }
                      }}
                      placeholder={REQUEST.FORM.SCHEDULE_TIME}
                      disabled={isLoading}
                      fullWidth
                      required
                    />
                  </SMSBox>
                </SMSBox>
              ) : (
                <>
                  <span className="generate-schedule-modal__pattern-label">
                    {REQUEST.FORM.RELEASE_BEFORE_DAY}
                  </span>
                  <SMSBox className="recurrence-options-container">
                    <div className="generate-schedule-modal__pattern-options">
                      <label className="recurrence-radio-row">
                        <input
                          type="radio"
                          name="generateSchedulePattern"
                          checked={monthlyMode === MonthlyMode.BY_DATE}
                          onChange={() => {
                            setMonthlyMode(MonthlyMode.BY_DATE);
                            setDaysOfWeek([]);
                          }}
                        />
                        <span className="radio-label-text">On</span>
                        <div
                          className="recurrence-radio-input-wrapper"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MonthDayCalendar
                            selectedDay={daysOfMonth[0] ?? 1}
                            onChange={(day) => setDaysOfMonth([day])}
                            disabled={monthlyMode !== MonthlyMode.BY_DATE}
                          />
                        </div>
                        <span className="radio-label-text">day of the month</span>
                      </label>

                      <label className="recurrence-radio-row">
                        <input
                          type="radio"
                          name="generateSchedulePattern"
                          checked={monthlyMode === MonthlyMode.BY_PATTERN}
                          onChange={() => {
                            setMonthlyMode(MonthlyMode.BY_PATTERN);
                            setDaysOfMonth([]);
                            if (weekIndex == null) setWeekIndex(1);
                            if (daysOfWeek.length === 0) setDaysOfWeek([0]);
                          }}
                        />
                        <span className="radio-label-text">On the</span>
                        <div className="recurrence-radio-dropdown-wrapper">
                          <SMSDropdown
                            options={WEEK_INDEX_OPTIONS}
                            value={String(weekIndex ?? 1)}
                            onChange={(e) => setWeekIndex(Number(e.target.value))}
                            disabled={monthlyMode === MonthlyMode.BY_DATE}
                          />
                        </div>
                        <div className="recurrence-radio-dropdown-wrapper">
                          <SMSDropdown
                            options={WEEKDAY_OPTIONS}
                            value={daysOfWeek.length > 0 ? String(daysOfWeek[0]) : ''}
                            onChange={(e) => setDaysOfWeek([Number(e.target.value)])}
                            disabled={monthlyMode === MonthlyMode.BY_DATE}
                            placeholder="Day"
                          />
                        </div>
                        <span className="radio-label-text">day</span>
                      </label>
                    </div>
                    {monthlyMode === MonthlyMode.BY_DATE && (daysOfMonth[0] ?? 1) >= 29 && (
                      <p className="month-day-end-note">
                        {REQUEST.FORM.GENERATE_SCHEDULE_MONTH_DAY_NOTE}
                      </p>
                    )}
                  </SMSBox>

                  <SMSBox className="generate-schedule-modal__pattern-time-row">
                    <span className="generate-schedule-modal__time-label">
                      {REQUEST.FORM.SCHEDULE_TIME}
                      <SMSTypography component="span" color="error" sx={{ ml: 0.25 }}>
                        *
                      </SMSTypography>
                    </span>
                    <SMSBox className="generate-schedule-modal__time">
                      <SMSTimePicker
                        value={formatTimeToHHmm(scheduledTime)}
                        onChange={(value) => {
                          setScheduledTime(value || '');
                          if (value && error === REQUEST.ERRORS.SCHEDULE_TIME_REQUIRED) {
                            setError(undefined);
                          }
                        }}
                        placeholder={REQUEST.FORM.SCHEDULE_TIME}
                        disabled={isLoading}
                        fullWidth
                        required
                      />
                    </SMSBox>
                  </SMSBox>
                </>
              )}
            </SMSBox>
          </SMSBox>
        )}

        {isTenure && (
          <SMSBox className="generate-schedule-modal__section">
            <SMSBox className="generate-schedule-modal__section-body">
              <SMSBox className="generate-schedule-modal__tenure-release">
                <span className="generate-schedule-modal__tenure-label">{REQUEST.FORM.RELEASE_FOR}</span>
                <SMSBox className="generate-schedule-modal__tenure-dropdown">
                  <SMSDropdown
                    options={tenureReleaseForOptions}
                    value={releaseForMode}
                    onChange={(e) => {
                      setReleaseForMode(String(e.target.value ?? ''));
                      if (error === REQUEST.ERRORS.SCHEDULE_RELEASE_HOURS_REQUIRED) setError(undefined);
                    }}
                    placeholder={REQUEST.FORM.RELEASE_FOR_PLACEHOLDER}
                    displayEmpty
                    disabled={isLoading}
                    searchable={false}
                    fullWidth
                    MenuProps={{
                      disablePortal: false,
                      sx: { zIndex: 1600 },
                    }}
                  />
                </SMSBox>
                {releaseHours != null && (
                  <span className="generate-schedule-modal__tenure-label">
                    {REQUEST.FORM.SCHEDULE_RELEASE_FROM_SCHEDULED_TIME}
                  </span>
                )}
              </SMSBox>
              <SMSBox className="generate-schedule-modal__tenure-process">
                <SMSDatePicker
                  label={REQUEST.FORM.TENURE_START_DATE}
                  value={processPreview?.date ?? ''}
                  onChange={() => undefined}
                  disabled
                />
                <SMSTimePicker
                  label={REQUEST.FORM.TENURE_START_TIME}
                  value={processPreview?.time ?? ''}
                  onChange={() => undefined}
                  disabled
                  fullWidth
                />
              </SMSBox>
            </SMSBox>
          </SMSBox>
        )}

        {error && (
          <SMSTypography variant="caption" color="error">
            {error}
          </SMSTypography>
        )}

        <SMSBox sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, pt: 0.5 }}>
          <SMSButton variant="outlined" onClick={onClose} disabled={isLoading}>
            {REQUEST.FORM.CANCEL_BUTTON}
          </SMSButton>
          <SMSButton onClick={() => void handleGenerate()} disabled={isLoading || !canSubmit}>
            {REQUEST.FORM.GENERATE_REQUEST_SCHEDULE}
          </SMSButton>
        </SMSBox>
      </SMSStack>
    </SMSModal>
    </>
  );
};

/** @deprecated Release-before is computed on the backend (week −7 / month −1). Kept for callers. */
export function defaultGenerateReleaseBeforeDate(): string {
  return formatDateToYYYYMMDD(new Date());
}
