import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SMSFormPage } from '@/components/smsorganisms';
import { SMSDepartmentInvoiceConfigForm } from '@/components/smsmolecules/SMSDepartmentInvoiceConfigForm';
import { SMSBox, SMSTypography } from '@/components/smsatoms';
import { DEPARTMENT_INVOICE_CONFIG } from '@/constants/strings';

export const DepartmentInvoiceConfigFormPage: React.FC = () => {
  const navigate = useNavigate();
  const { departmentId } = useParams<{ departmentId: string }>();

  const handleCancel = () => {
    navigate(-1);
  };

  if (!departmentId) {
    return (
      <SMSFormPage title={DEPARTMENT_INVOICE_CONFIG.TITLE} onCancel={() => navigate('/admin/department')}>
        <SMSBox sx={{ p: 2 }}>
          <SMSTypography variant="body1" color="text.secondary">
            Department is required. Go back and select a department.
          </SMSTypography>
        </SMSBox>
      </SMSFormPage>
    );
  }

  return (
    <SMSFormPage
      title={DEPARTMENT_INVOICE_CONFIG.TITLE}
      subtitle="Configure invoice and reimbursement settings for this department"
      onCancel={handleCancel}
    >
      <SMSDepartmentInvoiceConfigForm
        departmentId={departmentId}
        onSuccess={() => {}}
        onCancel={handleCancel}
      />
    </SMSFormPage>
  );
};
