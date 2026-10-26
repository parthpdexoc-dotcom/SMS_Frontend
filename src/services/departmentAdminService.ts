/**
 * DepartmentAdmin API Service
 * Handles all API calls related to Department Admin master data
 * Patterned after BusinessType service.
 */

import { apiDelete, apiGet, apiPost } from '@/utils/apiClient';
import {
  DepartmentAdminPaginationParams,
  DepartmentAdminResponse,
  CreateDepartmentAdminRequest,
  UpdateDepartmentAdminRequest,
} from '@/types/departmentAdmin';
import { expectOkReadText, parseJsonText, parseJsonTextArray, readResponseOk } from '@/services/textPlainJson';
import { normalizeDepartmentAdmin } from '@/utils/normalizers';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';

export const getDepartmentAdmins = async (
  pagination?: DepartmentAdminPaginationParams
): Promise<DepartmentAdminResponse[]> => {
  try {
    const queryParams = buildPaginationQueryParams(pagination);

    const endpoint = `/DepartmentAdmin${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await apiGet(endpoint);
    const responseText = await expectOkReadText(response, 'Failed to fetch department admins');
    return parseJsonTextArray<Record<string, unknown>>(responseText).map(normalizeDepartmentAdmin);
  } catch (error) {
    console.error('Error fetching department admins:', error);
    throw error;
  }
};

export const createDepartmentAdmin = async (
  data: CreateDepartmentAdminRequest
): Promise<DepartmentAdminResponse> => {
  try {
    const response = await apiPost('/DepartmentAdmin', data, {
      headers: { 'Content-Type': 'application/json' },
    });
    const responseText = await readResponseOk(response, 'Failed to create department admin');
    return normalizeDepartmentAdmin(parseJsonText<Record<string, unknown>>(responseText));
  } catch (error) {
    console.error('Error creating department admin:', error);
    throw error;
  }
};

export const updateDepartmentAdmin = async (
  data: UpdateDepartmentAdminRequest
): Promise<DepartmentAdminResponse> => {
  try {
    const response = await apiPost('/DepartmentAdmin', data, {
      headers: { 'Content-Type': 'application/json' },
    });
    const responseText = await readResponseOk(response, 'Failed to update department admin');
    return normalizeDepartmentAdmin(parseJsonText<Record<string, unknown>>(responseText));
  } catch (error) {
    console.error('Error updating department admin:', error);
    throw error;
  }
};

export const deleteDepartmentAdmin = async (departmentAdminID: string): Promise<void> => {
  try {
    const response = await apiDelete(`/DepartmentAdmin/${departmentAdminID}`, {
      headers: { accept: '*/*' },
    });
    await readResponseOk(response, 'Failed to delete department admin');
  } catch (error) {
    console.error('Error deleting department admin:', error);
    throw error;
  }
};

/**
 * GET DepartmentAdmin/employees/ids?departmentId={guid}&adminTypeId={guid}
 * Backend: [Route("api/[controller]")] -> api/DepartmentAdmin, [HttpGet("employees/ids")] returns IEnumerable<Guid>.
 * Used to bind the employee dropdown when opening Department Admin from the Departments grid (IA Admin).
 * Returns [] on any error so the form still opens (employee just won't be pre-bound).
 */
export const getDepartmentAdminEmployeeIds = async (
  departmentId: string,
  adminTypeId: string
): Promise<string[]> => {
  try {
    const departmentIdTrimmed = typeof departmentId === 'string' ? departmentId.trim() : '';
    const adminTypeIdTrimmed = typeof adminTypeId === 'string' ? adminTypeId.trim() : '';
    if (!departmentIdTrimmed || !adminTypeIdTrimmed) return [];

    const params = new URLSearchParams();
    params.set('departmentId', departmentIdTrimmed);
    params.set('adminTypeId', adminTypeIdTrimmed);
    const query = params.toString();
    const endpoint = `/DepartmentAdmin/employees/ids?${query}`;
    const response = await apiGet(endpoint);
    const responseText = await expectOkReadText(response, 'Failed to fetch department admin employee IDs');
    const raw = parseJsonText<unknown>(responseText);
    // Backend returns Ok(ids) -> IEnumerable<Guid> -> JSON array of GUID strings
    if (Array.isArray(raw)) {
      return raw.map((id) => (id != null ? String(id) : ''));
    }
    return [];
  } catch (error) {
    console.warn('Department admin employee IDs not available (endpoint may be missing):', error);
    return [];
  }
};


