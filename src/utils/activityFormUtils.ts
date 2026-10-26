/**
 * Activity form mapping utilities
 */
import { QuestionTypeEnum, type ActivityFormData, type Question, type QuestionOption } from '@/types/activityForm';
import type { QuestionnaireFormResponse } from '@/types/questionnaire';

/** Map API questionnaire form response to ActivityFormData */
export function mapQuestionnaireFormToActivityFormData(
  res: QuestionnaireFormResponse
): ActivityFormData {
  const sortedQuestions = [...res.questions].sort(
    (a, b) => a.displayOrder - b.displayOrder
  );
  const questions: Question[] = sortedQuestions.map((q) => {
    const sortedOptions = [...(q.options ?? [])].sort(
      (a, b) => a.displayOrder - b.displayOrder
    );
    const options: QuestionOption[] = sortedOptions.map((o) => ({
      id: o.optionId,
      text: o.optionText,
    }));
    return {
      id: q.questionId,
      text: q.questionText,
      type: q.questionType as Question['type'],
      required: q.isRequired,
      options,
    };
  });
  return {
    name: res.questionnaire.title ?? '',
    description: res.questionnaire.description ?? '',
    questions,
  };
}

/**
 * Map closed-post API `answer` to values stored in questionnaireResponses (option id(s) for choice questions).
 * Supports JSON option-id arrays, single ids, plain text, and comma-separated option labels.
 */
export function mapClosedDetailsAnswerToQuestionnaireValue(
  question: Question,
  rawAnswer: string
): string | string[] {
  const trimmed = rawAnswer.trim();
  if (!trimmed) {
    return question.type === QuestionTypeEnum.MultiChoice ? [] : '';
  }

  if (
    question.type === QuestionTypeEnum.ShortAnswer ||
    question.type === QuestionTypeEnum.Paragraph
  ) {
    return trimmed;
  }

  const opts = question.options ?? [];

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        const ids = parsed.map((x) => String(x));
        return question.type === QuestionTypeEnum.MultiChoice ? ids : ids[0] ?? '';
      }
    } catch {
      /* fall through */
    }
  }

  const byId = opts.find((o) => o.id === trimmed);
  if (byId) {
    return question.type === QuestionTypeEnum.MultiChoice ? [byId.id] : byId.id;
  }

  const byFullLabel = opts.find((o) => o.text.trim() === trimmed);
  if (byFullLabel) {
    return question.type === QuestionTypeEnum.MultiChoice ? [byFullLabel.id] : byFullLabel.id;
  }

  const segments = trimmed
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const matchedIds: string[] = [];
  for (const seg of segments) {
    const o = opts.find((x) => x.text.trim().toLowerCase() === seg.toLowerCase());
    if (o) matchedIds.push(o.id);
  }

  if (matchedIds.length > 0) {
    if (question.type === QuestionTypeEnum.MultiChoice) {
      return matchedIds;
    }
    return matchedIds[0] ?? '';
  }

  return question.type === QuestionTypeEnum.MultiChoice ? [] : trimmed;
}
