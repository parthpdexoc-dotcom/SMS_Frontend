/**
 * BusinessType Redux Slice
 */
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  createBusinessType,
  deleteBusinessType,
  getBusinessTypeOptions,
  getBusinessTypes,
  updateBusinessType,
} from '@/services/businessTypeService';
import {
  BusinessTypePaginationParams,
  BusinessTypeSearchParams,
  BusinessTypeResponse,
  CreateBusinessTypeRequest,
  UpdateBusinessTypeRequest,
} from '@/types/businessType';
import type { SelectOptionDto } from '@/types/common';
import { showToast } from './toastSlice';
import { apiGet } from '@/utils/apiClient';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';
import { expectOkReadText, parsePagedListJson } from '@/services/textPlainJson';
import { normalizeBusinessType } from '@/utils/normalizers';

interface BusinessTypeState {
  businessTypes: BusinessTypeResponse[];
  /** Lightweight dropdown options (from generic options endpoint) */
  businessTypeOptions: SelectOptionDto[];
  isLoading: boolean;
  error: string | null;
  totalItems: number;
}

const initialState: BusinessTypeState = {
  businessTypes: [],
  businessTypeOptions: [],
  isLoading: false,
  error: null,
  totalItems: 0,
};

export const fetchBusinessTypes = createAsyncThunk(
  'businessType/fetchBusinessTypes',
  async (pagination: BusinessTypePaginationParams | undefined, thunkAPI) => {
    const { rejectWithValue, dispatch } = thunkAPI;
    try {
      const { data, totalRecords } = await getBusinessTypes(pagination);
      return { data, totalRecords, pagination };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch business types';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchBusinessTypeOptions = createAsyncThunk<
  SelectOptionDto[],
  { searchTerm?: string } | undefined
>(
  'businessType/fetchBusinessTypeOptions',
  async (params, thunkAPI) => {
    const { rejectWithValue, dispatch } = thunkAPI;
    try {
      return await getBusinessTypeOptions(params?.searchTerm);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch business type options';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const searchBusinessTypesThunk = createAsyncThunk(
  'businessType/searchBusinessTypes',
  async (pagination: BusinessTypeSearchParams | undefined, thunkAPI) => {
    const { rejectWithValue, dispatch } = thunkAPI;
    try {
      const queryParams = buildPaginationQueryParams(pagination);
      const searchTerm = pagination?.searchTerm?.trim();
      if (searchTerm) {
        queryParams.append('searchTerm', searchTerm);
      }
      const queryString = queryParams.toString();
      const endpoint = `/BusinessType/search${queryString ? `?${queryString}` : ''}`;
      const response = await apiGet(endpoint);
      const responseText = await expectOkReadText(response, 'Failed to search business types');
      const { data, totalRecords } = parsePagedListJson(responseText, (row) => normalizeBusinessType(row));
      return { data, totalRecords, pagination };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to search business types';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const upsertBusinessTypeThunk = createAsyncThunk(
  'businessType/upsertBusinessType',
  async (
    payload: CreateBusinessTypeRequest | UpdateBusinessTypeRequest,
    { rejectWithValue, dispatch }
  ) => {
    try {
      if ('businessTypeID' in payload && payload.businessTypeID) {
        const data = await updateBusinessType(payload as UpdateBusinessTypeRequest);
        dispatch(showToast('Business type updated successfully.', 'success'));
        return data;
      }
      const data = await createBusinessType(payload as CreateBusinessTypeRequest);
      dispatch(showToast('Business type created successfully.', 'success'));
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save business type';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const removeBusinessType = createAsyncThunk<
  string,
  { id: string; name: string }
>(
  'businessType/removeBusinessType',
  async ({ id, name }, { rejectWithValue, dispatch }) => {
    try {
      await deleteBusinessType(id);
      dispatch(showToast('Business type deleted successfully.', 'success'));
      return id;
    } catch (error) {
      const rawMessage =
        error instanceof Error ? error.message : 'Failed to delete business type';
      const errorMessage = rawMessage.replace('{0}', name);
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

const businessTypeSlice = createSlice({
  name: 'businessType',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBusinessTypes.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchBusinessTypes.fulfilled, (state, action) => {
        state.isLoading = false;
        state.businessTypes = action.payload.data;
        state.totalItems = action.payload.totalRecords;
        state.error = null;
      })
      .addCase(fetchBusinessTypes.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchBusinessTypeOptions.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchBusinessTypeOptions.fulfilled, (state, action) => {
        state.isLoading = false;
        state.businessTypeOptions = action.payload;
        state.error = null;
      })
      .addCase(fetchBusinessTypeOptions.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(searchBusinessTypesThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(searchBusinessTypesThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.businessTypes = action.payload.data;
        state.totalItems = action.payload.totalRecords;
        state.error = null;
      })
      .addCase(searchBusinessTypesThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(upsertBusinessTypeThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(upsertBusinessTypeThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        const idx = state.businessTypes.findIndex((b) => b.businessTypeID === action.payload.businessTypeID);
        if (idx >= 0) state.businessTypes[idx] = action.payload;
        else state.businessTypes.push(action.payload);
        state.error = null;
      })
      .addCase(upsertBusinessTypeThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(removeBusinessType.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(removeBusinessType.fulfilled, (state, action) => {
        state.isLoading = false;
        state.businessTypes = state.businessTypes.filter((b) => b.businessTypeID !== action.payload);
        state.error = null;
      })
      .addCase(removeBusinessType.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError } = businessTypeSlice.actions;
export default businessTypeSlice.reducer;


