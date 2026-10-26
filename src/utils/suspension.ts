import type { UserInfo } from '@/store/slices/authSlice';

const SUSPENDED_ROLE_NAME = 'issuspended';

function parseDateOnly(value: string | undefined): Date | null {
  if (!value) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;

  const datePart = normalized.includes('T') ? normalized.split('T')[0] : normalized;
  const parts = datePart.split('-').map((p) => Number(p));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;

  const [year, month, day] = parts;
  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function toDateKey(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function hasSuspendedRole(user: UserInfo | null | undefined): boolean {
  const primaryRole = String(user?.role ?? '').trim().toLowerCase();
  if (primaryRole === SUSPENDED_ROLE_NAME) return true;

  return (user?.roles ?? []).some(
    (role) => String(role).trim().toLowerCase() === SUSPENDED_ROLE_NAME
  );
}

/**
 * True when the user has role "isSuspended".
 * If skill date claims still exist, keep date-range behavior for backward compatibility.
 */
export function isSuspendedEmployeeActive(user: UserInfo | null | undefined, now: Date = new Date()): boolean {
  if (!user) return false;
  if (hasSuspendedRole(user)) return true;

  // Backward compatibility for older tokens that used Skills + date ranges.
  const hasLegacySuspendedSkill = (user.skills ?? []).some(
    (skill) => String(skill).trim().toLowerCase() === 'suspended'
  );
  if (!hasLegacySuspendedSkill) return false;

  const starts = user.skillsStartDates ?? [];
  const ends = user.skillsEndDates ?? [];
  const todayKey = toDateKey(now);

  const len = Math.max(starts.length, ends.length);
  for (let i = 0; i < len; i += 1) {
    const start = parseDateOnly(starts[i]);
    const end = parseDateOnly(ends[i]);
    if (!start || !end) continue;

    const startKey = toDateKey(start);
    const endKey = toDateKey(end);
    if (todayKey >= startKey && todayKey <= endKey) {
      return true;
    }
  }

  return false;
}

