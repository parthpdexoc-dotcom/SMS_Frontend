/**
 * HolidayDay Redux Slice
 */
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  createHolidayDay,
  deleteHolidayDay,
  getHolidayDays,
  updateHolidayDay,
} from '@/services/holidayDayService';
import {
  CreateHolidayDayRequest,
  HolidayDayPaginationParams,
  HolidayDayResponse,
  HolidayDaySearchParams,
  UpdateHolidayDayRequest,
} from '@/types/holidayDay';
import { showToast } from './toastSlice';
import { apiGet } from '@/utils/apiClient';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';
import { expectOkReadText, parsePagedListJson } from '@/services/textPlainJson';

interface HolidayDayState {
  holidayDays: HolidayDayResponse[];
  isLoading: boolean;
  error: string | null;
  totalItems: number;
}

const initialState: HolidayDayState = {
  holidayDays: [],
  isLoading: false,
  error: null,
  totalItems: 0,
};

export const fetchHolidayDays = createAsyncThunk(
  'holidayDay/fetchHolidayDays',
  async (pagination: HolidayDayPaginationParams | undefined, thunkAPI) => {
    const { rejectWithValue, dispatch } = thunkAPI;
    try {
      const { data, totalRecords } = await getHolidayDays(pagination);
      return { data, totalRecords, pagination };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch holiday days';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const searchHolidayDaysThunk = createAsyncThunk(
  'holidayDay/searchHolidayDays',
  async (pagination: HolidayDaySearchParams | undefined, thunkAPI) => {
    const { rejectWithValue, dispatch } = thunkAPI;
    try {
      const queryParams = buildPaginationQueryParams(pagination);
      const searchTerm = pagination?.searchTerm?.trim();
      if (searchTerm) queryParams.append('searchTerm', searchTerm);
      const queryString = queryParams.toString();
      const endpoint = `/HolidayDay/search${queryString ? `?${queryString}` : ''}`;
      const response = await apiGet(endpoint);
      const responseText = await expectOkReadText(response, 'Failed to search holiday days');
      const { data, totalRecords } = parsePagedListJson(responseText, (row) => row as unknown as HolidayDayResponse);
      return { data, totalRecords, pagination };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to search holiday days';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const upsertHolidayDayThunk = createAsyncThunk(
  'holidayDay/upsertHolidayDay',
  async (
    payload: CreateHolidayDayRequest | UpdateHolidayDayRequest,
    { rejectWithValue, dispatch }
  ) => {
    try {
      if ('holidayDayID' in payload && payload.holidayDayID) {
        const data = await updateHolidayDay(payload as UpdateHolidayDayRequest);
        dispatch(showToast('Holiday day updated successfully.', 'success'));
        return data;
      }
      const data = await createHolidayDay(payload as CreateHolidayDayRequest);
      dispatch(showToast('Holiday day created successfully.', 'success'));
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save holiday day';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const removeHolidayDay = createAsyncThunk<
  string,
  { id: string; name: string }
>(
  'holidayDay/removeHolidayDay',
  async ({ id, name }, { rejectWithValue, dispatch }) => {
    try {
      await deleteHolidayDay(id);
      dispatch(showToast('Holiday day deleted successfully.', 'success'));
      return id;
    } catch (error) {
      const rawMessage =
        error instanceof Error ? error.message : 'Failed to delete holiday day';
      const errorMessage = rawMessage.replace('{0}', name);
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

const holidayDaySlice = createSlice({
  name: 'holidayDay',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchHolidayDays.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchHolidayDays.fulfilled, (state, action) => {
        state.isLoading = false;
        state.holidayDays = action.payload.data;
        state.totalItems = action.payload.totalRecords;
        state.error = null;
      })
      .addCase(fetchHolidayDays.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(searchHolidayDaysThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(searchHolidayDaysThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.holidayDays = action.payload.data;
        state.totalItems = action.payload.totalRecords;
        state.error = null;
      })
      .addCase(searchHolidayDaysThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(upsertHolidayDayThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(upsertHolidayDayThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        const idx = state.holidayDays.findIndex((h) => h.holidayDayID === action.payload.holidayDayID);
        if (idx >= 0) state.holidayDays[idx] = action.payload;
        else state.holidayDays.push(action.payload);
        state.error = null;
      })
      .addCase(upsertHolidayDayThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(removeHolidayDay.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(removeHolidayDay.fulfilled, (state, action) => {
        state.isLoading = false;
        state.holidayDays = state.holidayDays.filter((h) => h.holidayDayID !== action.payload);
        state.error = null;
      })
      .addCase(removeHolidayDay.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError } = holidayDaySlice.actions;
export default holidayDaySlice.reducer;
