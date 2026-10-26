/**
 * Roster Redux Slice
 */
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import {
    downloadRosterExcel,
    getRosterDates,
    getRosterInformation,
    getRosterInformationByRequest,
} from '@/services/requestService';
import { getWaitingListEmployees } from '@/services/tenureWaitingPositionService';
import { ROSTER_VIEW_MODAL } from '@/constants/strings';
import { showToast } from './toastSlice';
import type { EmployeeResponse } from '@/types/employee';
import type { RosterTable } from '@/types/roster';

export type { RosterInformation, RosterTable, RosterResponse } from '@/types/roster';

interface RosterState {
    rosterTables: RosterTable[];
    requesterName: string | null;
    rosterDate: string | null;
    rosterDates: string[];
    /** Request id whose dates are loaded or loading (skip duplicate StrictMode dispatches). */
    rosterDatesRequestId: string | null;
    pendingRosterDatesRequestId: string | null;
    waitingListData: EmployeeResponse[];
    isLoading: boolean;
    isExporting: boolean;
    isWaitingListLoading: boolean;
    error: string | null;
    waitingListError: string | null;
    postId: string | null;
    dateOfWork: string | null;
}

const initialState: RosterState = {
    rosterTables: [],
    requesterName: null,
    rosterDate: null,
    rosterDates: [],
    rosterDatesRequestId: null,
    pendingRosterDatesRequestId: null,
    waitingListData: [],
    isLoading: false,
    isExporting: false,
    isWaitingListLoading: false,
    error: null,
    waitingListError: null,
    postId: null,
    dateOfWork: null,
};

export interface FetchRosterParams {
    postId: string;
    dateOfWork: string;
}

export interface FetchRosterByRequestParams {
    requestID: string;
    dateOfWork: string;
}

export interface FetchWaitingListParams {
    postId: string;
    dateOfWork: string;
}

export interface ExportRosterExcelParams {
    requestID?: string;
    postId?: string;
    dateOfWork: string;
    defaultFileName?: string;
}

export const fetchRosterInformation = createAsyncThunk(
    'roster/fetchRosterInformation',
    async (params: FetchRosterParams, { rejectWithValue, dispatch }) => {
        try {
            const roster = await getRosterInformation(params.postId, params.dateOfWork);
            return {
                roster,
                postId: params.postId,
                dateOfWork: params.dateOfWork,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to fetch roster information';
            dispatch(showToast(errorMessage, 'error'));
            return rejectWithValue(errorMessage);
        }
    }
);

export const fetchRosterInformationByRequest = createAsyncThunk(
    'roster/fetchRosterInformationByRequest',
    async (params: FetchRosterByRequestParams, { rejectWithValue, dispatch }) => {
        try {
            const roster = await getRosterInformationByRequest(params.requestID, params.dateOfWork);
            return {
                roster,
                requestID: params.requestID,
                dateOfWork: params.dateOfWork,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to fetch roster information';
            dispatch(showToast(errorMessage, 'error'));
            return rejectWithValue(errorMessage);
        }
    }
);

export const fetchRosterDates = createAsyncThunk(
    'roster/fetchRosterDates',
    async (requestID: string, { rejectWithValue, dispatch }) => {
        try {
            return await getRosterDates(requestID);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to fetch roster dates';
            dispatch(showToast(errorMessage, 'error'));
            return rejectWithValue(errorMessage);
        }
    }
);

export const exportRosterExcelThunk = createAsyncThunk(
    'roster/exportRosterExcel',
    async (params: ExportRosterExcelParams, { rejectWithValue, dispatch }) => {
        try {
            await downloadRosterExcel({
                requestId: params.requestID,
                postId: params.postId,
                dateOfWork: params.dateOfWork,
                defaultFileName: params.defaultFileName,
            });
            dispatch(showToast(ROSTER_VIEW_MODAL.EXCEL_DOWNLOAD_SUCCESS, 'success'));
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : ROSTER_VIEW_MODAL.EXCEL_DOWNLOAD_ERROR;
            dispatch(showToast(errorMessage, 'error'));
            return rejectWithValue(errorMessage);
        }
    }
);

export const fetchWaitingListEmployees = createAsyncThunk(
    'roster/fetchWaitingListEmployees',
    async (params: FetchWaitingListParams, { rejectWithValue, dispatch }) => {
        try {
            const data = await getWaitingListEmployees(params.postId, params.dateOfWork);
            return data;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to fetch waiting list employees';
            dispatch(showToast(errorMessage, 'error'));
            return rejectWithValue(errorMessage);
        }
    }
);

const applyRosterPayload = (
    state: RosterState,
    roster: { requesterName: string | null; rosterDate: string; tables: RosterTable[] },
    dateOfWork: string
) => {
    state.rosterTables = roster.tables;
    state.requesterName = roster.requesterName;
    state.rosterDate = roster.rosterDate || dateOfWork;
    state.dateOfWork = dateOfWork;
};

const rosterSlice = createSlice({
    name: 'roster',
    initialState,
    reducers: {
        clearRoster: (state) => {
            state.rosterTables = [];
            state.requesterName = null;
            state.rosterDate = null;
            state.rosterDates = [];
            state.rosterDatesRequestId = null;
            state.pendingRosterDatesRequestId = null;
            state.waitingListData = [];
            state.error = null;
            state.waitingListError = null;
            state.postId = null;
            state.dateOfWork = null;
            state.isExporting = false;
            state.isLoading = false;
        },
        clearError: (state) => {
            state.error = null;
        },
        clearWaitingList: (state) => {
            state.waitingListData = [];
            state.waitingListError = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchRosterInformation.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(fetchRosterInformation.fulfilled, (state, action) => {
                state.isLoading = false;
                applyRosterPayload(state, action.payload.roster, action.payload.dateOfWork);
                state.postId = action.payload.postId;
                state.error = null;
            })
            .addCase(fetchRosterInformation.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload as string;
            })
            .addCase(fetchRosterInformationByRequest.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(fetchRosterInformationByRequest.fulfilled, (state, action) => {
                state.isLoading = false;
                applyRosterPayload(state, action.payload.roster, action.payload.dateOfWork);
                state.error = null;
            })
            .addCase(fetchRosterInformationByRequest.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload as string;
            })
            .addCase(fetchRosterDates.pending, (state, action) => {
                state.pendingRosterDatesRequestId = action.meta.arg;
                state.isLoading = true;
                state.error = null;
            })
            .addCase(fetchRosterDates.fulfilled, (state, action) => {
                state.rosterDates = action.payload ?? [];
                state.rosterDatesRequestId = action.meta.arg;
                state.pendingRosterDatesRequestId = null;
                if (!(action.payload?.length)) state.isLoading = false;
            })
            .addCase(fetchRosterDates.rejected, (state) => {
                state.rosterDates = [];
                state.rosterDatesRequestId = null;
                state.pendingRosterDatesRequestId = null;
                state.isLoading = false;
            })
            .addCase(fetchWaitingListEmployees.pending, (state) => {
                state.isWaitingListLoading = true;
                state.waitingListError = null;
            })
            .addCase(fetchWaitingListEmployees.fulfilled, (state, action) => {
                state.isWaitingListLoading = false;
                state.waitingListData = action.payload;
            })
            .addCase(fetchWaitingListEmployees.rejected, (state, action) => {
                state.isWaitingListLoading = false;
                state.waitingListError = action.payload as string;
            })
            .addCase(exportRosterExcelThunk.pending, (state) => {
                state.isExporting = true;
            })
            .addCase(exportRosterExcelThunk.fulfilled, (state) => {
                state.isExporting = false;
            })
            .addCase(exportRosterExcelThunk.rejected, (state) => {
                state.isExporting = false;
            });
    },
});

export const { clearRoster, clearError, clearWaitingList } = rosterSlice.actions;
export default rosterSlice.reducer;
