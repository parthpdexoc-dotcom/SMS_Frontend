import { useCallback, useMemo, useState } from 'react';
import type { SMSSegmentedStatusFilterValue } from '@/components/smsatoms';
import type { UsePaginationReturn } from '@/hooks/usePagination';

/**
 * Shared Active / Inactive + server paging for master-data grids that support `[FromQuery] bool? isActive`.
 */
export function useMasterDataListStatusPagedParams(
  pagination: Pick<UsePaginationReturn, 'currentPage' | 'pageSize' | 'goToFirstPage'>
): {
  statusFilter: SMSSegmentedStatusFilterValue;
  handleStatusFilterChange: (value: SMSSegmentedStatusFilterValue) => void;
  /** Pass to API only when set: `...(isActiveParam !== undefined ? { isActive: isActiveParam } : {})` */
  isActiveParam: boolean | undefined;
} {
  const [statusFilter, setStatusFilter] = useState<SMSSegmentedStatusFilterValue>('active');

  const isActiveParam = useMemo(() => {
    if (statusFilter === 'active') return true;
    if (statusFilter === 'inactive') return false;
    return undefined;
  }, [statusFilter]);

  const handleStatusFilterChange = useCallback(
    (value: SMSSegmentedStatusFilterValue) => {
      setStatusFilter(value);
      pagination.goToFirstPage();
    },
    [pagination]
  );

  return { statusFilter, handleStatusFilterChange, isActiveParam };
}
