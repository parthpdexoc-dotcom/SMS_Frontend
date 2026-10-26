import type { UsePaginationReturn } from '@/hooks/usePagination';
import type { PaymentDetailModalPagination } from '@/types/payment';

export const toServerPagination = (
  pagination: UsePaginationReturn
): PaymentDetailModalPagination => ({
  serverSide: true,
  currentPage: pagination.currentPage,
  pageSize: pagination.pageSize,
  totalItems: pagination.totalItems,
  onPageChange: (page) => pagination.goToPage(page),
  onPageSizeChange: (newPageSize) => {
    pagination.setPageSize(newPageSize);
    pagination.goToFirstPage();
  },
});
