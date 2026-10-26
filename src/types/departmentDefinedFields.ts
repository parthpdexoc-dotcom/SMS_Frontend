/**
 * DepartmentDefinedFields DTOs and Types
 */

import { PaginationParams } from '@/utils/paginationUtils';

export interface CreateDepartmentDefinedFieldsRequest {
  departmentID: string;
  requestDepartmentDefinedFieldInterfaceLabel1?: string;
  requestDepartmentDefinedFieldInterfaceLabel2?: string;
  requestDepartmentDefinedFieldInterfaceLabel3?: string;
  requestDepartmentDefinedFieldInterfaceLabel4?: string;
  requestDepartmentDefinedFieldInterfaceLabel5?: string;
  requestDepartmentDefinedFieldInterfaceLabel6?: string;
  requestDepartmentDefinedFieldInterfaceLabel7?: string;
  requestDepartmentDefinedFieldInterfaceLabel8?: string;
  requestDepartmentDefinedFieldInterfaceLabel9?: string;
  requestDepartmentDefinedFieldInterfaceLabel10?: string;
  postDepartmentDefinedFieldInterfaceLabel1?: string;
  postDepartmentDefinedFieldInterfaceLabel2?: string;
  postDepartmentDefinedFieldInterfaceLabel3?: string;
  postDepartmentDefinedFieldInterfaceLabel4?: string;
  postDepartmentDefinedFieldInterfaceLabel5?: string;
  postDepartmentDefinedFieldInterfaceLabel6?: string;
  postDepartmentDefinedFieldInterfaceLabel7?: string;
  postDepartmentDefinedFieldInterfaceLabel8?: string;
  postDepartmentDefinedFieldInterfaceLabel9?: string;
  postDepartmentDefinedFieldInterfaceLabel10?: string;
}

export interface UpdateDepartmentDefinedFieldsRequest extends CreateDepartmentDefinedFieldsRequest {
  departmentDefinedFieldID: string; // GUID as string (primary key)
}

export interface DepartmentDefinedFieldsResponse {
  departmentDefinedFieldID: string;
  departmentID: string;
  departmentName?: string;
  requestDepartmentDefinedFieldInterfaceLabel1: string | null;
  requestDepartmentDefinedFieldInterfaceLabel2: string | null;
  requestDepartmentDefinedFieldInterfaceLabel3: string | null;
  requestDepartmentDefinedFieldInterfaceLabel4: string | null;
  requestDepartmentDefinedFieldInterfaceLabel5: string | null;
  requestDepartmentDefinedFieldInterfaceLabel6: string | null;
  requestDepartmentDefinedFieldInterfaceLabel7: string | null;
  requestDepartmentDefinedFieldInterfaceLabel8: string | null;
  requestDepartmentDefinedFieldInterfaceLabel9: string | null;
  requestDepartmentDefinedFieldInterfaceLabel10: string | null;
  postDepartmentDefinedFieldInterfaceLabel1: string | null;
  postDepartmentDefinedFieldInterfaceLabel2: string | null;
  postDepartmentDefinedFieldInterfaceLabel3: string | null;
  postDepartmentDefinedFieldInterfaceLabel4: string | null;
  postDepartmentDefinedFieldInterfaceLabel5: string | null;
  postDepartmentDefinedFieldInterfaceLabel6: string | null;
  postDepartmentDefinedFieldInterfaceLabel7: string | null;
  postDepartmentDefinedFieldInterfaceLabel8: string | null;
  postDepartmentDefinedFieldInterfaceLabel9: string | null;
  postDepartmentDefinedFieldInterfaceLabel10: string | null;
  createdDate: string | null;
  createdUserID: string | null;
  createdBy: string | null;
  editedDate: string | null;
  editedUserID: string | null;
  editedBy: string | null;
}

export interface DepartmentDefinedFieldsPaginationParams extends PaginationParams {}
