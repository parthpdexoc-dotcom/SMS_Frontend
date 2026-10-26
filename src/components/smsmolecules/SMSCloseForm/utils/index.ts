/**
 * Shared utilities for CloseForm and step components.
 */
import type { VehicleDetail } from '@/types/postCloseForm';

export const formatBool = (value?: boolean | null): string => {
  if (value === null || value === undefined) return '-';
  return value ? 'Yes' : 'No';
};

export const formatNumber = (value?: number | null): string => {
  if (value === null || value === undefined) return '-';
  return String(value);
};

/** Prevent negative number input in numeric fields */
export const isNegativeNumberInput = (value: string): boolean => value.trim().startsWith('-');

const MAX_MILEAGE_DECIMALS = 2;

/**
 * Allow only non-negative mileage with at most one decimal point and MAX_MILEAGE_DECIMALS fractional digits.
 * Preserves a trailing "." while typing (e.g. "12.").
 */
export const sanitizeMileageInput = (raw: string): string => {
  if (!raw) return '';
  const cleaned = raw.replace(/[^\d.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) return cleaned;
  const intPart = cleaned.slice(0, firstDot);
  let frac = cleaned.slice(firstDot + 1).replace(/\./g, '');
  frac = frac.slice(0, MAX_MILEAGE_DECIMALS);
  if (cleaned.endsWith('.') && frac.length === 0) {
    return intPart === '' ? '0.' : `${intPart}.`;
  }
  return frac.length > 0 ? `${intPart}.${frac}` : intPart;
};

/** Normalize a completed mileage string to exactly two decimal places for display/storage on blur. */
export const formatMileageTwoDecimals = (value: string): string => {
  const t = value.trim();
  if (t === '' || t === '.') return '';
  const n = parseFloat(t);
  if (Number.isNaN(n) || n < 0) return '';
  return n.toFixed(MAX_MILEAGE_DECIMALS);
};

/** When hydrating from API, coerce numeric mileage to two decimal places; keep non-numeric text as-is. */
export const normalizeMileageFromApi = (raw: unknown): string => {
  const s = String(raw ?? '').trim();
  if (s === '') return '';
  const n = parseFloat(s);
  if (!Number.isNaN(n) && n >= 0) return n.toFixed(MAX_MILEAGE_DECIMALS);
  return s;
};

/** Total mileage = end − start; clamp at 0; always two decimal places when both values are valid numbers. */
export const getTotalMileageDisplay = (detail: VehicleDetail): string => {
  const start = parseFloat(detail.startMileage);
  const end = parseFloat(detail.endMileage);
  if (Number.isNaN(start) || Number.isNaN(end)) return '';
  const total = end - start;
  return (total < 0 ? 0 : total).toFixed(MAX_MILEAGE_DECIMALS);
};
