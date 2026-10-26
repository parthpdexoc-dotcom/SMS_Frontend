import type { usePagination } from '@/hooks/usePagination';
import './components/ReportsListPage.css';

export const REPORT_LIST_FILTERS_CLASS = 'reports-list-page__filters';
export const REPORT_LIST_TABLE_CLASS = 'reports-list-page__table';

export const REPORT_LIST_TABLE_LAYOUT = {
  embedded: true,
  responsiveAutoMeasure: 'container' as const,
  maxBodyHeight: 'var(--reports-list-scroll-max)',
} as const;

const filterRowBase = {
  display: 'flex',
  flexDirection: 'row' as const,
  flexWrap: 'nowrap' as const,
  alignItems: 'flex-end' as const,
  gap: 2,
};

export const REPORT_LIST_FILTER = {
  row: {
    ...filterRowBase,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    overflowX: 'auto',
    overflowY: 'hidden',
    pb: 0.25,
    WebkitOverflowScrolling: 'touch',
  },
  fields: {
    ...filterRowBase,
    flex: '1 1 auto',
    minWidth: 0,
  },
  generate: {
    ...filterRowBase,
    flexShrink: 0,
    marginLeft: 'auto',
  },
  field: {
    flex: '0 0 auto',
    width: 168,
    minWidth: 168,
    maxWidth: 168,
  },
  search: {
    flex: '1 1 220px',
    minWidth: 200,
    maxWidth: 320,
  },
} as const;

type ReportListPagination = ReturnType<typeof usePagination>;

export function reportListTableClass(pageTableClass: string): string {
  return `${pageTableClass} ${REPORT_LIST_TABLE_CLASS}`;
}

export function reportListPagination(pagination: ReportListPagination) {
  const { currentPage, pageSize, totalItems, goToPage, setPageSize, goToFirstPage } = pagination;

  return {
    serverSide: true as const,
    currentPage,
    pageSize,
    totalItems,
    onPageChange: goToPage,
    onPageSizeChange: (newPageSize: number) => {
      setPageSize(newPageSize);
      goToFirstPage();
    },
  };
}
