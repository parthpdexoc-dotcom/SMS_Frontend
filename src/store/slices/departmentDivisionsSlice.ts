/**
 * DepartmentDivisions Redux Slice
 */
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  createDepartmentDivision,
  deleteDepartmentDivision,
  getActiveDepartmentDivisions,
  getDepartmentDivisions,
  updateDepartmentDivision,
} from '@/services/departmentDivisionsService';
import {
  ActiveDepartmentDivisionParams,
  CreateDepartmentDivisionRequest,
  DepartmentDivisionPaginationParams,
  DepartmentDivisionResponse,
  DepartmentDivisionSearchParams,
  UpdateDepartmentDivisionRequest,
} from '@/types/departmentDivision';
import { showToast } from './toastSlice';
import { apiGet } from '@/utils/apiClient';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';
import { expectOkReadText, parsePagedListJson } from '@/services/textPlainJson';
import { normalizeDepartmentDivision } from '@/utils/normalizers';

interface DepartmentDivisionsState {
  divisions: DepartmentDivisionResponse[];
  activeDivisions: DepartmentDivisionResponse[];
  isLoading: boolean;
  error: string | null;
  totalItems: number;
  departmentID?: string;
}

const initialState: DepartmentDivisionsState = {
  divisions: [],
  activeDivisions: [],
  isLoading: false,
  error: null,
  totalItems: 0,
};

export const fetchDepartmentDivisions = createAsyncThunk(
  'departmentDivisions/fetchDepartmentDivisions',
  async (
    params: { pagination?: DepartmentDivisionPaginationParams; departmentID?: string } | undefined,
    thunkAPI
  ) => {
    const { rejectWithValue, dispatch } = thunkAPI;
    try {
      const pagination = params?.pagination;
      const departmentID = params?.departmentID;
      const { data, totalRecords } = await getDepartmentDivisions(pagination, departmentID);
      return { data, totalRecords, pagination, departmentID };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch department divisions';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchActiveDepartmentDivisions = createAsyncThunk(
  'departmentDivisions/fetchActiveDepartmentDivisions',
  async (params: ActiveDepartmentDivisionParams | undefined, thunkAPI) => {
    const { rejectWithValue, dispatch } = thunkAPI;
    try {
      return await getActiveDepartmentDivisions(params);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch active department divisions';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const searchDepartmentDivisionsThunk = createAsyncThunk(
  'departmentDivisions/searchDepartmentDivisions',
  async (
    params: { pagination?: DepartmentDivisionSearchParams; departmentID?: string } | undefined,
    thunkAPI
  ) => {
    const { rejectWithValue, dispatch } = thunkAPI;
    try {
      const pagination = params?.pagination;
      const queryParams = buildPaginationQueryParams(pagination);
      const searchTerm = pagination?.searchTerm?.trim();
      if (searchTerm) queryParams.append('searchTerm', searchTerm);
      if (params?.departmentID) queryParams.append('departmentID', params.departmentID);
      const queryString = queryParams.toString();
      const endpoint = `/DepartmentDivisions/search${queryString ? `?${queryString}` : ''}`;
      const response = await apiGet(endpoint);
      const responseText = await expectOkReadText(response, 'Failed to search department divisions');
      const { data, totalRecords } = parsePagedListJson(responseText, (row) => normalizeDepartmentDivision(row));
      return { data, totalRecords, pagination, departmentID: params?.departmentID };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to search department divisions';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const upsertDepartmentDivisionThunk = createAsyncThunk(
  'departmentDivisions/upsertDepartmentDivision',
  async (
    payload: CreateDepartmentDivisionRequest | UpdateDepartmentDivisionRequest,
    { rejectWithValue, dispatch }
  ) => {
    try {
      if ('divisionID' in payload && payload.divisionID) {
        const data = await updateDepartmentDivision(payload as UpdateDepartmentDivisionRequest);
        dispatch(showToast('Department division updated successfully.', 'success'));
        return data;
      }
      const data = await createDepartmentDivision(payload as CreateDepartmentDivisionRequest);
      dispatch(showToast('Department division created successfully.', 'success'));
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save department division';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const removeDepartmentDivision = createAsyncThunk<
  string,
  { id: string; name: string }
>(
  'departmentDivisions/removeDepartmentDivision',
  async ({ id, name }, { rejectWithValue, dispatch }) => {
    try {
      await deleteDepartmentDivision(id);
      dispatch(showToast('Department division deleted successfully.', 'success'));
      return id;
    } catch (error) {
      const rawMessage =
        error instanceof Error ? error.message : 'Failed to delete department division';
      const errorMessage = rawMessage.replace('{0}', name);
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

const departmentDivisionsSlice = createSlice({
  name: 'departmentDivisions',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDepartmentDivisions.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchDepartmentDivisions.fulfilled, (state, action) => {
        state.isLoading = false;
        state.divisions = action.payload.data;
        state.totalItems = action.payload.totalRecords;
        state.error = null;
        // Store the departmentID filter for reference
        if (action.payload.departmentID) {
          state.departmentID = action.payload.departmentID;
        }
      })
      .addCase(fetchDepartmentDivisions.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchActiveDepartmentDivisions.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchActiveDepartmentDivisions.fulfilled, (state, action) => {
        state.isLoading = false;
        state.activeDivisions = action.payload;
        state.error = null;
      })
      .addCase(fetchActiveDepartmentDivisions.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(searchDepartmentDivisionsThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(searchDepartmentDivisionsThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.divisions = action.payload.data;
        state.totalItems = action.payload.totalRecords;
        state.error = null;
        if (action.payload.departmentID) {
          state.departmentID = action.payload.departmentID;
        }
      })
      .addCase(searchDepartmentDivisionsThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(upsertDepartmentDivisionThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(upsertDepartmentDivisionThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        const idx = state.divisions.findIndex((d) => d.divisionID === action.payload.divisionID);
        if (idx >= 0) state.divisions[idx] = action.payload;
        else state.divisions.push(action.payload);
        state.error = null;
      })
      .addCase(upsertDepartmentDivisionThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(removeDepartmentDivision.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(removeDepartmentDivision.fulfilled, (state, action) => {
        state.isLoading = false;
        state.divisions = state.divisions.filter((d) => d.divisionID !== action.payload);
        state.error = null;
      })
      .addCase(removeDepartmentDivision.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError } = departmentDivisionsSlice.actions;
export default departmentDivisionsSlice.reducer;


