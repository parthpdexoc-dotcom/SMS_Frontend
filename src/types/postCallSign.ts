/**
 * PostCallSign DTOs and Types
 */

export interface CreatePostCallSignRequest {
  postID: string;
  callSign?: string | null;
}

export interface UpdatePostCallSignRequest extends CreatePostCallSignRequest {
  postCallSignID: string;
}

export interface PostCallSign {
  postCallSignID?: string | null;
  postID: string;
  callSign?: string | null;
  createdDate?: string | null;
}

/** Local draft row used by the Job form (may not have an ID until saved). */
export interface PostCallSignDraft {
  postCallSignID?: string | null;
  callSign: string;
}

export type UpsertPostCallSignRequest = CreatePostCallSignRequest | UpdatePostCallSignRequest;

export interface AvailablePostCallSignParams {
  postId: string;
  dateOfWork: string;
}

export function availablePostCallSignCacheKey(postId: string, dateOfWork: string): string {
  const pid = postId.trim();
  const dow = String(dateOfWork ?? '').trim().slice(0, 10);
  return `${pid}|${dow}`;
}
