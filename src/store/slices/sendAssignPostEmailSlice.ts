/**
 * Send Assign Post Email Redux Slice
 */
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { sendAssignPostEmail } from '@/services/postPositionService';
import { showToast } from './toastSlice';

interface SendAssignPostEmailState {
    /** Post position ID currently sending invite (for loading/disable state). */
    sendingInvitePostPositionId: string | null;
}

const initialState: SendAssignPostEmailState = {
    sendingInvitePostPositionId: null,
};

export const sendAssignPostEmailThunk = createAsyncThunk(
    'sendAssignPostEmail/sendAssignPostEmail',
    async (postPositionId: string, { rejectWithValue, dispatch }) => {
        try {
            await sendAssignPostEmail(postPositionId);
            dispatch(showToast('Invite email sent successfully.', 'success'));
            return { postPositionId };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to send invite email.';
            dispatch(showToast(errorMessage, 'error'));
            return rejectWithValue({ postPositionId, error: errorMessage });
        }
    }
);

const sendAssignPostEmailSlice = createSlice({
    name: 'sendAssignPostEmail',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(sendAssignPostEmailThunk.pending, (state, action) => {
                state.sendingInvitePostPositionId = action.meta.arg;
            })
            .addCase(sendAssignPostEmailThunk.fulfilled, (state) => {
                state.sendingInvitePostPositionId = null;
            })
            .addCase(sendAssignPostEmailThunk.rejected, (state) => {
                state.sendingInvitePostPositionId = null;
            });
    },
});

export default sendAssignPostEmailSlice.reducer;
