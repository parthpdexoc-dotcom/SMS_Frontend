/**
 * EquipmentType Redux Slice
 */
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  createEquipmentType,
  deleteEquipmentType,
  getActiveEquipmentTypes,
  getEquipmentTypes,
  updateEquipmentType,
} from '@/services/equipmentTypeService';
import {
  CreateEquipmentTypeRequest,
  EquipmentTypePaginationParams,
  EquipmentTypeResponse,
  EquipmentTypeSearchParams,
  UpdateEquipmentTypeRequest,
} from '@/types/equipmentType';
import { showToast } from './toastSlice';
import { apiGet } from '@/utils/apiClient';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';
import { expectOkReadText, parsePagedListJson } from '@/services/textPlainJson';
import { normalizeEquipmentType } from '@/utils/normalizers';

interface EquipmentTypeState {
  equipmentTypes: EquipmentTypeResponse[];
  /** Active-only list for form dropdowns (from GetAllActiveequipment endpoint) */
  activeEquipmentTypes: EquipmentTypeResponse[];
  isLoading: boolean;
  error: string | null;
  totalItems: number;
}

const initialState: EquipmentTypeState = {
  equipmentTypes: [],
  activeEquipmentTypes: [],
  isLoading: false,
  error: null,
  totalItems: 0,
};

export const fetchEquipmentTypes = createAsyncThunk(
  'equipmentType/fetchEquipmentTypes',
  async (pagination: EquipmentTypePaginationParams | undefined, thunkAPI) => {
    const { rejectWithValue, dispatch } = thunkAPI;
    try {
      const { data, totalRecords } = await getEquipmentTypes(pagination);
      return { data, totalRecords, pagination };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch equipment types';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchActiveEquipmentTypes = createAsyncThunk(
  'equipmentType/fetchActiveEquipmentTypes',
  async (params: { selectedId?: string } | undefined, thunkAPI) => {
    const { rejectWithValue } = thunkAPI;
    try {
      return await getActiveEquipmentTypes(params);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch active equipment types';
      return rejectWithValue(errorMessage);
    }
  }
);

export const searchEquipmentTypesThunk = createAsyncThunk(
  'equipmentType/searchEquipmentTypes',
  async (pagination: EquipmentTypeSearchParams | undefined, thunkAPI) => {
    const { rejectWithValue, dispatch } = thunkAPI;
    try {
      const queryParams = buildPaginationQueryParams(pagination);
      const searchTerm = pagination?.searchTerm?.trim();
      if (searchTerm) queryParams.append('searchTerm', searchTerm);
      const queryString = queryParams.toString();
      const endpoint = `/EquipmentType/search${queryString ? `?${queryString}` : ''}`;
      const response = await apiGet(endpoint);
      const responseText = await expectOkReadText(response, 'Failed to search equipment types');
      const { data, totalRecords } = parsePagedListJson(responseText, (row) => normalizeEquipmentType(row));
      return { data, totalRecords, pagination };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to search equipment types';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const upsertEquipmentTypeThunk = createAsyncThunk(
  'equipmentType/upsertEquipmentType',
  async (
    payload: CreateEquipmentTypeRequest | UpdateEquipmentTypeRequest,
    { rejectWithValue, dispatch }
  ) => {
    try {
      if ('equipementTypeID' in payload && payload.equipementTypeID) {
        const data = await updateEquipmentType(payload as UpdateEquipmentTypeRequest);
        dispatch(showToast('Equipment type updated successfully.', 'success'));
        return data;
      }
      const data = await createEquipmentType(payload as CreateEquipmentTypeRequest);
      dispatch(showToast('Equipment type created successfully.', 'success'));
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save equipment type';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const removeEquipmentType = createAsyncThunk<
  string,
  { id: string; name: string }
>(
  'equipmentType/removeEquipmentType',
  async ({ id, name }, { rejectWithValue, dispatch }) => {
    try {
      await deleteEquipmentType(id);
      dispatch(showToast('Equipment type deleted successfully.', 'success'));
      return id;
    } catch (error) {
      const rawMessage =
        error instanceof Error ? error.message : 'Failed to delete equipment type';
      const errorMessage = rawMessage.replace('{0}', name);
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

const equipmentTypeSlice = createSlice({
  name: 'equipmentType',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchEquipmentTypes.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchEquipmentTypes.fulfilled, (state, action) => {
        state.isLoading = false;
        state.equipmentTypes = action.payload.data;
        state.totalItems = action.payload.totalRecords;
        state.error = null;
      })
      .addCase(fetchEquipmentTypes.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchActiveEquipmentTypes.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchActiveEquipmentTypes.fulfilled, (state, action) => {
        state.isLoading = false;
        state.activeEquipmentTypes = action.payload;
        state.error = null;
      })
      .addCase(fetchActiveEquipmentTypes.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(searchEquipmentTypesThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(searchEquipmentTypesThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.equipmentTypes = action.payload.data;
        state.totalItems = action.payload.totalRecords;
        state.error = null;
      })
      .addCase(searchEquipmentTypesThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(upsertEquipmentTypeThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(upsertEquipmentTypeThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        const idx = state.equipmentTypes.findIndex(
          (e) => e.equipementTypeID === action.payload.equipementTypeID
        );
        if (idx >= 0) state.equipmentTypes[idx] = action.payload;
        else state.equipmentTypes.push(action.payload);
        state.error = null;
      })
      .addCase(upsertEquipmentTypeThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(removeEquipmentType.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(removeEquipmentType.fulfilled, (state, action) => {
        state.isLoading = false;
        state.equipmentTypes = state.equipmentTypes.filter(
          (e) => e.equipementTypeID !== action.payload
        );
        state.error = null;
      })
      .addCase(removeEquipmentType.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError } = equipmentTypeSlice.actions;
export default equipmentTypeSlice.reducer;


