import { SMSButton, SMSStack, SMSCard, SMSIcon, SMSTextArea, SMSTextField } from '@/components/smsatoms';
import React, { useState, useCallback, useEffect } from 'react';
import { ACTIVITY_FORM } from '@/constants/strings';
import { QuestionTypeEnum, ActivityFormData } from '@/types/activityForm';
import './SMSActivityForm.css';

export interface ActivityFormFillablePreviewProps {
  /** Form structure (loaded by id; when admin updates form, pass new data to reflect here) */
  formData: ActivityFormData;
  onCancel?: () => void;
}

/** Responses per question: string for single value, string[] for checkboxes */
type ResponseMap = Record<string, string | string[]>;

export const ActivityFormFillablePreview: React.FC<ActivityFormFillablePreviewProps> = ({
  formData,
  onCancel,
}) => {
  const [responses, setResponses] = useState<ResponseMap>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // When form structure changes (admin updated form or different form loaded), reset responses
  const formStructureKey = (formData.questions ?? [])
    .map((q) => `${q.id}:${(q.options ?? []).length}`)
    .join('|');
  useEffect(() => {
    setResponses({});
    setValidationErrors({});
  }, [formData.name, formData.questions?.length, formStructureKey]);

  const setResponse = useCallback((questionId: string, value: string | string[]) => {
    setResponses((prev) => ({ ...prev, [questionId]: value }));
    setValidationErrors((prev) => {
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
  }, []);

  const validate = useCallback((): boolean => {
    const errors: Record<string, string> = {};
    for (const q of formData.questions ?? []) {
      if (!q.required) continue;
      const value = responses[q.id];
      if (q.type === QuestionTypeEnum.MultiChoice) {
        const arr = Array.isArray(value) ? value : [];
        if (arr.length === 0) errors[q.id] = ACTIVITY_FORM.PREVIEW.QUESTION_REQUIRED;
      } else {
        const str = typeof value === 'string' ? value : '';
        if (!str.trim()) errors[q.id] = ACTIVITY_FORM.PREVIEW.QUESTION_REQUIRED;
      }
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData.questions, responses]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    // Demo: no API call; validation errors are already shown
  };

  return (
    <div className="activity-form-fillable-preview">
      <SMSCard className="activity-form__main-card" sx={{ p: 2 }}>
        <div className="activity-form-fillable-preview__intro">
          <h2 className="activity-form-fillable-preview__title">{formData.name || 'Untitled Form'}</h2>
          {formData.description && (
            <p className="activity-form-fillable-preview__description">{formData.description}</p>
          )}
        </div>

        <form className="app-form__form" onSubmit={handleSubmit}>
          <div className="activity-form-fillable-preview__questions">
            {(formData.questions ?? []).map((question, index) => {
              const error = validationErrors[question.id];
              const value = responses[question.id];

              return (
                <div
                  key={question.id}
                  className={`activity-form-fillable-preview__question ${error ? 'activity-form-fillable-preview__question--error' : ''}`}
                >
                  <label className="activity-form-fillable-preview__label">
                    <span className="activity-form-fillable-preview__label-text">
                      {index + 1}. {question.text || 'Question'}
                      {question.required && <span className="activity-form-fillable-preview__required"> *</span>}
                    </span>
                  </label>

                  {question.type === QuestionTypeEnum.ShortAnswer && (
                    <SMSTextField
                      value={typeof value === 'string' ? value : ''}
                      onChange={(e) => setResponse(question.id, e.target.value)}
                      placeholder={ACTIVITY_FORM.PREVIEW.SHORT_ANSWER_PLACEHOLDER}
                      className={`activity-form-fillable-preview__input ${error ? 'activity-form-fillable-preview__input--error' : ''}`}
                      error={Boolean(error)}
                      fullWidth
                    />
                  )}

                  {question.type === QuestionTypeEnum.Paragraph && (
                    <SMSTextArea
                      value={typeof value === 'string' ? value : ''}
                      onChange={(e) => setResponse(question.id, e.target.value)}
                      placeholder={ACTIVITY_FORM.PREVIEW.PARAGRAPH_PLACEHOLDER}
                      rows={3}
                      className={`activity-form-fillable-preview__input ${error ? 'activity-form-fillable-preview__input--error' : ''}`}
                      error={Boolean(error)}
                      fullWidth
                    />
                  )}

                  {question.type === QuestionTypeEnum.Radio && (
                    <div className="activity-form-fillable-preview__options" role="radiogroup" aria-label={question.text}>
                      {(question.options ?? []).map((opt) => (
                        <label key={opt.id} className="activity-form-fillable-preview__option">
                          <input
                            type="radio"
                            name={`q-${question.id}`}
                            checked={value === opt.id}
                            onChange={() => setResponse(question.id, opt.id)}
                          />
                          <span>{opt.text || 'Option'}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {question.type === QuestionTypeEnum.MultiChoice && (
                    <div className="activity-form-fillable-preview__options" role="group" aria-label={question.text}>
                      {(question.options ?? []).map((opt) => {
                        const selected = Array.isArray(value) ? value.includes(opt.id) : false;
                        return (
                          <label key={opt.id} className="activity-form-fillable-preview__option">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={(e) => {
                                const arr = Array.isArray(value) ? [...value] : [];
                                if (e.target.checked) {
                                  setResponse(question.id, [...arr, opt.id]);
                                } else {
                                  setResponse(question.id, arr.filter((id) => id !== opt.id));
                                }
                              }}
                            />
                            <span>{opt.text || 'Option'}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {error && (
                    <div className="activity-form-fillable-preview__error-row" role="alert">
                      <span className="activity-form-fillable-preview__error-icon">
                        <SMSIcon name="error" size="sm" />
                      </span>
                      <span className="activity-form-fillable-preview__error-text">{error}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <SMSStack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            justifyContent="flex-end"
            alignItems={{ xs: 'stretch', sm: 'center' }}
            flexWrap="wrap"
            className="activity-form__actions activity-form-fillable-preview__actions"
          >
            {onCancel && (
              <SMSButton type="button" onClick={onCancel}>
                {ACTIVITY_FORM.FORM.BACK_BUTTON}
              </SMSButton>
            )}
            <SMSButton type="submit">
              {ACTIVITY_FORM.PREVIEW.SUBMIT_DEMO}
            </SMSButton>
          </SMSStack>
        </form>
      </SMSCard>
    </div>
  );
};
