/**
 * Email Template Redux Slice
 */
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  getEmailTemplates,
  searchEmailTemplates,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
  getEmailTypes,
} from '@/services/emailTemplateService';
import { EmailTemplateDto, EmailTypeOptionDto } from '@/types/emailTemplate';
import { PageParam } from '@/types/common';
import { showToast } from './toastSlice';

interface EmailTemplateState {
  emailTemplates: EmailTemplateDto[];
  totalRecords: number;
  isLoading: boolean;
  error: string | null;
  saveLoading: boolean;
  saveError: string | null;
  deleteLoading: boolean;
  /** GET /EmailTemplate/email-types — for template form dropdown */
  emailTypes: EmailTypeOptionDto[];
  emailTypesLoading: boolean;
  emailTypesError: string | null;
}

const initialState: EmailTemplateState = {
  emailTemplates: [],
  totalRecords: 0,
  isLoading: false,
  error: null,
  saveLoading: false,
  saveError: null,
  deleteLoading: false,
  emailTypes: [],
  emailTypesLoading: false,
  emailTypesError: null,
};

export const fetchEmailTypes = createAsyncThunk(
  'emailTemplate/fetchEmailTypes',
  async (_, { rejectWithValue }) => {
    try {
      return await getEmailTypes();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch email types';
      return rejectWithValue(message);
    }
  }
);

export const fetchEmailTemplates = createAsyncThunk(
  'emailTemplate/fetchEmailTemplates',
  async (pagination: PageParam | undefined, { rejectWithValue, dispatch }) => {
    try {
      const { data, totalRecords } = await getEmailTemplates(pagination);
      return { data, totalRecords };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch email templates';
      dispatch(showToast(message, 'error'));
      return rejectWithValue(message);
    }
  }
);

export const searchEmailTemplatesThunk = createAsyncThunk(
  'emailTemplate/searchEmailTemplates',
  async (pagination: PageParam & { searchTerm?: string } | undefined, { rejectWithValue, dispatch }) => {
    try {
      const { data, totalRecords } = await searchEmailTemplates(pagination);
      return { data, totalRecords };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to search email templates';
      dispatch(showToast(message, 'error'));
      return rejectWithValue(message);
    }
  }
);

export const upsertEmailTemplateThunk = createAsyncThunk(
  'emailTemplate/upsertEmailTemplate',
  async (dto: EmailTemplateDto, { rejectWithValue, dispatch }) => {
    try {
      if (dto.emailTemplateID) {
        const data = await updateEmailTemplate(dto.emailTemplateID, dto);
        dispatch(showToast('Email template updated successfully.', 'success'));
        return data;
      }
      const data = await createEmailTemplate(dto);
      dispatch(showToast('Email template created successfully.', 'success'));
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save email template';
      dispatch(showToast(message, 'error'));
      return rejectWithValue(message);
    }
  }
);

export const removeEmailTemplate = createAsyncThunk(
  'emailTemplate/removeEmailTemplate',
  async (id: string, { rejectWithValue, dispatch }) => {
    try {
      await deleteEmailTemplate(id);
      dispatch(showToast('Email template deleted.', 'success'));
      return id;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete email template';
      dispatch(showToast(message, 'error'));
      return rejectWithValue(message);
    }
  }
);

const emailTemplateSlice = createSlice({
  name: 'emailTemplate',
  initialState,
  reducers: {
    clearSaveError: (state) => {
      state.saveError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchEmailTypes.pending, (state) => {
        state.emailTypesLoading = true;
        state.emailTypesError = null;
      })
      .addCase(fetchEmailTypes.fulfilled, (state, action) => {
        state.emailTypesLoading = false;
        state.emailTypes = action.payload;
        state.emailTypesError = null;
      })
      .addCase(fetchEmailTypes.rejected, (state, action) => {
        state.emailTypesLoading = false;
        state.emailTypes = [];
        state.emailTypesError = (action.payload as string) ?? 'Failed to load email types';
      })
      // Fetch list
      .addCase(fetchEmailTemplates.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchEmailTemplates.fulfilled, (state, action) => {
        state.isLoading = false;
        state.emailTemplates = action.payload.data ?? [];
        state.totalRecords = action.payload.totalRecords ?? 0;
        state.error = null;
      })
      .addCase(fetchEmailTemplates.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Search Email Templates
      .addCase(searchEmailTemplatesThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(searchEmailTemplatesThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.emailTemplates = action.payload.data ?? [];
        state.totalRecords = action.payload.totalRecords ?? 0;
        state.error = null;
      })
      .addCase(searchEmailTemplatesThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Upsert (create/update)
      .addCase(upsertEmailTemplateThunk.pending, (state) => {
        state.saveLoading = true;
        state.saveError = null;
      })
      .addCase(upsertEmailTemplateThunk.fulfilled, (state, action) => {
        state.saveLoading = false;
        state.saveError = null;
        const idx = state.emailTemplates.findIndex(
          (t) => t.emailTemplateID === action.payload.emailTemplateID
        );
        if (idx >= 0) {
          state.emailTemplates[idx] = action.payload;
        } else {
          state.emailTemplates.push(action.payload);
        }
      })
      .addCase(upsertEmailTemplateThunk.rejected, (state, action) => {
        state.saveLoading = false;
        state.saveError = action.payload as string;
      })
      // Delete
      .addCase(removeEmailTemplate.pending, (state) => {
        state.deleteLoading = true;
      })
      .addCase(removeEmailTemplate.fulfilled, (state, action) => {
        state.deleteLoading = false;
        state.emailTemplates = state.emailTemplates.filter(
          (t) => t.emailTemplateID !== action.payload
        );
      })
      .addCase(removeEmailTemplate.rejected, (state) => {
        state.deleteLoading = false;
      });
  },
});

export const { clearSaveError } = emailTemplateSlice.actions;
export default emailTemplateSlice.reducer;
