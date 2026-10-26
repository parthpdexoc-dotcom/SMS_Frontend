import { SMSButton } from '@/components/smsatoms';
import React, { useState } from 'react';
import { RequesterQuestionnairePopup } from '@/components/smsmolecules/RequesterQuestionnairePopup/RequesterQuestionnairePopup';

/**
 * Example component demonstrating how to use the RequesterQuestionnairePopup
 */
export const RequesterQuestionnaireExample: React.FC = () => {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  
  // Example requester ID - in a real app, this would come from your auth state or props
  const exampleRequesterId = '123e4567-e89b-12d3-a456-426614174000';
  
  // Example pre-selected questionnaire IDs
  const preSelectedIds = ['456e7890-e89b-12d3-a456-426614174001'];

  const handleOpenPopup = () => {
    setIsPopupOpen(true);
  };

  const handleClosePopup = () => {
    setIsPopupOpen(false);
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Requester Questionnaire Example</h2>
      <p>
        This example demonstrates how to integrate the RequesterQuestionnaireController 
        /UpsertAsync API with a popup containing checkboxes for selecting questionnaires.
      </p>
      
      <SMSButton
        size="large"
        onClick={handleOpenPopup}
      >
        Open Questionnaire Selection Popup
      </SMSButton>

      <RequesterQuestionnairePopup
        isOpen={isPopupOpen}
        onClose={handleClosePopup}
        requesterId={exampleRequesterId}
        title="Select Questionnaires for Requester"
        preSelectedQuestionnaireIds={preSelectedIds}
      />
    </div>
  );
};
