/**
 * EmployeeStatus Redux Slice
 */
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  createEmployeeStatus,
  deleteEmployeeStatus,
  getActiveEmployeeStatuses,
  getEmployeeStatuses,
  updateEmployeeStatus,
} from '@/services/employeeStatusService';
import {
  CreateEmployeeStatusRequest,
  EmployeeStatusPaginationParams,
  EmployeeStatusSearchParams,
  EmployeeStatusResponse,
  UpdateEmployeeStatusRequest,
} from '@/types/employeeStatus';
import { showToast } from './toastSlice';
import { apiGet } from '@/utils/apiClient';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';
import { expectOkReadText, parsePagedListJson } from '@/services/textPlainJson';
import { normalizeEmployeeStatus } from '@/utils/normalizers';

interface EmployeeStatusState {
  employeeStatuses: EmployeeStatusResponse[];
  /** Active-only list for form dropdowns (from getAllActive endpoint) */
  activeEmployeeStatuses: EmployeeStatusResponse[];
  isLoading: boolean;
  error: string | null;
  totalItems: number;
}

const initialState: EmployeeStatusState = {
  employeeStatuses: [],
  activeEmployeeStatuses: [],
  isLoading: false,
  error: null,
  totalItems: 0,
};

export const fetchEmployeeStatuses = createAsyncThunk(
  'employeeStatus/fetchEmployeeStatuses',
  async (pagination: EmployeeStatusPaginationParams | undefined, thunkAPI) => {
    const { rejectWithValue, dispatch } = thunkAPI;
    try {
      const { data, totalRecords } = await getEmployeeStatuses(pagination);
      return { data, totalRecords, pagination };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch employee statuses';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchActiveEmployeeStatuses = createAsyncThunk(
  'employeeStatus/fetchActiveEmployeeStatuses',
  async (params: string | { departmentId?: string; selectedId?: string } | undefined, thunkAPI) => {
    const { rejectWithValue } = thunkAPI;
    try {
      const requestParams =
        typeof params === 'string' || params == null ? { departmentId: params } : params;
      return await getActiveEmployeeStatuses(requestParams);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch active employee statuses';
      return rejectWithValue(errorMessage);
    }
  }
);

export const searchEmployeeStatusesThunk = createAsyncThunk(
  'employeeStatus/searchEmployeeStatuses',
  async (pagination: EmployeeStatusSearchParams | undefined, thunkAPI) => {
    const { rejectWithValue, dispatch } = thunkAPI;
    try {
      const queryParams = buildPaginationQueryParams(pagination);
      const searchTerm = pagination?.searchTerm?.trim();
      if (searchTerm) queryParams.append('searchTerm', searchTerm);
      const queryString = queryParams.toString();
      const endpoint = `/EmployeeStatus/search${queryString ? `?${queryString}` : ''}`;
      const response = await apiGet(endpoint);
      const responseText = await expectOkReadText(response, 'Failed to search employee statuses');
      const { data, totalRecords } = parsePagedListJson(responseText, (row) => normalizeEmployeeStatus(row));
      return { data, totalRecords, pagination };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to search employee statuses';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const upsertEmployeeStatusThunk = createAsyncThunk(
  'employeeStatus/upsertEmployeeStatus',
  async (
    payload: CreateEmployeeStatusRequest | UpdateEmployeeStatusRequest,
    { rejectWithValue, dispatch }
  ) => {
    try {
      if ('employeeStatusID' in payload && payload.employeeStatusID) {
        const data = await updateEmployeeStatus(payload as UpdateEmployeeStatusRequest);
        dispatch(showToast('Employee status updated successfully.', 'success'));
        return data;
      }
      const data = await createEmployeeStatus(payload as CreateEmployeeStatusRequest);
      dispatch(showToast('Employee status created successfully.', 'success'));
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save employee status';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const removeEmployeeStatus = createAsyncThunk<
  string,
  { id: string; name: string }
>(
  'employeeStatus/removeEmployeeStatus',
  async ({ id, name }, { rejectWithValue, dispatch }) => {
    try {
      await deleteEmployeeStatus(id);
      dispatch(showToast('Employee status deleted successfully.', 'success'));
      return id;
    } catch (error) {
      const rawMessage =
        error instanceof Error ? error.message : 'Failed to delete employee status';
      const errorMessage = rawMessage.replace('{0}', name);
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

const employeeStatusSlice = createSlice({
  name: 'employeeStatus',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchEmployeeStatuses.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchEmployeeStatuses.fulfilled, (state, action) => {
        state.isLoading = false;
        state.employeeStatuses = action.payload.data;
        state.totalItems = action.payload.totalRecords;
        state.error = null;
      })
      .addCase(fetchEmployeeStatuses.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchActiveEmployeeStatuses.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchActiveEmployeeStatuses.fulfilled, (state, action) => {
        state.isLoading = false;
        state.activeEmployeeStatuses = action.payload;
        state.error = null;
      })
      .addCase(fetchActiveEmployeeStatuses.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(searchEmployeeStatusesThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(searchEmployeeStatusesThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.employeeStatuses = action.payload.data;
        state.totalItems = action.payload.totalRecords;
        state.error = null;
      })
      .addCase(searchEmployeeStatusesThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(upsertEmployeeStatusThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(upsertEmployeeStatusThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        const idx = state.employeeStatuses.findIndex((e) => e.employeeStatusID === action.payload.employeeStatusID);
        if (idx >= 0) state.employeeStatuses[idx] = action.payload;
        else state.employeeStatuses.push(action.payload);
        state.error = null;
      })
      .addCase(upsertEmployeeStatusThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(removeEmployeeStatus.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(removeEmployeeStatus.fulfilled, (state, action) => {
        state.isLoading = false;
        state.employeeStatuses = state.employeeStatuses.filter((e) => e.employeeStatusID !== action.payload);
        state.error = null;
      })
      .addCase(removeEmployeeStatus.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError } = employeeStatusSlice.actions;
export default employeeStatusSlice.reducer;


