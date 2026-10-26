/**
 * DepartmentFee Redux Slice
 */
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
	createDepartmentFee,
	deleteDepartmentFee,
	getDepartmentFees,
	updateDepartmentFee,
} from '@/services/departmentFeeService';
import {
	DepartmentFeePaginationParams,
	DepartmentFeeResponse,
	DepartmentFeeSearchParams,
	CreateDepartmentFeeRequest,
	UpdateDepartmentFeeRequest,
} from '@/types/departmentFeeType';
import { showToast } from './toastSlice';
import { apiGet } from '@/utils/apiClient';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';
import { expectOkReadText, parsePagedListJson } from '@/services/textPlainJson';

interface DepartmentFeeState {
	departmentFees: DepartmentFeeResponse[];
	isLoading: boolean;
	error: string | null;
	totalItems: number;
}

const initialState: DepartmentFeeState = {
	departmentFees: [],
	isLoading: false,
	error: null,
	totalItems: 0,
};

export const fetchDepartmentFees = createAsyncThunk(
	'departmentFee/fetchDepartmentFees',
	async (pagination: DepartmentFeePaginationParams | undefined, thunkAPI) => {
		const { rejectWithValue, dispatch } = thunkAPI;
		try {
			const { data, totalRecords } = await getDepartmentFees(pagination);
			return { data, totalRecords, pagination };
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Failed to fetch department fees';
			dispatch(showToast(errorMessage, 'error'));
			return rejectWithValue(errorMessage);
		}
	}
);

export const searchDepartmentFeesThunk = createAsyncThunk(
	'departmentFee/searchDepartmentFees',
	async (pagination: DepartmentFeeSearchParams | undefined, thunkAPI) => {
		const { rejectWithValue, dispatch } = thunkAPI;
		try {
			const queryParams = buildPaginationQueryParams(pagination);
			const searchTerm = pagination?.searchTerm?.trim();
			if (searchTerm) queryParams.append('searchTerm', searchTerm);
			const queryString = queryParams.toString();
			const endpoint = `/DepartmentFee/search${queryString ? `?${queryString}` : ''}`;
			const response = await apiGet(endpoint);
			const responseText = await expectOkReadText(response, 'Failed to search department fees');
			const { data, totalRecords } = parsePagedListJson(
				responseText,
				(row) => row as unknown as DepartmentFeeResponse
			);
			return { data, totalRecords, pagination };
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Failed to search department fees';
			dispatch(showToast(errorMessage, 'error'));
			return rejectWithValue(errorMessage);
		}
	}
);

export const upsertDepartmentFeeThunk = createAsyncThunk(
	'departmentFee/upsertDepartmentFee',
	async (
		payload: CreateDepartmentFeeRequest | UpdateDepartmentFeeRequest,
		{ rejectWithValue, dispatch }
	) => {
		try {
			if ('feeId' in payload && payload.feeId) {
				const data = await updateDepartmentFee(payload as UpdateDepartmentFeeRequest);
				dispatch(showToast('Department fee updated successfully.', 'success'));
				return data;
			}
			const data = await createDepartmentFee(payload as CreateDepartmentFeeRequest);
			dispatch(showToast('Department fee created successfully.', 'success'));
			return data;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Failed to save department fee';
			dispatch(showToast(errorMessage, 'error'));
			return rejectWithValue(errorMessage);
		}
	}
);

export const removeDepartmentFee = createAsyncThunk<
	string,
	{ id: string; name: string }
>(
	'departmentFee/removeDepartmentFee',
	async ({ id, name }, { rejectWithValue, dispatch }) => {
		try {
			await deleteDepartmentFee(id);
			dispatch(showToast('Department fee deleted successfully.', 'success'));
			return id;
		} catch (error) {
			const rawMessage =
				error instanceof Error ? error.message : 'Failed to delete department fee';
			const errorMessage = rawMessage.replace('{0}', name);
			dispatch(showToast(errorMessage, 'error'));
			return rejectWithValue(errorMessage);
		}
	}
);

const departmentFeeSlice = createSlice({
	name: 'departmentFee',
	initialState,
	reducers: {
		clearError: (state) => {
			state.error = null;
		},
	},
	extraReducers: (builder) => {
		builder
			.addCase(fetchDepartmentFees.pending, (state) => {
				state.isLoading = true;
				state.error = null;
			})
			.addCase(fetchDepartmentFees.fulfilled, (state, action) => {
				state.isLoading = false;
				state.departmentFees = action.payload.data;
				state.totalItems = action.payload.totalRecords;
				state.error = null;
			})
			.addCase(fetchDepartmentFees.rejected, (state, action) => {
				state.isLoading = false;
				state.error = action.payload as string;
			})
			.addCase(searchDepartmentFeesThunk.pending, (state) => {
				state.isLoading = true;
				state.error = null;
			})
			.addCase(searchDepartmentFeesThunk.fulfilled, (state, action) => {
				state.isLoading = false;
				state.departmentFees = action.payload.data;
				state.totalItems = action.payload.totalRecords;
				state.error = null;
			})
			.addCase(searchDepartmentFeesThunk.rejected, (state, action) => {
				state.isLoading = false;
				state.error = action.payload as string;
			})
			.addCase(upsertDepartmentFeeThunk.pending, (state) => {
				state.isLoading = true;
				state.error = null;
			})
			.addCase(upsertDepartmentFeeThunk.fulfilled, (state, action) => {
				state.isLoading = false;
				const idx = state.departmentFees.findIndex((f) => f.feeId === action.payload.feeId);
				if (idx >= 0) state.departmentFees[idx] = action.payload;
				else state.departmentFees.push(action.payload);
				state.error = null;
			})
			.addCase(upsertDepartmentFeeThunk.rejected, (state, action) => {
				state.isLoading = false;
				state.error = action.payload as string;
			})
			.addCase(removeDepartmentFee.pending, (state) => {
				state.isLoading = true;
				state.error = null;
			})
			.addCase(removeDepartmentFee.fulfilled, (state, action) => {
				state.isLoading = false;
				state.departmentFees = state.departmentFees.filter((f) => f.feeId !== action.payload);
				state.error = null;
			})
			.addCase(removeDepartmentFee.rejected, (state, action) => {
				state.isLoading = false;
				state.error = action.payload as string;
			});
	},
});

export const { clearError } = departmentFeeSlice.actions;
export default departmentFeeSlice.reducer;

