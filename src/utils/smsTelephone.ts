import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { formatPhoneNumber } from '@/utils/formatters';

export const DEFAULT_SMS_TELEPHONE_REGION = '+1';

export interface SplitSmsTelephoneNumber {
  region: string;
  phone: string;
  /** Value for the Material UI telephone input. */
  inputValue: string;
}

/** Split a stored SMS number (`+91635-536-7556`) into its calling code and local number. */
export function splitSmsTelephoneNumber(stored: string | null | undefined): SplitSmsTelephoneNumber {
  const raw = (stored || '').trim();
  if (!raw) {
    return { region: DEFAULT_SMS_TELEPHONE_REGION, phone: '', inputValue: DEFAULT_SMS_TELEPHONE_REGION };
  }

  const compact = raw.replace(/[^\d+]/g, '');
  const parsed = parsePhoneNumberFromString(compact.startsWith('+') ? compact : `+1${compact}`);
  if (!parsed?.countryCallingCode) {
    const phone = formatPhoneNumber(raw);
    return {
      region: DEFAULT_SMS_TELEPHONE_REGION,
      phone,
      inputValue: phone ? `+1${phone.replace(/\D/g, '')}` : '',
    };
  }

  const phone = formatPhoneNumber(parsed.nationalNumber);
  return {
    region: `+${parsed.countryCallingCode}`,
    phone,
    inputValue: parsed.formatInternational(),
  };
}

/**
 * Save value: calling code plus the formatted local number, e.g. `+91635-536-7556`.
 * Returns null when the local number is empty.
 */
export function joinSmsTelephoneNumber(
  region: string | null | undefined,
  phone: string | null | undefined
): string | null {
  const formatted = formatPhoneNumber(phone || '');
  if (!formatted) return null;
  const code = (region || DEFAULT_SMS_TELEPHONE_REGION).trim() || DEFAULT_SMS_TELEPHONE_REGION;
  return `${code}${formatted}`;
}
