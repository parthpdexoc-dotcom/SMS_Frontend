import { RecurrenceRule, RecurrenceUnit, MonthlyMode } from '@/types/recurrence';
import { RequestFormData } from '@/types/requestForm';
import { RequestTypeDto } from '@/types/request';

/**
 * Validates the recurrence rule state.
 * Returns an error string or null if valid.
 */
export const validateRecurrenceRule = (rule: RecurrenceRule, _startDate: string): string | null => {
    // If repeat is NONE, no further validation needed.
    if (rule.repeatUnit === RecurrenceUnit.NONE) return null;

    if (rule.interval < 1) return 'Interval must be at least 1.';

    if (rule.repeatUnit === RecurrenceUnit.WEEK) {
        if (!rule.weekDays || rule.weekDays.length === 0) {
            return 'Please select at least one day of the week.';
        }
    }

    if (Number(rule.repeatUnit) === RecurrenceUnit.MONTH) {
        // Default to ByDate if missing, but typically it should be set.
        const mode = Number(rule.monthlyMode) || MonthlyMode.BY_DATE;
        if (mode === MonthlyMode.BY_DATE) {
            if (!rule.monthDays || rule.monthDays.length === 0) {
                return 'Please select at least one day of the month.';
            }
        }
        if (mode === MonthlyMode.BY_PATTERN) {
            // weekIndex 0 is every week; 1-5 are First through Last
            if (rule.weekIndex == null || rule.weekIndex < 0 || rule.weekIndex > 5) {
                return 'Please select a week (e.g., First, Second).';
            }
            if (!rule.weekDays || rule.weekDays.length === 0) return 'Please select a day of the week.';
        }
    }

    return null;
};

/**
 * Maps the frontend RecurrenceRule to the backend-compatible RequestFormData fields.
 * Populates only the new `requestType` object (camelCase) which matches `RequestTypeDto`.
 */
export const mapRecurrenceToBackend = (
    rule: RecurrenceRule,
    _processDate?: string | null,
    _processTime?: string | null
): Partial<RequestFormData> & { requestType?: Partial<RequestTypeDto> } => {
    const typeNum = Number(rule.repeatUnit) as RecurrenceUnit;

    // Initialize RequestTypeDto-shaped object (camelCase keys)
    const requestTypeObj: Partial<RequestTypeDto> = {
        requestType: typeNum,
        repeatEvery: Number(rule.interval) || 1,
        daysOfWeek: undefined,
        daysOfMonth: undefined,
        monthlyMode: undefined,
        weekIndex: undefined,
        // requestTypeID and requestID are managed by backend
    };

    switch (typeNum) {
        case RecurrenceUnit.NONE:
            requestTypeObj.requestType = RecurrenceUnit.NONE;
            break;

        case RecurrenceUnit.DAY:
            requestTypeObj.requestType = RecurrenceUnit.DAY;
            break;

        case RecurrenceUnit.WEEK:
            requestTypeObj.requestType = RecurrenceUnit.WEEK;
            requestTypeObj.daysOfWeek = rule.weekDays ? rule.weekDays.map((d) => Number(d)) : [];
            break;

        case RecurrenceUnit.MONTH: {
            requestTypeObj.requestType = RecurrenceUnit.MONTH;

            const mMode = (Number(rule.monthlyMode) || MonthlyMode.BY_DATE) as MonthlyMode;
            requestTypeObj.monthlyMode = mMode;

            if (mMode === MonthlyMode.BY_DATE) {
                requestTypeObj.daysOfMonth = rule.monthDays ? rule.monthDays.map((d) => Number(d)) : [];
                requestTypeObj.weekIndex = undefined;
                requestTypeObj.daysOfWeek = undefined;
            } else if (mMode === MonthlyMode.BY_PATTERN) {
                const wIndex = rule.weekIndex == null ? 1 : Number(rule.weekIndex);
                requestTypeObj.weekIndex = wIndex;
                requestTypeObj.daysOfWeek = rule.weekDays ? rule.weekDays.map((d) => Number(d)) : [];
                requestTypeObj.daysOfMonth = undefined;
            }
            break;
        }

        case RecurrenceUnit.CUSTOM:
            requestTypeObj.requestType = RecurrenceUnit.CUSTOM;
            break;

        default:
            // Fallback: treat unknown enum values as one-time so UI doesn't show "Unknown"
            requestTypeObj.requestType = RecurrenceUnit.NONE;
            break;
    }

    return {
        requestType: requestTypeObj,
    };
};


/**
 * Reconstructs RecurrenceRule from backend RequestTypeDto.
 */
export const mapBackendToRecurrence = (
    data: {
        requestType?: RequestTypeDto;
        // Legacy fields support removed as they are dropped from backend
    }
): RecurrenceRule => {
    const rule: RecurrenceRule = {
        repeatUnit: RecurrenceUnit.NONE,
        interval: 1,
        weekDays: [],
    };

    if (data.requestType && data.requestType.requestType !== RecurrenceUnit.NONE) {
        rule.repeatUnit = data.requestType.requestType as RecurrenceUnit;
        rule.interval = data.requestType.repeatEvery || 1;
        rule.weekDays = data.requestType.daysOfWeek || [];
        rule.monthDays = data.requestType.daysOfMonth || [];
        rule.monthlyMode = (data.requestType.monthlyMode as MonthlyMode) || MonthlyMode.BY_DATE;
        rule.weekIndex = data.requestType.weekIndex;
        return rule;
    }

    return rule;
};
