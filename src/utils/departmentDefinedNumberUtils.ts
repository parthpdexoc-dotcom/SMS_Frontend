/**
 * Department Defined Number (requester) format: YY-000001, YY-000002, …
 * YY = last two digits of the fiscal year (from Department Invoice Config when set, else current calendar year).
 */

const DDN_NUMERIC_PART = /^(\d{2})-(\d+)$/;

/**
 * Returns the 2-digit year prefix for new Department Defined Numbers.
 * @param fiscalYearFromInvoiceConfig - `DepartmentInvoiceConfig.fiscalYear` (e.g. "2026"); if missing/empty, uses `ref` calendar year.
 * @param ref - Used only when no valid fiscal year from config (default: now).
 */
export function getDepartmentDefinedNumberYearSuffix(
  fiscalYearFromInvoiceConfig?: string | null,
  ref: Date = new Date()
): string {
  const raw = (fiscalYearFromInvoiceConfig ?? '').trim();
  if (raw) {
    const y = parseInt(raw, 10);
    if (!Number.isNaN(y) && y >= 1000 && y <= 9999) {
      return String(y).slice(-2);
    }
    if (/^\d{2}$/.test(raw)) {
      return raw;
    }
  }
  return String(ref.getFullYear()).slice(-2);
}

/**
 * Next Department Defined Number for a given year prefix only.
 * Sequences are **per fiscal year prefix**: e.g. after `25-000009`, when the prefix becomes `26`,
 * the next id is `26-000001` (older `25-*` values are ignored). Within `26`, increments from
 * the max existing `26-NNNNNN` (e.g. `26-000001` → next is `26-000002`).
 */
export function computeNextDepartmentDefinedNumber(
  yearSuffix: string,
  existingValues: ReadonlyArray<string | undefined | null>
): string {
  let maxSeq = 0;
  for (const raw of existingValues) {
    const t = (raw ?? '').trim();
    const m = t.match(DDN_NUMERIC_PART);
    if (!m) continue;
    if (m[1] !== yearSuffix) continue;
    const n = parseInt(m[2], 10);
    if (!Number.isNaN(n) && n > maxSeq) {
      maxSeq = n;
    }
  }
  const next = maxSeq + 1;
  return `${yearSuffix}-${String(next).padStart(6, '0')}`;
}
