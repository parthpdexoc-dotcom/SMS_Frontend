/**
 * Utility functions for the application
 */

import { extractYyyyMmDdPrefix, formatTimeToHHmm } from './dateTimeUtils';

export { formatCurrency } from './formatters';

/**
 * Combines class names into a single string
 */
export const cn = (...classes: (string | undefined | null | false)[]): string => {
  return classes.filter(Boolean).join(' ');
};

/**
 * US display MM/DD/YYYY with slashes (never hyphens).
 * Strings that start with `YYYY-MM-DD` (e.g. API or stored) are reformatted by string split only.
 * A {@link Date} from a calendar uses local year/month/day.
 */
export const formatDateShort = (date: Date | string): string => {
  if (typeof date === 'string') {
    const t = date.trim();
    if (!t) return '';
    const ymd = extractYyyyMmDdPrefix(t);
    if (ymd) {
      const [y, m, d] = ymd.split('-');
      return `${m}/${d}/${y}`;
    }
    return t;
  }
  if (date instanceof Date) {
    if (Number.isNaN(date.getTime())) return '';
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  }
  return '';
};

/** @alias formatDateShort — long month names are not used for app-wide consistency. */
export const formatDate = (date: Date | string): string => formatDateShort(date);

/**
 * Date cell with API day-of-week prefix on two lines: `WED\n05/27/26` when `dayOfWeek` is present.
 * Day label preserves API casing (e.g. `WED` stays `WED`).
 */
export const formatDateWithDayOfWeek = (
  startDate: string,
  dayOfWeek?: string | null
): string => {
  if (!startDate) return '';
  const dow = (dayOfWeek ?? '').trim();
  if (!dow) return startDate;
  const abbrev = dow.length > 3 ? dow.slice(0, 3) : dow;
  return `${abbrev}\n${formatDateShort(startDate)}`;
};

/** Same leading `YYYY-MM-DD` rule as {@link formatDateShort}; returns local start-of-day for calendar math. */
export const parseLocalDateFromString = (value: string | null | undefined): Date | null => {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  const ymd = extractYyyyMmDdPrefix(s);
  if (ymd) {
    const [ys, ms, ds] = ymd.split('-');
    const y = parseInt(ys, 10);
    const mo = parseInt(ms, 10) - 1;
    const d = parseInt(ds, 10);
    const local = new Date(y, mo, d);
    if (Number.isNaN(local.getTime())) return null;
    return new Date(local.getFullYear(), local.getMonth(), local.getDate());
  }
  return null;
};

/**
 * Time portion as HH:mm (24-hour, zero-padded). API strings use {@link formatTimeToHHmm} (no browser TZ shift).
 */
export const formatTime = (
  input: string | Date | null | undefined,
  fallback: string = ''
): string => {
  if (input == null) return fallback;
  if (typeof input === 'string') {
    const t = formatTimeToHHmm(input);
    return t || fallback;
  }
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return fallback;
    const h = String(input.getHours()).padStart(2, '0');
    const m = String(input.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
  return fallback;
};

/**
 * Date + time as MM/DD/YYYY HH:mm. API strings use {@link formatDateShort} and {@link formatTimeToHHmm}.
 */
export const formatDateTime = (
  input: string | Date | null | undefined,
  fallback: string = ''
): string => {
  if (input == null || (typeof input === 'string' && !input.trim())) return fallback;
  if (typeof input === 'string') {
    const timePart = formatTimeToHHmm(input);
    const datePart = formatDateShort(input);
    return timePart ? `${datePart} ${timePart}` : datePart;
  }
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return fallback;
    return `${formatDateShort(input)} ${formatTime(input, '')}`;
  }
  return fallback;
};

/**
 * Formats a number with commas
 */
export const formatNumber = (num: number): string => {
  return num.toLocaleString('en-US');
};

/**
 * Debounce function
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Determines if the current route should hide the sidebar for form pages
 * Form pages are routes that end with /add or match /edit/:id pattern
 * But NOT list pages like /admin/skills
 * Also keeps sidebar visible for department, department-configuration, requester, employee, and request form pages
 */
export const shouldHideSidebarOnFormPage = (pathname: string): boolean => {
  // Full-bleed Daily Workspace / Employee Location detail (list route keeps the sidebar).
  if (/^\/personnel\/daily-workspace\/[^/]+$/.test(pathname)) {
    return true;
  }
  if (/^\/personnel\/employee-location\/[^/]+$/.test(pathname)) {
    return true;
  }
  // List pages where add/edit open in a modal (sidebar stays visible)
  const isModalListPage =
    pathname.startsWith('/admin/skills') ||
    pathname.startsWith('/admin/equipment-type') ||
    pathname.startsWith('/admin/business-type') ||
    pathname.startsWith('/admin/payment-type') ||
    pathname.startsWith('/admin/employee-status') ||
    pathname.startsWith('/admin/routing-group') ||
    pathname.startsWith('/admin/holiday-day') ||
    pathname.startsWith('/employee/response-area') ||
    pathname.startsWith('/employee/employee-type') ||
    pathname.startsWith('/employee/department-division') ||
    pathname.startsWith('/employee/department-activity-type') ||
    pathname.startsWith('/employee/department-equipment') ||
    pathname.startsWith('/employee/department-fee');
  const keepSidebarVisible =
    pathname.includes('/department/') ||
    pathname.includes('/department-configuration/') ||
    pathname.includes('/department-invoice-config/') ||
    pathname.includes('/requester/') ||
    pathname.includes('/employee/') ||
    pathname.includes('/personnel/request/') ||
    pathname.includes('/personnel/job-position/') ||
    pathname.includes('/personnel/post-position/') ||
    pathname.includes('/email-templates/') ||
    isModalListPage;
  return (
    (pathname.endsWith('/add') && !keepSidebarVisible) ||
    (/\/edit\/[^/]+$/.test(pathname) && !keepSidebarVisible)
  );
};

/**
 * Calculates end time based on start time (HH:MM) and length in hours
 */
export const getEndTime = (startTime?: string, length?: number): string | null => {
  if (!startTime || !length) return null;
  const [hours, minutes] = startTime.split(':').map(Number);
  const endHours = (hours + length) % 24;
  return `${endHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

export * from './formatters';
export * from './smsTelephone';
export * from './dateTimeUtils';
export * from './postGridColumns';
export * from './employeePostListingItem';
export * from './validationUtils';
export * from './objectUtils';
export * from './activityFormUtils';
export * from './personName';
export * from './listFilterMode';
export * from './suspension';
export * from './emailUtils';
export * from './notificationApiUtils';