import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Toast, ToastType } from '@/types';
import { LOGIN } from '@/constants/strings';

interface ToastState {
    toasts: Toast[];
}

const initialState: ToastState = {
    toasts: [],
};

const DEDUPE_WINDOW_MS = 2000; // Don't show the same message+type again within 2 seconds
const SUPPRESS_MESSAGES = [
    'Your account is suspended. You can view information but cannot perform add, edit, update, or delete actions.',
    /** Handled by App logout; toast UI is unmounted on login route — queue would flash after re-login */
    'Unauthorized: Please login again',
    LOGIN.SESSION_REPLACED,
] as const;

const toastSlice = createSlice({
    name: 'toast',
    initialState,
    reducers: {
        addToast: (state, action: PayloadAction<Omit<Toast, 'id'> & { id?: string }>) => {
            if (SUPPRESS_MESSAGES.includes(action.payload.message as any)) {
                return;
            }
            const now = Date.now();
            const last = state.toasts[state.toasts.length - 1];
            if (last && last.message === action.payload.message && last.type === action.payload.type) {
                const created = last.createdAt ?? 0;
                if (now - created < DEDUPE_WINDOW_MS) {
                    return; // Skip duplicate toast
                }
            }
            const id = action.payload.id || `toast-${now}-${Math.random().toString(36).substr(2, 9)}`;
            state.toasts.push({
                ...action.payload,
                id,
                createdAt: now,
            } as Toast);
        },
        removeToast: (state, action: PayloadAction<string>) => {
            state.toasts = state.toasts.filter((toast) => toast.id !== action.payload);
        },
        clearToasts: (state) => {
            state.toasts = [];
        },
    },
});

export const { addToast, removeToast, clearToasts } = toastSlice.actions;

// Helper function to show toast from anywhere
// Duration is capped at 5000ms (5 seconds) maximum
export const showToast = (message: string, type: ToastType = 'info', duration?: number) => {
    // Default to 5 seconds if no duration provided, or cap at 5 seconds maximum
    const toastDuration = duration ? Math.min(duration, 5000) : 5000;
    return addToast({ message, type, duration: toastDuration });
};

export default toastSlice.reducer;
