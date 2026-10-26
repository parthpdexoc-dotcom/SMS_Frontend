import { SMSButton, SMSDropdown, SMSLabel, SMSTextField } from '@/components/smsatoms';
import React, { useState, useEffect } from 'react';
import { SMSModal as Modal } from '@/components/smsorganisms';
import { RecurrenceRule, RecurrenceUnit, MonthlyMode, WEEK_INDEX_OPTIONS } from '@/types/recurrence';
import { SHORT_WEEKDAYS } from './WeekdayChips';

import './RecurrenceSection.css';

interface CustomRecurrenceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (rule: RecurrenceRule) => void;
    initialRule: RecurrenceRule;
    startDate?: string;
}

export const CustomRecurrenceModal: React.FC<CustomRecurrenceModalProps> = ({
    isOpen,
    onClose,
    onSave,
    initialRule,
    startDate
}) => {
    const [rule, setRule] = useState<RecurrenceRule>(initialRule);

    useEffect(() => {
        if (isOpen) {
            // Initialize with deep copy or smart defaults
            const newRule = {
                ...initialRule,
                repeatUnit: initialRule.repeatUnit === RecurrenceUnit.NONE || initialRule.repeatUnit === RecurrenceUnit.CUSTOM ? RecurrenceUnit.DAY : initialRule.repeatUnit,
                interval: initialRule.interval || 1
            };

            // Ensure monthDays has a default if missing and we might use it (even if unit isn't MONTH yet, good to have ready)
            if (!newRule.monthDays || newRule.monthDays.length === 0) {
                const day = startDate ? new Date(startDate).getDate() : 1;
                newRule.monthDays = [day];
            }
            // Ensure monthlyMode has default
            if (!newRule.monthlyMode) {
                newRule.monthlyMode = MonthlyMode.BY_DATE;
            }

            setRule(newRule);
        }
    }, [isOpen, initialRule, startDate]);

    const updateRule = (updates: Partial<RecurrenceRule>) => {
        setRule(prev => ({ ...prev, ...updates }));
    };

    const handleUnitChange = (unit: RecurrenceUnit) => {
        updateRule({ repeatUnit: unit });
        // Set reasonable defaults if switching
        if (unit === RecurrenceUnit.WEEK && (!rule.weekDays || rule.weekDays.length === 0)) {
            const day = startDate ? new Date(startDate).getDay() : new Date().getDay();
            updateRule({ weekDays: [day] });
        }
    };

    const handleSave = () => {
        onSave(rule);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Custom Recurrence" overlayClassName="requester-list__assign-employees-modal-overlay">
            <div className="custom-recurrence-form">

                {/* Section 1: Interval */}
                <div className="custom-section">
                    <SMSLabel>Repeat every</SMSLabel>
                    <div className="custom-interval-row">
                        <SMSTextField
                            type="number"
                            value={String(rule.interval)}
                            onChange={(e) => updateRule({ interval: parseInt(e.target.value) || 1 })}
                            className="recurrence-input-small"
                            inputProps={{ min: 1 }}
                        />
                        <div className="custom-unit-radios">
                            <label>
                                <input type="radio" value={RecurrenceUnit.DAY} checked={rule.repeatUnit === RecurrenceUnit.DAY} onChange={() => handleUnitChange(RecurrenceUnit.DAY)} />
                                Day{rule.interval > 1 ? 's' : ''}
                            </label>
                            <label>
                                <input type="radio" value={RecurrenceUnit.WEEK} checked={rule.repeatUnit === RecurrenceUnit.WEEK} onChange={() => handleUnitChange(RecurrenceUnit.WEEK)} />
                                Week{rule.interval > 1 ? 's' : ''}
                            </label>
                            <label>
                                <input type="radio" value={RecurrenceUnit.MONTH} checked={rule.repeatUnit === RecurrenceUnit.MONTH} onChange={() => handleUnitChange(RecurrenceUnit.MONTH)} />
                                Month{rule.interval > 1 ? 's' : ''}
                            </label>
                        </div>
                    </div>
                </div>

                {/* Section 2: On... */}
                <div className="custom-section">
                    {rule.repeatUnit === RecurrenceUnit.DAY && <div className="text-muted">No extra options for daily</div>}

                    {rule.repeatUnit === RecurrenceUnit.WEEK && (
                        <div className="recurrence-weekdays-chips">
                            <SMSLabel>On</SMSLabel>
                            {SHORT_WEEKDAYS.map((day: { value: number; label: string }) => {
                                const isSelected = rule.weekDays?.includes(day.value);
                                return (
                                    <button
                                        key={day.value}
                                        type="button"
                                        className={`weekday-chip ${isSelected ? 'selected' : ''}`}
                                        onClick={() => {
                                            const current = rule.weekDays || [];
                                            let newDays = isSelected ? current.filter(d => d !== day.value) : [...current, day.value];
                                            updateRule({ weekDays: newDays });
                                        }}
                                    >
                                        {day.label}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {rule.repeatUnit === RecurrenceUnit.MONTH && (
                        <div className="recurrence-radio-group-vertical">
                            <label className="recurrence-radio-row">
                                <input
                                    type="radio"
                                    name="customMonthlyMode"
                                    checked={rule.monthlyMode === MonthlyMode.BY_DATE}
                                    onChange={() => updateRule({ monthlyMode: MonthlyMode.BY_DATE })}
                                />
                                <span>on the {(rule.monthDays && rule.monthDays[0]) || (startDate ? new Date(startDate).getDate() : 1)}th</span>
                            </label>
                            <label className="recurrence-radio-row">
                                <input
                                    type="radio"
                                    name="customMonthlyMode"
                                    checked={rule.monthlyMode === MonthlyMode.BY_PATTERN}
                                    onChange={() => {
                                        const updates: Partial<RecurrenceRule> = { monthlyMode: MonthlyMode.BY_PATTERN };
                                        if (rule.weekIndex == null) updates.weekIndex = 1;
                                        updateRule(updates);
                                    }}
                                />
                                <span style={{ marginRight: '8px' }}>on the</span>
                                <div style={{ minWidth: '100px', marginRight: '8px' }}>
                                    <SMSDropdown
                                        options={WEEK_INDEX_OPTIONS}
                                        value={String(rule.weekIndex ?? 1)}
                                        onChange={(e) =>
                                          updateRule({ weekIndex: Number(e.target.value) })
                                        }
                                        disabled={rule.monthlyMode !== MonthlyMode.BY_PATTERN}
                                    />
                                </div>
                                <div style={{ minWidth: '140px', marginLeft: '8px' }}>
                                    <div className="recurrence-weekdays-chips" style={{ display: 'inline-flex', gap: '4px', flexWrap: 'nowrap' }}>
                                        {SHORT_WEEKDAYS.map((day: { value: number; label: string }) => {
                                            const isSelected = rule.weekDays?.includes(day.value);
                                            return (
                                                <button
                                                    key={day.value}
                                                    type="button"
                                                    className={`weekday-chip ${isSelected ? 'selected' : ''}`}
                                                    disabled={rule.monthlyMode !== MonthlyMode.BY_PATTERN}
                                                    onClick={() => {
                                                        const current = rule.weekDays || [];
                                                        let newDays;
                                                        if (isSelected) {
                                                            newDays = current.filter(d => d !== day.value);
                                                        } else {
                                                            newDays = [...current, day.value];
                                                        }
                                                        updateRule({ weekDays: newDays });
                                                    }}
                                                >
                                                    {day.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </label>
                        </div>
                    )}
                </div>



                <div className="custom-recurrence-form__footer">
                    <SMSButton onClick={onClose}>Cancel</SMSButton>
                    <SMSButton onClick={handleSave}>Done</SMSButton>
                </div>
            </div>
        </Modal>
    );
};

