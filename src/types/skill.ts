/**
 * Skill DTOs and Types
 */

// Request DTO for creating a skill (add new)
export interface CreateSkillRequest {
  skillShort: string;
  skillLong: string;
  skillStatus: boolean;
}

// Request DTO for updating a skill
export interface UpdateSkillRequest {
  skillId: string; // GUID as string (primary key)
  skillShort: string;
  skillLong: string;
  skillStatus: boolean;
}

// Response DTO from API
export interface SkillResponse {
  // Backend property name: skillId (primary key)
  skillId: string;
  skillShort: string;
  skillLong: string;
  skillStatus: boolean;
  createdDate: string | null;
  createdUserID: string | null;
  createdBy: string | null;
  editedDate: string | null;
  editedUserID: string | null;
  editedBy: string | null;
}

// Pagination parameters for GET request
import { PaginationParams } from '@/utils/paginationUtils';

export interface SkillPaginationParams extends PaginationParams { }

export interface SkillSearchParams extends SkillPaginationParams {
  searchTerm?: string;
}

// UI filter for Skills table (client-side)
export enum SkillStatusFilter {
  Active = 'active',
  Inactive = 'inactive',
}