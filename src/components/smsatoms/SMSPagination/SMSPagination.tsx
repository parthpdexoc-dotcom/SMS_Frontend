import type { ReactNode } from 'react';
import { FC, memo, useMemo } from 'react';
import { SMSButton } from '../SMSButton';
import { SMSDropdown } from '../SMSDropdown';
import { SMSIcon } from '../SMSIcon';
import { DEFAULT_TABLE_PAGE_SIZE, TABLE_PAGE_SIZE_OPTIONS } from '@/constants/tablePagination';
import { PAGINATION } from '@/constants/strings';
import { cn } from '@/utils';
import styles from './SMSPagination.module.css';

/** Below this, show every page button; above, use a sliding window + ellipsis. */
const SHOW_ALL_PAGES_THRESHOLD = 10;

export type SMSPaginationVariant = 'full' | 'compact';

export interface SMSPaginationProps {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  loading?: boolean;
  /** `full`: numbered pages + ellipsis. `compact`: `current / total` in the middle. */
  variant?: SMSPaginationVariant;
  pageSizeOptions?: number[];
  className?: string;
  /** Replaces the default rows-per-page dropdown (e.g. MUI Menu + anchor). */
  pageSizeSlot?: ReactNode;
}

export const SMSPagination: FC<SMSPaginationProps> = memo(function SMSPagination({
  currentPage,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  loading = false,
  variant = 'full',
  pageSizeOptions = [...TABLE_PAGE_SIZE_OPTIONS],
  className,
  pageSizeSlot,
}) {
  /** Stable positive size for math + Select value (avoids blank dropdown when parent briefly passes 0/undefined). */
  const sizeForMath = useMemo(() => {
    const n = Number(pageSize);
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_TABLE_PAGE_SIZE;
  }, [pageSize]);

  const pageSizeSelectOptions = useMemo(() => {
    const mapped = pageSizeOptions.map((n) => ({ value: String(n), label: String(n) }));
    const v = String(sizeForMath);
    if (mapped.some((o) => o.value === v)) return mapped;
    return [...mapped, { value: v, label: v }].sort((a, b) => Number(a.value) - Number(b.value));
  }, [pageSizeOptions, sizeForMath]);

  const totalPages = Math.max(1, Math.ceil(totalItems / Math.max(sizeForMath, 1)));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const startItem = totalItems === 0 ? 0 : (safePage - 1) * sizeForMath + 1;
  const endItem = Math.min(safePage * sizeForMath, totalItems);

  const pageNumbers = useMemo(() => {
    if (variant !== 'full') return [];
    const all = Array.from({ length: totalPages }, (_, i) => i + 1);
    if (totalPages <= SHOW_ALL_PAGES_THRESHOLD) {
      return all;
    }
    return all.filter((page) => {
      return (
        page === 1 ||
        page === totalPages ||
        (page >= safePage - 1 && page <= safePage + 1)
      );
    });
  }, [variant, totalPages, safePage]);

  // Show first/prev/page numbers/next/last whenever there is data — not only when
  // `totalItems > pageSize` (otherwise < pageSize records hides the whole control strip).
  const showPageControls = totalItems > 0;

  const sizeDropdown =
    pageSizeSlot ??
    (onPageSizeChange ? (
      <>
        <SMSDropdown
          id="sms-pagination-page-size"
          label={PAGINATION.ROWS}
          options={pageSizeSelectOptions}
          value={String(sizeForMath)}
          onChange={(e) => onPageSizeChange(parseInt(String(e.target.value), 10))}
          className={styles.pageSizeDropdown}
          searchable={false}
          MenuProps={{ disablePortal: false }}
        />
        <span className={cn(styles.sizeLabel, 'sms-pagination__size-label')}>
          {PAGINATION.ROWS_PER_PAGE}
        </span>
      </>
    ) : null);

  return (
    <div className={cn(styles.root, 'sms-pagination', className)} role="navigation" aria-label="Pagination">
      <div className={cn(styles.left, 'sms-pagination__left')}>
        <div className={cn(styles.info, 'sms-pagination__info')}>
          {PAGINATION.SHOWING} {startItem} {PAGINATION.TO} {endItem} {PAGINATION.OF} {totalItems}{' '}
          {PAGINATION.ENTRIES}
        </div>
        {sizeDropdown ? <div className={cn(styles.size, 'sms-pagination__size')}>{sizeDropdown}</div> : null}
      </div>
      {showPageControls && (
        <div className={cn(styles.controls, 'sms-pagination__controls')}>
          <SMSButton
            variant="outlined"
            onClick={() => onPageChange(1)}
            disabled={safePage === 1 || loading}
            className={styles.navBtn}
            aria-label={PAGINATION.FIRST_PAGE}
            disableRipple
          >
            <SMSIcon name="chevron-double-left" size="sm" />
          </SMSButton>
          <SMSButton
            variant="outlined"
            onClick={() => onPageChange(safePage - 1)}
            disabled={safePage === 1 || loading}
            className={styles.navBtn}
            aria-label={PAGINATION.PREVIOUS}
            disableRipple
          >
            <SMSIcon name="chevron-left" size="sm" />
          </SMSButton>
          {variant === 'compact' ? (
            <span className={styles.compactPages}>
              {safePage} / {totalPages}
            </span>
          ) : (
            <div className={styles.pages}>
              {pageNumbers.map((page, index, array) => {
                const showEllipsisBefore = index > 0 && page - array[index - 1] > 1;
                return (
                  <span key={page} className={styles.pageGroup}>
                    {showEllipsisBefore && <span className={styles.ellipsis}>…</span>}
                    <SMSButton
                      variant={safePage === page ? 'contained' : 'outlined'}
                      onClick={() => onPageChange(page)}
                      disabled={loading}
                      className={styles.pageBtn}
                      aria-current={safePage === page ? 'page' : undefined}
                      disableRipple
                    >
                      {page}
                    </SMSButton>
                  </span>
                );
              })}
            </div>
          )}
          <SMSButton
            variant="outlined"
            onClick={() => onPageChange(safePage + 1)}
            disabled={safePage === totalPages || loading}
            className={styles.navBtn}
            aria-label={PAGINATION.NEXT}
            disableRipple
          >
            <SMSIcon name="chevron-right" size="sm" />
          </SMSButton>
          <SMSButton
            variant="outlined"
            onClick={() => onPageChange(totalPages)}
            disabled={safePage === totalPages || loading}
            className={styles.navBtn}
            aria-label={PAGINATION.LAST_PAGE}
            disableRipple
          >
            <SMSIcon name="chevron-double-right" size="sm" />
          </SMSButton>
        </div>
      )}
    </div>
  );
});

SMSPagination.displayName = 'SMSPagination';

export default SMSPagination;
