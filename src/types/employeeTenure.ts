/**
 * Employee tenure / rank history row (GET EmployeeTenure/by-employee/{employeeId}).
 * Fields align with typical API JSON; optional keys cover PascalCase variants.
 */

export interface EmployeeTenureResponse {
  employeeTenureID: string;
  departmentID?: string | null;
  employeeID: string;
  employeeTypeID?: string | null;
  /** Short label when API embeds it; otherwise resolved via Employee Type list in UI */
  employeeTypeShort?: string | null;
  dateOfHire?: string | null;
  dateOfPromotion?: string | null;
  isCurrent?: boolean | null;
  /** Numeric rank when API sends it; otherwise can be resolved from employee type */
  rank?: number | null;
  /** Prefer dateOfPromotion, then dateOfHire, for display in "Effective date" column */
  effectiveDate?: string | null;
  endDate?: string | null;
  createdDate?: string | null;
  createdUserID?: string | null;
  createdBy?: string | null;
  editedDate?: string | null;
  editedUserID?: string | null;
  editedBy?: string | null;
}

/** Paged API response shape from EmployeeTenure/by-employee endpoint. */
export interface EmployeeTenurePagedResponse {
  totalRecords?: number;
  data?: EmployeeTenureResponse[] | null;
  isValid?: boolean;
  error?: string | null;
  hasError?: boolean;
  offset?: number;
  limit?: number;
  page?: number;
  pageSize?: number;
  sortBy?: string | null;
  sortDirection?: string | null;
}
