/**
 * Requester Redux Slice
 */
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants/tablePagination';
import { getRequesters, upsertRequester, deleteRequester, getRequesterById, getRequesterOptions } from '@/services/requesterService';
import { RequesterResponse, CreateRequesterRequest, UpdateRequesterRequest, RequesterListParams, RequesterSearchParams } from '@/types/requester';
import { showToast } from './toastSlice';
import { shouldPersistGridPageSize } from '@/constants/pagination';
import { createRequesterManagerThunk } from './requesterManagerSlice';
import { getRequesterManagerByRequesterAndEmployee } from '@/services/requesterManagerService';
import type { RootState } from '@/store';
import { hasRole, UserRoleType } from '@/types/userRole';
import { apiGet } from '@/utils/apiClient';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';
import { expectOkReadText, parseJsonText } from '@/services/textPlainJson';
import { normalizeRequester } from '@/utils/normalizers';
import { PagedResponse, SelectOptionDto } from '@/types/common';

interface RequesterState {
  requesters: RequesterResponse[];
  requesterOptions: SelectOptionDto[];
  selectedRequester: RequesterResponse | null;
  isLoading: boolean;
  isLoadingRequesterOptions: boolean;
  pendingRequesterOptionsRequestId: string | null;
  error: string | null;
  totalItems: number;
  currentPage: number;
  pageSize: number;
}

const initialState: RequesterState = {
  requesters: [],
  requesterOptions: [],
  selectedRequester: null,
  isLoading: false,
  isLoadingRequesterOptions: false,
  pendingRequesterOptionsRequestId: null,
  error: null,
  totalItems: 0,
  currentPage: 1,
  pageSize: DEFAULT_TABLE_PAGE_SIZE,
};

// Transform frontend payload to match backend JSON naming policy (PascalCase)
const transformRequesterPayload = (data: CreateRequesterRequest | UpdateRequesterRequest) => {
  const basePayload: any = {
    RequesterID: 'requesterID' in data ? data.requesterID : undefined,
    DepartmentDefinedNumber: data.departmentDefinedNumber,
    BusinessTypeID: data.businessTypeID,
    DepartmentQuestionnaireId: data.departmentQuestionnaireId || null,
    Status: data.status,
    Name: data.name,
    Address: data.address,
    Address2: data.address2,
    City: data.city,
    State: data.state,
    Zip: data.zip,
    Email: data.email,
    Phone: data.phone,
    PrimaryContact: data.primaryContact,
    Fax: data.fax,
    SecondaryContact: data.secondaryContact,
    SecondaryPhone: data.secondaryPhone,
    InvoiceBillingName: data.invoiceBillingName,
    InvoiceContact: data.invoiceContact,
    InvoiceAddress: data.invoiceAddress,
    InvoiceAddress2: data.invoiceAddress2,
    InvoiceCity: data.invoiceCity,
    InvoiceState: data.invoiceState,
    InvoiceZip: data.invoiceZip,
    InvoicePhone: data.invoicePhone,
    InvoicePhoneExt: data.invoicePhoneExt,
    InvoiceEmail: data.invoiceEmail,
    InvoiceFax: data.invoiceFax,
    IsLiquorLicenseRequired: data.isLiquorLicenseRequired,
    LiquorLicense: data.liquorLicense ?? null,
    BillingNotes: data.billingNotes,
    Comments: data.comments,
    ApprovedForCivilians: data.approvedForCivilians,
    ExemptFromExtract: data.exemptFromExtract,
    IsChild: data.isChild,
    NotificationRecipients: data.notificationRecipients,
    ParentID: data.parentID,
    // Skills requirements (optional)
    IsSkillsRequired: data.isSkillsRequired,
    SkillIDs: data.skillIDs,
    // Requester Authorization
    IsRequesterAuthorized: data.isRequesterAuthorized,
  };

  return basePayload;
};

// Async thunks
export const fetchRequesters = createAsyncThunk(
  'requester/fetchRequesters',
  async (params: RequesterListParams | undefined, { rejectWithValue, dispatch }) => {
    try {
      const result = await getRequesters(params);
      return { data: result.data, totalRecords: result.totalRecords, pagination: params };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch requesters';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchRequesterOptionsThunk = createAsyncThunk<
  SelectOptionDto[],
  { searchTerm?: string }
>(
  'requester/fetchRequesterOptions',
  async ({ searchTerm }, { rejectWithValue, dispatch }) => {
    try {
      return await getRequesterOptions(searchTerm);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch requester options';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchRequesterByIdThunk = createAsyncThunk(
  'requester/fetchRequesterById',
  async (id: string, { rejectWithValue, dispatch }) => {
    try {
      const data = await getRequesterById(id);
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch requester';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const searchRequestersThunk = createAsyncThunk(
  'requester/searchRequesters',
  async (params: RequesterSearchParams | undefined, { rejectWithValue, dispatch }) => {
    try {
      const queryParams = buildPaginationQueryParams(params);
      const searchTerm = params?.searchTerm?.trim();
      if (searchTerm) queryParams.append('searchTerm', searchTerm);
      const endpoint = `/Requester/search${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await apiGet(endpoint);
      const responseText = await expectOkReadText(response, 'Failed to search requesters');
      const pagedResponse = parseJsonText<PagedResponse<Record<string, unknown>>>(responseText);
      const requesters = (pagedResponse.data || []).map(normalizeRequester);
      const totalRecords = pagedResponse.totalRecords ?? 0;
      return { data: requesters, totalRecords, pagination: params };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to search requesters';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const upsertRequesterThunk = createAsyncThunk(
  'requester/upsertRequester',
  async (requesterData: CreateRequesterRequest | UpdateRequesterRequest, { rejectWithValue, dispatch, getState }) => {
    try {
      const transformedPayload = transformRequesterPayload(requesterData);
      const data = await upsertRequester(transformedPayload);
      const isUpdate = 'requesterID' in requesterData && requesterData.requesterID;
      dispatch(showToast(isUpdate ? 'Requester updated successfully.' : 'Requester created successfully.', 'success'));

      // Requester creation is the right place to auto-link creator as requester manager.
      if (!isUpdate) {
        const state = getState() as RootState;
        const employeeID = state.auth.user?.employeeID;
        const isRequesterManager = hasRole(state.auth.user?.roles, UserRoleType.RequesterManager);
        const requesterID = data?.requesterID;

        if (isRequesterManager && employeeID && requesterID) {
          let alreadyLinked = false;
          try {
            const existing = await getRequesterManagerByRequesterAndEmployee(requesterID, employeeID);
            alreadyLinked = existing != null && String(existing.requesterManagerID ?? '').trim() !== '';
          } catch {
            // Lookup failed — attempt create; duplicate errors are swallowed below.
          }
          if (!alreadyLinked) {
            try {
              await dispatch(
                createRequesterManagerThunk({
                  requesterID,
                  employeeID,
                  isRequestShared: false,
                  isEmployeeShared: false,
                })
              ).unwrap();
            } catch {
              // Do not fail requester creation if mapping already exists or cannot be added.
            }
          }
        }
      }
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save requester';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const removeRequester = createAsyncThunk<
  string,
  { id: string; name: string }
>(
  'requester/removeRequester',
  async ({ id, name }, { rejectWithValue, dispatch }) => {
    try {
      await deleteRequester(id);
      dispatch(showToast('Requester deleted successfully.', 'success'));
      return id;
    } catch (error) {
      const rawMessage =
        error instanceof Error ? error.message : 'Failed to delete requester';
      const errorMessage = rawMessage.replace('{0}', name);
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

const requesterSlice = createSlice({
  name: 'requester',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearSelectedRequester: (state) => {
      state.selectedRequester = null;
    },
    setPagination: (state, action) => {
      state.currentPage = action.payload.page || state.currentPage;
      state.pageSize = action.payload.pageSize || state.pageSize;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Requesters
      .addCase(fetchRequesters.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchRequesters.fulfilled, (state, action) => {
        state.isLoading = false;
        state.requesters = action.payload.data;
        if (action.payload.pagination) {
          if (action.payload.pagination.page !== undefined) {
            state.currentPage = action.payload.pagination.page;
          }
          if (shouldPersistGridPageSize(action.payload.pagination.pageSize)) {
            state.pageSize = action.payload.pagination.pageSize as number;
          }
        }
        // Use totalRecords from API (reference: Employee slice). If API returns totalRecords
        // equal to current page length, keep previous total so pagination text stays correct.
        const apiTotal = action.payload.totalRecords ?? 0;
        const currentPageLength = action.payload.data?.length ?? 0;
        if (
          apiTotal > currentPageLength ||
          state.totalItems === 0 ||
          apiTotal >= state.totalItems
        ) {
          state.totalItems = apiTotal;
        }
        state.error = null;
      })
      .addCase(fetchRequesters.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchRequesterOptionsThunk.pending, (state, action) => {
        state.isLoadingRequesterOptions = true;
        state.pendingRequesterOptionsRequestId = action.meta.requestId;
      })
      .addCase(fetchRequesterOptionsThunk.fulfilled, (state, action) => {
        if (state.pendingRequesterOptionsRequestId !== action.meta.requestId) return;
        state.isLoadingRequesterOptions = false;
        state.pendingRequesterOptionsRequestId = null;
        state.requesterOptions = action.payload;
      })
      .addCase(fetchRequesterOptionsThunk.rejected, (state, action) => {
        if (state.pendingRequesterOptionsRequestId !== action.meta.requestId) return;
        state.isLoadingRequesterOptions = false;
        state.pendingRequesterOptionsRequestId = null;
        state.requesterOptions = [];
        state.error = action.payload as string;
      })
      .addCase(searchRequestersThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(searchRequestersThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.requesters = action.payload.data;
        if (action.payload.pagination) {
          if (action.payload.pagination.page !== undefined) {
            state.currentPage = action.payload.pagination.page;
          }
          if (shouldPersistGridPageSize(action.payload.pagination.pageSize)) {
            state.pageSize = action.payload.pagination.pageSize as number;
          }
        }
        state.totalItems = action.payload.totalRecords ?? 0;
        state.error = null;
      })
      .addCase(searchRequestersThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Fetch Requester By ID
      .addCase(fetchRequesterByIdThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchRequesterByIdThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.selectedRequester = action.payload;
        state.error = null;
      })
      .addCase(fetchRequesterByIdThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Upsert Requester
      .addCase(upsertRequesterThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(upsertRequesterThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.requesters.findIndex(r => r.requesterID === action.payload.requesterID);
        if (index >= 0) {
          state.requesters[index] = { ...state.requesters[index], ...action.payload };
        } else {
          state.requesters.push(action.payload);
        }
        // Also update selected if it matches
        if (state.selectedRequester?.requesterID === action.payload.requesterID) {
          state.selectedRequester = action.payload;
        }
        state.error = null;
      })
      .addCase(upsertRequesterThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Delete Requester
      .addCase(removeRequester.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(removeRequester.fulfilled, (state, action) => {
        state.isLoading = false;
        state.requesters = state.requesters.filter(r => r.requesterID !== action.payload);
        state.error = null;
      })
      .addCase(removeRequester.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError, clearSelectedRequester, setPagination } = requesterSlice.actions;
export default requesterSlice.reducer;
