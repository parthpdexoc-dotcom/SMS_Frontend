/**
 * EmployeeAdmin types for API and UI
 */

export interface EmployeeAdminResponse {
  employeeAdminID: string;
  employeeID: string;
  adminTypeID: string;
}

export interface CreateEmployeeAdminPayload {
  employeeID: string;
  adminTypeID: string;
}
