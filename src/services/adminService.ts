/**
 * Admin API — profile load and JSON Patch update (RFC 6902 replace ops).
 */
import type { AdminProfileDto } from '@/types/admin';
import type { JsonPatchReplaceOperation } from '@/types/employee';
import { apiGet, apiPatch } from '@/utils/apiClient';
import { expectOkReadText, parseJsonText, readResponseOk } from '@/services/textPlainJson';

function normalizeAdminProfile(raw: Record<string, unknown>): AdminProfileDto {
  return {
    adminID: String(raw.adminID ?? raw.AdminID ?? ''),
    adminTypeID: String(raw.adminTypeID ?? raw.AdminTypeID ?? ''),
    firstName:
      raw.firstName === null || raw.FirstName === null
        ? null
        : String(raw.firstName ?? raw.FirstName ?? '').trim() || null,
    lastName:
      raw.lastName === null || raw.LastName === null
        ? null
        : String(raw.lastName ?? raw.LastName ?? '').trim() || null,
    userName: String(raw.userName ?? raw.UserName ?? '').trim(),
    status: Boolean(raw.status ?? raw.Status ?? false),
    // Omit password from client state (API may return hash; edits send plain text via PATCH only).
  };
}

export const getAdminById = async (adminId: string): Promise<AdminProfileDto> => {
  const id = adminId.trim();
  if (!id) {
    throw new Error('Admin ID is required');
  }
  const response = await apiGet(`/Admin/${id}`);
  const text = await expectOkReadText(response, 'Failed to load admin profile');
  return normalizeAdminProfile(parseJsonText<Record<string, unknown>>(text));
};

/**
 * PATCH /api/Admin/{id} with application/json-patch+json (replace only).
 */
export const patchAdminProfile = async (
  adminId: string,
  patchDoc: JsonPatchReplaceOperation[]
): Promise<AdminProfileDto> => {
  const id = adminId.trim();
  if (!id) {
    throw new Error('Admin ID is required');
  }
  const response = await apiPatch(`/Admin/${id}`, patchDoc, {
    headers: {
      'Content-Type': 'application/json-patch+json',
    },
  });
  const text = await readResponseOk(response, 'Failed to update admin profile');
  return normalizeAdminProfile(parseJsonText<Record<string, unknown>>(text));
};
