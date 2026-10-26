/**
 * DepartmentFee DTOs and Types
 */

/** Enum matching backend FeeType */
export enum FeeType {
	/** Fee per request */
	PerRequest = 1,
	/** Fee per post */
	PerPost = 2,
	/** Fee per officer */
	PerOfficer = 3,
}

// Enum matching backend ReimburseTo
export enum ReimburseTo {
	City = 1,
	Employee = 2,
}

export interface CreateDepartmentFeeRequest {
	departmentId: string;
	feeShort: string;
	feeLong?: string;
	feeType: FeeType;
	defaultFee: number;
	additionalFee: number;
	reimburseTo: ReimburseTo;
	isActive: boolean;
	isDefault?: boolean;
	effectiveStartDate?: string;
	effectiveEndDate?: string;
}

export interface UpdateDepartmentFeeRequest extends CreateDepartmentFeeRequest {
	feeId: string; // GUID as string (primary key)
}

export interface DepartmentFeeResponse {
	feeId: string;
	departmentId: string;
	feeShort: string;
	feeLong?: string;
	feeType: FeeType;
	defaultFee: number;
	additionalFee: number;
	reimburseTo: ReimburseTo;
	createdDate: string | null;
	createdUserID: string | null;
	createdBy: string | null;
	editedDate: string | null;
	editedUserID: string | null;
	editedBy: string | null;
	/** Present when API returns active flag on list/detail DTOs */
	isActive?: boolean;
	isDefault?: boolean;
	effectiveStartDate?: string | null;
	effectiveEndDate?: string | null;
	isSelected?: boolean;
}

/** DTO returned by GET /api/department-fees/request-selection */
export interface RequestSelectionFeeDto {
	departmentFeeId: string;
	title: string;
	description?: string;
	feeType: FeeType;
	defaultFee: number;
	additionalFee: number;
	reimburseTo: ReimburseTo;
	isDefault: boolean;
	isSelected: boolean;
	isExisting: boolean;
}

export interface DepartmentFeeFormData {
	departmentId: string;
	feeShort: string;
	feeLong?: string;
	feeType: FeeType;
	defaultFee: number;
	additionalFee: number;
	reimburseTo: ReimburseTo;
	isActive: boolean;
	isDefault: boolean;
	effectiveStartDate?: string;
	effectiveEndDate?: string;
}

export interface DepartmentFeeFormErrors {
	departmentId?: string;
	feeShort?: string;
	feeLong?: string;
	feeType?: string;
	defaultFee?: string;
	additionalFee?: string;
	reimburseTo?: string;
	effectiveStartDate?: string;
	effectiveEndDate?: string;
}

import { PaginationParams } from "@/utils/paginationUtils";

export interface DepartmentFeePaginationParams extends PaginationParams {}

export interface DepartmentFeeSearchParams extends DepartmentFeePaginationParams {
	searchTerm?: string;
}
