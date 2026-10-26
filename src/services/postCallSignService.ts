/**
 * PostCallSign API Service
 * Handles all API calls related to post call signs.
 */

import { apiGet, apiPost } from '@/utils/apiClient';
import { expectOkReadText, parseJsonText, readResponseOk } from '@/services/textPlainJson';
import { buildPaginationQueryParams, type PaginationParams } from '@/utils/paginationUtils';
import type {
  PostCallSign,
  UpsertPostCallSignRequest,
} from '@/types/postCallSign';

export const getPostCallSignsByPostId = async (
  postId: string,
  pagination?: PaginationParams
): Promise<PostCallSign[]> => {
  try {
    const query = buildPaginationQueryParams(pagination);
    query.set('postId', postId);
    const response = await apiGet(`/PostCallSign?${query.toString()}`, {
      headers: { 'Content-Type': 'application/json' },
    });
    const responseText = await expectOkReadText(response, 'Failed to fetch post call signs');
    const parsed = parseJsonText<PostCallSign[] | { data?: PostCallSign[]; items?: PostCallSign[] }>(
      responseText
    );
    return Array.isArray(parsed) ? parsed : (parsed?.data ?? parsed?.items ?? []);
  } catch (error) {
    console.error('Error fetching post call signs:', error);
    throw error;
  }
};

export const getAvailablePostCallSignsForDropdown = async (
  postId: string,
  dateOfWork: string
): Promise<PostCallSign[]> => {
  const query = new URLSearchParams({
    postId,
    dateOfWork: dateOfWork.slice(0, 10),
  });
  const response = await apiGet(`/PostCallSign/available?${query.toString()}`);
  return parseJsonText(await expectOkReadText(response, 'Failed to fetch available call signs'));
};

export const bulkUpsertPostCallSigns = async (
  data: UpsertPostCallSignRequest[]
): Promise<PostCallSign[]> => {
  try {
    const payload = data.map((item) => ({
      postCallSignID:
        'postCallSignID' in item && item.postCallSignID ? item.postCallSignID : undefined,
      postID: item.postID,
      callSign: (item.callSign ?? '').trim() || null,
    }));
    const response = await apiPost('/PostCallSign/bulk', payload, {
      headers: { 'Content-Type': 'application/json' },
    });
    const responseText = await readResponseOk(response, 'Failed to save post call signs');
    const parsed = parseJsonText<PostCallSign[] | { data?: PostCallSign[] }>(responseText);
    return Array.isArray(parsed) ? parsed : (parsed?.data ?? []);
  } catch (error) {
    console.error('Error bulk saving post call signs:', error);
    throw error;
  }
};
