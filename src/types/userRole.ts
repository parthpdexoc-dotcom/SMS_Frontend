/**
 * User role type enum (matches backend UserRoleType).
 */
export enum UserRoleType {
  SuperUser = 0,
  Admin = 1,
  DepartmentAdmin = 2,
  RegularEmployee = 3,
  Operator = 4,
  RequesterManager = 5,
  HRAdmin = 6,
  IAAdmin = 7,
  FiscalAdmin = 8,
}

/**
 * Admin-type names used from JWT `AdminTypes` claim for feature gating.
 */
export enum AdminTypeName {
  DepartmentAdmin = 'Department Admin',
  CommCenter = 'Comm Center',
}

/** Role name string for a given enum value (e.g. UserRoleType.SuperUser -> "SuperUser"). */
export function getRoleName(role: UserRoleType): string {
  return UserRoleType[role] as string;
}

/** Normalize role string for comparison (trim, remove spaces, lowercase) so "HR Admin" matches "HRAdmin". */
function normalizeRoleForMatch(r: string): string {
  return r.replace(/\s/g, '').toLowerCase();
}

/** Returns true if the user's roles array includes the given role. Use with UserRoleType enum. */
export function hasRole(roles: string[] | undefined, role: UserRoleType): boolean {
  if (!roles?.length) return false;
  const name = getRoleName(role);
  const nameNorm = normalizeRoleForMatch(name);
  return roles.some((r) => normalizeRoleForMatch(r) === nameNorm);
}
