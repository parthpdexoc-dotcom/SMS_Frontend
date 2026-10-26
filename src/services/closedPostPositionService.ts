import { apiGet } from '@/utils/apiClient';
import { expectOkReadText, parsePagedListJson } from '@/services/textPlainJson';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';
import type { PageParam, PagedResponse } from '@/types/common';
import type { EmployeePostListingItem } from '@/types/employeePostListingItem';
import { parseEmployeePostListingItem } from '@/utils/employeePostListingItem';

/** Matches `ClosedPostPositionController.GetLatestPerPostPositionPagedAsync` query: PageParam + optional employeeId. */
export type LatestPerPostPositionPagedFilters = Pick<PageParam, 'page' | 'pageSize'> & {
  employeeId?: string;
};

export const getLatestPerPostPositionPaged = async (
  filters?: LatestPerPostPositionPagedFilters
): Promise<PagedResponse<EmployeePostListingItem>> => {
  const endpoint = '/ClosedPostPosition/latest-per-post-position';
  const params = buildPaginationQueryParams(filters);
  const employeeGuid = filters?.employeeId?.trim();
  if (employeeGuid) {
    params.append('employeeId', employeeGuid);
  }
  const qs = params.toString();
  const response = await apiGet(qs ? `${endpoint}?${qs}` : endpoint);
  const text = await expectOkReadText(response, 'Failed to fetch latest closed post positions');
  return parsePagedListJson(text, (raw) => parseEmployeePostListingItem(raw));
};
