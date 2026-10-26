export interface Option {
  value: string;
  label: string;
}

/** Common API dropdown DTO: aligns with backend SelectOptionDto (id/label). */
export interface SelectOptionDto {
  id: string;
  label: string;
}

/** Department equipment/vehicle dropdown option — extends SelectOptionDto with default flag. */
export interface DepartmentEquipmentSelectOptionDto extends SelectOptionDto {
  isDefault?: boolean;
}

export enum FormMode {
    VIEW = 'view',
    EDIT = 'edit',
    CREATE = 'create'
}

export interface PageParam {
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
    /** Optional; sent as `isActive` when APIs support `[FromQuery] bool? isActive`. */
    isActive?: boolean;
}

export interface PagedResponse<T> {
    totalRecords: number;
    data: T[];
}

export interface AuditFilter extends PageParam {
    /** Optional start date filter for audit records */
    startDate?: string;
    /** Optional end date filter for audit records */
    endDate?: string;
    /** Optional changed-on date filter (YYYY-MM-DD) for department audit list/search */
    changedOn?: string;
}
