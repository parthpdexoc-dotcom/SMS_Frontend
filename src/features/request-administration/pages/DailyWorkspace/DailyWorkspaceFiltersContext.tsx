import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Outlet, useSearchParams } from 'react-router-dom';
import {
  buildDailyWorkspaceFilterDefaults,
  DEFAULT_DAILY_WORKSPACE_REQUEST_TYPES,
  DEFAULT_REQUESTER_WITH_REQUESTS_STATUSES,
  isDailyWorkspaceRequestType,
  readDailyWorkspaceRequestTypes,
} from '@/constants/dailyWorkspaceFilters';
import { RequestStatus, RequestTypes } from '@/types/request';

const STORAGE_KEY = 'sems:daily-workspace:shared-filters:v2';

export interface DailyWorkspaceSharedFilters {
  startDate: string;
  endDate: string;
  requestStatuses: RequestStatus[];
  requestTypes: RequestTypes[];
}

export type DailyWorkspaceApiFilterParams = {
  startDate?: string;
  endDate?: string;
  requestStatuses?: number[];
  requestTypes?: number[];
};

interface DailyWorkspaceFiltersContextValue extends DailyWorkspaceSharedFilters {
  setStartDate: (value: string) => void;
  setEndDate: (value: string) => void;
  toggleStatus: (status: RequestStatus) => void;
  toggleType: (type: RequestTypes) => void;
  /** List page clear — dates empty, status/type chips reset to defaults. */
  clearFiltersToDefaults: () => void;
  /** Workspace filter icon — dates empty, all chips off. */
  clearAllFilters: () => void;
  apiFilterParams: DailyWorkspaceApiFilterParams;
  activeFilterCount: number;
  buildOpenWorkspaceQueryString: (requesterName?: string) => string;
}

const DailyWorkspaceFiltersContext = createContext<DailyWorkspaceFiltersContextValue | null>(
  null
);

function defaultFilters(): DailyWorkspaceSharedFilters {
  return buildDailyWorkspaceFilterDefaults();
}

function resolveStoredDates(
  startDate: unknown,
  endDate: unknown,
  defaults: DailyWorkspaceSharedFilters
): Pick<DailyWorkspaceSharedFilters, 'startDate' | 'endDate'> {
  return {
    startDate: typeof startDate === 'string' ? startDate : defaults.startDate,
    endDate: typeof endDate === 'string' ? endDate : defaults.endDate,
  };
}

function parseFilterEnumList(raw: string | null): number[] | null {
  if (!raw?.trim()) return null;
  const values = raw
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isFinite(n));
  return values.length > 0 ? values : null;
}

function readFiltersFromSearchParams(
  searchParams: URLSearchParams
): DailyWorkspaceSharedFilters | null {
  const hasUrlFilters =
    Boolean(searchParams.get('startDate')?.trim()) ||
    Boolean(searchParams.get('endDate')?.trim()) ||
    Boolean(searchParams.get('requestStatuses')?.trim()) ||
    Boolean(searchParams.get('requestTypes')?.trim());

  if (!hasUrlFilters) return null;

  const defaults = buildDailyWorkspaceFilterDefaults();
  const urlRequestTypes = parseFilterEnumList(searchParams.get('requestTypes'));

  return {
    startDate: searchParams.get('startDate')?.trim() ?? defaults.startDate,
    endDate: searchParams.get('endDate')?.trim() ?? defaults.endDate,
    requestStatuses:
      (parseFilterEnumList(searchParams.get('requestStatuses')) as RequestStatus[] | null) ??
      [...DEFAULT_REQUESTER_WITH_REQUESTS_STATUSES],
    requestTypes:
      urlRequestTypes !== null
        ? readDailyWorkspaceRequestTypes(urlRequestTypes)
        : [...DEFAULT_DAILY_WORKSPACE_REQUEST_TYPES],
  };
}

function readStoredFilters(): DailyWorkspaceSharedFilters | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DailyWorkspaceSharedFilters>;
    const defaults = buildDailyWorkspaceFilterDefaults();
    return {
      ...resolveStoredDates(parsed.startDate, parsed.endDate, defaults),
      requestStatuses: Array.isArray(parsed.requestStatuses)
        ? (parsed.requestStatuses as RequestStatus[])
        : [...DEFAULT_REQUESTER_WITH_REQUESTS_STATUSES],
      requestTypes: readDailyWorkspaceRequestTypes(parsed.requestTypes),
    };
  } catch {
    return null;
  }
}

function writeStoredFilters(filters: DailyWorkspaceSharedFilters): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // ignore quota / private mode
  }
}

function resolveInitialFilters(searchParams: URLSearchParams): DailyWorkspaceSharedFilters {
  return readFiltersFromSearchParams(searchParams) ?? readStoredFilters() ?? defaultFilters();
}

export const DailyWorkspaceFiltersProvider: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState<DailyWorkspaceSharedFilters>(() =>
    resolveInitialFilters(searchParams)
  );

  useEffect(() => {
    writeStoredFilters(filters);
  }, [filters]);

  const setStartDate = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, startDate: value }));
  }, []);

  const setEndDate = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, endDate: value }));
  }, []);

  const toggleStatus = useCallback((status: RequestStatus) => {
    setFilters((prev) => ({
      ...prev,
      requestStatuses: prev.requestStatuses.includes(status)
        ? prev.requestStatuses.filter((s) => s !== status)
        : [...prev.requestStatuses, status],
    }));
  }, []);

  const toggleType = useCallback((type: RequestTypes) => {
    if (!isDailyWorkspaceRequestType(type)) return;

    setFilters((prev) => ({
      ...prev,
      requestTypes: prev.requestTypes.includes(type)
        ? prev.requestTypes.filter((t) => t !== type)
        : [...prev.requestTypes, type],
    }));
  }, []);

  const clearFiltersToDefaults = useCallback(() => {
    setFilters(defaultFilters());
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilters({
      startDate: '',
      endDate: '',
      requestStatuses: [],
      requestTypes: [],
    });
  }, []);

  const apiFilterParams = useMemo((): DailyWorkspaceApiFilterParams => {
    const { startDate, endDate, requestStatuses, requestTypes } = filters;
    return {
      ...(startDate.trim() ? { startDate: startDate.trim() } : {}),
      ...(endDate.trim() ? { endDate: endDate.trim() } : {}),
      ...(requestStatuses.length > 0
        ? { requestStatuses: requestStatuses.map((status) => Number(status)) }
        : {}),
      ...(requestTypes.length > 0
        ? { requestTypes: requestTypes.map((type) => Number(type)) }
        : {}),
    };
    // Recompute only when filter inputs change — keeps API effect deps stable.
  }, [
    filters.startDate,
    filters.endDate,
    filters.requestStatuses,
    filters.requestTypes,
  ]);

  const activeFilterCount = useMemo(
    () =>
      (filters.startDate ? 1 : 0) +
      (filters.endDate ? 1 : 0) +
      filters.requestTypes.length +
      filters.requestStatuses.length,
    [filters]
  );

  const buildOpenWorkspaceQueryString = useCallback(
    (requesterName?: string) => {
      const params = new URLSearchParams();
      const name = requesterName?.trim();
      if (name) params.set('requesterName', name);
      if (filters.startDate.trim()) params.set('startDate', filters.startDate.trim());
      if (filters.endDate.trim()) params.set('endDate', filters.endDate.trim());
      if (filters.requestStatuses.length > 0) {
        params.set(
          'requestStatuses',
          filters.requestStatuses.map((status) => String(Number(status))).join(',')
        );
      }
      if (filters.requestTypes.length > 0) {
        params.set(
          'requestTypes',
          filters.requestTypes.map((type) => String(Number(type))).join(',')
        );
      }
      const query = params.toString();
      return query ? `?${query}` : '';
    },
    [filters]
  );

  const value = useMemo<DailyWorkspaceFiltersContextValue>(
    () => ({
      ...filters,
      setStartDate,
      setEndDate,
      toggleStatus,
      toggleType,
      clearFiltersToDefaults,
      clearAllFilters,
      apiFilterParams,
      activeFilterCount,
      buildOpenWorkspaceQueryString,
    }),
    [
      filters,
      setStartDate,
      setEndDate,
      toggleStatus,
      toggleType,
      clearFiltersToDefaults,
      clearAllFilters,
      apiFilterParams,
      activeFilterCount,
      buildOpenWorkspaceQueryString,
    ]
  );

  return (
    <DailyWorkspaceFiltersContext.Provider value={value}>
      <Outlet />
    </DailyWorkspaceFiltersContext.Provider>
  );
};

export function useDailyWorkspaceFilters(): DailyWorkspaceFiltersContextValue {
  const context = useContext(DailyWorkspaceFiltersContext);
  if (!context) {
    throw new Error('useDailyWorkspaceFilters must be used within DailyWorkspaceFiltersProvider');
  }
  return context;
}
