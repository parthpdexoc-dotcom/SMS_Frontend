import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SMSFormPage } from '@/components/smsorganisms';
import { SMSEmailTemplateForm } from '@/components/smsmolecules/SMSEmailTemplateForm';
import { EMAIL_TEMPLATES } from '@/constants/strings';
import { EmailTemplateDto } from '@/types/emailTemplate';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  fetchEmailTemplates,
  upsertEmailTemplateThunk,
  clearSaveError,
} from '@/store/slices/emailTemplateSlice';
import { getEmailTemplateById, getEmailTemplates } from '@/services/emailTemplateService';
import { SMSBox, SMSLoader, SMSTypography } from '@/components/smsatoms';
import './EmailTemplateFormPage.css';

const LIST_PATH = '/email-templates';
/** List page is paginated; load enough rows to know which email types are already taken. */
const TEMPLATES_PAGE_SIZE_FOR_TYPE_FILTER = 1000;

export const EmailTemplateFormPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const { saveLoading, saveError } = useAppSelector((state) => state.emailTemplate);
  const list = useAppSelector((state) => state.emailTemplate.emailTemplates);

  const [initialData, setInitialData] = useState<EmailTemplateDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  /** Full (or large) template list for hiding email types already in use; Redux list is only one page. */
  const [templatesForTypeFilter, setTemplatesForTypeFilter] = useState<EmailTemplateDto[] | null>(null);

  const isEditMode = Boolean(id);

  useEffect(() => {
    let active = true;
    setTemplatesForTypeFilter(null);
    void getEmailTemplates({ page: 1, pageSize: TEMPLATES_PAGE_SIZE_FOR_TYPE_FILTER })
      .then(({ data }) => {
        if (active) setTemplatesForTypeFilter(data ?? []);
      })
      .catch(() => {
        if (active) setTemplatesForTypeFilter([]);
      });
    return () => {
      active = false;
    };
  }, [id]);

  // In edit mode: get template from list or fetch by id
  useEffect(() => {
    if (!id) {
      setInitialData(null);
      setLoadError(null);
      return;
    }
    const fromList = list.find((t) => t.emailTemplateID === id);
    if (fromList) {
      setInitialData(fromList);
      setLoadError(null);
      return;
    }
    setLoadingTemplate(true);
    setLoadError(null);
    getEmailTemplateById(id)
      .then((template) => {
        if (template) setInitialData(template);
        else setLoadError('Email template not found.');
      })
      .catch(() => setLoadError('Failed to load email template.'))
      .finally(() => setLoadingTemplate(false));
  }, [id, list]);

  const handleCancel = () => navigate(LIST_PATH);

  const handleSave = (dto: EmailTemplateDto) => {
    dispatch(clearSaveError());
    return dispatch(upsertEmailTemplateThunk(dto))
      .unwrap()
      .then(() => {
        dispatch(fetchEmailTemplates());
        navigate(LIST_PATH);
      });
  };

  const title = isEditMode ? EMAIL_TEMPLATES.FORM.TITLE_EDIT : EMAIL_TEMPLATES.FORM.TITLE_NEW;
  const subtitle = isEditMode
    ? 'Update the email template details below.'
    : 'Create a new email template by filling in the details below.';

  const existingTemplatesForForm =
    templatesForTypeFilter !== null ? templatesForTypeFilter : list;

  if (isEditMode && loadingTemplate) {
    return (
      <div className="email-template-form-page">
        <SMSFormPage title={title} subtitle={subtitle} backPath={LIST_PATH}>
          <SMSBox className="email-template-form-page__loading" sx={{ py: 2, display: 'flex', justifyContent: 'center' }}>
            <SMSLoader loadingText="Loading template..." aria-label="Loading template..." />
          </SMSBox>
        </SMSFormPage>
      </div>
    );
  }

  if (isEditMode && loadError) {
    return (
      <div className="email-template-form-page">
        <SMSFormPage title={title} backPath={LIST_PATH}>
          <SMSBox className="email-template-form-page__error" sx={{ py: 2 }} role="alert">
            <SMSTypography color="error" variant="body2">
              {loadError}
            </SMSTypography>
          </SMSBox>
        </SMSFormPage>
      </div>
    );
  }

  return (
    <div className="email-template-form-page">
      <SMSFormPage title={title} subtitle={subtitle} backPath={LIST_PATH}>
        <SMSEmailTemplateForm
          initialData={initialData}
          existingTemplates={existingTemplatesForForm}
          onSave={handleSave}
          onCancel={handleCancel}
          isLoading={saveLoading}
          error={saveError}
        />
      </SMSFormPage>
    </div>
  );
};
