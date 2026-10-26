import { DropdownOption } from '@/types';

/**
 * Timezone options for department dropdown
 * Uses Windows TimeZone ID strings that match backend expectations
 */
const TIMEZONE_OPTIONS: DropdownOption[] = [
  {
    value: 'Eastern Standard Time',
    label: 'Eastern Standard Time (EST/EDT)',
  },
  {
    value: 'Central Standard Time',
    label: 'Central Standard Time (CST/CDT)',
  },
  {
    value: 'Mountain Standard Time',
    label: 'Mountain Standard Time (MST/MDT)',
  },
  {
    value: 'Pacific Standard Time',
    label: 'Pacific Standard Time (PST/PDT)',
  },
  {
    value: 'Alaska Standard Time',
    label: 'Alaska Standard Time (AKST/AKDT)',
  },
  {
    value: 'Hawaiian Standard Time',
    label: 'Hawaiian Standard Time (HST)',
  },
];

/**
 * Get all timezone options for dropdown
 */
export const getTimeZoneOptions = (): DropdownOption[] => {
  return TIMEZONE_OPTIONS;
};

