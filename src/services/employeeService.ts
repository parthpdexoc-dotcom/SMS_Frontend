/**
 * Employee API Service
 * Handles all API calls related to Employees
 */

import { EmployeeResponse, EmployeeListParams, JsonPatchReplaceOperation } from '@/types/employee';
import { PagedResponse, SelectOptionDto } from '@/types/common';
import { apiGet, apiPost, apiDelete, apiPatch } from '@/utils/apiClient';
import { expectOkReadText, parseJsonText, readResponseOk } from '@/services/textPlainJson';
import { normalizeEmployee } from '@/utils/normalizers';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';
import { coalesceKeyedRequest } from '@/utils/coalesceKeyedRequest';

/**
 * Shared helpers for employee list/search responses
 */
const parseEmployeePagedResponse = (responseText: string): { data: EmployeeResponse[]; totalRecords: number } => {
  // Parse shared PagedResponse structure from common types
  const pagedResponse = parseJsonText<PagedResponse<Record<string, unknown>>>(responseText);

  const employees = (pagedResponse.data || []).map(normalizeEmployee);
  const totalRecords = pagedResponse.totalRecords || 0;

  return {
    data: employees,
    totalRecords,
  };
};

/**
 * Get employees with details (no server-side search filters).
 * Uses the standard list endpoint `/Employee/getallemployeewithdetails`.
 * @param pagination - Optional pagination parameters
 * @returns Promise with data array and totalRecords count
 */
export const getEmployees = async (pagination?: EmployeeListParams): Promise<{ data: EmployeeResponse[]; totalRecords: number }> => {
  try {
    const queryParams = buildPaginationQueryParams(pagination);
    const selectedId = typeof pagination?.selectedId === 'string' ? pagination.selectedId.trim() : '';
    if (selectedId) {
      queryParams.append('selectedId', selectedId);
    }
    const queryString = queryParams.toString();
    const endpoint = `/Employee/getallemployeewithdetails${queryString ? `?${queryString}` : ''}`;
    const response = await apiGet(endpoint);
    const responseText = await expectOkReadText(response, 'Failed to fetch employees');

    return parseEmployeePagedResponse(responseText);
  } catch (error) {
    console.error('Error fetching employees:', error);
    throw error;
  }
};

/**
 * Get employees from the new base endpoint used by Employee List page.
 * Endpoint: GET /Employee/getallemployees
 * @param pageParam - Optional pagination parameters
 * @param isactive - Optional filter for active status
 */
export const getAllEmployees = async (
  pageParam?: EmployeeListParams,
  isactive?: boolean
): Promise<{ data: EmployeeResponse[]; totalRecords: number }> => {
  try {
    const queryParams = buildPaginationQueryParams(pageParam);
    const departmentId = typeof pageParam?.departmentId === 'string' ? pageParam.departmentId.trim() : '';
    if (departmentId) {
      queryParams.append('departmentId', departmentId);
    }

    // Add isactive parameter if provided
    if (isactive !== undefined) {
      queryParams.append('isactive', isactive.toString());
    }

    const queryString = queryParams.toString();
    const endpoint = `/Employee/getallemployees${queryString ? `?${queryString}` : ''}`;
    const response = await apiGet(endpoint);
    const responseText = await expectOkReadText(response, 'Failed to fetch employees');

    return parseEmployeePagedResponse(responseText);
  } catch (error) {
    console.error('Error fetching employees from getallemployees:', error);
    throw error;
  }
};

/**
 * Get employees for the Employee Jobs page.
 * Endpoint: GET /Employee/getallemployeesbyrankfilter
 */
export const getEmployeesByRankFilter = async (
  pageParam?: EmployeeListParams,
  isactive?: boolean
): Promise<{ data: EmployeeResponse[]; totalRecords: number }> => {
  try {
    const queryParams = buildPaginationQueryParams(pageParam);
    const departmentId = typeof pageParam?.departmentId === 'string' ? pageParam.departmentId.trim() : '';
    if (departmentId) {
      queryParams.append('departmentId', departmentId);
    }

    const searchTerm = pageParam?.searchTerm?.trim();
    if (searchTerm) {
      queryParams.append('searchTerm', searchTerm);
    }

    if (pageParam?.employeeTypeId) {
      queryParams.append('employeeTypeId', pageParam.employeeTypeId);
    }

    if (isactive !== undefined) {
      queryParams.append('isactive', isactive.toString());
    }

    const queryString = queryParams.toString();
    const endpoint = `/Employee/getallemployeesbyrankfilter${queryString ? `?${queryString}` : ''}`;
    const response = await apiGet(endpoint);
    const responseText = await expectOkReadText(response, 'Failed to fetch employee jobs employees');

    return parseEmployeePagedResponse(responseText);
  } catch (error) {
    console.error('Error fetching employees from getallemployeesbyrankfilter:', error);
    throw error;
  }
};

/**
 * Lightweight employee options for dropdowns.
 * Backend returns SelectOptionDto[] directly; no extra frontend binding/mapping here.
 */
export const getEmployeeOptions = async (
  searchTerm?: string
): Promise<SelectOptionDto[]> => {
  const body: Record<string, unknown> = {};
  const trimmedSearch = searchTerm?.trim();
  if (trimmedSearch) {
    body.searchTerm = trimmedSearch;
  }

  const response = await apiPost('/Employee/employeeoptions', body, {
    headers: { 'Content-Type': 'application/json' },
  });
  const responseText = await expectOkReadText(response, 'Failed to fetch employee options');
  return parseJsonText<SelectOptionDto[]>(responseText);
};

/**
 * Search/filter employees with details.
 * Uses the server-side search endpoint `/Employee/search`.
 * - Supports `searchTerm`, `employeeTypeId`, and `isactive` filters with pagination.
 * @param pagination - Optional pagination and search parameters
 * @param isactive - Optional filter for active status
 * @returns Promise with data array and totalRecords count
 */
export const searchEmployees = async (
  pagination?: EmployeeListParams,
  isactive?: boolean
): Promise<{ data: EmployeeResponse[]; totalRecords: number }> => {
  try {
    const queryParams = buildPaginationQueryParams(pagination);
    const searchTerm = pagination?.searchTerm?.trim();
    if (searchTerm) {
      queryParams.append('searchTerm', searchTerm);
    }
    if (pagination?.employeeTypeId) {
      queryParams.append('employeeTypeId', pagination.employeeTypeId);
    }
    const departmentId = typeof pagination?.departmentId === 'string' ? pagination.departmentId.trim() : '';
    if (departmentId) {
      queryParams.append('departmentId', departmentId);
    }

    // Add isactive parameter if provided
    if (isactive !== undefined) {
      queryParams.append('isactive', isactive.toString());
    }

    const queryString = queryParams.toString();
    const endpoint = `/Employee/search${queryString ? `?${queryString}` : ''}`;
    const response = await apiGet(endpoint);
    const responseText = await expectOkReadText(response, 'Failed to search employees');

    return parseEmployeePagedResponse(responseText);
  } catch (error) {
    console.error('Error searching employees:', error);
    throw error;
  }
};

/**
 * Create or update an employee (upsert operation)
 * @param employeeData - The employee data (employeeID present = update, absent = create)
 * @returns Promise<EmployeeResponse>
 */
export const upsertEmployee = async (employeeData: Record<string, unknown>): Promise<EmployeeResponse> => {
  try {
    const response = await apiPost('/Employee', employeeData, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const responseText = await readResponseOk(response, 'Failed to save employee');
    return normalizeEmployee(parseJsonText<Record<string, unknown>>(responseText));
  } catch (error) {
    console.error('Error saving employee:', error);
    throw error;
  }
};

/**
 * Get a single employee by ID with details
 * @param employeeId - The ID of the employee to fetch
 * @returns Promise<EmployeeResponse>
 */
export const getEmployeeById = async (employeeId: string): Promise<EmployeeResponse> =>
  coalesceKeyedRequest('getEmployeeById', employeeId, async () => {
    try {
      const response = await apiGet(`/Employee/${employeeId}`);
      const responseText = await expectOkReadText(response, 'Failed to fetch employee');
      return normalizeEmployee(parseJsonText<Record<string, unknown>>(responseText));
    } catch (error) {
      console.error('Error fetching employee by ID:', error);
      throw error;
    }
  });

/**
 * Get a single employee by employee number (badge number)
 * @param employeeNumber - The employee/badge number to fetch
 * @returns Promise<EmployeeResponse>
 */
export const getEmployeeByNumber = async (employeeNumber: string): Promise<EmployeeResponse> => {
  const response = await apiGet(`/Employee/by-employee-number/${encodeURIComponent(employeeNumber)}`);
  const responseText = await readResponseOk(response, 'Employee not found');
  return parseJsonText<EmployeeResponse>(responseText);
};

/**
 * Delete an employee by ID
 * @param employeeId - The ID of the employee to delete
 * @returns Promise<void>
 */
export const deleteEmployee = async (employeeId: string): Promise<void> => {
  try {
    const response = await apiDelete(`/Employee/${employeeId}`, {
      headers: {
        accept: '*/*',
      },
    });
    await readResponseOk(response, 'Failed to delete employee');
  } catch (error) {
    console.error('Error deleting employee:', error);
    throw error;
  }
};

/**
 * Partially update an employee using JSON Patch (RFC 6902).
 * PATCH /api/Employee/{id} with body = array of replace operations.
 * @param employeeId - The ID of the employee to update (from URL)
 * @param patchDoc - JSON Patch document: array of { op: 'replace', path: '/propertyName', value }
 * @returns Promise<EmployeeResponse>
 */
export const patchEmployee = async (
  employeeId: string,
  patchDoc: JsonPatchReplaceOperation[]
): Promise<EmployeeResponse> => {
  try {
    const response = await apiPatch(`/Employee/${employeeId}`, patchDoc, {
      headers: {
        'Content-Type': 'application/json-patch+json',
      },
    });
    const responseText = await readResponseOk(response, 'Failed to update employee');
    return normalizeEmployee(parseJsonText<Record<string, unknown>>(responseText));
  } catch (error) {
    console.error('Error patching employee:', error);
    throw error;
  }
};

/**
 * Get available managers for a requester
 * (Employees not already assigned as managers)
 * @param requesterId - Requester ID (GUID)
 * @returns Promise<EmployeeResponse[]>
 */
export const getAvailableManagers = async (requesterId: string): Promise<EmployeeResponse[]> => {
  try {
    const response = await apiGet(`/Employee/available-managers/${requesterId}`);
    const responseText = await expectOkReadText(response, 'Failed to fetch available managers');
    const data = parseJsonText<Record<string, unknown>[]>(responseText);
    return data.map(normalizeEmployee);
  } catch (error) {
    console.error('Error fetching available managers:', error);
    throw error;
  }
};

/**
 * Get available managers for a requester
 * (Employees not already assigned as managers)
 * @param requesterManagerId - Requester Manager ID (GUID)
 * @returns Promise<EmployeeResponse[]>
 */
export const getAvailableRequesterEmployees = async (requesterManagerId: string): Promise<EmployeeResponse[]> => {
  try {
    const response = await apiGet(`/Employee/available-requester-employee/${requesterManagerId}`);
    const responseText = await expectOkReadText(response, 'Failed to fetch available employees');
    const data = parseJsonText<Record<string, unknown>[]>(responseText);
    return data.map(normalizeEmployee);
  } catch (error) {
    console.error('Error fetching available employees:', error);
    throw error;
  }
};


