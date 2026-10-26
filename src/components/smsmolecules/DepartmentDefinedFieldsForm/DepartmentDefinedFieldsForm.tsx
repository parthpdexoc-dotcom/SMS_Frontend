import React, { useState, useEffect, useMemo } from 'react';
import { DEPARTMENT_DEFINED_FIELDS } from '@/constants/strings';
import { DepartmentDefinedFieldsResponse, CreateDepartmentDefinedFieldsRequest, UpdateDepartmentDefinedFieldsRequest } from '@/types/departmentDefinedFields';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { upsertDepartmentDefinedFieldsThunk } from '@/store/slices/departmentDefinedFieldsSlice';
import { SMSBox, SMSButton, SMSTextField, SMSTypography } from '@/components/smsatoms';
import './DepartmentDefinedFieldsForm.css';

export type DepartmentDefinedFieldsFormMode = 'request' | 'post' | 'all';

export interface DepartmentDefinedFieldsFormProps {
  initialData?: DepartmentDefinedFieldsResponse | null;
  /** When set, only the request or post section is shown (e.g. for tabbed edit). Default 'all'. */
  mode?: DepartmentDefinedFieldsFormMode;
  /** Required when creating (no initialData) to associate the record with a department. */
  departmentId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
}

interface FormData {
  requestLabels: string[];
  postLabels: string[];
}

const getDefaultFormData = (): FormData => ({
  requestLabels: Array(10).fill(''),
  postLabels: Array(10).fill(''),
});

function extractRequestLabels(d: DepartmentDefinedFieldsResponse): string[] {
  return [
    d.requestDepartmentDefinedFieldInterfaceLabel1 ?? '',
    d.requestDepartmentDefinedFieldInterfaceLabel2 ?? '',
    d.requestDepartmentDefinedFieldInterfaceLabel3 ?? '',
    d.requestDepartmentDefinedFieldInterfaceLabel4 ?? '',
    d.requestDepartmentDefinedFieldInterfaceLabel5 ?? '',
    d.requestDepartmentDefinedFieldInterfaceLabel6 ?? '',
    d.requestDepartmentDefinedFieldInterfaceLabel7 ?? '',
    d.requestDepartmentDefinedFieldInterfaceLabel8 ?? '',
    d.requestDepartmentDefinedFieldInterfaceLabel9 ?? '',
    d.requestDepartmentDefinedFieldInterfaceLabel10 ?? '',
  ];
}
function extractPostLabels(d: DepartmentDefinedFieldsResponse): string[] {
  return [
    d.postDepartmentDefinedFieldInterfaceLabel1 ?? '',
    d.postDepartmentDefinedFieldInterfaceLabel2 ?? '',
    d.postDepartmentDefinedFieldInterfaceLabel3 ?? '',
    d.postDepartmentDefinedFieldInterfaceLabel4 ?? '',
    d.postDepartmentDefinedFieldInterfaceLabel5 ?? '',
    d.postDepartmentDefinedFieldInterfaceLabel6 ?? '',
    d.postDepartmentDefinedFieldInterfaceLabel7 ?? '',
    d.postDepartmentDefinedFieldInterfaceLabel8 ?? '',
    d.postDepartmentDefinedFieldInterfaceLabel9 ?? '',
    d.postDepartmentDefinedFieldInterfaceLabel10 ?? '',
  ];
}

/** Returns indices of labels that share a non-empty value with another label in the same list. */
function getDuplicateLabelIndices(labels: string[]): Set<number> {
  const normalizedToIndices = new Map<string, number[]>();

  labels.forEach((label, index) => {
    const normalized = label.trim().toLowerCase();
    if (!normalized) return;
    const indices = normalizedToIndices.get(normalized) ?? [];
    indices.push(index);
    normalizedToIndices.set(normalized, indices);
  });

  const duplicates = new Set<number>();
  for (const indices of normalizedToIndices.values()) {
    if (indices.length > 1) {
      indices.forEach((index) => duplicates.add(index));
    }
  }
  return duplicates;
}

export const DepartmentDefinedFieldsForm: React.FC<DepartmentDefinedFieldsFormProps> = ({
  initialData,
  mode = 'all',
  departmentId,
  onSuccess,
  onCancel,
  className = '',
}) => {
  const [formData, setFormData] = useState<FormData>(getDefaultFormData());
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const isEditMode = Boolean(initialData?.departmentDefinedFieldID);
  const dispatch = useAppDispatch();
  const { isLoading, error: reduxError } = useAppSelector((state) => state.departmentDefinedFields);
  const effectiveDepartmentId = initialData?.departmentID ?? departmentId ?? '';

  // Initialize form data when initialData is set (e.g. after fetch) or changes
  useEffect(() => {
    if (!initialData) {
      setFormData(getDefaultFormData());
      setSubmitError(null);
      setSubmitSuccess(false);
      return;
    }
    const initialFormData = {
      requestLabels: [
        initialData.requestDepartmentDefinedFieldInterfaceLabel1 ?? '',
        initialData.requestDepartmentDefinedFieldInterfaceLabel2 ?? '',
        initialData.requestDepartmentDefinedFieldInterfaceLabel3 ?? '',
        initialData.requestDepartmentDefinedFieldInterfaceLabel4 ?? '',
        initialData.requestDepartmentDefinedFieldInterfaceLabel5 ?? '',
        initialData.requestDepartmentDefinedFieldInterfaceLabel6 ?? '',
        initialData.requestDepartmentDefinedFieldInterfaceLabel7 ?? '',
        initialData.requestDepartmentDefinedFieldInterfaceLabel8 ?? '',
        initialData.requestDepartmentDefinedFieldInterfaceLabel9 ?? '',
        initialData.requestDepartmentDefinedFieldInterfaceLabel10 ?? '',
      ],
      postLabels: [
        initialData.postDepartmentDefinedFieldInterfaceLabel1 ?? '',
        initialData.postDepartmentDefinedFieldInterfaceLabel2 ?? '',
        initialData.postDepartmentDefinedFieldInterfaceLabel3 ?? '',
        initialData.postDepartmentDefinedFieldInterfaceLabel4 ?? '',
        initialData.postDepartmentDefinedFieldInterfaceLabel5 ?? '',
        initialData.postDepartmentDefinedFieldInterfaceLabel6 ?? '',
        initialData.postDepartmentDefinedFieldInterfaceLabel7 ?? '',
        initialData.postDepartmentDefinedFieldInterfaceLabel8 ?? '',
        initialData.postDepartmentDefinedFieldInterfaceLabel9 ?? '',
        initialData.postDepartmentDefinedFieldInterfaceLabel10 ?? '',
      ],
    };
    setFormData(initialFormData);
    setSubmitError(null);
    setSubmitSuccess(false);
  }, [initialData?.departmentDefinedFieldID, initialData?.departmentID]);

  const handleRequestLabelChange = (index: number, value: string) => {
    setFormData((prev) => {
      const newLabels = [...prev.requestLabels];
      newLabels[index] = value;
      return { ...prev, requestLabels: newLabels };
    });
    setSubmitError(null);
  };

  const handlePostLabelChange = (index: number, value: string) => {
    setFormData((prev) => {
      const newLabels = [...prev.postLabels];
      newLabels[index] = value;
      return { ...prev, postLabels: newLabels };
    });
    setSubmitError(null);
  };

  // Check for duplicate labels (within visible section when mode is request/post)
  const hasDuplicates = useMemo(() => {
    const labels =
      mode === 'post'
        ? formData.postLabels
        : mode === 'request'
          ? formData.requestLabels
          : [...formData.requestLabels, ...formData.postLabels];
    return getDuplicateLabelIndices(labels).size > 0;
  }, [formData, mode]);

  const duplicateRequestIndices = useMemo(() => {
    if (mode === 'post') return new Set<number>();
    const labels =
      mode === 'all'
        ? [...formData.requestLabels, ...formData.postLabels]
        : formData.requestLabels;
    const duplicates = getDuplicateLabelIndices(labels);
    if (mode === 'request') return duplicates;
    return new Set([...duplicates].filter((index) => index < 10));
  }, [formData.requestLabels, formData.postLabels, mode]);

  const duplicatePostIndices = useMemo(() => {
    if (mode === 'request') return new Set<number>();
    const labels =
      mode === 'all'
        ? [...formData.requestLabels, ...formData.postLabels]
        : formData.postLabels;
    const duplicates = getDuplicateLabelIndices(labels);
    if (mode === 'post') return duplicates;
    return new Set([...duplicates].filter((index) => index >= 10).map((index) => index - 10));
  }, [formData.requestLabels, formData.postLabels, mode]);

  const validateForm = (): boolean => {
    const labels =
      mode === 'post'
        ? formData.postLabels
        : mode === 'request'
          ? formData.requestLabels
          : [...formData.requestLabels, ...formData.postLabels];
    for (const label of labels) {
      if (label && label.length > 100) {
        setSubmitError(DEPARTMENT_DEFINED_FIELDS.ERRORS.LABEL_MAX_LENGTH);
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(false);

    if (!validateForm()) {
      return;
    }

    if (hasDuplicates) {
      return;
    }

    // Request tab: only update request labels; send existing post data so post is not changed.
    // Post tab: only update post labels; send existing request data so request is not changed.
    const existingRequest = initialData ? extractRequestLabels(initialData) : Array(10).fill('');
    const existingPost = initialData ? extractPostLabels(initialData) : Array(10).fill('');

    const requestLabels = mode === 'request' ? formData.requestLabels : existingRequest;
    const postLabels = mode === 'post' ? formData.postLabels : existingPost;

    try {
      const payload: CreateDepartmentDefinedFieldsRequest | UpdateDepartmentDefinedFieldsRequest = {
        ...(isEditMode && initialData?.departmentDefinedFieldID
          ? { departmentDefinedFieldID: initialData.departmentDefinedFieldID }
          : {}),
        departmentID: effectiveDepartmentId,
        requestDepartmentDefinedFieldInterfaceLabel1: requestLabels[0] ?? '',
        requestDepartmentDefinedFieldInterfaceLabel2: requestLabels[1] ?? '',
        requestDepartmentDefinedFieldInterfaceLabel3: requestLabels[2] ?? '',
        requestDepartmentDefinedFieldInterfaceLabel4: requestLabels[3] ?? '',
        requestDepartmentDefinedFieldInterfaceLabel5: requestLabels[4] ?? '',
        requestDepartmentDefinedFieldInterfaceLabel6: requestLabels[5] ?? '',
        requestDepartmentDefinedFieldInterfaceLabel7: requestLabels[6] ?? '',
        requestDepartmentDefinedFieldInterfaceLabel8: requestLabels[7] ?? '',
        requestDepartmentDefinedFieldInterfaceLabel9: requestLabels[8] ?? '',
        requestDepartmentDefinedFieldInterfaceLabel10: requestLabels[9] ?? '',
        postDepartmentDefinedFieldInterfaceLabel1: postLabels[0] ?? '',
        postDepartmentDefinedFieldInterfaceLabel2: postLabels[1] ?? '',
        postDepartmentDefinedFieldInterfaceLabel3: postLabels[2] ?? '',
        postDepartmentDefinedFieldInterfaceLabel4: postLabels[3] ?? '',
        postDepartmentDefinedFieldInterfaceLabel5: postLabels[4] ?? '',
        postDepartmentDefinedFieldInterfaceLabel6: postLabels[5] ?? '',
        postDepartmentDefinedFieldInterfaceLabel7: postLabels[6] ?? '',
        postDepartmentDefinedFieldInterfaceLabel8: postLabels[7] ?? '',
        postDepartmentDefinedFieldInterfaceLabel9: postLabels[8] ?? '',
        postDepartmentDefinedFieldInterfaceLabel10: postLabels[9] ?? '',
      } as CreateDepartmentDefinedFieldsRequest | UpdateDepartmentDefinedFieldsRequest;

      await dispatch(upsertDepartmentDefinedFieldsThunk(payload)).unwrap();

      setSubmitSuccess(true);

      setTimeout(() => {
        if (!isEditMode) {
          setFormData(getDefaultFormData());
        }
        setSubmitSuccess(false);
        setSubmitError(null);
        // Small delay to ensure Redux state has updated
        setTimeout(() => {
          if (onSuccess) {
            onSuccess();
          }
        }, 50);
      }, 1500);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : DEPARTMENT_DEFINED_FIELDS.ERRORS.SUBMIT_FAILED);
    }
  };

  return (
    <div className={`department-defined-fields-form ${className}`}>
      {submitSuccess && (
        <SMSBox className="department-defined-fields-form__success" sx={{ mb: 2 }}>
          <SMSTypography color="success.main" variant="body2">
            {isEditMode ? DEPARTMENT_DEFINED_FIELDS.SUCCESS.UPDATED : DEPARTMENT_DEFINED_FIELDS.SUCCESS.ADDED}
          </SMSTypography>
        </SMSBox>
      )}

      {(submitError || reduxError) && (
        <SMSBox className="department-defined-fields-form__error" sx={{ mb: 2 }} role="alert">
          <SMSTypography color="error" variant="body2">
            {submitError || reduxError}
          </SMSTypography>
        </SMSBox>
      )}

      <form onSubmit={handleSubmit} className="department-defined-fields-form__form">
        {(mode === 'all' || mode === 'request') && (
          <div className="department-defined-fields-form__section">
            <SMSTypography
              component="h3"
              variant="h6"
              className="department-defined-fields-form__section-title"
              gutterBottom
            >
              {DEPARTMENT_DEFINED_FIELDS.FORM.REQUEST_FIELDS_SECTION}
            </SMSTypography>
            <SMSTypography
              variant="body2"
              color="text.secondary"
              className="department-defined-fields-form__section-description"
              paragraph
            >
              {DEPARTMENT_DEFINED_FIELDS.FORM.REQUEST_FIELDS_DESCRIPTION}
            </SMSTypography>
            <div className="department-defined-fields-form__labels-grid">
              {formData.requestLabels.map((label, index) => (
                <SMSTextField
                  key={`request-label-${index}`}
                  fullWidth
                  label={`${DEPARTMENT_DEFINED_FIELDS.FORM.REQUEST_LABEL} ${index + 1}`}
                  placeholder={`Enter label ${index + 1}`}
                  value={label}
                  onChange={(e) => handleRequestLabelChange(index, e.target.value)}
                  inputProps={{ maxLength: 100 }}
                  disabled={isLoading}
                  error={duplicateRequestIndices.has(index)}
                  helperText={
                    duplicateRequestIndices.has(index)
                      ? DEPARTMENT_DEFINED_FIELDS.ERRORS.DUPLICATE_LABEL
                      : undefined
                  }
                />
              ))}
            </div>
          </div>
        )}

        {(mode === 'all' || mode === 'post') && (
          <div className="department-defined-fields-form__section">
            <SMSTypography
              component="h3"
              variant="h6"
              className="department-defined-fields-form__section-title"
              gutterBottom
            >
              {DEPARTMENT_DEFINED_FIELDS.FORM.POST_FIELDS_SECTION}
            </SMSTypography>
            <SMSTypography
              variant="body2"
              color="text.secondary"
              className="department-defined-fields-form__section-description"
              paragraph
            >
              {DEPARTMENT_DEFINED_FIELDS.FORM.POST_FIELDS_DESCRIPTION}
            </SMSTypography>
            <div className="department-defined-fields-form__labels-grid">
              {formData.postLabels.map((label, index) => (
                <SMSTextField
                  key={`post-label-${index}`}
                  fullWidth
                  label={`${DEPARTMENT_DEFINED_FIELDS.FORM.POST_LABEL} ${index + 1}`}
                  placeholder={`Enter label ${index + 1}`}
                  value={label}
                  onChange={(e) => handlePostLabelChange(index, e.target.value)}
                  inputProps={{ maxLength: 100 }}
                  disabled={isLoading}
                  error={duplicatePostIndices.has(index)}
                  helperText={
                    duplicatePostIndices.has(index)
                      ? DEPARTMENT_DEFINED_FIELDS.ERRORS.DUPLICATE_LABEL
                      : undefined
                  }
                />
              ))}
            </div>
          </div>
        )}

        {/* Form Actions */}
        <div className="form-modal__footer">
          {onCancel && (
            <SMSButton
              type="button"
              onClick={onCancel}
              disabled={isLoading}
            >
              {DEPARTMENT_DEFINED_FIELDS.FORM.CANCEL_BUTTON}
            </SMSButton>
          )}
          <SMSButton
            type="submit"
            disabled={isLoading || hasDuplicates}
            loading={isLoading}
            fullWidth={!onCancel}
          >
            {DEPARTMENT_DEFINED_FIELDS.FORM.SUBMIT_BUTTON}
          </SMSButton>
        </div>
      </form>
    </div>
  );
};
