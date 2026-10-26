/**
 * PostEquipment Redux Slice
 */
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
    PostEquipmentDto,
    upsertPostEquipment,
    deletePostEquipment,
    getPostEquipment,
} from '@/services/postEquipmentService';

interface PostEquipmentState {
    postEquipment: PostEquipmentDto[];
    isLoading: boolean;
    error: string | null;
}

const initialState: PostEquipmentState = {
    postEquipment: [],
    isLoading: false,
    error: null,
};

export const fetchPostEquipmentThunk = createAsyncThunk(
    'postEquipment/fetchPostEquipment',
    async (postID: string, { rejectWithValue }) => {
        try {
            return await getPostEquipment(postID);
        } catch (error) {
            return rejectWithValue(
                error instanceof Error ? error.message : 'Failed to fetch post equipment'
            );
        }
    },
    {
        condition: (_, { getState }) => {
            const { postEquipment } = getState() as { postEquipment: PostEquipmentState };
            if (postEquipment.isLoading) {
                return false;
            }
        },
    }
);

export const upsertPostEquipmentThunk = createAsyncThunk(
    'postEquipment/upsertPostEquipment',
    async (payload: PostEquipmentDto, { rejectWithValue }) => {
        try {
            return await upsertPostEquipment(payload);
        } catch (error) {
            return rejectWithValue(
                error instanceof Error ? error.message : 'Failed to save post equipment'
            );
        }
    }
);

export const deletePostEquipmentThunk = createAsyncThunk(
    'postEquipment/deletePostEquipment',
    async (postEquipmentID: string, { rejectWithValue }) => {
        try {
            await deletePostEquipment(postEquipmentID);
            return postEquipmentID;
        } catch (error) {
            return rejectWithValue(
                error instanceof Error ? error.message : 'Failed to delete job equipment'
            );
        }
    }
);

const postEquipmentSlice = createSlice({
    name: 'postEquipment',
    initialState,
    reducers: {
        clearError: (state) => {
            state.error = null;
        },
        clearPostEquipment: (state) => {
            state.postEquipment = [];
        }
    },
    extraReducers: (builder) => {
        builder
            // Fetch
            .addCase(fetchPostEquipmentThunk.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(fetchPostEquipmentThunk.fulfilled, (state, action) => {
                state.isLoading = false;
                state.postEquipment = action.payload;
                state.error = null;
            })
            .addCase(fetchPostEquipmentThunk.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload as string;
            })
            // Upsert
            .addCase(upsertPostEquipmentThunk.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(upsertPostEquipmentThunk.fulfilled, (state, action) => {
                state.isLoading = false;
                const index = state.postEquipment.findIndex(
                    (item) => item.postEquipmentID === action.payload.postEquipmentID
                );
                if (index !== -1) {
                    state.postEquipment[index] = action.payload;
                } else {
                    state.postEquipment.push(action.payload);
                }
                state.error = null;
            })
            .addCase(upsertPostEquipmentThunk.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload as string;
            })
            // Delete
            .addCase(deletePostEquipmentThunk.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(deletePostEquipmentThunk.fulfilled, (state, action) => {
                state.isLoading = false;
                state.postEquipment = state.postEquipment.filter(
                    (item) => item.postEquipmentID !== action.payload
                );
                state.error = null;
            })
            .addCase(deletePostEquipmentThunk.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload as string;
            });
    },
});

export const { clearError, clearPostEquipment } = postEquipmentSlice.actions;
export default postEquipmentSlice.reducer;
