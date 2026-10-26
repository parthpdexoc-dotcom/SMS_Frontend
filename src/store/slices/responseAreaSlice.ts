/**
 * ResponseArea Redux Slice
 */
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { createResponseArea, deleteResponseArea, getDepartmentResponseAreaOptions, getResponseAreas, getResponseAreasByDepartmentId, updateResponseArea } from '@/services/responseAreaService';
import { CreateResponseAreaRequest, ResponseAreaPaginationParams, ResponseAreaResponse, ResponseAreaSearchParams, UpdateResponseAreaRequest } from '@/types/responseArea';
import type { SelectOptionDto } from '@/types/common';
import { showToast } from './toastSlice';
import { apiGet } from '@/utils/apiClient';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';
import { expectOkReadText, parsePagedListJson } from '@/services/textPlainJson';
import { normalizeResponseArea } from '@/utils/normalizers';

interface ResponseAreaState {
  responseAreas: ResponseAreaResponse[];
  responseAreasByDepartment: ResponseAreaResponse[]; // Response areas filtered by department
  responseAreaOptions: SelectOptionDto[];
  isLoading: boolean;
  isLoadingByDepartment: boolean;
  isLoadingOptions: boolean;
  error: string | null;
  totalItems: number;
}

const initialState: ResponseAreaState = {
  responseAreas: [],
  responseAreasByDepartment: [],
  responseAreaOptions: [],
  isLoading: false,
  isLoadingByDepartment: false,
  isLoadingOptions: false,
  error: null,
  totalItems: 0,
};

// Async thunks
export const fetchResponseAreas = createAsyncThunk(
  'responseArea/fetchResponseAreas',
  async (pagination: ResponseAreaPaginationParams | undefined, { rejectWithValue, dispatch }) => {
    try {
      const { data, totalRecords } = await getResponseAreas(pagination);
      return { data, totalRecords, pagination };
    } catch (error) {
      console.error('Error fetching response areas:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch response areas';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const searchResponseAreasThunk = createAsyncThunk(
  'responseArea/searchResponseAreas',
  async (pagination: ResponseAreaSearchParams | undefined, { rejectWithValue, dispatch }) => {
    try {
      const queryParams = buildPaginationQueryParams(pagination);
      const searchTerm = pagination?.searchTerm?.trim();
      if (searchTerm) queryParams.append('searchTerm', searchTerm);
      const queryString = queryParams.toString();
      const endpoint = `/DepartmentResponseArea/search${queryString ? `?${queryString}` : ''}`;
      const response = await apiGet(endpoint);
      const responseText = await expectOkReadText(response, 'Failed to search response areas');
      const { data, totalRecords } = parsePagedListJson(responseText, (row) => normalizeResponseArea(row));
      return { data, totalRecords, pagination };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to search response areas';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

/** Create only - payload must NOT include responseAreaID */
export const createResponseAreaThunk = createAsyncThunk(
  'responseArea/createResponseArea',
  async (payload: CreateResponseAreaRequest, { rejectWithValue, dispatch }) => {
    try {
      const data = await createResponseArea(payload);
      dispatch(showToast('Response area created successfully.', 'success'));
      return data;
    } catch (error) {
      console.error('Error creating response area:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create response area';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

/** Update only - payload must include responseAreaID (do NOT remap or set to undefined/0) */
export const updateResponseAreaThunk = createAsyncThunk(
  'responseArea/updateResponseArea',
  async (payload: UpdateResponseAreaRequest, { rejectWithValue, dispatch }) => {
    try {
      const { responseAreaID } = payload;
      if (!responseAreaID || String(responseAreaID).trim() === '') {
        const errorMessage = 'Update attempted without ResponseArea ID';
        dispatch(showToast(errorMessage, 'error'));
        return rejectWithValue(errorMessage);
      }
      const data = await updateResponseArea(payload);
      dispatch(showToast('Response area updated successfully.', 'success'));
      return data;
    } catch (error) {
      console.error('Error updating response area:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update response area';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

/** @deprecated Use createResponseAreaThunk or updateResponseAreaThunk explicitly */
export const upsertResponseAreaThunk = createAsyncThunk(
  'responseArea/upsertResponseArea',
  async (payload: CreateResponseAreaRequest | UpdateResponseAreaRequest, { rejectWithValue, dispatch }) => {
    try {
      const id = 'responseAreaID' in payload ? String(payload.responseAreaID ?? '').trim() : '';
      if (id.length > 0) {
        const data = await updateResponseArea(payload as UpdateResponseAreaRequest);
        dispatch(showToast('Response area updated successfully.', 'success'));
        return data;
      }
      const data = await createResponseArea(payload as CreateResponseAreaRequest);
      dispatch(showToast('Response area created successfully.', 'success'));
      return data;
    } catch (error) {
      console.error('Error saving response area:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save response area';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const removeResponseArea = createAsyncThunk<
  string,
  { id: string; name: string }
>(
  'responseArea/removeResponseArea',
  async ({ id, name }, { rejectWithValue, dispatch }) => {
    try {
      await deleteResponseArea(id);
      dispatch(showToast('Response area deleted successfully.', 'success'));
      return id;
    } catch (error) {
      console.error('Error deleting response area:', error);
      const rawMessage =
        error instanceof Error ? error.message : 'Failed to delete response area';
      const errorMessage = rawMessage.replace('{0}', name);
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchResponseAreasByDepartmentId = createAsyncThunk(
  'responseArea/fetchResponseAreasByDepartmentId',
  async (params: { selectedId?: string } | undefined, { rejectWithValue, dispatch }) => {
    try {
      const data = await getResponseAreasByDepartmentId(params);
      return data;
    } catch (error) {
      console.error('Error fetching response areas by department ID:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch response areas by department';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchDepartmentResponseAreaOptions = createAsyncThunk<
  SelectOptionDto[],
  { searchTerm?: string; selectedId?: string } | undefined
>(
  'responseArea/fetchDepartmentResponseAreaOptions',
  async (params, { rejectWithValue, dispatch }) => {
    try {
      return await getDepartmentResponseAreaOptions(
        params?.searchTerm,
        params?.selectedId
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch department response area options';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

const responseAreaSlice = createSlice({
  name: 'responseArea',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch ResponseAreas
      .addCase(fetchResponseAreas.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchResponseAreas.fulfilled, (state, action) => {
        state.isLoading = false;
        state.responseAreas = action.payload.data;
        state.totalItems = action.payload.totalRecords;
        state.error = null;
      })
      .addCase(fetchResponseAreas.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(searchResponseAreasThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(searchResponseAreasThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.responseAreas = action.payload.data;
        state.totalItems = action.payload.totalRecords;
        state.error = null;
      })
      .addCase(searchResponseAreasThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Create ResponseArea
      .addCase(createResponseAreaThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createResponseAreaThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.responseAreas.findIndex(r => r.responseAreaID === action.payload.responseAreaID);
        if (index >= 0) {
          state.responseAreas[index] = action.payload;
        } else {
          state.responseAreas.push(action.payload);
        }
        state.error = null;
      })
      .addCase(createResponseAreaThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Update ResponseArea (always sends responseAreaID; do NOT remap ID)
      .addCase(updateResponseAreaThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateResponseAreaThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.responseAreas.findIndex(r => r.responseAreaID === action.payload.responseAreaID);
        if (index >= 0) {
          state.responseAreas[index] = action.payload;
        } else {
          state.responseAreas.push(action.payload);
        }
        state.error = null;
      })
      .addCase(updateResponseAreaThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Upsert (legacy)
      .addCase(upsertResponseAreaThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(upsertResponseAreaThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.responseAreas.findIndex(r => r.responseAreaID === action.payload.responseAreaID);
        if (index >= 0) {
          state.responseAreas[index] = action.payload;
        } else {
          state.responseAreas.push(action.payload);
        }
        state.error = null;
      })
      .addCase(upsertResponseAreaThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Delete ResponseArea
      .addCase(removeResponseArea.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(removeResponseArea.fulfilled, (state, action) => {
        state.isLoading = false;
        state.responseAreas = state.responseAreas.filter(r => r.responseAreaID !== action.payload);
        state.responseAreasByDepartment = state.responseAreasByDepartment.filter(r => r.responseAreaID !== action.payload);
        state.error = null;
      })
      .addCase(removeResponseArea.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Fetch ResponseAreas by Department ID
      .addCase(fetchResponseAreasByDepartmentId.pending, (state) => {
        state.isLoadingByDepartment = true;
        state.error = null;
      })
      .addCase(fetchResponseAreasByDepartmentId.fulfilled, (state, action) => {
        state.isLoadingByDepartment = false;
        state.responseAreasByDepartment = action.payload;
        state.error = null;
      })
      .addCase(fetchResponseAreasByDepartmentId.rejected, (state, action) => {
        state.isLoadingByDepartment = false;
        state.error = action.payload as string;
        state.responseAreasByDepartment = [];
      })
      .addCase(fetchDepartmentResponseAreaOptions.pending, (state) => {
        state.isLoadingOptions = true;
        state.error = null;
      })
      .addCase(fetchDepartmentResponseAreaOptions.fulfilled, (state, action) => {
        state.isLoadingOptions = false;
        state.responseAreaOptions = action.payload;
        state.error = null;
      })
      .addCase(fetchDepartmentResponseAreaOptions.rejected, (state, action) => {
        state.isLoadingOptions = false;
        state.error = action.payload as string;
        state.responseAreaOptions = [];
      });
  },
});

export const { clearError } = responseAreaSlice.actions;
export default responseAreaSlice.reducer;

