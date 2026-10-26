/**
 * Employee Tenure Redux Slice
 * Holds rank/tenure history rows for EmployeeForm rank history tab.
 */

import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { getEmployeeTenuresByEmployeeId } from '@/services/employeeTenureService';
import type { EmployeeTenureResponse } from '@/types/employeeTenure';
import type { RootState } from '@/store';

interface EmployeeTenureState {
  employeeId: string | null;
  rows: EmployeeTenureResponse[];
  isLoading: boolean;
  error: string | null;
}

const initialState: EmployeeTenureState = {
  employeeId: null,
  rows: [],
  isLoading: false,
  error: null,
};

export const fetchEmployeeTenureByEmployeeThunk = createAsyncThunk<
  EmployeeTenureResponse[],
  string,
  { rejectValue: string }
>(
  'employeeTenure/fetchByEmployee',
  async (employeeId, { rejectWithValue }) => {
    try {
      return await getEmployeeTenuresByEmployeeId(employeeId);
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : 'Failed to fetch employee tenure history';
      return rejectWithValue(msg);
    }
  },
  {
    condition: (employeeId, { getState }) => {
      const state = getState() as RootState;
      const tenure = state.employeeTenure;
      const sameEmployee = tenure.employeeId === employeeId;

      // Avoid duplicate dispatches (e.g., React StrictMode double effects in dev).
      if (tenure.isLoading && sameEmployee) {
        return false;
      }
      return true;
    },
  }
);

const employeeTenureSlice = createSlice({
  name: 'employeeTenure',
  initialState,
  reducers: {
    clearEmployeeTenureState: (state) => {
      state.employeeId = null;
      state.rows = [];
      state.error = null;
      state.isLoading = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchEmployeeTenureByEmployeeThunk.pending, (state, action) => {
        state.employeeId = action.meta.arg;
        state.rows = [];
        state.error = null;
        state.isLoading = true;
      })
      .addCase(fetchEmployeeTenureByEmployeeThunk.fulfilled, (state, action) => {
        state.rows = action.payload;
        state.error = null;
        state.isLoading = false;
      })
      .addCase(fetchEmployeeTenureByEmployeeThunk.rejected, (state, action) => {
        state.rows = [];
        state.error = (action.payload as string) ?? action.error.message ?? 'Failed to load';
        state.isLoading = false;
      });
  },
});

export const { clearEmployeeTenureState } = employeeTenureSlice.actions;
export default employeeTenureSlice.reducer;
