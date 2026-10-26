import React, { useEffect, useRef, useState } from 'react';
import './RecurrenceSection.css';

const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

export interface MonthDayCalendarProps {
  /** Selected day of month (1–31). */
  selectedDay: number;
  onChange: (day: number) => void;
  disabled?: boolean;
  /** When true, show the 31-day grid always (no popover). */
  alwaysOpen?: boolean;
}

/**
 * Fixed 31-day calendar picker for monthly "day of the month" selection.
 * Shows only days 1–31 (no month/year navigation).
 */
export const MonthDayCalendar: React.FC<MonthDayCalendarProps> = ({
  selectedDay,
  onChange,
  disabled = false,
  alwaysOpen = false,
}) => {
  const [open, setOpen] = useState(alwaysOpen);
  const rootRef = useRef<HTMLDivElement>(null);
  const day = selectedDay >= 1 && selectedDay <= 31 ? selectedDay : 1;

  useEffect(() => {
    if (alwaysOpen || disabled || !open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [alwaysOpen, disabled, open]);

  useEffect(() => {
    if (alwaysOpen) setOpen(true);
  }, [alwaysOpen]);

  const grid = (
    <div className="month-day-calendar__grid" role="listbox" aria-label="Day of the month">
      {MONTH_DAYS.map((d) => {
        const isSelected = d === day;
        return (
          <button
            key={d}
            type="button"
            role="option"
            aria-selected={isSelected}
            className={`month-day-calendar__cell${isSelected ? ' selected' : ''}${disabled ? ' disabled' : ''}`}
            disabled={disabled}
            onClick={() => {
              if (disabled) return;
              onChange(d);
              if (!alwaysOpen) setOpen(false);
            }}
          >
            {d}
          </button>
        );
      })}
    </div>
  );

  if (alwaysOpen) {
    return (
      <div
        ref={rootRef}
        className={`month-day-calendar month-day-calendar--always-open${disabled ? ' month-day-calendar--disabled' : ''}`}
      >
        {grid}
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className={`month-day-calendar${disabled ? ' month-day-calendar--disabled' : ''}`}
    >
      <button
        type="button"
        className={`month-day-calendar__trigger${open ? ' open' : ''}${disabled ? ' disabled' : ''}`}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => {
          if (!disabled) setOpen((v) => !v);
        }}
      >
        {day}
      </button>
      {open && !disabled && <div className="month-day-calendar__popover">{grid}</div>}
    </div>
  );
};
