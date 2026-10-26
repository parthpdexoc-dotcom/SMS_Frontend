import type { RequesterRequestSummary } from './requester';
import type { RequestInRequesterListDto, RequestScheduleDto } from './request';

export interface RequestSchedulePageState {
  rows: RequestScheduleDto[];
  totalRecords: number;
  isLoading: boolean;
  page: number;
  pageSize: number;
}

export interface RequesterRequestsState {
  rows: RequestInRequesterListDto[];
  totalRecords: number;
  isLoading: boolean;
  error: string | null;
  page: number;
  pageSize: number;
}

export interface ReleaseScheduleState {
  rows: RequesterRequestSummary[];
  totalRecords: number;
  isLoading: boolean;
  error: string | null;
  requestsByRequester: Record<string, RequesterRequestsState>;
  schedulePages: Record<string, RequestSchedulePageState>;
}
