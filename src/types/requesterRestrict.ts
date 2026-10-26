import type { Option } from './common';

export interface RequesterOption extends Option {}

export interface EmployeeOption extends Option {}

export interface RequesterRestrict {
  requesterRestrictID: string;
  requesterID: string;
  requesterName: string;
  employeeID: string;
  employeeName: string;
  effectiveStartDate: string;
  effectiveEndDate: string;
  isCurrent: boolean;
  createdDate: string | null;
  createdUserID: string | null;
  createdBy: string | null;
  editedDate: string | null;
  editedUserID: string | null;
  editedBy: string | null;
}

/** Request type for creating a new requester restrict */
export interface CreateRequesterRestrictRequest {
  requesterID: string;
  employeeID: string;
  effectiveStartDate: string;
  effectiveEndDate: string;
  isCurrent: boolean;
  updatedByAdminID?: string;
  dateTimeUpdated?: string;
  enteredByAdminID?: string;
  createdBy?: string | null;
  editedBy?: string | null;
  createdDate?: string | null;
  editedDate?: string | null;
}

/** Request type for updating an existing requester restrict */
export interface UpdateRequesterRestrictRequest extends CreateRequesterRestrictRequest {
  requesterRestrictID: string;
}

import { PaginationParams } from '@/utils/paginationUtils';

export interface RequesterRestrictPaginationParams extends PaginationParams {
  requesterId?: string;
}