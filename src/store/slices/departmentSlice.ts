/**
 * Department Redux Slice
 */
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  createDepartment,
  deleteDepartment,
  getDepartments,
  getDepartmentById,
  updateDepartment,
} from '@/services/departmentService';
import {
  CreateDepartmentRequest,
  DepartmentPaginationParams,
  DepartmentSearchParams,
  DepartmentResponse,
  UpdateDepartmentRequest,
} from '@/types/department';
import { showToast } from './toastSlice';
import { apiGet } from '@/utils/apiClient';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';
import { expectOkReadText, parsePagedListJson } from '@/services/textPlainJson';
import { normalizeDepartment } from '@/utils/normalizers';

/**
 * Transform department data to backend expected format (PascalCase)
 */
const transformDepartmentPayload = (data: CreateDepartmentRequest | UpdateDepartmentRequest) => {
  const basePayload = {
    DepartmentCode: data.departmentCode,
    DepartmentName: data.departmentName,
    Address: data.address,
    City: data.city,
    State: data.state,
    Zip: data.zip,
    FirstName: data.firstName,
    LastName: data.lastName,
    Phone: data.phone,
    Fax: data.fax,
    Email: data.email,
    Domain: data.domain,
    Active: data.active,
    TimeZoneId: data.timeZoneId,
    EmployeeDataFolderName: data.employeeDataFolderName ?? '',
  };

  // Add DepartmentID for update requests
  if ('departmentID' in data) {
    return {
      ...basePayload,
      DepartmentID: data.departmentID,
    };
  }

  return basePayload;
};

interface DepartmentState {
  departments: DepartmentResponse[];
  isLoading: boolean;
  error: string | null;
  totalItems: number;
}

const initialState: DepartmentState = {
  departments: [],
  isLoading: false,
  error: null,
  totalItems: 0,
};

export const fetchDepartments = createAsyncThunk(
  'department/fetchDepartments',
  async (pagination: DepartmentPaginationParams | undefined, thunkAPI) => {
    const { rejectWithValue, dispatch } = thunkAPI;
    try {
      const { data, totalRecords } = await getDepartments(pagination);
      return { data, totalRecords, pagination };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to fetch departments';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchDepartmentById = createAsyncThunk(
  'department/fetchDepartmentById',
  async (id: string, thunkAPI) => {
    const { rejectWithValue, dispatch } = thunkAPI;
    try {
      const data = await getDepartmentById(id);
      return data;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to fetch department';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const searchDepartmentsThunk = createAsyncThunk(
  'department/searchDepartments',
  async (pagination: DepartmentSearchParams | undefined, thunkAPI) => {
    const { rejectWithValue, dispatch } = thunkAPI;
    try {
      const queryParams = buildPaginationQueryParams(pagination);
      const searchTerm = pagination?.searchTerm?.trim();
      if (searchTerm) queryParams.append('searchTerm', searchTerm);
      const endpoint = `/Department/search${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await apiGet(endpoint);
      const responseText = await expectOkReadText(response, 'Failed to search departments');
      const { data, totalRecords } = parsePagedListJson(responseText, (row) => normalizeDepartment(row));
      return { data, totalRecords, pagination };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to search departments';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const createDepartmentThunk = createAsyncThunk(
  'department/createDepartment',
  async (
    arg: CreateDepartmentRequest & { suppressSuccessToast?: boolean },
    { rejectWithValue, dispatch }
  ) => {
    const { suppressSuccessToast, ...payload } = arg;
    try {
      const transformedPayload = transformDepartmentPayload(payload);
      const data = await createDepartment(transformedPayload);
      if (!suppressSuccessToast) {
        dispatch(showToast('Department created successfully.', 'success'));
      }
      return data;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to create department';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const updateDepartmentThunk = createAsyncThunk(
  'department/updateDepartment',
  async (payload: UpdateDepartmentRequest, { rejectWithValue, dispatch }) => {
    try {
      const transformedPayload = transformDepartmentPayload(payload);
      const data = await updateDepartment(transformedPayload);
      dispatch(showToast('Department updated successfully.', 'success'));
      return data;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to update department';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const removeDepartment = createAsyncThunk<
  string,
  { id: string; name: string }
>(
  'department/removeDepartment',
  async ({ id, name }, { rejectWithValue, dispatch }) => {
    try {
      await deleteDepartment(id);
      dispatch(showToast('Department deleted successfully.', 'success'));
      return id;
    } catch (error) {
      const rawMessage =
        error instanceof Error ? error.message : 'Failed to delete department';
      const errorMessage = rawMessage.replace('{0}', name);
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

const departmentSlice = createSlice({
  name: 'department',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDepartments.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchDepartments.fulfilled, (state, action) => {
        state.isLoading = false;
        state.departments = action.payload.data;
        state.totalItems = action.payload.totalRecords;
        state.error = null;
      })
      .addCase(fetchDepartments.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(searchDepartmentsThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(searchDepartmentsThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.departments = action.payload.data;
        state.totalItems = action.payload.totalRecords;
        state.error = null;
      })
      .addCase(searchDepartmentsThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchDepartmentById.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchDepartmentById.fulfilled, (state) => {
        state.isLoading = false;
        state.error = null;
      })
      .addCase(fetchDepartmentById.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(createDepartmentThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createDepartmentThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.departments.push(action.payload);
        state.error = null;
      })
      .addCase(createDepartmentThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(updateDepartmentThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateDepartmentThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        const idx = state.departments.findIndex(
          (e) => e.departmentID === action.payload.departmentID
        );
        if (idx >= 0) state.departments[idx] = action.payload;
        state.error = null;
      })
      .addCase(updateDepartmentThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(removeDepartment.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(removeDepartment.fulfilled, (state, action) => {
        state.isLoading = false;
        state.departments = state.departments.filter(
          (e) => e.departmentID !== action.payload
        );
        state.error = null;
      })
      .addCase(removeDepartment.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError } = departmentSlice.actions;
export default departmentSlice.reducer;

