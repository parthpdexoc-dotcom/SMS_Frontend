/**
 * PTAEO Code Redux Slice
 * Used for PTAEO Code dropdown (ProjectNumber, TaskNumber, AwardNumber, FundNumber, OrganizationName)
 */
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { getPtaeoCodeById, getPtaeoCodeOptions, getPtaeoCodes } from '@/services/ptaeoCodeService';
import type { PtaeoCodeOptionsParams } from '@/services/ptaeoCodeService';
import type { PtaeoCodeDto } from '@/types/ptaeoCode';
import type { SelectOptionDto } from '@/types/common';
import { showToast } from './toastSlice';

interface PtaeoCodeState {
  ptaeoCodes: PtaeoCodeDto[];
  ptaeoCodeOptions: SelectOptionDto[];
  selectedPtaeoCode: PtaeoCodeDto | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: PtaeoCodeState = {
  ptaeoCodes: [],
  ptaeoCodeOptions: [],
  selectedPtaeoCode: null,
  isLoading: false,
  error: null,
};

export const fetchPtaeoCodes = createAsyncThunk(
  'ptaeoCode/fetchPtaeoCodes',
  async (_, thunkAPI) => {
    const { rejectWithValue } = thunkAPI;
    try {
      const data = await getPtaeoCodes();
      return data;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch PTAEO codes');
    }
  }
);

export const fetchPtaeoCodeOptions = createAsyncThunk<
  SelectOptionDto[],
  PtaeoCodeOptionsParams | undefined
>(
  'ptaeoCode/fetchPtaeoCodeOptions',
  async (params, thunkAPI) => {
    const { rejectWithValue, dispatch } = thunkAPI;
    try {
      return await getPtaeoCodeOptions(params);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch PTAEO code options';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchPtaeoCodeById = createAsyncThunk(
  'ptaeoCode/fetchPtaeoCodeById',
  async (ptaeoCodeId: string, thunkAPI) => {
    const { rejectWithValue, dispatch } = thunkAPI;
    try {
      return await getPtaeoCodeById(ptaeoCodeId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch PTAEO code';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

const ptaeoCodeSlice = createSlice({
  name: 'ptaeoCode',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPtaeoCodes.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchPtaeoCodes.fulfilled, (state, action) => {
        state.isLoading = false;
        state.ptaeoCodes = action.payload;
        state.error = null;
      })
      .addCase(fetchPtaeoCodes.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchPtaeoCodeOptions.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchPtaeoCodeOptions.fulfilled, (state, action) => {
        state.isLoading = false;
        state.ptaeoCodeOptions = action.payload;
        state.error = null;
      })
      .addCase(fetchPtaeoCodeOptions.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.ptaeoCodeOptions = [];
      })
      .addCase(fetchPtaeoCodeById.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchPtaeoCodeById.fulfilled, (state, action) => {
        state.isLoading = false;
        state.selectedPtaeoCode = action.payload;
        state.error = null;
      })
      .addCase(fetchPtaeoCodeById.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.selectedPtaeoCode = null;
      });
  },
});

export const { clearError } = ptaeoCodeSlice.actions;
export default ptaeoCodeSlice.reducer;
