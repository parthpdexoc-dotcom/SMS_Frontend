import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { EMPLOYEE_LOCATION } from '@/constants/strings';
import {
  employeesFromPostLocations,
  isEnroute,
  isSameSeat,
  latestPoint,
  locationMoved,
  mapEmployeesFromTree,
  movementByEmployeeId,
  toLocationPoints,
  treeFromLocationRequests,
  type LocationEmployee,
  type LocationRequestGroup,
} from '@/features/request-administration/pages/EmployeeLocation/locationRoster';
import { getPostEmployeesWithLocations } from '@/services/postService';
import { getCoordinatesByEmployeeId, getRequesterRequestsWithLocations } from '@/services/requestService';
import type { EmployeePostLocation } from '@/types/employeePostLocation';

type FetchRequesterArg = { requesterId: string; force?: boolean };
type FetchPostArg = { postId: string; requestId: string; force?: boolean };
type FetchEmployeeTrackArg = { employeeId: string; postPositionId: string; force?: boolean };

interface EmployeePostLocationState {
  requests: LocationRequestGroup[];
  employees: LocationEmployee[];
  postEmployees: LocationEmployee[];
  movingByEmployeeId: Record<string, boolean>;
  loadedRequesterId: string | null;
  loadedPostId: string | null;
  trackedEmployeeId: string | null;
  trackedPostPositionId: string | null;
  trackPoints: EmployeePostLocation[];
  isLoading: boolean;
  isPostLoading: boolean;
  isTrackLoading: boolean;
  error: string | null;
}

const initialState: EmployeePostLocationState = {
  requests: [],
  employees: [],
  postEmployees: [],
  movingByEmployeeId: {},
  loadedRequesterId: null,
  loadedPostId: null,
  trackedEmployeeId: null,
  trackedPostPositionId: null,
  trackPoints: [],
  isLoading: false,
  isPostLoading: false,
  isTrackLoading: false,
  error: null,
};

function fail(error: unknown) {
  if (typeof error === 'string' && error) return error;
  return error instanceof Error ? error.message : EMPLOYEE_LOCATION.MAP_ERROR;
}

function locationState(getState: () => unknown): EmployeePostLocationState {
  return (getState() as { employeePostLocation: EmployeePostLocationState }).employeePostLocation;
}

function applyEmployeePoints(
  employees: LocationEmployee[],
  employeeId: string,
  postPositionId: string,
  points: EmployeePostLocation[]
): LocationEmployee[] {
  return employees.map((employee) =>
    isSameSeat(employee, employeeId, postPositionId) ? { ...employee, points } : employee
  );
}

function applyPointsInRequests(
  requests: LocationRequestGroup[],
  employeeId: string,
  postPositionId: string,
  points: EmployeePostLocation[]
): LocationRequestGroup[] {
  return requests.map((request) => ({
    ...request,
    posts: request.posts.map((post) => ({
      ...post,
      employees: applyEmployeePoints(post.employees, employeeId, postPositionId, points),
    })),
  }));
}

function commitOverlay(
  state: EmployeePostLocationState,
  requests: LocationRequestGroup[],
  employees: LocationEmployee[],
  postEmployees: LocationEmployee[]
) {
  const employeeId = state.trackedEmployeeId;
  const postPositionId = state.trackedPostPositionId;
  const points = state.trackPoints;
  if (!employeeId || !postPositionId || points.length === 0) {
    state.requests = requests;
    state.employees = employees;
    state.postEmployees = postEmployees;
    return;
  }
  state.requests = applyPointsInRequests(requests, employeeId, postPositionId, points);
  state.employees = applyEmployeePoints(employees, employeeId, postPositionId, points);
  state.postEmployees = applyEmployeePoints(postEmployees, employeeId, postPositionId, points);
}

function findEmployee(
  employees: LocationEmployee[],
  employeeId: string,
  postPositionId: string
): LocationEmployee | undefined {
  return employees.find((employee) => isSameSeat(employee, employeeId, postPositionId));
}

function mergeMoving(
  state: EmployeePostLocationState,
  prevEmployees: LocationEmployee[],
  nextEmployees: LocationEmployee[],
  force: boolean
) {
  state.movingByEmployeeId = {
    ...state.movingByEmployeeId,
    ...movementByEmployeeId(prevEmployees, nextEmployees, force),
  };
}

export const fetchRequesterEmployeeLocations = createAsyncThunk(
  'employeePostLocation/fetchRequesterLocations',
  async ({ requesterId }: FetchRequesterArg, { rejectWithValue }) => {
    try {
      const id = requesterId.trim();
      if (!id) return rejectWithValue(EMPLOYEE_LOCATION.MAP_ERROR);
      const result = await getRequesterRequestsWithLocations(id);
      const requests = treeFromLocationRequests(result.data ?? []);
      return {
        requesterId: id,
        requests,
        employees: mapEmployeesFromTree(requests),
      };
    } catch (error) {
      return rejectWithValue(fail(error));
    }
  },
  {
    condition: ({ requesterId, force }, { getState }) => {
      const id = requesterId.trim();
      if (!id) return false;
      const state = locationState(getState);
      if (state.isLoading) return false;
      return force || state.loadedRequesterId !== id;
    },
  }
);

export const fetchPostEmployeesWithLocations = createAsyncThunk(
  'employeePostLocation/fetchPostEmployees',
  async ({ postId, requestId }: FetchPostArg, { rejectWithValue }) => {
    try {
      const id = postId.trim();
      if (!id) return rejectWithValue(EMPLOYEE_LOCATION.MAP_ERROR);
      const result = await getPostEmployeesWithLocations(id);
      return {
        postId: id,
        employees: employeesFromPostLocations(result.data ?? [], id, requestId),
      };
    } catch (error) {
      return rejectWithValue(fail(error));
    }
  },
  {
    condition: ({ postId, force }, { getState }) => {
      const id = postId.trim();
      if (!id) return false;
      const state = locationState(getState);
      if (state.isPostLoading && state.loadedPostId === id) return false;
      return force || state.loadedPostId !== id;
    },
  }
);

export const fetchEmployeeCoordinates = createAsyncThunk(
  'employeePostLocation/fetchEmployeeCoordinates',
  async ({ employeeId, postPositionId }: FetchEmployeeTrackArg, { rejectWithValue }) => {
    try {
      const id = employeeId.trim();
      const positionId = postPositionId.trim();
      if (!id || !positionId) return rejectWithValue(EMPLOYEE_LOCATION.MAP_ERROR);
      const rows = await getCoordinatesByEmployeeId(id, positionId);
      return {
        employeeId: id,
        postPositionId: positionId,
        points: toLocationPoints(rows),
      };
    } catch (error) {
      return rejectWithValue(fail(error));
    }
  },
  {
    condition: ({ employeeId, postPositionId, force }, { getState }) => {
      const id = employeeId.trim();
      const positionId = postPositionId.trim();
      if (!id || !positionId) return false;
      const state = locationState(getState);
      if (
        state.isTrackLoading &&
        state.trackedEmployeeId === id &&
        state.trackedPostPositionId === positionId
      ) {
        return false;
      }
      return force || state.trackedEmployeeId !== id || state.trackedPostPositionId !== positionId;
    },
  }
);

const employeePostLocationSlice = createSlice({
  name: 'employeePostLocation',
  initialState,
  reducers: {
    clearEmployeePostLocations: () => initialState,
    clearPostEmployees: (state) => {
      state.postEmployees = [];
      state.loadedPostId = null;
      state.isPostLoading = false;
    },
    clearEmployeeTrack: (state) => {
      state.trackedEmployeeId = null;
      state.trackedPostPositionId = null;
      state.trackPoints = [];
      state.isTrackLoading = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRequesterEmployeeLocations.pending, (state, action) => {
        state.isLoading = true;
        state.error = null;
        if (!action.meta.arg.force) {
          state.requests = [];
          state.employees = [];
          state.movingByEmployeeId = {};
        }
      })
      .addCase(fetchRequesterEmployeeLocations.fulfilled, (state, action) => {
        const { requesterId, requests, employees: nextEmployees } = action.payload;
        mergeMoving(state, state.employees, nextEmployees, !!action.meta.arg.force);
        state.isLoading = false;
        state.error = null;
        state.loadedRequesterId = requesterId;
        commitOverlay(state, requests, nextEmployees, state.postEmployees);
      })
      .addCase(fetchRequesterEmployeeLocations.rejected, (state, action) => {
        state.isLoading = false;
        state.error = fail(action.payload);
        if (!action.meta.arg.force) {
          state.requests = [];
          state.employees = [];
          state.movingByEmployeeId = {};
          state.loadedRequesterId = null;
        }
      })
      .addCase(fetchPostEmployeesWithLocations.pending, (state, action) => {
        state.isPostLoading = true;
        state.error = null;
        if (!action.meta.arg.force) {
          state.postEmployees = [];
        }
      })
      .addCase(fetchPostEmployeesWithLocations.fulfilled, (state, action) => {
        const { postId, employees: nextEmployees } = action.payload;
        mergeMoving(state, state.postEmployees, nextEmployees, !!action.meta.arg.force);
        state.isPostLoading = false;
        state.error = null;
        state.loadedPostId = postId;
        commitOverlay(state, state.requests, state.employees, nextEmployees);
      })
      .addCase(fetchPostEmployeesWithLocations.rejected, (state, action) => {
        state.isPostLoading = false;
        state.error = fail(action.payload);
        if (!action.meta.arg.force) {
          state.postEmployees = [];
          state.loadedPostId = null;
        }
      })
      .addCase(fetchEmployeeCoordinates.pending, (state, action) => {
        state.isTrackLoading = true;
        state.error = null;
        if (!action.meta.arg.force) {
          state.trackedEmployeeId = action.meta.arg.employeeId.trim();
          state.trackedPostPositionId = action.meta.arg.postPositionId.trim();
          state.trackPoints = [];
        }
      })
      .addCase(fetchEmployeeCoordinates.fulfilled, (state, action) => {
        const { employeeId, postPositionId, points } = action.payload;
        const prev =
          findEmployee(state.postEmployees, employeeId, postPositionId) ??
          findEmployee(state.employees, employeeId, postPositionId);
        state.movingByEmployeeId = {
          ...state.movingByEmployeeId,
          [employeeId]: action.meta.arg.force
            ? locationMoved(latestPoint(prev?.points ?? state.trackPoints), latestPoint(points))
            : isEnroute(points),
        };
        state.isTrackLoading = false;
        state.error = null;
        state.trackedEmployeeId = employeeId;
        state.trackedPostPositionId = postPositionId;
        state.trackPoints = points;
        commitOverlay(state, state.requests, state.employees, state.postEmployees);
      })
      .addCase(fetchEmployeeCoordinates.rejected, (state, action) => {
        state.isTrackLoading = false;
        state.error = fail(action.payload);
      });
  },
});

export const { clearEmployeePostLocations, clearPostEmployees, clearEmployeeTrack } =
  employeePostLocationSlice.actions;
export default employeePostLocationSlice.reducer;
