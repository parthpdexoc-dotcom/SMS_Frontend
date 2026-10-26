import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { REQUESTER_STATEMENT_GRID } from '@/constants/strings';
import { getRequesterLedgerStatement } from '@/services/requesterLedgerService';
import { unwrapPagedList } from '@/services/textPlainJson';
import type {
  FetchRequesterLedgerStatementArgs,
  RequesterLedgerDto,
  RequesterLedgerStatementDto,
} from '@/types/requesterLedger';
import type { RootState } from '@/store';

export interface RequesterLedgerStatementResult extends RequesterLedgerStatementDto {
  entries: RequesterLedgerDto[];
  totalRecords: number;
}

interface RequesterLedgerState {
  statement: RequesterLedgerStatementResult | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: RequesterLedgerState = {
  statement: null,
  isLoading: false,
  error: null,
};

export const fetchRequesterLedgerStatement = createAsyncThunk(
  'requesterLedger/fetchStatement',
  async (
    { requesterId, startDateTime, endDateTime, page, pageSize }: FetchRequesterLedgerStatementArgs,
    { rejectWithValue }
  ) => {
    try {
      const dto = await getRequesterLedgerStatement(
        requesterId,
        startDateTime,
        endDateTime,
        page,
        pageSize
      );
      const { data: entries, totalRecords } = unwrapPagedList(dto.entries);
      return { ...dto, entries, totalRecords } satisfies RequesterLedgerStatementResult;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : REQUESTER_STATEMENT_GRID.ERRORS.LOAD_FAILED;
      return rejectWithValue(message);
    }
  }
);

const requesterLedgerSlice = createSlice({
  name: 'requesterLedger',
  initialState,
  reducers: {
    clearRequesterLedgerStatement: (state) => {
      state.statement = null;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRequesterLedgerStatement.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchRequesterLedgerStatement.fulfilled, (state, action) => {
        state.isLoading = false;
        state.statement = action.payload;
      })
      .addCase(fetchRequesterLedgerStatement.rejected, (state, action) => {
        state.isLoading = false;
        state.error = (action.payload as string) ?? REQUESTER_STATEMENT_GRID.ERRORS.LOAD_FAILED;
      });
  },
});

export const { clearRequesterLedgerStatement } = requesterLedgerSlice.actions;

export const selectRequesterLedgerStatementState = (state: RootState) => state.requesterLedger;

export default requesterLedgerSlice.reducer;
