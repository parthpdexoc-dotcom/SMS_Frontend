/**
 * Department Invoice Configuration DTOs and Types
 * One record per department (DepartmentInvoiceConfiguration table).
 */

export interface DepartmentInvoiceConfigRequest {
  createdDate?: string | null;
  createdUserID?: string | null;
  createdBy?: string | null;
  editedDate?: string | null;
  editedUserID?: string | null;
  editedBy?: string | null;
  message?: string | null;
  invoiceConfigID?: string | null;
  departmentID?: string | null;
  fiscalYear?: string | null;
  staffReimbursement?: number | null;
  mileageReimburseEligible?: boolean;
  vehicleReimbursement?: number | null;
  mileageReimbursedRate?: number | null;
  defaultAdminFeeDollar?: number | null;
  defaultAdminFeePercentage?: number | null;
  defaultPayrollTax?: number | null;
  totalCombinedAdminFees?: number | null;
  departmentAdminFee?: number | null;
  cancellationMinimumFee?: number | null;
  minimumFee?: number | null;
  agencySupportFee?: number | null;
  effectiveDate?: string | null;
  payableDirectlyTo?: string | null;
  isPayableToOfficer?: boolean;
}

export interface DepartmentInvoiceConfigResponse extends DepartmentInvoiceConfigRequest {
  departmentInvoiceConfigurationID?: string | null;
  departmentID?: string | null;
}

export interface DepartmentInvoiceConfigFormData {
  departmentID: string;
  fiscalYear: string;
  staffReimbursement: number;
  mileageReimburseEligible: boolean;
  vehicleReimbursement: number;
  mileageReimbursedRate: number;
  defaultAdminFeeDollar: number;
  defaultAdminFeePercentage: number;
  defaultPayrollTax: number;
  totalCombinedAdminFees: number;
  departmentAdminFee: number;
  cancellationMinimumFee: number;
  minimumFee: number;
  agencySupportFee: number;
  effectiveDate: string;
  payableDirectlyTo: string;
  isPayableToOfficer: boolean;
}
