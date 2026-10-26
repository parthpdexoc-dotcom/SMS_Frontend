import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { SMSBox, SMSLoader } from '@/components/smsatoms';
import { SMSFormPage } from '@/components/smsorganisms';
import { SMSActivityForm, SMSActivityFormFillablePreview } from '@/components/smsorganisms';
import { ACTIVITY_FORM } from '@/constants/strings';
import type { ActivityFormData } from '@/types/activityForm';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  clearCurrentForm,
  clearUpsertError,
  fetchActivityForm,
  selectActivityFormData,
  selectLoadedSourceQuestionnaireId,
  upsertActivityFormThunk,
} from '@/store/slices/activityFormSlice';
import {
  getQuestionnairesByDepartment,
  getAllQuestionnairesByAdmin,
} from '@/services/questionnaireService';
import './ActivityFormPage.css';

/** Returns a title that does not duplicate existing titles: "Name", "Name 1", "Name 2", ... */
function getUniqueFormTitle(baseName: string, existingTitles: string[]): string {
  const trimmed = (baseName ?? '').trim() || 'Untitled Form';
  const set = new Set(existingTitles.map((t) => (t ?? '').trim()));
  if (!set.has(trimmed)) return trimmed;
  for (let n = 1; n <= 9999; n++) {
    const candidate = `${trimmed} ${n}`;
    if (!set.has(candidate)) return candidate;
  }
  return `${trimmed} ${Date.now()}`;
}

export const ActivityFormPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const { id } = useParams<{ id?: string }>();
  const userType = useAppSelector((state) => state.auth.user?.userType);
  const locationState = location.state as {
    templateData?: ActivityFormData;
    saveAsFromTemplate?: boolean;
  } | null;
  const templateData = locationState?.templateData;
  const saveAsFromTemplate = locationState?.saveAsFromTemplate === true;
  const pathname = location.pathname ?? '';
  const isPreviewMode = pathname.includes('/preview/');

  const formDataFromRedux = useAppSelector(selectActivityFormData);
  const loadedSourceQuestionnaireId = useAppSelector(selectLoadedSourceQuestionnaireId);
  const { isLoading, error } = useAppSelector((state) => state.activityForm);

  /** When using template, we fetch existing form titles to assign a unique name (e.g. "Name 1", "Name 2"). */
  const [existingTitles, setExistingTitles] = useState<string[] | null>(null);

  const isEditMode = Boolean(id) && !isPreviewMode;

  const formData = id ? formDataFromRedux : (templateData ?? null);

  useEffect(() => {
    if (!id) {
      dispatch(clearCurrentForm());
      return;
    }
    if (isEditMode || isPreviewMode) {
      dispatch(fetchActivityForm(id));
    }
  }, [id, isEditMode, isPreviewMode, dispatch]);

  useEffect(() => {
    if (!saveAsFromTemplate || !id) {
      setExistingTitles(null);
      return;
    }
    const fetchList =
      userType === 'Admin'
        ? getAllQuestionnairesByAdmin
        : () => getQuestionnairesByDepartment({ page: 1, pageSize: 5000 });
    fetchList()
      .then((list) => setExistingTitles(list.map((q) => (q.title ?? '').trim())))
      .catch(() => setExistingTitles([]));
  }, [saveAsFromTemplate, id, userType]);

  const displayFormData = useMemo((): ActivityFormData | null => {
    if (!formData) return null;
    if (saveAsFromTemplate && existingTitles !== null) {
      const uniqueName = getUniqueFormTitle(formData.name ?? '', existingTitles);
      return { ...formData, name: uniqueName };
    }
    return formData;
  }, [formData, saveAsFromTemplate, existingTitles]);

  const handleCancel = () => {
    navigate('/activity-form');
  };

  const handleSubmit = async (data: ActivityFormData) => {
    dispatch(clearUpsertError());
    try {
      if (isEditMode && saveAsFromTemplate && id) {
        await dispatch(
          upsertActivityFormThunk({ data, questionnaireId: null, sourceQuestionnaireId: id })
        ).unwrap();
      } else if (isEditMode && id) {
        await dispatch(
          upsertActivityFormThunk({
            data,
            questionnaireId: id,
            sourceQuestionnaireId: loadedSourceQuestionnaireId ?? undefined,
          })
        ).unwrap();
      } else {
        await dispatch(upsertActivityFormThunk({ data })).unwrap();
      }
      navigate('/activity-form');
    } catch {
      // upsertError is set by the slice
    }
  };

  if (isPreviewMode) {
    if (isLoading) {
      return (
        <SMSFormPage
          title={ACTIVITY_FORM.PREVIEW_TITLE}
          onCancel={handleCancel}
          backPath="/activity-form"
          className="activity-form-page__form-page"
        >
          <SMSBox className="activity-form-page__loading" sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <SMSLoader loadingText="Loading form..." aria-label="Loading form..." />
          </SMSBox>
        </SMSFormPage>
      );
    }
    if (error) {
      return (
        <SMSFormPage
          title={ACTIVITY_FORM.PREVIEW_TITLE}
          onCancel={handleCancel}
          backPath="/activity-form"
          className="activity-form-page__form-page"
        >
          <div className="activity-form-page__error">{error}</div>
        </SMSFormPage>
      );
    }
    if (!formData) return null;
    return (
      <SMSFormPage
        title={ACTIVITY_FORM.PREVIEW_TITLE}
        onCancel={handleCancel}
        backPath="/activity-form"
        className="activity-form-page__form-page"
      >
        <SMSActivityFormFillablePreview formData={formData} onCancel={handleCancel} />
      </SMSFormPage>
    );
  }

  if (isEditMode) {
    const waitForTitles = saveAsFromTemplate && existingTitles === null;
    if (isLoading || waitForTitles) {
      return (
        <SMSFormPage
          title={ACTIVITY_FORM.EDIT_TITLE}
          onCancel={handleCancel}
          backPath="/activity-form"
          className="activity-form-page__form-page"
        >
          <SMSBox className="activity-form-page__loading" sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <SMSLoader loadingText="Loading form..." aria-label="Loading form..." />
          </SMSBox>
        </SMSFormPage>
      );
    }
    if (error) {
      return (
        <SMSFormPage
          title={ACTIVITY_FORM.EDIT_TITLE}
          onCancel={handleCancel}
          backPath="/activity-form"
          className="activity-form-page__form-page"
        >
          <div className="activity-form-page__error">{error}</div>
        </SMSFormPage>
      );
    }
    if (!displayFormData) return null;
    return (
      <SMSFormPage
        title={ACTIVITY_FORM.EDIT_TITLE}
        onCancel={handleCancel}
        backPath="/activity-form"
        className="activity-form-page__form-page"
      >
        <SMSActivityForm
          initialData={displayFormData}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isEditMode
          hideHeader
          disableDeleteApi={saveAsFromTemplate}
          allowSaveWithoutChanges={saveAsFromTemplate}
        />
      </SMSFormPage>
    );
  }

  return (
    <SMSFormPage
      title={ACTIVITY_FORM.TITLE}
      onCancel={handleCancel}
      backPath="/activity-form"
      className="activity-form-page__form-page"
    >
      <SMSActivityForm
        initialData={formData ?? undefined}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isEditMode={false}
        hideHeader
      />
    </SMSFormPage>
  );
};
