/**
 * EmployeeType Redux Slice
 */
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  createEmployeeType,
  deleteEmployeeType,
  getActiveEmployeeTypes,
  getEmployeeTypeById,
  getEmployeeTypeOptions,
  getEmployeeTypes,
  updateEmployeeType,
  updateEmployeeTypeRank,
} from '@/services/employeeTypeService';
import type { EmployeeTypeOptionsParams } from '@/services/employeeTypeService';
import {
  ActiveEmployeeTypeParams,
  CreateEmployeeTypeRequest,
  EmployeeTypePaginationParams,
  EmployeeTypeResponse,
  EmployeeTypeSearchParams,
  UpdateEmployeeTypeRequest,
} from '@/types/employeeType';
import { showToast } from './toastSlice';
import { apiGet } from '@/utils/apiClient';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';
import { expectOkReadText, parsePagedListJson } from '@/services/textPlainJson';
import { normalizeEmployeeType } from '@/utils/normalizers';
import type { SelectOptionDto } from '@/types/common';

interface EmployeeTypeState {
  employeeTypes: EmployeeTypeResponse[];
  activeEmployeeTypes: EmployeeTypeResponse[];
  employeeTypeOptions: SelectOptionDto[];
  selectedEmployeeType: EmployeeTypeResponse | null;
  isLoading: boolean;
  error: string | null;
  totalItems: number;
}

const initialState: EmployeeTypeState = {
  employeeTypes: [],
  activeEmployeeTypes: [],
  employeeTypeOptions: [],
  selectedEmployeeType: null,
  isLoading: false,
  error: null,
  totalItems: 0,
};

export const fetchEmployeeTypes = createAsyncThunk(
  'employeeType/fetchEmployeeTypes',
  async (pagination: EmployeeTypePaginationParams | undefined, thunkAPI) => {
    const { rejectWithValue, dispatch } = thunkAPI;
    try {
      const { data, totalRecords } = await getEmployeeTypes(pagination);
      return { data, totalRecords, pagination };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch employee types';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchActiveEmployeeTypes = createAsyncThunk(
  'employeeType/fetchActiveEmployeeTypes',
  async (params: string | ActiveEmployeeTypeParams | undefined, thunkAPI) => {
    const { rejectWithValue, dispatch } = thunkAPI;
    try {
      const requestParams =
        typeof params === 'string' || params == null ? { departmentId: params } : params;
      return await getActiveEmployeeTypes(requestParams);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch active employee types';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchEmployeeTypeOptions = createAsyncThunk<
  SelectOptionDto[],
  EmployeeTypeOptionsParams | undefined
>(
  'employeeType/fetchEmployeeTypeOptions',
  async (params, thunkAPI) => {
    const { rejectWithValue, dispatch } = thunkAPI;
    try {
      return await getEmployeeTypeOptions(params);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch employee type options';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchEmployeeTypeById = createAsyncThunk(
  'employeeType/fetchEmployeeTypeById',
  async (employeeTypeID: string, thunkAPI) => {
    const { rejectWithValue, dispatch } = thunkAPI;
    try {
      return await getEmployeeTypeById(employeeTypeID);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch employee type';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const searchEmployeeTypesThunk = createAsyncThunk(
  'employeeType/searchEmployeeTypes',
  async (pagination: EmployeeTypeSearchParams | undefined, thunkAPI) => {
    const { rejectWithValue, dispatch } = thunkAPI;
    try {
      const queryParams = buildPaginationQueryParams(pagination);
      const searchTerm = pagination?.searchTerm?.trim();
      if (searchTerm) queryParams.append('searchTerm', searchTerm);
      const queryString = queryParams.toString();
      const endpoint = `/EmployeeType/search${queryString ? `?${queryString}` : ''}`;
      const response = await apiGet(endpoint);
      const responseText = await expectOkReadText(response, 'Failed to search employee types');
      const { data, totalRecords } = parsePagedListJson(responseText, (row) => normalizeEmployeeType(row));
      return { data, totalRecords, pagination };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to search employee types';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const upsertEmployeeTypeThunk = createAsyncThunk(
  'employeeType/upsertEmployeeType',
  async (
    payload: CreateEmployeeTypeRequest | UpdateEmployeeTypeRequest,
    { rejectWithValue, dispatch }
  ) => {
    try {
      if ('employeeTypeID' in payload && payload.employeeTypeID) {
        const data = await updateEmployeeType(payload as UpdateEmployeeTypeRequest);
        dispatch(showToast('Employee type updated successfully.', 'success'));
        return data;
      }
      const data = await createEmployeeType(payload as CreateEmployeeTypeRequest);
      dispatch(showToast('Employee type created successfully.', 'success'));
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save employee type';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const removeEmployeeType = createAsyncThunk<
  string,
  { id: string; name: string }
>(
  'employeeType/removeEmployeeType',
  async ({ id, name }, { rejectWithValue, dispatch }) => {
    try {
      await deleteEmployeeType(id);
      dispatch(showToast('Employee type deleted successfully.', 'success'));
      return id;
    } catch (error) {
      const rawMessage =
        error instanceof Error ? error.message : 'Failed to delete employee type';
      const errorMessage = rawMessage.replace('{0}', name);
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const updateEmployeeTypeRankThunk = createAsyncThunk(
  'employeeType/updateRank',
  async (
    {
      employeeTypeID,
      rank,
      atDisplayRow,
    }: { employeeTypeID: string; rank: number; atDisplayRow?: number },
    { rejectWithValue, dispatch }
  ) => {
    try {
      await updateEmployeeTypeRank(employeeTypeID, rank, {
        ...(atDisplayRow != null ? { atDisplayRow } : {}),
      });
      dispatch(showToast('Employee type rank updated successfully.', 'success'));
      return { employeeTypeID, rank };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update employee type rank';
        dispatch(showToast(errorMessage, 'error'));
        return rejectWithValue(errorMessage);
    }
  }
);

const employeeTypeSlice = createSlice({
  name: 'employeeType',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchEmployeeTypes.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchEmployeeTypes.fulfilled, (state, action) => {
        state.isLoading = false;
        state.employeeTypes = action.payload.data;
        state.totalItems = action.payload.totalRecords;
        state.error = null;
      })
      .addCase(fetchEmployeeTypes.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchActiveEmployeeTypes.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchActiveEmployeeTypes.fulfilled, (state, action) => {
        state.isLoading = false;
        state.activeEmployeeTypes = action.payload;
        state.error = null;
      })
      .addCase(fetchActiveEmployeeTypes.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchEmployeeTypeOptions.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchEmployeeTypeOptions.fulfilled, (state, action) => {
        state.isLoading = false;
        state.employeeTypeOptions = action.payload;
        state.error = null;
      })
      .addCase(fetchEmployeeTypeOptions.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.employeeTypeOptions = [];
      })
      .addCase(fetchEmployeeTypeById.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchEmployeeTypeById.fulfilled, (state, action) => {
        state.isLoading = false;
        state.selectedEmployeeType = action.payload;
        state.error = null;
      })
      .addCase(fetchEmployeeTypeById.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.selectedEmployeeType = null;
      })
      .addCase(searchEmployeeTypesThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(searchEmployeeTypesThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.employeeTypes = action.payload.data;
        state.totalItems = action.payload.totalRecords;
        state.error = null;
      })
      .addCase(searchEmployeeTypesThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(upsertEmployeeTypeThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(upsertEmployeeTypeThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        const idx = state.employeeTypes.findIndex((e) => e.employeeTypeID === action.payload.employeeTypeID);
        if (idx >= 0) state.employeeTypes[idx] = action.payload;
        else state.employeeTypes.push(action.payload);
        state.error = null;
      })
      .addCase(upsertEmployeeTypeThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(removeEmployeeType.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(removeEmployeeType.fulfilled, (state, action) => {
        state.isLoading = false;
        state.employeeTypes = state.employeeTypes.filter((e) => e.employeeTypeID !== action.payload);
        state.error = null;
      })
      .addCase(removeEmployeeType.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(updateEmployeeTypeRankThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateEmployeeTypeRankThunk.fulfilled, (state) => {
        state.isLoading = false;
        state.error = null;
        // Don't update local state - refresh will get the new order from backend
      })
      .addCase(updateEmployeeTypeRankThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError } = employeeTypeSlice.actions;
export default employeeTypeSlice.reducer;


