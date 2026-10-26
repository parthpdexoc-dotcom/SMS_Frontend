/**
 * Unified GET /Request/view-details — replaces multiple calls for Available Job and Scheduled / Ready to Close modals.
 */
import { apiGet } from '@/utils/apiClient';
import { expectOkReadText, parseJsonText } from '@/services/textPlainJson';

export type RequestViewDetailsQuery = {
  postPositionId?: string;
  postId?: string;
  requestId?: string;
  /** Date-only `YYYY-MM-DD` for the row’s date of work (disambiguates recurring / multi-day requests). */
  dateOfWork?: string;
  isSpecialEvent?: boolean;
};

export async function getRequestViewDetails(q: RequestViewDetailsQuery): Promise<Record<string, unknown>> {
  const params = new URLSearchParams();
  if (q.postPositionId?.trim()) params.set('postPositionId', q.postPositionId.trim());
  if (q.postId?.trim()) params.set('postId', q.postId.trim());
  if (q.requestId?.trim()) params.set('requestId', q.requestId.trim());
  const dateOfWork = q.dateOfWork?.trim();
  if (dateOfWork) params.set('dateOfWork', dateOfWork.slice(0, 10));
  if (q.isSpecialEvent === true) params.set('isSpecialEvent', 'true');
  if (q.isSpecialEvent === false) params.set('isSpecialEvent', 'false');

  const qs = params.toString();
  if (!qs) {
    throw new Error('At least one of postPositionId, postId, or requestId is required for view details');
  }

  const response = await apiGet(`/Request/view-details?${qs}`);
  const responseText = await expectOkReadText(response, 'Failed to load view details');
  const parsed = parseJsonText<unknown>(responseText);
  if (!parsed || typeof parsed !== 'object') {
    return {};
  }
  return parsed as Record<string, unknown>;
}
