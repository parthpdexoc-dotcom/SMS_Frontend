import { SMSButton, SMSCheckbox, SMSLoader } from '@/components/smsatoms';
import React, { useState, useEffect } from 'react';
import { SMSModal as Modal } from '@/components/smsorganisms';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { upsertRequesterQuestionnaireAsync } from '@/store/slices/requesterQuestionnaireSlice';
import { fetchQuestionnairesByDepartment } from '@/store/slices/questionnaireSlice';
import { RequesterQuestionnaireDto } from '@/types/questionnaire';
import './RequesterQuestionnairePopup.css';

export interface RequesterQuestionnairePopupProps {
  isOpen: boolean;
  onClose: () => void;
  requesterId: string;
  title?: string;
  preSelectedQuestionnaireIds?: string[];
}

export const RequesterQuestionnairePopup: React.FC<RequesterQuestionnairePopupProps> = ({
  isOpen,
  onClose,
  requesterId,
  title = 'Select Questionnaires',
  preSelectedQuestionnaireIds = [],
}) => {
  const dispatch = useAppDispatch();
  const { questionnaires, isLoading: questionnairesLoading } = useAppSelector(
    (state) => state.questionnaire
  );
  const { isLoading: upserting, error } = useAppSelector(
    (state) => state.requesterQuestionnaire
  );

  const [selectedQuestionnaireIds, setSelectedQuestionnaireIds] = useState<string[]>(
    preSelectedQuestionnaireIds
  );

  // Fetch questionnaires whenever popup opens so loading state is consistent.
  useEffect(() => {
    if (isOpen) {
      dispatch(fetchQuestionnairesByDepartment());
    }
  }, [isOpen, dispatch]);

  // Reset selections when preSelectedQuestionnaireIds change
  useEffect(() => {
    setSelectedQuestionnaireIds(preSelectedQuestionnaireIds);
  }, [preSelectedQuestionnaireIds]);

  const handleCheckboxChange = (questionnaireId: string, checked: boolean) => {
    setSelectedQuestionnaireIds((prev) => {
      if (checked) {
        return [...prev, questionnaireId];
      } else {
        return prev.filter((id) => id !== questionnaireId);
      }
    });
  };

  const handleSave = async () => {
    try {
      // Create or update RequesterQuestionnaire for each selected questionnaire
      const promises = selectedQuestionnaireIds.map((questionnaireId) => {
        console.log('Processing questionnaireId:', questionnaireId);
        console.log('Full questionnaire object:', questionnaires.find(q => q.questionnaireId === questionnaireId));
        
        return dispatch(
          upsertRequesterQuestionnaireAsync({
            requesterId,
            questionnaireId, // Use questionnaireId directly
          } as RequesterQuestionnaireDto)
        )
      });

      await Promise.all(promises);
      onClose();
    } catch (error) {
      console.error('Failed to save requester questionnaires:', error);
    }
  };

  const isQuestionnaireSelected = (questionnaireId: string) => {
    return selectedQuestionnaireIds.includes(questionnaireId);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="small"
      className="requester-questionnaire-popup"
    >
      <div className="requester-questionnaire-popup__content">
        {questionnairesLoading && (
          <div className="requester-questionnaire-popup__loading" style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}>
            <SMSLoader loadingText="Loading questionnaires..." aria-label="Loading questionnaires..." />
          </div>
        )}

        {error && (
          <div className="requester-questionnaire-popup__error">
            Error: {error}
          </div>
        )}

        {!questionnairesLoading && questionnaires.length === 0 && (
          <div className="requester-questionnaire-popup__empty">
            No questionnaires available.
          </div>
        )}

        {!questionnairesLoading && questionnaires.length > 0 && (
          <div className="requester-questionnaire-popup__list">
            {questionnaires.map((questionnaire) => (
              <div
                key={questionnaire.questionnaireId}
                className="requester-questionnaire-popup__item"
              >
                <SMSCheckbox
                  label={questionnaire.title}
                  checked={isQuestionnaireSelected(questionnaire.questionnaireId)}
                  onChange={(checked) =>
                    handleCheckboxChange(questionnaire.questionnaireId, checked)
                  }
                  disabled={upserting}
                />
                {questionnaire.description && (
                  <div className="requester-questionnaire-popup__item-description">
                    {questionnaire.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="requester-questionnaire-popup__footer">
        <SMSButton
          onClick={onClose}
          disabled={upserting}
          className="requester-questionnaire-popup__cancel-button"
          
        >
          Cancel
        </SMSButton>
        <SMSButton
          onClick={handleSave}
          disabled={upserting || questionnairesLoading}
          className="requester-questionnaire-popup__save-button"
        >
          {upserting ? 'Saving...' : 'Save'}
        </SMSButton>
      </div>
    </Modal>
  );
};
