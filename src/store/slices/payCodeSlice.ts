/**
 * PayCode Redux Slice
 */

import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  createPayCode,
  deletePayCode,
  getActivePayCodes,
  getPayCodeOptions,
  getPayCodes,
  updatePayCode,
} from '@/services/payCodeService';
import {
  CreatePayCodeRequest,
  PayCodePaginationParams,
  PayCodeSearchParams,
  PayCodeResponse,
  UpdatePayCodeRequest,
} from '@/types/payCode';
import type { SelectOptionDto } from '@/types/common';
import { showToast } from './toastSlice';
import { apiGet } from '@/utils/apiClient';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';
import { expectOkReadText, parsePagedListJson } from '@/services/textPlainJson';

interface PayCodeState {
  payCodes: PayCodeResponse[];
  activePayCodes: PayCodeResponse[];
  payCodeOptions: SelectOptionDto[];
  isLoading: boolean;
  error: string | null;
  totalItems: number;
}

const initialState: PayCodeState = {
  payCodes: [],
  activePayCodes: [],
  payCodeOptions: [],
  isLoading: false,
  error: null,
  totalItems: 0,
};

export const fetchPayCodes = createAsyncThunk(
  'payCode/fetchPayCodes',
  async (pagination: PayCodePaginationParams | undefined, thunkAPI) => {
    const { rejectWithValue, dispatch } = thunkAPI;
    try {
      const { data, totalRecords } = await getPayCodes(pagination);
      return { data, totalRecords, pagination };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch pay codes';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchActivePayCodes = createAsyncThunk(
  'payCode/fetchActivePayCodes',
  async (params: { selectedId?: string } | undefined, thunkAPI) => {
    const { rejectWithValue } = thunkAPI;
    try {
      return await getActivePayCodes(params);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch active pay codes';
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchPayCodeOptions = createAsyncThunk<
  SelectOptionDto[],
  { searchTerm?: string; selectedId?: string } | undefined
>(
  'payCode/fetchPayCodeOptions',
  async (params, thunkAPI) => {
    const { rejectWithValue, dispatch } = thunkAPI;
    try {
      return await getPayCodeOptions(
        params?.searchTerm,
        params?.selectedId
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch pay code options';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const searchPayCodesThunk = createAsyncThunk(
  'payCode/searchPayCodes',
  async (pagination: PayCodeSearchParams | undefined, thunkAPI) => {
    const { rejectWithValue, dispatch } = thunkAPI;
    try {
      const queryParams = buildPaginationQueryParams(pagination);
      const searchTerm = pagination?.searchTerm?.trim();
      if (searchTerm) queryParams.append('searchTerm', searchTerm);
      const queryString = queryParams.toString();
      const endpoint = `/PayCode/search${queryString ? `?${queryString}` : ''}`;
      const response = await apiGet(endpoint);
      const responseText = await expectOkReadText(response, 'Failed to search pay codes');
      const { data, totalRecords } = parsePagedListJson(responseText, (row) => row as unknown as PayCodeResponse);
      return { data, totalRecords, pagination };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to search pay codes';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const upsertPayCodeThunk = createAsyncThunk(
  'payCode/upsertPayCode',
  async (
    payload: CreatePayCodeRequest | UpdatePayCodeRequest,
    { rejectWithValue, dispatch }
  ) => {
    try {
      if ('payCodeID' in payload && payload.payCodeID) {
        const data = await updatePayCode(payload as UpdatePayCodeRequest);
        dispatch(showToast('Pay code updated successfully.', 'success'));
        return data;
      }
      const data = await createPayCode(payload as CreatePayCodeRequest);
      dispatch(showToast('Pay code created successfully.', 'success'));
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save pay code';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const removePayCode = createAsyncThunk<
  string,
  { id: string; name: string }
>(
  'payCode/removePayCode',
  async ({ id, name }, { rejectWithValue, dispatch }) => {
    try {
      await deletePayCode(id);
      dispatch(showToast('Pay code deleted successfully.', 'success'));
      return id;
    } catch (error) {
      const rawMessage =
        error instanceof Error ? error.message : 'Failed to delete pay code';
      const errorMessage = rawMessage.replace('{0}', name);
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

const payCodeSlice = createSlice({
  name: 'payCode',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPayCodes.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchPayCodes.fulfilled, (state, action) => {
        state.isLoading = false;
        state.payCodes = action.payload.data;
        state.totalItems = action.payload.totalRecords;
        state.error = null;
      })
      .addCase(fetchPayCodes.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchActivePayCodes.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchActivePayCodes.fulfilled, (state, action) => {
        state.isLoading = false;
        state.activePayCodes = action.payload;
        state.error = null;
      })
      .addCase(fetchActivePayCodes.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchPayCodeOptions.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchPayCodeOptions.fulfilled, (state, action) => {
        state.isLoading = false;
        state.payCodeOptions = action.payload;
        state.error = null;
      })
      .addCase(fetchPayCodeOptions.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.payCodeOptions = [];
      })
      .addCase(searchPayCodesThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(searchPayCodesThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.payCodes = action.payload.data;
        state.totalItems = action.payload.totalRecords;
        state.error = null;
      })
      .addCase(searchPayCodesThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(upsertPayCodeThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(upsertPayCodeThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        const idx = state.payCodes.findIndex((p) => p.payCodeID === action.payload.payCodeID);
        if (idx >= 0) state.payCodes[idx] = action.payload;
        else state.payCodes.push(action.payload);
        state.error = null;
      })
      .addCase(upsertPayCodeThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(removePayCode.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(removePayCode.fulfilled, (state, action) => {
        state.isLoading = false;
        state.payCodes = state.payCodes.filter((p) => p.payCodeID !== action.payload);
        state.error = null;
      })
      .addCase(removePayCode.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError } = payCodeSlice.actions;
export default payCodeSlice.reducer;

