import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  getNotificationData,
  getNotificationHistory,
  getNotificationHistoryDetail,
  sendNotification,
} from '@/services/notificationService';
import type {
  GetNotificationDataParams,
  GetNotificationHistoryParams,
  NotificationData,
  NotificationHistoryDetail,
  NotificationHistoryListItem,
  SendEmailRequestDto,
} from '@/types/notification';
import { REQUESTER } from '@/constants/strings';
import { showToast } from './toastSlice';

const notificationStr = REQUESTER.SEND_EMAIL_MODAL;
const historyStr = REQUESTER.NOTIFICATION_HISTORY;

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

interface NotificationState {
  notificationData: NotificationData | null;
  assignedEmployeesTotal: number;
  historyList: NotificationHistoryListItem[];
  historyTotalRecords: number;
  historyDetail: NotificationHistoryDetail | null;
  isLoading: boolean;
  isLoadingHistory: boolean;
  isLoadingHistoryDetail: boolean;
  isSending: boolean;
  error: string | null;
}

const initialState: NotificationState = {
  notificationData: null,
  assignedEmployeesTotal: 0,
  historyList: [],
  historyTotalRecords: 0,
  historyDetail: null,
  isLoading: false,
  isLoadingHistory: false,
  isLoadingHistoryDetail: false,
  isSending: false,
  error: null,
};

export const fetchNotificationDataThunk = createAsyncThunk(
  'notification/fetchNotificationData',
  async (params: GetNotificationDataParams, { rejectWithValue, dispatch }) => {
    try {
      return await getNotificationData(params);
    } catch (error) {
      const message = getErrorMessage(error, notificationStr.LOAD_ERROR);
      dispatch(showToast(message, 'error'));
      return rejectWithValue(message);
    }
  }
);

// Fetches recipients without touching notificationData in state,
// so the visible recipient table/pagination is not affected (used by "Select All").
export const fetchAllNotificationRecipientsThunk = createAsyncThunk(
  'notification/fetchAllNotificationRecipients',
  async (params: GetNotificationDataParams, { rejectWithValue, dispatch }) => {
    try {
      return await getNotificationData(params);
    } catch (error) {
      const message = getErrorMessage(error, notificationStr.LOAD_ERROR);
      dispatch(showToast(message, 'error'));
      return rejectWithValue(message);
    }
  }
);

export const sendNotificationThunk = createAsyncThunk(
  'notification/sendNotification',
  async (request: SendEmailRequestDto, { rejectWithValue, dispatch }) => {
    try {
      await sendNotification(request);
      dispatch(showToast(notificationStr.SEND_SUCCESS, 'success'));
    } catch (error) {
      const message = getErrorMessage(error, notificationStr.SEND_ERROR);
      dispatch(showToast(message, 'error'));
      return rejectWithValue(message);
    }
  }
);

export const fetchNotificationHistoryThunk = createAsyncThunk(
  'notification/fetchNotificationHistory',
  async (params: GetNotificationHistoryParams, { rejectWithValue, dispatch }) => {
    try {
      return await getNotificationHistory(params);
    } catch (error) {
      const message = getErrorMessage(error, historyStr.LOAD_ERROR);
      dispatch(showToast(message, 'error'));
      return rejectWithValue(message);
    }
  }
);

export const fetchNotificationHistoryDetailThunk = createAsyncThunk(
  'notification/fetchNotificationHistoryDetail',
  async (notificationHistoryId: string, { rejectWithValue, dispatch }) => {
    try {
      return await getNotificationHistoryDetail(notificationHistoryId);
    } catch (error) {
      const message = getErrorMessage(error, historyStr.DETAIL_ERROR);
      dispatch(showToast(message, 'error'));
      return rejectWithValue(message);
    }
  }
);

const notificationSlice = createSlice({
  name: 'notification',
  initialState,
  reducers: {
    clearNotificationError: (state) => {
      state.error = null;
    },
    clearNotificationForm: (state) => {
      state.notificationData = null;
      state.assignedEmployeesTotal = 0;
      state.error = null;
    },
    clearNotificationHistory: (state) => {
      state.historyList = [];
      state.historyTotalRecords = 0;
      state.historyDetail = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotificationDataThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchNotificationDataThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.error = null;
        state.notificationData = action.payload.data;
        state.assignedEmployeesTotal = action.payload.totalRecords;
      })
      .addCase(fetchNotificationDataThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = (action.payload as string) ?? notificationStr.LOAD_ERROR;
      })
      .addCase(sendNotificationThunk.pending, (state) => {
        state.isSending = true;
        state.error = null;
      })
      .addCase(sendNotificationThunk.fulfilled, (state) => {
        state.isSending = false;
        state.error = null;
      })
      .addCase(sendNotificationThunk.rejected, (state, action) => {
        state.isSending = false;
        state.error = (action.payload as string) ?? notificationStr.SEND_ERROR;
      })
      .addCase(fetchNotificationHistoryThunk.pending, (state) => {
        state.isLoadingHistory = true;
      })
      .addCase(fetchNotificationHistoryThunk.fulfilled, (state, action) => {
        state.isLoadingHistory = false;
        state.historyList = action.payload.data;
        state.historyTotalRecords = action.payload.totalRecords;
      })
      .addCase(fetchNotificationHistoryThunk.rejected, (state) => {
        state.isLoadingHistory = false;
        state.historyList = [];
        state.historyTotalRecords = 0;
      })
      .addCase(fetchNotificationHistoryDetailThunk.pending, (state) => {
        state.isLoadingHistoryDetail = true;
        state.historyDetail = null;
      })
      .addCase(fetchNotificationHistoryDetailThunk.fulfilled, (state, action) => {
        state.isLoadingHistoryDetail = false;
        state.historyDetail = action.payload;
      })
      .addCase(fetchNotificationHistoryDetailThunk.rejected, (state) => {
        state.isLoadingHistoryDetail = false;
        state.historyDetail = null;
      });
  },
});

export const { clearNotificationError, clearNotificationForm, clearNotificationHistory } =
  notificationSlice.actions;
export default notificationSlice.reducer;
