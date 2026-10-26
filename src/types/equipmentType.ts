/**
 * EquipmentType DTOs and Types
 *
 * Note: Backend uses the misspelling `equipementType...` (with an extra 'e').
 * We keep the same property names to avoid mapping issues.
 */

export interface CreateEquipmentTypeRequest {
  equipementTypeShort: string;
  equipementTypeLong: string;
  isVehicle: boolean;
  equipementTypeStatus: boolean;
}

export interface UpdateEquipmentTypeRequest extends CreateEquipmentTypeRequest {
  equipementTypeID: string; // GUID as string (primary key)
}

export interface EquipmentTypeResponse {
  equipementTypeID: string;
  equipementTypeShort: string;
  equipementTypeLong: string;
  isVehicle: boolean;
  equipementTypeStatus: boolean;
  createdDate: string | null;
  createdUserID: string | null;
  createdBy: string | null;
  editedDate: string | null;
  editedUserID: string | null;
  editedBy: string | null;
}

import { PaginationParams } from '@/utils/paginationUtils';

export interface EquipmentTypePaginationParams extends PaginationParams { }

export interface EquipmentTypeSearchParams extends EquipmentTypePaginationParams {
  searchTerm?: string;
}

export interface EquipmentTypeFormData {
  equipementTypeShort: string;
  equipementTypeLong: string;
  isVehicle: boolean;
  equipementTypeStatus: boolean;
}

export interface EquipmentTypeFormErrors {
  equipementTypeShort?: string;
  equipementTypeLong?: string;
  isVehicle?: string;
  equipementTypeStatus?: string;
}


