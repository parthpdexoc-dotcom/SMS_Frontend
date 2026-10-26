/**
 * ApprovalDetail Redux Slice (ApprovalDetails table).
 */

import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  createApprovalDetail,
  getApprovalRequestDetail,
  getApprovalDetailsByRequestId,
  ApprovalDetailDto,
} from '@/services/approvalDetailService';
import {
  ApprovalDetail,
  ApprovalRequestDetailResponseDto,
  ApprovalType,
} from '@/types/vehicleApproval';
import { showToast } from './toastSlice';

/** Identifies which request + type the requestDetails list is for */
export interface RequestDetailsMeta {
  requestId: string;
  approvalType: ApprovalType;
}

interface ApprovalDetailState {
  lastSaved?: ApprovalDetail | null;
  isSubmitting: boolean;
  error: string | null;
  currentDetail?: ApprovalRequestDetailResponseDto | null;
  isFetchingDetail: boolean;
  detailError: string | null;
  /** Approval details for a request (by requestId + approvalType), used on Request form for "decision already recorded" */
  requestDetails: ApprovalDetail[] | null;
  requestDetailsFor: RequestDetailsMeta | null;
  isFetchingRequestDetails: boolean;
  requestDetailsError: string | null;
}

const initialState: ApprovalDetailState = {
  lastSaved: null,
  isSubmitting: false,
  error: null,
  currentDetail: null,
  isFetchingDetail: false,
  detailError: null,
  requestDetails: null,
  requestDetailsFor: null,
  isFetchingRequestDetails: false,
  requestDetailsError: null,
};

export const submitVehicleApprovalDetailThunk = createAsyncThunk<
  ApprovalDetail,
  ApprovalDetailDto
>(
  'approvalDetail/submit',
  async (payload, { rejectWithValue, dispatch }) => {
    try {
      const data = await createApprovalDetail(payload);
      dispatch(showToast('Vehicle approval decision saved successfully.', 'success'));
      return data;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to save approval detail';
      dispatch(showToast(message, 'error'));
      return rejectWithValue(message);
    }
  }
);

export const fetchVehicleApprovalRequestDetailThunk = createAsyncThunk<
  ApprovalRequestDetailResponseDto | null,
  {
    requestId: string;
    routingGroupId: string;
    approvalType?: ApprovalType;
  },
  { rejectValue: string }
>(
  'approvalDetail/fetchRequestDetail',
  async (
    { requestId, routingGroupId, approvalType },
    { rejectWithValue }
  ) => {
    try {
      const detail = await getApprovalRequestDetail(requestId, routingGroupId, {
        approvalType,
      });
      return detail;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to fetch approval detail';
      return rejectWithValue(message);
    }
  }
);

export const fetchApprovalDetailsByRequestIdThunk = createAsyncThunk<
  { details: ApprovalDetail[]; requestId: string; approvalType: ApprovalType },
  { requestId: string; approvalType: ApprovalType },
  { rejectValue: string }
>(
  'approvalDetail/fetchDetailsByRequestId',
  async ({ requestId, approvalType }, { rejectWithValue }) => {
    try {
      const details = await getApprovalDetailsByRequestId(requestId, approvalType);
      return { details, requestId, approvalType };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to fetch approval details for request';
      return rejectWithValue(message);
    }
  }
);

const approvalDetailSlice = createSlice({
  name: 'approvalDetail',
  initialState,
  reducers: {
    clearVehicleApprovalError: (state) => {
      state.error = null;
    },
    clearVehicleApprovalLastSaved: (state) => {
      state.lastSaved = null;
    },
    /** Clear request details (e.g. when leaving request edit or when request has no ID) */
    clearRequestDetails: (state) => {
      state.requestDetails = null;
      state.requestDetailsFor = null;
      state.requestDetailsError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(submitVehicleApprovalDetailThunk.pending, (state) => {
        state.isSubmitting = true;
        state.error = null;
      })
      .addCase(submitVehicleApprovalDetailThunk.fulfilled, (state, action) => {
        state.isSubmitting = false;
        state.lastSaved = action.payload;
        state.error = null;
      })
      .addCase(submitVehicleApprovalDetailThunk.rejected, (state, action) => {
        state.isSubmitting = false;
        state.error = action.payload as string;
      })
      .addCase(fetchVehicleApprovalRequestDetailThunk.pending, (state) => {
        state.isFetchingDetail = true;
        state.detailError = null;
      })
      .addCase(fetchVehicleApprovalRequestDetailThunk.fulfilled, (state, action) => {
        state.isFetchingDetail = false;
        state.currentDetail = action.payload ?? null;
        state.detailError = null;
      })
      .addCase(fetchVehicleApprovalRequestDetailThunk.rejected, (state, action) => {
        state.isFetchingDetail = false;
        state.detailError = action.payload as string;
      })
      .addCase(fetchApprovalDetailsByRequestIdThunk.pending, (state) => {
        state.isFetchingRequestDetails = true;
        state.requestDetailsError = null;
      })
      .addCase(fetchApprovalDetailsByRequestIdThunk.fulfilled, (state, action) => {
        state.isFetchingRequestDetails = false;
        state.requestDetails = action.payload.details;
        state.requestDetailsFor = {
          requestId: action.payload.requestId,
          approvalType: action.payload.approvalType,
        };
        state.requestDetailsError = null;
      })
      .addCase(fetchApprovalDetailsByRequestIdThunk.rejected, (state, action) => {
        state.isFetchingRequestDetails = false;
        state.requestDetailsError = action.payload as string;
      });
  },
});

export const {
  clearVehicleApprovalError,
  clearVehicleApprovalLastSaved,
  clearRequestDetails,
} = approvalDetailSlice.actions;

export default approvalDetailSlice.reducer;
