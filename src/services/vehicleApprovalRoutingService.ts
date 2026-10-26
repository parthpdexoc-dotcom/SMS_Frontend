/**
 * VehicleApprovalRouting API Service
 * Handles all API calls related to Vehicle Approval Routing
 */

import { VehicleApprovalRoutingResponseDto } from '@/types/departmentEquipment';
import { expectOkReadText, parseJsonTextArray } from '@/services/textPlainJson';
import { apiGetAll } from '@/utils/apiClient';

/**
 * Gets all vehicle approval routing records by department equipment ID with routing group information.
 * @param departmentEquipmentId - The department equipment ID to filter by
 * @returns Promise<VehicleApprovalRoutingResponseDto[]>
 */
export const getVehicleRoutingGroupsByDepartmentEquipmentId = async (
  departmentEquipmentId: string
): Promise<VehicleApprovalRoutingResponseDto[]> => {
  try {
    const endpoint = `/VehicleApprovalRouting/department-equipment/${departmentEquipmentId}`;
    const response = await apiGetAll(endpoint);
    const responseText = await expectOkReadText(
      response,
      'Failed to fetch vehicle routing groups by department equipment ID'
    );
    return parseJsonTextArray<VehicleApprovalRoutingResponseDto>(responseText);
  } catch (error) {
    console.error('Error fetching vehicle routing groups by department equipment ID:', error);
    throw error;
  }
};

