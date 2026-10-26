import { SMSIcon, SMSIconButton, SMSLoader } from '@/components/smsatoms';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SMSFormPage } from '@/components/smsorganisms';
import { SMSDepartmentConfigurationForm } from '@/components/smsmolecules/SMSDepartmentConfigurationForm';
import { SMSConfirmDialog } from '@/components/smsmolecules';
import { getDepartmentConfigurationByDepartmentId, deleteDepartmentConfiguration } from '@/services/departmentConfigurationService';
import { DepartmentConfigurationResponse } from '@/types/departmentConfiguration';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchDepartmentConfigByDepartmentId } from '@/store/slices/departmentConfigurationSlice';
import { showToast } from '@/store/slices/toastSlice';

export const DepartmentConfigurationFormPage: React.FC = () => {
  const navigate = useNavigate();
  const { departmentId } = useParams<{ departmentId?: string }>();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);

  const [config, setConfig] = useState<DepartmentConfigurationResponse | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [deletingConfig, setDeletingConfig] = useState<DepartmentConfigurationResponse | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // On load: fetch config by department ID from JWT (GET /DepartmentConfiguration/{departmentId})
  useEffect(() => {
    const effectiveDepartmentId = departmentId || user?.departmentID;
    if (effectiveDepartmentId) {
      setConfigLoading(true);
      getDepartmentConfigurationByDepartmentId(effectiveDepartmentId)
        .then((data) => setConfig(data ?? null))
        .catch(() => setConfig(null))
        .finally(() => setConfigLoading(false));
    } else {
      setConfigLoading(false);
      setConfig(null);
    }
  }, [departmentId, user?.departmentID]);

  const handleSuccess = (saved: DepartmentConfigurationResponse) => {
    setConfig(saved);
    const id = saved.departmentID || departmentId || user?.departmentID;
    if (id) dispatch(fetchDepartmentConfigByDepartmentId(id));
  };

  const handleCancel = () => {
    navigate(-1);
  };

  const handleDeleteClick = () => {
    if (config?.deptConfigID) setDeletingConfig(config);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingConfig?.deptConfigID) return;
    setDeleteLoading(true);
    try {
      await deleteDepartmentConfiguration(deletingConfig.deptConfigID);
      const id = deletingConfig.departmentID || departmentId || user?.departmentID;
      if (id) dispatch(fetchDepartmentConfigByDepartmentId(id));
      dispatch(showToast('Department configuration deleted successfully.', 'success'));
      setConfig(null);
      setDeletingConfig(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete department configuration.';
      dispatch(showToast(message, 'error'));
    } finally {
      setDeleteLoading(false);
      setDeletingConfig(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeletingConfig(null);
  };

  if (configLoading) {
    return (
      <SMSFormPage title="Department Configuration" onCancel={handleCancel}>
        <div style={{ padding: '2rem', display: 'flex', justifyContent: 'center' }}>
          <SMSLoader
            loadingText="Loading department configuration..."
            aria-label="Loading department configuration..."
          />
        </div>
      </SMSFormPage>
    );
  }

  const hasData = Boolean(config?.deptConfigID);

  return (
    <>
      <SMSFormPage
        title="Department Configuration"
        subtitle={hasData ? undefined : 'Configure department settings'}
        onCancel={handleCancel}
        titleActions={
          hasData ? (
            <SMSIconButton
              type="button"
              size="small"
              tone="error"
              onClick={handleDeleteClick}
              disabled={deleteLoading}
              aria-label="Delete department configuration"
              title="Delete"
            >
              <SMSIcon name="delete" size="sm" />
            </SMSIconButton>
          ) : undefined
        }
      >
        <SMSDepartmentConfigurationForm
          initialData={config ?? undefined}
          departmentId={departmentId || user?.departmentID}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      </SMSFormPage>
      <SMSConfirmDialog
        open={!!deletingConfig}
        title="Delete Department Configuration"
        message="Are you sure you want to delete this department configuration? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteConfirm}
        onClose={handleDeleteCancel}
        variant="error"
        loading={deleteLoading}
      />
    </>
  );
};
