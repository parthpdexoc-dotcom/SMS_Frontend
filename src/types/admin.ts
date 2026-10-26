/**
 * Admin master record (aligns with backend AdminDto for profile PATCH).
 */
export interface AdminProfileDto {
  adminID: string;
  adminTypeID: string;
  firstName: string | null;
  lastName: string | null;
  userName: string;
  status: boolean;
  /** Never populated from GET for security; optional for typing PATCH round-trips. */
  password?: string | null;
}
