import type { Option } from './common';
import type { RequesterEmployee } from './requesterEmployee';

export interface RequesterOption extends Option { }

export interface ManagerOption extends Option { }

export interface RequesterManager {
  requesterManagerID: string;
  requesterID: string;
  employeeID: string;
  employeeName?: string;
  /** UI-only master switch for shared options. Not sent directly to backend. */
  isShared: boolean;
  /** Backend field mapped from RequesterManager.IsRequestShared */
  isRequestShared?: boolean;
  /** Backend field mapped from RequesterManager.IsEmployeeShared */
  isEmployeeShared?: boolean;
  requesterEmployees: RequesterEmployee[];
  createdBy?: string | null;
  editedBy?: string | null;
  createdDate?: string | null;
  editedDate?: string | null;
}

// Response DTO that extends RequesterManager with EmployeeName (from backend RequestManagerResponceDto)
export interface RequestManagerResponseDto extends RequesterManager {
  employeeName?: string;
}

export type RequesterManagerFormMode = 'create' | 'edit';

export interface RequesterManagerFormProps {
  mode?: RequesterManagerFormMode;
  initialData?: RequesterManager | null;
  requesterOptions?: RequesterOption[];
  employeeOptions?: ManagerOption[];
  isLoadingEmployeeOptions?: boolean;
  onRequesterIdChange?: (requesterId: string) => void;
  /** Requester when opened from requester list (backend requesterID). */
  requesterID?: string;
  /** Requester display name (from getallrequesterwithdetails). */
  requesterName?: string;
  onSuccess?: (data: RequesterManager) => void;
  onCancel?: () => void;
  className?: string;
}

export interface CreateRequesterManagerRequest {
  requesterID: string;
  employeeID: string;
  isRequestShared?: boolean;
  isEmployeeShared?: boolean;
}

export interface UpdateRequesterManagerRequest extends CreateRequesterManagerRequest {
  requesterManagerID: string;
}

export interface RequesterManagerPaginationParams {
  page?: number;
  pageSize?: number;
  requesterId?: string;
}

export interface RequesterManagerListProps {
  className?: string;
}

export interface DisplayRequesterManager extends RequestManagerResponseDto {
  requesterName?: string;
  /** Resolved from employees list by manager's employeeID */
  badgeNumber?: string;
  /** Resolved from employees list by manager's employeeID */
  employeeType?: string;
}
