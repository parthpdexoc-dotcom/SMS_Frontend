/**
 * Skill Redux Slice
 */
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getSkills, getActiveSkills, getSkillOptions, createSkill, updateSkill } from '@/services/skillService';
import { SkillResponse, CreateSkillRequest, UpdateSkillRequest, SkillPaginationParams, SkillSearchParams } from '@/types/skill';
import type { SelectOptionDto } from '@/types/common';
import { showToast } from './toastSlice';
import { apiGet } from '@/utils/apiClient';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';
import { expectOkReadText, parsePagedListJson } from '@/services/textPlainJson';
import { normalizeSkill } from '@/utils/normalizers';

interface SkillState {
  skills: SkillResponse[];
  /** Active-only list for form dropdowns (from GetAllActiveskill endpoint) */
  activeSkills: SkillResponse[];
  skillOptions: SelectOptionDto[];
  isLoading: boolean;
  error: string | null;
  totalItems: number; // Total count for pagination
}

const initialState: SkillState = {
  skills: [],
  activeSkills: [],
  skillOptions: [],
  isLoading: false,
  error: null,
  totalItems: 0,
};

// Async thunks
export const fetchSkills = createAsyncThunk(
  'skill/fetchSkills',
  async (pagination: SkillPaginationParams | undefined, thunkAPI) => {
    const { rejectWithValue, dispatch } = thunkAPI;
    try {
      const { data, totalRecords } = await getSkills(pagination);
      return { data, totalRecords, pagination };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch skills';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchActiveSkills = createAsyncThunk(
  'skill/fetchActiveSkills',
  async (params: string | { departmentId?: string; selectedIds?: string[] } | undefined, thunkAPI) => {
    const { rejectWithValue } = thunkAPI;
    try {
      const requestParams =
        typeof params === 'string' || params == null ? { departmentId: params } : params;
      return await getActiveSkills(requestParams);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch active skills';
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchSkillOptions = createAsyncThunk<
  SelectOptionDto[],
  { searchTerm?: string } | undefined
>(
  'skill/fetchSkillOptions',
  async (params, thunkAPI) => {
    const { rejectWithValue, dispatch } = thunkAPI;
    try {
      return await getSkillOptions(params?.searchTerm);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch skill options';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const searchSkillsThunk = createAsyncThunk(
  'skill/searchSkills',
  async (pagination: SkillSearchParams | undefined, thunkAPI) => {
    const { rejectWithValue, dispatch } = thunkAPI;
    try {
      const queryParams = buildPaginationQueryParams(pagination);
      const searchTerm = pagination?.searchTerm?.trim();
      if (searchTerm) {
        queryParams.append('searchTerm', searchTerm);
      }
      const queryString = queryParams.toString();
      const endpoint = `/Skill/search${queryString ? `?${queryString}` : ''}`;
      const response = await apiGet(endpoint);
      const responseText = await expectOkReadText(response, 'Failed to search skills');
      const { data, totalRecords } = parsePagedListJson(responseText, (row) => normalizeSkill(row));
      return { data, totalRecords, pagination };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to search skills';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const upsertSkill = createAsyncThunk(
  'skill/upsertSkill',
  async (skillData: CreateSkillRequest | UpdateSkillRequest, { rejectWithValue, dispatch }) => {
    try {
      // Check if it's an update (has skillId) or create
      if ('skillId' in skillData && skillData.skillId) {
        const data = await updateSkill(skillData as UpdateSkillRequest);
        dispatch(showToast('Skill updated successfully.', 'success'));
        return data;
      } else {
        const data = await createSkill(skillData as CreateSkillRequest);
        dispatch(showToast('Skill created successfully.', 'success'));
        return data;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save skill';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

const skillSlice = createSlice({
  name: 'skill',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Skills
      .addCase(fetchSkills.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchSkills.fulfilled, (state, action) => {
        state.isLoading = false;
        state.skills = action.payload.data;
        state.totalItems = action.payload.totalRecords;
        state.error = null;
      })
      .addCase(fetchSkills.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchActiveSkills.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchActiveSkills.fulfilled, (state, action) => {
        state.isLoading = false;
        state.activeSkills = action.payload;
        state.error = null;
      })
      .addCase(fetchActiveSkills.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchSkillOptions.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchSkillOptions.fulfilled, (state, action) => {
        state.isLoading = false;
        state.skillOptions = action.payload;
        state.error = null;
      })
      .addCase(fetchSkillOptions.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.skillOptions = [];
      })
      .addCase(searchSkillsThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(searchSkillsThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.skills = action.payload.data;
        state.totalItems = action.payload.totalRecords;
        state.error = null;
      })
      .addCase(searchSkillsThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Upsert Skill
      .addCase(upsertSkill.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(upsertSkill.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.skills.findIndex(s => s.skillId === action.payload.skillId);
        if (index >= 0) {
          state.skills[index] = action.payload;
        } else {
          state.skills.push(action.payload);
        }
        state.error = null;
      })
      .addCase(upsertSkill.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError } = skillSlice.actions;
export default skillSlice.reducer;
