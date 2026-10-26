import React, { useMemo } from 'react';
import { ADD_SKILL } from '@/constants/strings';
import { SkillResponse } from '@/types/skill';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { upsertSkill } from '@/store/slices/skillSlice';
import { ShortLongStatusForm } from '@/components/smsmolecules/ShortLongStatusForm';

export interface SkillFormProps {
  initialData?: SkillResponse | null;
  onSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
}

export const SkillForm: React.FC<SkillFormProps> = ({
  initialData,
  onSuccess,
  onCancel,
  className = '',
}) => {
  const isEditMode = Boolean(initialData?.skillId);

  const dispatch = useAppDispatch();
  const { isLoading, error: reduxError } = useAppSelector((state) => state.skill);

  // IMPORTANT: keep initialValues reference stable across rerenders (e.g. when isLoading toggles),
  // otherwise ShortLongStatusForm will reset the form briefly to old values.
  const initialValues = useMemo(() => {
    return initialData
      ? {
          short: initialData.skillShort || '',
          long: initialData.skillLong || '',
          isActive: initialData.skillStatus ?? true,
          extras: {},
        }
      : undefined;
  }, [initialData?.skillShort, initialData?.skillLong, initialData?.skillStatus]);

  return (
    <ShortLongStatusForm
      className={className}
      isEditMode={isEditMode}
      isLoading={isLoading}
      reduxError={reduxError}
      strings={{
        FORM: {
          TITLE: ADD_SKILL.FORM.TITLE,
          TITLE_PLACEHOLDER: ADD_SKILL.FORM.TITLE_PLACEHOLDER,
          DESCRIPTION: ADD_SKILL.FORM.DESCRIPTION,
          DESCRIPTION_PLACEHOLDER: ADD_SKILL.FORM.DESCRIPTION_PLACEHOLDER,
          IS_ACTIVE: ADD_SKILL.FORM.IS_ACTIVE,
          CANCEL_BUTTON: ADD_SKILL.FORM.CANCEL_BUTTON,
          SUBMIT_BUTTON: ADD_SKILL.FORM.SUBMIT_BUTTON,
          SUBMITTING: ADD_SKILL.FORM.SUBMITTING,
        },
        ERRORS: {
          TITLE_REQUIRED: ADD_SKILL.ERRORS.TITLE_REQUIRED,
          DESCRIPTION_REQUIRED: ADD_SKILL.ERRORS.DESCRIPTION_REQUIRED,
        },
        SUCCESS: {
          ADDED: ADD_SKILL.SUCCESS.SKILL_ADDED,
          UPDATED: ADD_SKILL.SUCCESS.SKILL_UPDATED,
        },
        BUTTON: {
          UPDATE: ADD_SKILL.BUTTON.UPDATE,
          UPDATING: ADD_SKILL.BUTTON.UPDATING,
        },
      }}
      initialValues={initialValues}
      onSubmit={async (values) => {
        const skillId = initialData?.skillId;
        if (isEditMode && skillId) {
          await dispatch(
            upsertSkill({
              skillId,
              skillShort: values.short,
              skillLong: values.long,
              skillStatus: values.isActive,
            })
          ).unwrap();
          return;
        }
        await dispatch(
          upsertSkill({
            skillShort: values.short,
            skillLong: values.long,
            skillStatus: values.isActive,
          })
        ).unwrap();
      }}
      onSuccess={onSuccess}
      onCancel={onCancel}
      showAuditInfo={true}
      auditData={initialData ? {
        createdBy: initialData.createdBy || undefined,
        createdDate: initialData.createdDate || undefined,
        editedBy: initialData.editedBy || undefined,
        editedDate: initialData.editedDate || undefined,
      } : undefined}
    />
  );
};
