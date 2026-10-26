/**
 * RequestNote Redux Slice
 */
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getAllRequestNotes, getLatestRequestNotes, upsertRequestNote, RequestNotesDto } from '@/services/requestNoteService';

interface RequestNoteState {
  allNotes: RequestNotesDto[];
  latestNotes: RequestNotesDto | null;
  isLoading: boolean;
  isLoadingLatest: boolean;
  error: string | null;
}

const initialState: RequestNoteState = {
  allNotes: [],
  latestNotes: null,
  isLoading: false,
  isLoadingLatest: false,
  error: null,
};

// Async thunks
export const fetchAllRequestNotes = createAsyncThunk(
  'requestNote/fetchAll',
  async (requestId: string, { rejectWithValue }) => {
    try {
      const data = await getAllRequestNotes(requestId);
      return data;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch all request notes');
    }
  }
);

export const fetchLatestRequestNotes = createAsyncThunk(
  'requestNote/fetchLatest',
  async (requestId: string, { rejectWithValue }) => {
    try {
      const data = await getLatestRequestNotes(requestId);
      return data;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch latest request notes');
    }
  }
);

export const upsertRequestNoteThunk = createAsyncThunk(
  'requestNote/upsert',
  async (noteData: RequestNotesDto, { rejectWithValue }) => {
    try {
      const data = await upsertRequestNote(noteData);
      return data;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to save request note');
    }
  }
);

const requestNoteSlice = createSlice({
  name: 'requestNote',
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
      .addCase(fetchAllRequestNotes.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchAllRequestNotes.fulfilled, (state, action) => {
        state.isLoading = false;
        state.allNotes = action.payload;
        state.error = null;
      })
      .addCase(fetchAllRequestNotes.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Fetch latest notes
      .addCase(fetchLatestRequestNotes.pending, (state) => {
        state.isLoadingLatest = true;
        state.error = null;
      })
      .addCase(fetchLatestRequestNotes.fulfilled, (state, action) => {
        state.isLoadingLatest = false;
        state.latestNotes = action.payload;
        state.error = null;
      })
      .addCase(fetchLatestRequestNotes.rejected, (state, action) => {
        state.isLoadingLatest = false;
        state.error = action.payload as string;
      })
      // Upsert note
      .addCase(upsertRequestNoteThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(upsertRequestNoteThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        // Add the new note to allNotes if it doesn't exist
        const index = state.allNotes.findIndex(n => n.requestNoteID === action.payload.requestNoteID);
        if (index !== -1) {
          state.allNotes[index] = action.payload;
        } else {
          state.allNotes.push(action.payload);
        }
        // Update latest notes if this is the newest
        if (!state.latestNotes || 
            (action.payload.requestNoteID && action.payload.requestNoteID === state.latestNotes.requestNoteID)) {
          state.latestNotes = action.payload;
        }
        state.error = null;
      })
      .addCase(upsertRequestNoteThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError, clearAllNotes, clearLatestNotes } = requestNoteSlice.actions;
export default requestNoteSlice.reducer;
