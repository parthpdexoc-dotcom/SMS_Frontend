/** Archived / Watch Commander list filters: optional start and end date (YYYY-MM-DD). */
export function buildReportListFilterQueryParams(
  startDate: string,
  endDate: string
): { startDate?: string; endDate?: string } {
  const start = startDate.trim() || undefined;
  const end = endDate.trim() || undefined;
  return { startDate: start, endDate: end };
}
