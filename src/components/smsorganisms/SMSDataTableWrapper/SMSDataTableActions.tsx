import { SMSButton, SMSIcon, SMSIconButton } from '@/components/smsatoms';
import React from 'react';

export interface SMSDataTableActionsProps {
  onEdit?: () => void;
  onDelete?: () => void;
  onAdd?: () => void;
  onView?: () => void;
  onDepartmentQuestionnaire?: () => void;
  editLabel?: string;
  deleteLabel?: string;
  addLabel?: string;
  viewLabel?: string;
  departmentQuestionnaireLabel?: string;
  editDisabled?: boolean;
  deleteDisabled?: boolean;
  addDisabled?: boolean;
  viewDisabled?: boolean;
  departmentQuestionnaireDisabled?: boolean;
  className?: string;
}

export const SMSDataTableActions: React.FC<SMSDataTableActionsProps> = ({
  onEdit,
  onDelete,
  onAdd,
  onView,
  onDepartmentQuestionnaire,
  editLabel = 'Edit',
  deleteLabel = 'Delete',
  addLabel = 'Add',
  viewLabel = 'View',
  departmentQuestionnaireLabel = 'Department Questionnaire',
  editDisabled = false,
  deleteDisabled = false,
  addDisabled = false,
  viewDisabled = false,
  departmentQuestionnaireDisabled = false,
  className = '',
}) => {
  return (
    <div className={`data-table__actions ${className}`} style={{ display: 'flex', gap: '0.25rem' }}>
      {onAdd && (
        <SMSButton
          variant="outlined"
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
          disabled={addDisabled}
          title={addLabel}
          aria-label={addLabel}
          className="data-table__action-button data-table__action-button--add"
        >
          <SMSIcon name="add_circle" size="sm" />
        </SMSButton>
      )}
      {onView && (
        <SMSButton
          variant="outlined"
          allowWhenSuspended
          onClick={(e) => {
            e.stopPropagation();
            onView();
          }}
          disabled={viewDisabled}
          title={viewLabel}
          aria-label={viewLabel}
          className="data-table__action-button data-table__action-button--view"
        >
          <SMSIcon name="visibility" size="sm" />
        </SMSButton>
      )}
      {onEdit && (
        <SMSIconButton
          size="small"
          tone="primary"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          disabled={editDisabled}
          title={editLabel}
          aria-label={editLabel}
          className="data-table__action-button data-table__action-button--edit"
        >
          <SMSIcon name="edit" size="sm" />
        </SMSIconButton>
      )}
      {onDelete && (
        <SMSIconButton
          size="small"
          tone="error"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          disabled={deleteDisabled}
          title={deleteLabel}
          aria-label={deleteLabel}
          className="data-table__action-button data-table__action-button--delete"
        >
          <SMSIcon name="delete" size="sm" />
        </SMSIconButton>
      )}
      {onDepartmentQuestionnaire && (
        <SMSButton
          variant="outlined"
          allowWhenSuspended
          onClick={(e) => {
            e.stopPropagation();
            onDepartmentQuestionnaire();
          }}
          disabled={departmentQuestionnaireDisabled}
          title={departmentQuestionnaireLabel}
          aria-label={departmentQuestionnaireLabel}
          className="data-table__action-button data-table__action-button--department-questionnaire"
        >
          <SMSIcon name="description" size="sm" color="#5f6368" />
        </SMSButton>
      )}
    </div>
  );
};
