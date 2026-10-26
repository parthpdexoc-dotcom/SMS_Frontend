import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  createPaymentType,
  deletePaymentType,
  getPaymentTypes,
  updatePaymentType,
} from '@/services/paymentTypeService';
import {
  CreatePaymentTypeRequest,
  PaymentTypePaginationParams,
  PaymentTypeResponse,
  PaymentTypeSearchParams,
  UpdatePaymentTypeRequest,
} from '@/types/paymentType';
import { showToast } from './toastSlice';
import { apiGet } from '@/utils/apiClient';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';
import { expectOkReadText, parsePagedListJson } from '@/services/textPlainJson';

interface PaymentTypeState {
  paymentTypes: PaymentTypeResponse[];
  isLoading: boolean;
  error: string | null;
  totalItems: number;
}

const initialState: PaymentTypeState = {
  paymentTypes: [],
  isLoading: false,
  error: null,
  totalItems: 0,
};

const mapRow = (row: Record<string, unknown>) => row as unknown as PaymentTypeResponse;

export const fetchPaymentTypes = createAsyncThunk(
  'paymentType/fetchPaymentTypes',
  async (pagination: PaymentTypePaginationParams | undefined, thunkAPI) => {
    const { rejectWithValue, dispatch } = thunkAPI;
    try {
      const { data, totalRecords } = await getPaymentTypes(pagination);
      return { data, totalRecords, pagination };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch payment types';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const searchPaymentTypesThunk = createAsyncThunk(
  'paymentType/searchPaymentTypes',
  async (pagination: PaymentTypeSearchParams | undefined, thunkAPI) => {
    const { rejectWithValue, dispatch } = thunkAPI;
    try {
      const queryParams = buildPaginationQueryParams(pagination);
      const searchTerm = pagination?.searchTerm?.trim();
      if (searchTerm) {
        queryParams.append('searchTerm', searchTerm);
      }
      const queryString = queryParams.toString();
      const endpoint = `/PaymentType/search${queryString ? `?${queryString}` : ''}`;
      const response = await apiGet(endpoint);
      const responseText = await expectOkReadText(response, 'Failed to search payment types');
      const { data, totalRecords } = parsePagedListJson(responseText, mapRow);
      return { data, totalRecords, pagination };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to search payment types';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const upsertPaymentTypeThunk = createAsyncThunk(
  'paymentType/upsertPaymentType',
  async (
    payload: CreatePaymentTypeRequest | UpdatePaymentTypeRequest,
    { rejectWithValue, dispatch }
  ) => {
    try {
      if ('paymentTypeId' in payload && payload.paymentTypeId) {
        const data = await updatePaymentType(payload as UpdatePaymentTypeRequest);
        dispatch(showToast('Payment type updated successfully.', 'success'));
        return data;
      }
      const data = await createPaymentType(payload as CreatePaymentTypeRequest);
      dispatch(showToast('Payment type created successfully.', 'success'));
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save payment type';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const removePaymentType = createAsyncThunk<string, { id: string; name: string }>(
  'paymentType/removePaymentType',
  async ({ id, name }, { rejectWithValue, dispatch }) => {
    try {
      await deletePaymentType(id);
      dispatch(showToast('Payment type deleted successfully.', 'success'));
      return id;
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : 'Failed to delete payment type';
      const errorMessage = rawMessage.replace('{0}', name);
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

const paymentTypeSlice = createSlice({
  name: 'paymentType',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPaymentTypes.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchPaymentTypes.fulfilled, (state, action) => {
        state.isLoading = false;
        state.paymentTypes = action.payload.data;
        state.totalItems = action.payload.totalRecords;
        state.error = null;
      })
      .addCase(fetchPaymentTypes.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(searchPaymentTypesThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(searchPaymentTypesThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.paymentTypes = action.payload.data;
        state.totalItems = action.payload.totalRecords;
        state.error = null;
      })
      .addCase(searchPaymentTypesThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(upsertPaymentTypeThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(upsertPaymentTypeThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        const idx = state.paymentTypes.findIndex((p) => p.paymentTypeId === action.payload.paymentTypeId);
        if (idx >= 0) state.paymentTypes[idx] = action.payload;
        else state.paymentTypes.push(action.payload);
        state.error = null;
      })
      .addCase(upsertPaymentTypeThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(removePaymentType.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(removePaymentType.fulfilled, (state, action) => {
        state.isLoading = false;
        state.paymentTypes = state.paymentTypes.filter((p) => p.paymentTypeId !== action.payload);
        state.error = null;
      })
      .addCase(removePaymentType.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError } = paymentTypeSlice.actions;
export default paymentTypeSlice.reducer;
