/**
 * Employee Skill Redux Slice
 */
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { bulkUpsertEmployeeSkills, deleteEmployeeSkill, getEmployeeSkills, upsertEmployeeSkill } from '@/services/employeeSkillService';
import { EmployeeSkillDto } from '@/types/employeeSkill';
import { showToast } from './toastSlice';

interface EmployeeSkillState {
  employeeSkills: EmployeeSkillDto[];
  isLoading: boolean;
  error: string | null;
}

const initialState: EmployeeSkillState = {
  employeeSkills: [],
  isLoading: false,
  error: null,
};

export const fetchEmployeeSkills = createAsyncThunk<EmployeeSkillDto[], string>(
  'employeeSkill/fetchEmployeeSkills',
  async (employeeID, { rejectWithValue, dispatch }) => {
    try {
      return await getEmployeeSkills(employeeID);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch employee skills';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const upsertEmployeeSkillThunk = createAsyncThunk<EmployeeSkillDto, EmployeeSkillDto>(
  'employeeSkill/upsertEmployeeSkill',
  async (payload, { rejectWithValue, dispatch }) => {
    try {
      return await upsertEmployeeSkill(payload);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save employee skill';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const bulkUpsertEmployeeSkillsThunk = createAsyncThunk<EmployeeSkillDto[], EmployeeSkillDto[]>(
  'employeeSkill/bulkUpsertEmployeeSkills',
  async (dtos, { rejectWithValue, dispatch }) => {
    try {
      return await bulkUpsertEmployeeSkills(dtos);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save employee skills';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const deleteEmployeeSkillThunk = createAsyncThunk<string, string>(
  'employeeSkill/deleteEmployeeSkill',
  async (employeeSkillId, { rejectWithValue, dispatch }) => {
    try {
      await deleteEmployeeSkill(employeeSkillId);
      return employeeSkillId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete employee skill';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

const employeeSkillSlice = createSlice({
  name: 'employeeSkill',
  initialState,
  reducers: {
    clearEmployeeSkills: (state) => {
      state.employeeSkills = [];
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchEmployeeSkills.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchEmployeeSkills.fulfilled, (state, action) => {
        state.isLoading = false;
        state.employeeSkills = action.payload;
        state.error = null;
      })
      .addCase(fetchEmployeeSkills.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(upsertEmployeeSkillThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(upsertEmployeeSkillThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        const updated = action.payload;

        if (updated.employeeSkillId) {
          const idx = state.employeeSkills.findIndex((es) => es.employeeSkillId === updated.employeeSkillId);
          if (idx >= 0) state.employeeSkills[idx] = updated;
          else state.employeeSkills.push(updated);
        } else {
          state.employeeSkills.push(updated);
        }

        state.error = null;
      })
      .addCase(upsertEmployeeSkillThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(bulkUpsertEmployeeSkillsThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(bulkUpsertEmployeeSkillsThunk.fulfilled, (state) => {
        state.isLoading = false;
        state.error = null;
      })
      .addCase(bulkUpsertEmployeeSkillsThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(deleteEmployeeSkillThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteEmployeeSkillThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        const id = action.payload;
        state.employeeSkills = state.employeeSkills.filter((es) => {
          const rowId =
            es.employeeSkillId ?? (es as { EmployeeSkillId?: string }).EmployeeSkillId;
          return rowId !== id;
        });
        state.error = null;
      })
      .addCase(deleteEmployeeSkillThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearEmployeeSkills } = employeeSkillSlice.actions;
export default employeeSkillSlice.reducer;

