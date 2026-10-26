export interface CurrencyFieldDisplayOptions {
  decimalPlaces?: number;
  emptyWhenZero?: boolean;
}

/** Currency input formatter — digits, one decimal, $ prefix, commas. */
export const formatCurrencyInput = (value: string, decimalPlaces = 2): string => {
  if (!value) return value;

  const cleanValue = value.replace(/[^0-9.]/g, '');
  const parts = cleanValue.split('.');

  let integerPart = parts[0];
  let decimalPart = parts.length > 1 ? '.' + parts[1].slice(0, decimalPlaces) : '';

  integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return `$${integerPart}${decimalPart}`;
};

/** Parses a currency string ($ and commas) to a number. */
export const parseCurrencyValue = (value: string): number | null => {
  if (!value || value.trim() === '') return null;
  const cleaned = value.replace(/[$,\s]/g, '');
  const parsed = parseFloat(cleaned);
  return Number.isNaN(parsed) ? null : parsed;
};

/** Formatted $ display for a numeric currency field value. */
export const toCurrencyFieldDisplay = (
  value: number | null | undefined,
  options?: CurrencyFieldDisplayOptions
): string => {
  const { decimalPlaces = 2, emptyWhenZero = true } = options ?? {};
  if (value == null || Number.isNaN(value)) return '';
  if (emptyWhenZero && value === 0) return '';
  return formatCurrencyInput(String(value), decimalPlaces);
};

/** Parse raw typed input into display + numeric value (preserves trailing "." while typing). */
export const processCurrencyFieldInput = (
  raw: string,
  decimalPlaces = 2
): { display: string; numeric: number | null } => {
  const formatted = formatCurrencyInput(raw, decimalPlaces);
  if (!formatted || formatted === '$') {
    return { display: '', numeric: null };
  }
  return {
    display: formatted,
    numeric: parseCurrencyValue(formatted),
  };
};
