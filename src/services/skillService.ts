/**
 * Skill API Service
 * Handles all API calls related to Skills
 */

import { SkillResponse, CreateSkillRequest, UpdateSkillRequest, SkillPaginationParams } from '@/types/skill';
import { SelectOptionDto } from '@/types/common';
import { apiGet, apiGetAll, apiPost } from '@/utils/apiClient';
import { expectOkReadText, parseJsonText, parseJsonTextArray, parsePagedListJson, readResponseOk } from '@/services/textPlainJson';
import { normalizeSkill } from '@/utils/normalizers';
import { coalesceKeyedRequest } from '@/utils/coalesceKeyedRequest';

type ActiveSkillParams = {
  departmentId?: string;
  selectedIds?: string[];
};

/**
 * Get all skills with pagination.
 * @param pagination - Optional pagination parameters
 * @returns Paginated list and total count for grids
 */
export const getSkills = async (
  pagination?: SkillPaginationParams
): Promise<{ data: SkillResponse[]; totalRecords: number }> => {
  try {
    const response = await apiGetAll('/Skill', pagination);
    const responseText = await expectOkReadText(response, 'Failed to fetch skills');
    return parsePagedListJson(responseText, (row) => normalizeSkill(row));
  } catch (error) {
    console.error('Error fetching skills:', error);
    throw error;
  }
};

/** Appends supported query params when provided (departmentId, selectedIds). */
function activeSkillPath(params?: ActiveSkillParams): string {
  const departmentId = typeof params?.departmentId === 'string' ? params.departmentId.trim() : '';
  const selectedIds = Array.from(
    new Set((params?.selectedIds ?? []).map((id) => String(id ?? '').trim()).filter(Boolean))
  );
  if (!departmentId && selectedIds.length === 0) return '/Skill/GetAllActiveskill';
  const query = new URLSearchParams();
  if (departmentId) query.set('departmentId', departmentId);
  selectedIds.forEach((selectedId) => query.append('selectedIds', selectedId));
  const q = query.toString();
  return `/Skill/GetAllActiveskill?${q}`;
}

/**
 * Get all active skills (for form dropdowns).
 * Endpoint: GET /Skill/GetAllActiveskill[?departmentId=][&selectedIds=]
 */
export const getActiveSkills = async (params?: ActiveSkillParams): Promise<SkillResponse[]> => {
  const path = activeSkillPath(params);
  return coalesceKeyedRequest('getActiveSkills', path, async () => {
    try {
      const response = await apiGet(path);
      const responseText = await expectOkReadText(response, 'Failed to fetch active skills');
      return parseJsonTextArray<any>(responseText).map(normalizeSkill);
    } catch (error) {
      console.error('Error fetching active skills:', error);
      throw error;
    }
  });
};

/**
 * Lightweight skill options for dropdowns.
 * Backend returns SelectOptionDto[] directly; no extra frontend mapping here.
 */
export const getSkillOptions = async (
  searchTerm?: string
): Promise<SelectOptionDto[]> => {
  try {
    const body: Record<string, unknown> = {};
    const trimmedSearch = searchTerm?.trim();
    if (trimmedSearch) {
      body.searchTerm = trimmedSearch;
    }
    const response = await apiPost('/Skill/skilloptions', body, {
      headers: { 'Content-Type': 'application/json' },
    });
    const responseText = await expectOkReadText(response, 'Failed to fetch skill options');
    return parseJsonText<SelectOptionDto[]>(responseText);
  } catch (error) {
    console.error('Error fetching skill options:', error);
    throw error;
  }
};

/**
 * Create a new skill
 * @param skillData - The skill data to create
 * @returns Promise<SkillResponse>
 */
export const createSkill = async (
  skillData: CreateSkillRequest
): Promise<SkillResponse> => {
  try {
    const response = await apiPost('/Skill', skillData, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const responseText = await readResponseOk(response, 'Failed to create skill');
    return normalizeSkill(parseJsonText<any>(responseText));
  } catch (error) {
    console.error('Error creating skill:', error);
    throw error;
  }
};

/**
 * Update an existing skill
 * @param skillData - The skill data to update (must include skillId)
 * @returns Promise<SkillResponse>
 */
export const updateSkill = async (
  skillData: UpdateSkillRequest
): Promise<SkillResponse> => {
  try {
    const response = await apiPost('/Skill', skillData, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const responseText = await readResponseOk(response, 'Failed to update skill');
    return normalizeSkill(parseJsonText<any>(responseText));
  } catch (error) {
    console.error('Error updating skill:', error);
    throw error;
  }
};
