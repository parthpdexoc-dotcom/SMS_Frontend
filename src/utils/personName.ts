/** "LastName, FirstName" display helper. */
/** LastName, FirstName */
export function formatLastNameCommaFirstName(
  firstName?: string | null,
  lastName?: string | null,
  fallback = '',
  options?: { requireBoth?: boolean }
): string {
  const f = String(firstName ?? '').trim();
  const l = String(lastName ?? '').trim();
  if (options?.requireBoth) {
    if (l && f) return `${l}, ${f}`;
    return fallback;
  }
  if (l && f) return `${l}, ${f}`;
  if (l) return l;
  if (f) return f;
  return fallback;
}

export function personNameSearchHaystack(firstName?: string | null, lastName?: string | null): string {
  const f = String(firstName ?? '').trim().toLowerCase();
  const l = String(lastName ?? '').trim().toLowerCase();
  const parts = [f, l];
  if (l && f) {
    parts.push(`${l}, ${f}`, `${f} ${l}`);
  }
  return parts.filter(Boolean).join(' ');
}

/** Match API/stored display strings that may be "Last, First" or legacy "First Last". */
export function personNameMatchesStoredDisplay(
  firstName?: string | null,
  lastName?: string | null,
  stored?: string | null
): boolean {
  const s = String(stored ?? '').trim().toLowerCase();
  if (!s) return false;
  const comma = formatLastNameCommaFirstName(firstName, lastName).toLowerCase();
  const f = String(firstName ?? '').trim();
  const l = String(lastName ?? '').trim();
  const space = [f, l].filter(Boolean).join(' ').toLowerCase();
  return s === comma || s === space;
}
