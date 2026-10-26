/**
 * Requester Employee API Service
 *
 * API POST body shape (create/update):
 *   requesterManagerID, employeeID, isPreferred; update also sends requesterEmployeeID.
 *   Optional audit: createdDate, createdUserID, createdBy, editedDate, editedUserID, editedBy.
 * UI binding: managerID (form) = requesterManagerID (API); preferred = isPreferred.
 */

import type {
  RequesterEmployee,
  CreateRequesterEmployeeRequest,
  UpdateRequesterEmployeeRequest,
  RequesterEmployeePaginationParams,
} from '@/types/requesterEmployee';
import { apiGet, apiPost, apiDelete } from '@/utils/apiClient';
import { expectOkReadText } from '@/services/textPlainJson';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';
import { normalizeRequesterEmployee } from '@/utils/normalizers';

const ENDPOINT = '/RequesterEmployee';



export interface GetRequesterEmployeeListParams extends RequesterEmployeePaginationParams {
  requesterManagerID?: string;
}

// New response type to match backend DTO
export interface RequestEmployeeResponseDto extends RequesterEmployee {
  employeeName?: string;
}

export const getRequesterEmployeeList = async (
  params?: GetRequesterEmployeeListParams
): Promise<RequesterEmployee[]> => {
  const pagination = params
    ? { page: params.page, pageSize: params.pageSize }
    : undefined;
  const queryParams = buildPaginationQueryParams(pagination);
  if (params?.requesterManagerID) {
    queryParams.set('requesterManagerID', params.requesterManagerID);
  }

  // Use the new "with details" endpoint
  const endpoint = `/RequesterEmployee/getallRequestEmployeewithdetails${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

  const response = await apiGet(endpoint);
  const responseText = await expectOkReadText(response, 'Failed to fetch requester employee list');

  // The new endpoint returns a PagedList structure or standard list depending on backend implementation of "getallRequestEmployeewithdetails"
  // Based on the controller code: "return Ok(result);" where result is from _service.GetAllRequestEmployeeWithDetailsAsync(pageParam)
  // which returns PagedList<RequestEmployeeResponseDto>.
  // So we expect a JSON object with { items: [], totalCount: ... } or similar if it's paged,
  // OR just an array if the PagedList serialization just outputs the items (unlikely for our standard PagedList).
  // However, `parseListResponse` in this file was designed for the generic GetAll which might have been returning just an array or PagedList.
  // Let's inspect `normalizeRequesterEmployee` to see if it handles `EmployeeName`.

  const parsed = JSON.parse(responseText) as any;
  const items = Array.isArray(parsed) ? parsed : (parsed.items || parsed.data || []);

  const mappedItems = items.map((raw: any) => {
    const normalized = normalizeRequesterEmployee(raw);

    return normalized;
  });

  if (params?.requesterManagerID) {
    return mappedItems.filter((item: RequesterEmployee) =>
      item.requesterManagerID &&
      params.requesterManagerID &&
      String(item.requesterManagerID).toLowerCase() === String(params.requesterManagerID).toLowerCase()
    );
  }

  return mappedItems;
};

export const createRequesterEmployee = async (
  data: CreateRequesterEmployeeRequest
): Promise<RequesterEmployee> => {
  // Transform UI format to API format (PascalCase).
  const apiPayload = {
    RequesterManagerID: data.requesterManagerID,
    EmployeeID: data.employeeID,
    IsPreferred: data.isPreferred,
  };
  const response = await apiPost(ENDPOINT, apiPayload, {
    headers: { 'Content-Type': 'application/json' },
  });
  const responseText = await expectOkReadText(response, 'Failed to create requester employee');
  const raw = JSON.parse(responseText) as Record<string, unknown>;
  return normalizeRequesterEmployee(raw);
};

export const updateRequesterEmployee = async (
  data: UpdateRequesterEmployeeRequest
): Promise<RequesterEmployee> => {
  // Transform UI format to API format (PascalCase).
  const apiPayload = {
    RequesterEmployeeID: data.requesterEmployeeID,
    RequesterManagerID: data.requesterManagerID,
    EmployeeID: data.employeeID,
    IsPreferred: data.isPreferred,
  };
  const response = await apiPost(ENDPOINT, apiPayload, {
    headers: { 'Content-Type': 'application/json' },
  });
  const responseText = await expectOkReadText(response, 'Failed to update requester employee');
  const raw = JSON.parse(responseText) as Record<string, unknown>;
  return normalizeRequesterEmployee(raw);
};

export const deleteRequesterEmployee = async (requesterEmployeeID: string): Promise<void> => {
  const response = await apiDelete(`${ENDPOINT}/${requesterEmployeeID}`, {
    headers: { accept: '*/*' },
  });
  await expectOkReadText(response, 'Failed to delete requester employee');
};
