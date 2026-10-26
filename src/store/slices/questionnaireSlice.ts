/**
 * Questionnaire Redux Slice
 */
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { getQuestionnairesByDepartment } from '@/services/questionnaireService';
import { QuestionnaireResponse } from '@/types/questionnaire';

interface QuestionnaireState {
  questionnaires: QuestionnaireResponse[];
  isLoading: boolean;
  error: string | null;
}

const initialState: QuestionnaireState = {
  questionnaires: [],
  isLoading: false,
  error: null,
};

export const fetchQuestionnairesByDepartment = createAsyncThunk<
  QuestionnaireResponse[],
  { page?: number; pageSize?: number } | undefined
>(
  'questionnaire/fetchQuestionnairesByDepartment',
  async (pagination, { rejectWithValue }) => {
    try {
      const data = await getQuestionnairesByDepartment(pagination);
      return data;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to fetch questionnaires by department'
      );
    }
  }
);

const questionnaireSlice = createSlice({
  name: 'questionnaire',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchQuestionnairesByDepartment.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchQuestionnairesByDepartment.fulfilled, (state, action) => {
        state.isLoading = false;
        state.questionnaires = action.payload;
        state.error = null;
      })
      .addCase(fetchQuestionnairesByDepartment.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError } = questionnaireSlice.actions;
export default questionnaireSlice.reducer;
