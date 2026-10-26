import { buildPageParamBody, buildPaginationQueryParams } from '@/utils/paginationUtils';
import type {
  GetNotificationDataParams,
  GetNotificationHistoryParams,
  NotificationDataRequestDto,
  SendEmailRequestDto,
} from '@/types/notification';

export const buildNotificationDataRequestBody = (
  params: GetNotificationDataParams
): NotificationDataRequestDto => {
  const searchTerm = params.searchTerm?.trim();
  const pageParam = buildPageParamBody(params.pagination);

  return {
    ...(params.requestId ? { requestId: params.requestId } : {}),
    ...(params.postId ? { postId: params.postId } : {}),
    ...(params.postPositionId ? { postPositionId: params.postPositionId } : {}),
    ...(params.postIds?.length ? { postIds: params.postIds } : {}),
    ...(params.startDate ? { startDate: params.startDate } : {}),
    ...(params.endDate ? { endDate: params.endDate } : {}),
    ...(searchTerm ? { searchTerm } : {}),
    ...(pageParam ? { pageParam } : {}),
  };
};

export const buildNotificationHistoryEndpoint = (params: GetNotificationHistoryParams): string => {
  const queryParams = buildPaginationQueryParams(params.pagination);
  if (params.postPositionId) {
    queryParams.set('postPositionId', params.postPositionId);
  } else if (params.postId) {
    queryParams.set('postId', params.postId);
  } else if (params.requestId) {
    queryParams.set('requestId', params.requestId);
  }

  const query = queryParams.toString();
  return `/NotificationHistory${query ? `?${query}` : ''}`;
};

export const buildSendEmailFormData = (
  payload: Omit<SendEmailRequestDto, 'attachments'>,
  attachments: File[]
): FormData => {
  const formData = new FormData();
  formData.append('subject', payload.subject);
  formData.append('body', payload.body);
  payload.to.forEach((email) => formData.append('to', email));
  payload.cc?.forEach((email) => formData.append('cc', email));
  payload.bcc?.forEach((email) => formData.append('bcc', email));
  if (payload.requestId) formData.append('requestId', payload.requestId);
  if (payload.requesterId) formData.append('requesterId', payload.requesterId);
  if (payload.postId) formData.append('postId', payload.postId);
  if (payload.postPositionId) formData.append('postPositionId', payload.postPositionId);
  formData.append('contextType', String(payload.contextType));
  attachments.forEach((file) => formData.append('attachments', file));
  return formData;
};
