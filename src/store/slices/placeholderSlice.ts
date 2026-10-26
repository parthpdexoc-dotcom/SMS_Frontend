/**
 * Placeholder profile Redux slice — uses PlaceholderController:
 * GET /Placeholder, GET /Placeholder/search, POST /Placeholder (upsert), POST /Placeholder/bulk-status.
 */
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import {
  bulkUpdatePlaceholderStatus,
  getAllPlaceholders,
  searchPlaceholders,
  upsertPlaceholder,
} from '@/services/placeholderService';
import {
  PlaceholderStatus,
  type PlaceholderDto,
  type PlaceholderListParams,
  type PlaceholderListResult,
  type PlaceholderSearchParams,
} from '@/types/placeholder';
import { showToast } from './toastSlice';

interface PlaceholderState {
  isSaving: boolean;
  isLoading: boolean;
  error: string | null;
}

const initialState: PlaceholderState = {
  isSaving: false,
  isLoading: false,
  error: null,
};

/** Query `status`: 0 hidden, 1 visible, 2 archived; omit = Visible+Hidden. Supports PageParam paging. */
export const fetchPlaceholdersThunk = createAsyncThunk<
  PlaceholderListResult,
  PlaceholderListParams | undefined
>('placeholder/fetchAll', async (params, { rejectWithValue, dispatch }) => {
  try {
    return await getAllPlaceholders(params);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load placeholders';
    dispatch(showToast(errorMessage, 'error'));
    return rejectWithValue(errorMessage);
  }
});

/** GET /Placeholder/search — used when the assign-modal search box has a term. */
export const searchPlaceholdersThunk = createAsyncThunk<PlaceholderListResult, PlaceholderSearchParams>(
  'placeholder/search',
  async (params, { rejectWithValue, dispatch }) => {
    try {
      return await searchPlaceholders(params);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to search placeholders';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const upsertPlaceholderThunk = createAsyncThunk<PlaceholderDto, PlaceholderDto>(
  'placeholder/upsert',
  async (payload, { rejectWithValue, dispatch }) => {
    try {
      const result = await upsertPlaceholder(payload);
      dispatch(showToast('Placeholder updated', 'success'));
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save placeholder';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

/** Bulk set visibility via POST /Placeholder/bulk-status. */
export const updatePlaceholdersVisibilityThunk = createAsyncThunk<
  void,
  { placeholders: Record<string, PlaceholderStatus> }
>('placeholder/updateVisibility', async ({ placeholders }, { rejectWithValue, dispatch }) => {
  try {
    const results = await bulkUpdatePlaceholderStatus({ placeholders });
    results.forEach((item) => {
      const name = item.placeholderName?.trim();
      const message = item.message || (item.hasError ? 'Failed to update placeholder' : 'Placeholder updated');
      dispatch(showToast(name ? `${name}: ${message}` : message, item.hasError ? 'error' : 'success'));
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to update placeholder visibility';
    dispatch(showToast(errorMessage, 'error'));
    return rejectWithValue(errorMessage);
  }
});
const placeholderSlice = createSlice({
  name: 'placeholder',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchPlaceholdersThunk.pending, (state, action) => {
        // Page > 1 is lazy-load append — keep the grid visible.
        if ((action.meta.arg?.page ?? 1) <= 1) {
          state.isLoading = true;
        }
        state.error = null;
      })
      .addCase(fetchPlaceholdersThunk.fulfilled, (state) => {
        state.isLoading = false;
        state.error = null;
      })
      .addCase(fetchPlaceholdersThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = (action.payload as string) ?? action.error.message ?? 'Failed to load placeholders';
      })
      .addCase(searchPlaceholdersThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(searchPlaceholdersThunk.fulfilled, (state) => {
        state.isLoading = false;
        state.error = null;
      })
      .addCase(searchPlaceholdersThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = (action.payload as string) ?? action.error.message ?? 'Failed to search placeholders';
      })
      .addCase(upsertPlaceholderThunk.pending, (state) => {
        state.isSaving = true;
        state.error = null;
      })
      .addCase(upsertPlaceholderThunk.fulfilled, (state) => {
        state.isSaving = false;
        state.error = null;
      })
      .addCase(upsertPlaceholderThunk.rejected, (state, action) => {
        state.isSaving = false;
        state.error = (action.payload as string) ?? action.error.message ?? 'Failed to save placeholder';
      })
      .addCase(updatePlaceholdersVisibilityThunk.pending, (state) => {
        state.isSaving = true;
        state.error = null;
      })
      .addCase(updatePlaceholdersVisibilityThunk.fulfilled, (state) => {
        state.isSaving = false;
        state.error = null;
      })
      .addCase(updatePlaceholdersVisibilityThunk.rejected, (state, action) => {
        state.isSaving = false;
        state.error =
          (action.payload as string) ?? action.error.message ?? 'Failed to update placeholder visibility';
      });
  },
});

export default placeholderSlice.reducer;
