import type { EmailRecipientItem } from '@/components/smsmolecules/SMSEmailRecipientModal';
import type { PageParam } from '@/types/common';
import {
  NotificationContextType,
  type GetNotificationDataParams,
  type NotificationData,
  type NotificationRecipient,
  type SendEmailContext,
  type SendEmailRequestDto,
  type SuggestedRecipient,
} from '@/types/notification';

import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants/tablePagination';

export const EMAIL_TO_PICKER_PAGE_SIZE = DEFAULT_TABLE_PAGE_SIZE;

export const getNotificationRecipientEmail = (recipient: NotificationRecipient) =>
  recipient.offDutyCallBackEmail || recipient.primaryEmail;

export const getToRecipientsFromData = (data?: NotificationData | null): NotificationRecipient[] => {
  if (!data) return [];
  if (data.assignedEmployees?.data?.length) return data.assignedEmployees.data;
  return data.employee ? [data.employee] : [];
};

export const suggestedRecipientToNotificationRecipient = (
  item: SuggestedRecipient
): NotificationRecipient => ({
  employeeId: item.primaryEmail,
  employeeName: item.displayName,
  primaryEmail: item.primaryEmail,
});

export const getSuggestedRecipientsFromData = (data?: NotificationData | null): NotificationRecipient[] =>
  (data?.suggestedRecipients ?? []).map(suggestedRecipientToNotificationRecipient);

export const getRecipientIdentifier = (recipient: NotificationRecipient): string => {
  if (recipient.isPlaceholder && recipient.postPositionId) {
    return recipient.postPositionId;
  }
  if (recipient.employeeId && recipient.employeeId !== '00000000-0000-0000-0000-000000000000') {
    return recipient.employeeId;
  }
  return recipient.postPositionId || recipient.employeeName;
};

export const notificationRecipientToEmailItem = (
  recipient: NotificationRecipient
): EmailRecipientItem => ({
  id: getRecipientIdentifier(recipient),
  name: recipient.employeeName,
  email: getNotificationRecipientEmail(recipient) || '',
  employeeNumber: recipient.employeeNumber,
  isPlaceholder: recipient.isPlaceholder,
});

export const emailItemToNotificationRecipient = (item: EmailRecipientItem): NotificationRecipient => ({
  employeeId: item.isPlaceholder ? '' : item.id,
  postPositionId: item.isPlaceholder ? item.id : undefined,
  employeeName: item.name,
  primaryEmail: item.email,
  offDutyCallBackEmail: item.email,
  employeeNumber: item.employeeNumber,
  isPlaceholder: item.isPlaceholder,
});

export const pruneSelectedRecipients = (
  selected: NotificationRecipient[],
  available: NotificationRecipient[]
): NotificationRecipient[] => {
  const validIds = new Set(available.map(getRecipientIdentifier));
  return selected.filter((recipient) => validIds.has(getRecipientIdentifier(recipient)));
};

export const htmlToPlainText = (html: string): string => {
  const el = document.createElement('div');
  el.innerHTML = html;
  return (el.textContent ?? el.innerText ?? '').trim();
};

export const buildEmailDataParams = (options: {
  context: SendEmailContext;
  isRequestFlow: boolean;
  selectedPostIds?: string[];
  startDate?: string;
  endDate?: string;
  searchTerm?: string;
  pagination?: PageParam;
}): GetNotificationDataParams => ({
  requestId: options.context.requestId,
  postId: options.context.postId,
  postPositionId: options.context.postPositionId,
  ...(options.isRequestFlow && options.selectedPostIds?.length
    ? { postIds: options.selectedPostIds }
    : {}),
  ...(options.startDate ? { startDate: options.startDate } : {}),
  ...(options.endDate ? { endDate: options.endDate } : {}),
  ...(options.searchTerm ? { searchTerm: options.searchTerm } : {}),
  ...(options.pagination ? { pagination: options.pagination } : {}),
});

export const getEmailContextType = (context: SendEmailContext): NotificationContextType => {
  if (context.postPositionId) return NotificationContextType.PostPosition;
  if (context.postId) return NotificationContextType.Post;
  return NotificationContextType.Request;
};

export const buildSendEmailRequest = (options: {
  context: SendEmailContext;
  notificationData?: NotificationData | null;
  subject: string;
  messageHtml: string;
  toSelected: NotificationRecipient[];
  ccSelected: NotificationRecipient[];
  bccSelected: NotificationRecipient[];
  attachments?: File[];
}): SendEmailRequestDto => {
  const toEmails = options.toSelected.map(getNotificationRecipientEmail).filter(Boolean) as string[];
  const ccEmails = options.ccSelected.map(getNotificationRecipientEmail).filter(Boolean) as string[];
  const bccEmails = options.bccSelected.map(getNotificationRecipientEmail).filter(Boolean) as string[];

  return {
    subject: options.subject.trim(),
    body: options.messageHtml,
    to: toEmails,
    cc: ccEmails.length > 0 ? ccEmails : undefined,
    bcc: bccEmails.length > 0 ? bccEmails : undefined,
    requestId:
      options.context.requestId ??
      options.context.attachRequestId ??
      options.notificationData?.requestId ??
      undefined,
    requesterId: options.context.requesterId,
    postId: options.context.postId ?? options.notificationData?.postId ?? undefined,
    postPositionId: options.context.postPositionId,
    contextType: getEmailContextType(options.context),
    ...(options.attachments?.length ? { attachments: options.attachments } : {}),
  };
};

export const buildEmailDetailItems = (
  notificationData: NotificationData | null | undefined,
  labels: { requester: string; job: string; location: string }
): Array<{ label: string; value: string }> =>
  [
    notificationData?.requesterName
      ? { label: labels.requester, value: notificationData.requesterName }
      : null,
    notificationData?.postTitle ? { label: labels.job, value: notificationData.postTitle } : null,
    notificationData?.postLocation
      ? { label: labels.location, value: notificationData.postLocation }
      : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

export const buildEmailPostOptions = (notificationData?: NotificationData | null) =>
  (notificationData?.posts ?? []).map((post) => ({
    value: post.postId,
    label: post.postTitle,
  }));
