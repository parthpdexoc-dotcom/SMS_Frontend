/**
 * Mileage parsing and total calculation for close/split API payloads and forms.
 * Total = end − start, clamped at 0; values rounded to two decimal places.
 */

const FRACTION_DIGITS = 2;
const ROUND_FACTOR = 10 ** FRACTION_DIGITS;

const roundMileage = (n: number): number => Math.round(n * ROUND_FACTOR) / ROUND_FACTOR;

export const parseMileageForPayload = (raw: string | undefined): number | null => {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s === '') return null;
  const n = parseFloat(s);
  if (Number.isNaN(n)) return null;
  return roundMileage(n);
};

export const totalMileageFromStartEnd = (
  startRaw: string | undefined,
  endRaw: string | undefined
): number | null => {
  const start = parseMileageForPayload(startRaw);
  const end = parseMileageForPayload(endRaw);
  if (start == null || end == null) return null;
  const diff = end - start;
  return roundMileage(diff < 0 ? 0 : diff);
};
