/**
 * DepartmentActivityType Redux Slice
 */
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  createDepartmentActivityType,
  deleteDepartmentActivityType,
  getAllActiveDepartmentActivityType,
  getDepartmentActivityTypeOptions,
  getDepartmentActivityTypes,
  updateDepartmentActivityType,
} from '@/services/departmentActivityTypeService';
import type { DepartmentActivityTypeOptionsParams } from '@/services/departmentActivityTypeService';
import {
  CreateDepartmentActivityTypeRequest,
  DepartmentActivityTypePaginationParams,
  DepartmentActivityTypeResponse,
  DepartmentActivityTypeSearchParams,
  UpdateDepartmentActivityTypeRequest,
} from '@/types/departmentActivityType';
import { showToast } from './toastSlice';
import { apiGet } from '@/utils/apiClient';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';
import { expectOkReadText, parsePagedListJson } from '@/services/textPlainJson';
import { normalizeDepartmentActivityType } from '@/utils/normalizers';
import type { SelectOptionDto } from '@/types/common';

const MASTER_SOURCE_VALUE = 'MASTER';

/** System-seeded activity types (`createdBy` = MASTER) cannot be edited or deleted. */
export const isMasterDepartmentActivityType = (
  row: Pick<DepartmentActivityTypeResponse, 'createdBy' | 'activityTypeAbstract' | 'valueBy'>
): boolean => {
  const createdBy = (row.createdBy ?? '').trim().toUpperCase();
  if (createdBy === MASTER_SOURCE_VALUE) return true;

  const source = (row.valueBy ?? row.activityTypeAbstract ?? '').trim().toUpperCase();
  return source === MASTER_SOURCE_VALUE;
};

interface DepartmentActivityTypeState {
  activityTypes: DepartmentActivityTypeResponse[];
  /** Active-only list for dropdowns (from GetAllActiveDepartmentActivityType) */
  activeActivityTypes: DepartmentActivityTypeResponse[];
  departmentActivityTypeOptions: SelectOptionDto[];
  isLoading: boolean;
  error: string | null;
  totalItems: number;
}

const initialState: DepartmentActivityTypeState = {
  activityTypes: [],
  activeActivityTypes: [],
  departmentActivityTypeOptions: [],
  isLoading: false,
  error: null,
  totalItems: 0,
};

export const fetchDepartmentActivityTypes = createAsyncThunk(
  'departmentActivityType/fetchDepartmentActivityTypes',
  async (pagination: DepartmentActivityTypePaginationParams | undefined, thunkAPI) => {
    const { rejectWithValue, dispatch } = thunkAPI;
    try {
      const { data, totalRecords } = await getDepartmentActivityTypes(pagination);
      return { data, totalRecords, pagination };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch department activity types';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchAllActiveDepartmentActivityTypes = createAsyncThunk(
  'departmentActivityType/fetchAllActiveDepartmentActivityTypes',
  async (params: { selectedId?: string } | undefined, thunkAPI) => {
    const { rejectWithValue, dispatch } = thunkAPI;
    try {
      const data = await getAllActiveDepartmentActivityType(params);
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch active department activity types';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchDepartmentActivityTypeOptions = createAsyncThunk<
  SelectOptionDto[],
  DepartmentActivityTypeOptionsParams | undefined
>(
  'departmentActivityType/fetchDepartmentActivityTypeOptions',
  async (params, thunkAPI) => {
    const { rejectWithValue, dispatch } = thunkAPI;
    try {
      return await getDepartmentActivityTypeOptions(params);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to fetch department activity type options';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const searchDepartmentActivityTypesThunk = createAsyncThunk(
  'departmentActivityType/searchDepartmentActivityTypes',
  async (pagination: DepartmentActivityTypeSearchParams | undefined, thunkAPI) => {
    const { rejectWithValue, dispatch } = thunkAPI;
    try {
      const queryParams = buildPaginationQueryParams(pagination);
      const searchTerm = pagination?.searchTerm?.trim();
      if (searchTerm) queryParams.append('searchTerm', searchTerm);
      const queryString = queryParams.toString();
      const endpoint = `/DepartmentActivityType/search${queryString ? `?${queryString}` : ''}`;
      const response = await apiGet(endpoint);
      const responseText = await expectOkReadText(response, 'Failed to search department activity types');
      const { data, totalRecords } = parsePagedListJson(responseText, (row) => normalizeDepartmentActivityType(row));
      return { data, totalRecords, pagination };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to search department activity types';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const upsertDepartmentActivityTypeThunk = createAsyncThunk(
  'departmentActivityType/upsertDepartmentActivityType',
  async (
    payload: CreateDepartmentActivityTypeRequest | UpdateDepartmentActivityTypeRequest,
    { rejectWithValue, dispatch }
  ) => {
    try {
      if ('departmentActivityTypeId' in payload && payload.departmentActivityTypeId) {
        const data = await updateDepartmentActivityType(payload as UpdateDepartmentActivityTypeRequest);
        dispatch(showToast('Department activity type updated successfully.', 'success'));
        return data;
      }
      const data = await createDepartmentActivityType(payload as CreateDepartmentActivityTypeRequest);
      dispatch(showToast('Department activity type created successfully.', 'success'));
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save department activity type';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const removeDepartmentActivityType = createAsyncThunk<
  string,
  { id: string; name: string }
>(
  'departmentActivityType/removeDepartmentActivityType',
  async ({ id, name }, { rejectWithValue, dispatch }) => {
    try {
      await deleteDepartmentActivityType(id);
      dispatch(showToast('Department activity type deleted successfully.', 'success'));
      return id;
    } catch (error) {
      const rawMessage =
        error instanceof Error ? error.message : 'Failed to delete department activity type';
      const errorMessage = rawMessage.replace('{0}', name);
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

const departmentActivityTypeSlice = createSlice({
  name: 'departmentActivityType',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDepartmentActivityTypes.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchDepartmentActivityTypes.fulfilled, (state, action) => {
        state.isLoading = false;
        state.activityTypes = action.payload.data;
        state.totalItems = action.payload.totalRecords;
        state.error = null;
      })
      .addCase(fetchDepartmentActivityTypes.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchAllActiveDepartmentActivityTypes.fulfilled, (state, action) => {
        state.activeActivityTypes = action.payload;
      })
      .addCase(fetchDepartmentActivityTypeOptions.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchDepartmentActivityTypeOptions.fulfilled, (state, action) => {
        state.isLoading = false;
        state.departmentActivityTypeOptions = action.payload;
        state.error = null;
      })
      .addCase(fetchDepartmentActivityTypeOptions.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.departmentActivityTypeOptions = [];
      })
      .addCase(searchDepartmentActivityTypesThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(searchDepartmentActivityTypesThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.activityTypes = action.payload.data;
        state.totalItems = action.payload.totalRecords;
        state.error = null;
      })
      .addCase(searchDepartmentActivityTypesThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(upsertDepartmentActivityTypeThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(upsertDepartmentActivityTypeThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        const idx = state.activityTypes.findIndex((a) => a.departmentActivityTypeId === action.payload.departmentActivityTypeId);
        if (idx >= 0) state.activityTypes[idx] = action.payload;
        else state.activityTypes.push(action.payload);
        state.error = null;
      })
      .addCase(upsertDepartmentActivityTypeThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(removeDepartmentActivityType.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(removeDepartmentActivityType.fulfilled, (state, action) => {
        state.isLoading = false;
        state.activityTypes = state.activityTypes.filter((a) => a.departmentActivityTypeId !== action.payload);
        state.error = null;
      })
      .addCase(removeDepartmentActivityType.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError } = departmentActivityTypeSlice.actions;
export default departmentActivityTypeSlice.reducer;


