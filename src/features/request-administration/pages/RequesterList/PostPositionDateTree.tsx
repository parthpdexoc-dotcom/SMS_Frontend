import React, { useMemo } from 'react';
import { Skeleton } from '@mui/material';
import { SMSBox, SMSIcon, SMSIconButton } from '@/components/smsatoms';
import { DAILY_ADMINISTRATION } from '@/constants/strings';
import {
  buildPostPositionDateTree,
  countDatesInYear,
  formatPostPositionMonthLabel,
  formatPostPositionWeekdayShort,
  getPostPositionDayNumber,
  getSelectedDatesForPostMonth,
  postPositionDayExpandKey,
  postPositionMonthExpandKey,
  postPositionYearExpandKey,
} from '@/utils/postPositionDateTree';

export interface PostPositionDateTreeProps {
  postId: string;
  dates: ReadonlyArray<string>;
  loading?: boolean;
  expandedYears: ReadonlySet<string>;
  expandedMonths: ReadonlySet<string>;
  /** Selected day keys (`postId:YYYY-MM-DD`) — multi-select per month. */
  selectedPostDays: ReadonlySet<string>;
  onToggleYear: (postId: string, year: string) => void;
  onToggleMonth: (postId: string, year: string, month: string) => void;
  onToggleDay: (postId: string, date: string) => void;
  renderMonthPanel: (year: string, month: string, selectedDates: string[]) => React.ReactNode;
}

function renderDayRail(
  postId: string,
  days: string[],
  selectedPostDays: ReadonlySet<string>,
  onToggleDay: (postId: string, date: string) => void
) {
  return (
    <SMSBox
      className="post-position-date-tree__day-rail"
      role="group"
      aria-label={DAILY_ADMINISTRATION.DATE_TREE.SELECT_DAY}
    >
      {days.map((date) => {
        const dayKey = postPositionDayExpandKey(postId, date);
        const isDaySelected = selectedPostDays.has(dayKey);

        return (
          <button
            key={dayKey}
            type="button"
            className="post-position-date-tree__day-chip"
            data-active={isDaySelected}
            onClick={() => onToggleDay(postId, date)}
            aria-pressed={isDaySelected}
            title={date}
            aria-label={
              isDaySelected
                ? DAILY_ADMINISTRATION.DATE_TREE.DESELECT_DAY
                : DAILY_ADMINISTRATION.DATE_TREE.SELECT_DAY_CHIP
            }
          >
            <span className="post-position-date-tree__day-chip-weekday">
              {formatPostPositionWeekdayShort(date)}
            </span>
            <span className="post-position-date-tree__day-chip-number">
              {getPostPositionDayNumber(date)}
            </span>
          </button>
        );
      })}
    </SMSBox>
  );
}

export const PostPositionDateTree: React.FC<PostPositionDateTreeProps> = ({
  postId,
  dates,
  loading = false,
  expandedYears,
  expandedMonths,
  selectedPostDays,
  onToggleYear,
  onToggleMonth,
  onToggleDay,
  renderMonthPanel,
}) => {
  const tree = useMemo(() => buildPostPositionDateTree(dates), [dates]);
  const sortedYears = useMemo(
    () => Object.keys(tree).sort((a, b) => Number(a) - Number(b)),
    [tree]
  );

  if (loading) {
    return (
      <SMSBox className="post-position-date-tree post-position-date-tree--loading">
        <SMSBox className="post-position-date-tree__skeleton-grid">
          {Array.from({ length: 3 }).map((_, idx) => (
            <Skeleton key={`post-date-tree-skeleton-${idx}`} variant="rounded" height={56} />
          ))}
        </SMSBox>
      </SMSBox>
    );
  }

  if (sortedYears.length === 0) {
    return (
      <SMSBox className="post-position-date-tree post-position-date-tree--empty">
        <SMSBox className="post-position-date-tree__empty-icon-wrap" aria-hidden>
          <SMSIcon name="calendar" size="md" className="post-position-date-tree__empty-icon" />
        </SMSBox>
        <span className="post-position-date-tree__empty-label">{DAILY_ADMINISTRATION.DATE_TREE.NO_DATES}</span>
      </SMSBox>
    );
  }

  return (
    <SMSBox className="post-position-date-tree">
      {sortedYears.map((year) => {
        const yearKey = postPositionYearExpandKey(postId, year);
        const isYearExpanded = expandedYears.has(yearKey);
        const months = tree[year] ?? {};
        const sortedMonths = Object.keys(months).sort((a, b) => Number(a) - Number(b));
        const yearDateCount = countDatesInYear(tree, year);
        const toggleYear = () => onToggleYear(postId, year);

        return (
          <SMSBox
            key={yearKey}
            className="post-position-date-tree__year-card"
            data-expanded={isYearExpanded}
          >
            <SMSBox className="post-position-date-tree__year-header">
              <SMSIconButton
                className="post-position-date-tree__year-calendar-btn level-1-requester__expand-btn"
                tone={isYearExpanded ? 'primary' : 'success'}
                allowWhenSuspended
                size="small"
                onClick={toggleYear}
                aria-expanded={isYearExpanded}
                aria-label={isYearExpanded ? DAILY_ADMINISTRATION.DATE_TREE.COLLAPSE_YEAR : DAILY_ADMINISTRATION.DATE_TREE.EXPAND_YEAR}
                title={isYearExpanded ? DAILY_ADMINISTRATION.DATE_TREE.COLLAPSE_YEAR : DAILY_ADMINISTRATION.DATE_TREE.EXPAND_YEAR}
              >
                <SMSIcon name="calendar" size="sm" />
              </SMSIconButton>
              <button
                type="button"
                className="post-position-date-tree__year-trigger"
                onClick={toggleYear}
                aria-expanded={isYearExpanded}
              >
                <SMSBox className="post-position-date-tree__year-copy">
                  <span className="post-position-date-tree__year-title">{year}</span>
                  <span className="post-position-date-tree__year-meta">
                    {DAILY_ADMINISTRATION.DATE_TREE.DATES_COUNT.replace('{count}', String(yearDateCount))}
                  </span>
                </SMSBox>
                <SMSIcon
                  name={isYearExpanded ? 'expand_less' : 'expand_more'}
                  size="sm"
                  className="post-position-date-tree__year-chevron"
                />
              </button>
            </SMSBox>

            {isYearExpanded && (
              <SMSBox className="post-position-date-tree__year-panel">
                <SMSBox
                  className="post-position-date-tree__month-rail"
                  role="group"
                  aria-label={DAILY_ADMINISTRATION.DATE_TREE.SELECT_MONTH}
                >
                  {sortedMonths.map((month) => {
                    const monthKey = postPositionMonthExpandKey(postId, year, month);
                    const isMonthExpanded = expandedMonths.has(monthKey);

                    return (
                      <button
                        key={monthKey}
                        type="button"
                        className="post-position-date-tree__month-chip"
                        data-active={isMonthExpanded}
                        onClick={() => onToggleMonth(postId, year, month)}
                        aria-pressed={isMonthExpanded}
                        aria-label={
                          isMonthExpanded
                            ? DAILY_ADMINISTRATION.DATE_TREE.COLLAPSE_MONTH
                            : DAILY_ADMINISTRATION.DATE_TREE.EXPAND_MONTH
                        }
                      >
                        {formatPostPositionMonthLabel(month)}
                        <span className="post-position-date-tree__month-chip-count">
                          {(months[month] ?? []).length}
                        </span>
                      </button>
                    );
                  })}
                </SMSBox>

                {sortedMonths.map((month) => {
                  const monthKey = postPositionMonthExpandKey(postId, year, month);
                  if (!expandedMonths.has(monthKey)) return null;

                  const days = months[month] ?? [];
                  const selectedDates = getSelectedDatesForPostMonth(selectedPostDays, postId, year, month);
                  const monthTitle = `${formatPostPositionMonthLabel(month)} ${year}`;

                  return (
                    <SMSBox key={`${monthKey}-panel`} className="post-position-date-tree__month-panel">
                      <span className="post-position-date-tree__month-panel-title">{monthTitle}</span>
                      {renderDayRail(postId, days, selectedPostDays, onToggleDay)}

                      {selectedDates.length > 0 && (
                        <SMSBox className="post-position-date-tree__month-results">
                          {renderMonthPanel(year, month, selectedDates)}
                        </SMSBox>
                      )}
                    </SMSBox>
                  );
                })}
              </SMSBox>
            )}
          </SMSBox>
        );
      })}
    </SMSBox>
  );
};
