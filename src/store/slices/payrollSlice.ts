import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  generatePayroll,
  PayrollProcessingResultDto,
} from '@/services/payrollExportService';
import { showToast } from '@/store/slices/toastSlice';

interface GeneratePayrollPayload {
  startDate: string;
  endDate: string;
  departmentId?: string;
  customFileName?: string;
}

interface PayrollState {
  loading: boolean;
  data: PayrollProcessingResultDto | null;
  error: string | null;
}

const initialState: PayrollState = {
  loading: false,
  data: null,
  error: null,
};

export const generatePayrollThunk = createAsyncThunk<
  PayrollProcessingResultDto,
  GeneratePayrollPayload,
  { rejectValue: string }
>(
  'payroll/generate',
  async (payload, { dispatch, rejectWithValue }) => {
    try {
      const result = await generatePayroll(
        payload.startDate,
        payload.endDate,
        payload.departmentId,
        payload.customFileName
      );

      if (!result.payrollDataRecords || result.payrollDataRecords.length === 0) {
        dispatch(
          showToast(
            'No payroll records found for the specified date range.',
            'warning'
          )
        );
      } else {
        const filePath = result.websiteDocumentPath || result.generatedDocumentPath || '';
        const message = filePath
          ? `Payroll generated successfully.\nGenerated File: ${filePath}`
          : 'Payroll generated successfully.';
        dispatch(showToast(message, 'success'));
      }

      return result;
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Failed to generate payroll.';
      dispatch(showToast(errorMsg, 'error'));
      return rejectWithValue(errorMsg);
    }
  }
);

const payrollSlice = createSlice({
  name: 'payroll',
  initialState,
  reducers: {
    clearPayroll(state) {
      state.loading = false;
      state.data = null;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(generatePayrollThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.data = null;
      })
      .addCase(generatePayrollThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(generatePayrollThunk.rejected, (state, action) => {
        state.loading = false;
        state.error =
          action.payload ?? 'Failed to generate payroll.';
      });
  },
});

export const { clearPayroll } = payrollSlice.actions;

export default payrollSlice.reducer;