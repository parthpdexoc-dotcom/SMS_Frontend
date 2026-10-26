import React from 'react';
import { SMSLabel } from '@/components/smsatoms';
import './RecurrenceSection.css';

interface WeekdayChipsProps {
    selectedDays: number[];
    onChange: (days: number[]) => void;
    disabled?: boolean;
    showLabel?: boolean;
    className?: string;
    inline?: boolean;
    /** When true, only render chips for selected days (e.g. ○ Mon ○ Fri), not all 7 days */
    showOnlySelected?: boolean;
    /**
     * "multi" (default): Request-style, multiple days toggle.
     * "single": at most one day (e.g. weekly cron) — select switches day; re-click clears selection.
     */
    selectionMode?: 'multi' | 'single';
}

export const SHORT_WEEKDAYS = [
    { value: 0, label: 'Sun' },
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
    { value: 6, label: 'Sat' },
] as const;

export const WeekdayChips: React.FC<WeekdayChipsProps> = ({ 
    selectedDays = [], 
    onChange, 
    disabled = false,
    showLabel = true,
    className = '',
    inline = false,
    showOnlySelected = false,
    selectionMode = 'multi',
}) => {
    const handleDayClick = (dayValue: number) => {
        if (disabled) return;
        
        const isSelected = selectedDays.includes(dayValue);

        if (selectionMode === 'single') {
            if (isSelected) {
                onChange([]);
            } else {
                onChange([dayValue]);
            }
            return;
        }
        
        let newDays: number[];
        
        if (isSelected) {
            newDays = selectedDays.filter(d => d !== dayValue);
        } else {
            newDays = [...selectedDays, dayValue];
        }
        
        onChange(newDays);
    };

    const daysToRender = showOnlySelected
        ? SHORT_WEEKDAYS.filter(day => selectedDays.includes(day.value))
        : SHORT_WEEKDAYS;

    const chipsContainer = (
        <div className={`recurrence-weekdays-chips ${className}`} style={inline ? { display: 'inline-flex', gap: '4px' } : undefined}>
            {daysToRender.map((day) => {
                const isSelected = selectedDays.includes(day.value);
                return (
                    <button
                        key={day.value}
                        type="button"
                        className={`weekday-chip ${isSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
                        disabled={disabled}
                        onClick={() => handleDayClick(day.value)}
                    >
                        {day.label}
                    </button>
                );
            })}
        </div>
    );

    if (!showLabel && inline) {
        return chipsContainer;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {showLabel && <SMSLabel>Days</SMSLabel>}
            {chipsContainer}
        </div>
    );
};
