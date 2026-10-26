import { apiGet } from '@/utils/apiClient';
import { expectOkReadText, parseJsonText, parseJsonTextArray } from '@/services/textPlainJson';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';
import type { EmployeePostListingItem } from '@/types/employeePostListingItem';
import { parseEmployeePostListingItem } from '@/utils/employeePostListingItem';
import type { PagedResponse } from '@/types/common';

/** Filters accepted by `GET /Request/job-ready-to-close`. */
export interface JobsReadyToCloseFilters {
  page?: number;
  pageSize?: number;
  /** Filter to a specific employee. Omit to include all employees in the department. */
  employeeId?: string;
  /** Filter to a specific requester. Omit to include all requesters in the department. */
  requesterId?: string;
  /** YYYY-MM-DD inclusive lower bound on dateOfWork. */
  startDate?: string;
  /** YYYY-MM-DD inclusive upper bound on dateOfWork. */
  endDate?: string;
  /** Free-text search across post title / duration. */
  searchTerm?: string;
  /** When true, returns placeholder-only assignments. */
  isPlaceholder?: boolean;
}

/**
 * GET `/Request/job-ready-to-close` — department-scoped ongoing assigned posts
 * across all employees, with optional employee / date / search filters.
 *
 * Backend: `RequestController.GetOngoingPostPositionsAsync` →
 * `PagedList<EmployeePostListingItemDto>` (employee name included).
 *
 * Authorization: DepartmentAdmin policy is enforced server-side; UI is gated
 * elsewhere (RequesterList tabs are hidden for view-only users).
 */
export async function getJobsReadyToClose(
  filters?: JobsReadyToCloseFilters
): Promise<PagedResponse<EmployeePostListingItem>> {
  const params = buildPaginationQueryParams({
    page: filters?.page,
    pageSize: filters?.pageSize,
  });

  const employeeId = filters?.employeeId?.trim();
  if (employeeId) params.append('employeeId', employeeId);

  const requesterId = filters?.requesterId?.trim();
  if (requesterId) params.append('requesterId', requesterId);

  const startDate = filters?.startDate?.trim();
  if (startDate) params.append('startDate', startDate);

  const endDate = filters?.endDate?.trim();
  if (endDate) params.append('endDate', endDate);

  const searchTerm = filters?.searchTerm?.trim();
  if (searchTerm) params.append('searchTerm', searchTerm);

  if (filters?.isPlaceholder === true) {
    params.append('isPlaceholder', 'true');
  }

  const qs = params.toString();
  const endpoint = `/PostPosition/job-ready-to-close${qs ? `?${qs}` : ''}`;

  const response = await apiGet(endpoint);
  const responseText = await expectOkReadText(response, 'Failed to load jobs ready to close');
  const parsed = parseJsonText<unknown>(responseText);

  if (parsed && typeof parsed === 'object') {
    const p = parsed as Record<string, unknown>;
    const list = (p.data ?? p.Data ?? p.items ?? p.Items) as unknown[] | undefined;
    const total = p.totalRecords ?? p.TotalRecords;
    if (Array.isArray(list)) {
      return {
        data: list.map((item) => parseEmployeePostListingItem(item)),
        totalRecords: typeof total === 'number' ? total : list.length,
      };
    }
  }

  // Fallback: server returned a bare array (unwrapped).
  const data = parseJsonTextArray<unknown>(responseText);
  return {
    data: data.map((item) => parseEmployeePostListingItem(item)),
    totalRecords: data.length,
  };
}
