/**
 * Questionnaire API types (GET /api/Questionnaire)
 */

export enum QuestionnaireType {
  Close = 0,
  Cancel = 1,
  /** Fallback for any other value from API */
  Other = 2,
}

export interface QuestionnaireResponse {
  departmentQuestionnaireId: string;
  questionnaireId: string;
  title: string;
  description: string;
  isActive: boolean;
  questionnaireType: number;
  sourceQuestionnaireId?: string | null;
}

const QUESTIONNAIRE_TYPE_LABELS: Record<number, string> = {
  [QuestionnaireType.Close]: 'Close',
  [QuestionnaireType.Cancel]: 'Cancel',
  [QuestionnaireType.Other]: 'Other',
};

export function getQuestionnaireTypeLabel(value: number): string {
  if (value in QUESTIONNAIRE_TYPE_LABELS) return QUESTIONNAIRE_TYPE_LABELS[value];
  return 'Other';
}

/** GET /api/Questionnaire/{id}/form - single questionnaire with questions and options */
export interface QuestionnaireFormOption {
  optionId: string;
  questionId: string;
  optionText: string;
  displayOrder: number;
}

export interface QuestionnaireFormQuestion {
  questionId: string;
  questionnaireId: string;
  questionText: string;
  questionType: number;
  isRequired: boolean;
  displayOrder: number;
  options: QuestionnaireFormOption[];
}

export interface QuestionnaireFormResponse {
  questionnaire: QuestionnaireResponse;
  questions: QuestionnaireFormQuestion[];
}

/** RequesterQuestionnaire API types (POST /api/RequesterQuestionnaire) */
export interface RequesterQuestionnaireDto {
  requesterQuestionnaireId?: string;
  requesterId?: string;
  questionnaireId?: string;
}

export interface RequesterQuestionnaireResponse {
  requesterQuestionnaireId: string;
  requesterId: string;
  questionnaireId: string;
}
