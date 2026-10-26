import { useMemo, useCallback, memo, FC } from 'react';
import Box from '@mui/material/Box';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { setHours, setMinutes, setSeconds, setMilliseconds } from 'date-fns';
import type { TimeView } from '@mui/x-date-pickers/models';
import styles from './SMSTimePicker.module.css';

function normalizeMinuteStep(step: number | undefined): number {
  if (!Number.isFinite(step)) return 15;
  const intStep = Math.floor(step as number);
  if (intStep < 1) return 1;
  if (intStep > 59) return 59;
  return intStep;
}

function buildAllowedMinutes(step: number): number[] {
  const safeStep = normalizeMinuteStep(step);
  const list: number[] = [];
  for (let minute = 0; minute < 60; minute += safeStep) {
    list.push(minute);
  }
  return list.length ? list : [0];
}

function parseTime(timeStr: string): { hours: number; minutes: number } {
  if (!timeStr || !timeStr.includes(':')) {
    return { hours: 0, minutes: 0 };
  }
  const [h, m] = timeStr.split(':').map(Number);
  return {
    hours: isNaN(h) ? 0 : Math.max(0, Math.min(23, h)),
    minutes: isNaN(m) ? 0 : Math.max(0, Math.min(59, m)),
  };
}

function formatTime(h: number, m: number): string {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function roundToNearestInterval(minutes: number, allowedMinutes: number[]): number {
  return allowedMinutes.reduce((prev, curr) =>
    Math.abs(curr - minutes) < Math.abs(prev - minutes) ? curr : prev
  );
}

function atTime(hours: number, minutes: number): Date {
  const d = new Date(2020, 0, 1);
  return setMinutes(setHours(setSeconds(setMilliseconds(d, 0), 0), hours), minutes);
}

/** Controlled value → Date for MUI (minutes snapped to configured minute step). */
function valueStringToDate(value: string | undefined, allowedMinutes: number[]): Date | null {
  const v = value?.trim();
  if (!v) return null;
  const p = parseTime(v);
  return atTime(p.hours, roundToNearestInterval(p.minutes, allowedMinutes));
}

/** min / max boundary strings → Date (date part ignored by picker). */
function boundaryStringToDate(hhmm: string | undefined): Date | undefined {
  const v = hhmm?.trim();
  if (!v || !v.includes(':')) return undefined;
  const p = parseTime(v);
  return atTime(p.hours, p.minutes);
}

export interface SMSTimePickerProps {
  label?: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  id?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
  min?: string;
  max?: string;
  disableZeroTime?: boolean;
  fullWidth?: boolean;
  /** When true, disabled times are hidden from list. */
  skipDisabled?: boolean;
  /** Wall-clock times only: disables this HH:mm so it cannot be chosen (e.g. match Start Time on End picker). */
  excludeClockTime?: string;
  /** Reserved for duration-style fields (elapsed HH:mm); optional no-op for compatibility. */
  durationMode?: boolean;
  /** Keeps a one-line helper area so rows do not jump when another field shows validation (e.g. split form). */
  reserveHelperLine?: boolean;
  /** Minute gap in time list (e.g. 5, 10, 15). Default is 15. */
  minuteStep?: number;
  /** Warning-style border/background (e.g. after cloning a job). */
  highlighted?: boolean;
}

export const SMSTimePicker: FC<SMSTimePickerProps> = memo(function SMSTimePicker({
  label,
  value = '',
  onChange,
  placeholder = 'HH:mm',
  id,
  name,
  required = false,
  disabled = false,
  error,
  className = '',
  min,
  max,
  disableZeroTime = false,
  fullWidth = true,
  skipDisabled = true,
  excludeClockTime,
  durationMode: _durationMode,
  reserveHelperLine = false,
  minuteStep = 15,
  highlighted = false,
}) {
  const inputId = id || name || `sms-timepicker-${Math.random().toString(36).slice(2, 9)}`;
  const hasValidationError = Boolean(error);
  const showErrorState = hasValidationError || highlighted;
  const helperText =
    error || (reserveHelperLine && !hasValidationError ? '\u00a0' : undefined);

  const safeMinuteStep = useMemo(() => normalizeMinuteStep(minuteStep), [minuteStep]);
  const allowedMinutes = useMemo(() => buildAllowedMinutes(safeMinuteStep), [safeMinuteStep]);
  const dateValue = useMemo(() => valueStringToDate(value, allowedMinutes), [value, allowedMinutes]);
  const minTime = useMemo(() => boundaryStringToDate(min), [min]);
  const maxTime = useMemo(() => boundaryStringToDate(max), [max]);
  const excludedClockParts = useMemo(
    () => (excludeClockTime?.trim() ? parseTime(excludeClockTime.trim()) : null),
    [excludeClockTime]
  );

  const shouldDisableTimeMerged = useCallback(
    (timeValue: Date, view: TimeView) => {
      if (excludedClockParts) {
        const th = timeValue.getHours();
        const tm = timeValue.getMinutes();
        if (th === excludedClockParts.hours && tm === excludedClockParts.minutes) return true;
      }
      if (disableZeroTime && timeValue.getHours() === 0 && timeValue.getMinutes() === 0) return true;
      if (minTime) {
        const th = timeValue.getHours();
        const tm = timeValue.getMinutes();
        const minH = minTime.getHours();
        const minM = minTime.getMinutes();
        const minTotal = minH * 60 + minM;
        if (view === 'hours') {
          const lastAllowedMinuteInHour = allowedMinutes[allowedMinutes.length - 1] ?? 59;
          const lastSelectableInHour = th * 60 + lastAllowedMinuteInHour;
          return lastSelectableInHour < minTotal;
        }
        if (view === 'minutes') {
          if (th < minH) return true;
          if (th > minH) return false;
          return tm < minM;
        }
        return th * 60 + tm < minTotal;
      }
      if (maxTime) {
        const th = timeValue.getHours();
        const tm = timeValue.getMinutes();
        const maxH = maxTime.getHours();
        const maxM = maxTime.getMinutes();
        if (view === 'hours') return th > maxH;
        if (view === 'minutes') {
          if (th > maxH) return true;
          if (th < maxH) return false;
          return tm > maxM;
        }
        return th * 60 + tm > maxH * 60 + maxM;
      }
      return false;
    },
    [disableZeroTime, minTime, maxTime, excludedClockParts, allowedMinutes]
  );

  const useShouldDisableTime =
    disableZeroTime || minTime != null || maxTime != null || excludedClockParts != null;
  const effectiveSkipDisabled =
    minTime != null || maxTime != null || excludedClockParts != null ? false : skipDisabled;

  const handleChange = useCallback(
    (d: Date | null) => {
      if (disabled) return;
      if (!d) {
        onChange?.('');
        return;
      }
      let h = d.getHours();
      let m = roundToNearestInterval(d.getMinutes(), allowedMinutes);
      if (disableZeroTime && h === 0 && m === 0) {
        m = allowedMinutes.find((x) => x > 0) ?? safeMinuteStep;
      }
      if (excludedClockParts && h === excludedClockParts.hours && m === excludedClockParts.minutes) {
        return;
      }
      const selectedMins = h * 60 + m;
      if (min) {
        const minT = parseTime(min);
        const minTotal = minT.hours * 60 + minT.minutes;
        if (selectedMins < minTotal) return;
      }
      if (max) {
        const maxT = parseTime(max);
        const maxTotal = maxT.hours * 60 + maxT.minutes;
        if (selectedMins > maxTotal) return;
      }
      onChange?.(formatTime(h, m));
    },
    [onChange, disableZeroTime, min, max, disabled, excludedClockParts, allowedMinutes, safeMinuteStep]
  );

  return (
    <Box
      sx={{
        marginTop: 1,
        display: fullWidth ? 'block' : 'inline-block',
        width: fullWidth ? '100%' : 'auto',
        '& .MuiPickersOutlinedInput-sectionsContainer': {
          padding: '6px 0 !important',
        },
        '& .MuiPickersInputBase-sectionsContainer': {
          padding: '6px 0 !important',
        },
      }}
    >
      <TimePicker
        label={label}
        value={dateValue}
        onChange={handleChange}
        disabled={disabled}
        enableAccessibleFieldDOMStructure={false}
        format="HH:mm"
        ampm={false}
        minutesStep={safeMinuteStep}
        timeSteps={{ hours: 1, minutes: safeMinuteStep, seconds: 5 }}
        skipDisabled={effectiveSkipDisabled}
        minTime={minTime}
        maxTime={maxTime}
        shouldDisableTime={useShouldDisableTime ? shouldDisableTimeMerged : undefined}
        views={['hours', 'minutes']}
        closeOnSelect
        slotProps={{
          actionBar: { actions: [] },
          desktopPaper: {
            sx: {
              '& .MuiMultiSectionDigitalClock-root': {
                borderBottom: 'none !important',
              },
            },
          },
          mobilePaper: {
            sx: {
              '& .MuiMultiSectionDigitalClock-root': {
                borderBottom: 'none !important',
              },
            },
          },
          textField: {
            id: inputId,
            name,
            required,
            placeholder,
            error: showErrorState,
            helperText,
            ...(hasValidationError
              ? {
                  FormHelperTextProps: {
                    className: styles.helperError,
                  },
                }
              : reserveHelperLine
                ? {
                    FormHelperTextProps: {
                      className: styles.helperReserved,
                    },
                  }
                : {}),
            ...(showErrorState
              ? {
                  InputLabelProps: {
                    error: true,
                    sx: {
                      '&&.Mui-error, &&.Mui-focused': {
                        color: 'error.main',
                      },
                    },
                  },
                }
              : {}),
            size: 'small',
            fullWidth,
            variant: 'outlined',
            className,
            disabled,
            inputProps: { autoComplete: 'off', readOnly: disabled, tabIndex: disabled ? -1 : undefined },
            sx: {
              ...(showErrorState
                ? {
                    '& .MuiFormLabel-root, & .MuiInputLabel-root': {
                      color: 'error.main',
                      '&.Mui-error': { color: 'error.main' },
                    },
                  }
                : {}),
              '& .MuiOutlinedInput-root': {
                height: 'var(--sms-input-height, 36px)',
                minHeight: 'var(--sms-input-height, 36px)',
                maxHeight: 'var(--sms-input-height, 36px)',
                boxSizing: 'border-box',
                alignItems: 'center',
                ...(disabled
                  ? { pointerEvents: 'none' as const, userSelect: 'none' as const }
                  : {}),
                '& .MuiOutlinedInput-input': {
                  padding: '4px 8px !important',
                  boxSizing: 'border-box',
                },
                '& .MuiInputBase-input': {
                  padding: '4px 8px !important',
                },
                '& .MuiPickersOutlinedInput-sectionsContainer': {
                  padding: '6px 0 !important',
                },
                '& .MuiPickersInputBase-sectionsContainer': {
                  padding: '6px 0 !important',
                },
                '& .MuiInputAdornment-root': {
                  maxHeight: '100%',
                  marginRight: 0,
                  paddingRight: '4px',
                  paddingTop: 0,
                  paddingBottom: 0,
                  '& .MuiIconButton-root': {
                    padding: '2px',
                    margin: 0,
                    '& .MuiSvgIcon-root': {
                      fontSize: '1.2rem',
                    },
                  },
                },
              },
            },
          },
          openPickerButton: disabled
            ? {
                disabled: true,
                tabIndex: -1,
                sx: { display: 'none' },
              }
            : {
                tabIndex: -1,
                size: 'small',
                sx: {
                  padding: '2px !important',
                  margin: '0 !important',
                  minWidth: 0,
                  minHeight: 0,
                  '& .MuiSvgIcon-root': {
                    fontSize: '1.2rem',
                  },
                },
              },
        }}
      />
    </Box>
  );
});

SMSTimePicker.displayName = 'SMSTimePicker';

export default SMSTimePicker;
