import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { getRequestRoutingGroupsByRequestId } from '@/services/requestApprovalRoutingService';
import { RequestApprovalRoutingResponseDto } from '@/types/requestApprovalRouting';

interface RequestApprovalRoutingState {
  items: RequestApprovalRoutingResponseDto[];
  currentRequestId: string | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: RequestApprovalRoutingState = {
  items: [],
  currentRequestId: null,
  isLoading: false,
  error: null,
};

export const fetchRequestRoutingGroupsByRequestIdThunk = createAsyncThunk<
  RequestApprovalRoutingResponseDto[],
  string,
  { rejectValue: string }
>(
  'requestApprovalRouting/fetchByRequestId',
  async (requestId, { rejectWithValue }) => {
    try {
      const data = await getRequestRoutingGroupsByRequestId(requestId);
      return data;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to fetch request routing groups by request ID';
      return rejectWithValue(message);
    }
  }
);

const requestApprovalRoutingSlice = createSlice({
  name: 'requestApprovalRouting',
  initialState,
  reducers: {
    clearRequestApprovalRoutingError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRequestRoutingGroupsByRequestIdThunk.pending, (state, action) => {
        state.isLoading = true;
        state.error = null;
        state.currentRequestId = action.meta.arg;
      })
      .addCase(
        fetchRequestRoutingGroupsByRequestIdThunk.fulfilled,
        (state, action) => {
          state.isLoading = false;
          state.items = action.payload;
          state.error = null;
        }
      )
      .addCase(
        fetchRequestRoutingGroupsByRequestIdThunk.rejected,
        (state, action) => {
          state.isLoading = false;
          state.error = action.payload as string;
        }
      );
  },
});

export const { clearRequestApprovalRoutingError } =
  requestApprovalRoutingSlice.actions;

export default requestApprovalRoutingSlice.reducer;

