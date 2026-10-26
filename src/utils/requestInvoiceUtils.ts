import type { RequestResponse } from '@/types/request';

/** Project number only — for display and GET /Invoice/invoice-by-projectNumber. */
export const getRequestProjectNumber = (request?: RequestResponse | null): string =>
  (request?.projectNumber ?? '').trim();

/** Fiscal year + project number — used for invoice generate/search API. */
export const buildCombinedProjectNumber = (request?: RequestResponse | null): string | null => {
  const fy = request?.fiscalYear;
  const pn = (request?.projectNumber ?? '').trim();
  if (!fy || !pn) return null;
  return `${fy}${pn}`;
};
