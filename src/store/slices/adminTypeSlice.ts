/**
 * AdminType Redux Slice
 */
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  createAdminType,
  deleteAdminType,
  getAdminTypes,
  updateAdminType,
} from '@/services/adminTypeService';
import {
  CreateAdminTypeRequest,
  AdminTypePaginationParams,
  AdminTypeSearchParams,
  AdminTypeResponse,
  UpdateAdminTypeRequest,
} from '@/types/adminType';
import { showToast } from './toastSlice';
import { apiGet } from '@/utils/apiClient';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';
import { expectOkReadText, parsePagedListJson } from '@/services/textPlainJson';
import { normalizeAdminType } from '@/utils/normalizers';

/**
 * Transform admin type data to backend expected format (camelCase for JSON binding)
 */
const transformAdminTypePayload = (data: CreateAdminTypeRequest | UpdateAdminTypeRequest) => {
  const basePayload = {
    adminTypeShort: data.adminTypeShort,
    adminTypeLong: data.adminTypeLong,
    status: data.adminTypeStatus,
    isManagePost: data.isManagePost,
    parentID: data.parentID && data.parentID.trim() !== '' ? data.parentID : null,
  };

  // Add adminTypeID for update requests
  if ('adminTypeID' in data) {
    return {
      ...basePayload,
      adminTypeID: data.adminTypeID,
    };
  }

  return basePayload;
};

interface AdminTypeState {
  adminTypes: AdminTypeResponse[];
  isLoading: boolean;
  error: string | null;
  totalItems: number;
}

const initialState: AdminTypeState = {
  adminTypes: [],
  isLoading: false,
  error: null,
  totalItems: 0,
};

export const fetchAdminTypes = createAsyncThunk(
  'adminType/fetchAdminTypes',
  async (pagination: AdminTypePaginationParams | undefined, thunkAPI) => {
    const { rejectWithValue, dispatch } = thunkAPI;
    try {
      const { data, totalRecords } = await getAdminTypes(pagination, pagination?.isActive);
      return { data, totalRecords, pagination };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to fetch admin types';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const createAdminTypeThunk = createAsyncThunk(
  'adminType/createAdminType',
  async (payload: CreateAdminTypeRequest, { rejectWithValue, dispatch }) => {
    try {
      const transformedPayload = transformAdminTypePayload(payload);
      const data = await createAdminType(transformedPayload);
      dispatch(showToast('Admin type created successfully.', 'success'));
      return data;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to create admin type';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const searchAdminTypesThunk = createAsyncThunk(
  'adminType/searchAdminTypes',
  async (pagination: AdminTypeSearchParams | undefined, thunkAPI) => {
    const { rejectWithValue, dispatch } = thunkAPI;
    try {
      const queryParams = buildPaginationQueryParams(pagination);
      const searchTerm = pagination?.searchTerm?.trim();
      if (searchTerm) queryParams.append('searchTerm', searchTerm);
      const endpoint = `/AdminType/search${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await apiGet(endpoint);
      const responseText = await expectOkReadText(response, 'Failed to search admin types');
      const { data, totalRecords } = parsePagedListJson(responseText, (row) => normalizeAdminType(row));
      return { data, totalRecords, pagination };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to search admin types';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const updateAdminTypeThunk = createAsyncThunk(
  'adminType/updateAdminType',
  async (payload: UpdateAdminTypeRequest, { rejectWithValue, dispatch }) => {
    try {
      const transformedPayload = transformAdminTypePayload(payload);
      const data = await updateAdminType(transformedPayload);
      dispatch(showToast('Admin type updated successfully.', 'success'));
      return data;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to update admin type';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const removeAdminType = createAsyncThunk<
  string,
  { id: string; name: string }
>(
  'adminType/removeAdminType',
  async ({ id, name }, { rejectWithValue, dispatch }) => {
    try {
      await deleteAdminType(id);
      dispatch(showToast('Admin type deleted successfully.', 'success'));
      return id;
    } catch (error) {
      const rawMessage =
        error instanceof Error ? error.message : 'Failed to delete admin type';
      const errorMessage = rawMessage.replace('{0}', name);
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

const adminTypeSlice = createSlice({
  name: 'adminType',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdminTypes.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchAdminTypes.fulfilled, (state, action) => {
        state.isLoading = false;
        state.adminTypes = action.payload.data;
        state.totalItems = action.payload.totalRecords;
        state.error = null;
      })
      .addCase(fetchAdminTypes.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(searchAdminTypesThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(searchAdminTypesThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.adminTypes = action.payload.data;
        state.totalItems = action.payload.totalRecords;
        state.error = null;
      })
      .addCase(searchAdminTypesThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(createAdminTypeThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createAdminTypeThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.adminTypes.push(action.payload);
        state.error = null;
      })
      .addCase(createAdminTypeThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(updateAdminTypeThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateAdminTypeThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        const idx = state.adminTypes.findIndex(
          (e) => e.adminTypeID === action.payload.adminTypeID
        );
        if (idx >= 0) state.adminTypes[idx] = action.payload;
        state.error = null;
      })
      .addCase(updateAdminTypeThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(removeAdminType.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(removeAdminType.fulfilled, (state, action) => {
        state.isLoading = false;
        state.adminTypes = state.adminTypes.filter(
          (e) => e.adminTypeID !== action.payload
        );
        state.error = null;
      })
      .addCase(removeAdminType.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError } = adminTypeSlice.actions;
export default adminTypeSlice.reducer;


