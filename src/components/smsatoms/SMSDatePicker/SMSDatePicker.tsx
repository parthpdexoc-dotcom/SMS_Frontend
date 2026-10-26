import { FC, memo, useMemo, useState, useCallback, useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { parse, format as formatDateFns, isValid } from 'date-fns';
import styles from './SMSDatePicker.module.css';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusableElements(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent != null && !el.hasAttribute('aria-hidden')
  );
}

/** Map common format tokens to date-fns format (e.g. YYYY -> yyyy, DD -> dd) */
function toDateFnsFormat(fmt: string): string {
  return fmt
    .replace(/YYYY/g, 'yyyy')
    .replace(/YY/g, 'yy')
    .replace(/DD/g, 'dd')
    .replace(/D/g, 'd')
    .replace(/MM/g, 'MM')
    .replace(/M(?!M)/g, 'M');
}

export type SMSDatePickerView = 'year' | 'month' | 'day';

export interface SMSDatePickerProps {
  label?: string;
  value: string | undefined | null;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
  /** Display format (e.g. MM/DD/YYYY, MM/DD). Used for input display. */
  format?: string;
  /** Value format when passing string to value/onChange (e.g. YYYY-MM-DD). */
  valueFormat?: string;
  minDate?: string | Date;
  maxDate?: string | Date;
  /** If set, only these dates (YYYY-MM-DD) are selectable. */
  onlyDates?: string[];
  /** Disables specific days in the calendar (e.g. before today). Used with min/max. */
  shouldDisableDate?: (day: Date) => boolean;
  /**
   * Calendar subviews. Default `['year','month','day']`.
   * Use `['month','day']` to skip a separate year step (year still comes from the bound value / reference).
   */
  views?: readonly SMSDatePickerView[];
  /** First view when opening. */
  openTo?: SMSDatePickerView;
  /**
   * @mui/x `PickersCalendarHeader` `format` string (date-fns tokens), e.g. `MMMM` = month name only, no year.
   */
  calendarHeaderFormat?: string;
  /** Keeps a one-line helper area so rows do not jump when another field shows validation (e.g. split form). */
  reserveHelperLine?: boolean;
}

export const SMSDatePicker: FC<SMSDatePickerProps> = memo(({
  label,
  value,
  onChange,
  placeholder,
  id,
  name,
  required = false,
  disabled = false,
  error,
  className = '',
  format = 'MM/DD/YYYY',
  valueFormat = 'YYYY-MM-DD',
  minDate,
  maxDate,
  onlyDates,
  shouldDisableDate: shouldDisableDateProp,
  views = ['year', 'month', 'day'] as const,
  openTo = 'day',
  calendarHeaderFormat,
  reserveHelperLine = false,
}) => {
  const hasValidationError = Boolean(error);
  const helperText =
    error || (reserveHelperLine && !hasValidationError ? '\u00a0' : undefined);

  const valueFnsFormat = useMemo(() => toDateFnsFormat(valueFormat), [valueFormat]);
  const displayFnsFormat = useMemo(() => toDateFnsFormat(format), [format]);

  const dateValue = useMemo(() => {
    if (value == null || String(value).trim() === '') return null;
    const d = parse(String(value).trim(), valueFnsFormat, new Date());
    return isValid(d) ? d : null;
  }, [value, valueFnsFormat]);

  const minDateParsed = useMemo(() => {
    if (minDate == null) return undefined;
    if (minDate instanceof Date) return minDate;
    const d = parse(String(minDate).trim(), valueFnsFormat, new Date());
    return isValid(d) ? d : undefined;
  }, [minDate, valueFnsFormat]);

  const maxDateParsed = useMemo(() => {
    if (maxDate == null) return undefined;
    if (maxDate instanceof Date) return maxDate;
    const d = parse(String(maxDate).trim(), valueFnsFormat, new Date());
    return isValid(d) ? d : undefined;
  }, [maxDate, valueFnsFormat]);

  const onlyDatesSet = useMemo(
    () => (onlyDates?.length ? new Set(onlyDates.map((d) => (d.includes('T') ? d.split('T')[0]! : d))) : null),
    [onlyDates]
  );

  const shouldDisableDateMerged = useMemo(() => {
    if (onlyDatesSet && shouldDisableDateProp) {
      return (day: Date) =>
        !onlyDatesSet.has(formatDateFns(day, 'yyyy-MM-dd')) || shouldDisableDateProp(day);
    }
    if (onlyDatesSet) {
      return (day: Date) => !onlyDatesSet.has(formatDateFns(day, 'yyyy-MM-dd'));
    }
    return shouldDisableDateProp;
  }, [onlyDatesSet, shouldDisableDateProp]);

  const [open, setOpen] = useState(false);
  const suppressOpenUntilRef = useRef<number>(0);
  const handleOpen = useCallback(() => {
    if (Date.now() < suppressOpenUntilRef.current) return;
    setOpen(true);
  }, []);
  const handleClose = useCallback(() => { setOpen(false); }, []);
  const handleChange = useCallback((newDate: Date | null) => {
    onChange(newDate ? formatDateFns(newDate, valueFnsFormat) : '');
  }, [onChange, valueFnsFormat]);
  const wrapperRef = useRef<HTMLDivElement>(null);
  /** Attached to the MUI Popper element so we can do reliable DOM containment checks. */
  const popperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      e.preventDefault();
      handleClose();
      setTimeout(() => {
        const focusables = getFocusableElements();
        const current = id ? document.getElementById(id) : null;
        const currentEl = current ?? (wrapperRef.current ? focusables.find((el) => wrapperRef.current?.contains(el)) : null);
        const idx = currentEl ? focusables.indexOf(currentEl) : -1;
        if (idx >= 0) {
          const nextIdx = e.shiftKey ? idx - 1 : idx + 1;
          const next = focusables[nextIdx];
          if (next) next.focus();
        }
      }, 0);
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [open, handleClose, id]);

  // Close the picker when:
  //   1. The user clicks the already-selected date (MUI X does not fire onChange/onAccept).
  //   2. The user clicks outside the calendar popper (outside-click close).
  // Clicks anywhere else inside the popper (navigation arrows, header, month/year views)
  // are ignored so the calendar stays open.
  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Case 1: click on already-selected day — close
      const dayButton = target.closest('.MuiPickersDay-root');
      if (
        dayButton &&
        (dayButton.classList.contains('Mui-selected') ||
          dayButton.getAttribute('aria-selected') === 'true') &&
        !dayButton.hasAttribute('disabled')
      ) {
        suppressOpenUntilRef.current = Date.now() + 300;
        handleClose();
        return;
      }

      // Case 2: click inside the popper — do NOT close (navigation, header, views, etc.)
      if (popperRef.current?.contains(target)) return;

      // Case 3: click outside both the popper and the wrapper — close
      suppressOpenUntilRef.current = Date.now() + 300;
      handleClose();
    };
    document.addEventListener('mousedown', handleMouseDown, true);
    return () => document.removeEventListener('mousedown', handleMouseDown, true);
  }, [open, handleClose]);

  return (
    <Box
      ref={wrapperRef}
      onClick={() => { if (!disabled) handleOpen(); }}
      sx={{
        marginTop: 1,
        cursor: disabled ? undefined : 'pointer',
        '& .MuiInputBase-root': { cursor: disabled ? undefined : 'pointer' },
        /* MUI X v8 DatePicker uses sections container for the text; reduce its padding */
        '& .MuiPickersOutlinedInput-sectionsContainer': {
          padding: '6px 0 !important',
        },
        '& .MuiPickersInputBase-sectionsContainer': {
          padding: '6px 0 !important',
        },
        /* Ensure individual date sections never receive borders or backgrounds from global contenteditable rules */
        '& [contenteditable="true"]': {
          border: 'none !important',
          borderRadius: '0 !important',
          backgroundColor: 'transparent !important',
          boxShadow: 'none !important',
          outline: 'none !important',
        },
      }}
    >
      <DatePicker
        open={open}
        onOpen={handleOpen}
        onClose={handleClose}
        closeOnSelect
        views={views as ('year' | 'month' | 'day')[]}
        openTo={openTo}
        label={label}
        value={dateValue}
        onChange={handleChange}
        onAccept={() => {
          // Keep the picker closed after final selection/accept.
          suppressOpenUntilRef.current = Date.now() + 250;
          handleClose();
        }}
        disabled={disabled}
        minDate={minDateParsed}
        maxDate={maxDateParsed}
        shouldDisableDate={shouldDisableDateMerged}
        slotProps={{
          ...(calendarHeaderFormat
            ? { calendarHeader: { format: calendarHeaderFormat } }
            : {}),
          popper: { ref: popperRef },
          textField: {
            id,
            name,
            required,
            placeholder: placeholder ?? displayFnsFormat,
            error: hasValidationError,
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
            size: 'small',
            fullWidth: true,
            variant: 'outlined',
            className,
            InputLabelProps: { shrink: true },
            sx: {
              '& .MuiOutlinedInput-root': {
                height: 'var(--sms-input-height, 36px)',
                minHeight: 'var(--sms-input-height, 36px)',
                maxHeight: 'var(--sms-input-height, 36px)',
                boxSizing: 'border-box',
                alignItems: 'center',
                '& .MuiOutlinedInput-input': {
                  padding: '4px 8px !important',
                  boxSizing: 'border-box',
                },
                '& .MuiInputBase-input': {
                  padding: '4px 8px !important',
                },
                /* MUI X DatePicker v8 uses sections container for the text, not standard input */
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
          openPickerButton: {
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
          inputAdornment: {
            sx: {
              maxHeight: '100%',
              marginRight: 0,
              paddingRight: '4px',
              paddingTop: 0,
              paddingBottom: 0,
            },
          },
        }}
        format={displayFnsFormat}
      />
    </Box>
  );
});

SMSDatePicker.displayName = 'SMSDatePicker';

export default SMSDatePicker;
