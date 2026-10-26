/**
 * RequesterQuestionnaire Redux Slice
 */
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { upsertRequesterQuestionnaire, getRequesterQuestionnairesByRequesterId } from '@/services/questionnaireService';
import { RequesterQuestionnaireDto, RequesterQuestionnaireResponse } from '@/types/questionnaire';

interface RequesterQuestionnaireState {
  requesterQuestionnaires: RequesterQuestionnaireResponse[];
  isLoading: boolean;
  error: string | null;
  lastUpserted: RequesterQuestionnaireResponse | null;
}

const initialState: RequesterQuestionnaireState = {
  requesterQuestionnaires: [],
  isLoading: false,
  error: null,
  lastUpserted: null,
};

export const fetchRequesterQuestionnairesByRequesterIdAsync = createAsyncThunk<
  RequesterQuestionnaireResponse[],
  string
>(
  'requesterQuestionnaire/fetchByRequesterId',
  async (requesterId, { rejectWithValue }) => {
    try {
      return await getRequesterQuestionnairesByRequesterId(requesterId);
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to fetch requester questionnaires'
      );
    }
  }
);

export const upsertRequesterQuestionnaireAsync = createAsyncThunk<
  RequesterQuestionnaireResponse,
  RequesterQuestionnaireDto
>(
  'requesterQuestionnaire/upsertRequesterQuestionnaire',
  async (data, { rejectWithValue }) => {
    try {
      return await upsertRequesterQuestionnaire(data);
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to upsert requester questionnaire'
      );
    }
  }
);

const requesterQuestionnaireSlice = createSlice({
  name: 'requesterQuestionnaire',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearLastUpserted: (state) => {
      state.lastUpserted = null;
    },
    resetState: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRequesterQuestionnairesByRequesterIdAsync.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchRequesterQuestionnairesByRequesterIdAsync.fulfilled, (state, action) => {
        state.isLoading = false;
        state.requesterQuestionnaires = action.payload;
        state.error = null;
      })
      .addCase(fetchRequesterQuestionnairesByRequesterIdAsync.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(upsertRequesterQuestionnaireAsync.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(upsertRequesterQuestionnaireAsync.fulfilled, (state, action) => {
        state.isLoading = false;
        state.lastUpserted = action.payload;
        state.error = null;
        
        // Update or add the questionnaire in the list
        const existingIndex = state.requesterQuestionnaires.findIndex(
          (q) => q.requesterQuestionnaireId === action.payload.requesterQuestionnaireId
        );
        
        if (existingIndex >= 0) {
          state.requesterQuestionnaires[existingIndex] = action.payload;
        } else {
          state.requesterQuestionnaires.push(action.payload);
        }
      })
      .addCase(upsertRequesterQuestionnaireAsync.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError, clearLastUpserted, resetState } = requesterQuestionnaireSlice.actions;
export default requesterQuestionnaireSlice.reducer;
