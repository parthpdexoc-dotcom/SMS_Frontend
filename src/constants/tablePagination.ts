/** Default rows per page when a table does not pass `initialPageSize` to `usePagination`. */
export const DEFAULT_TABLE_PAGE_SIZE = 25;

/** Request schedule grid on the request form and in Daily Administration. */
export const REQUEST_SCHEDULE_PAGE_SIZE = 5;

/** Standard selectable page sizes for user-facing table pagination controls. */
export const TABLE_PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100] as const;

/** Page lists: room for the title and the pagination bar. */
export const PAGE_GRID_MAX_BODY_HEIGHT =
  'max(11rem, calc(100dvh - var(--header-height) - 17rem))';

/** Assignment lists: filters sit above the grid, so the body can be a little taller. */
export const FILTERED_GRID_MAX_BODY_HEIGHT =
  'max(20rem, calc(100dvh - var(--header-height) - 15rem))';
