import { apiGetAll, apiDelete, apiPut, apiPost } from '@/utils/apiClient';
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants/tablePagination';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';
import { expectOkReadText, parseJsonText } from '@/services/textPlainJson';
import type { PagedResponse } from '@/types/common';
import type { EmployeePostListingItem } from '@/types/employeePostListingItem';
import { PostPositionStatus } from '@/types/postPosition';
import type { EmployeeResponse } from '@/types/employee';
import type { TenureWaitingPositionFilter } from '@/types/tenureWaitingPosition';
import { ReleaseAs } from '@/types/request';

const ENDPOINT = '/WaitingPostPosition/my-tenure-waiting-positions';

/** Body for POST my-tenure-waiting-positions — General tab (matches backend ReleaseAs values). */
export const MY_WAITING_LIST_GENERAL_RELEASE_AS: ReleaseAs[] = [
  ReleaseAs.Open,
  ReleaseAs.Managed,
  ReleaseAs.Preferred,
  ReleaseAs.Cancelled,
  ReleaseAs.General,
];

/** JSON body `List<ReleaseAs>` for the logged-in employee waiting list. */
export function releaseAsListForMyWaitingListTab(tabReleaseAs: ReleaseAs): ReleaseAs[] {
  return tabReleaseAs === ReleaseAs.General
    ? [...MY_WAITING_LIST_GENERAL_RELEASE_AS]
    : [ReleaseAs.TenureBased];
}

function mergeTenureWaitingPositionFilters(filters?: TenureWaitingPositionFilter): TenureWaitingPositionFilter {
  return {
    releaseAs: filters?.releaseAs ?? ReleaseAs.TenureBased,
    page: filters?.page,
    pageSize: filters?.pageSize,
    sortBy: filters?.sortBy,
    sortDirection: filters?.sortDirection,
    isViewWLHistory: filters?.isViewWLHistory ?? false,
  };
}

function myTenureWaitingListRequestKey(merged: TenureWaitingPositionFilter): string {
  return `${merged.releaseAs}|${merged.page ?? 1}|${merged.pageSize ?? DEFAULT_TABLE_PAGE_SIZE}|${merged.sortBy ?? ''}|${merged.sortDirection ?? ''}|${merged.isViewWLHistory ? '1' : '0'}`;
}

/** Stable key for the my-tenure-waiting-positions query (Redux thunk `condition` de-dupe). */
export function buildTenureWaitingListRequestKey(filters?: TenureWaitingPositionFilter): string {
  return myTenureWaitingListRequestKey(mergeTenureWaitingPositionFilters(filters));
}

function buildMyTenureWaitingQueryString(merged: TenureWaitingPositionFilter): string {
  const params = buildPaginationQueryParams(merged);
  params.set('isViewWLHistory', String(Boolean(merged.isViewWLHistory)));
  return params.toString();
}

async function getMyTenureWaitingPositionsOnce(
  merged: TenureWaitingPositionFilter
): Promise<PagedResponse<EmployeePostListingItem>> {
  const qs = buildMyTenureWaitingQueryString(merged);
  const path = qs ? `${ENDPOINT}?${qs}` : ENDPOINT;
  const releaseAsBody = releaseAsListForMyWaitingListTab(merged.releaseAs);
  const response = await apiPost(path, releaseAsBody, {
    headers: { 'Content-Type': 'application/json' },
  });
  const responseText = await expectOkReadText(response, 'Failed to fetch tenure waiting list');
  const parsed = parseJsonText<{
    data: EmployeePostListingItem[];
    totalRecords: number;
  }>(responseText);

  return {
    data: parsed.data,
    totalRecords: parsed.totalRecords,
  };
}

/**
 * Get waiting-list rows for the logged-in employee.
 * POST body: `ReleaseAs[]` — tenure tab `[TenureBased]`; general tab `[Open, Managed, Preferred, Cancelled, General]`.
 * Pagination stays on the query string (`PageParam`).
 */
export const getMyTenureWaitingPositions = async (
  filters?: TenureWaitingPositionFilter
): Promise<PagedResponse<EmployeePostListingItem>> => {
  return getMyTenureWaitingPositionsOnce(mergeTenureWaitingPositionFilters(filters));
};

export const deleteTenureWaitingPosition = async (waitingPostPositionId: string): Promise<void> => {
  const endpoint = `/WaitingPostPosition/${waitingPostPositionId}`;
  const response = await apiDelete(endpoint);
  await expectOkReadText(response, 'Failed to cancel waiting job position');
};

export const updateTenureWaitingPositionStatus = async (
  waitingPostPositionId: string,
  status: PostPositionStatus
): Promise<void> => {
  const endpoint = `/WaitingPostPosition/${waitingPostPositionId}/status/${status}`;
  const response = await apiPut(endpoint);
  await expectOkReadText(response, 'Failed to update waiting job position status');
};

/**
 * Some WaitingPostPosition list endpoints return a raw JSON array; others wrap rows in `{ data }` / `{ Data }`.
 */
function parseEmployeeResponseListJson(responseText: string): EmployeeResponse[] {
  const parsed = parseJsonText<unknown>(responseText);
  if (Array.isArray(parsed)) {
    return parsed as EmployeeResponse[];
  }
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    const raw = obj.data ?? obj.Data;
    if (Array.isArray(raw)) {
      return raw as EmployeeResponse[];
    }
  }
  return [];
}

export const getWaitingListEmployees = async (postId: string, dateOfWork: string): Promise<EmployeeResponse[]> => {
  const endpoint = `/WaitingPostPosition/waiting-list-employees?postId=${encodeURIComponent(postId)}&dateOfWork=${encodeURIComponent(dateOfWork)}`;
  const response = await apiGetAll(endpoint);
  const responseText = await expectOkReadText(response, 'Failed to fetch waiting list employees');
  return parseEmployeeResponseListJson(responseText);
};

export const getSpecialEventEmployeeIds = async (
  requestId: string,
  dateOfWork: string
): Promise<EmployeeResponse[]> => {
  const endpoint = `/WaitingPostPosition/special-event-employee-ids?requestId=${encodeURIComponent(requestId)}&dateOfWork=${encodeURIComponent(dateOfWork)}`;
  const response = await apiGetAll(endpoint);
  const responseText = await expectOkReadText(response, 'Failed to fetch special event employee ids');
  return parseEmployeeResponseListJson(responseText);
};
