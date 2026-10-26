/**
 * Notification API Service
 */

import { apiGet, apiPost, apiRequest } from '@/utils/apiClient';
import {
  expectOkReadText,
  parseJsonText,
  parsePagedListJson,
  readResponseOk,
} from '@/services/textPlainJson';
import { REQUESTER } from '@/constants/strings';
import {
  buildNotificationDataRequestBody,
  buildNotificationHistoryEndpoint,
  buildSendEmailFormData,
} from '@/utils/notificationApiUtils';
import type {
  GetNotificationDataParams,
  GetNotificationHistoryParams,
  NotificationData,
  NotificationHistoryDetail,
  NotificationHistoryListItem,
  SendEmailRequestDto,
} from '@/types/notification';

const sendStr = REQUESTER.SEND_EMAIL_MODAL;
const historyStr = REQUESTER.NOTIFICATION_HISTORY;
const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

export const getNotificationData = async (
  params: GetNotificationDataParams
): Promise<{ data: NotificationData; totalRecords: number }> => {
  try {
    const response = await apiPost(
      '/notification/notification-data',
      buildNotificationDataRequestBody(params),
      { headers: JSON_HEADERS }
    );
    const responseText = await readResponseOk(response, sendStr.LOAD_ERROR);
    const data = parseJsonText<NotificationData>(responseText);
    return { data, totalRecords: data.assignedEmployees?.totalRecords ?? (data.employee ? 1 : 0) };
  } catch (error) {
    console.error('Error fetching notification data:', error);
    throw error;
  }
};

export const sendNotification = async (request: SendEmailRequestDto): Promise<void> => {
  try {
    const { attachments = [], ...payload } = request;

    if (attachments.length === 0) {
      const response = await apiPost('/notification/send', payload, { headers: JSON_HEADERS });
      await readResponseOk(response, sendStr.SEND_ERROR);
      return;
    }

    const response = await apiRequest('/notification/send', {
      method: 'POST',
      body: buildSendEmailFormData(payload, attachments),
    });
    await readResponseOk(response, sendStr.SEND_ERROR);
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
};

export const getNotificationHistory = async (
  params: GetNotificationHistoryParams
): Promise<{ data: NotificationHistoryListItem[]; totalRecords: number }> => {
  try {
    const response = await apiGet(buildNotificationHistoryEndpoint(params));
    const responseText = await expectOkReadText(response, historyStr.LOAD_ERROR);
    return parsePagedListJson<NotificationHistoryListItem>(
      responseText,
      (row) => row as unknown as NotificationHistoryListItem
    );
  } catch (error) {
    console.error('Error fetching notification history:', error);
    throw error;
  }
};

export const getNotificationHistoryDetail = async (
  notificationHistoryId: string
): Promise<NotificationHistoryDetail> => {
  try {
    const response = await apiGet(`/NotificationHistory/${encodeURIComponent(notificationHistoryId)}`);
    const responseText = await expectOkReadText(response, historyStr.DETAIL_ERROR);
    return parseJsonText<NotificationHistoryDetail>(responseText);
  } catch (error) {
    console.error('Error fetching notification history detail:', error);
    throw error;
  }
};
