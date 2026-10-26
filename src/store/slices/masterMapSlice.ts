import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { MASTER_MAP } from '@/constants/strings';
import {
  mapEmployeesFromTree,
  movementByEmployeeId,
  treeFromLocationRequests,
  withMoving,
  type LocationEmployee,
  type MapEmployee,
} from '@/features/request-administration/pages/EmployeeLocation/locationRoster';
import { getRequesterRequestsWithLocations } from '@/services/requestService';
import { fetchRequesterWorkspaceList } from '@/services/requesterService';

import { getDepartmentLocation } from '@/services/departmentService';
import type { DepartmentLocationResponse } from '@/types/department';

interface MasterMapState {
  requesterCount: number;
  employees: MapEmployee[];
  departmentLocation: DepartmentLocationResponse | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: MasterMapState = {
  requesterCount: 0,
  employees: [],
  departmentLocation: null,
  isLoading: false,
  error: null,
};

async function employeesForRequester(
  requesterId: string,
  requesterName: string
): Promise<LocationEmployee[]> {
  try {
    const result = await getRequesterRequestsWithLocations(requesterId);
    return mapEmployeesFromTree(treeFromLocationRequests(result.data ?? [])).map((employee) => ({
      ...employee,
      requesterName,
    }));
  } catch {
    return [];
  }
}

export const fetchMasterMap = createAsyncThunk(
  'masterMap/fetch',
  async (_force: boolean | undefined, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { masterMap: MasterMapState };
      const currentDeptLoc = state.masterMap.departmentLocation;

      const [page, deptLocation] = await Promise.all([
        fetchRequesterWorkspaceList({
          isDailyWorkspace: true,
          loadAllPages: true,
          isShiftStartingWithin30Minutes: true,
        }),
        currentDeptLoc ? Promise.resolve(currentDeptLoc) : getDepartmentLocation().catch(() => null),
      ]);
      const summaryRows = page.data as import('@/types/requester').RequesterRequestSummaryDto[];
      const requesters = (summaryRows ?? []).flatMap((requester) => {
        const requesterId = requester.requesterId?.trim();
        if (!requesterId) return [];
        return [{ requesterId, requesterName: requester.requesterName?.trim() || requesterId }];
      });
      const employees = (
        await Promise.all(
          requesters.map((requester) =>
            employeesForRequester(requester.requesterId, requester.requesterName)
          )
        )
      ).flat();

      return {
        requesterCount: page.totalRecords || requesters.length,
        employees,
        departmentLocation: deptLocation ?? currentDeptLoc ?? null,
      };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : MASTER_MAP.MAP_ERROR);
    }
  },
  {
    condition: (_force, { getState }) => {
      const state = getState() as {
        auth?: { user?: { departmentID?: string } };
        departmentConfiguration?: {
          configByDepartmentId: Record<string, { enableEmployeeLocation?: boolean | null } | undefined>;
        };
      };
      const deptId = state.auth?.user?.departmentID;
      const deptConfig = deptId ? state.departmentConfiguration?.configByDepartmentId[deptId] : null;
      if (deptConfig && deptConfig.enableEmployeeLocation !== true) {
        return false;
      }
      return true;
    },
  }
);

const masterMapSlice = createSlice({
  name: 'masterMap',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchMasterMap.pending, (state, action) => {
        if (action.meta.arg) return;
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchMasterMap.fulfilled, (state, action) => {
        state.isLoading = false;
        state.requesterCount = action.payload.requesterCount;
        state.departmentLocation = action.payload.departmentLocation ?? state.departmentLocation;
        state.employees = withMoving(
          action.payload.employees,
          movementByEmployeeId(state.employees, action.payload.employees, !!action.meta.arg)
        );
        state.error = null;
      })
      .addCase(fetchMasterMap.rejected, (state, action) => {
        state.isLoading = false;
        state.error = (action.payload as string) || MASTER_MAP.MAP_ERROR;
      });
  },
});

export default masterMapSlice.reducer;
