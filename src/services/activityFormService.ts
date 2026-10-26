/**
 * ActivityForm API Service
 * GET /api/ActivityForm/{id} - single activity form
 * POST /api/ActivityForm - upsert activity form (insert or update)
 */

import type { ActivityFormData, ActivityFormUpsertRequest } from '@/types/activityForm';
import { QuestionnaireFormResponse } from '@/types/questionnaire';
import { apiDelete, apiGet, apiPost } from '@/utils/apiClient';
import { expectOk, expectOkReadText, parseJsonText, readResponseOk } from '@/services/textPlainJson';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function parseGuid(s: string): string | null {
  if (!s || s.length !== 36) return null;
  return UUID_REGEX.test(s) ? s : null;
}

/** True if id looks like a server GUID (existing question/option). */
export function isServerId(id: string): boolean {
  return parseGuid(id) !== null;
}

/**
 * Map ActivityFormData to ActivityForm upsert request body.
 * questionnaireId: when editing, pass the form id; when first save from template, pass null.
 * sourceQuestionnaireId: when first save from template pass template id; when editing a form
 * that was created from template, pass the loaded value so it is preserved (not cleared).
 * When first save from template (questionnaireId null + sourceQuestionnaireId set), all
 * question/option IDs are sent as null so the backend creates a copy; we identify the
 * source template via sourceQuestionnaireId.
 */
export function mapActivityFormDataToUpsertRequest(
  data: ActivityFormData,
  questionnaireId?: string | null,
  sourceQuestionnaireId?: string | null
): ActivityFormUpsertRequest {
  const isCopyFromTemplate =
    sourceQuestionnaireId != null && sourceQuestionnaireId !== '' && questionnaireId == null;

  return {
    questionnaire: {
      questionnaireId: questionnaireId ?? null,
      title: data.name.trim(),
      description: data.description?.trim() ?? null,
      isActive: true,
      questionnaireType: 0, // Cancel
      sourceQuestionnaireId: sourceQuestionnaireId ?? null,
    },
    questions: data.questions.map((q, i) => ({
      questionId: isCopyFromTemplate ? null : (parseGuid(q.id) ?? null),
      questionnaireId: isCopyFromTemplate ? null : (questionnaireId ?? null),
      questionText: q.text.trim(),
      questionType: q.type,
      isRequired: q.required,
      displayOrder: i,
      options: q.options.map((o, j) => ({
        optionId: isCopyFromTemplate ? null : (parseGuid(o.id) ?? null),
        questionId: isCopyFromTemplate ? null : null,
        optionText: o.text.trim(),
        displayOrder: j,
      })),
    })),
  };
}

/**
 * Get a single activity form with its questions and options (for Edit).
 */
export const getActivityForm = async (
  activityFormId: string
): Promise<QuestionnaireFormResponse> => {
  const response = await apiGet(`/ActivityForm/${activityFormId}`);
  const text = await expectOkReadText(response, 'Failed to fetch activity form');
  return parseJsonText<QuestionnaireFormResponse>(text);
};

/**
 * Create or update an activity form (POST /api/ActivityForm).
 * @param data - Activity form data
 * @param questionnaireId - When editing, the existing questionnaire ID
 * @param sourceQuestionnaireId - When saving from template, pass template id; questionnaireId will be sent null
 */
export const upsertActivityForm = async (
  data: ActivityFormData,
  questionnaireId?: string | null,
  sourceQuestionnaireId?: string | null
): Promise<void> => {
  const body = mapActivityFormDataToUpsertRequest(data, questionnaireId, sourceQuestionnaireId);
  const response = await apiPost('/ActivityForm', body);
  await readResponseOk(response, 'Failed to save form');
};

/**
 * Delete an activity form / questionnaire (DELETE /api/ActivityForm/{id}).
 */
export const deleteActivityForm = async (questionnaireId: string): Promise<void> => {
  const response = await apiDelete(`/ActivityForm/${encodeURIComponent(questionnaireId)}`);
  await expectOk(response, 'Failed to delete activity form');
};

/**
 * Delete a question by ID (DELETE /api/Question/{id}).
 * Use when removing an existing question in edit mode.
 */
export const deleteQuestion = async (questionId: string): Promise<void> => {
  const response = await apiDelete(`/Question/${questionId}`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to delete question: ${response.status} ${text}`);
  }
};

/**
 * Delete an option by ID (DELETE /api/Option/{id}).
 * Use when removing an existing option in edit mode.
 */
export const deleteOption = async (optionId: string): Promise<void> => {
  const response = await apiDelete(`/Option/${optionId}`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to delete option: ${response.status} ${text}`);
  }
};
