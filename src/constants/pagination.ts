/** Bulk list fetches use large page sizes; grid UX should keep 5–100 style values only. */
export const MAX_GRID_PAGE_SIZE_UX = 100;

export function shouldPersistGridPageSize(pageSize: number | undefined): boolean {
  return typeof pageSize === 'number' && pageSize > 0 && pageSize <= MAX_GRID_PAGE_SIZE_UX;
}
