import React, { useState, useEffect, useLayoutEffect, useMemo } from 'react';
import { SMSBox, SMSButton, SMSDropdown, SMSTextField, SMSTypography } from '@/components/smsatoms';
import { RichTextEditor } from '@/components/smsmolecules/RichTextEditor';
import { EMAIL_TEMPLATES } from '@/constants/strings';
import { EmailTemplateDto, EmailTypeEnum, EmailTypeOptionDto } from '@/types/emailTemplate';
import { getKeywordsByEmailType } from '@/services/emailTemplateService';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchEmailTypes } from '@/store/slices/emailTemplateSlice';
import './SMSEmailTemplateForm.css';

export interface SMSEmailTemplateFormProps {
  initialData?: EmailTemplateDto | null;
  /** Existing templates from GET; used to hide email types already in use by other templates. */
  existingTemplates?: EmailTemplateDto[];
  onSave: (dto: EmailTemplateDto) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  error?: string | null;
  className?: string;
}

function toDropdownOptions(dtos: EmailTypeOptionDto[]): { value: string; label: string }[] {
  return dtos.map((o) => ({ value: String(o.value), label: o.label }));
}

export const SMSEmailTemplateForm: React.FC<SMSEmailTemplateFormProps> = ({
  initialData,
  existingTemplates = [],
  onSave,
  onCancel,
  isLoading = false,
  error,
  className = '',
}) => {
  const [name, setName] = useState(initialData?.name ?? '');
  const [subject, setSubject] = useState(initialData?.subject ?? '');
  const [emailType, setEmailType] = useState<EmailTypeEnum | ''>(
    initialData?.emailType !== undefined && initialData?.emailType !== null ? initialData.emailType : ''
  );
  const [body, setBody] = useState(initialData?.body ?? '');
  const [smsBody, setSmsBody] = useState(initialData?.smsBody ?? '');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [editorKeywords, setEditorKeywords] = useState<string[]>([]);
  const dispatch = useAppDispatch();
  const { emailTypes, emailTypesLoading, emailTypesError } = useAppSelector((s) => s.emailTemplate);

  const allEmailTypeDropdownOptions = useMemo(
    () => toDropdownOptions(emailTypes),
    [emailTypes]
  );

  useLayoutEffect(() => {
    void dispatch(fetchEmailTypes());
  }, [dispatch]);

  const emailTypeOptions = useMemo(() => {
    const currentId = String(initialData?.emailTemplateID ?? '');
    const inUseByOthers = new Set(
      existingTemplates
        .filter(
          (t) =>
            String(t.emailTemplateID) !== currentId && t.emailType !== undefined && t.emailType !== null
        )
        .map((t) => t.emailType as number)
    );
    const filtered = allEmailTypeDropdownOptions.filter((opt) => !inUseByOthers.has(Number(opt.value)));
    // Always show a label for the value being edited, even if another template "uses" the same
    // type (bad data) or the ID was mismatched: otherwise the dropdown has no option and shows "11".
    const selected =
      emailType === '' || emailType === undefined || emailType === null
        ? undefined
        : Number(emailType);
    if (selected === undefined || Number.isNaN(selected)) {
      return filtered;
    }
    if (filtered.some((opt) => Number(opt.value) === selected)) {
      return filtered;
    }
    const fromApi = emailTypes.find((o) => o.value === selected);
    if (fromApi) {
      return [{ value: String(fromApi.value), label: fromApi.label }, ...filtered];
    }
    return filtered;
  }, [allEmailTypeDropdownOptions, emailTypes, existingTemplates, initialData?.emailTemplateID, emailType]);

  useEffect(() => {
    if (emailType === '' || emailType === undefined || emailType === null) {
      setEditorKeywords([]);
      return;
    }
    const ac = new AbortController();
    setEditorKeywords([]);
    void (async () => {
      try {
        const list = await getKeywordsByEmailType(emailType, { signal: ac.signal });
        if (!ac.signal.aborted) {
          setEditorKeywords(list);
        }
      } catch (e) {
        if (ac.signal.aborted || (e instanceof DOMException && e.name === 'AbortError')) {
          return;
        }
        if (!ac.signal.aborted) {
          setEditorKeywords([]);
        }
      }
    })();
    return () => ac.abort();
  }, [emailType]);

  useEffect(() => {
    setName(initialData?.name ?? '');
    setSubject(initialData?.subject ?? '');
    setEmailType(
      initialData?.emailType !== undefined && initialData?.emailType !== null ? initialData.emailType : ''
    );
    setBody(initialData?.body ?? '');
    setSmsBody(initialData?.smsBody ?? '');
    setFieldErrors({});
  }, [initialData]);

  const validate = (): boolean => {
    const err: Record<string, string> = {};
    if (!name.trim()) err.name = 'Template name is required';
    if (!subject.trim()) err.subject = 'Subject is required';
    // Do not use `!emailType`: Cancelled = 0 is a valid selection but falsy in JavaScript
    if (emailType == null || emailType === '') err.emailType = 'Email type is required';
    const bodyText = body.replace(/<[^>]*>/g, '').trim();
    if (!bodyText) err.body = 'Body is required';
    setFieldErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || isLoading) return;
    const dto: EmailTemplateDto = {
      emailTemplateID: initialData?.emailTemplateID ?? '',
      name: name.trim(),
      subject: subject.trim(),
      body: body.trim(),
      smsBody: smsBody.trim(),
      emailType: emailType === '' ? undefined : emailType,
    };
    await onSave(dto);
  };

  const strings = EMAIL_TEMPLATES.FORM;

  return (
    <form
      className={`email-template-form ${className}`.trim()}
      onSubmit={handleSubmit}
      noValidate
    >
      {error && (
        <SMSBox className="email-template-form__error" sx={{ mb: 1 }} role="alert">
          <SMSTypography variant="body2" sx={{ color: 'inherit' }}>
            {error}
          </SMSTypography>
        </SMSBox>
      )}

      <div className="email-template-form__row email-template-form__row--two-col">
        <div className="email-template-form__field">
          <SMSTextField
            fullWidth
            label={strings.NAME}
            placeholder={strings.NAME_PLACEHOLDER}
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={Boolean(fieldErrors.name)}
            helperText={fieldErrors.name}
            name="name"
            required
            disabled={isLoading}
          />
        </div>
        <div className="email-template-form__field">
          <SMSDropdown
            id="email-type"
            label={strings.EMAIL_TYPE}
            options={emailTypeOptions}
            value={emailType === '' ? '' : String(emailType)}
            onChange={(e) => {
              const v = e.target.value;
              setEmailType(v === '' ? '' : (Number(v) as EmailTypeEnum));
            }}
            placeholder={strings.EMAIL_TYPE_PLACEHOLDER}
            disabled={isLoading || emailTypesLoading}
            required
            error={Boolean(fieldErrors.emailType || emailTypesError)}
            helperText={fieldErrors.emailType ?? emailTypesError ?? undefined}
          />
        </div>
      </div>
      <div className="email-template-form__field">
        <SMSTextField
          fullWidth
          label={strings.SUBJECT}
          placeholder={strings.SUBJECT_PLACEHOLDER}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          error={Boolean(fieldErrors.subject)}
          helperText={fieldErrors.subject}
          name="subject"
          required
          disabled={isLoading}
        />
      </div>
      <div className="email-template-form__field">
        <RichTextEditor
          label={strings.BODY}
          placeholder={strings.BODY_PLACEHOLDER}
          value={body}
          onChange={setBody}
          keywords={editorKeywords}
          alwaysShowKeywordDropdown
          keywordDropdownDisabled={emailType === ''}
          error={fieldErrors.body}
          disabled={isLoading}
          minHeight="200px"
          secondaryEditor={{
            id: 'sms-body',
            label: strings.SMS_BODY,
            placeholder: strings.SMS_BODY_PLACEHOLDER,
            value: smsBody,
            onChange: setSmsBody,
            error: fieldErrors.smsBody,
            disabled: isLoading,
            minHeight: '120px',
          }}
        />
      </div>
      <div className="email-template-form__actions">
        <SMSButton
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          
        >
          {strings.CANCEL}
        </SMSButton>
        <SMSButton type="submit" disabled={isLoading} loading={isLoading}>
          {strings.SAVE}
        </SMSButton>
      </div>
    </form>
  );
};
