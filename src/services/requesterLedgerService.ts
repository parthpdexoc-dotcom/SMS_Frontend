import { apiGet } from '@/utils/apiClient';
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants/tablePagination';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';
import { expectOkReadText, parseJsonText } from '@/services/textPlainJson';
import type { RequesterLedgerStatementDto } from '@/types/requesterLedger';

export const getRequesterLedgerStatement = async (
  requesterId: string,
  startDateTime?: string | null,
  endDateTime?: string | null,
  page = 1,
  pageSize = DEFAULT_TABLE_PAGE_SIZE
): Promise<RequesterLedgerStatementDto> => {
  const queryParams = buildPaginationQueryParams({ page, pageSize });
  const trimmedStart = startDateTime?.trim();
  const trimmedEnd = endDateTime?.trim();
  if (trimmedStart) {
    queryParams.set('startDateTime', trimmedStart);
  }
  if (trimmedEnd) {
    queryParams.set('endDateTime', trimmedEnd);
  }

  const response = await apiGet(
    `/RequesterLedger/by-requester/${encodeURIComponent(requesterId.trim())}?${queryParams.toString()}`
  );
  const text = await expectOkReadText(response, 'Failed to load requester statement.');
  return parseJsonText<RequesterLedgerStatementDto>(text);
};
