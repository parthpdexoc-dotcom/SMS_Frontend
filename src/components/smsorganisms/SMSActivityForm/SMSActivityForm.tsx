import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  SMSButton,
  SMSCard,
  SMSDropdown,
  SMSIcon,
  SMSIconButton,
  SMSSwitch,
  SMSStack,
  SMSTextArea,
  SMSTextField,
} from '@/components/smsatoms';
import { ACTIVITY_FORM } from '@/constants/strings';
import {
  QuestionTypeEnum,
  Question,
  QuestionOption,
  ActivityFormData,
} from '@/types/activityForm';
import { deleteQuestion as deleteQuestionApi, deleteOption as deleteOptionApi, isServerId } from '@/services/activityFormService';
import './SMSActivityForm.css';

export interface ActivityFormProps {
  initialData?: ActivityFormData;
  /** Sync or async submit; when async, Save button shows loading state */
  onSubmit?: (data: ActivityFormData) => void | Promise<void>;
  onCancel?: () => void;
  isEditMode?: boolean;
  /** When true, hide the form title/subtitle (e.g. when embedded in FormPage with its own header) */
  hideHeader?: boolean;
  /** When true, show form as read-only (no add/delete/edit controls). Used for preview. */
  readOnly?: boolean;
  /** When true, do not call delete API for questions/options (e.g. editing template copy – IDs belong to original template) */
  disableDeleteApi?: boolean;
  /** When true (e.g. "Use template" flow), Save is enabled even when form has no changes, so user can save a copy as-is */
  allowSaveWithoutChanges?: boolean;
}

const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const questionTypeOptions = [
  { value: String(QuestionTypeEnum.ShortAnswer), label: ACTIVITY_FORM.QUESTION_TYPES.SHORT_ANSWER },
  { value: String(QuestionTypeEnum.Paragraph), label: ACTIVITY_FORM.QUESTION_TYPES.PARAGRAPH },
  { value: String(QuestionTypeEnum.Radio), label: ACTIVITY_FORM.QUESTION_TYPES.MULTI_CHOICE },
  { value: String(QuestionTypeEnum.MultiChoice), label: ACTIVITY_FORM.QUESTION_TYPES.CHECKBOXES },
];

const hasOptions = (type: QuestionTypeEnum): boolean => {
  return type === QuestionTypeEnum.Radio || type === QuestionTypeEnum.MultiChoice;
};

const createDefaultQuestion = (): Question => ({
  id: generateId(),
  text: '',
  type: QuestionTypeEnum.ShortAnswer,
  required: false,
  options: [],
});

const createDefaultOption = (): QuestionOption => ({
  id: generateId(),
  text: '',
});

/** Compare two ActivityFormData for equality (name, description, questions/options content). Used to detect edits. */
function formDataEquals(a: ActivityFormData, b: ActivityFormData): boolean {
  if ((a.name ?? '').trim() !== (b.name ?? '').trim()) return false;
  if ((a.description ?? '') !== (b.description ?? '')) return false;
  const qa = a.questions ?? [];
  const qb = b.questions ?? [];
  if (qa.length !== qb.length) return false;
  for (let i = 0; i < qa.length; i++) {
    const q1 = qa[i];
    const q2 = qb[i];
    if ((q1.text ?? '').trim() !== (q2.text ?? '').trim()) return false;
    if (q1.type !== q2.type) return false;
    if (q1.required !== q2.required) return false;
    const o1 = q1.options ?? [];
    const o2 = q2.options ?? [];
    if (o1.length !== o2.length) return false;
    for (let j = 0; j < o1.length; j++) {
      if ((o1[j].text ?? '').trim() !== (o2[j].text ?? '').trim()) return false;
    }
  }
  return true;
}

export const ActivityForm: React.FC<ActivityFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  isEditMode = false,
  hideHeader = false,
  readOnly = false,
  disableDeleteApi = false,
  allowSaveWithoutChanges = false,
}) => {
  const FORM_QUESTIONS_ERROR_KEY = '__questions__';

  const [formData, setFormData] = useState<ActivityFormData>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    questions: initialData?.questions || [],
  });

  // In edit mode, store original loaded data to detect changes (Save disabled until something changes)
  const [originalSnapshot, setOriginalSnapshot] = useState<ActivityFormData | null>(null);
  const lastSnappedKeyRef = useRef<string | null>(null);
  React.useEffect(() => {
    if (!isEditMode || !initialData) {
      setOriginalSnapshot(null);
      lastSnappedKeyRef.current = null;
      return;
    }
    // Only update snapshot when we're loading a different form (stable key from loaded data, not user edits)
    const formKey = initialData.questions?.[0]?.id ?? initialData.name ?? 'empty';
    if (lastSnappedKeyRef.current !== formKey) {
      lastSnappedKeyRef.current = formKey;
      setOriginalSnapshot(JSON.parse(JSON.stringify(initialData)));
    }
  }, [isEditMode, initialData]);

  // Active section tracking
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [isFormDetailsActive, setIsFormDetailsActive] = useState<boolean>(false);

  // Drag and drop state for questions
  const [draggedQuestionId, setDraggedQuestionId] = useState<string | null>(null);
  const [dragOverQuestionId, setDragOverQuestionId] = useState<string | null>(null);

  // Drag and drop state for options
  const [draggedOptionId, setDraggedOptionId] = useState<string | null>(null);
  const [dragOverOptionId, setDragOverOptionId] = useState<string | null>(null);
  const draggedOptionQuestionId = useRef<string | null>(null);

  // Validation errors state
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  // Delete API error (question/option delete failed)
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleFormNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, name: e.target.value }));
  }, []);

  const handleFormDescriptionChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, description: e.target.value }));
  }, []);

  const handleAddQuestion = useCallback(() => {
    const newQuestion = createDefaultQuestion();
    setFormData((prev) => ({
      ...prev,
      questions: [...prev.questions, newQuestion],
    }));
    setActiveQuestionId(newQuestion.id);
    // Clear "add at least one question" error when user adds first question
    setValidationErrors((prev) => {
      const next = { ...prev };
      delete next[FORM_QUESTIONS_ERROR_KEY];
      return next;
    });
  }, []);

  const removeQuestionFromState = useCallback((questionId: string) => {
    setFormData((prev) => ({
      ...prev,
      questions: prev.questions.filter((q) => q.id !== questionId),
    }));
    if (activeQuestionId === questionId) {
      setActiveQuestionId(null);
    }
  }, [activeQuestionId]);

  const handleDeleteQuestion = useCallback(
    (questionId: string) => {
      setDeleteError(null);
      const remove = () => removeQuestionFromState(questionId);
      if (isEditMode && !disableDeleteApi && isServerId(questionId)) {
        deleteQuestionApi(questionId)
          .then(remove)
          .catch((err) =>
            setDeleteError(err instanceof Error ? err.message : 'Failed to delete question')
          );
      } else {
        remove();
      }
    },
    [isEditMode, disableDeleteApi, removeQuestionFromState]
  );

  const handleDuplicateQuestion = useCallback((questionId: string) => {
    setFormData((prev) => {
      const questionIndex = prev.questions.findIndex((q) => q.id === questionId);
      if (questionIndex === -1) return prev;

      const originalQuestion = prev.questions[questionIndex];
      const duplicatedQuestion: Question = {
        ...originalQuestion,
        id: generateId(),
        options: originalQuestion.options.map((opt) => ({
          ...opt,
          id: generateId(),
        })),
      };

      const newQuestions = [...prev.questions];
      newQuestions.splice(questionIndex + 1, 0, duplicatedQuestion);

      return {
        ...prev,
        questions: newQuestions,
      };
    });
  }, []);

  const handleQuestionTextChange = useCallback(
    (questionId: string, text: string) => {
      setFormData((prev) => ({
        ...prev,
        questions: prev.questions.map((q) =>
          q.id === questionId ? { ...q, text } : q
        ),
      }));
      // Clear validation error when user types
      if (text.trim()) {
        setValidationErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[questionId];
          return newErrors;
        });
      }
    },
    []
  );

  const handleQuestionTypeChange = useCallback(
    (questionId: string, typeValue: string) => {
      const newType = parseInt(typeValue, 10) as QuestionTypeEnum;
      setFormData((prev) => ({
        ...prev,
        questions: prev.questions.map((q) => {
          if (q.id !== questionId) return q;
          // If switching from option-based type to non-option type, clear options
          const shouldClearOptions = hasOptions(q.type) && !hasOptions(newType);
          return {
            ...q,
            type: newType,
            options: shouldClearOptions ? [] : q.options,
          };
        }),
      }));
    },
    []
  );

  const handleQuestionRequiredChange = useCallback(
    (questionId: string, required: boolean) => {
      setFormData((prev) => ({
        ...prev,
        questions: prev.questions.map((q) =>
          q.id === questionId ? { ...q, required } : q
        ),
      }));
    },
    []
  );

  const handleAddOption = useCallback((questionId: string) => {
    setFormData((prev) => ({
      ...prev,
      questions: prev.questions.map((q) =>
        q.id === questionId
          ? { ...q, options: [...q.options, createDefaultOption()] }
          : q
      ),
    }));
    // Clear validation error when option is added
    setValidationErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[questionId];
      return newErrors;
    });
  }, []);

  const handleDeleteOption = useCallback(
    (questionId: string, optionId: string) => {
      setDeleteError(null);
      const remove = () => {
        setFormData((prev) => ({
          ...prev,
          questions: prev.questions.map((q) =>
            q.id === questionId
              ? { ...q, options: q.options.filter((o) => o.id !== optionId) }
              : q
          ),
        }));
      };
      if (isEditMode && !disableDeleteApi && isServerId(optionId)) {
        deleteOptionApi(optionId)
          .then(remove)
          .catch((err) =>
            setDeleteError(err instanceof Error ? err.message : 'Failed to delete option')
          );
      } else {
        remove();
      }
    },
    [isEditMode, disableDeleteApi]
  );

  const handleOptionTextChange = useCallback(
    (questionId: string, optionId: string, text: string) => {
      setFormData((prev) => ({
        ...prev,
        questions: prev.questions.map((q) =>
          q.id === questionId
            ? {
                ...q,
                options: q.options.map((o) =>
                  o.id === optionId ? { ...o, text } : o
                ),
              }
            : q
        ),
      }));
    },
    []
  );

  // Question Drag and Drop Handlers
  const handleQuestionDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>, questionId: string) => {
      setDraggedQuestionId(questionId);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', questionId);
      // Add a slight delay to allow the drag image to be captured
      setTimeout(() => {
        (e.target as HTMLElement).classList.add('activity-form__question-card--dragging');
      }, 0);
    },
    []
  );

  const handleQuestionDragEnd = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      (e.target as HTMLElement).classList.remove('activity-form__question-card--dragging');
      setDraggedQuestionId(null);
      setDragOverQuestionId(null);
    },
    []
  );

  const handleQuestionDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>, questionId: string) => {
      e.preventDefault();
      if (draggedQuestionId && draggedQuestionId !== questionId) {
        setDragOverQuestionId(questionId);
      }
    },
    [draggedQuestionId]
  );

  const handleQuestionDragLeave = useCallback(() => {
    setDragOverQuestionId(null);
  }, []);

  const handleQuestionDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>, targetQuestionId: string) => {
      e.preventDefault();
      if (!draggedQuestionId || draggedQuestionId === targetQuestionId) return;

      setFormData((prev) => {
        const questions = [...prev.questions];
        const draggedIndex = questions.findIndex((q) => q.id === draggedQuestionId);
        const targetIndex = questions.findIndex((q) => q.id === targetQuestionId);

        if (draggedIndex === -1 || targetIndex === -1) return prev;

        const [draggedQuestion] = questions.splice(draggedIndex, 1);
        questions.splice(targetIndex, 0, draggedQuestion);

        return { ...prev, questions };
      });

      setDraggedQuestionId(null);
      setDragOverQuestionId(null);
    },
    [draggedQuestionId]
  );

  // Option Drag and Drop Handlers
  const handleOptionDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>, questionId: string, optionId: string) => {
      e.stopPropagation();
      setDraggedOptionId(optionId);
      draggedOptionQuestionId.current = questionId;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', optionId);
      setTimeout(() => {
        (e.target as HTMLElement).classList.add('activity-form__option-item--dragging');
      }, 0);
    },
    []
  );

  const handleOptionDragEnd = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.stopPropagation();
      (e.target as HTMLElement).classList.remove('activity-form__option-item--dragging');
      setDraggedOptionId(null);
      setDragOverOptionId(null);
      draggedOptionQuestionId.current = null;
    },
    []
  );

  const handleOptionDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>, optionId: string) => {
      e.preventDefault();
      e.stopPropagation();
      if (draggedOptionId && draggedOptionId !== optionId) {
        setDragOverOptionId(optionId);
      }
    },
    [draggedOptionId]
  );

  const handleOptionDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setDragOverOptionId(null);
  }, []);

  const handleOptionDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>, questionId: string, targetOptionId: string) => {
      e.preventDefault();
      e.stopPropagation();
      if (!draggedOptionId || draggedOptionId === targetOptionId) return;
      if (draggedOptionQuestionId.current !== questionId) return;

      setFormData((prev) => ({
        ...prev,
        questions: prev.questions.map((q) => {
          if (q.id !== questionId) return q;

          const options = [...q.options];
          const draggedIndex = options.findIndex((o) => o.id === draggedOptionId);
          const targetIndex = options.findIndex((o) => o.id === targetOptionId);

          if (draggedIndex === -1 || targetIndex === -1) return q;

          const [draggedOption] = options.splice(draggedIndex, 1);
          options.splice(targetIndex, 0, draggedOption);

          return { ...q, options };
        }),
      }));

      setDraggedOptionId(null);
      setDragOverOptionId(null);
      draggedOptionQuestionId.current = null;
    },
    [draggedOptionId]
  );

  const handleQuestionFocus = useCallback((questionId: string) => {
    setActiveQuestionId(questionId);
    setIsFormDetailsActive(false);
  }, []);

  const handleFormDetailsFocus = useCallback(() => {
    setIsFormDetailsActive(true);
    setActiveQuestionId(null);
  }, []);

  const validateForm = useCallback((): boolean => {
    const errors: Record<string, string> = {};
    let isValid = true;

    // Create new form: at least one question required
    if (!isEditMode && formData.questions.length === 0) {
      errors[FORM_QUESTIONS_ERROR_KEY] = ACTIVITY_FORM.ERRORS.QUESTIONS_REQUIRED;
      isValid = false;
    }

    // Validate each question
    formData.questions.forEach((question) => {
      // Check if question text is empty
      if (!question.text.trim()) {
        errors[question.id] = ACTIVITY_FORM.ERRORS.QUESTION_TEXT_REQUIRED;
        isValid = false;
      }
      // Multiple choice / Checkbox: options are mandatory (at least one, and each must have text)
      else if (hasOptions(question.type)) {
        if (question.options.length === 0) {
          errors[question.id] = ACTIVITY_FORM.ERRORS.MIN_OPTIONS_REQUIRED;
          isValid = false;
        } else if (question.options.some((o) => !o.text.trim())) {
          errors[question.id] = ACTIVITY_FORM.ERRORS.OPTION_TEXT_REQUIRED;
          isValid = false;
        }
      }
    });

    setValidationErrors(errors);

    // If there are errors, focus on the first question with an error
    if (!isValid) {
      const firstErrorQuestionId = Object.keys(errors).find((k) => k !== FORM_QUESTIONS_ERROR_KEY);
      if (firstErrorQuestionId) {
        setActiveQuestionId(firstErrorQuestionId);
      }
    }

    return isValid;
  }, [formData.questions, formData.questions.length, isEditMode]);

  // Validation only: required fields and option-type questions must have options
  const validationFails = useMemo(() => {
    if (!(formData.name ?? '').trim()) return true;
    // Create new form only: at least one question required (edit can save with 0 questions)
    if (!isEditMode && (formData.questions?.length ?? 0) === 0) return true;
    for (const question of formData.questions ?? []) {
      if (!(question.text ?? '').trim()) return true;
      if (hasOptions(question.type)) {
        const options = question.options ?? [];
        if (options.length === 0) return true;
        if (options.some((o) => !(o.text ?? '').trim())) return true;
      }
    }
    return false;
  }, [formData.name, formData.questions, isEditMode]);

  // In edit mode: hasChanges is true only when current formData differs from the original loaded snapshot
  const hasChanges = useMemo(() => {
    if (originalSnapshot == null) return false; // not in edit or not yet loaded: treat as no changes so edit Save stays disabled until snapshot is set
    return !formDataEquals(formData, originalSnapshot);
  }, [formData, originalSnapshot]);

  const isSaveDisabled = useMemo(() => {
    if (isEditMode) {
      // Edit: disable if no changes (unless allowSaveWithoutChanges, e.g. "Use template" → save copy as-is) OR validation fails
      if (!allowSaveWithoutChanges && !hasChanges) return true;
      return validationFails;
    }
    // Create: disable only when validation fails
    return validationFails;
  }, [isEditMode, allowSaveWithoutChanges, hasChanges, validationFails]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;

    if (!validateForm()) return;

    if (!onSubmit) return;

    const result = onSubmit(formData);
    const maybePromise = result as Promise<void> | undefined;
    if (maybePromise != null && typeof maybePromise.then === 'function') {
      setSubmitting(true);
      maybePromise.finally(() => setSubmitting(false));
    }
  };

  const renderOptionItem = (
    question: Question,
    option: QuestionOption,
    index: number,
    inputType: 'radio' | 'checkbox'
  ) => {
    const isDragOver = dragOverOptionId === option.id;

    if (readOnly) {
      return (
        <div key={option.id} className="activity-form__option-item">
          <div className={`activity-form__option-${inputType}`}>
            <input
              type={inputType}
              name={`preview-${question.id}`}
              disabled
              className={`activity-form__option-${inputType}-input`}
            />
          </div>
          <span className="activity-form__option-text activity-form__option-input">{option.text || `Option ${index + 1}`}</span>
        </div>
      );
    }

    return (
      <div
        key={option.id}
        className={`activity-form__option-item ${isDragOver ? 'activity-form__option-item--drag-over' : ''}`}
        draggable
        onDragStart={(e) => handleOptionDragStart(e, question.id, option.id)}
        onDragEnd={handleOptionDragEnd}
        onDragOver={(e) => handleOptionDragOver(e, option.id)}
        onDragLeave={handleOptionDragLeave}
        onDrop={(e) => handleOptionDrop(e, question.id, option.id)}
      >
        <div className="activity-form__option-drag-handle" title="Drag to reorder">
          <SMSIcon name="menu" size="sm" />
        </div>
        <div className={`activity-form__option-${inputType}`}>
          <input
            type={inputType}
            name={`preview-${question.id}`}
            disabled
            className={`activity-form__option-${inputType}-input`}
          />
        </div>
        <SMSTextField
          value={option.text}
          onChange={(e) =>
            handleOptionTextChange(question.id, option.id, e.target.value)
          }
          placeholder={`${ACTIVITY_FORM.FORM.OPTION_PLACEHOLDER} ${index + 1}`}
          className="activity-form__option-input"
          size="small"
          fullWidth
        />
        <SMSIconButton
          tone="error"
          size="small"
          onClick={() => handleDeleteOption(question.id, option.id)}
          title={ACTIVITY_FORM.FORM.DELETE_OPTION}
          aria-label={ACTIVITY_FORM.FORM.DELETE_OPTION}
          className="activity-form__icon-btn"
        >
          <SMSIcon name="delete" size="sm" />
        </SMSIconButton>
      </div>
    );
  };

  const renderQuestionPreview = (question: Question) => {
    switch (question.type) {
      case QuestionTypeEnum.ShortAnswer:
        return (
          <div className="activity-form__preview">
            <SMSTextField
              placeholder={ACTIVITY_FORM.PREVIEW.SHORT_ANSWER_PLACEHOLDER}
              disabled
              className="activity-form__preview-input"
              size="small"
              fullWidth
            />
          </div>
        );
      case QuestionTypeEnum.Paragraph:
        return (
          <div className="activity-form__preview">
            <SMSTextArea
              placeholder={ACTIVITY_FORM.PREVIEW.PARAGRAPH_PLACEHOLDER}
              disabled
              className="activity-form__preview-textarea"
              rows={3}
              fullWidth
              size="small"
            />
          </div>
        );
      case QuestionTypeEnum.Radio:
        return (
          <div className="activity-form__options">
            {question.options.map((option, index) =>
              renderOptionItem(question, option, index, 'radio')
            )}
            {!readOnly && (
              <SMSButton
                variant="outlined"
                onClick={() => handleAddOption(question.id)}
                className="activity-form__add-option-btn"
              >
                <SMSIcon name="add" size="sm" />
                {ACTIVITY_FORM.FORM.ADD_OPTION}
              </SMSButton>
            )}
          </div>
        );
      case QuestionTypeEnum.MultiChoice:
        return (
          <div className="activity-form__options">
            {question.options.map((option, index) =>
              renderOptionItem(question, option, index, 'checkbox')
            )}
            {!readOnly && (
              <SMSButton
                variant="outlined"
                onClick={() => handleAddOption(question.id)}
                className="activity-form__add-option-btn"
              >
                <SMSIcon name="add" size="sm" />
                {ACTIVITY_FORM.FORM.ADD_OPTION}
              </SMSButton>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="activity-form-page">
      {!hideHeader && (
        <div className="activity-form__header">
          <div className="activity-form__title-section">
            <h1 className="activity-form__title">
              {isEditMode ? ACTIVITY_FORM.EDIT_TITLE : ACTIVITY_FORM.TITLE}
            </h1>
            <p className="activity-form__subtitle">{ACTIVITY_FORM.SUBTITLE}</p>
          </div>
        </div>
      )}

      {deleteError && (
        <div className="activity-form__error" role="alert">
          {deleteError}
        </div>
      )}
      <div className="activity-form__content">
        <SMSCard className="activity-form__main-card" sx={{ p: 2 }}>
          <div className="app-form">
        <form className="app-form__form" onSubmit={handleSubmit}>
          {/* Form Details Section */}
          <div
            className={`app-form__section activity-form__form-details ${isFormDetailsActive && !readOnly ? 'activity-form__form-details--active' : ''}`}
            onClick={readOnly ? undefined : handleFormDetailsFocus}
          >
            <SMSTextField
              label={ACTIVITY_FORM.FORM.FORM_NAME}
              placeholder={ACTIVITY_FORM.FORM.FORM_NAME_PLACEHOLDER}
              value={formData.name}
              onChange={handleFormNameChange}
              onFocus={handleFormDetailsFocus}
              required
              disabled={readOnly}
              size="small"
              fullWidth
            />
            <div className="app-form__full-width">
              <SMSTextArea
                label={ACTIVITY_FORM.FORM.FORM_DESCRIPTION}
                placeholder={ACTIVITY_FORM.FORM.FORM_DESCRIPTION_PLACEHOLDER}
                value={formData.description}
                onChange={handleFormDescriptionChange}
                onFocus={handleFormDetailsFocus}
                rows={3}
                disabled={readOnly}
                size="small"
                fullWidth
              />
            </div>
          </div>

          {/* Questions Section */}
          <div className="activity-form__questions-section">
            <div className="activity-form__questions-header">
              <h3 className="activity-form__questions-title">
                {ACTIVITY_FORM.FORM.QUESTIONS_SECTION}
              </h3>
            </div>

            <div className="activity-form__questions-list">
              {formData.questions.length === 0 ? (
                <div className="activity-form__no-questions">
                  <p>No questions added yet.</p>
                  {validationErrors[FORM_QUESTIONS_ERROR_KEY] && (
                    <p className="activity-form__error activity-form__error--form-level" role="alert">
                      {validationErrors[FORM_QUESTIONS_ERROR_KEY]}
                    </p>
                  )}
                  {!readOnly && (
                    <SMSButton
                      onClick={handleAddQuestion}
                      type="button"
                      className="activity-form__add-first-question-btn"
                    >
                      <SMSIcon name="add" size="sm" />
                      {ACTIVITY_FORM.FORM.ADD_QUESTION}
                    </SMSButton>
                  )}
                </div>
              ) : (
                formData.questions.map((question, index) => {
                const isActive = activeQuestionId === question.id && !readOnly;
                const isDragOver = dragOverQuestionId === question.id;
                const hasError = !!validationErrors[question.id];
                const questionTypeLabel = questionTypeOptions.find((o) => o.value === String(question.type))?.label ?? '';

                return (
                  <div
                    key={question.id}
                    className={`activity-form__question-wrapper ${isDragOver ? 'activity-form__question-wrapper--drag-over' : ''} ${isActive ? 'activity-form__question-wrapper--active' : ''} ${readOnly ? 'activity-form__question-wrapper--read-only' : ''}`}
                    draggable={!readOnly}
                    onDragStart={readOnly ? undefined : (e) => handleQuestionDragStart(e, question.id)}
                    onDragEnd={readOnly ? undefined : handleQuestionDragEnd}
                    onDragOver={readOnly ? undefined : (e) => handleQuestionDragOver(e, question.id)}
                    onDragLeave={readOnly ? undefined : handleQuestionDragLeave}
                    onDrop={readOnly ? undefined : (e) => handleQuestionDrop(e, question.id)}
                  >
                    <SMSCard
                      className={`activity-form__question-card ${isActive ? 'activity-form__question-card--active' : ''} ${hasError ? 'activity-form__question-card--error' : ''}`}
                      sx={{ p: 2 }}
                    >
                      {!readOnly && (
                        <div className="activity-form__question-drag-handle" title="Drag to reorder">
                          <SMSIcon name="menu" size="sm" />
                        </div>
                      )}

                      <div
                        className="activity-form__question-body"
                        onClick={readOnly ? undefined : () => handleQuestionFocus(question.id)}
                        onFocus={readOnly ? undefined : () => handleQuestionFocus(question.id)}
                      >
                        <div className="activity-form__question-header">
                          <span className="activity-form__question-number">
                            Question {index + 1}
                          </span>
                          {hasError && (
                            <span className="activity-form__question-error">
                              {validationErrors[question.id]}
                            </span>
                          )}
                        </div>

                        <div className="activity-form__question-content">
                          <div className="activity-form__question-row">
                            <div className="activity-form__question-text-field">
                              <SMSTextField
                                label={ACTIVITY_FORM.FORM.QUESTION_TEXT}
                                placeholder={ACTIVITY_FORM.FORM.QUESTION_TEXT_PLACEHOLDER}
                                value={question.text}
                                onChange={(e) =>
                                  handleQuestionTextChange(question.id, e.target.value)
                                }
                                onFocus={() => handleQuestionFocus(question.id)}
                                required
                                disabled={readOnly}
                                size="small"
                                fullWidth
                              />
                            </div>
                            {readOnly ? (
                              <div className="activity-form__question-type-field">
                                <span className="activity-form__question-type-label">{ACTIVITY_FORM.FORM.QUESTION_TYPE}</span>
                                <span className="activity-form__question-type-value">{questionTypeLabel}</span>
                              </div>
                            ) : (
                              <div className="activity-form__question-type-field">
                                <SMSDropdown
                                  label={ACTIVITY_FORM.FORM.QUESTION_TYPE}
                                  placeholder={ACTIVITY_FORM.FORM.QUESTION_TYPE_PLACEHOLDER}
                                  options={questionTypeOptions}
                                  value={String(question.type)}
                                  onChange={(e) =>
                                    handleQuestionTypeChange(question.id, String(e.target.value))
                                  }
                                />
                              </div>
                            )}
                          </div>

                          {/* Question Preview/Options */}
                          <div className="activity-form__question-preview">
                            {renderQuestionPreview(question)}
                          </div>
                        </div>

                        {/* Question Footer with Required Toggle and Actions */}
                        {!readOnly && (
                          <div className="activity-form__question-footer">
                            <div className="activity-form__question-actions">
                              <SMSIconButton
                                tone="info"
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDuplicateQuestion(question.id);
                                }}
                                title={ACTIVITY_FORM.FORM.DUPLICATE_QUESTION}
                                aria-label={ACTIVITY_FORM.FORM.DUPLICATE_QUESTION}
                                className="activity-form__icon-btn"
                              >
                                <SMSIcon name="document" size="sm" />
                              </SMSIconButton>
                              <SMSIconButton
                                tone="error"
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteQuestion(question.id);
                                }}
                                title={ACTIVITY_FORM.FORM.DELETE_QUESTION}
                                aria-label={ACTIVITY_FORM.FORM.DELETE_QUESTION}
                                className="activity-form__icon-btn"
                              >
                                <SMSIcon name="delete" size="sm" />
                              </SMSIconButton>
                            </div>
                            <div className="activity-form__question-required">
                              <SMSSwitch
                                label={ACTIVITY_FORM.FORM.REQUIRED}
                                checked={question.required}
                                onChange={(e) =>
                                  handleQuestionRequiredChange(question.id, e.target.checked)
                                }
                              />
                            </div>
                          </div>
                        )}
                        {readOnly && (
                          <div className="activity-form__question-footer activity-form__question-footer--read-only">
                            <span className="activity-form__question-required-label">
                              {question.required ? ACTIVITY_FORM.FORM.REQUIRED : 'Optional'}
                            </span>
                          </div>
                        )}
                      </div>
                    </SMSCard>

                    {/* Floating Action Toolbar */}
                    {!readOnly && isActive && (
                      <div className="activity-form__floating-toolbar">
                        <SMSIconButton
                          tone="success"
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddQuestion();
                          }}
                          title={ACTIVITY_FORM.FORM.ADD_QUESTION}
                          aria-label={ACTIVITY_FORM.FORM.ADD_QUESTION}
                          className="activity-form__icon-btn"
                        >
                          <SMSIcon name="add" size="sm" />
                        </SMSIconButton>
                      </div>
                    )}
                  </div>
                );
              })
              )}
            </div>
          </div>

          {/* Form Actions – same SMSButton + SMSStack pattern as RequesterForm */}
          <SMSStack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            justifyContent="flex-end"
            alignItems={{ xs: 'stretch', sm: 'center' }}
            flexWrap="wrap"
            className="activity-form__actions"
          >
            {onCancel && (
              <SMSButton
                type="button"
                onClick={onCancel}
                disabled={submitting}
                className="activity-form__cancel-button"
              >
                {readOnly ? ACTIVITY_FORM.FORM.BACK_BUTTON : ACTIVITY_FORM.FORM.CANCEL_BUTTON}
              </SMSButton>
            )}
            {!readOnly && (
              <SMSButton
                type="submit"
                className="activity-form__submit-button"
                disabled={isSaveDisabled || submitting}
                loading={submitting}
              >
                {ACTIVITY_FORM.FORM.SUBMIT_BUTTON}
              </SMSButton>
            )}
          </SMSStack>
        </form>
          </div>
        </SMSCard>
      </div>
    </div>
  );
};
