/**
 * ActivityForm Redux Slice
 */
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { getActivityForm, upsertActivityForm } from '@/services/activityFormService';
import type { ActivityFormData } from '@/types/activityForm';
import type { QuestionnaireFormResponse } from '@/types/questionnaire';
import { mapQuestionnaireFormToActivityFormData } from '@/utils/activityFormUtils';
import { showToast } from './toastSlice';

export interface UpsertActivityFormPayload {
  data: ActivityFormData;
  questionnaireId?: string | null;
  sourceQuestionnaireId?: string | null;
}

interface ActivityFormState {
  currentForm: QuestionnaireFormResponse | null;
  isLoading: boolean;
  error: string | null;
  upsertLoading: boolean;
  upsertError: string | null;
}

const initialState: ActivityFormState = {
  currentForm: null,
  isLoading: false,
  error: null,
  upsertLoading: false,
  upsertError: null,
};

export const fetchActivityForm = createAsyncThunk(
  'activityForm/fetchActivityForm',
  async (activityFormId: string, { rejectWithValue, dispatch }) => {
    try {
      return await getActivityForm(activityFormId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load form';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const upsertActivityFormThunk = createAsyncThunk(
  'activityForm/upsertActivityForm',
  async (payload: UpsertActivityFormPayload, { rejectWithValue, dispatch }) => {
    try {
      await upsertActivityForm(payload.data, payload.questionnaireId, payload.sourceQuestionnaireId);
      const isUpdate = Boolean(payload.questionnaireId);
      dispatch(showToast(isUpdate ? 'Activity form updated successfully.' : 'Activity form created successfully.', 'success'));
      return payload;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save form';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

const activityFormSlice = createSlice({
  name: 'activityForm',
  initialState,
  reducers: {
    clearCurrentForm: (state) => {
      state.currentForm = null;
      state.error = null;
      state.upsertError = null;
    },
    clearError: (state) => {
      state.error = null;
    },
    clearUpsertError: (state) => {
      state.upsertError = null;
    },
    setCurrentFormFromTemplate: (state, action: { payload: QuestionnaireFormResponse }) => {
      state.currentForm = action.payload;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchActivityForm.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchActivityForm.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentForm = action.payload;
        state.error = null;
      })
      .addCase(fetchActivityForm.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(upsertActivityFormThunk.pending, (state) => {
        state.upsertLoading = true;
        state.upsertError = null;
      })
      .addCase(upsertActivityFormThunk.fulfilled, (state) => {
        state.upsertLoading = false;
        state.upsertError = null;
      })
      .addCase(upsertActivityFormThunk.rejected, (state, action) => {
        state.upsertLoading = false;
        state.upsertError = action.payload as string;
      });
  },
});

export const { clearCurrentForm, clearError, clearUpsertError, setCurrentFormFromTemplate } =
  activityFormSlice.actions;

/** Select current form as ActivityFormData (mapped for UI), or null */
export function selectActivityFormData(state: { activityForm: ActivityFormState }): ActivityFormData | null {
  const form = state.activityForm.currentForm;
  return form ? mapQuestionnaireFormToActivityFormData(form) : null;
}

/** Select loaded source questionnaire id for submit (edit mode) */
export function selectLoadedSourceQuestionnaireId(state: { activityForm: ActivityFormState }): string | null {
  return state.activityForm.currentForm?.questionnaire.sourceQuestionnaireId ?? null;
}

export default activityFormSlice.reducer;
