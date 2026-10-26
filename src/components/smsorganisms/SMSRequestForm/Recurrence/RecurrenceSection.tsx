import React from 'react';
import { RecurrenceRule, RecurrenceUnit } from '@/types/recurrence';
import { SMSLabel } from '@/components/smsatoms';
import { RecurrenceOptions } from './RecurrenceOptions';
import './RecurrenceSection.css';

interface RecurrenceSectionProps {
    value: RecurrenceRule;
    onChange: (rule: RecurrenceRule) => void;
    startDate?: string;
    onEditCustomRule?: () => void;
}

export const RecurrenceSection: React.FC<RecurrenceSectionProps> = ({ value, onChange, onEditCustomRule }) => {

    // Helper to generate summary text for Custom
    const getCustomSummary = () => {
        // e.g. "Every 2 weeks on Mon, Fri"
        let unitLabel = '';
        switch (value.repeatUnit) {
            case RecurrenceUnit.DAY: unitLabel = 'day'; break;
            case RecurrenceUnit.WEEK: unitLabel = 'week'; break;
            case RecurrenceUnit.MONTH: unitLabel = 'month'; break;
            case RecurrenceUnit.CUSTOM: unitLabel = 'custom'; break; // Should not happen usually in this context
            default: unitLabel = 'unit';
        }

        const unitStr = unitLabel + (value.interval > 1 ? 's' : '');
        let summary = `Every ${value.interval} ${unitStr}`;
        return summary;
    };

    const handleOptionsChange = (updates: Partial<RecurrenceRule>) => {
        onChange({ ...value, ...updates });
    };

    const isEffectivelyCustom = value.repeatUnit === RecurrenceUnit.CUSTOM || value.interval > 1;

    return (
        <div className="recurrence-section">
            {/* Configuration Area */}
            {/* Only show if there's something to configure */}
            {(value.repeatUnit !== RecurrenceUnit.NONE && value.repeatUnit !== RecurrenceUnit.DAY) && (
                <div className="recurrence-configuration-area">

                    {!isEffectivelyCustom && value.repeatUnit === RecurrenceUnit.WEEK && (
                        <div className="recurrence-config-content recurrence-config-content--horizontal">
                            <SMSLabel>On these days:</SMSLabel>
                            <RecurrenceOptions rule={value} onChange={handleOptionsChange} />
                        </div>
                    )}

                    {!isEffectivelyCustom && value.repeatUnit === RecurrenceUnit.MONTH && (
                        <div className="recurrence-config-content recurrence-config-content--horizontal">
                            <RecurrenceOptions rule={value} onChange={handleOptionsChange} />
                        </div>
                    )}

                    {isEffectivelyCustom && (
                        <div className="recurrence-config-content custom-config-summary">
                            <span className="custom-summary-text">{getCustomSummary()}</span>
                            <button
                                type="button"
                                className="custom-edit-button"
                                onClick={onEditCustomRule}
                            >
                                Edit Custom Rule
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
