import type { PageParam } from '@/types/common';

export interface GetNotificationDataParams {
  requestId?: string;
  postId?: string;
  postPositionId?: string;
  postIds?: string[];
  startDate?: string;
  endDate?: string;
  searchTerm?: string;
  pagination?: PageParam;
}

/** POST /notification/notification-data request body. */
export interface NotificationDataRequestDto {
  requestId?: string;
  postId?: string;
  postPositionId?: string;
  postIds?: string[];
  startDate?: string;
  endDate?: string;
  searchTerm?: string;
  pageParam?: {
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
  };
}

export interface NotificationRecipient {
  employeeId: string;
  employeeName: string;
  employeeNumber?: string;
  primaryEmail?: string;
  offDutyCallBackEmail?: string | null;
  primaryPhone?: string;
  employeeTypeName?: string;
  postPositionId?: string;
  dateOfWork?: string;
  isPlaceholder?: boolean;
}

export interface NotificationAssignedEmployees {
  totalRecords: number;
  data: NotificationRecipient[];
}

export interface SuggestedRecipient {
  displayName: string;
  primaryEmail: string;
  sources?: string[];
}

export interface NotificationPost {
  postId: string;
  postTitle: string;
  postLocation?: string;
  postCode?: string;
}

export interface NotificationData {
  requestId?: string;
  postId?: string | null;
  employeeId?: string | null;
  requesterName?: string;
  suggestedSubject?: string;
  postTitle?: string | null;
  postLocation?: string | null;
  postCode?: string | null;
  posts?: NotificationPost[];
  assignedEmployees?: NotificationAssignedEmployees | null;
  employee?: NotificationRecipient | null;
  suggestedRecipients?: SuggestedRecipient[];
}

/** Mirrors backend `SMS.Generic.Enums.NotificationContextType`. */
export enum NotificationContextType {
  Request = 1,
  Post = 2,
  PostPosition = 3,
}

export interface SendEmailContext {
  requestId?: string;
  postId?: string;
  postPositionId?: string;
  requesterId?: string;
  attachRequestId?: string;
}

export interface GetNotificationHistoryParams {
  requestId?: string;
  postId?: string;
  postPositionId?: string;
  pagination?: PageParam;
}

export interface NotificationHistoryListItem {
  notificationHistoryId: string;
  subject?: string;
  sentBy?: string;
  sentAt?: string;
  toCount?: number;
  ccCount?: number;
  bccCount?: number;
  status?: string;
}

export interface NotificationHistoryRecipient {
  email?: string;
  employeeName?: string | null;
}

export interface NotificationHistoryAttachment {
  fileUploadedId?: string | null;
  fileName?: string;
  fileSizeBytes?: number;
}

export interface NotificationHistoryDetail {
  notificationHistoryId?: string;
  subject?: string;
  sentBy?: string;
  sentAt?: string;
  to?: NotificationHistoryRecipient[];
  cc?: NotificationHistoryRecipient[];
  bcc?: NotificationHistoryRecipient[];
  body?: string;
  attachments?: NotificationHistoryAttachment[];
}

export interface SendEmailRequestDto {
  subject: string;
  body: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  requestId?: string;
  requesterId?: string;
  postId?: string;
  postPositionId?: string;
  contextType: NotificationContextType;
  attachments?: File[];
}
