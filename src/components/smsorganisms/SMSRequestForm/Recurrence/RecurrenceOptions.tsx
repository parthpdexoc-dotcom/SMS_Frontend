import { SMSDropdown } from '@/components/smsatoms';
import React from 'react';
import { REQUEST } from '@/constants/strings';
import { RecurrenceRule, RecurrenceUnit, MonthlyMode, WEEK_INDEX_OPTIONS } from '@/types/recurrence';
import { WeekdayChips } from './WeekdayChips';
import { MonthDayCalendar } from './MonthDayCalendar';
import '@/styles/forms.css';
import './RecurrenceSection.css';

interface RecurrenceOptionsProps {
    rule: RecurrenceRule;
    onChange: (updates: Partial<RecurrenceRule>) => void;
}

export const RecurrenceOptions: React.FC<RecurrenceOptionsProps> = ({ rule, onChange }) => {
    // Weekly Options
    if (rule.repeatUnit === RecurrenceUnit.WEEK) {
        return (
            <div className="recurrence-options-container">
                <WeekdayChips
                    selectedDays={rule.weekDays || []}
                    onChange={(days) => onChange({ weekDays: days })}
                    showLabel={false}
                />
            </div>
        );
    }

    // Monthly Options
    if (rule.repeatUnit === RecurrenceUnit.MONTH) {
        const selectedMonthDay = (rule.monthDays && rule.monthDays[0]) || 1;

        return (
            <div className="recurrence-options-container">
                <div className="recurrence-radio-group-horizontal">
                    {/* By Date */}
                    <label className="recurrence-radio-row">
                        <input
                            type="radio"
                            name="monthlyMode"
                            checked={rule.monthlyMode === MonthlyMode.BY_DATE}
                            onChange={() => onChange({ monthlyMode: MonthlyMode.BY_DATE })}
                        />
                        <span className="radio-label-text">
                            On
                        </span>
                        <div
                            className="recurrence-radio-input-wrapper"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <MonthDayCalendar
                                selectedDay={selectedMonthDay}
                                onChange={(day) => onChange({ monthDays: [day] })}
                                disabled={rule.monthlyMode !== MonthlyMode.BY_DATE}
                            />
                        </div>
                        <span className="radio-label-text">
                            day of the month
                        </span>
                    </label>

                    {/* By Pattern */}
                    <label className="recurrence-radio-row">
                        <input
                            type="radio"
                            name="monthlyMode"
                            checked={rule.monthlyMode === MonthlyMode.BY_PATTERN}
                            onChange={() => {
                                const updates: Partial<RecurrenceRule> = { monthlyMode: MonthlyMode.BY_PATTERN };
                                if (rule.weekIndex == null) updates.weekIndex = 1;
                                onChange(updates);
                            }}
                        />
                        <span className="radio-label-text">
                            On
                        </span>
                        <div className="recurrence-radio-dropdown-wrapper">
                            <SMSDropdown
                                options={WEEK_INDEX_OPTIONS}
                                value={String(rule.weekIndex ?? 1)}
                                onChange={(e) =>
                                  onChange({ weekIndex: Number(e.target.value) })
                                }
                                disabled={rule.monthlyMode === MonthlyMode.BY_DATE}
                            />
                        </div>
                        <span className="radio-label-text">
                            week of 
                        </span>
                        <div>
                            <WeekdayChips
                                selectedDays={rule.weekDays || []}
                                onChange={(days) => onChange({ weekDays: days })}
                                disabled={rule.monthlyMode === MonthlyMode.BY_DATE}
                                showLabel={false}
                                inline={true}
                            />
                        </div>
                        <span className="radio-label-text">
                            day
                        </span>
                    </label>
                </div>
                {rule.monthlyMode === MonthlyMode.BY_DATE && selectedMonthDay >= 29 && (
                    <p className="month-day-end-note">
                        {REQUEST.FORM.GENERATE_SCHEDULE_MONTH_DAY_NOTE}
                    </p>
                )}
            </div>
        );
    }

    return null;
};
