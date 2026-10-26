import { formatDateShort } from '@/utils';
import { formatDateToYYYYMMDD } from '@/utils/dateTimeUtils';

/** Read effective start/end from API row (camelCase or PascalCase). */
export function pickEquipmentEffectiveDate(
  row: Record<string, unknown>,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const v = row[key];
    if (v == null) continue;
    const s = String(v).trim();
    if (!s) continue;
    const day = s.split('T')[0]!;
    if (/^\d{4}-\d{2}-\d{2}$/.test(day)) return day;
    const parsed = formatDateToYYYYMMDD(new Date(s));
    if (parsed) return parsed.split('T')[0] ?? parsed;
  }
  return null;
}

export function formatEquipmentEffectiveDate(value: string | null | undefined): string {
  if (value == null || String(value).trim() === '') return '-';
  return formatDateShort(String(value).split('T')[0]!) || '-';
}

/** Normalize API/form date to `YYYY-MM-DD` for comparisons and SMSDatePicker min/max. */
export function toEquipmentDatePickerBound(value: string | null | undefined): string | undefined {
  if (value == null || String(value).trim() === '') return undefined;
  const t = String(value).trim();
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(t);
  if (iso) return iso[1];
  const mdy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (mdy) {
    const mm = mdy[1]!.padStart(2, '0');
    const dd = mdy[2]!.padStart(2, '0');
    return `${mdy[3]}-${mm}-${dd}`;
  }
  const parsed = formatDateToYYYYMMDD(new Date(t));
  if (!parsed) return undefined;
  const day = parsed.split('T')[0]!;
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : undefined;
}

export type EquipmentEffectiveDateValidation = {
  effectiveStartError?: string;
  effectiveEndError?: string;
};

/** Required effective dates must fall within the request period and end >= start. */
export function validateEquipmentEffectiveDateRange(
  startRaw: string,
  endRaw: string,
  requestStartDate?: string,
  requestEndDate?: string,
  messages?: {
    startRequired?: string;
    endRequired?: string;
    requestPeriodRequired?: string;
    startOutOfRange?: string;
    endOutOfRange?: string;
    endBeforeStart?: string;
  }
): EquipmentEffectiveDateValidation {
  const start = toEquipmentDatePickerBound(startRaw);
  const end = toEquipmentDatePickerBound(endRaw);
  const reqMin = toEquipmentDatePickerBound(requestStartDate);
  const reqMax = toEquipmentDatePickerBound(requestEndDate);

  if (!start) {
    return { effectiveStartError: messages?.startRequired ?? 'Effective Start Date is required.' };
  }
  if (!end) {
    return { effectiveEndError: messages?.endRequired ?? 'Effective End Date is required.' };
  }
  if (!reqMin || !reqMax) {
    const msg =
      messages?.requestPeriodRequired ??
      'Set the request Start Date and End Date before assigning effective dates.';
    return { effectiveStartError: msg, effectiveEndError: msg };
  }
  if (start < reqMin || start > reqMax) {
    return {
      effectiveStartError:
        messages?.startOutOfRange ??
        'Effective Start Date must be within the request start and end dates.',
    };
  }
  if (end < reqMin || end > reqMax) {
    return {
      effectiveEndError:
        messages?.endOutOfRange ??
        'Effective End Date must be within the request start and end dates.',
    };
  }
  if (end < start) {
    return {
      effectiveEndError:
        messages?.endBeforeStart ??
        'Effective End Date cannot be before Effective Start Date.',
    };
  }
  return {};
}

/** True when both effective dates exist, end >= start, and the range lies within the request period. */
export function isEquipmentEffectiveRangeWithinRequestPeriod(
  itemStart: string | null | undefined,
  itemEnd: string | null | undefined,
  requestStartDate?: string | null,
  requestEndDate?: string | null
): boolean {
  const start = toEquipmentDatePickerBound(itemStart);
  const end = toEquipmentDatePickerBound(itemEnd);
  const reqMin = toEquipmentDatePickerBound(requestStartDate);
  const reqMax = toEquipmentDatePickerBound(requestEndDate);
  if (!start || !end || !reqMin || !reqMax) return false;
  if (end < start) return false;
  return start >= reqMin && start <= reqMax && end >= reqMin && end <= reqMax;
}

/** Clamp rows that fall outside the request period (e.g. after async equipment load). */
export function alignEquipmentToRequestPeriod<T extends { startDate?: string | null; endDate?: string | null }>(
  items: T[],
  requestStartDate?: string | null,
  requestEndDate?: string | null
): T[] {
  const reqStart = toEquipmentDatePickerBound(requestStartDate);
  const reqEnd = toEquipmentDatePickerBound(requestEndDate);
  if (!reqStart || !reqEnd) return items;
  return items.map((item) =>
    isEquipmentEffectiveRangeWithinRequestPeriod(item.startDate, item.endDate, requestStartDate, requestEndDate)
      ? item
      : { ...item, startDate: reqStart, endDate: reqEnd }
  );
}

export function hasRequestDatesChanged(
  initialStart?: string | null,
  initialEnd?: string | null,
  currentStart?: string | null,
  currentEnd?: string | null
): boolean {
  const toKey = (value?: string | null) => toEquipmentDatePickerBound(value) ?? '';
  return toKey(initialStart) !== toKey(currentStart) || toKey(initialEnd) !== toKey(currentEnd);
}

/** Set every row's effective dates to the full request period. */
export function applyRequestPeriodToAllEquipment<T extends { startDate?: string | null; endDate?: string | null }>(
  items: T[],
  requestStartDate?: string | null,
  requestEndDate?: string | null
): T[] {
  const reqStart = toEquipmentDatePickerBound(requestStartDate);
  const reqEnd = toEquipmentDatePickerBound(requestEndDate);
  if (!reqStart || !reqEnd || items.length === 0) return items;
  return items.map((item) => ({ ...item, startDate: reqStart, endDate: reqEnd }));
}

/** After API load: full sync if request dates already changed, otherwise only fix out-of-range rows. */
export function resolveRequestEquipmentDates<T extends { startDate?: string | null; endDate?: string | null }>(
  items: T[],
  requestStartDate?: string | null,
  requestEndDate?: string | null,
  requestDatesChanged = false
): T[] {
  return requestDatesChanged
    ? applyRequestPeriodToAllEquipment(items, requestStartDate, requestEndDate)
    : alignEquipmentToRequestPeriod(items, requestStartDate, requestEndDate);
}
