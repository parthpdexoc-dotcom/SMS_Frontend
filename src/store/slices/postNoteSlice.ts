/**
 * PostNote Redux Slice
 */
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getAllPostNotes, getLatestPostNotes, upsertPostNote, PostNotesDto } from '@/services/postNoteService';

interface PostNoteState {
  allNotes: PostNotesDto[];
  latestNotes: PostNotesDto | null;
  isLoading: boolean;
  isLoadingLatest: boolean;
  error: string | null;
}

const initialState: PostNoteState = {
  allNotes: [],
  latestNotes: null,
  isLoading: false,
  isLoadingLatest: false,
  error: null,
};

// Async thunks
export const fetchAllPostNotes = createAsyncThunk(
  'postNote/fetchAll',
  async (postId: string, { rejectWithValue }) => {
    try {
      const data = await getAllPostNotes(postId);
      return data;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch all post notes');
    }
  }
);

export const fetchLatestPostNotes = createAsyncThunk(
  'postNote/fetchLatest',
  async (postId: string, { rejectWithValue }) => {
    try {
      const data = await getLatestPostNotes(postId);
      return data;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch latest post notes');
    }
  }
);

export const upsertPostNoteThunk = createAsyncThunk(
  'postNote/upsert',
  async (noteData: PostNotesDto, { rejectWithValue }) => {
    try {
      const data = await upsertPostNote(noteData);
      return data;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to save post note');
    }
  }
);

const postNoteSlice = createSlice({
  name: 'postNote',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearAllNotes: (state) => {
      state.allNotes = [];
    },
    clearLatestNotes: (state) => {
      state.latestNotes = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch all notes
      .addCase(fetchAllPostNotes.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchAllPostNotes.fulfilled, (state, action) => {
        state.isLoading = false;
        state.allNotes = action.payload;
        state.error = null;
      })
      .addCase(fetchAllPostNotes.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Fetch latest notes
      .addCase(fetchLatestPostNotes.pending, (state) => {
        state.isLoadingLatest = true;
        state.error = null;
      })
      .addCase(fetchLatestPostNotes.fulfilled, (state, action) => {
        state.isLoadingLatest = false;
        state.latestNotes = action.payload;
        state.error = null;
      })
      .addCase(fetchLatestPostNotes.rejected, (state, action) => {
        state.isLoadingLatest = false;
        state.error = action.payload as string;
      })
      // Upsert note
      .addCase(upsertPostNoteThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(upsertPostNoteThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        // Add the new note to allNotes if it doesn't exist
        const index = state.allNotes.findIndex(n => n.postNoteID === action.payload.postNoteID);
        if (index !== -1) {
          state.allNotes[index] = action.payload;
        } else {
          state.allNotes.push(action.payload);
        }
        // Update latest notes if this is the newest
        if (!state.latestNotes || 
            (action.payload.postNoteID && action.payload.postNoteID === state.latestNotes.postNoteID)) {
          state.latestNotes = action.payload;
        }
        state.error = null;
      })
      .addCase(upsertPostNoteThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError, clearAllNotes, clearLatestNotes } = postNoteSlice.actions;
export default postNoteSlice.reducer;
