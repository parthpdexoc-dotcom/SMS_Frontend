/**
 * formatting utilities
 */

/**
 * Formats a phone/fax number to XXX-XXX-XXXX while you type.
 * - Strips non-digits
 * - Keeps up to 10 digits
 * - Applies 3-3-4 grouping with dashes
 */
export const formatPhoneNumber = (value: string): string => {
    if (!value) return value;
    // Remove everything except digits and keep up to 10 digits
    const digits = value.replace(/[^\d]/g, '').slice(0, 10);
    const len = digits.length;

    if (len <= 3) return digits;
    if (len <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
};

/**
 * Formats a zip code to XXXXX or XXXXX-XXXX
 */
export const formatZipCode = (value: string): string => {
    if (!value) return value;
    const zipCode = value.replace(/[^\d]/g, '');
    const zipCodeLength = zipCode.length;
    if (zipCodeLength < 6) return zipCode;
    return `${zipCode.slice(0, 5)}-${zipCode.slice(5, 9)}`;
};

const USD_CURRENCY_FORMAT: Intl.NumberFormatOptions = {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
};

/**
 * Formats a currency value for display as $X,XXX.XX (USD).
 * @param fallback Returned when value is empty, null, undefined, or invalid (default '').
 */
export const formatCurrency = (
    value: string | number | null | undefined,
    fallback = ''
): string => {
    if (value === '' || value === undefined || value === null) return fallback;

    let numStr = String(value).replace(/[^0-9.-]/g, '');

    const parts = numStr.split('.');
    if (parts.length > 2) {
        numStr = parts[0] + '.' + parts.slice(1).join('');
    }

    if (numStr === '' || numStr === '-' || numStr === '.') return fallback;

    const amount = parseFloat(numStr);
    if (isNaN(amount)) return fallback;

    return new Intl.NumberFormat('en-US', USD_CURRENCY_FORMAT).format(amount);
};

/**
 * Formats a date string to MM/DD/YYYY
 */
// ... existing code ...
export const formatDateInput = (value: string): string => {
    if (!value) return value;
    const dateStr = value.replace(/\D/g, ''); // Remove non-digits

    if (dateStr.length <= 2) {
        return dateStr;
    }
    if (dateStr.length <= 4) {
        return `${dateStr.slice(0, 2)}/${dateStr.slice(2)}`;
    }
    return `${dateStr.slice(0, 2)}/${dateStr.slice(2, 4)}/${dateStr.slice(4, 8)}`;
};

/**
 * Removes formatting from a phone number string
 */
export const unformatPhoneNumber = (value: string): string => {
    if (!value) return value;
    return value.replace(/[^\d]/g, '');
};

/**
 * Removes formatting from a zip code string
 */
export const unformatZipCode = (value: string): string => {
    if (!value) return value;
    return value.replace(/[^\d]/g, '');
};
