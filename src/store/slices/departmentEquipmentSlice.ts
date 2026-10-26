/**
 * DepartmentEquipment Redux Slice
 */
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  createDepartmentEquipment,
  deleteDepartmentEquipment,
  getDepartmentEquipments,
  getDepartmentEquipmentOptions,
  getDepartmentVehicleOptions,
  updateDepartmentEquipment,
} from '@/services/departmentEquipmentService';
import {
  CreateDepartmentEquipmentRequest,
  DepartmentEquipmentPaginationParams,
  DepartmentEquipmentResponse,
  DepartmentEquipmentSearchParams,
  UpdateDepartmentEquipmentRequest,
} from '@/types/departmentEquipment';
import type { DepartmentEquipmentSelectOptionDto } from '@/types/common';
import { showToast } from './toastSlice';
import { apiGet } from '@/utils/apiClient';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';
import { expectOkReadText, parsePagedListJson } from '@/services/textPlainJson';
import { normalizeDepartmentEquipment } from '@/utils/normalizers';

interface DepartmentEquipmentState {
  departmentEquipments: DepartmentEquipmentResponse[];
  departmentVehicleOptions: DepartmentEquipmentSelectOptionDto[];
  departmentEquipmentOptions: DepartmentEquipmentSelectOptionDto[];
  isLoading: boolean;
  isLoadingVehicleOptions: boolean;
  isLoadingEquipmentOptions: boolean;
  pendingVehicleOptionsRequestId: string | null;
  pendingEquipmentOptionsRequestId: string | null;
  error: string | null;
  totalItems: number;
}

const initialState: DepartmentEquipmentState = {
  departmentEquipments: [],
  departmentVehicleOptions: [],
  departmentEquipmentOptions: [],
  isLoading: false,
  isLoadingVehicleOptions: false,
  isLoadingEquipmentOptions: false,
  pendingVehicleOptionsRequestId: null,
  pendingEquipmentOptionsRequestId: null,
  error: null,
  totalItems: 0,
};

export const fetchDepartmentEquipments = createAsyncThunk(
  'departmentEquipment/fetchDepartmentEquipments',
  async (pagination: DepartmentEquipmentPaginationParams | undefined, thunkAPI) => {
    const { rejectWithValue, dispatch } = thunkAPI;
    try {
      const { data, totalRecords } = await getDepartmentEquipments(pagination);
      return {
        data,
        totalRecords,
        pagination,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch department equipment';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const searchDepartmentEquipmentsThunk = createAsyncThunk(
  'departmentEquipment/searchDepartmentEquipments',
  async (pagination: DepartmentEquipmentSearchParams | undefined, thunkAPI) => {
    const { rejectWithValue, dispatch } = thunkAPI;
    try {
      const queryParams = buildPaginationQueryParams(pagination);
      const searchTerm = pagination?.searchTerm?.trim();
      if (searchTerm) queryParams.append('searchTerm', searchTerm);
      const queryString = queryParams.toString();
      const endpoint = `/DepartmentEquipment/search${queryString ? `?${queryString}` : ''}`;
      const response = await apiGet(endpoint);
      const responseText = await expectOkReadText(response, 'Failed to search department equipment');
      const { data, totalRecords } = parsePagedListJson(responseText, (row) => normalizeDepartmentEquipment(row));
      return {
        data,
        totalRecords,
        pagination,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to search department equipment';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchDepartmentVehicleOptions = createAsyncThunk<
  DepartmentEquipmentSelectOptionDto[],
  { selectedIds?: string[]; searchTerm?: string } | undefined
>(
  'departmentEquipment/fetchDepartmentVehicleOptions',
  async (params, thunkAPI) => {
    const { rejectWithValue } = thunkAPI;
    try {
      return await getDepartmentVehicleOptions({
        selectedIds: params?.selectedIds,
        searchTerm: params?.searchTerm,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch department vehicle options';
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchDepartmentEquipmentOptions = createAsyncThunk<
  DepartmentEquipmentSelectOptionDto[],
  { selectedIds?: string[]; searchTerm?: string } | undefined
>(
  'departmentEquipment/fetchDepartmentEquipmentOptions',
  async (params, thunkAPI) => {
    const { rejectWithValue } = thunkAPI;
    try {
      return await getDepartmentEquipmentOptions({
        selectedIds: params?.selectedIds,
        searchTerm: params?.searchTerm,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch department equipment options';
      return rejectWithValue(errorMessage);
    }
  }
);

export const upsertDepartmentEquipmentThunk = createAsyncThunk(
  'departmentEquipment/upsertDepartmentEquipment',
  async (
    payload: CreateDepartmentEquipmentRequest | UpdateDepartmentEquipmentRequest,
    { rejectWithValue, dispatch }
  ) => {
    try {
      if ('departmentEquipmentID' in payload && payload.departmentEquipmentID) {
        const data = await updateDepartmentEquipment(payload as UpdateDepartmentEquipmentRequest);
        dispatch(showToast('Department equipment updated successfully.', 'success'));
        return data;
      }
      const data = await createDepartmentEquipment(payload as CreateDepartmentEquipmentRequest);
      dispatch(showToast('Department equipment created successfully.', 'success'));
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save department equipment';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const removeDepartmentEquipment = createAsyncThunk<
  string,
  { id: string; name: string }
>(
  'departmentEquipment/removeDepartmentEquipment',
  async ({ id, name }, { rejectWithValue, dispatch }) => {
    try {
      await deleteDepartmentEquipment(id);
      dispatch(showToast('Department equipment deleted successfully.', 'success'));
      return id;
    } catch (error) {
      const rawMessage =
        error instanceof Error ? error.message : 'Failed to delete department equipment';
      const errorMessage = rawMessage.replace('{0}', name);
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

const departmentEquipmentSlice = createSlice({
  name: 'departmentEquipment',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDepartmentEquipments.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchDepartmentEquipments.fulfilled, (state, action) => {
        state.isLoading = false;
        state.departmentEquipments = action.payload.data;
        state.totalItems = action.payload.totalRecords;
        state.error = null;
      })
      .addCase(fetchDepartmentEquipments.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(searchDepartmentEquipmentsThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(searchDepartmentEquipmentsThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.departmentEquipments = action.payload.data;
        state.totalItems = action.payload.totalRecords;
        state.error = null;
      })
      .addCase(searchDepartmentEquipmentsThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(upsertDepartmentEquipmentThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(upsertDepartmentEquipmentThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        const idx = state.departmentEquipments.findIndex(
          (e) => e.departmentEquipmentID === action.payload.departmentEquipmentID
        );
        if (idx >= 0) state.departmentEquipments[idx] = action.payload;
        else state.departmentEquipments.push(action.payload);
        state.error = null;
      })
      .addCase(upsertDepartmentEquipmentThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(removeDepartmentEquipment.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(removeDepartmentEquipment.fulfilled, (state, action) => {
        state.isLoading = false;
        state.departmentEquipments = state.departmentEquipments.filter(
          (e) => e.departmentEquipmentID !== action.payload
        );
        state.error = null;
      })
      .addCase(removeDepartmentEquipment.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchDepartmentVehicleOptions.pending, (state, action) => {
        state.isLoadingVehicleOptions = true;
        state.pendingVehicleOptionsRequestId = action.meta.requestId;
        state.error = null;
      })
      .addCase(fetchDepartmentVehicleOptions.fulfilled, (state, action) => {
        if (state.pendingVehicleOptionsRequestId !== action.meta.requestId) return;
        state.isLoadingVehicleOptions = false;
        state.pendingVehicleOptionsRequestId = null;
        state.departmentVehicleOptions = action.payload;
        state.error = null;
      })
      .addCase(fetchDepartmentVehicleOptions.rejected, (state, action) => {
        if (state.pendingVehicleOptionsRequestId !== action.meta.requestId) return;
        state.isLoadingVehicleOptions = false;
        state.pendingVehicleOptionsRequestId = null;
        state.departmentVehicleOptions = [];
        state.error = action.payload as string;
      })
      .addCase(fetchDepartmentEquipmentOptions.pending, (state, action) => {
        state.isLoadingEquipmentOptions = true;
        state.pendingEquipmentOptionsRequestId = action.meta.requestId;
        state.error = null;
      })
      .addCase(fetchDepartmentEquipmentOptions.fulfilled, (state, action) => {
        if (state.pendingEquipmentOptionsRequestId !== action.meta.requestId) return;
        state.isLoadingEquipmentOptions = false;
        state.pendingEquipmentOptionsRequestId = null;
        state.departmentEquipmentOptions = action.payload;
        state.error = null;
      })
      .addCase(fetchDepartmentEquipmentOptions.rejected, (state, action) => {
        if (state.pendingEquipmentOptionsRequestId !== action.meta.requestId) return;
        state.isLoadingEquipmentOptions = false;
        state.pendingEquipmentOptionsRequestId = null;
        state.departmentEquipmentOptions = [];
        state.error = action.payload as string;
      });
  },
});

export const { clearError } = departmentEquipmentSlice.actions;
export default departmentEquipmentSlice.reducer;

