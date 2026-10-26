/**
 * Employee Redux Slice
 */
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants/tablePagination';
import { getEmployees, getEmployeeOptions, getAllEmployees, getEmployeesByRankFilter, searchEmployees, upsertEmployee, deleteEmployee, getEmployeeById, getEmployeeByNumber, getAvailableManagers, getAvailableRequesterEmployees, patchEmployee } from '@/services/employeeService';
import {
  EmployeeResponse,
  EmployeeByNumberLookup,
  CreateEmployeeRequest,
  UpdateEmployeeRequest,
  EmployeeListParams,
  JsonPatchReplaceOperation,
} from '@/types/employee';
import type { RootState } from '@/store';
import type { SelectOptionDto } from '@/types/common';
import { showToast } from './toastSlice';
import { formatLastNameCommaFirstName } from '@/utils';
import { shouldPersistGridPageSize } from '@/constants/pagination';

interface EmployeeState {
  employees: EmployeeResponse[];
  availableManagers: EmployeeResponse[];
  isLoadingAvailableManagers: boolean;
  availableRequesterEmployees: EmployeeResponse[];
  isLoadingAvailableRequesterEmployees: boolean;
  employeeOptions: SelectOptionDto[];
  isLoadingEmployeeOptions: boolean;
  pendingEmployeeOptionsRequestId: string | null;
  selectedEmployee: EmployeeResponse | null;
  pendingFetchEmployeeId: string | null;
  /** Last employee resolved by badge/employee number (e.g. split job lookup). */
  employeeByNumberLookup: EmployeeByNumberLookup | null;
  pendingEmployeeNumber: string | null;
  isLoadingEmployeeByNumber: boolean;
  isLoading: boolean;
  error: string | null;
  totalItems: number;
  currentPage: number;
  pageSize: number;
}

const initialState: EmployeeState = {
  employees: [],
  availableManagers: [],
  isLoadingAvailableManagers: false,
  availableRequesterEmployees: [],
  isLoadingAvailableRequesterEmployees: false,
  employeeOptions: [],
  isLoadingEmployeeOptions: false,
  pendingEmployeeOptionsRequestId: null,
  selectedEmployee: null,
  pendingFetchEmployeeId: null,
  employeeByNumberLookup: null,
  pendingEmployeeNumber: null,
  isLoadingEmployeeByNumber: false,
  isLoading: false,
  error: null,
  totalItems: 0,
  currentPage: 1,
  pageSize: DEFAULT_TABLE_PAGE_SIZE,
};

// Fields that can be updated via PATCH (camelCase; do not include employeeID - ID comes from URL)
const PATCHABLE_FIELDS: (keyof EmployeeResponse)[] = [
  'departmentID',
  'employeeTypeID',
  'statusID',
  'badgeNumber',
  'employeeNumber',
  'firstName',
  'lastName',
  'username',
  'password',
  'primaryPhone',
  'secondaryPhone',
  'offDutyCallBackPhoneNumber',
  'primaryEmail',
  'secondaryEmail',
  'offDutyCallBackEmail',
  'isSubsidizedVehicle',
  'smsTelephoneNumber',
  'hasSmsConsent',
  'notifyWhenJobsPosted',
  'notifyJobStartingIn24Hours',
  'notifyJobStartingIn1Hour',
  'hourlySalary',
  'hrCostCenterCode',
  'divisionID',
  'employeeDepartmentDefinedField1',
  'employeeDepartmentDefinedField2',
  'employeeDepartmentDefinedField3',
  'employeeDepartmentDefinedField4',
  'isApproved',
];

/** Always included in PATCH when present in updatedValues (even if unchanged). */
const FORCE_PATCH_FIELDS = new Set<keyof EmployeeResponse>([
  'departmentID',
  'notifyWhenJobsPosted',
  'notifyJobStartingIn24Hours',
  'notifyJobStartingIn1Hour',
]);

/**
 * Included in PATCH whenever the form currently has a value, even if it matches the saved employee.
 * Empty / unchecked values are still sent when they differ, so a cleared number or consent can be saved.
 */
const includeWhenValuePresent = (key: keyof EmployeeResponse, value: unknown): boolean => {
  if (key === 'smsTelephoneNumber') {
    return typeof value === 'string' && value.trim() !== '';
  }
  if (key === 'hasSmsConsent') {
    return value === true;
  }
  return false;
};

const arraysEqual = <T,>(a: T[] | null | undefined, b: T[] | null | undefined): boolean => {
  if (a === b) return true;
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

const valuesEqual = (a: unknown, b: unknown): boolean => {
  if (Array.isArray(a) || Array.isArray(b)) {
    return arraysEqual(
      (a as unknown[] | null | undefined) ?? null,
      (b as unknown[] | null | undefined) ?? null
    );
  }
  return a === b;
};

/**
 * Given an object of changed properties (camelCase keys), returns a JSON Patch
 * array of replace operations for PATCH /api/Employee/{id}.
 * Paths are camelCase with leading slash (e.g. /firstName, /primaryEmail).
 */
export function changedPropsToJsonPatch(
  changed: Record<string, string | number | boolean | string[] | null | undefined>
): JsonPatchReplaceOperation[] {
  const ops: JsonPatchReplaceOperation[] = [];
  for (const key of Object.keys(changed)) {
    if (key === 'employeeID') continue; // ID comes from URL
    const value = changed[key];
    if (value === undefined) continue;
    ops.push({
      op: 'replace',
      path: `/${key}`,
      value: value as string | number | boolean | string[] | null,
    });
  }
  return ops;
}

/**
 * Build JSON Patch document (replace ops only) from original vs updated employee values.
 * Only includes fields that are present in updatedValues and different from original.
 */
function buildJsonPatchFromDiff(
  original: EmployeeResponse,
  updatedValues: Partial<EmployeeResponse>
): JsonPatchReplaceOperation[] {
  const changed: Record<string, string | number | boolean | string[] | null | undefined> = {};
  for (const key of PATCHABLE_FIELDS) {
    if (!(key in updatedValues)) continue;
    const newValue = updatedValues[key];
    const oldValue = original[key];
    const forceInclude = FORCE_PATCH_FIELDS.has(key) || includeWhenValuePresent(key, newValue);
    if (forceInclude || !valuesEqual(oldValue, newValue)) {
      changed[key] = newValue as string | number | boolean | string[] | null | undefined;
    }
  }
  return changedPropsToJsonPatch(changed);
}

// Transform frontend payload to match backend JSON naming policy (camelCase)
// Backend uses JsonNamingPolicy.CamelCase, so all properties should be in camelCase
const transformEmployeePayload = (data: CreateEmployeeRequest | UpdateEmployeeRequest) => {
  // Ensure employeeTypeID is properly formatted as a valid GUID string
  // It's required by backend validation - must be a non-empty string
  let employeeTypeID: string | undefined = undefined;
  if (data.employeeTypeID) {
    if (typeof data.employeeTypeID === 'string') {
      const trimmed = data.employeeTypeID.trim();
      if (trimmed !== '') {
        employeeTypeID = trimmed;
      }
    }
  }

  const basePayload: any = {
    employeeID: 'employeeID' in data && data.employeeID ? data.employeeID : undefined,
    departmentID: data.departmentID,
    // Backend expects employeeTypeID in camelCase (required field for validation)
    // Must be a valid GUID string - backend will validate it exists
    employeeTypeID: employeeTypeID,
    statusID: data.statusID || undefined,
    badgeNumber: data.badgeNumber,
    employeeNumber: data.employeeNumber,
    firstName: data.firstName,
    lastName: data.lastName,
    username: data.username,
    primaryPhone: data.primaryPhone,
    secondaryPhone: data.secondaryPhone,
    offDutyCallBackPhoneNumber: data.offDutyCallBackPhoneNumber,
    primaryEmail: data.primaryEmail,
    secondaryEmail: data.secondaryEmail,
    offDutyCallBackEmail: data.offDutyCallBackEmail,
    isSubsidizedVehicle: 'isSubsidizedVehicle' in data ? data.isSubsidizedVehicle : undefined,
    smsTelephoneNumber:
      typeof data.smsTelephoneNumber === 'string' && data.smsTelephoneNumber.trim() !== ''
        ? data.smsTelephoneNumber.trim()
        : undefined,
    hasSmsConsent: data.hasSmsConsent === true ? true : undefined,
    notifyWhenJobsPosted: data.notifyWhenJobsPosted ?? true,
    notifyJobStartingIn24Hours: data.notifyJobStartingIn24Hours ?? true,
    notifyJobStartingIn1Hour: data.notifyJobStartingIn1Hour ?? true,
    hourlySalary: data.hourlySalary ?? null,
    hrCostCenterCode: data.hrCostCenterCode,
    divisionID: data.divisionID,
    employeeDepartmentDefinedField1: data.employeeDepartmentDefinedField1,
    employeeDepartmentDefinedField2: data.employeeDepartmentDefinedField2,
    employeeDepartmentDefinedField3: data.employeeDepartmentDefinedField3,
    employeeDepartmentDefinedField4: data.employeeDepartmentDefinedField4,
    // IsApproved flag (camelCase maps to backend IsApproved)
    isApproved: 'isApproved' in data ? data.isApproved : undefined,
  };

  // Add password for creates and updates when provided
  if ('password' in data && data.password && data.password.trim() !== '') {
    basePayload.password = data.password;
  }

  // Remove undefined values to avoid sending them
  // CRITICAL: employeeTypeID must be included if it has a value (backend validation requires it)
  Object.keys(basePayload).forEach(key => {
    if (basePayload[key] === undefined) {
      delete basePayload[key];
    }
  });

  // Final check: ensure employeeTypeID is included if it was provided
  if (employeeTypeID && !basePayload.employeeTypeID) {
    basePayload.employeeTypeID = employeeTypeID;
  }

  return basePayload;
};

// Async thunks
// Base list (no server-side search filters)
export const fetchEmployees = createAsyncThunk(
  'employee/fetchEmployees',
  async (params: EmployeeListParams | undefined, { rejectWithValue, dispatch }) => {
    try {
      const result = await getEmployees(params);
      return { data: result.data, totalRecords: result.totalRecords, pagination: params };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch employees';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

// Employee List page source endpoint: /Employee/getallemployees
export const fetchAllEmployees = createAsyncThunk(
  'employee/fetchAllEmployees',
  async (
    { params, isactive }: { params?: EmployeeListParams; isactive?: boolean },
    { rejectWithValue, dispatch }
  ) => {
    try {
      const result = await getAllEmployees(params, isactive);
      return { data: result.data, totalRecords: result.totalRecords, pagination: params, isactive };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch employees';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

// Employee Jobs page source endpoint: /Employee/getallemployeesbyrankfilter
export const fetchEmployeesByRankFilter = createAsyncThunk(
  'employee/fetchEmployeesByRankFilter',
  async (
    { params, isactive }: { params?: EmployeeListParams; isactive?: boolean },
    { rejectWithValue, dispatch }
  ) => {
    try {
      const result = await getEmployeesByRankFilter(params, isactive);
      return { data: result.data, totalRecords: result.totalRecords, pagination: params, isactive };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch employee jobs employees';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

// Server-side search / filtered list
export const searchEmployeesThunk = createAsyncThunk(
  'employee/searchEmployees',
  async (
    { params, isactive }: { params?: EmployeeListParams; isactive?: boolean },
    { rejectWithValue, dispatch }
  ) => {
    try {
      const result = await searchEmployees(params, isactive);
      return { data: result.data, totalRecords: result.totalRecords, pagination: params, isactive };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to search employees';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchEmployeeByIdThunk = createAsyncThunk(
  'employee/fetchEmployeeById',
  async (id: string, { rejectWithValue, dispatch }) => {
    try {
      const data = await getEmployeeById(id);
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch employee';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  },
  {
    // Only skip duplicate dispatches while this id is already loading (e.g. StrictMode).
    // Do not skip when selectedEmployee matches — user may re-enter the route and need a fresh GET.
    condition: (id, { getState }) =>
      (getState() as RootState).employee.pendingFetchEmployeeId !== id,
  }
);

function mapEmployeeToByNumberLookup(
  employee: EmployeeResponse,
  employeeNumber: string
): EmployeeByNumberLookup {
  const normalized = employeeNumber.trim();
  return {
    employeeID: employee.employeeID,
    employeeName:
      formatLastNameCommaFirstName(employee.firstName, employee.lastName) ||
      employee.username ||
      employee.badgeNumber ||
      normalized,
  };
}

/** Resolves an employee by SMS employee number (split job, etc.). */
export const fetchEmployeeByNumberThunk = createAsyncThunk<
  EmployeeByNumberLookup,
  string,
  { rejectValue: string }
>(
  'employee/fetchEmployeeByNumber',
  async (employeeNumber, { rejectWithValue, dispatch }) => {
    const normalized = employeeNumber.trim();
    try {
      const employee = await getEmployeeByNumber(normalized);
      return mapEmployeeToByNumberLookup(employee, normalized);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Employee not found';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  },
  {
    condition: (employeeNumber, { getState }) => {
      const normalized = employeeNumber.trim();
      if (!normalized) return false;
      return (getState() as RootState).employee.pendingEmployeeNumber !== normalized;
    },
  }
);

/**
 * PATCH update for an existing employee using JSON Patch (RFC 6902).
 * Builds a replace-only patch document from the diff (original vs updatedValues)
 * and sends it to PATCH /api/Employee/{id} with Content-Type: application/json-patch+json.
 */
export const patchEmployeeThunk = createAsyncThunk(
  'employee/patchEmployee',
  async (
    args: { original: EmployeeResponse; updatedValues: Partial<EmployeeResponse> },
    { rejectWithValue, dispatch }
  ) => {
    const { original, updatedValues } = args;

    try {
      const patchDoc = buildJsonPatchFromDiff(original, updatedValues);

      if (patchDoc.length === 0) {
        // No employee fields changed; simply return original without showing a toast.
        // (Skills or other related data may still be updated elsewhere.)
        return original;
      }

      const data = await patchEmployee(original.employeeID, patchDoc);
      dispatch(showToast('Employee updated successfully.', 'success'));
      return data;
    } catch (error) {
      console.error('Error in patchEmployeeThunk:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update employee';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const upsertEmployeeThunk = createAsyncThunk(
  'employee/upsertEmployee',
  async (employeeData: CreateEmployeeRequest | UpdateEmployeeRequest, { rejectWithValue, dispatch }) => {
    try {
      const transformedPayload = transformEmployeePayload(employeeData);
      console.log('Sending employee payload:', transformedPayload);
      console.log('employeeTypeID value:', transformedPayload.employeeTypeID, 'type:', typeof transformedPayload.employeeTypeID);
      const data = await upsertEmployee(transformedPayload);
      const isUpdate = 'employeeID' in employeeData && employeeData.employeeID;
      dispatch(showToast(isUpdate ? 'Employee updated successfully.' : 'Employee created successfully.', 'success'));
      return data;
    } catch (error) {
      console.error('Error in upsertEmployeeThunk:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save employee';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

export const removeEmployee = createAsyncThunk<
  string,
  { id: string; name: string }
>(
  'employee/removeEmployee',
  async ({ id, name }, { rejectWithValue, dispatch }) => {
    try {
      await deleteEmployee(id);
      dispatch(showToast('Employee deleted successfully.', 'success'));
      return id;
    } catch (error) {
      const rawMessage =
        error instanceof Error ? error.message : 'Failed to delete employee';
      const errorMessage = rawMessage.replace('{0}', name);
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);
export const fetchAvailableManagers = createAsyncThunk<
  EmployeeResponse[],
  string
>(
  'employee/fetchAvailableManagers',
  async (requesterId) => {
    try {
      return await getAvailableManagers(requesterId);
    } catch {
      // Silent fail for dropdown
      return [];
    }
  }
);

export const fetchAvailableRequesterEmployees = createAsyncThunk<
  EmployeeResponse[],
  string
>(
  'employee/fetchAvailableRequesterEmployees',
  async (requesterManagerId) => {
    try {
      return await getAvailableRequesterEmployees(requesterManagerId);
    } catch {
      // Silent fail for dropdown
      return [];
    }
  }
);

export const fetchEmployeeOptionsThunk = createAsyncThunk<
  SelectOptionDto[],
  { searchTerm?: string }
>(
  'employee/fetchEmployeeOptions',
  async ({ searchTerm }, { rejectWithValue, dispatch }) => {
    try {
      return await getEmployeeOptions(searchTerm);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch employee options';
      dispatch(showToast(errorMessage, 'error'));
      return rejectWithValue(errorMessage);
    }
  }
);

const employeeSlice = createSlice({
  name: 'employee',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearSelectedEmployee: (state) => {
      state.selectedEmployee = null;
      state.pendingFetchEmployeeId = null;
    },
    clearEmployeeByNumberLookup: (state) => {
      state.employeeByNumberLookup = null;
      state.pendingEmployeeNumber = null;
    },
    setPagination: (state, action) => {
      state.currentPage = action.payload.page || state.currentPage;
      state.pageSize = action.payload.pageSize || state.pageSize;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Employees
      .addCase(fetchEmployees.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchEmployees.fulfilled, (state, action) => {
        state.isLoading = false;
        state.employees = action.payload.data;
        if (action.payload.pagination) {
          if (action.payload.pagination.page !== undefined) {
            state.currentPage = action.payload.pagination.page;
          }
          if (shouldPersistGridPageSize(action.payload.pagination.pageSize)) {
            state.pageSize = action.payload.pagination.pageSize as number;
          }
        }
        // Use totalRecords from API response for proper pagination
        state.totalItems = action.payload.totalRecords || 0;
        state.error = null;
      })
      .addCase(fetchEmployees.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Fetch All Employees (getallemployees)
      .addCase(fetchAllEmployees.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchAllEmployees.fulfilled, (state, action) => {
        state.isLoading = false;
        state.employees = action.payload.data;
        if (action.payload.pagination) {
          if (action.payload.pagination.page !== undefined) {
            state.currentPage = action.payload.pagination.page;
          }
          if (shouldPersistGridPageSize(action.payload.pagination.pageSize)) {
            state.pageSize = action.payload.pagination.pageSize as number;
          }
        }
        state.totalItems = action.payload.totalRecords || 0;
        state.error = null;
      })
      .addCase(fetchAllEmployees.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Fetch Employee Jobs Employees (getallemployeesbyrankfilter)
      .addCase(fetchEmployeesByRankFilter.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchEmployeesByRankFilter.fulfilled, (state, action) => {
        state.isLoading = false;
        state.employees = action.payload.data;
        if (action.payload.pagination) {
          if (action.payload.pagination.page !== undefined) {
            state.currentPage = action.payload.pagination.page;
          }
          if (shouldPersistGridPageSize(action.payload.pagination.pageSize)) {
            state.pageSize = action.payload.pagination.pageSize as number;
          }
        }
        state.totalItems = action.payload.totalRecords || 0;
        state.error = null;
      })
      .addCase(fetchEmployeesByRankFilter.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Search Employees
      .addCase(searchEmployeesThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(searchEmployeesThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.employees = action.payload.data;
        if (action.payload.pagination) {
          if (action.payload.pagination.page !== undefined) {
            state.currentPage = action.payload.pagination.page;
          }
          if (shouldPersistGridPageSize(action.payload.pagination.pageSize)) {
            state.pageSize = action.payload.pagination.pageSize as number;
          }
        }
        state.totalItems = action.payload.totalRecords || 0;
        state.error = null;
      })
      .addCase(searchEmployeesThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Fetch Employee By ID
      .addCase(fetchEmployeeByIdThunk.pending, (state, action) => {
        state.isLoading = true;
        state.error = null;
        state.pendingFetchEmployeeId = action.meta.arg;
      })
      .addCase(fetchEmployeeByIdThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.pendingFetchEmployeeId = null;
        state.selectedEmployee = action.payload;
        state.error = null;
      })
      .addCase(fetchEmployeeByIdThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.pendingFetchEmployeeId = null;
        state.error = action.payload as string;
      })
      // Fetch Employee By Number
      .addCase(fetchEmployeeByNumberThunk.pending, (state, action) => {
        state.isLoadingEmployeeByNumber = true;
        state.error = null;
        state.pendingEmployeeNumber = action.meta.arg.trim();
      })
      .addCase(fetchEmployeeByNumberThunk.fulfilled, (state, action) => {
        state.isLoadingEmployeeByNumber = false;
        state.pendingEmployeeNumber = null;
        state.employeeByNumberLookup = action.payload;
        state.error = null;
      })
      .addCase(fetchEmployeeByNumberThunk.rejected, (state, action) => {
        state.isLoadingEmployeeByNumber = false;
        state.pendingEmployeeNumber = null;
        state.employeeByNumberLookup = null;
        state.error = action.payload as string;
      })
      // Patch Employee (partial update)
      .addCase(patchEmployeeThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(patchEmployeeThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        const updated = action.payload as EmployeeResponse;
        const index = state.employees.findIndex(e => e.employeeID === updated.employeeID);
        if (index >= 0) {
          // Merge to preserve read-only fields like employeeType/status text
          state.employees[index] = { ...state.employees[index], ...updated };
        } else {
          state.employees.push(updated);
        }
        if (state.selectedEmployee?.employeeID === updated.employeeID) {
          state.selectedEmployee = { ...state.selectedEmployee, ...updated };
        }
        state.error = null;
      })
      .addCase(patchEmployeeThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Upsert Employee
      .addCase(upsertEmployeeThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(upsertEmployeeThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.employees.findIndex(e => e.employeeID === action.payload.employeeID);
        if (index >= 0) {
          // Merge the updated data with existing data to preserve fields like employeeType, status, etc.
          state.employees[index] = { ...state.employees[index], ...action.payload };
        } else {
          state.employees.push(action.payload);
        }
        // Also update selected if it matches
        if (state.selectedEmployee?.employeeID === action.payload.employeeID) {
          state.selectedEmployee = action.payload;
        }
        state.error = null;
      })
      .addCase(upsertEmployeeThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Delete Employee
      .addCase(removeEmployee.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(removeEmployee.fulfilled, (state, action) => {
        state.isLoading = false;
        state.employees = state.employees.filter(e => e.employeeID !== action.payload);
        state.error = null;
      })
      .addCase(removeEmployee.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchAvailableManagers.pending, (state) => {
        state.isLoadingAvailableManagers = true;
      })
      .addCase(fetchAvailableManagers.fulfilled, (state, action) => {
        state.isLoadingAvailableManagers = false;
        state.availableManagers = action.payload;
      })
      .addCase(fetchAvailableManagers.rejected, (state) => {
        state.isLoadingAvailableManagers = false;
        state.availableManagers = []; // keep dropdown empty
      })
      .addCase(fetchAvailableRequesterEmployees.pending, (state) => {
        state.isLoadingAvailableRequesterEmployees = true;
      })
      .addCase(fetchAvailableRequesterEmployees.fulfilled, (state, action) => {
        state.isLoadingAvailableRequesterEmployees = false;
        state.availableRequesterEmployees = action.payload;
      })
      .addCase(fetchAvailableRequesterEmployees.rejected, (state) => {
        state.isLoadingAvailableRequesterEmployees = false;
        state.availableRequesterEmployees = []; // keep dropdown empty
      })
      .addCase(fetchEmployeeOptionsThunk.pending, (state, action) => {
        state.isLoadingEmployeeOptions = true;
        state.pendingEmployeeOptionsRequestId = action.meta.requestId;
      })
      .addCase(fetchEmployeeOptionsThunk.fulfilled, (state, action) => {
        if (state.pendingEmployeeOptionsRequestId !== action.meta.requestId) return;
        state.isLoadingEmployeeOptions = false;
        state.pendingEmployeeOptionsRequestId = null;
        state.employeeOptions = action.payload;
      })
      .addCase(fetchEmployeeOptionsThunk.rejected, (state, action) => {
        if (state.pendingEmployeeOptionsRequestId !== action.meta.requestId) return;
        state.isLoadingEmployeeOptions = false;
        state.pendingEmployeeOptionsRequestId = null;
        state.employeeOptions = [];
        state.error = action.payload as string;
      });
  },
});

export const { clearError, clearSelectedEmployee, clearEmployeeByNumberLookup, setPagination } =
  employeeSlice.actions;
export default employeeSlice.reducer;

