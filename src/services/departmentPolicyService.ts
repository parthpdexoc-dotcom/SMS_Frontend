/**
 * Department Policy API Service
 * Backend: assumed DepartmentPolicy controller with standard CRUD.
 */

import { apiDelete, apiGet, apiPost } from '@/utils/apiClient';
import { DepartmentPolicyResponse } from '@/types/departmentPolicy';
import { expectOkReadText, parseJsonText, parseJsonTextArray, readResponseOk } from '@/services/textPlainJson';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';

// Matches backend route: POST https://localhost:7144/api/department-policy
const BASE = '/department-policy';

/**
 * Gets the department policy for the given department ID.
 * Uses GET /DepartmentPolicy (get all with pagination) and finds the item matching departmentID.
 * Returns null if none found (create mode).
 */
export const getDepartmentPolicyByDepartmentId = async (
  departmentId: string
): Promise<DepartmentPolicyResponse | null> => {
  try {
    const queryParams = buildPaginationQueryParams({ page: 1, pageSize: 500 });
    const response = await apiGet(`${BASE}?${queryParams.toString()}`);
    const text = await expectOkReadText(response, 'Failed to fetch department policies');
    const items = parseJsonTextArray<DepartmentPolicyResponse>(text);
    const match = items.find((item) => {
      const raw = item as unknown as Record<string, unknown>;
      const deptId = (raw.departmentID ?? raw.DepartmentID) as string | undefined;
      return String(deptId ?? '') === departmentId;
    });
    return match ?? null;
  } catch (err) {
    if (err instanceof Error && (err.message.includes('404') || err.message.includes('Not Found'))) {
      return null;
    }
    console.error('Error fetching department policy:', err);
    throw err;
  }
};

// Upsert (create or update) via single POST /api/department-policy
export const upsertDepartmentPolicy = async (
  payload: DepartmentPolicyResponse
): Promise<DepartmentPolicyResponse> => {
  const response = await apiPost(BASE, payload, {
    headers: {
      accept: 'text/plain',
      'Content-Type': 'application/json',
    },
  });
  const text = await readResponseOk(response, 'Failed to save department policy');
  return parseJsonText<DepartmentPolicyResponse>(text);
};

/**
 * DELETE /DepartmentPolicy/{id}. id is DepartmentPolicyID (primary key).
 */
export const deleteDepartmentPolicy = async (departmentPolicyID: string): Promise<void> => {
  const response = await apiDelete(`${BASE}/${departmentPolicyID}`, { headers: { accept: '*/*' } });
  if (!response.ok && response.status !== 204) {
    const text = await response.text();
    throw new Error(`Failed to delete department policy: ${response.status} ${text}`);
  }
};

