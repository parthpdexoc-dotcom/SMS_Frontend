import type { RequesterEmployee } from '@/types/requesterEmployee';
import type { RequesterManager } from '@/types/requesterManager';
import { ReleaseAs } from '@/types/request';
import { hasRole, UserRoleType } from '@/types/userRole';

export const MANAGED_RELEASE_GROUP_ID = 'managed-release-group';

export interface AvailablePostReleaseAccess {
  hasTenureAccess: boolean;
  hasPreferredAccess: boolean;
  showManagedGroup: boolean;
  managedSubTabValues: ReleaseAs[];
  topLevelTabValues: ReleaseAs[];
  /**
   * Requester employee or requester manager (context user): top = Cancelled | Open | Managed;
   * managed sub-tabs = Tenure Based | Managed | Preferred (one API call per sub-tab).
   */
  requesterEmployeeManagedUX?: boolean;
}

function normalizeId(id: string | undefined): string {
  return String(id ?? '').trim().toLowerCase();
}

/** True if this employee is a mapped requester employee or listed as a requester manager. */
export function hasRequesterEmployeeOrManagerContext(
  employeeID: string | undefined,
  requesterEmployees: RequesterEmployee[],
  requesterManagers: RequesterManager[]
): boolean {
  const norm = normalizeId(employeeID);
  if (!norm) return false;
  if (
    requesterEmployees.some((row) => normalizeId(row.employeeID) === norm)
  ) {
    return true;
  }
  if (
    requesterManagers.some((m) => normalizeId(m.employeeID) === norm)
  ) {
    return true;
  }
  return false;
}

function hasRequesterManagerContext(
  employeeID: string | undefined,
  requesterManagers: RequesterManager[]
): boolean {
  const norm = normalizeId(employeeID);
  if (!norm) return false;
  return requesterManagers.some((m) => normalizeId(m.employeeID) === norm);
}

function hasRequesterEmployeeContext(
  employeeID: string | undefined,
  requesterEmployees: RequesterEmployee[]
): boolean {
  const norm = normalizeId(employeeID);
  if (!norm) return false;
  return requesterEmployees.some((row) => normalizeId(row.employeeID) === norm);
}

/**
 * When true, `releaseAs` is under the Managed top tab (requester UX: TenureBased, Managed, or Preferred).
 */
export const isManagedGroupReleaseAs = (
  releaseAs: ReleaseAs,
  access?: Pick<AvailablePostReleaseAccess, 'requesterEmployeeManagedUX'>
): boolean => {
  if (access?.requesterEmployeeManagedUX) {
    return (
      releaseAs === ReleaseAs.Managed ||
      releaseAs === ReleaseAs.TenureBased ||
      releaseAs === ReleaseAs.Preferred
    );
  }
  return releaseAs === ReleaseAs.Managed || releaseAs === ReleaseAs.Preferred;
};

/**
 * Tabs for a plain employee with no requester-manager / requester-employee context
 * (see AVAILABLE_POST_REFACTOR_PLAN.md — Normal employee: Cancelled | Open | Tenure).
 */
export const getNormalEmployeeAvailablePostReleaseAccess = (): AvailablePostReleaseAccess => ({
  hasTenureAccess: true,
  hasPreferredAccess: false,
  showManagedGroup: false,
  managedSubTabValues: [],
  topLevelTabValues: [ReleaseAs.Cancelled, ReleaseAs.Open, ReleaseAs.TenureBased],
});

/** JWT tier None (0): no Release-as tabs; search still uses `ReleaseAs.Open` as default. */
export const getNoneAvailablePostReleaseAccess = (): AvailablePostReleaseAccess => ({
  hasTenureAccess: false,
  hasPreferredAccess: false,
  showManagedGroup: false,
  managedSubTabValues: [],
  topLevelTabValues: [],
});

export interface ResolveAvailablePostReleaseAccessOptions {
  isRequesterEmployeesLoading?: boolean;
  requesterManagers?: RequesterManager[];
  isRequesterManagersLoading?: boolean;
}

/** Values from JWT `ReleaseAsTabTier` claim (employee login). */
export type ReleaseAsTabTierClaim = 0 | 1 | 2 | 3;

/**
 * Release-as tabs from the `ReleaseAsTabTier` JWT claim only (must match backend tier).
 * - 0: no tabs (None)
 * - 1: full managed + preferred
 * - 2: requester employee without preferred
 * - 3: plain (Cancelled | Open | Tenure)
 * - undefined / missing claim: same as plain (re-login to get a stamped tier)
 */
export function resolveAvailablePostReleaseAccessFromJwt(
  releaseAsTabTier: ReleaseAsTabTierClaim | undefined
): AvailablePostReleaseAccess {
  if (releaseAsTabTier === 0) {
    return getNoneAvailablePostReleaseAccess();
  }
  if (releaseAsTabTier === 1) {
    return getRequesterManagerAvailablePostReleaseAccess();
  }
  if (releaseAsTabTier === 2) {
    return getRequesterEmployeeAvailablePostReleaseAccess(false);
  }
  return getNormalEmployeeAvailablePostReleaseAccess();
}

/**
 * Resolves which release-as tabs to show:
 * - Employee login with no requester context: Cancelled, Open, Tenure only (any employee role).
 * - While requester employee/manager lists are still loading: same three tabs.
 * - Requester manager/employee context: top tabs = Cancelled, Open, Managed.
 * - Managed sub-tabs:
 *   - requester manager: Tenure Based, Managed, Preferred
 *   - requester employee: Tenure Based, Managed (+ Preferred only when mapped preferred)
 * - Otherwise: legacy {@link getAvailablePostReleaseAccess} (no context).
 */
export function resolveAvailablePostReleaseAccess(
  requesterEmployees: RequesterEmployee[],
  employeeID: string | undefined,
  user: { userType?: 'Employee' | 'Admin'; roles?: string[] } | null | undefined,
  options: ResolveAvailablePostReleaseAccessOptions = {}
): AvailablePostReleaseAccess {
  const {
    isRequesterEmployeesLoading = false,
    requesterManagers = [],
    isRequesterManagersLoading = false,
  } = options;
  const normalizedEmployeeID = normalizeId(employeeID);

  const isDepartmentAdminPolicyUser =
    hasRole(user?.roles, UserRoleType.DepartmentAdmin) ||
    hasRole(user?.roles, UserRoleType.SuperUser);

  // Department admin policy users keep full managed release experience.
  if (isDepartmentAdminPolicyUser) {
    return getRequesterManagerAvailablePostReleaseAccess();
  }

  const isRequesterManager = hasRequesterManagerContext(employeeID, requesterManagers);
  const isRequesterEmployee = hasRequesterEmployeeContext(employeeID, requesterEmployees);
  const hasContext = isRequesterManager || isRequesterEmployee;

  // Only treat as "still resolving" if we do not yet know context; otherwise a mapped employee
  // should not wait for the manager list fetch before showing requester-context tabs.
  const resolvingRequesterContext =
    Boolean(normalizedEmployeeID) &&
    !hasContext &&
    ((requesterEmployees.length === 0 && isRequesterEmployeesLoading) ||
      (requesterManagers.length === 0 && isRequesterManagersLoading));

  const usePlainEmployeeTabs =
    Boolean(normalizedEmployeeID) &&
    (resolvingRequesterContext || !hasContext);

  if (usePlainEmployeeTabs) {
    return getNormalEmployeeAvailablePostReleaseAccess();
  }

  if (isRequesterManager) {
    return getRequesterManagerAvailablePostReleaseAccess();
  }

  if (isRequesterEmployee) {
    const employeeMappings = normalizedEmployeeID
      ? requesterEmployees.filter((row) => normalizeId(row.employeeID) === normalizedEmployeeID)
      : [];
    const hasPreferredAccess = employeeMappings.some((row) => row.isPreferred);
    return getRequesterEmployeeAvailablePostReleaseAccess(hasPreferredAccess);
  }

  return getAvailablePostReleaseAccess(
    requesterEmployees,
    employeeID,
    requesterManagers
  );
}

/** Requester manager context: top Cancelled|Open|Managed + managed sub-tabs Tenure|Managed|Preferred. */
export const getRequesterManagerAvailablePostReleaseAccess = (): AvailablePostReleaseAccess => ({
  hasTenureAccess: true,
  hasPreferredAccess: true,
  showManagedGroup: true,
  managedSubTabValues: [ReleaseAs.TenureBased, ReleaseAs.Managed, ReleaseAs.Preferred],
  topLevelTabValues: [ReleaseAs.Cancelled, ReleaseAs.Open, ReleaseAs.Managed],
  requesterEmployeeManagedUX: true,
});

/** Requester employee context: top Cancelled|Open|Managed + managed sub-tabs Tenure|Managed(+Preferred). */
export const getRequesterEmployeeAvailablePostReleaseAccess = (
  hasPreferredAccess: boolean
): AvailablePostReleaseAccess => ({
  hasTenureAccess: true,
  hasPreferredAccess,
  showManagedGroup: true,
  managedSubTabValues: [ReleaseAs.TenureBased, ReleaseAs.Managed, ...(hasPreferredAccess ? [ReleaseAs.Preferred] : [])],
  topLevelTabValues: [ReleaseAs.Cancelled, ReleaseAs.Open, ReleaseAs.Managed],
  requesterEmployeeManagedUX: true,
});

export const getAvailablePostReleaseAccess = (
  requesterEmployees: RequesterEmployee[],
  employeeID?: string,
  requesterManagers: RequesterManager[] = []
): AvailablePostReleaseAccess => {
  if (hasRequesterEmployeeOrManagerContext(employeeID, requesterEmployees, requesterManagers)) {
    if (hasRequesterManagerContext(employeeID, requesterManagers)) {
      return getRequesterManagerAvailablePostReleaseAccess();
    }
    const normalizedEmployeeID = normalizeId(employeeID);
    const employeeMappings = normalizedEmployeeID
      ? requesterEmployees.filter((row) => normalizeId(row.employeeID) === normalizedEmployeeID)
      : [];
    const hasPreferredAccess = employeeMappings.some((row) => row.isPreferred);
    return getRequesterEmployeeAvailablePostReleaseAccess(hasPreferredAccess);
  }

  const normalizedEmployeeID = normalizeId(employeeID);
  const employeeMappings = normalizedEmployeeID
    ? requesterEmployees.filter((row) => normalizeId(row.employeeID) === normalizedEmployeeID)
    : [];

  const hasTenureAccess = true;
  const hasPreferredAccess = employeeMappings.some((row) => row.isPreferred);
  const showManagedGroup = !hasTenureAccess || hasPreferredAccess;

  const managedSubTabValues = showManagedGroup
    ? [ReleaseAs.Managed, ...(hasPreferredAccess ? [ReleaseAs.Preferred] : [])]
    : [];

  const topLevelTabValues = [
    ReleaseAs.Cancelled,
    ReleaseAs.Open,
    ...(hasTenureAccess ? [ReleaseAs.TenureBased] : []),
    ...(showManagedGroup ? [ReleaseAs.Managed] : []),
  ];

  return {
    hasTenureAccess,
    hasPreferredAccess,
    showManagedGroup,
    managedSubTabValues,
    topLevelTabValues,
  };
};

export const getFallbackReleaseAs = (
  releaseAs: ReleaseAs,
  access: AvailablePostReleaseAccess
): ReleaseAs => {
  if (access.topLevelTabValues.length === 0) {
    return ReleaseAs.Open;
  }
  if (access.requesterEmployeeManagedUX) {
    if (releaseAs === ReleaseAs.Cancelled || releaseAs === ReleaseAs.Open) {
      return releaseAs;
    }
    if (
      releaseAs === ReleaseAs.TenureBased ||
      releaseAs === ReleaseAs.Managed ||
      releaseAs === ReleaseAs.Preferred
    ) {
      return releaseAs;
    }
    return ReleaseAs.TenureBased;
  }

  if (releaseAs === ReleaseAs.Cancelled || releaseAs === ReleaseAs.Open) {
    return releaseAs;
  }

  if (releaseAs === ReleaseAs.TenureBased) {
    return access.hasTenureAccess
      ? ReleaseAs.TenureBased
      : access.showManagedGroup
        ? ReleaseAs.Managed
        : ReleaseAs.Open;
  }

  if (releaseAs === ReleaseAs.Preferred) {
    return access.hasPreferredAccess
      ? ReleaseAs.Preferred
      : access.showManagedGroup
        ? ReleaseAs.Managed
        : ReleaseAs.Open;
  }

  if (releaseAs === ReleaseAs.Managed) {
    return access.showManagedGroup
      ? ReleaseAs.Managed
      : access.hasTenureAccess
        ? ReleaseAs.TenureBased
        : ReleaseAs.Open;
  }

  return access.showManagedGroup
    ? ReleaseAs.Managed
    : access.hasTenureAccess
      ? ReleaseAs.TenureBased
      : ReleaseAs.Open;
};
