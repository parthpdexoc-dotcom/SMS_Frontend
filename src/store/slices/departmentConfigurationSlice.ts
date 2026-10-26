/**
 * Department Configuration Redux Slice
 * Fetches and caches department configuration by department ID (e.g. for post form validation).
 */
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { getByDepartmentId } from '@/services/departmentConfigurationService';
import { DepartmentConfigurationResponse } from '@/types/departmentConfiguration';

interface DepartmentConfigurationState {
  configByDepartmentId: Record<string, DepartmentConfigurationResponse | null>;
  loadingByDepartmentId: Record<string, boolean>;
  errorByDepartmentId: Record<string, string | null>;
}

const initialState: DepartmentConfigurationState = {
  configByDepartmentId: {},
  loadingByDepartmentId: {},
  errorByDepartmentId: {},
};

export const fetchDepartmentConfigByDepartmentId = createAsyncThunk(
  'departmentConfiguration/fetchByDepartmentId',
  async (departmentId: string, { rejectWithValue }) => {
    try {
      const config = await getByDepartmentId(departmentId);
      return { departmentId, config };
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to fetch department configuration'
      );
    }
  }
);

const departmentConfigurationSlice = createSlice({
  name: 'departmentConfiguration',
  initialState,
  reducers: {
    clearDepartmentConfig: (state, action: { payload: string }) => {
      const id = action.payload;
      delete state.configByDepartmentId[id];
      delete state.loadingByDepartmentId[id];
      delete state.errorByDepartmentId[id];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDepartmentConfigByDepartmentId.pending, (state, action) => {
        const id = action.meta.arg;
        state.loadingByDepartmentId[id] = true;
        state.errorByDepartmentId[id] = null;
      })
      .addCase(fetchDepartmentConfigByDepartmentId.fulfilled, (state, action) => {
        const { departmentId, config } = action.payload;
        state.configByDepartmentId[departmentId] = config;
        state.loadingByDepartmentId[departmentId] = false;
        state.errorByDepartmentId[departmentId] = null;
      })
      .addCase(fetchDepartmentConfigByDepartmentId.rejected, (state, action) => {
        const id = action.meta.arg;
        state.loadingByDepartmentId[id] = false;
        state.errorByDepartmentId[id] = (action.payload as string) ?? 'Failed to fetch department configuration';
        state.configByDepartmentId[id] = null;
      });
  },
});

export const { clearDepartmentConfig } = departmentConfigurationSlice.actions;
export default departmentConfigurationSlice.reducer;
