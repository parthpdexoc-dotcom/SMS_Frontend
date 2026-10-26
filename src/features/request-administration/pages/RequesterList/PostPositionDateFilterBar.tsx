import React, { useMemo, useState } from 'react';
import { Popover, Skeleton } from '@mui/material';
import { SMSIcon } from '@/components/smsatoms';
import { DAILY_ADMINISTRATION, DAILY_WORKSPACE } from '@/constants/strings';
import { PositionDatesFilter } from '../DailyWorkspace/components/PositionDatesFilter';
import {
  formatPostPositionFilterDate,
  normalizePostPositionDate,
} from '@/utils/postPositionDateTree';

export interface PostPositionDateFilterBarProps {
  dates: ReadonlyArray<string>;
  loading?: boolean;
  isDateSelected: (date: string) => boolean;
  onChangeDates: (dates: string[]) => void;
  compact?: boolean;
}

function selectionSummary(selectedDates: string[]): string {
  if (selectedDates.length === 0) return DAILY_WORKSPACE.FILTERS.NO_DATES_SELECTED;
  if (selectedDates.length === 1) return formatPostPositionFilterDate(selectedDates[0]!);
  return DAILY_WORKSPACE.FILTERS.DATES_SELECTED_COUNT.replace(
    '{count}',
    String(selectedDates.length)
  );
}

/** Calendar trigger and popover shell used by each selected post section. */
export const PostPositionDateFilterBar: React.FC<PostPositionDateFilterBarProps> = ({
  dates,
  loading = false,
  isDateSelected,
  onChangeDates,
  compact = true,
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const availableDates = useMemo(
    () =>
      [...new Set(
        dates
          .map((date) => normalizePostPositionDate(date))
          .filter((date): date is string => Boolean(date))
      )].sort(),
    [dates]
  );
  const selectedDates = useMemo(
    () => availableDates.filter((date) => isDateSelected(date)),
    [availableDates, isDateSelected]
  );

  if (loading) {
    return <Skeleton variant="rounded" height={32} width={compact ? 36 : 120} />;
  }

  if (availableDates.length === 0) {
    return (
      <span
        className="daily-workspace__position-date-empty"
        title={DAILY_ADMINISTRATION.DATE_TREE.NO_DATES}
      >
        {DAILY_ADMINISTRATION.DATE_TREE.NO_DATES}
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        className="daily-workspace__date-picker-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={DAILY_WORKSPACE.FILTERS.OPEN_DATE_PICKER}
        title={DAILY_WORKSPACE.FILTERS.OPEN_DATE_PICKER}
        onClick={(event) => {
          event.stopPropagation();
          setAnchorEl(event.currentTarget);
        }}
      >
        <SMSIcon name="calendar" size="sm" />
        {!compact && (
          <span className="daily-workspace__date-picker-summary">
            {selectionSummary(selectedDates)}
          </span>
        )}
        {compact && selectedDates.length > 0 && (
          <span className="daily-workspace__date-picker-badge">{selectedDates.length}</span>
        )}
      </button>

      <Popover
        open={open}
        anchorEl={anchorEl}
        disablePortal
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            className: 'daily-workspace__date-picker-popover',
            elevation: 0,
          },
        }}
      >
        <PositionDatesFilter
          availableDates={availableDates}
          initialSelection={selectedDates}
          onChange={onChangeDates}
          onClose={() => setAnchorEl(null)}
        />
      </Popover>
    </>
  );
};
