import React, { useEffect, useMemo, useState } from 'react';
import { Skeleton } from '@mui/material';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { SMSBox, SMSButton, SMSIcon, SMSIconButton } from '@/components/smsatoms';
import {
  formatDateShort,
  getDefaultMonthPairYmdDates,
  getDefaultYearMonthFromYmdDates,
} from '@/utils';
import './SMSMultiDateCalendar.css';

export interface SMSMultiDateCalendarLabels {
  title: string;
  close: string;
  yearLabel: string;
  monthsLabel: string;
  selectYear: string;
  selectMonth: string;
  clear: string;
  prevMonth: string;
  nextMonth: string;
  noDates: string;
  daysSelected: string;
  daysSelectedRange: string;
  weekdays: readonly string[];
}

export interface SMSMultiDateCalendarProps {
  /** YYYY-MM-DD values that can be selected. */
  dates: ReadonlyArray<string>;
  selectedDates: ReadonlyArray<string>;
  labels: SMSMultiDateCalendarLabels;
  loading?: boolean;
  className?: string;
  onSelectMonthDates: (dates: string[]) => void;
  onToggleDate: (date: string) => void;
  /** Called when Clear is pressed and no default month is available. */
  onClear: () => void;
  onClose: () => void;
  /** When true, Clear selects the default (current) month instead of calling onClear. */
  resetClearToDefaultMonth?: boolean;
}

export const SMSMultiDateCalendar: React.FC<SMSMultiDateCalendarProps> = ({
  dates,
  selectedDates,
  labels,
  loading = false,
  className = '',
  onSelectMonthDates,
  onToggleDate,
  onClear,
  onClose,
  resetClearToDefaultMonth = true,
}) => {
  // Backend may return duplicate YYYY-MM-DD values; UI counts must be for distinct dates.
  const distinctDates = useMemo(() => [...new Set(dates)].sort(), [dates]);
  const availableSet = useMemo(() => new Set(distinctDates), [distinctDates]);
  const selectedSet = useMemo(() => new Set(selectedDates), [selectedDates]);
  const defaultYm = useMemo(
    () => getDefaultYearMonthFromYmdDates(distinctDates),
    [distinctDates]
  );

  const initialYm = useMemo(() => {
    const first = selectedDates[0];
    if (first) {
      const year = first.slice(0, 4);
      const month = first.slice(5, 7);
      if (year && month) return { year, month };
    }
    return defaultYm;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [viewYear, setViewYear] = useState(() => initialYm?.year ?? '');
  const [viewMonth, setViewMonth] = useState(() => initialYm?.month ?? '');

  useEffect(() => {
    if (!defaultYm || (viewYear && viewMonth)) return;
    setViewYear(defaultYm.year);
    setViewMonth(defaultYm.month);
  }, [defaultYm, viewYear, viewMonth]);

  const years = useMemo(
    () => [...new Set(distinctDates.map((d) => d.slice(0, 4)))].sort(),
    [distinctDates]
  );

  const monthsInYear = useMemo(() => {
    if (!viewYear) return [];
    const prefix = `${viewYear}-`;
    return [...new Set(distinctDates.filter((d) => d.startsWith(prefix)).map((d) => d.slice(5, 7)))].sort();
  }, [distinctDates, viewYear]);

  const viewMonthDate = useMemo(
    () => new Date(Number(viewYear), Number(viewMonth) - 1, 1),
    [viewYear, viewMonth]
  );

  const gridDays = useMemo(() => {
    if (!viewYear || !viewMonth) return [];
    return eachDayOfInterval({
      start: startOfWeek(startOfMonth(viewMonthDate), { weekStartsOn: 0 }),
      end: endOfWeek(endOfMonth(viewMonthDate), { weekStartsOn: 0 }),
    });
  }, [viewMonthDate, viewYear, viewMonth]);

  const sortedSelected = useMemo(() => [...selectedDates].sort(), [selectedDates]);
  const summary =
    sortedSelected.length === 0
      ? labels.daysSelected.replace('{count}', '0')
      : labels.daysSelectedRange
          .replace('{count}', String(sortedSelected.length))
          .replace('{start}', formatDateShort(sortedSelected[0]!))
          .replace('{end}', formatDateShort(sortedSelected[sortedSelected.length - 1]!));

  const datesInMonth = (year: string, month: string) =>
    distinctDates.filter((d) => d.startsWith(`${year}-${month}-`));

  const isMonthSelected = (year: string, month: string) =>
    selectedDates.some((d) => d.startsWith(`${year}-${month}-`));

  const selectYear = (year: string) => {
    setViewYear(year);
    const defaultDates = getDefaultMonthPairYmdDates(distinctDates, year);
    const fallbackMonth = distinctDates.find((d) => d.startsWith(`${year}-`))?.slice(5, 7) ?? '';
    setViewMonth(defaultDates[0]?.slice(5, 7) || fallbackMonth);
    onSelectMonthDates(
      defaultDates.length > 0 ? defaultDates : fallbackMonth ? datesInMonth(year, fallbackMonth) : []
    );
  };

  const toggleMonth = (month: string) => {
    if (!viewYear) return;
    const prefix = `${viewYear}-${month}-`;
    if (isMonthSelected(viewYear, month)) {
      const remaining = selectedDates.filter((d) => !d.startsWith(prefix));
      onSelectMonthDates(remaining);
      const nextMonth = remaining[0]?.slice(5, 7) ?? month;
      setViewMonth(nextMonth);
      return;
    }
    setViewMonth(month);
    onSelectMonthDates([...new Set([...selectedDates, ...datesInMonth(viewYear, month)])].sort());
  };

  const shiftMonth = (delta: number) => {
    if (!viewYear || !viewMonth) return;
    const next = addMonths(viewMonthDate, delta);
    setViewYear(format(next, 'yyyy'));
    setViewMonth(format(next, 'MM'));
  };

  const handleClear = () => {
    if (!resetClearToDefaultMonth || !defaultYm) {
      onClear();
      return;
    }
    setViewYear(defaultYm.year);
    setViewMonth(defaultYm.month);
    onSelectMonthDates(getDefaultMonthPairYmdDates(distinctDates));
  };

  const rootClass = ['sms-multi-date-calendar', className].filter(Boolean).join(' ');

  if (loading) {
    return (
      <SMSBox className={`${rootClass} sms-multi-date-calendar--loading`}>
        <Skeleton variant="rounded" height={320} width={340} />
      </SMSBox>
    );
  }

  if (dates.length === 0) {
    return (
      <SMSBox className={`${rootClass} sms-multi-date-calendar--empty`}>
        <SMSBox className="sms-multi-date-calendar__header">
          <span className="sms-multi-date-calendar__title">{labels.title}</span>
          <SMSIconButton size="small" allowWhenSuspended onClick={onClose} aria-label={labels.close} title={labels.close}>
            <SMSIcon name="close" size="sm" />
          </SMSIconButton>
        </SMSBox>
        <span className="sms-multi-date-calendar__empty-label">{labels.noDates}</span>
      </SMSBox>
    );
  }

  return (
    <SMSBox className={rootClass}>
      <SMSBox className="sms-multi-date-calendar__header">
        <span className="sms-multi-date-calendar__title">{labels.title}</span>
        <SMSIconButton size="small" allowWhenSuspended onClick={onClose} aria-label={labels.close} title={labels.close}>
          <SMSIcon name="close" size="sm" />
        </SMSIconButton>
      </SMSBox>

      <SMSBox className="sms-multi-date-calendar__rail-group">
        <span className="sms-multi-date-calendar__rail-label">{labels.yearLabel}</span>
        <SMSBox className="sms-multi-date-calendar__rail" role="group" aria-label={labels.selectYear}>
          {years.map((year) => (
            <button
              key={year}
              type="button"
              className="sms-multi-date-calendar__pill"
              data-active={year === viewYear}
              onClick={() => selectYear(year)}
            >
              {year}
            </button>
          ))}
        </SMSBox>
      </SMSBox>

      <SMSBox className="sms-multi-date-calendar__rail-group">
        <span className="sms-multi-date-calendar__rail-label">{labels.monthsLabel}</span>
        <SMSBox className="sms-multi-date-calendar__rail" role="group" aria-label={labels.selectMonth}>
          {monthsInYear.map((month) => (
            <button
              key={month}
              type="button"
              className="sms-multi-date-calendar__pill"
              data-active={isMonthSelected(viewYear, month)}
              onClick={() => toggleMonth(month)}
            >
              {format(new Date(2000, Number(month) - 1, 1), 'MMM')} ({datesInMonth(viewYear, month).length})
            </button>
          ))}
        </SMSBox>
      </SMSBox>

      <SMSBox className="sms-multi-date-calendar__nav">
        <SMSIconButton size="small" allowWhenSuspended onClick={() => shiftMonth(-1)} aria-label={labels.prevMonth}>
          <SMSIcon name="chevron_left" size="sm" />
        </SMSIconButton>
        <span className="sms-multi-date-calendar__nav-title">
          {format(viewMonthDate, 'MMMM yyyy')}
        </span>
        <SMSIconButton size="small" allowWhenSuspended onClick={() => shiftMonth(1)} aria-label={labels.nextMonth}>
          <SMSIcon name="chevron_right" size="sm" />
        </SMSIconButton>
      </SMSBox>

      <SMSBox className="sms-multi-date-calendar__actions">
        <SMSButton
          allowWhenSuspended
          disabled={selectedDates.length === 0}
          onClick={handleClear}
        >
          {labels.clear}
        </SMSButton>
      </SMSBox>

      <SMSBox className="sms-multi-date-calendar__weekdays">
        {labels.weekdays.map((label) => (
          <span key={label} className="sms-multi-date-calendar__weekday">
            {label}
          </span>
        ))}
      </SMSBox>

      <SMSBox className="sms-multi-date-calendar__grid">
        {gridDays.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          if (!isSameMonth(day, viewMonthDate)) {
            return (
              <span
                key={dateKey}
                className="sms-multi-date-calendar__day sms-multi-date-calendar__day--empty"
              />
            );
          }
          const available = availableSet.has(dateKey);
          const selected = selectedSet.has(dateKey);
          return (
            <button
              key={dateKey}
              type="button"
              className="sms-multi-date-calendar__day"
              data-available={available}
              data-selected={selected}
              disabled={!available}
              onClick={() => onToggleDate(dateKey)}
              title={dateKey}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </SMSBox>

      <SMSBox className="sms-multi-date-calendar__footer">
        <SMSIcon name="calendar" size="sm" />
        <span>{summary}</span>
      </SMSBox>
    </SMSBox>
  );
};
