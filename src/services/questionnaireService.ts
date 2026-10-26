/**
 * Questionnaire API Service
 * GET /api/Questionnaire - list all questionnaires
 * GET /api/Questionnaire/{id}/form - single questionnaire with questions and options
 * GET /api/DepartmentQuestionnaire/questionnaires-by-department - list by department (non-admin)
 * GET /api/DepartmentQuestionnaire/questionnaires-by-admin - list for admin
 */

import {
  QuestionnaireResponse,
  QuestionnaireFormResponse,
  RequesterQuestionnaireDto,
  RequesterQuestionnaireResponse,
} from '@/types/questionnaire';
import { apiGet, apiPost, apiDelete } from '@/utils/apiClient';
import {
  expectOkReadText,
  parseJsonText,
  parseJsonTextArray,
  parsePagedListJson,
  expectOk,
} from '@/services/textPlainJson';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';
import type { PageParam } from '@/types/common';

type QuestionnaireSearchParams = PageParam & {
  searchTerm?: string;
};

/**
 * Get all questionnaires
 * @returns Promise<QuestionnaireResponse[]>
 */
export const getQuestionnaires = async (): Promise<QuestionnaireResponse[]> => {
  const response = await apiGet('/Questionnaire');
  const text = await expectOkReadText(response, 'Failed to fetch questionnaires');
  return parseJsonTextArray<QuestionnaireResponse>(text);
};

/**
 * Get questionnaires for department (user type is not Admin).
 * @param pagination - Optional pagination parameters
 * @returns Promise<QuestionnaireResponse[]>
 */
export const getQuestionnairesByDepartment = async (
  pagination?: { page?: number; pageSize?: number }
): Promise<QuestionnaireResponse[]> => {
  let endpoint = '/DepartmentQuestionnaire/questionnaires-by-department';
  if (pagination) {
    const params = new URLSearchParams();
    if (pagination.page !== undefined) params.append('page', String(pagination.page));
    if (pagination.pageSize !== undefined) params.append('pageSize', String(pagination.pageSize));
    if (params.toString()) {
      endpoint += `?${params.toString()}`;
    }
  }
  const response = await apiGet(endpoint);
  const text = await expectOkReadText(response, 'Failed to fetch questionnaires by department');
  const { data } = parsePagedListJson(text, (row) => row as unknown as QuestionnaireResponse);
  return data;
};

/** Admin questionnaire list (paged). */
export const getQuestionnairesByAdmin = async (
  pagination?: PageParam
): Promise<{ data: QuestionnaireResponse[]; totalRecords: number }> => {
  const queryParams = buildPaginationQueryParams(pagination);
  const qs = queryParams.toString();
  const endpoint = qs
    ? `/DepartmentQuestionnaire/questionnaires-by-admin?${qs}`
    : '/DepartmentQuestionnaire/questionnaires-by-admin';
  const response = await apiGet(endpoint);
  const text = await expectOkReadText(response, 'Failed to fetch questionnaires by admin');
  return parsePagedListJson(text, (row) => row as unknown as QuestionnaireResponse);
};

/** Admin questionnaire search (paged). */
export const searchQuestionnairesByAdmin = async (
  params?: QuestionnaireSearchParams
): Promise<{ data: QuestionnaireResponse[]; totalRecords: number }> => {
  const queryParams = buildPaginationQueryParams(params);
  const searchTerm = params?.searchTerm?.trim();
  if (searchTerm) {
    queryParams.append('searchTerm', searchTerm);
  }
  const qs = queryParams.toString();
  const endpoint = qs
    ? `/DepartmentQuestionnaire/questionnaires-by-admin/search?${qs}`
    : '/DepartmentQuestionnaire/questionnaires-by-admin/search';
  const response = await apiGet(endpoint);
  const text = await expectOkReadText(response, 'Failed to search questionnaires by admin');
  return parsePagedListJson(text, (row) => row as unknown as QuestionnaireResponse);
};

/** Department questionnaire search (paged). */
export const searchQuestionnairesByDepartment = async (
  params?: QuestionnaireSearchParams
): Promise<{ data: QuestionnaireResponse[]; totalRecords: number }> => {
  const queryParams = buildPaginationQueryParams(params);
  const searchTerm = params?.searchTerm?.trim();
  if (searchTerm) {
    queryParams.append('searchTerm', searchTerm);
  }
  const qs = queryParams.toString();
  const endpoint = qs
    ? `/DepartmentQuestionnaire/questionnaires-by-department/search?${qs}`
    : '/DepartmentQuestionnaire/questionnaires-by-department/search';
  const response = await apiGet(endpoint);
  const text = await expectOkReadText(response, 'Failed to search questionnaires by department');
  return parsePagedListJson(text, (row) => row as unknown as QuestionnaireResponse);
};

/**
 * Load every admin questionnaire page (for dropdowns / unique title checks).
 * Page size is taken from the first response so later requests stay aligned with the server default.
 */
export const getAllQuestionnairesByAdmin = async (): Promise<QuestionnaireResponse[]> => {
  const all: QuestionnaireResponse[] = [];
  let page = 1;
  let totalRecords = 0;
  let pageSize: number | undefined;

  for (;;) {
    const params: PageParam = pageSize !== undefined ? { page, pageSize } : { page };
    const { data, totalRecords: tr } = await getQuestionnairesByAdmin(params);
    totalRecords = tr;
    if (pageSize === undefined && data.length > 0) {
      pageSize = data.length;
    }
    all.push(...data);
    if (data.length === 0 || all.length >= totalRecords) break;
    page += 1;
  }

  return all;
};

/**
 * Save questionnaire responses for a requester
 * @param requesterId - ID of the requester
 * @param questionnaireIds - Array of selected questionnaire IDs
 * @returns Promise<void>
 */
export const saveRequesterQuestionnaires = async (
  requesterId: string,
  questionnaireIds: string[]
): Promise<void> => {
  const response = await apiPost('/DepartmentQuestionnaire/save-requester-questionnaires', {
    requesterId,
    questionnaireIds,
  });
  await expectOk(response, 'Failed to save requester questionnaires');
};

/**
 * Get a single questionnaire with its questions and options (for Edit form).
 * @param questionnaireId - GUID of the questionnaire
 * @returns Promise<QuestionnaireFormResponse>
 */
export const getQuestionnaireForm = async (
  questionnaireId: string
): Promise<QuestionnaireFormResponse> => {
  const response = await apiGet(`/Questionnaire/${questionnaireId}/form`);
  const text = await expectOkReadText(response, 'Failed to fetch questionnaire form');
  return parseJsonText<QuestionnaireFormResponse>(text);
};

/**
 * Get all RequesterQuestionnaires for a specific requester
 * @param requesterId - ID of the requester
 * @returns Promise<RequesterQuestionnaireResponse[]>
 */
export const getRequesterQuestionnairesByRequesterId = async (
  requesterId: string
): Promise<RequesterQuestionnaireResponse[]> => {
  const response = await apiGet(`/RequesterQuestionnaire/by-requester/${requesterId}`);
  const text = await expectOkReadText(response, 'Failed to fetch requester questionnaires');
  return parseJsonTextArray<RequesterQuestionnaireResponse>(text);
};

/**
 * Create or update a RequesterQuestionnaire
 * @param data - RequesterQuestionnaire data to upsert
 * @returns Promise<RequesterQuestionnaireResponse>
 */
export const upsertRequesterQuestionnaire = async (
  data: RequesterQuestionnaireDto
): Promise<RequesterQuestionnaireResponse> => {
  const response = await apiPost('/RequesterQuestionnaire', data);
  const text = await expectOkReadText(response, 'Failed to upsert requester questionnaire');
  return parseJsonText<RequesterQuestionnaireResponse>(text);
};

/**
 * Delete a RequesterQuestionnaire by id
 * @param requesterQuestionnaireId - ID of the requester questionnaire
 */
export const deleteRequesterQuestionnaire = async (
  requesterQuestionnaireId: string
): Promise<void> => {
  const response = await apiDelete(`/RequesterQuestionnaire/${requesterQuestionnaireId}`);
  await expectOk(response, 'Failed to delete requester questionnaire');
};
