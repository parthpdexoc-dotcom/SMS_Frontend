/**
 * Activity Form Types
 */

export enum QuestionTypeEnum {
  ShortAnswer = 0,
  Paragraph = 1,
  Radio = 2,
  MultiChoice = 3,
}

export interface QuestionOption {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  text: string;
  type: QuestionTypeEnum;
  required: boolean;
  options: QuestionOption[];
}

export interface ActivityFormData {
  name: string;
  description: string;
  questions: Question[];
}

/** Saved form template (list item) with id and type for the Form Templates grid */
export interface FormTemplateItem extends ActivityFormData {
  id: string;
  formType: string;
}

export interface ActivityFormErrors {
  name?: string;
  description?: string;
  questions?: Record<string, QuestionErrors>;
}

export interface QuestionErrors {
  text?: string;
  options?: Record<string, string>;
}

/** Request body for POST /api/ActivityForm (matches QuestionnaireFormDto) */
export interface ActivityFormUpsertRequest {
  questionnaire: {
    questionnaireId?: string | null;
    title: string;
    description?: string | null;
    isActive: boolean;
    questionnaireType: number;
    sourceQuestionnaireId?: string | null;
  };
  questions: Array<{
    questionId?: string | null;
    questionnaireId?: string | null;
    questionText?: string | null;
    questionType: number;
    isRequired: boolean;
    displayOrder: number;
    options: Array<{
      optionId?: string | null;
      questionId?: string | null;
      optionText?: string | null;
      displayOrder: number;
    }>;
  }>;
}
