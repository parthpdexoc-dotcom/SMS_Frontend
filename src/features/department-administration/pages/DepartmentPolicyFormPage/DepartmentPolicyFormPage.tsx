import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SMSFormPage } from '@/components/smsorganisms';
import { SMSDepartmentPolicyForm } from '@/components/smsmolecules/SMSDepartmentPolicyForm';
import { SMSBox, SMSLoader, SMSTypography } from '@/components/smsatoms';
import {
  getDepartmentPolicyByDepartmentId,
} from '@/services/departmentPolicyService';
import { DepartmentPolicyResponse } from '@/types/departmentPolicy';
import { useAppSelector } from '@/store/hooks';
import { DEPARTMENT_POLICY } from '@/constants/strings';

export const DepartmentPolicyFormPage: React.FC = () => {
  const navigate = useNavigate();
  const { departmentId } = useParams<{ departmentId?: string }>();
  const { user } = useAppSelector((state) => state.auth);

  const [policy, setPolicy] = useState<DepartmentPolicyResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const effectiveDepartmentId = departmentId || user?.departmentID || '';

  useEffect(() => {
    if (!effectiveDepartmentId) {
      setLoading(false);
      setPolicy(null);
      return;
    }

    setLoading(true);
    getDepartmentPolicyByDepartmentId(effectiveDepartmentId)
      .then((data) => setPolicy(data ?? null))
      .catch(() => setPolicy(null))
      .finally(() => setLoading(false));
  }, [effectiveDepartmentId]);

  const handleSuccess = (saved: DepartmentPolicyResponse) => {
    setPolicy(saved);
  };

  const handleCancel = () => {
    navigate(-1);
  };

  
  const hasData = Boolean(policy?.departmentPolicyID);

  if (!effectiveDepartmentId) {
    return (
      <SMSFormPage
        title={DEPARTMENT_POLICY.TITLE}
        onCancel={handleCancel}
      >
        <SMSBox sx={{ p: 4, textAlign: 'center' }}>
          <SMSTypography variant="body1">
            {DEPARTMENT_POLICY.ERRORS.DEPARTMENT_REQUIRED}
          </SMSTypography>
        </SMSBox>
      </SMSFormPage>
    );
  }

  if (loading) {
    return (
      <SMSFormPage
        title={DEPARTMENT_POLICY.TITLE}
        subtitle={DEPARTMENT_POLICY.SUBTITLE}
        onCancel={handleCancel}
      >
        <SMSBox sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
          <SMSLoader loadingText={DEPARTMENT_POLICY.TABLE.LOADING} aria-label={DEPARTMENT_POLICY.TABLE.LOADING} />
        </SMSBox>
      </SMSFormPage>
    );
  }

  return (
    <>
      <SMSFormPage
        title={DEPARTMENT_POLICY.TITLE}
        subtitle={DEPARTMENT_POLICY.SUBTITLE}
        onCancel={handleCancel}
      >
        {hasData && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginBottom: '1rem',
            }}
          >
           
          </div>
        )}
        <SMSDepartmentPolicyForm
          initialData={policy ?? undefined}
          departmentId={effectiveDepartmentId}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      </SMSFormPage>
     
    </>
  );
};

