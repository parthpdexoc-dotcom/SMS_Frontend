/**
 * DepartmentAdmin Redux Slice
 * Modeled after BusinessType master data slice.
 */
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants/tablePagination';
import {
  createDepartmentAdmin,
  deleteDepartmentAdmin,
  getDepartmentAdmins,
  getDepartmentAdminEmployeeIds,
  updateDepartmentAdmin,
} from '@/services/departmentAdminService';
import {
  DepartmentAdminPaginationParams,
  DepartmentAdminResponse,
  CreateDepartmentAdminRequest,
  UpdateDepartmentAdminRequest,
} from '@/types/departmentAdmin';
import { showToast } from './toastSlice';

interface DepartmentAdminState {
  departmentAdmins: DepartmentAdminResponse[];
  /** Employee IDs for current department+adminType (from employees/ids API), used to bind the form. */
  departmentAdminEmployeeIds: string[];
  employeeIdsLoading: boolean;
  isLoading: boolean;
  error: string | null;
  totalItems: number;
  currentPage: number;
  pageSize: number;
}

const initialState: DepartmentAdminState = {
  departmentAdmins: [],
  departmentAdminEmployeeIds: [],
  employeeIdsLoading: false,
  isLoading: false,
  error: null,
  totalItems: 0,
  currentPage: 1,
  pageSize: DEFAULT_TABLE_PAGE_SIZE,
};

export const fetchDepartmentAdmins = createAsyncThunk(
  'departmentAdmin/fetchDepartmentAdmins',
  async (pagination: DepartmentAdminPaginationParams | undefined, thunkAPI) => {
    const { rejectWithValue, dispatch } = thunkAPI;
    try {
      const data = await getDepartmentAdmins(pagination);
      return { data, pagination };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch department admins';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const upsertDepartmentAdminThunk = createAsyncThunk(
  'departmentAdmin/upsertDepartmentAdmin',
  async (
    payload: CreateDepartmentAdminRequest | UpdateDepartmentAdminRequest,
    { rejectWithValue, dispatch }
  ) => {
    try {
      if ('departmentAdminID' in payload && payload.departmentAdminID) {
        const data = await updateDepartmentAdmin(payload as UpdateDepartmentAdminRequest);
        dispatch(showToast('Department admin updated successfully.', 'success'));
        return data;
      }
      const data = await createDepartmentAdmin(payload as CreateDepartmentAdminRequest);
      dispatch(showToast('Department admin created successfully.', 'success'));
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save department admin';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const removeDepartmentAdmin = createAsyncThunk(
  'departmentAdmin/removeDepartmentAdmin',
  async (departmentAdminID: string, { rejectWithValue, dispatch }) => {
    try {
      await deleteDepartmentAdmin(departmentAdminID);
      dispatch(showToast('Department admin deleted successfully.', 'success'));
      return departmentAdminID;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete department admin';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchDepartmentAdminEmployeeIds = createAsyncThunk(
  'departmentAdmin/fetchDepartmentAdminEmployeeIds',
  async (
    { departmentId, adminTypeId }: { departmentId: string; adminTypeId: string },
    { rejectWithValue, dispatch }
  ) => {
    try {
      const ids = await getDepartmentAdminEmployeeIds(departmentId, adminTypeId);
      return ids;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to fetch department admin employee IDs';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

const departmentAdminSlice = createSlice({
  name: 'departmentAdmin',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setPagination: (state, action) => {
      state.currentPage = action.payload.page || state.currentPage;
      state.pageSize = action.payload.pageSize || state.pageSize;
    },
    clearDepartmentAdminEmployeeIds: (state) => {
      state.departmentAdminEmployeeIds = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDepartmentAdmins.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchDepartmentAdmins.fulfilled, (state, action) => {
        state.isLoading = false;
        state.departmentAdmins = action.payload.data;
        if (action.payload.pagination) {
          if (action.payload.pagination.page !== undefined) state.currentPage = action.payload.pagination.page;
          if (action.payload.pagination.pageSize !== undefined) state.pageSize = action.payload.pagination.pageSize;
        }
        state.totalItems = action.payload.data.length;
        state.error = null;
      })
      .addCase(fetchDepartmentAdmins.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(upsertDepartmentAdminThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(upsertDepartmentAdminThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        const idx = state.departmentAdmins.findIndex(
          (d) => d.departmentAdminID === action.payload.departmentAdminID
        );
        if (idx >= 0) state.departmentAdmins[idx] = action.payload;
        else state.departmentAdmins.push(action.payload);
        state.error = null;
      })
      .addCase(upsertDepartmentAdminThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(removeDepartmentAdmin.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(removeDepartmentAdmin.fulfilled, (state, action) => {
        state.isLoading = false;
        state.departmentAdmins = state.departmentAdmins.filter(
          (d) => d.departmentAdminID !== action.payload
        );
        state.error = null;
      })
      .addCase(removeDepartmentAdmin.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchDepartmentAdminEmployeeIds.pending, (state) => {
        state.employeeIdsLoading = true;
      })
      .addCase(fetchDepartmentAdminEmployeeIds.fulfilled, (state, action) => {
        state.employeeIdsLoading = false;
        state.departmentAdminEmployeeIds = action.payload ?? [];
      })
      .addCase(fetchDepartmentAdminEmployeeIds.rejected, (state, _action) => {
        state.employeeIdsLoading = false;
        state.departmentAdminEmployeeIds = [];
      });
  },
});

export const { clearError, setPagination, clearDepartmentAdminEmployeeIds } = departmentAdminSlice.actions;
export default departmentAdminSlice.reducer;


