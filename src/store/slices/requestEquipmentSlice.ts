/**
 * RequestEquipment Redux Slice
 */
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
    RequestEquipmentDto,
    upsertRequestEquipment,
    deleteRequestEquipment,
    getRequestEquipment,
} from '@/services/requestEquipmentService';

interface RequestEquipmentState {
    isLoading: boolean;
    error: string | null;
}

const initialState: RequestEquipmentState = {
    isLoading: false,
    error: null,
};

export const fetchRequestEquipmentThunk = createAsyncThunk(
    'requestEquipment/fetchRequestEquipment',
    async (requestID: string, { rejectWithValue }) => {
        try {
            return await getRequestEquipment(requestID);
        } catch (error) {
            return rejectWithValue(
                error instanceof Error ? error.message : 'Failed to fetch request equipment'
            );
        }
    }
);

export const upsertRequestEquipmentThunk = createAsyncThunk(
    'requestEquipment/upsertRequestEquipment',
    async (payload: RequestEquipmentDto, { rejectWithValue }) => {
        try {
            return await upsertRequestEquipment(payload);
        } catch (error) {
            return rejectWithValue(
                error instanceof Error ? error.message : 'Failed to save request equipment'
            );
        }
    }
);

export const deleteRequestEquipmentThunk = createAsyncThunk(
    'requestEquipment/deleteRequestEquipment',
    async (requestEquipmentID: string, { rejectWithValue }) => {
        try {
            await deleteRequestEquipment(requestEquipmentID);
            return requestEquipmentID;
        } catch (error) {
            return rejectWithValue(
                error instanceof Error ? error.message : 'Failed to delete request equipment'
            );
        }
    }
);

const requestEquipmentSlice = createSlice({
    name: 'requestEquipment',
    initialState,
    reducers: {
        clearError: (state) => {
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchRequestEquipmentThunk.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(fetchRequestEquipmentThunk.fulfilled, (state) => {
                state.isLoading = false;
                state.error = null;
            })
            .addCase(fetchRequestEquipmentThunk.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload as string;
            })
            .addCase(upsertRequestEquipmentThunk.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(upsertRequestEquipmentThunk.fulfilled, (state) => {
                state.isLoading = false;
                state.error = null;
            })
            .addCase(upsertRequestEquipmentThunk.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload as string;
            })
            .addCase(deleteRequestEquipmentThunk.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(deleteRequestEquipmentThunk.fulfilled, (state) => {
                state.isLoading = false;
                state.error = null;
            })
            .addCase(deleteRequestEquipmentThunk.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload as string;
            });
    },
});

export const { clearError } = requestEquipmentSlice.actions;
export default requestEquipmentSlice.reducer;
