/**
 * DepartmentFee API Service
 * Handles all API calls related to Department Fees
 */

import { apiDelete, apiGet, apiPost } from '@/utils/apiClient';
import {
	DepartmentFeePaginationParams,
	DepartmentFeeResponse,
	RequestSelectionFeeDto,
	CreateDepartmentFeeRequest,
	UpdateDepartmentFeeRequest,
} from '@/types/departmentFeeType';
import { parseJsonText, parsePagedListJson, readResponseOk } from '@/services/textPlainJson';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';

export const getDepartmentFees = async (
	pagination?: DepartmentFeePaginationParams
): Promise<{ data: DepartmentFeeResponse[]; totalRecords: number }> => {
	try {
		const queryParams = buildPaginationQueryParams(pagination);

		const endpoint = `/DepartmentFee${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
		const response = await apiGet(endpoint);
		const responseText = await readResponseOk(response, 'Failed to fetch department fees');
		return parsePagedListJson(
			responseText,
			(row) => row as unknown as DepartmentFeeResponse
		);
	} catch (error) {
		console.error('Error fetching department fees:', error);
		throw error;
	}
};

export const createDepartmentFee = async (
	data: CreateDepartmentFeeRequest
): Promise<DepartmentFeeResponse> => {
	try {
		const response = await apiPost('/DepartmentFee', data, {
			headers: { 'Content-Type': 'application/json' },
		});
		const responseText = await readResponseOk(response, 'Failed to create department fee');
		return parseJsonText<DepartmentFeeResponse>(responseText);
	} catch (error) {
		console.error('Error creating department fee:', error);
		throw error;
	}
};

export const updateDepartmentFee = async (
	data: UpdateDepartmentFeeRequest
): Promise<DepartmentFeeResponse> => {
	try {
		const response = await apiPost('/DepartmentFee', data, {
			headers: { 'Content-Type': 'application/json' },
		});
		const responseText = await readResponseOk(response, 'Failed to update department fee');
		return parseJsonText<DepartmentFeeResponse>(responseText);
	} catch (error) {
		console.error('Error updating department fee:', error);
		throw error;
	}
};

export const deleteDepartmentFee = async (feeId: string): Promise<void> => {
	try {
		const response = await apiDelete(`/DepartmentFee/${feeId}`, {
			headers: { accept: '*/*' },
		});
		await readResponseOk(response, 'Failed to delete department fee');
	} catch (error) {
		console.error('Error deleting department fee:', error);
		throw error;
	}
};

/** GET /api/department-fees/request-selection[?requestId={id}]
 *  Returns all active department fees for the current department with
 *  isSelected / isDefault / isExisting flags for pre-populating the form.
 */
export const getRequestSelectionFees = async (
    requestId?: string
): Promise<RequestSelectionFeeDto[]> => {
    try {
        const params = new URLSearchParams();
        if (requestId) params.append('requestId', requestId);
        const endpoint = `/DepartmentFee/request-selection${params.toString() ? `?${params.toString()}` : ''}`;
        const response = await apiGet(endpoint);
        const responseText = await readResponseOk(response, 'Failed to fetch department fee selection');
        return parseJsonText<RequestSelectionFeeDto[]>(responseText);
    } catch (error) {
        console.error('Error fetching request selection fees:', error);
        throw error;
    }
};