import React, { useCallback, useEffect, useState } from 'react';
import { SMSButton, SMSCheckbox, SMSDropdown, SMSLabel, SMSLoader, SMSTextField, SMSTimePicker } from '@/components/smsatoms';
import { SMSModal } from '@/components/smsorganisms';
import { WeekdayChips, SHORT_WEEKDAYS } from '@/components/smsorganisms/SMSRequestForm/Recurrence/WeekdayChips';
import '@/components/smsorganisms/SMSDataTableWrapper/SMSDataTable.css';
import '@/components/smsorganisms/SMSRequestForm/Recurrence/RecurrenceSection.css';
import {
  getDepartmentCronSchedules,
  getUnconfiguredDepartmentCronJobTypes,
  upsertDepartmentCronSchedule,
} from '@/services/departmentCronJobManagementService';
import {
  type DepartmentCronJobTypeOptionDto,
  type DepartmentCronScheduleDto,
  type DepartmentCronScheduleFrequency,
  type DepartmentCronScheduleUpsertDto,
  DEPARTMENT_CRON_FREQUENCY_DROPDOWN_OPTIONS,
  MONTH_WEEK_ORDINAL_DROPDOWN_OPTIONS,
  MonthlySubPattern,
  type ScheduleFrequency,
} from '@/types/departmentCronSchedule';
import { useAppDispatch } from '@/store/hooks';
import { showToast } from '@/store/slices/toastSlice';
import { minutesToTimeString, timeStringToMinutes } from '@/utils/dateTimeUtils';
import { DEPARTMENT_CONFIGURATION } from '@/constants/strings';

function frequencyLabel(f: DepartmentCronScheduleFrequency): string {
  if (f === 4) {
    return 'Other';
  }
  return (
    DEPARTMENT_CRON_FREQUENCY_DROPDOWN_OPTIONS.find((o) => o.value === String(f))?.label ?? '—'
  );
}

/** Legacy `frequency: 4` is no longer editable; opening the modal remaps to Daily 00:00. */
function migrateLegacyCustomToEditable(d: DepartmentCronScheduleDto): DepartmentCronScheduleDto {
  if (d.frequency !== 4) {
    return d;
  }
  return {
    ...d,
    frequency: 0,
    hour: 0,
    minute: 0,
    intervalMinutes: null,
    customCronExpression: null,
  };
}

function normalizeRow(r: DepartmentCronScheduleDto): DepartmentCronScheduleDto {
  const f = r.frequency;
  let daysOfWeek: number[] | null | undefined = r.daysOfWeek;
  if (f === 1) {
    if (daysOfWeek && daysOfWeek.length > 0) {
      daysOfWeek = [...daysOfWeek].sort((a, b) => a - b);
    } else if (r.dayOfWeek != null) {
      daysOfWeek = [r.dayOfWeek];
    } else {
      daysOfWeek = null;
    }
  } else {
    daysOfWeek = null;
  }
  return {
    ...r,
    daysOfWeek,
    monthlySubPattern: r.frequency === 2 ? (r.monthlySubPattern ?? MonthlySubPattern.ByCalendarDay) : 0,
    monthWeekOrdinal:
      r.frequency === 2 && (r.monthlySubPattern ?? 0) === MonthlySubPattern.ByWeekdayOrdinal
        ? (r.monthWeekOrdinal ?? 1)
        : null,
    intervalMinutes: r.frequency === 3 ? (r.intervalMinutes ?? 5) : null,
    customCronExpression: null,
  };
}

function defaultDraftForNewJob(departmentId: string, job: number, jobName: string): DepartmentCronScheduleDto {
  return normalizeRow({
    departmentCronJobManagementId: null,
    departmentID: departmentId,
    job,
    jobName,
    frequency: 0,
    hour: 0,
    minute: 0,
    dayOfWeek: null,
    daysOfWeek: null,
    dayOfMonth: 1,
    monthlySubPattern: MonthlySubPattern.ByCalendarDay,
    monthWeekOrdinal: null,
    cronExpression: null,
  });
}

function formatScheduleSummary(r: DepartmentCronScheduleDto): string {
  const fromApi = (r.cronExpressionDescription ?? '').trim();
  if (fromApi.length > 0) {
    return fromApi;
  }
  const time = minutesToTimeString(r.hour * 60 + r.minute);
  if (r.frequency === 0) {
    return time;
  }
  if (r.frequency === 1) {
    const w =
      r.daysOfWeek && r.daysOfWeek.length > 0
        ? r.daysOfWeek
        : r.dayOfWeek != null
          ? [r.dayOfWeek]
          : [];
    if (w.length === 0) {
      return time;
    }
    const dayLabels = w
      .map((wi) => SHORT_WEEKDAYS.find((d) => d.value === wi)?.label)
      .filter((x) => x !== undefined);
    return dayLabels.length ? `${time} · ${dayLabels.join(', ')}` : time;
  }
  if (r.frequency === 2) {
    const sub = r.monthlySubPattern ?? MonthlySubPattern.ByCalendarDay;
    if (sub === MonthlySubPattern.ByCalendarDay) {
      return `${time} · Day ${r.dayOfMonth ?? '—'}`;
    }
    const w = r.dayOfWeek;
    if (w == null || w < 0 || w > 6) {
      return time;
    }
    const dow = SHORT_WEEKDAYS.find((d) => d.value === w)?.label ?? '—';
    if (sub === MonthlySubPattern.ByLastWeekday) {
      return `${time} · Last ${dow}`;
    }
    const o = r.monthWeekOrdinal;
    if (o == null || o < 1 || o > 5) {
      return `${time} · ${dow}`;
    }
    const ord = MONTH_WEEK_ORDINAL_DROPDOWN_OPTIONS.find((x) => x.value === String(o))?.label ?? o;
    return `${time} · ${ord} ${dow}`;
  }
  if (r.frequency === 3) {
    const n = r.intervalMinutes;
    if (n == null || n < 1 || n > 59) {
      return '—';
    }
    return `*/${n} * * * *`;
  }
  if (r.frequency === 4) {
    const raw = (r.customCronExpression ?? r.cronExpression ?? '').trim();
    if (raw.length <= 48) {
      return raw || '—';
    }
    return `${raw.slice(0, 45)}…`;
  }
  return time;
}

function buildUpsertPayload(d: DepartmentCronScheduleDto, departmentID: string): DepartmentCronScheduleUpsertDto {
  // Custom (4) is not editable; if it appears, persist as daily (should not happen after migrateLegacyCustomToEditable).
  if (d.frequency === 4) {
    return {
      departmentCronJobManagementId: d.departmentCronJobManagementId ?? null,
      departmentID,
      job: d.job,
      frequency: 0,
      hour: d.hour,
      minute: d.minute,
      dayOfWeek: null,
      dayOfMonth: null,
      monthlySubPattern: 0,
      monthWeekOrdinal: null,
      intervalMinutes: null,
      customCronExpression: null,
    };
  }
  if (d.frequency === 0) {
    return {
      departmentCronJobManagementId: d.departmentCronJobManagementId ?? null,
      departmentID,
      job: d.job,
      frequency: 0,
      hour: d.hour,
      minute: d.minute,
      dayOfWeek: null,
      dayOfMonth: null,
      monthlySubPattern: 0,
      monthWeekOrdinal: null,
      intervalMinutes: null,
      customCronExpression: null,
    };
  }
  if (d.frequency === 1) {
    const w =
      d.daysOfWeek && d.daysOfWeek.length > 0
        ? [...d.daysOfWeek]
            .filter((x) => x >= 0 && x <= 6)
            .filter((v, i, a) => a.indexOf(v) === i)
            .sort((a, b) => a - b)
        : d.dayOfWeek != null
          ? [d.dayOfWeek]
          : [];
    return {
      departmentCronJobManagementId: d.departmentCronJobManagementId ?? null,
      departmentID,
      job: d.job,
      frequency: 1,
      hour: d.hour,
      minute: d.minute,
      dayOfWeek: w[0] ?? null,
      daysOfWeek: w.length > 0 ? w : null,
      dayOfMonth: null,
      monthlySubPattern: 0,
      monthWeekOrdinal: null,
      intervalMinutes: null,
      customCronExpression: null,
    };
  }
  if (d.frequency === 3) {
    return {
      departmentCronJobManagementId: d.departmentCronJobManagementId ?? null,
      departmentID,
      job: d.job,
      frequency: 3,
      hour: 0,
      minute: 0,
      dayOfWeek: null,
      dayOfMonth: null,
      monthlySubPattern: 0,
      monthWeekOrdinal: null,
      intervalMinutes: d.intervalMinutes ?? null,
      customCronExpression: null,
    };
  }
  const sub = d.monthlySubPattern ?? MonthlySubPattern.ByCalendarDay;
  return {
    departmentCronJobManagementId: d.departmentCronJobManagementId ?? null,
    departmentID,
    job: d.job,
    frequency: 2,
    hour: d.hour,
    minute: d.minute,
    monthlySubPattern: sub,
    dayOfMonth: sub === MonthlySubPattern.ByCalendarDay ? d.dayOfMonth ?? null : null,
    dayOfWeek:
      sub === MonthlySubPattern.ByWeekdayOrdinal || sub === MonthlySubPattern.ByLastWeekday
        ? d.dayOfWeek ?? null
        : null,
    monthWeekOrdinal: sub === MonthlySubPattern.ByWeekdayOrdinal ? d.monthWeekOrdinal ?? null : null,
    intervalMinutes: null,
    customCronExpression: null,
  };
}

function validate(d: DepartmentCronScheduleDto): string | null {
  if (d.frequency === 1) {
    const w =
      d.daysOfWeek && d.daysOfWeek.length > 0
        ? d.daysOfWeek
        : d.dayOfWeek != null
          ? [d.dayOfWeek]
          : [];
    if (w.length === 0) {
      return 'For weekly schedule, select at least one weekday.';
    }
  }
  if (d.frequency === 3) {
    if (d.intervalMinutes == null || d.intervalMinutes < 1 || d.intervalMinutes > 59) {
      return 'Enter a valid interval: 1–59 (Minute schedule).';
    }
  }
  if (d.frequency === 2) {
    const sub = d.monthlySubPattern ?? MonthlySubPattern.ByCalendarDay;
    if (sub === MonthlySubPattern.ByCalendarDay) {
      if (d.dayOfMonth == null || d.dayOfMonth < 1 || d.dayOfMonth > 31) {
        return 'Enter a day of the month (1–31).';
      }
    } else if (sub === MonthlySubPattern.ByWeekdayOrdinal) {
      if (d.dayOfWeek == null || d.dayOfWeek < 0 || d.dayOfWeek > 6) {
        return 'Select a weekday for the Nth-weekday-in-month option.';
      }
      if (d.monthWeekOrdinal == null || d.monthWeekOrdinal < 1 || d.monthWeekOrdinal > 5) {
        return 'Select which week (first through fifth).';
      }
    } else {
      if (d.dayOfWeek == null || d.dayOfWeek < 0 || d.dayOfWeek > 6) {
        return 'Select a weekday for the last weekday in month option.';
      }
    }
  }
  return null;
}

function patchFrequency(
  d: DepartmentCronScheduleDto,
  next: ScheduleFrequency
): Partial<DepartmentCronScheduleDto> {
  const patch: Partial<DepartmentCronScheduleDto> = { frequency: next };
  if (next === 0) {
    patch.dayOfWeek = null;
    patch.daysOfWeek = null;
    patch.dayOfMonth = null;
    patch.monthlySubPattern = 0;
    patch.monthWeekOrdinal = null;
    patch.intervalMinutes = null;
    patch.customCronExpression = null;
  } else if (next === 1) {
    const w =
      d.daysOfWeek && d.daysOfWeek.length > 0
        ? [...d.daysOfWeek]
        : d.dayOfWeek != null
          ? [d.dayOfWeek]
          : [1];
    patch.dayOfWeek = w[0];
    patch.daysOfWeek = w;
    patch.dayOfMonth = null;
    patch.monthlySubPattern = 0;
    patch.monthWeekOrdinal = null;
    patch.intervalMinutes = null;
    patch.customCronExpression = null;
  } else if (next === 2) {
    const sub = d.monthlySubPattern ?? MonthlySubPattern.ByCalendarDay;
    patch.monthlySubPattern = sub;
    patch.dayOfMonth = d.dayOfMonth ?? 1;
    patch.monthWeekOrdinal = sub === MonthlySubPattern.ByWeekdayOrdinal ? d.monthWeekOrdinal ?? 1 : null;
    patch.intervalMinutes = null;
    patch.customCronExpression = null;
    patch.daysOfWeek = null;
    if (sub === MonthlySubPattern.ByCalendarDay) {
      patch.dayOfWeek = null;
    } else {
      patch.dayOfWeek = d.dayOfWeek ?? 1;
    }
  } else if (next === 3) {
    patch.dayOfWeek = null;
    patch.daysOfWeek = null;
    patch.dayOfMonth = null;
    patch.monthlySubPattern = 0;
    patch.monthWeekOrdinal = null;
    patch.customCronExpression = null;
    patch.intervalMinutes = d.intervalMinutes != null && d.intervalMinutes >= 1 && d.intervalMinutes <= 59
      ? d.intervalMinutes
      : 5;
    patch.hour = 0;
    patch.minute = 0;
  }
  return patch;
}

function patchMonthlySub(
  d: DepartmentCronScheduleDto,
  next: MonthlySubPattern
): Partial<DepartmentCronScheduleDto> {
  const patch: Partial<DepartmentCronScheduleDto> = { monthlySubPattern: next };
  if (next === MonthlySubPattern.ByCalendarDay) {
    patch.dayOfMonth = d.dayOfMonth ?? 1;
    patch.dayOfWeek = null;
    patch.monthWeekOrdinal = null;
  } else if (next === MonthlySubPattern.ByWeekdayOrdinal) {
    patch.dayOfMonth = null;
    patch.dayOfWeek = d.dayOfWeek ?? 1;
    patch.monthWeekOrdinal = d.monthWeekOrdinal ?? 1;
  } else {
    patch.dayOfMonth = null;
    patch.monthWeekOrdinal = null;
    patch.dayOfWeek = d.dayOfWeek ?? 1;
  }
  return patch;
}

function getWeeklySelectedDays(d: DepartmentCronScheduleDto): number[] {
  if (d.frequency !== 1) {
    return [];
  }
  if (d.daysOfWeek && d.daysOfWeek.length > 0) {
    return [...d.daysOfWeek].sort((a, b) => a - b);
  }
  if (d.dayOfWeek != null) {
    return [d.dayOfWeek];
  }
  return [];
}

const CronScheduleFormFields: React.FC<{
  idPrefix: string;
  draft: DepartmentCronScheduleDto;
  disabled: boolean;
  minuteStep?: number;
  onPatch: (p: Partial<DepartmentCronScheduleDto>) => void;
}> = ({ idPrefix, draft, disabled, minuteStep = 15, onPatch }) => {
  const f = draft.frequency ?? 0;
  const sub = draft.monthlySubPattern ?? MonthlySubPattern.ByCalendarDay;
  const showTimeOfDay = f === 0 || f === 1 || f === 2;
  return (
    <div className="dept-cron__modal-form">
      <div className="dept-cron__modal-row">
        <SMSDropdown
          label="Frequency"
          searchable={false}
          name={`${idPrefix}-frequency-${draft.job}`}
          value={String(f)}
          onChange={(e) => {
            onPatch(patchFrequency(draft, Number(e.target.value) as ScheduleFrequency));
          }}
          options={DEPARTMENT_CRON_FREQUENCY_DROPDOWN_OPTIONS}
          disabled={disabled}
          required
        />
        {showTimeOfDay && (
          <div className="dept-cron__time-field">
            <SMSTimePicker
              label="Time"
              value={minutesToTimeString(draft.hour * 60 + draft.minute)}
              onChange={(v) => {
                const total = timeStringToMinutes(v);
                onPatch({ hour: Math.floor(total / 60), minute: total % 60 });
              }}
              minuteStep={minuteStep}
              disabled={disabled}
              required
            />
          </div>
        )}
        {f === 3 && (
          <div className="dept-cron__interval-field">
            <SMSTextField
              id={`${idPrefix}-interval-${draft.job}`}
              name={`${idPrefix}-interval`}
              label="Interval (1–59)"
              type="number"
              value={String(draft.intervalMinutes ?? 5)}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '' || raw === '-') {
                  onPatch({ intervalMinutes: 5 });
                  return;
                }
                const n = Math.min(59, Math.max(1, parseInt(raw, 10) || 5));
                onPatch({ intervalMinutes: n });
              }}
              inputProps={{ min: 1, max: 59 }}
              disabled={disabled}
              required
            />
          </div>
        )}
      </div>
        {f === 3 && (
        <p className="dept-cron__add-hint">
          Repeats on an interval. Stored as <code>*/N * * * *</code> (minute, hour, day of month, month, day of week).
        </p>
      )}
      {draft.frequency === 1 && (
        <div className="dept-cron__recurrence-block recurrence-options-container">
          <SMSLabel>On</SMSLabel>
          <WeekdayChips
            selectedDays={getWeeklySelectedDays(draft)}
            onChange={(days) => {
              const unique = [...new Set(days.filter((n) => n >= 0 && n <= 6))].sort((a, b) => a - b);
              onPatch({
                daysOfWeek: unique.length > 0 ? unique : null,
                dayOfWeek: unique[0] ?? null,
              });
            }}
            showLabel={false}
            disabled={disabled}
          />
        </div>
      )}
      {f === 2 && (
        <div className="dept-cron__monthly-recurrence">
          <div className="recurrence-radio-group-vertical">
            <label
              className="recurrence-radio-row dept-cron__monthly-radio-line"
              htmlFor={`${idPrefix}-dom-${draft.job}`}
            >
              <input
                type="radio"
                name={`${idPrefix}-monthlySub-${draft.job}`}
                checked={sub === MonthlySubPattern.ByCalendarDay}
                onChange={() => onPatch(patchMonthlySub(draft, MonthlySubPattern.ByCalendarDay))}
                disabled={disabled}
              />
              <span className="radio-label-text">On</span>
              <div className="recurrence-radio-input-wrapper">
                <SMSTextField
                  id={`${idPrefix}-dom-${draft.job}`}
                  name="dom-modal"
                  type="number"
                  value={String(draft.dayOfMonth ?? 1)}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '' || raw === '-') {
                      onPatch({ dayOfMonth: 1, monthlySubPattern: MonthlySubPattern.ByCalendarDay });
                      return;
                    }
                    const n = Math.min(31, Math.max(1, parseInt(raw, 10) || 1));
                    onPatch({ dayOfMonth: n, monthlySubPattern: MonthlySubPattern.ByCalendarDay });
                  }}
                  className="recurrence-input-tiny"
                  inputProps={{ min: 1, max: 31 }}
                  disabled={disabled || sub !== MonthlySubPattern.ByCalendarDay}
                />
              </div>
              <span className="radio-label-text">day of the month (1–31)</span>
            </label>
            <label className="recurrence-radio-row dept-cron__monthly-radio-line">
              <input
                type="radio"
                name={`${idPrefix}-monthlySub-${draft.job}`}
                checked={sub === MonthlySubPattern.ByWeekdayOrdinal}
                onChange={() => onPatch(patchMonthlySub(draft, MonthlySubPattern.ByWeekdayOrdinal))}
                disabled={disabled}
              />
              <span className="radio-label-text">On the</span>
              <div className="recurrence-radio-dropdown-wrapper">
                <SMSDropdown
                  searchable={false}
                  name={`${idPrefix}-week-ord-${draft.job}`}
                  value={String(draft.monthWeekOrdinal ?? 1)}
                  onChange={(e) => {
                    const v = String((e as { target: { value: string } }).target.value);
                    onPatch({
                      ...patchMonthlySub(draft, MonthlySubPattern.ByWeekdayOrdinal),
                      monthWeekOrdinal: Math.min(5, Math.max(1, parseInt(v, 10) || 1)),
                    });
                  }}
                  options={MONTH_WEEK_ORDINAL_DROPDOWN_OPTIONS}
                  disabled={disabled || sub !== MonthlySubPattern.ByWeekdayOrdinal}
                  fullWidth={false}
                />
              </div>
              <span className="radio-label-text">week of</span>
              <div>
                <WeekdayChips
                  selectionMode="single"
                  selectedDays={draft.dayOfWeek != null ? [draft.dayOfWeek] : []}
                  onChange={(days) => {
                    const d0 = days[0];
                    onPatch({
                      ...patchMonthlySub(draft, MonthlySubPattern.ByWeekdayOrdinal),
                      dayOfWeek: d0 === undefined ? null : d0,
                    });
                  }}
                  showLabel={false}
                  inline
                  disabled={disabled || sub !== MonthlySubPattern.ByWeekdayOrdinal}
                />
              </div>
            </label>
            <div className="dept-cron__monthly-radio-line">
              <label
                className="recurrence-radio-row recurrence-radio-row--align-start"
                htmlFor={`${idPrefix}-last-dow-${draft.job}`}
              >
                <input
                  type="radio"
                  name={`${idPrefix}-monthlySub-${draft.job}`}
                  id={`${idPrefix}-last-dow-${draft.job}`}
                  checked={sub === MonthlySubPattern.ByLastWeekday}
                  onChange={() => onPatch(patchMonthlySub(draft, MonthlySubPattern.ByLastWeekday))}
                  disabled={disabled}
                />
                <span className="radio-label-text">On the last</span>
                <WeekdayChips
                  selectionMode="single"
                  selectedDays={draft.dayOfWeek != null ? [draft.dayOfWeek] : []}
                  onChange={(days) => {
                    const d0 = days[0];
                    onPatch({
                      ...patchMonthlySub(draft, MonthlySubPattern.ByLastWeekday),
                      dayOfWeek: d0 === undefined ? null : d0,
                    });
                  }}
                  showLabel={false}
                  inline
                  disabled={disabled || sub !== MonthlySubPattern.ByLastWeekday}
                />
                <span className="radio-label-text">in the month</span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export interface SMSDepartmentCronConfigurationTabProps {
  departmentId: string;
  enablePayrollCronJob?: boolean;
  onEnablePayrollCronJobChange?: (checked: boolean) => void;
  payrollCronDisabled?: boolean;
}

export const SMSDepartmentCronConfigurationTab: React.FC<SMSDepartmentCronConfigurationTabProps> = ({
  departmentId,
  enablePayrollCronJob = false,
  onEnablePayrollCronJobChange,
  payrollCronDisabled = false,
}) => {
  const dispatch = useAppDispatch();
  const [rows, setRows] = useState<DepartmentCronScheduleDto[]>([]);
  const [unconfigured, setUnconfigured] = useState<DepartmentCronJobTypeOptionDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingJob, setSavingJob] = useState<number | null>(null);
  const [draft, setDraft] = useState<DepartmentCronScheduleDto | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addDraft, setAddDraft] = useState<DepartmentCronScheduleDto | null>(null);
  const [addJobValue, setAddJobValue] = useState('');
  const [addListLoading, setAddListLoading] = useState(false);

  const loadUnconfigured = useCallback(async () => {
    if (!departmentId) {
      return;
    }
    try {
      const notYet = await getUnconfiguredDepartmentCronJobTypes(departmentId);
      setUnconfigured(notYet);
    } catch (e) {
      setUnconfigured([]);
      const msg = e instanceof Error ? e.message : 'Failed to load available job types.';
      dispatch(showToast(msg, 'error'));
    }
  }, [departmentId, dispatch]);

  const load = useCallback(async () => {
    if (!departmentId) {
      return;
    }
    setLoading(true);
    try {
      const data = await getDepartmentCronSchedules(departmentId);
      setRows(data.map((r) => normalizeRow(r)));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load cron configuration.';
      dispatch(showToast(msg, 'error'));
    } finally {
      setLoading(false);
      void loadUnconfigured();
    }
  }, [departmentId, dispatch, loadUnconfigured]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateDraft = (p: Partial<DepartmentCronScheduleDto>) => {
    setDraft((prev) => (prev ? { ...prev, ...p } : null));
  };
  const updateAddDraft = (p: Partial<DepartmentCronScheduleDto>) => {
    setAddDraft((prev) => (prev ? { ...prev, ...p } : null));
  };

  const onSaveFromModal = async () => {
    if (!draft) {
      return;
    }
    const v = validate(draft);
    if (v) {
      dispatch(showToast(v, 'error'));
      return;
    }
    if (!departmentId) {
      dispatch(showToast('Department is required.', 'error'));
      return;
    }
    setSavingJob(draft.job);
    try {
      await upsertDepartmentCronSchedule(buildUpsertPayload(draft, departmentId));
      dispatch(showToast('Schedule saved.', 'success'));
      setDraft(null);
      void load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to save schedule.';
      dispatch(showToast(msg, 'error'));
    } finally {
      setSavingJob(null);
    }
  };

  const onSaveAdd = async () => {
    if (!addDraft) {
      return;
    }
    const v = validate(addDraft);
    if (v) {
      dispatch(showToast(v, 'error'));
      return;
    }
    if (!departmentId) {
      dispatch(showToast('Department is required.', 'error'));
      return;
    }
    setSavingJob(addDraft.job);
    try {
      await upsertDepartmentCronSchedule(buildUpsertPayload(addDraft, departmentId));
      dispatch(showToast('Schedule saved.', 'success'));
      setAddOpen(false);
      setAddDraft(null);
      setAddJobValue('');
      void load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to save schedule.';
      dispatch(showToast(msg, 'error'));
    } finally {
      setSavingJob(null);
    }
  };

  const cronSettings = onEnablePayrollCronJobChange ? (
    <div
      className="dept-cron__settings"
      role="group"
      aria-labelledby="dept-cron-settings-title"
    >
      <span id="dept-cron-settings-title" className="dept-cron__settings-title">
        {DEPARTMENT_CONFIGURATION.CRON_SETTINGS.TITLE}
      </span>
      <div className="dept-cron__settings-list">
        <SMSCheckbox
          label={DEPARTMENT_CONFIGURATION.CRON_SETTINGS.ENABLE_PAYROLL}
          checked={enablePayrollCronJob}
          onChange={onEnablePayrollCronJobChange}
          disabled={payrollCronDisabled}
          className="app-form__checkbox-label"
        />
      </div>
    </div>
  ) : null;

  if (!departmentId) {
    return (
      <div className="dept-cron dept-cron--tab">
        <p className="dept-cron__hint">A department is required to configure job schedules.</p>
        {cronSettings}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="dept-cron dept-cron--tab">
        {cronSettings}
        <div className="dept-cron__loader">
          <SMSLoader loadingText="Loading schedules…" aria-label="Loading schedules" />
        </div>
      </div>
    );
  }

  return (
    <div className="dept-cron dept-cron--tab">
      <div className="dept-cron__toolbar">
        <p className="dept-cron__intro">
          Only job types you add are configured here, so the table reflects real schedules. Times use the department
          time zone. Use <strong>Add</strong> to add a new job, or <strong>Edit</strong> on a row. Monthly options
          match the request recurrence style (day of month, Nth weekday, or last weekday).
        </p>
        <div className="dept-cron__toolbar-actions">
          <SMSButton
            type="button"
            size="small"
            variant="contained"
            disabled={savingJob != null}
            onClick={() => {
              setAddJobValue('');
              setAddDraft(null);
              setAddOpen(true);
              setAddListLoading(true);
              void (async () => {
                try {
                  const notYet = await getUnconfiguredDepartmentCronJobTypes(departmentId);
                  setUnconfigured(notYet);
                } catch (e) {
                  setUnconfigured([]);
                  const msg = e instanceof Error ? e.message : 'Failed to load available job types.';
                  dispatch(showToast(msg, 'error'));
                } finally {
                  setAddListLoading(false);
                }
              })();
            }}
          >
            Add cron configuration
          </SMSButton>
        </div>
      </div>
      {cronSettings}
      <div className="dept-cron__table-outer data-table data-table--mode-table">
        <div className="data-table__container data-table__container--full">
          <table className="data-table__table dept-cron__data-table">
            <thead className="data-table__thead">
              <tr className="data-table__tr">
                <th className="data-table__th dept-cron__col-job" scope="col">
                  <span className="data-table__th-label">Job</span>
                </th>
                <th className="data-table__th" scope="col">
                  <span className="data-table__th-label">Frequency</span>
                </th>
                <th className="data-table__th" scope="col">
                  <span className="data-table__th-label">Schedule</span>
                </th>
                <th className="data-table__th data-table__th--narrow data-table__th--align-right" scope="col">
                  <span className="data-table__th-label"> </span>
                </th>
              </tr>
            </thead>
            <tbody className="data-table__tbody">
              {rows.length === 0 ? (
                <tr className="data-table__tr">
                  <td colSpan={4} className="data-table__td data-table__empty-cell">
                    No cron schedules yet. Add one to configure when a background job runs for this department.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.job} className="data-table__tr">
                    <td className="data-table__td data-table__td--word-wrap">{r.jobName}</td>
                    <td className="data-table__td">{frequencyLabel(r.frequency)}</td>
                    <td className="data-table__td data-table__td--word-wrap">{formatScheduleSummary(r)}</td>
                    <td className="data-table__td data-table__td--align-right data-table__td--nowrap">
                      <SMSButton
                        type="button"
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          setDraft(migrateLegacyCustomToEditable(normalizeRow(r)));
                        }}
                        disabled={savingJob != null}
                      >
                        Edit
                      </SMSButton>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SMSModal
        isOpen={draft != null}
        onClose={() => {
          setDraft(null);
        }}
        title={draft ? `Edit schedule: ${draft.jobName}` : undefined}
        size="md"
        showCloseButton
        actions={
          draft ? (
            <>
              <SMSButton
                type="button"
                variant="outlined"
                onClick={() => {
                  setDraft(null);
                }}
                disabled={savingJob != null}
              >
                Cancel
              </SMSButton>
              <SMSButton
                type="button"
                variant="contained"
                onClick={() => {
                  void onSaveFromModal();
                }}
                loading={savingJob != null}
                disabled={savingJob != null}
              >
                {draft.departmentCronJobManagementId != null ? 'Update' : 'Save'}
              </SMSButton>
            </>
          ) : null
        }
        contentClassName="dept-cron__modal-content"
        fullWidth
      >
        {draft && (
          <CronScheduleFormFields
            idPrefix="edit"
            draft={draft}
            disabled={savingJob != null}
            minuteStep={5}
            onPatch={updateDraft}
          />
        )}
      </SMSModal>

      <SMSModal
        isOpen={addOpen}
        onClose={() => {
          setAddOpen(false);
          setAddDraft(null);
          setAddJobValue('');
          setAddListLoading(false);
        }}
        title="Add cron configuration"
        size="md"
        showCloseButton
        actions={
          addOpen ? (
            <>
              <SMSButton
                type="button"
                variant="outlined"
                onClick={() => {
                  setAddOpen(false);
                  setAddDraft(null);
                  setAddJobValue('');
                  setAddListLoading(false);
                }}
                disabled={savingJob != null}
              >
                Cancel
              </SMSButton>
              <SMSButton
                type="button"
                variant="contained"
                onClick={() => {
                  void onSaveAdd();
                }}
                disabled={!addDraft || savingJob != null}
                loading={savingJob != null}
              >
                Save
              </SMSButton>
            </>
          ) : null
        }
        contentClassName="dept-cron__modal-content"
        fullWidth
      >
        <div>
          {addListLoading && (
            <p className="dept-cron__add-hint">Loading job types…</p>
          )}
          <div className="dept-cron__add-job">
            <SMSDropdown
              label="Job type"
              searchable={false}
              name="dept-cron-add-job"
              value={addJobValue}
              onChange={(e) => {
                const v = (e as { target: { value: string } }).target.value;
                setAddJobValue(v);
                const j = unconfigured.find((o) => String(o.job) === v);
                if (j) {
                  setAddDraft(defaultDraftForNewJob(departmentId, j.job, j.jobName));
                } else {
                  setAddDraft(null);
                }
              }}
              options={unconfigured.map((o) => ({ value: String(o.job), label: o.jobName }))}
              disabled={savingJob != null || addListLoading || unconfigured.length === 0}
              required
              placeholder="Select a job to configure"
            />
            {!addListLoading && (
            <p className="dept-cron__add-hint">
              Only predefined job types from this list are available. You cannot type or add a new job name.
            </p>
            )}
            {!addListLoading && unconfigured.length === 0 && (
              <p className="dept-cron__add-hint dept-cron__add-hint--warn">
                All job types already have a schedule, or the list could not be loaded. Close and use Edit on a row, or
                try again.
              </p>
            )}
          </div>
          {addDraft && (
            <CronScheduleFormFields
              idPrefix="add"
              draft={addDraft}
              disabled={savingJob != null}
              minuteStep={5}
              onPatch={updateAddDraft}
            />
          )}
        </div>
      </SMSModal>
    </div>
  );
};
