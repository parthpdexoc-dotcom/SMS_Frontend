/**
 * RoutingGroup Redux Slice
 */
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  createRoutingGroup,
  deleteRoutingGroup,
  getAllRoutingGroupDetails,
  getRoutingGroups,
  updateRoutingGroup,
} from '@/services/routingGroupService';
import {
  RoutingGroupPaginationParams,
  RoutingGroupSearchParams,
  RoutingGroupResponse,
  CreateRoutingGroupRequest,
  UpdateRoutingGroupRequest,
} from '@/types/routingGroup';
import { showToast } from './toastSlice';
import { apiGet } from '@/utils/apiClient';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';
import { expectOkReadText, parsePagedListJson } from '@/services/textPlainJson';
import { normalizeRoutingGroup } from '@/utils/normalizers';

interface RoutingGroupState {
  routingGroups: RoutingGroupResponse[];
  isLoading: boolean;
  error: string | null;
  totalItems: number;
}

const initialState: RoutingGroupState = {
  routingGroups: [],
  isLoading: false,
  error: null,
  totalItems: 0,
};

export const fetchRoutingGroups = createAsyncThunk(
  'routingGroup/fetchRoutingGroups',
  async (pagination: RoutingGroupPaginationParams | undefined, thunkAPI) => {
    const { rejectWithValue, dispatch } = thunkAPI;
    try {
      const { data, totalRecords } = await getRoutingGroups(pagination);
      return { data, totalRecords, pagination };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch routing groups';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

/** Fetches routing groups from getallroutinggroupdetails (includes employeeNames for grid). */
export const fetchRoutingGroupDetails = createAsyncThunk(
  'routingGroup/fetchRoutingGroupDetails',
  async (_: void, thunkAPI) => {
    const { rejectWithValue, dispatch } = thunkAPI;
    try {
      const { data, totalRecords } = await getAllRoutingGroupDetails();
      return { data, totalRecords };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch routing group details';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const searchRoutingGroupsThunk = createAsyncThunk(
  'routingGroup/searchRoutingGroups',
  async (pagination: RoutingGroupSearchParams | undefined, thunkAPI) => {
    const { rejectWithValue, dispatch } = thunkAPI;
    try {
      const queryParams = buildPaginationQueryParams(pagination);
      const searchTerm = pagination?.searchTerm?.trim();
      if (searchTerm) {
        queryParams.append('searchTerm', searchTerm);
      }
      const queryString = queryParams.toString();
      const endpoint = `/RoutingGroup/search${queryString ? `?${queryString}` : ''}`;
      const response = await apiGet(endpoint);
      const responseText = await expectOkReadText(response, 'Failed to search routing groups');
      const { data, totalRecords } = parsePagedListJson(responseText, (row) => normalizeRoutingGroup(row));
      return { data, totalRecords, pagination };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to search routing groups';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const upsertRoutingGroupThunk = createAsyncThunk(
  'routingGroup/upsertRoutingGroup',
  async (
    payload: CreateRoutingGroupRequest | UpdateRoutingGroupRequest,
    { rejectWithValue, dispatch }
  ) => {
    try {
      if ('routingGroupId' in payload && payload.routingGroupId) {
        const data = await updateRoutingGroup(payload as UpdateRoutingGroupRequest);
        dispatch(showToast('Routing group updated successfully.', 'success'));
        return data;
      }
      const data = await createRoutingGroup(payload as CreateRoutingGroupRequest);
      dispatch(showToast('Routing group created successfully.', 'success'));
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save routing group';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const removeRoutingGroup = createAsyncThunk<
  string,
  { id: string; name: string }
>(
  'routingGroup/removeRoutingGroup',
  async ({ id, name }, { rejectWithValue, dispatch }) => {
    try {
      await deleteRoutingGroup(id);
      dispatch(showToast('Routing group deleted successfully.', 'success'));
      return id;
    } catch (error) {
      const rawMessage =
        error instanceof Error ? error.message : 'Failed to delete routing group';
      const errorMessage = rawMessage.replace('{0}', name);
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

// Backward compatibility alias for existing components
export const fetchRoutingGroupsByDepartmentAndStatus = createAsyncThunk(
  'routingGroup/fetchRoutingGroupsByDepartmentAndStatus',
  async (_: void, thunkAPI) => {
    const { rejectWithValue, dispatch } = thunkAPI;
    try {
      const { data, totalRecords } = await getRoutingGroups({ page: 1, pageSize: 1000 });
      return { data, totalRecords, pagination: { page: 1, pageSize: 1000 } };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch routing groups';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

const routingGroupSlice = createSlice({
  name: 'routingGroup',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRoutingGroups.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchRoutingGroups.fulfilled, (state, action) => {
        state.isLoading = false;
        state.routingGroups = action.payload.data;
        state.totalItems = action.payload.totalRecords;
        state.error = null;
      })
      .addCase(fetchRoutingGroups.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchRoutingGroupDetails.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchRoutingGroupDetails.fulfilled, (state, action) => {
        state.isLoading = false;
        state.routingGroups = action.payload.data;
        state.totalItems = action.payload.totalRecords;
        state.error = null;
      })
      .addCase(fetchRoutingGroupDetails.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(searchRoutingGroupsThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(searchRoutingGroupsThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.routingGroups = action.payload.data;
        state.totalItems = action.payload.totalRecords;
        state.error = null;
      })
      .addCase(searchRoutingGroupsThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(upsertRoutingGroupThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(upsertRoutingGroupThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        const idx = state.routingGroups.findIndex((b) => b.routingGroupId === action.payload.routingGroupId);
        if (idx >= 0) state.routingGroups[idx] = action.payload;
        else state.routingGroups.push(action.payload);
        state.error = null;
      })
      .addCase(upsertRoutingGroupThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(removeRoutingGroup.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(removeRoutingGroup.fulfilled, (state, action) => {
        state.isLoading = false;
        state.routingGroups = state.routingGroups.filter((b) => b.routingGroupId !== action.payload);
        state.error = null;
      })
      .addCase(removeRoutingGroup.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Backward compatibility thunk handlers
      .addCase(fetchRoutingGroupsByDepartmentAndStatus.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchRoutingGroupsByDepartmentAndStatus.fulfilled, (state, action) => {
        state.isLoading = false;
        state.routingGroups = action.payload.data;
        state.totalItems = action.payload.totalRecords;
        state.error = null;
      })
      .addCase(fetchRoutingGroupsByDepartmentAndStatus.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError } = routingGroupSlice.actions;
export default routingGroupSlice.reducer;
