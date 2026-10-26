import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SMSIcon } from '@/components/smsatoms';
import { DAILY_WORKSPACE } from '@/constants/strings';
import { normalizePostPositionDate } from '@/utils/postPositionDateTree';
import './PositionDatesFilter.css';

export interface PositionDatesFilterProps {
  onChange: (selectedDates: string[]) => void;
  initialSelection?: ReadonlyArray<string>;
  /** Only these dates are shown and selectable (assignment dates for the post). */
  availableDates?: ReadonlyArray<string>;
  onClose?: () => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function toYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function fromYmd(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function monthKeyFromDate(date: string): string {
  return date.slice(0, 7);
}

function monthKeyFromView(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function normalizedUnique(values: ReadonlyArray<string>): string[] {
  return [
    ...new Set(
      values
        .map((value) => normalizePostPositionDate(value))
        .filter((value): value is string => Boolean(value))
    ),
  ].sort();
}

function formatShortDate(value: string): string {
  return fromYmd(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function monthsFromDates(dates: ReadonlyArray<string>): Set<string> {
  return new Set(dates.map(monthKeyFromDate));
}

function selectionSummary(selected: string[]): string {
  if (selected.length === 0) return DAILY_WORKSPACE.FILTERS.NO_DATES_SELECTED;
  if (selected.length === 1) {
    return DAILY_WORKSPACE.FILTERS.ONE_DATE_SELECTED.replace(
      '{date}',
      formatShortDate(selected[0]!)
    );
  }
  return DAILY_WORKSPACE.FILTERS.DATE_RANGE_SUMMARY.replace('{count}', String(selected.length))
    .replace('{start}', formatShortDate(selected[0]!))
    .replace('{end}', formatShortDate(selected[selected.length - 1]!));
}

/** Position date picker limited to available assignment dates for a post. */
export const PositionDatesFilter: React.FC<PositionDatesFilterProps> = ({
  onChange,
  initialSelection = [],
  availableDates = [],
  onClose,
}) => {
  const available = useMemo(() => normalizedUnique(availableDates), [availableDates]);
  const availableSet = useMemo(() => new Set(available), [available]);

  const availableMonths = useMemo(() => {
    const months = [...new Set(available.map(monthKeyFromDate))].sort();
    return months;
  }, [available]);

  const availableYears = useMemo(
    () => [...new Set(available.map((date) => fromYmd(date).getFullYear()))].sort((a, b) => a - b),
    [available]
  );

  const normalizedInitial = useMemo(
    () => normalizedUnique(initialSelection).filter((date) => availableSet.has(date)),
    [initialSelection, availableSet]
  );
  const initialKey = normalizedInitial.join(',');

  const initialViewDate = normalizedInitial[0] ?? available[0] ?? toYmd(new Date());
  const [viewMonth, setViewMonth] = useState(() => {
    const date = fromYmd(initialViewDate);
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const [selected, setSelected] = useState<string[]>(normalizedInitial);
  const [showYearSelect, setShowYearSelect] = useState(false);
  const [pendingFocusDate, setPendingFocusDate] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelected(normalizedInitial);
  }, [initialKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (availableMonths.length === 0) return;
    setViewMonth((current) => {
      const currentKey = monthKeyFromView(current);
      if (availableMonths.includes(currentKey)) return current;
      const fallback = normalizedInitial[0] ?? available[0];
      if (!fallback) return current;
      const date = fromYmd(fallback);
      return new Date(date.getFullYear(), date.getMonth(), 1);
    });
  }, [availableMonths, available, normalizedInitial]);

  const emit = (values: string[]) => {
    const next = normalizedUnique(values).filter((date) => availableSet.has(date));
    setSelected(next);
    onChange(next);
  };

  const handleDaySelect = (date: string) => {
    if (!availableSet.has(date)) return;
    emit(selected.includes(date) ? selected.filter((value) => value !== date) : [...selected, date]);
  };

  const currentYear = viewMonth.getFullYear();
  const currentMonth = viewMonth.getMonth();
  const firstWeekday = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const monthPrefix = monthKeyFromView(viewMonth);

  const availableInMonth = useMemo(
    () => available.filter((date) => date.startsWith(monthPrefix)),
    [available, monthPrefix]
  );

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const monthsWithSelection = useMemo(() => monthsFromDates(selected), [selected]);
  const today = toYmd(new Date());

  const monthIndex = availableMonths.indexOf(monthPrefix);
  const canGoPrev = monthIndex > 0;
  const canGoNext = monthIndex >= 0 && monthIndex < availableMonths.length - 1;

  const changeMonth = (offset: number) => {
    if (availableMonths.length === 0) return;
    const nextIndex = Math.min(
      availableMonths.length - 1,
      Math.max(0, (monthIndex < 0 ? 0 : monthIndex) + offset)
    );
    const nextKey = availableMonths[nextIndex];
    if (!nextKey) return;
    const [year, month] = nextKey.split('-').map(Number);
    setViewMonth(new Date(year, month - 1, 1));
    setShowYearSelect(false);
  };

  const jumpToYear = (year: number) => {
    const match =
      availableMonths.find((key) => key.startsWith(`${year}-`)) ??
      availableMonths.find((key) => Number(key.slice(0, 4)) >= year) ??
      availableMonths[availableMonths.length - 1];
    if (!match) return;
    const [y, m] = match.split('-').map(Number);
    setViewMonth(new Date(y, m - 1, 1));
    setShowYearSelect(false);
  };

  const focusDate = (date: string) => {
    const parsed = fromYmd(date);
    setViewMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
    setPendingFocusDate(date);
  };

  useEffect(() => {
    if (!pendingFocusDate) return;
    const frame = window.requestAnimationFrame(() => {
      rootRef.current
        ?.querySelector<HTMLButtonElement>(`[data-calendar-date="${pendingFocusDate}"]`)
        ?.focus();
      setPendingFocusDate(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pendingFocusDate, viewMonth]);

  const handleDayKeyDown = (event: React.KeyboardEvent, date: string) => {
    const index = available.indexOf(date);
    if (index < 0) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      const prev = available[Math.max(0, index - 1)];
      if (prev) focusDate(prev);
      return;
    }
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      const next = available[Math.min(available.length - 1, index + 1)];
      if (next) focusDate(next);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleDaySelect(date);
    }
  };

  const handleFocusTrap = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;
    const focusable = [
      ...(rootRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), select:not([disabled])'
      ) ?? []),
    ];
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const goToMonth = (key: string) => {
    const [year, month] = key.split('-').map(Number);
    setViewMonth(new Date(year, month - 1, 1));
  };

  const selectAllInMonth = () => emit([...selected, ...availableInMonth]);
  const clearVisibleMonth = () => emit(selected.filter((date) => !date.startsWith(monthPrefix)));

  if (available.length === 0) {
    return (
      <div className="position-dates-filter" role="dialog" aria-label={DAILY_WORKSPACE.FILTERS.POSITION_DATES}>
        <header className="position-dates-filter__header">
          <h3>{DAILY_WORKSPACE.FILTERS.POSITION_DATES}</h3>
          {onClose && (
            <button
              type="button"
              className="position-dates-filter__icon-button"
              aria-label={DAILY_WORKSPACE.CLOSE_PANEL}
              onClick={onClose}
            >
              <SMSIcon name="close" size="sm" />
            </button>
          )}
        </header>
        <p className="position-dates-filter__empty">{DAILY_WORKSPACE.FILTERS.NO_DATES_SELECTED}</p>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className="position-dates-filter"
      role="dialog"
      aria-label={DAILY_WORKSPACE.FILTERS.POSITION_DATES}
      onKeyDown={handleFocusTrap}
    >
      <header className="position-dates-filter__header">
        <h3>{DAILY_WORKSPACE.FILTERS.POSITION_DATES}</h3>
        {onClose && (
          <button
            type="button"
            className="position-dates-filter__icon-button"
            aria-label={DAILY_WORKSPACE.CLOSE_PANEL}
            onClick={onClose}
          >
            <SMSIcon name="close" size="sm" />
          </button>
        )}
      </header>

      {availableMonths.length > 1 && (
        <div
          className="position-dates-filter__month-chips"
          role="group"
          aria-label={DAILY_WORKSPACE.FILTERS.POSITION_MONTHS}
        >
          {availableMonths.map((key) => {
            const [year, month] = key.split('-');
            const label = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-US', {
              month: 'short',
            });
            const count = available.filter((date) => date.startsWith(key)).length;
            const multiYear = availableYears.length > 1;
            return (
              <button
                key={key}
                type="button"
                data-active={monthsWithSelection.has(key)}
                aria-pressed={monthsWithSelection.has(key)}
                onClick={() => goToMonth(key)}
              >
                {multiYear ? `${label} '${String(year).slice(2)}` : label}
                <span>({count})</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="position-dates-filter__month-nav">
        <button
          type="button"
          className="position-dates-filter__icon-button"
          aria-label={DAILY_WORKSPACE.FILTERS.PREVIOUS_MONTH}
          disabled={!canGoPrev}
          onClick={() => changeMonth(-1)}
        >
          <SMSIcon name="chevron-left" size="sm" />
        </button>
        {showYearSelect && availableYears.length > 1 ? (
          <select
            autoFocus
            aria-label={DAILY_WORKSPACE.FILTERS.SELECT_YEAR}
            value={currentYear}
            onChange={(event) => jumpToYear(Number(event.target.value))}
            onBlur={() => setShowYearSelect(false)}
          >
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        ) : (
          <button
            type="button"
            className="position-dates-filter__month-label"
            onClick={() => availableYears.length > 1 && setShowYearSelect(true)}
          >
            {viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </button>
        )}
        <button
          type="button"
          className="position-dates-filter__icon-button"
          aria-label={DAILY_WORKSPACE.FILTERS.NEXT_MONTH}
          disabled={!canGoNext}
          onClick={() => changeMonth(1)}
        >
          <SMSIcon name="chevron-right" size="sm" />
        </button>
      </div>

      <div className="position-dates-filter__month-actions">
        <button type="button" onClick={selectAllInMonth} disabled={availableInMonth.length === 0}>
          {DAILY_WORKSPACE.FILTERS.SELECT_ALL_IN_MONTH}
        </button>
        <button type="button" onClick={clearVisibleMonth}>
          {DAILY_WORKSPACE.FILTERS.CLEAR}
        </button>
      </div>

      <div
        className="position-dates-filter__calendar"
        role="grid"
        aria-label={viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
      >
        {WEEKDAYS.map((weekday) => (
          <span key={weekday} className="position-dates-filter__weekday" role="columnheader">
            {weekday}
          </span>
        ))}
        {Array.from({ length: firstWeekday }, (_, index) => (
          <span key={`blank-start-${index}`} aria-hidden="true" />
        ))}
        {Array.from({ length: daysInMonth }, (_, index) => {
          const day = index + 1;
          const date = `${monthPrefix}-${String(day).padStart(2, '0')}`;
          const isAvailable = availableSet.has(date);
          const isSelected = selectedSet.has(date);

          return (
            <button
              key={date}
              type="button"
              role="gridcell"
              data-calendar-date={date}
              className="position-dates-filter__day"
              data-selected={isSelected}
              data-today={date === today}
              disabled={!isAvailable}
              aria-pressed={isSelected}
              aria-selected={isSelected}
              aria-disabled={!isAvailable}
              aria-label={fromYmd(date).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
              onClick={() => handleDaySelect(date)}
              onKeyDown={(event) => isAvailable && handleDayKeyDown(event, date)}
            >
              {day}
            </button>
          );
        })}
      </div>

      <footer className="position-dates-filter__summary" aria-live="polite">
        <SMSIcon name="calendar" size="sm" />
        <span>{selectionSummary(selected)}</span>
      </footer>
    </div>
  );
};
