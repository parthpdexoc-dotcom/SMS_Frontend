import React from 'react';
import {
  SMSBox,
  SMSButton,
  SMSDatePicker,
  SMSDropdown,
  SMSStack,
  SMSTextField,
} from '@/components/smsatoms';
import type { SMSDropdownOption } from '@/components/smsatoms';
import { EMPLOYEE_ASSIGNMENT_FILTERS } from '@/constants/strings';
import './SMSEmployeeAssignmentFilters.css';

/**
 * Reusable filter bar for "list of employee assignments" pages
 * (e.g. Close Assignments, Jobs Ready To Close).
 *
 * Layout: search + employee dropdown + start date + end date + Apply (+ optional Clear).
 *
 * Labels are intentionally hardcoded so every consumer presents the same UI;
 * only state, handlers, date constraints, and feature toggles vary per page.
 */
export interface SMSEmployeeAssignmentFiltersProps {
  // ─── Search ──────────────────────────────────────────────────────────────
  search: string;
  onSearchChange: (value: string) => void;
  hideSearch?: boolean;

  // ─── Employee dropdown ───────────────────────────────────────────────────
  employee: string;
  onEmployeeChange: (value: string) => void;
  employeeOptions: SMSDropdownOption[];
  /** When true, employee dropdown search calls the options API. */
  employeeServerSideSearch?: boolean;
  onEmployeeSearchInputChange?: (value: string) => void | Promise<unknown>;
  hideEmployee?: boolean;

  // ─── Requester dropdown ──────────────────────────────────────────────────
  requester?: string;
  onRequesterChange?: (value: string) => void;
  requesterOptions?: SMSDropdownOption[];
  hideRequester?: boolean;

  // ─── Date range (draft values; parent applies on click) ──────────────────
  startDate: string | null;
  onStartDateChange: (value: string) => void;
  endDate: string | null;
  onEndDateChange: (value: string) => void;
  startMinDate?: string;
  startMaxDate?: string;
  endMinDate?: string;
  endMaxDate?: string;
  hideDateRange?: boolean;

  // ─── Apply / Clear ───────────────────────────────────────────────────────
  onApply: () => void;
  applyDisabled?: boolean;
  /** When provided, a `Clear` button is rendered next to `Apply Filter`. */
  onClear?: () => void;
  clearDisabled?: boolean;

  // ─── Misc ────────────────────────────────────────────────────────────────
  /** Used to make field IDs unique when multiple instances mount on the same page. */
  idPrefix?: string;
  className?: string;
}

const buildFieldId = (prefix: string, name: string) =>
  `${prefix.replace(/[^a-z0-9-]/gi, '-')}-${name}`;

export const SMSEmployeeAssignmentFilters: React.FC<SMSEmployeeAssignmentFiltersProps> = ({
  search,
  onSearchChange,
  hideSearch = false,

  employee,
  onEmployeeChange,
  employeeOptions,
  employeeServerSideSearch = false,
  onEmployeeSearchInputChange,
  hideEmployee = false,

  requester = '',
  onRequesterChange,
  requesterOptions = [],
  hideRequester = false,

  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  startMinDate,
  startMaxDate,
  endMinDate,
  endMaxDate,
  hideDateRange = false,

  onApply,
  applyDisabled = false,
  onClear,
  clearDisabled = false,

  idPrefix = 'sms-emp-assignment-filters',
  className,
}) => {
  const rootClassName = ['sms-emp-assignment-filters', className].filter(Boolean).join(' ');

  return (
    <SMSBox className={rootClassName}>
      <SMSStack
        direction="row"
        spacing={1}
        className="sms-emp-assignment-filters__row"
      >
        {!hideSearch && (
          <SMSBox className="sms-emp-assignment-filters__item sms-emp-assignment-filters__search">
            <SMSTextField
              id={buildFieldId(idPrefix, 'search')}
              label={EMPLOYEE_ASSIGNMENT_FILTERS.SEARCH_LABEL}
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onSearchChange(e.target.value)}
              fullWidth
            />
          </SMSBox>
        )}

        {!hideEmployee && (
          <SMSBox className="sms-emp-assignment-filters__item sms-emp-assignment-filters__employee">
            <SMSDropdown
              id={buildFieldId(idPrefix, 'employee')}
              label={EMPLOYEE_ASSIGNMENT_FILTERS.EMPLOYEE_LABEL}
              options={employeeOptions}
              value={employee}
              onChange={(e) => onEmployeeChange(String(e.target.value))}
              placeholder={EMPLOYEE_ASSIGNMENT_FILTERS.EMPLOYEE_LABEL}
              clearable
              fullWidth
              serverSideSearch={employeeServerSideSearch}
              onSearchInputChange={onEmployeeSearchInputChange}
              noOptionsText="No options"
            />
          </SMSBox>
        )}

        {!hideRequester && onRequesterChange && (
          <SMSBox className="sms-emp-assignment-filters__item sms-emp-assignment-filters__requester">
            <SMSDropdown
              id={buildFieldId(idPrefix, 'requester')}
              label={EMPLOYEE_ASSIGNMENT_FILTERS.REQUESTER_LABEL}
              options={requesterOptions}
              value={requester}
              onChange={(e) => onRequesterChange(String(e.target.value))}
              placeholder={EMPLOYEE_ASSIGNMENT_FILTERS.REQUESTER_LABEL}
              clearable
              fullWidth
            />
          </SMSBox>
        )}

        {!hideDateRange && (
          <>
            <SMSBox className="sms-emp-assignment-filters__item sms-emp-assignment-filters__date">
              <SMSDatePicker
                id={buildFieldId(idPrefix, 'start-date')}
                label={EMPLOYEE_ASSIGNMENT_FILTERS.START_DATE_LABEL}
                value={startDate}
                onChange={onStartDateChange}
                valueFormat="YYYY-MM-DD"
                minDate={startMinDate}
                maxDate={startMaxDate}
              />
            </SMSBox>
            <SMSBox className="sms-emp-assignment-filters__item sms-emp-assignment-filters__date">
              <SMSDatePicker
                id={buildFieldId(idPrefix, 'end-date')}
                label={EMPLOYEE_ASSIGNMENT_FILTERS.END_DATE_LABEL}
                value={endDate}
                onChange={onEndDateChange}
                valueFormat="YYYY-MM-DD"
                minDate={endMinDate ?? (startDate || undefined)}
                maxDate={endMaxDate}
              />
            </SMSBox>
          </>
        )}

        <SMSBox className="sms-emp-assignment-filters__item sms-emp-assignment-filters__apply">
          <SMSButton onClick={onApply} disabled={applyDisabled} sx={{ minWidth: 120 }}>
            {EMPLOYEE_ASSIGNMENT_FILTERS.APPLY_LABEL}
          </SMSButton>
        </SMSBox>

        {onClear && (
          <SMSBox className="sms-emp-assignment-filters__item sms-emp-assignment-filters__clear">
            <SMSButton
              variant="outlined"
              onClick={onClear}
              disabled={clearDisabled}
              sx={{ minWidth: 100 }}
            >
              {EMPLOYEE_ASSIGNMENT_FILTERS.CLEAR_LABEL}
            </SMSButton>
          </SMSBox>
        )}
      </SMSStack>
    </SMSBox>
  );
};

export default SMSEmployeeAssignmentFilters;
