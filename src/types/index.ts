export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonType = 'button' | 'submit' | 'reset';

export interface ButtonProps extends BaseComponentProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  type?: ButtonType;
  disabled?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement> | (() => void);
  fullWidth?: boolean;
  title?: string;
  'aria-label'?: string;
  style?: React.CSSProperties;
}

export interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
  /** Optional inline style for the option (e.g. paddingLeft for hierarchy indentation). */
  style?: React.CSSProperties;
}

export interface StatCardProps extends BaseComponentProps {
  title: string;
  icon: React.ReactNode;
  buttonText: string;
  buttonVariant?: ButtonVariant;
  onClick?: () => void;
  color?: string;
}

export interface ChartData {
  name: string;
  value: number;
  color?: string;
}

export interface MenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  path?: string;
  children?: MenuItem[];
}

export interface LoginProps extends BaseComponentProps {
  onLogin?: (email: string, password: string) => void;
}

export interface AdminLoginProps extends BaseComponentProps {
  onLogin?: (username: string, password: string) => void;
}

export interface TabProps extends BaseComponentProps {
  id: string;
  label: string;
  icon?: string;
  active?: boolean;
  disabled?: boolean;
  hasError?: boolean;
  onClick?: (id: string) => void;
}

export interface TabItem {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  hasError?: boolean;
  content?: React.ReactNode;
}

export type TabsVariant = 'default' | 'pills' | 'underline';

export interface TabsProps extends BaseComponentProps {
  tabs: TabItem[];
  defaultActiveTab?: string;
  activeTab?: string; // Controlled mode
  onChange?: (tabId: string) => void;
  variant?: TabsVariant;
  /** When true, all tab panels stay mounted (hidden when inactive) so form draft state is preserved. */
  keepMounted?: boolean;
}

// Export department types
export * from './department';

// Export admin type types
export * from './adminType';

// Export department admin types
export * from './departmentAdmin';

// Export department equipment types
export * from './departmentEquipment';

// Export department division types
export * from './departmentDivision';

// Export department activity type types
export * from './departmentActivityType';

// Export department defined fields types
export * from './departmentDefinedFields';

// Export skill types
export * from './skill';

// Export business type types
export * from './businessType';
export * from './paymentType';

// Export employee types
export * from './employee';

// Export employee type types
export * from './employeeType';

// Export employee status types
export * from './employeeStatus';

// Export employee admin types
export * from './employeeAdmin';

// Export equipment type types
export * from './equipmentType';

// Export response area types
export * from './responseArea';

// Export requester types
export * from './requester';

// Export release schedule state types
export * from './releaseSchedule';

// Export requester restrict types
export * from './requesterRestrict';

// Export requester employee types (exclude EmployeeOption - already from requesterRestrict)
export type {
  RequesterEmployee,
  RequestEmployeeResponseDto,
  ManagerOption,
  CreateRequesterEmployeeRequest,
  UpdateRequesterEmployeeRequest,
  RequesterEmployeePaginationParams,
  RequesterEmployeeFormMode,
  RequesterEmployeeFormProps,
  RequesterEmployeeListProps,
  RequesterEmployeeDisplayRow,
} from './requesterEmployee';

export type {
  RequesterManager,
  RequestManagerResponseDto,
  CreateRequesterManagerRequest,
  UpdateRequesterManagerRequest,
  RequesterManagerPaginationParams,
  RequesterManagerFormMode,
  RequesterManagerFormProps,
  RequesterManagerListProps,
  DisplayRequesterManager,
} from './requesterManager';

// User role types
export * from './userRole';

// RoutingGroup types
export * from './routingGroup';

// BlockDate types
export * from './blockDate';

// Vehicle Approval types
export * from './vehicleApproval';

// Activity Form types
export * from './activityForm';
export * from './admin';

// My History closed post details grid (records + vehicles modal)
export * from './closedPostHistoryDetails';

// Toast types
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  /** Set by toast slice for deduplication; optional for backwards compatibility */
  createdAt?: number;
}

export interface ToastProps extends BaseComponentProps {
  id: string;
  message: string;
  type?: ToastType;
  duration?: number;
  onClose?: () => void;
}

