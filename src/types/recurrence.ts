// Enum matching backend RecurrenceUnit
export enum RecurrenceUnit {
    NONE = 1, // Matches RequestTypes.OneTime
    DAY = 2,   // Matches RequestTypes.Daily
    WEEK = 3,  // Matches RequestTypes.Weekly
    MONTH = 4, // Matches RequestTypes.Monthly
    CUSTOM = 5 // Matches RequestTypes.Custom
}

// Enum matching backend MonthlyMode
export enum MonthlyMode {
    BY_DATE = 1,
    BY_PATTERN = 2
}


export interface RecurrenceRule {
    repeatUnit: RecurrenceUnit;
    interval: number; // e.g., Every 2 days/weeks/months

    // Weekly specific
    weekDays?: number[]; // 0=Sunday, 1=Monday... 6=Saturday

    // Monthly specific
    monthlyMode?: MonthlyMode;
    monthDays?: number[]; // 1-31
    weekIndex?: number; // 0 (Every week), 1 (First), 2 (Second)... 5 (Last)

    // Custom/Advanced can reuse the above fields flexibly
}

export const WEEK_INDEX_OPTIONS = [
    { value: '0', label: 'Every week' },
    { value: '1', label: 'First' },
    { value: '2', label: 'Second' },
    { value: '3', label: 'Third' },
    { value: '4', label: 'Fourth' },
    { value: '5', label: 'Last' },
];

export const WEEK_INDEX_LABELS: Record<number, string> = {
    0: 'Every week',
    1: 'First',
    2: 'Second',
    3: 'Third',
    4: 'Fourth',
    5: 'Last',
};

export const InitialRecurrenceRule: RecurrenceRule = {
    repeatUnit: RecurrenceUnit.NONE,
    interval: 1,
    weekDays: [],
};


