/**
 * Request Redux Slice
 */
import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants/tablePagination';
import { getRequests, getRequesterRequests, getRequestPosts, getRequestPostPositions, upsertRequest, getRequestById, sendVehicleApprovalEmail, SendVehicleApprovalEmailsRequest, deleteRequest, getAssignableEmployeesByRequestId, cloneRequest, RequestOneTimeDateChangeConflictError } from '@/services/requestService';
import { RequestResponse, CreateRequestRequest, UpdateRequestRequest, RequestListParams, type RequestOneTimeDateChangeAssignmentDto, type RequestInRequesterListDto, type RequesterRequestsFilter, type PostInRequestListDto, type RequestPostsFilter, type PostPositionInRequestListDto, type RequestPostPositionsFilter } from '@/types/request';
import { Post } from '@/types/post';
import type { EmployeeResponse } from '@/types/employee';
import { showToast } from './toastSlice';
import { logout } from './authSlice';

// Backend requires DaysOfWeek only for weekly (3), DaysOfMonth only for monthly (4). Omit otherwise.
const REQUEST_TYPE_WEEK = 3;
const REQUEST_TYPE_MONTH = 4;

function transformRequestTypeForPayload(rt: CreateRequestRequest['requestType']): Record<string, unknown> | undefined {
  if (!rt) return undefined;
  const typeNum = Number(rt.requestType ?? 0);
  const payload: Record<string, unknown> = {
    RequestType: typeNum,
    RepeatEvery: Number(rt.repeatEvery ?? 1),
  };
  if (rt.monthlyMode != null) payload.MonthlyMode = rt.monthlyMode;
  if (rt.weekIndex != null) payload.WeekIndex = rt.weekIndex;
  const monthlyByPattern = typeNum === REQUEST_TYPE_MONTH && Number(rt.monthlyMode) === 2;
  // Weekly, and monthly "On the Second Sunday", both need the weekday. Sunday is 0.
  if ((typeNum === REQUEST_TYPE_WEEK || monthlyByPattern) && Array.isArray(rt.daysOfWeek)) {
    payload.DaysOfWeek = rt.daysOfWeek;
  }
  if (typeNum === REQUEST_TYPE_MONTH && !monthlyByPattern && Array.isArray(rt.daysOfMonth)) {
    payload.DaysOfMonth = rt.daysOfMonth;
  }
  return payload;
}

interface RequestState {
  requests: RequestResponse[];
  requesterRequests: RequestInRequesterListDto[];
  requesterRequestsTotalCount: number;
  requesterRequestsLoadingMore: boolean;
  requesterPostsTotalCount: number;
  requesterHasUnpaidInvoice: boolean;
  requestPosts: PostInRequestListDto[];
  requestPostsTotalCount: number;
  requestPostsLoadingMore: boolean;
  requestPositionsTotalCount: number;
  requestPostsLoading: boolean;
  requestPostPositionsByPostId: Record<string, PostPositionInRequestListDto[]>;
  requestPostPositionsTotalByPostId: Record<string, number>;
  /** Calendar dates from POST `/PostPosition/by-post/filter` (`dates` on the response). */
  requestPostPositionDatesByPostId: Record<string, string[]>;
  requestPostPositionsLoadingByPostId: Record<string, boolean>;
  assignableEmployeesByRequest: EmployeeResponse[];
  assignableEmployeesLoading: boolean;
  assignableEmployeesError: string | null;
  isLoading: boolean;
  error: string | null;
  /** 409 upsert conflict message from API; drives warning confirm dialog. */
  conflictMessage: string | null;
  totalItems: number;
  currentPage: number;
  pageSize: number;
  isSendingApprovalEmails: boolean;
  sendVehicleApprovalEmailsError: string | null;
}

const initialState: RequestState = {
  requests: [],
  requesterRequests: [],
  requesterRequestsTotalCount: 0,
  requesterRequestsLoadingMore: false,
  requesterPostsTotalCount: 0,
  requesterHasUnpaidInvoice: false,
  requestPosts: [],
  requestPostsTotalCount: 0,
  requestPostsLoadingMore: false,
  requestPositionsTotalCount: 0,
  requestPostsLoading: false,
  requestPostPositionsByPostId: {},
  requestPostPositionsTotalByPostId: {},
  requestPostPositionDatesByPostId: {},
  requestPostPositionsLoadingByPostId: {},
  assignableEmployeesByRequest: [],
  assignableEmployeesLoading: false,
  assignableEmployeesError: null,
  isLoading: false,
  error: null,
  conflictMessage: null,
  totalItems: 0,
  currentPage: 1,
  pageSize: DEFAULT_TABLE_PAGE_SIZE,
  isSendingApprovalEmails: false,
  sendVehicleApprovalEmailsError: null,
};

// Transform frontend payload to match backend JSON naming policy (PascalCase)
const transformRequestPayload = (data: CreateRequestRequest | UpdateRequestRequest) => {
  const basePayload: Record<string, unknown> = {
    RequestID: 'requestID' in data ? data.requestID : undefined,
    RequesterID: data.requesterID,
    RequesterManagerID: data.requesterManagerID,
    EnableWaitingList: data.enableWaitingList,
    FirstName: data.firstName,
    LastName: data.lastName,
    PrimaryPhone: data.primaryPhone,
    CellPhone: data.cellPhone,
    SecondaryPhone: data.secondaryPhone,
    AlternateCellPhone: data.alternateCellPhone,
    PrimaryEmail: data.primaryEmail,
    SecondaryEmail: data.secondaryEmail,
    IsPostContact: data.isPostContact,
    StartDate: data.startDate,
    EndDate: data.endDate,
    Title: data.title,
    Location: data.location,
    Address: data.address ?? '',
    City: data.city ?? '',
    State: data.state ?? '',
    Zip: data.zip ?? '',
    PostLocationsAreStationary: data.postLocationsAreStationary,
    RequiresPermit: data.requiresPermit,
    PermitNumber: data.requiresPermit ? data.permitNumber : undefined,
    IsSpecialEvent: data.isSpecialEvent,
    IsPremiumPaidEvent: data.isPremiumPaidEvent ?? false,
    ConfirmConflict: data.confirmConflict === true ? true : undefined,
    SpecialEventApproved: data.specialEventApproved,
    RequiresLiquorLicense: data.requiresLiquorLicense,
    LiquorLicenseNumber: data.requiresLiquorLicense ? data.liquorLicenseNumber : undefined,
    AlcoholPermitRequired: data.requiresLiquorLicense ? (data.alcoholPermitRequired ?? false) : false,
    SpecialRate:
      data.requiresLiquorLicense && data.alcoholPermitRequired
        ? (data.specialRate ?? null)
        : null,
    RequiresVehicle: data.requiresVehicle,
    RequiresVehicleAtEveryPost: data.requiresVehicle ? data.requiresVehicleAtEveryPost : undefined,
    NumberOfVehicles: data.numberOfVehicles,
    VehicleApproved: data.requiresVehicle ? data.vehicleApproved : undefined,
    RequiresEquipment: data.requiresEquipment,
    RequiresEquipmentAtEachPost: data.requiresEquipment ? data.requiresEquipmentAtEachPost : undefined,
    NumberOfEquipment: data.numberOfEquipment,
    IsSkillRequired: data.isSkillRequired,
    SkillIDs: data.skillIDs,
    DepartmentDefinedFieldValue1: data.departmentDefinedFieldValue1,
    DepartmentDefinedFieldValue2: data.departmentDefinedFieldValue2,
    DepartmentDefinedFieldValue3: data.departmentDefinedFieldValue3,
    DepartmentDefinedFieldValue4: data.departmentDefinedFieldValue4,
    DepartmentDefinedFieldValue5: data.departmentDefinedFieldValue5,
    DepartmentDefinedFieldValue6: data.departmentDefinedFieldValue6,
    DepartmentDefinedFieldValue7: data.departmentDefinedFieldValue7,
    DepartmentDefinedFieldValue8: data.departmentDefinedFieldValue8,
    DepartmentDefinedFieldValue9: data.departmentDefinedFieldValue9,
    DepartmentDefinedFieldValue10: data.departmentDefinedFieldValue10,
    RequestHasBeenUpdated: data.requestHasBeenUpdated,
    RequestType: transformRequestTypeForPayload(data.requestType),
    DepartmentResponseAreaId: data.DepartmentResponseAreaId,
    ReleaseAs: data.releaseAs,
    Posts: data.posts ? transformPosts(data.posts) : [],
    EnableFees: data.enableFees ?? true,
    SelectedDepartmentFeeIds: data.selectedDepartmentFeeIds || [],
  };

  if (data.transferWithConflictPostPositionIds?.length) {
    basePayload.TransferWithConflictPostPositionIds = data.transferWithConflictPostPositionIds;
  }

  return basePayload;
};

// Transform posts from frontend camelCase to backend PascalCase.
// PostRequiresVehicle / PostRequiresEquipment are managed on the job (post) form only —
// do not send them on request upsert (request-level RequiresVehicle / RequiresEquipment are separate).
const transformPosts = (posts: Post[]): Record<string, unknown>[] => {
  return posts.map(post => ({
    PostID: post.postId || undefined,
    RequestID: post.requestID,
    PostParentID: post.postParentID || undefined,
    ProjectNumber: post.projectNumber || undefined,
    TaskNumber: post.taskNumber || undefined,
    AwardNumber: post.awardNumber || undefined,
    FundNumber: post.fundNumber || undefined,
    OrganizationNumber: post.organizationNumber || undefined,
    IsParent: post.isParent,
    IsExemptHours: post.exemptHours ?? false,
    DefineCallSign: post.defineCallSign ?? false,
    IsSupervisorPost: post.isSupervisorPost,
    IsAlcoholServedOrConsumed: post.isAlcoholServedOrConsumed ?? false,
    TotalPostPositions: post.totalPostPositions,
    RankEligible: post.rankEligible,
    RequiredRank: (post as any).requiredRank ?? 0, // Default to 0 if not provided
    PostTitle: post.postTitle,
    PostDescription: post.postDescription,
    PostStartTime: post.postStartTime,
    PostLength: post.postLength,
    PostIsFlexible: post.postIsFlexible,
    PostPayRate: post.postPayRate,
    PostPremiumRate: post.postPremiumRate,
    IsSkillsRequired: post.isSkillsRequired,
    SkillIDs: post.skillIDs || [],
    EmployeeTypeID: post.employeeTypeID || undefined,
    PostNotes: post.postNotes,
    PostLocation: post.postLocation,
    IsPostRequiredDocument: post.isPostRequiredDocument,
    PostDepartmentDefinedValue1: post.postDepartmentDefinedValue1,
    PostDepartmentDefinedValue2: post.postDepartmentDefinedValue2,
    PostDepartmentDefinedValue3: post.postDepartmentDefinedValue3,
    PostDepartmentDefinedValue4: post.postDepartmentDefinedValue4,
    PostDepartmentDefinedValue5: post.postDepartmentDefinedValue5,
    PostDepartmentDefinedValue6: post.postDepartmentDefinedValue6,
    PostDepartmentDefinedValue7: post.postDepartmentDefinedValue7,
    PostDepartmentDefinedValue8: post.postDepartmentDefinedValue8,
    PostDepartmentDefinedValue9: post.postDepartmentDefinedValue9,
    PostDepartmentDefinedValue10: post.postDepartmentDefinedValue10,
    PostPositions: [], // Empty array for post positions as they're managed separately
  }));
};

// Async thunks
export const fetchRequests = createAsyncThunk(
  'request/fetchRequests',
  async (params: RequestListParams | undefined, { rejectWithValue, dispatch }) => {
    try {
      // Enforce default sorting to prevent 500 errors from backend
      const effectiveParams: RequestListParams = {
        ...params,
      };
      const data = await getRequests(effectiveParams);
      return { data, pagination: effectiveParams };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch requests';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export type FetchRequesterRequestsArg = RequesterRequestsFilter & {
  append?: boolean;
};

export const fetchRequestsByRequesterId = createAsyncThunk(
  'request/fetchByRequesterId',
  async (arg: FetchRequesterRequestsArg, { rejectWithValue, dispatch }) => {
    const { append, ...filters } = arg;
    try {
      const result = await getRequesterRequests(filters);
      return { ...result, append: Boolean(append) };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch requester requests';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export type FetchRequestPostsArg = RequestPostsFilter & {
  append?: boolean;
};

export const fetchRequestPosts = createAsyncThunk(
  'request/fetchRequestPosts',
  async (arg: FetchRequestPostsArg, { rejectWithValue, dispatch }) => {
    const { append, ...filters } = arg;
    try {
      const result = await getRequestPosts(filters);
      return { ...result, append: Boolean(append) };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch request posts';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchRequestPostPositions = createAsyncThunk(
  'request/fetchRequestPostPositions',
  async (filters: RequestPostPositionsFilter, { rejectWithValue, dispatch }) => {
    try {
      const data = await getRequestPostPositions(filters);
      return { postId: filters.postId, data };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch request post positions';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue({ postId: filters.postId, error: errorMessage });
    }
  }
);

export type UpsertRequestArg =
  | CreateRequestRequest
  | UpdateRequestRequest
  | {
      request: CreateRequestRequest | UpdateRequestRequest;
      silent?: boolean;
    };

function normalizeUpsertRequestArg(
  arg: UpsertRequestArg
): {
  requestData: CreateRequestRequest | UpdateRequestRequest;
  silent: boolean;
} {
  if (arg && typeof arg === 'object' && 'request' in arg && (arg as { request?: unknown }).request != null) {
    const opt = arg as {
      request: CreateRequestRequest | UpdateRequestRequest;
      silent?: boolean;
    };
    return {
      requestData: opt.request,
      silent: opt.silent === true,
    };
  }
  return {
    requestData: arg as CreateRequestRequest | UpdateRequestRequest,
    silent: false,
  };
}

/** Thunk `rejectWithValue` when request upsert returns HTTP 409 with assigned post positions. */
export type RequestOneTimeDateChangeConflictRejected = {
  kind: 'oneTimeDateChangeConflict';
  message: string;
  assignedPostPositions: RequestOneTimeDateChangeAssignmentDto[];
};

export function parseRequestOneTimeDateChangeRejection(
  err: unknown
): RequestOneTimeDateChangeConflictRejected | null {
  if (!err || typeof err !== 'object') return null;
  const payload = err as Partial<RequestOneTimeDateChangeConflictRejected>;
  if (payload.kind !== 'oneTimeDateChangeConflict') return null;
  if (!Array.isArray(payload.assignedPostPositions)) return null;
  return {
    kind: 'oneTimeDateChangeConflict',
    message: String(payload.message ?? '').trim(),
    assignedPostPositions: payload.assignedPostPositions,
  };
}

export const upsertRequestThunk = createAsyncThunk(
  'request/upsertRequest',
  async (arg: UpsertRequestArg, { rejectWithValue, dispatch }) => {
    const { requestData, silent } = normalizeUpsertRequestArg(arg);
    try {
      const transformedPayload = transformRequestPayload(requestData);
      const data = await upsertRequest(transformedPayload);
      const isUpdate = 'requestID' in requestData && requestData.requestID;
      if (!silent) {
        dispatch(showToast(isUpdate ? 'Request updated successfully.' : 'Request created successfully.', 'success'));
      }
      return data;
    } catch (error) {
      if (error instanceof RequestOneTimeDateChangeConflictError) {
        return rejectWithValue({
          kind: 'oneTimeDateChangeConflict',
          message: error.conflict.message,
          assignedPostPositions: error.conflict.assignedPostPositions,
        } satisfies RequestOneTimeDateChangeConflictRejected);
      }
      const conflict = error as { status?: number; message?: string } | null;
      if (conflict && typeof conflict === 'object' && conflict.status === 409) {
        return rejectWithValue({
          status: 409,
          message: conflict.message || 'Failed to save request',
          requiresConfirmation: true,
        });
      }
      const errorMessage = error instanceof Error ? error.message : 'Failed to save request';
      if (!silent) {
        dispatch(showToast(errorMessage, 'error'));
      }
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchRequestById = createAsyncThunk(
  'request/fetchRequestById',
  async (arg: string | { requestId: string; silent?: boolean }, { rejectWithValue, dispatch }) => {
    const requestId = typeof arg === 'string' ? arg : arg.requestId;
    const silent = typeof arg === 'object' && arg.silent === true;
    try {
      const data = await getRequestById(requestId);
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch request';
      if (!silent) {
        dispatch(showToast(errorMessage, 'error'));
      }
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchAssignableEmployeesByRequestThunk = createAsyncThunk(
  'request/fetchAssignableEmployeesByRequest',
  async (
    args: { requestId: string; searchTerm?: string },
    { rejectWithValue, dispatch }
  ) => {
    try {
      return await getAssignableEmployeesByRequestId(args.requestId, args.searchTerm);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch assignable employees';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const sendVehicleApprovalEmailThunk = createAsyncThunk(
  'request/sendVehicleApprovalEmail',
  async (payload: SendVehicleApprovalEmailsRequest, { rejectWithValue }) => {
    try {
      await sendVehicleApprovalEmail(payload);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send vehicle approval email';
      return rejectWithValue(errorMessage);
    }
  }
);

export const deleteRequestThunk = createAsyncThunk(
  'request/deleteRequest',
  async (requestId: string, { rejectWithValue, dispatch }) => {
    try {
      await deleteRequest(requestId);
      dispatch(showToast('Request deleted successfully.', 'success'));
      return requestId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete request';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const cloneRequestThunk = createAsyncThunk(
  'request/cloneRequest',
  async (requestId: string, { rejectWithValue, dispatch }) => {
    try {
      const data = await cloneRequest(requestId);
      dispatch(showToast('Request cloned successfully.', 'success'));
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to clone request';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

const requestSlice = createSlice({
  name: 'request',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
      state.sendVehicleApprovalEmailsError = null;
    },
    clearConflictMessage: (state) => {
      state.conflictMessage = null;
    },
    clearSendVehicleApprovalEmailsError: (state) => {
      state.sendVehicleApprovalEmailsError = null;
    },
    resetRequests: (state) => {
      state.requests = [];
      state.requesterRequests = [];
      state.requesterRequestsTotalCount = 0;
      state.requesterRequestsLoadingMore = false;
      state.requesterPostsTotalCount = 0;
      state.requesterHasUnpaidInvoice = false;
      state.requestPosts = [];
      state.requestPostsTotalCount = 0;
      state.requestPostsLoadingMore = false;
      state.requestPositionsTotalCount = 0;
      state.totalItems = 0;
      state.currentPage = 1;
    },
    /** Drop cached positions for a post (e.g. after post delete) without calling PostPosition API. */
    clearRequestPostPositionsForPost: (state, action: PayloadAction<string>) => {
      const postId = action.payload.trim();
      if (!postId) return;
      delete state.requestPostPositionsByPostId[postId];
      delete state.requestPostPositionsTotalByPostId[postId];
      delete state.requestPostPositionDatesByPostId[postId];
      delete state.requestPostPositionsLoadingByPostId[postId];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(logout.fulfilled, () => ({ ...initialState }))
      // Fetch requests
      .addCase(fetchRequests.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchRequests.fulfilled, (state, action) => {
        state.isLoading = false;
        // Sort requests by Date (Ascending)
        const sortedRequests = [...action.payload.data].sort((a, b) => {
          const dateA = new Date(a.startDate).getTime();
          const dateB = new Date(b.startDate).getTime();
          return dateA - dateB;
        });
        state.requests = sortedRequests;
        if (action.payload.pagination) {
          state.currentPage = action.payload.pagination.page || 1;
          state.pageSize = action.payload.pagination.pageSize || 10;
          // Note: Total items would come from backend pagination metadata
          state.totalItems = action.payload.data.length;
        }
      })
      .addCase(fetchRequests.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Fetch requests by requester ID (for parent-request dropdown)
      .addCase(fetchRequestsByRequesterId.pending, (state, action) => {
        state.error = null;
        if (action.meta.arg.append) {
          state.requesterRequestsLoadingMore = true;
        } else {
          state.isLoading = true;
          state.requesterRequests = [];
          state.requesterRequestsTotalCount = 0;
          state.requesterPostsTotalCount = 0;
          state.requesterHasUnpaidInvoice = false;
        }
      })
      .addCase(fetchRequestsByRequesterId.fulfilled, (state, action) => {
        state.isLoading = false;
        state.requesterRequestsLoadingMore = false;
        const incoming = [...(action.payload.data ?? [])].sort((a, b) => {
          const dateA = new Date(a.startDate).getTime();
          const dateB = new Date(b.startDate).getTime();
          return dateA - dateB;
        });
        if (action.payload.append) {
          const existingIds = new Set(state.requesterRequests.map((request) => request.requestId));
          for (const request of incoming) {
            if (!existingIds.has(request.requestId)) {
              state.requesterRequests.push(request);
            }
          }
          state.requesterRequests.sort((a, b) => {
            const dateA = new Date(a.startDate).getTime();
            const dateB = new Date(b.startDate).getTime();
            return dateA - dateB;
          });
        } else {
          state.requesterRequests = incoming;
        }
        state.requesterRequestsTotalCount = action.payload.totalRequestCount ?? 0;
        state.requesterPostsTotalCount = action.payload.totalPostCount ?? 0;
        state.requesterHasUnpaidInvoice = Boolean(action.payload.hasUnpaidInvoice);
      })
      .addCase(fetchRequestsByRequesterId.rejected, (state, action) => {
        state.isLoading = false;
        state.requesterRequestsLoadingMore = false;
        state.error = action.payload as string;
        if (!action.meta.arg.append) {
          state.requesterHasUnpaidInvoice = false;
        }
      })
      .addCase(fetchRequestPosts.pending, (state, action) => {
        if (action.meta.arg.append) {
          state.requestPostsLoadingMore = true;
        } else {
          state.requestPostsLoading = true;
          state.requestPosts = [];
          state.requestPostsTotalCount = 0;
        }
      })
      .addCase(fetchRequestPosts.fulfilled, (state, action) => {
        state.requestPostsLoading = false;
        state.requestPostsLoadingMore = false;
        const incoming = action.payload.posts ?? [];
        if (action.payload.append) {
          const existingIds = new Set(state.requestPosts.map((post) => post.postId));
          for (const post of incoming) {
            if (!existingIds.has(post.postId)) {
              state.requestPosts.push(post);
            }
          }
        } else {
          state.requestPosts = incoming;
        }
        state.requestPostsTotalCount =
          action.payload.totalPostCount ?? state.requestPosts.length;
        state.requestPositionsTotalCount =
          action.payload.totalPositionCount ?? state.requestPosts.reduce(
            (sum, post) => sum + post.totalPositions,
            0
          );
      })
      .addCase(fetchRequestPosts.rejected, (state, action) => {
        state.requestPostsLoading = false;
        state.requestPostsLoadingMore = false;
        if (!action.meta.arg.append) {
          state.requestPosts = [];
          state.requestPostsTotalCount = 0;
        }
      })
      .addCase(fetchRequestPostPositions.pending, (state, action) => {
        const postId = action.meta.arg.postId;
        state.requestPostPositionsLoadingByPostId[postId] = true;
      })
      .addCase(fetchRequestPostPositions.fulfilled, (state, action) => {
        const { postId, data } = action.payload;
        state.requestPostPositionsLoadingByPostId[postId] = false;
        state.requestPostPositionsByPostId[postId] = data.data;
        state.requestPostPositionsTotalByPostId[postId] = data.totalRecords;
        if (data.dates !== undefined) {
          state.requestPostPositionDatesByPostId[postId] = data.dates;
        }
      })
      .addCase(fetchRequestPostPositions.rejected, (state, action) => {
        const postId =
          (action.payload as { postId?: string } | undefined)?.postId ??
          action.meta.arg.postId;
        state.requestPostPositionsLoadingByPostId[postId] = false;
        state.requestPostPositionsByPostId[postId] = [];
        state.requestPostPositionsTotalByPostId[postId] = 0;
        state.requestPostPositionDatesByPostId[postId] = [];
      })
      // Upsert request
      .addCase(upsertRequestThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
        state.conflictMessage = null;
      })
      .addCase(upsertRequestThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.conflictMessage = null;
        // Update or add the request in the list
        const index = state.requests.findIndex(r => r.requestID === action.payload.requestID);
        if (index !== -1) {
          state.requests[index] = action.payload;
        } else {
          state.requests.push(action.payload);
        }
      })
      .addCase(upsertRequestThunk.rejected, (state, action) => {
        state.isLoading = false;
        const payload = action.payload;
        if (payload && typeof payload === 'object') {
          if ((payload as { kind?: string }).kind === 'oneTimeDateChangeConflict') {
            state.error = null;
            state.conflictMessage = null;
            return;
          }
          if ((payload as { status?: number }).status === 409) {
            state.conflictMessage =
              String((payload as { message?: string }).message ?? '').trim() ||
              'Failed to save request';
            state.error = null;
            return;
          }
        }
        state.conflictMessage = null;
        state.error = typeof payload === 'string' ? payload : 'Failed to save request';
      })
      // Fetch request by ID
      .addCase(fetchRequestById.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchRequestById.fulfilled, (state, action) => {
        state.isLoading = false;
        // Update or add the request in the list
        const index = state.requests.findIndex(r => r.requestID === action.payload.requestID);
        if (index !== -1) {
          state.requests[index] = action.payload;
        } else {
          state.requests.push(action.payload);
        }
      })
      .addCase(fetchRequestById.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchAssignableEmployeesByRequestThunk.pending, (state) => {
        state.assignableEmployeesLoading = true;
        state.assignableEmployeesError = null;
        state.assignableEmployeesByRequest = [];
      })
      .addCase(fetchAssignableEmployeesByRequestThunk.fulfilled, (state, action) => {
        state.assignableEmployeesLoading = false;
        state.assignableEmployeesByRequest = action.payload ?? [];
      })
      .addCase(fetchAssignableEmployeesByRequestThunk.rejected, (state, action) => {
        state.assignableEmployeesLoading = false;
        state.assignableEmployeesByRequest = [];
        state.assignableEmployeesError = (action.payload as string) ?? 'Failed to fetch assignable employees';
      })
      // Send vehicle approval email
      .addCase(sendVehicleApprovalEmailThunk.pending, (state) => {
        state.isSendingApprovalEmails = true;
        state.sendVehicleApprovalEmailsError = null;
      })
      .addCase(sendVehicleApprovalEmailThunk.fulfilled, (state) => {
        state.isSendingApprovalEmails = false;
        state.sendVehicleApprovalEmailsError = null;
      })
      .addCase(sendVehicleApprovalEmailThunk.rejected, (state, action) => {
        state.isSendingApprovalEmails = false;
        state.sendVehicleApprovalEmailsError = (action.payload as string) ?? 'Failed to send vehicle approval email';
      })
      // Delete request
      .addCase(deleteRequestThunk.fulfilled, (state, action) => {
        const id = action.payload;
        state.requests = state.requests.filter(r => r.requestID !== id);
        state.totalItems = Math.max(0, state.totalItems - 1);
      })
      // Clone request
      .addCase(cloneRequestThunk.fulfilled, (state, action) => {
        const cloned = action.payload;
        const exists = state.requests.some((r) => r.requestID === cloned.requestID);
        if (!exists) {
          state.requests.push(cloned);
          state.totalItems += 1;
        }
      });
  },
});

export const {
  clearError,
  clearConflictMessage,
  clearSendVehicleApprovalEmailsError,
  resetRequests,
  clearRequestPostPositionsForPost,
} = requestSlice.actions;
export default requestSlice.reducer;
