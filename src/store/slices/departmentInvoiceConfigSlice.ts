/**
 * Department Invoice Configuration Redux Slice
 * Fetches and caches invoice config by department ID; supports save (create/update).
 */
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  getDepartmentInvoiceConfigByDepartmentId,
  saveDepartmentInvoiceConfig,
} from '@/services/departmentInvoiceConfigService';
import type {
  DepartmentInvoiceConfigRequest,
  DepartmentInvoiceConfigResponse,
} from '@/types/departmentInvoiceConfig';
import { showToast } from './toastSlice';
import { DEPARTMENT_INVOICE_CONFIG } from '@/constants/strings';
import { ApiResponseError } from '@/services/textPlainJson';

export type DepartmentInvoiceConfigSaveError = {
  message: string;
  fieldErrors?: Record<string, string>;
};

interface DepartmentInvoiceConfigState {
  configByDepartmentId: Record<string, DepartmentInvoiceConfigResponse | null>;
  loadingByDepartmentId: Record<string, boolean>;
  errorByDepartmentId: Record<string, string | null>;
  saveLoading: boolean;
}

const initialState: DepartmentInvoiceConfigState = {
  configByDepartmentId: {},
  loadingByDepartmentId: {},
  errorByDepartmentId: {},
  saveLoading: false,
};

export const fetchDepartmentInvoiceConfigByDepartmentId = createAsyncThunk(
  'departmentInvoiceConfig/fetchByDepartmentId',
  async (departmentId: string, { rejectWithValue }) => {
    try {
      const config = await getDepartmentInvoiceConfigByDepartmentId(departmentId);
      return { departmentId, config };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to fetch invoice configuration';
      return rejectWithValue(errorMessage);
    }
  }
);

export const saveDepartmentInvoiceConfigThunk = createAsyncThunk(
  'departmentInvoiceConfig/save',
  async (payload: DepartmentInvoiceConfigRequest, { rejectWithValue, dispatch }) => {
    try {
      const saved = await saveDepartmentInvoiceConfig(payload);
      dispatch(showToast(DEPARTMENT_INVOICE_CONFIG.SAVE_SUCCESS, 'success'));
      return saved;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : DEPARTMENT_INVOICE_CONFIG.SAVE_ERROR;
      const fieldErrors = error instanceof ApiResponseError ? error.fieldErrors : undefined;
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue({ message: errorMessage, fieldErrors } satisfies DepartmentInvoiceConfigSaveError);
    }
  }
);

const departmentInvoiceConfigSlice = createSlice({
  name: 'departmentInvoiceConfig',
  initialState,
  reducers: {
    clearDepartmentInvoiceConfig: (state, action: { payload: string }) => {
      const id = action.payload;
      delete state.configByDepartmentId[id];
      delete state.loadingByDepartmentId[id];
      delete state.errorByDepartmentId[id];
    },
    clearError: (state, action: { payload: string }) => {
      const id = action.payload;
      if (state.errorByDepartmentId[id] !== undefined) {
        state.errorByDepartmentId[id] = null;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDepartmentInvoiceConfigByDepartmentId.pending, (state, action) => {
        const id = action.meta.arg;
        state.loadingByDepartmentId[id] = true;
        state.errorByDepartmentId[id] = null;
      })
      .addCase(fetchDepartmentInvoiceConfigByDepartmentId.fulfilled, (state, action) => {
        const { departmentId, config } = action.payload;
        state.configByDepartmentId[departmentId] = config;
        state.loadingByDepartmentId[departmentId] = false;
        state.errorByDepartmentId[departmentId] = null;
      })
      .addCase(fetchDepartmentInvoiceConfigByDepartmentId.rejected, (state, action) => {
        const id = action.meta.arg;
        state.loadingByDepartmentId[id] = false;
        state.errorByDepartmentId[id] =
          (action.payload as string) ?? 'Failed to fetch invoice configuration';
        state.configByDepartmentId[id] = null;
      })
      .addCase(saveDepartmentInvoiceConfigThunk.pending, (state) => {
        state.saveLoading = true;
      })
      .addCase(saveDepartmentInvoiceConfigThunk.fulfilled, (state, action) => {
        state.saveLoading = false;
        const saved = action.payload;
        const deptId = saved?.departmentID ?? (saved as Record<string, unknown>)?.departmentID;
        if (deptId && typeof deptId === 'string') {
          state.configByDepartmentId[deptId] = saved;
        }
      })
      .addCase(saveDepartmentInvoiceConfigThunk.rejected, (state) => {
        state.saveLoading = false;
      });
  },
});

export const { clearDepartmentInvoiceConfig, clearError } = departmentInvoiceConfigSlice.actions;
export default departmentInvoiceConfigSlice.reducer;
