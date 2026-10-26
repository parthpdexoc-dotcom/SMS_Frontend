import type { Option } from './common';
import type { PaginationParams } from '@/utils/paginationUtils';

export interface EmployeeOption extends Option { }

export interface ManagerOption extends Option { }

export interface RequesterEmployee {
  requesterEmployeeID: string;
  requesterManagerID: string;
  employeeID: string;
  isPreferred: boolean;
  createdBy?: string | null;
  editedBy?: string | null;
  createdDate?: string | null;
  editedDate?: string | null;
}

export interface RequestEmployeeResponseDto extends RequesterEmployee {
  employeeName?: string;
}

export interface CreateRequesterEmployeeRequest {
  requesterManagerID: string;
  employeeID: string;
  isPreferred: boolean;
}

export interface UpdateRequesterEmployeeRequest {
  requesterEmployeeID: string;
  requesterManagerID: string;
  employeeID: string;
  isPreferred: boolean;
}

export interface RequesterEmployeePaginationParams extends PaginationParams { }

export type RequesterEmployeeFormMode = 'create' | 'edit';

export interface RequesterEmployeeFormProps {
  mode?: RequesterEmployeeFormMode;
  initialData?: RequesterEmployee | null;
  /** Manager ID when opened from RequesterManager row (backend employeeID). */
  managerID?: string;
  /** Manager display name (backend employeeName). */
  managerName?: string;
  /** RequesterManager link ID for API (backend requesterManagerID). */
  requesterManagerID?: string;
  onSuccess?: (data?: RequesterEmployee) => void;
  onCancel?: () => void;
  className?: string;
}

export interface RequesterEmployeeListProps {
  className?: string;
}

/** Row shape for RequesterEmployeeList table (raw item + resolved manager name + employee metadata) */
export type RequesterEmployeeDisplayRow = RequestEmployeeResponseDto & {
  __raw: RequesterEmployee;
  managerName: string;
  /** Optional badge number for the employee (resolved from Employee list) */
  badgeNumber?: string;
  /** Optional employee type display name (resolved from Employee list) */
  employeeType?: string;
};
