import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { DEPARTMENT_DEFINED_FIELDS } from '@/constants/strings';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  fetchDepartmentDefinedFieldsByDepartmentId,
  clearSelectedDepartmentDefinedFields,
} from '@/store/slices/departmentDefinedFieldsSlice';
import { DepartmentDefinedFieldsForm } from '@/components/smsmolecules/DepartmentDefinedFieldsForm';
import { SMSBox, SMSIcon, SMSIconButton, SMSLoader, SMSTabs, SMSTypography } from '@/components/smsatoms';
import './DepartmentDefinedFieldsList.css';

export interface DepartmentDefinedFieldsListProps {
  className?: string;
}

export const DepartmentDefinedFieldsList: React.FC<DepartmentDefinedFieldsListProps> = ({
  className = '',
}) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { departmentId: departmentIdParam, tab: tabFromPath } = useParams<{ departmentId?: string; tab?: string }>();
  const location = useLocation();
  const departmentName = (location.state as { departmentName?: string } | null)?.departmentName ?? '';

  const { user } = useAppSelector((state) => state.auth);
  const { selectedDepartmentDefinedFields, isLoading: fetchLoading, error: fetchError } = useAppSelector(
    (state) => state.departmentDefinedFields
  );

  const effectiveDepartmentId = departmentIdParam || user?.departmentID;
  const activeTab = tabFromPath === 'post' ? 'post' : 'request';
  const [initialFetchRequested, setInitialFetchRequested] = useState(false);
  const [initialFetchCompleted, setInitialFetchCompleted] = useState(false);

  const prefilledData =
    selectedDepartmentDefinedFields?.departmentID === effectiveDepartmentId
      ? selectedDepartmentDefinedFields
      : undefined;

  useEffect(() => {
    if (!effectiveDepartmentId) {
      navigate('/admin/department', { replace: true });
      return;
    }
    setInitialFetchRequested(true);
    setInitialFetchCompleted(false);
    dispatch(clearSelectedDepartmentDefinedFields());
    dispatch(fetchDepartmentDefinedFieldsByDepartmentId(effectiveDepartmentId));
  }, [effectiveDepartmentId, dispatch, navigate]);

  useEffect(() => {
    if (initialFetchRequested && !fetchLoading) {
      setInitialFetchCompleted(true);
    }
  }, [initialFetchRequested, fetchLoading]);

  useEffect(() => {
    if (effectiveDepartmentId && tabFromPath && tabFromPath !== 'request' && tabFromPath !== 'post') {
      navigate(`/admin/department-defined-fields/${effectiveDepartmentId}/request`, { replace: true });
    }
  }, [effectiveDepartmentId, tabFromPath, navigate]);

  const tabOptions = useMemo(
    () => [
      { id: 'request', label: DEPARTMENT_DEFINED_FIELDS.TABLE.TAB_REQUEST },
      { id: 'post', label: DEPARTMENT_DEFINED_FIELDS.TABLE.TAB_POST },
    ],
    []
  );

  const handleTabChange = (tabId: string) => {
    const next = tabId === 'post' ? 'post' : 'request';
    if (effectiveDepartmentId) {
      navigate(`/admin/department-defined-fields/${effectiveDepartmentId}/${next}`, { replace: true });
    }
  };

  const handleFormSuccess = () => {
    if (effectiveDepartmentId) {
      dispatch(fetchDepartmentDefinedFieldsByDepartmentId(effectiveDepartmentId));
    }
  };

  if (!effectiveDepartmentId) {
    return null;
  }

  const title = departmentName
    ? `${DEPARTMENT_DEFINED_FIELDS.TABLE.TITLE} - ${departmentName}`
    : DEPARTMENT_DEFINED_FIELDS.TABLE.TITLE;

  return (
    <div className={`department-defined-fields-list ${className}`}>
      <div className="department-defined-fields-list__header">
        <SMSIconButton
          type="button"
          onClick={() => navigate('/admin/department')}
          className="department-defined-fields-list__back-button"
          aria-label={DEPARTMENT_DEFINED_FIELDS.BACK_BUTTON_ARIA_LABEL}
          size="small"
        >
          <SMSIcon name="arrowLeft" size="md" />
        </SMSIconButton>
        <SMSTypography component="h1" variant="h5" className="department-defined-fields-list__title">
          {title}
        </SMSTypography>
      </div>

      <div className="department-defined-fields-list__tabs">
        <SMSTabs
          options={tabOptions}
          value={activeTab}
          onChange={handleTabChange}
        />
      </div>

      {fetchError && (
        <SMSBox className="department-defined-fields-list__error" role="alert" sx={{ mb: 2 }}>
          <SMSTypography variant="body2" component="span" sx={{ color: 'inherit' }}>
            {fetchError}
            <span className="department-defined-fields-list__error-hint">
              {' '}
              {DEPARTMENT_DEFINED_FIELDS.ERROR_NETWORK_HINT.replace('{id}', effectiveDepartmentId)}
            </span>
          </SMSTypography>
        </SMSBox>
      )}
      <div className="department-defined-fields-list__content">
        {(!initialFetchCompleted || fetchLoading) && (
          <SMSBox className="department-defined-fields-list__loading" sx={{ py: 3, textAlign: 'center' }}>
            <SMSLoader
              loadingText={DEPARTMENT_DEFINED_FIELDS.TABLE.LOADING}
              aria-label={DEPARTMENT_DEFINED_FIELDS.TABLE.LOADING}
            />
          </SMSBox>
        )}
        {initialFetchCompleted && !fetchLoading && activeTab === 'request' && (
          <div className="department-defined-fields-list__tab-panel">
            <DepartmentDefinedFieldsForm
              key={`request-${effectiveDepartmentId}-${prefilledData?.departmentDefinedFieldID ?? 'new'}`}
              initialData={prefilledData}
              departmentId={effectiveDepartmentId}
              mode="request"
              onSuccess={handleFormSuccess}
              onCancel={() => navigate('/admin/department')}
            />
          </div>
        )}
        {initialFetchCompleted && !fetchLoading && activeTab === 'post' && (
          <div className="department-defined-fields-list__tab-panel">
            <DepartmentDefinedFieldsForm
              key={`post-${effectiveDepartmentId}-${prefilledData?.departmentDefinedFieldID ?? 'new'}`}
              initialData={prefilledData}
              departmentId={effectiveDepartmentId}
              mode="post"
              onSuccess={handleFormSuccess}
              onCancel={() => navigate('/admin/department')}
            />
          </div>
        )}
      </div>
    </div>
  );
};
