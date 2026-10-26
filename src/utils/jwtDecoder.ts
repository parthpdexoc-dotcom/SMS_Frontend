/**
 * JWT Token Decoder Utility
 * Decodes JWT tokens to extract user information and claims
 */

export interface DecodedToken {
  PrimaryEmail?: string;
  primaryEmail?: string;
  email?: string;
  Email?: string;
  upn?: string;
  preferred_username?: string;
  unique_name?: string;
  nameid?: string;
  sub?: string;
  jti?: string;
  iat?: number;
  exp?: number;
  EmployeeID?: string;
  EmployeeId?: string;
  Username?: string;
  BadgeNumber?: string;
  FirstName?: string;
  LastName?: string;
  FullName?: string;
  DepartmentID?: string;
  DepartmentName?: string;
  DepartmentCode?: string;
  EmployeeTypeID?: string;
  EmployeeTypeShort?: string;
  EmployeeTypeLong?: string;
  StatusID?: string;
  StatusShort?: string;
  StatusLong?: string;
  AdminTypes?: string;
  AdminTypeIDs?: string;
  IsSuperUser?: string;
  /** Role claim: backend sends JSON array of role strings; legacy tokens may use a single string. */
  role?: string | string[];
  Skills?: string | string[];
  SkillsStartDate?: string | string[];
  SkillsEndDate?: string | string[];
  /** Mirrors DepartmentConfiguration.EnableOpenAgencyWaitLists (employee login JWT). */
  EnableOpenWaitingList?: string | boolean;
  enableOpenWaitingList?: string | boolean;
  AllowEmployeeCancellation?: string | boolean;
  allowEmployeeCancellation?: string | boolean;
  EnableEmployeeSplittingPosts?: string | boolean;
  enableEmployeeSplittingPosts?: string | boolean;
  EnablePolicyManagement?: string | boolean;
  enablePolicyManagement?: string | boolean;
  UseAgencyDefinedFields?: string | boolean;
  useAgencyDefinedFields?: string | boolean;
  /** Available Post Release-as tab tier 0–3 (employee JWT); matches backend claim `ReleaseAsTabTier`. */
  ReleaseAsTabTier?: string | number;
  /** When true, client may load profile photo from employee photo API. */
  isLogo?: string | boolean;
  /** Admin account id (admin JWT). */
  AdminID?: string;
  adminID?: string;
  nbf?: number;
  iss?: string;
  aud?: string;
  [key: string]: unknown;
}

/**
 * Decode JWT token without verification (client-side only)
 * Note: This does NOT verify the token signature - that's done by the backend
 * @param token - The JWT token to decode
 * @returns Decoded token payload or null if invalid
 */
export const decodeToken = (token: string): DecodedToken | null => {
  try {
    // JWT has 3 parts: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // Decode the payload (second part)
    const payload = parts[1];
    
    // Add padding if needed (base64url decoding)
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    
    // Decode from base64
    const decoded = atob(padded);
    
    // Parse JSON
    return JSON.parse(decoded) as DecodedToken;
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
};

/**
 * Check if token is expired
 * @param token - The JWT token to check
 * @returns true if expired, false if valid, null if cannot determine
 */
export const isTokenExpired = (token: string): boolean | null => {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) {
    return null;
  }

  // exp is in seconds, Date.now() is in milliseconds
  const expirationTime = decoded.exp * 1000;
  const currentTime = Date.now();

  return currentTime >= expirationTime;
};

/**
 * Get user information from JWT token
 * @param token - The JWT token
 * @returns User information object or null
 */
export const getUserFromToken = (token: string) => {
  const decoded = decodeToken(token);
  if (!decoded) {
    return null;
  }

  const isSupervisorRaw = decoded.IsSupervisor ?? decoded.isSupervisor;
  const enableOpenRaw = decoded.EnableOpenWaitingList ?? decoded.enableOpenWaitingList;
  const allowCancelRaw = decoded.AllowEmployeeCancellation ?? decoded.allowEmployeeCancellation;
  const enableSplitRaw = decoded.EnableEmployeeSplittingPosts ?? decoded.enableEmployeeSplittingPosts;
  const enablePolicyMgmtRaw = decoded.EnablePolicyManagement ?? decoded.enablePolicyManagement;
  const useAgencyFieldsRaw = decoded.UseAgencyDefinedFields ?? decoded.useAgencyDefinedFields;
  const releaseAsTabTierRaw = decoded.ReleaseAsTabTier;
  const isLogoRaw = decoded.isLogo;
  const roles = normalizeRoleClaim(decoded.role);

  const employeeIdClaim = decoded.EmployeeID || decoded.EmployeeId;
  const adminIdClaim =
    (typeof decoded.AdminID === 'string' && decoded.AdminID.trim()) ||
    (typeof decoded.adminID === 'string' && decoded.adminID.trim()) ||
    undefined;

  return {
    employeeID: employeeIdClaim || decoded.nameid || decoded.sub,
    adminID: adminIdClaim || (!employeeIdClaim ? (decoded.nameid || decoded.sub) : undefined),
    username: decoded.Username || decoded.unique_name,
    badgeNumber: decoded.BadgeNumber,
    firstName: decoded.FirstName,
    lastName: decoded.LastName,
    fullName: decoded.FullName,
    departmentID: decoded.DepartmentID,
    departmentName: decoded.DepartmentName,
    departmentCode: decoded.DepartmentCode,
    employeeTypeID: decoded.EmployeeTypeID,
    employeeTypeShort: decoded.EmployeeTypeShort,
    employeeTypeLong: decoded.EmployeeTypeLong,
    statusID: decoded.StatusID,
    statusShort: decoded.StatusShort,
    statusLong: decoded.StatusLong,
    adminTypes: decoded.AdminTypes ? JSON.parse(decoded.AdminTypes) : [],
    adminTypeIDs: decoded.AdminTypeIDs ? JSON.parse(decoded.AdminTypeIDs) : [],
    isSuperUser: decoded.IsSuperUser === 'true',
    isSupervisor:
      typeof isSupervisorRaw === 'boolean'
        ? isSupervisorRaw
        : String(isSupervisorRaw).toLowerCase() === 'true',
    role: roles[0],
    roles,
    skills: normalizeStringClaim(decoded.Skills),
    skillsStartDates: normalizeStringClaim(decoded.SkillsStartDate),
    skillsEndDates: normalizeStringClaim(decoded.SkillsEndDate),
    enableOpenAgencyWaitLists: parseJwtBoolClaim(enableOpenRaw),
    allowEmployeeCancellation: parseJwtBoolClaim(allowCancelRaw),
    enableEmployeeSplittingPosts: parseJwtBoolClaim(enableSplitRaw),
    enablePolicyManagement: parseJwtBoolClaim(enablePolicyMgmtRaw),
    useAgencyDefinedFields: parseJwtBoolClaim(useAgencyFieldsRaw),
    releaseAsTabTier: parseJwtIntClaim(releaseAsTabTierRaw),
    isLogo: parseJwtBoolClaim(isLogoRaw) === true,
  };
};

/** Parse 0–3 for Available Post release tab tier; undefined if missing or invalid. */
function parseJwtIntClaim(value: unknown): 0 | 1 | 2 | 3 | undefined {
  if (typeof value === 'number' && (value === 0 || value === 1 || value === 2 || value === 3))
    return value as 0 | 1 | 2 | 3;
  if (typeof value !== 'string') return undefined;
  const n = parseInt(value.trim(), 10);
  if (n === 0 || n === 1 || n === 2 || n === 3) return n;
  return undefined;
}

function parseJwtBoolClaim(value: unknown): boolean | undefined {
  if (value === true) return true;
  if (value === false) return false;
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
    return undefined;
  }
  if (typeof value !== 'string') return undefined;
  const s = value.trim().toLowerCase();
  if (s === 'true' || s === '1' || s === 'yes') return true;
  if (s === 'false' || s === '0' || s === 'no') return false;
  return undefined;
}

/**
 * Normalize token `role` to string[]. Current API always uses a JSON array; older tokens may use one string.
 */
function normalizeRoleClaim(role: unknown): string[] {
  if (role == null) return [];
  if (Array.isArray(role)) {
    return role.filter((r): r is string => typeof r === 'string').map((r) => r.trim()).filter(Boolean);
  }
  if (typeof role === 'string') {
    const t = role.trim();
    return t ? [t] : [];
  }
  return [];
}

/**
 * Normalize token claims that may arrive as:
 * - JSON array string: '["Suspended"]'
 * - CSV-ish string: "Suspended,Other"
 * - plain string: "Suspended"
 * - string[]
 */
function normalizeStringClaim(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean);
  }
  if (typeof value !== 'string') return [];

  const raw = value.trim();
  if (!raw) return [];

  if (raw.startsWith('[') && raw.endsWith(']')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim())
          .filter(Boolean);
      }
    } catch {
      // Fall through to plain string parsing.
    }
  }

  if (raw.includes(',')) {
    return raw.split(',').map((item) => item.trim()).filter(Boolean);
  }

  return [raw];
}