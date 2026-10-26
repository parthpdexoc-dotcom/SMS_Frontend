/**
 * Shared helpers to detect active list filters.
 * Keep this generic so list pages can reuse the same logic.
 */

export const hasTextFilter = (value?: string | null): boolean =>
  Boolean((value ?? '').trim());

export const hasDateFilter = (
  startDate?: string | null,
  endDate?: string | null
): boolean => hasTextFilter(startDate) || hasTextFilter(endDate);

export const isSearchOrDateFilterActive = (
  search?: string | null,
  startDate?: string | null,
  endDate?: string | null
): boolean => hasTextFilter(search) || hasDateFilter(startDate, endDate);

