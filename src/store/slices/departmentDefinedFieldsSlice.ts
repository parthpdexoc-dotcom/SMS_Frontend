/**
 * DepartmentDefinedFields Redux Slice
 */
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants/tablePagination';
import {
  createDepartmentDefinedFields,
  deleteDepartmentDefinedFields,
  getDepartmentDefinedFields,
  getDepartmentDefinedFieldsByDepartmentId,
  updateDepartmentDefinedFields,
} from '@/services/departmentDefinedFieldsService';
import {
  DepartmentDefinedFieldsPaginationParams,
  DepartmentDefinedFieldsResponse,
  CreateDepartmentDefinedFieldsRequest,
  UpdateDepartmentDefinedFieldsRequest,
} from '@/types/departmentDefinedFields';

interface DepartmentDefinedFieldsState {
  departmentDefinedFields: DepartmentDefinedFieldsResponse[];
  selectedDepartmentDefinedFields: DepartmentDefinedFieldsResponse | null;
  isLoading: boolean;
  error: string | null;
  totalItems: number;
  currentPage: number;
  pageSize: number;
}

const initialState: DepartmentDefinedFieldsState = {
  departmentDefinedFields: [],
  selectedDepartmentDefinedFields: null,
  isLoading: false,
  error: null,
  totalItems: 0,
  currentPage: 1,
  pageSize: DEFAULT_TABLE_PAGE_SIZE,
};

export const fetchDepartmentDefinedFields = createAsyncThunk(
  'departmentDefinedFields/fetchDepartmentDefinedFields',
  async (pagination: DepartmentDefinedFieldsPaginationParams | undefined, thunkAPI) => {
    const { rejectWithValue } = thunkAPI;
    try {
      const data = await getDepartmentDefinedFields(pagination);
      return { data, pagination };
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to fetch department defined fields'
      );
    }
  }
);

export const fetchDepartmentDefinedFieldsByDepartmentId = createAsyncThunk(
  'departmentDefinedFields/fetchByDepartmentId',
  async (departmentID: string, { rejectWithValue }) => {
    try {
      const data = await getDepartmentDefinedFieldsByDepartmentId(departmentID);
      return data;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to fetch department defined fields'
      );
    }
  }
);

export const upsertDepartmentDefinedFieldsThunk = createAsyncThunk(
  'departmentDefinedFields/upsertDepartmentDefinedFields',
  async (
    payload: CreateDepartmentDefinedFieldsRequest | UpdateDepartmentDefinedFieldsRequest,
    { rejectWithValue }
  ) => {
    try {
      if ('departmentDefinedFieldID' in payload && payload.departmentDefinedFieldID) {
        return await updateDepartmentDefinedFields(payload as UpdateDepartmentDefinedFieldsRequest);
      }
      return await createDepartmentDefinedFields(payload as CreateDepartmentDefinedFieldsRequest);
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to save department defined fields'
      );
    }
  }
);

export const removeDepartmentDefinedFields = createAsyncThunk(
  'departmentDefinedFields/removeDepartmentDefinedFields',
  async (departmentDefinedFieldID: string, { rejectWithValue }) => {
    try {
      await deleteDepartmentDefinedFields(departmentDefinedFieldID);
      return departmentDefinedFieldID;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to delete department defined fields'
      );
    }
  }
);

const departmentDefinedFieldsSlice = createSlice({
  name: 'departmentDefinedFields',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearSelectedDepartmentDefinedFields: (state) => {
      state.selectedDepartmentDefinedFields = null;
    },
    setPagination: (state, action) => {
      state.currentPage = action.payload.page || state.currentPage;
      state.pageSize = action.payload.pageSize || state.pageSize;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch all
      .addCase(fetchDepartmentDefinedFields.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchDepartmentDefinedFields.fulfilled, (state, action) => {
        state.isLoading = false;
        state.departmentDefinedFields = action.payload.data;
        if (action.payload.pagination) {
          if (action.payload.pagination.page !== undefined) state.currentPage = action.payload.pagination.page;
          if (action.payload.pagination.pageSize !== undefined) state.pageSize = action.payload.pagination.pageSize;
        }
        state.totalItems = action.payload.data.length;
        state.error = null;
      })
      .addCase(fetchDepartmentDefinedFields.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Fetch by department ID
      .addCase(fetchDepartmentDefinedFieldsByDepartmentId.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchDepartmentDefinedFieldsByDepartmentId.fulfilled, (state, action) => {
        state.isLoading = false;
        state.selectedDepartmentDefinedFields = action.payload;
        state.error = null;
      })
      .addCase(fetchDepartmentDefinedFieldsByDepartmentId.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Upsert
      .addCase(upsertDepartmentDefinedFieldsThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(upsertDepartmentDefinedFieldsThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        const idx = state.departmentDefinedFields.findIndex(
          (d) => d.departmentDefinedFieldID === action.payload.departmentDefinedFieldID
        );
        if (idx >= 0) {
          state.departmentDefinedFields[idx] = action.payload;
        } else {
          state.departmentDefinedFields.push(action.payload);
        }
        state.selectedDepartmentDefinedFields = action.payload;
        state.error = null;
      })
      .addCase(upsertDepartmentDefinedFieldsThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Delete
      .addCase(removeDepartmentDefinedFields.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(removeDepartmentDefinedFields.fulfilled, (state, action) => {
        state.isLoading = false;
        state.departmentDefinedFields = state.departmentDefinedFields.filter(
          (d) => d.departmentDefinedFieldID !== action.payload
        );
        if (state.selectedDepartmentDefinedFields?.departmentDefinedFieldID === action.payload) {
          state.selectedDepartmentDefinedFields = null;
        }
        state.error = null;
      })
      .addCase(removeDepartmentDefinedFields.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError, clearSelectedDepartmentDefinedFields, setPagination } = departmentDefinedFieldsSlice.actions;
export default departmentDefinedFieldsSlice.reducer;
