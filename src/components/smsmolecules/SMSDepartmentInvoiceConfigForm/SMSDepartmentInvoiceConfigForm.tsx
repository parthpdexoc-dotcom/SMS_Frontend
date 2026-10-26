import React, { useState, useEffect } from 'react';
import {
  SMSBox,
  SMSButton,
  SMSCheckbox,
  SMSCurrencyInput,
  SMSDatePicker,
  SMSDropdown,
  SMSLoader,
  SMSTextField,
} from '@/components/smsatoms';
import { DEPARTMENT_INVOICE_CONFIG } from '@/constants/strings';
import type {
  DepartmentInvoiceConfigResponse,
  DepartmentInvoiceConfigFormData,
  DepartmentInvoiceConfigRequest,
} from '@/types/departmentInvoiceConfig';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { formatLastNameCommaFirstName } from '@/utils';
import {
  fetchDepartmentInvoiceConfigByDepartmentId,
  saveDepartmentInvoiceConfigThunk,
  type DepartmentInvoiceConfigSaveError,
} from '@/store/slices/departmentInvoiceConfigSlice';
import './SMSDepartmentInvoiceConfigForm.css';

export interface SMSDepartmentInvoiceConfigFormProps {
  departmentId: string;
  initialData?: DepartmentInvoiceConfigResponse | null;
  onSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
}

const getCurrentYear = (): string => String(new Date().getFullYear());
const FISCAL_YEAR_OPTIONS = (() => {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 200 }, (_, index) => {
    const year = String(currentYear + index);
    return { label: year, value: year };
  });
})();

const defaultFormData = (departmentId: string): DepartmentInvoiceConfigFormData => ({
  departmentID: departmentId,
  fiscalYear: getCurrentYear(),
  staffReimbursement: 0,
  mileageReimburseEligible: false,
  vehicleReimbursement: 0,
  mileageReimbursedRate: 0,
  defaultAdminFeeDollar: 0,
  defaultAdminFeePercentage: 0,
  defaultPayrollTax: 0,
  totalCombinedAdminFees: 0,
  departmentAdminFee: 0,
  cancellationMinimumFee: 0,
  minimumFee: 0,
  agencySupportFee: 0,
  effectiveDate: '',
  payableDirectlyTo: '',
  isPayableToOfficer: false,
});

function toFormData(departmentId: string, d: DepartmentInvoiceConfigResponse | null): DepartmentInvoiceConfigFormData {
  if (!d) return defaultFormData(departmentId);
  const eff = d.effectiveDate ?? '';
  const effDate = eff ? (eff.includes('T') ? eff.slice(0, 10) : eff.slice(0, 10)) : '';
  return {
    departmentID: departmentId,
    fiscalYear: d.fiscalYear ?? getCurrentYear(),
    staffReimbursement: d.staffReimbursement ?? 0,
    mileageReimburseEligible: d.mileageReimburseEligible ?? false,
    vehicleReimbursement: d.vehicleReimbursement ?? 0,
    mileageReimbursedRate: d.mileageReimbursedRate ?? 0,
    defaultAdminFeeDollar: d.defaultAdminFeeDollar ?? 0,
    defaultAdminFeePercentage: d.defaultAdminFeePercentage ?? 0,
    defaultPayrollTax: d.defaultPayrollTax ?? 0,
    totalCombinedAdminFees: d.totalCombinedAdminFees ?? 0,
    departmentAdminFee: d.departmentAdminFee ?? 0,
    cancellationMinimumFee: d.cancellationMinimumFee ?? 0,
    minimumFee: d.minimumFee ?? 0,
    agencySupportFee: d.agencySupportFee ?? 0,
    effectiveDate: effDate,
    payableDirectlyTo: d.payableDirectlyTo ?? '',
    isPayableToOfficer: d.isPayableToOfficer ?? false,
  };
}

const numberInputProps = { step: 0.01, min: 0 };

export const SMSDepartmentInvoiceConfigForm: React.FC<SMSDepartmentInvoiceConfigFormProps> = ({
  departmentId,
  initialData,
  onSuccess,
  onCancel,
  className = '',
}) => {
  const appDispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const configFromSlice = useAppSelector(
    (state) => state.departmentInvoiceConfig.configByDepartmentId[departmentId]
  );
  const fetchLoading = useAppSelector(
    (state) => state.departmentInvoiceConfig.loadingByDepartmentId[departmentId]
  );
  const saveLoading = useAppSelector((state) => state.departmentInvoiceConfig.saveLoading);

  const effectiveInitialData = initialData ?? configFromSlice ?? null;

  const [formData, setFormData] = useState<DepartmentInvoiceConfigFormData>(() =>
    toFormData(departmentId, effectiveInitialData)
  );
  const [fieldErrors, setFieldErrors] = useState<{ payableDirectlyTo?: boolean }>({});

  useEffect(() => {
    if (initialData == null && departmentId) {
      appDispatch(fetchDepartmentInvoiceConfigByDepartmentId(departmentId));
    }
  }, [departmentId, initialData, appDispatch]);

  useEffect(() => {
    setFormData(toFormData(departmentId, effectiveInitialData));
  }, [departmentId, effectiveInitialData]);

  const handleChange = (field: keyof DepartmentInvoiceConfigFormData, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (field === 'payableDirectlyTo' && fieldErrors.payableDirectlyTo) {
      setFieldErrors((prev) => ({ ...prev, payableDirectlyTo: false }));
    }
  };

  const num = (v: number): number => (typeof v === 'number' && !Number.isNaN(v) ? v : 0);

  const buildPayload = (): DepartmentInvoiceConfigRequest => {
    const now = new Date().toISOString();
    const effectiveDate = formData.effectiveDate
      ? new Date(formData.effectiveDate + 'T12:00:00').toISOString()
      : undefined;
    return {
      departmentID: departmentId,
      invoiceConfigID:
        effectiveInitialData?.departmentInvoiceConfigurationID ??
        effectiveInitialData?.invoiceConfigID ??
        undefined,
      fiscalYear: formData.fiscalYear || undefined,
      staffReimbursement: num(formData.staffReimbursement),
      mileageReimburseEligible: formData.mileageReimburseEligible,
      vehicleReimbursement: num(formData.vehicleReimbursement),
      mileageReimbursedRate: num(formData.mileageReimbursedRate),
      defaultAdminFeeDollar: num(formData.defaultAdminFeeDollar),
      defaultAdminFeePercentage: num(formData.defaultAdminFeePercentage),
      defaultPayrollTax: num(formData.defaultPayrollTax),
      totalCombinedAdminFees: num(formData.totalCombinedAdminFees),
      departmentAdminFee: num(formData.departmentAdminFee),
      cancellationMinimumFee: num(formData.cancellationMinimumFee),
      minimumFee: num(formData.minimumFee),
      agencySupportFee: num(formData.agencySupportFee),
      effectiveDate: effectiveDate ?? undefined,
      payableDirectlyTo: formData.payableDirectlyTo.trim() || '',
      isPayableToOfficer: formData.isPayableToOfficer,
      createdDate: effectiveInitialData?.createdDate ?? now,
      createdUserID: user?.employeeID ?? user?.adminID ?? undefined,
      createdBy:
        user?.username ??
        (formatLastNameCommaFirstName(user?.firstName, user?.lastName) || user?.fullName || undefined),
      editedDate: now,
      editedUserID: user?.employeeID ?? user?.adminID ?? undefined,
      editedBy:
        user?.username ??
        (formatLastNameCommaFirstName(user?.firstName, user?.lastName) || user?.fullName || undefined),
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await appDispatch(saveDepartmentInvoiceConfigThunk(buildPayload())).unwrap();
      setFieldErrors({});
      onSuccess?.();
    } catch (error) {
      const payload = error as DepartmentInvoiceConfigSaveError | undefined;
      if (payload?.fieldErrors?.payableDirectlyTo) {
        setFieldErrors({ payableDirectlyTo: true });
      }
    }
  };

  const fetching = initialData == null && (fetchLoading === true || fetchLoading === undefined);
  if (fetching) {
    return (
      <SMSBox className={`department-invoice-config-form ${className}`} sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
        <SMSLoader />
      </SMSBox>
    );
  }

  return (
    <div className={`department-invoice-config-form ${className}`}>
      <form onSubmit={handleSubmit} className="department-invoice-config-form__form" noValidate>
        <div className="department-invoice-config-form__form-grid">
          <div className="department-invoice-config-form__form-row">
            <SMSDropdown
              fullWidth
              label={DEPARTMENT_INVOICE_CONFIG.FISCAL_YEAR}
              options={FISCAL_YEAR_OPTIONS}
              value={formData.fiscalYear}
              onChange={(e) => handleChange('fiscalYear', String(e.target.value))}
              placeholder={DEPARTMENT_INVOICE_CONFIG.FISCAL_YEAR_PLACEHOLDER}
              name="fiscalYear"
              id="fiscalYear"
              disabled={saveLoading}
              searchable
              MenuProps={{ PaperProps: { style: { maxHeight: 320 } } }}
            />
          </div>
          <div className="department-invoice-config-form__form-row">
            <SMSDatePicker
              id="effectiveDate"
              name="effectiveDate"
              label={DEPARTMENT_INVOICE_CONFIG.EFFECTIVE_DATE}
              value={formData.effectiveDate}
              onChange={(v) => handleChange('effectiveDate', v)}
              disabled={saveLoading}
              format="MM/DD"
              valueFormat="YYYY-MM-DD"
              placeholder="mm/dd"
              views={['month', 'day']}
              openTo="day"
              calendarHeaderFormat="MMMM"
            />
          </div>
        </div>
        <div className="department-invoice-config-form__checkbox-row">
          <SMSCheckbox
            label={DEPARTMENT_INVOICE_CONFIG.MILEAGE_REIMBURSE_ELIGIBLE}
            checked={formData.mileageReimburseEligible}
            onChange={(checked) => handleChange('mileageReimburseEligible', checked)}
            disabled={saveLoading}
          />
          <SMSCheckbox
            label={DEPARTMENT_INVOICE_CONFIG.IS_PAYABLE_TO_OFFICER}
            checked={formData.isPayableToOfficer}
            onChange={(checked) => handleChange('isPayableToOfficer', checked)}
            disabled={saveLoading}
          />
        </div>
        <div className="department-invoice-config-form__form-grid department-invoice-config-form__form-grid--3col">
          <div className="department-invoice-config-form__form-row">
            <SMSCurrencyInput
              fullWidth
              label={DEPARTMENT_INVOICE_CONFIG.STAFF_REIMBURSEMENT}
              value={formData.staffReimbursement}
              onChange={(value) => handleChange('staffReimbursement', value ?? 0)}
              name="staffReimbursement"
              id="staffReimbursement"
              disabled={saveLoading}
            />
          </div>
          <div className="department-invoice-config-form__form-row">
            <SMSCurrencyInput
              fullWidth
              label={DEPARTMENT_INVOICE_CONFIG.VEHICLE_REIMBURSEMENT}
              value={formData.vehicleReimbursement}
              onChange={(value) => handleChange('vehicleReimbursement', value ?? 0)}
              name="vehicleReimbursement"
              id="vehicleReimbursement"
              disabled={saveLoading}
            />
          </div>
          <div className="department-invoice-config-form__form-row">
            <SMSCurrencyInput
              fullWidth
              label={DEPARTMENT_INVOICE_CONFIG.MILEAGE_REIMBURSED_RATE}
              value={formData.mileageReimbursedRate}
              onChange={(value) => handleChange('mileageReimbursedRate', value ?? 0)}
              name="mileageReimbursedRate"
              id="mileageReimbursedRate"
              disabled={saveLoading}
            />
          </div>
          <div className="department-invoice-config-form__form-row">
            <SMSCurrencyInput
              fullWidth
              label={DEPARTMENT_INVOICE_CONFIG.DEFAULT_ADMIN_FEE_DOLLAR}
              value={formData.defaultAdminFeeDollar}
              onChange={(value) => handleChange('defaultAdminFeeDollar', value ?? 0)}
              name="defaultAdminFeeDollar"
              id="defaultAdminFeeDollar"
              disabled={saveLoading}
            />
          </div>
          <div className="department-invoice-config-form__form-row">
            <SMSTextField
              fullWidth
              type="number"
              label={DEPARTMENT_INVOICE_CONFIG.DEFAULT_ADMIN_FEE_PERCENTAGE}
              value={formData.defaultAdminFeePercentage === 0 ? '' : String(formData.defaultAdminFeePercentage)}
              onChange={(e) =>
                handleChange('defaultAdminFeePercentage', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)
              }
              name="defaultAdminFeePercentage"
              id="defaultAdminFeePercentage"
              disabled={saveLoading}
              inputProps={numberInputProps}
            />
          </div>
          <div className="department-invoice-config-form__form-row">
            <SMSTextField
              fullWidth
              type="number"
              label={DEPARTMENT_INVOICE_CONFIG.DEFAULT_PAYROLL_TAX}
              value={formData.defaultPayrollTax === 0 ? '' : String(formData.defaultPayrollTax)}
              onChange={(e) =>
                handleChange('defaultPayrollTax', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)
              }
              name="defaultPayrollTax"
              id="defaultPayrollTax"
              disabled={saveLoading}
              inputProps={numberInputProps}
            />
          </div>
          <div className="department-invoice-config-form__form-row">
            <SMSCurrencyInput
              fullWidth
              label={DEPARTMENT_INVOICE_CONFIG.TOTAL_COMBINED_ADMIN_FEES}
              value={formData.totalCombinedAdminFees}
              onChange={(value) => handleChange('totalCombinedAdminFees', value ?? 0)}
              name="totalCombinedAdminFees"
              id="totalCombinedAdminFees"
              disabled={saveLoading}
            />
          </div>
          <div className="department-invoice-config-form__form-row">
            <SMSCurrencyInput
              fullWidth
              label={DEPARTMENT_INVOICE_CONFIG.DEPARTMENT_ADMIN_FEE}
              value={formData.departmentAdminFee}
              onChange={(value) => handleChange('departmentAdminFee', value ?? 0)}
              name="departmentAdminFee"
              id="departmentAdminFee"
              disabled={saveLoading}
            />
          </div>
          <div className="department-invoice-config-form__form-row">
            <SMSCurrencyInput
              fullWidth
              label={DEPARTMENT_INVOICE_CONFIG.CANCELLATION_MINIMUM_FEE}
              value={formData.cancellationMinimumFee}
              onChange={(value) => handleChange('cancellationMinimumFee', value ?? 0)}
              name="cancellationMinimumFee"
              id="cancellationMinimumFee"
              disabled={saveLoading}
            />
          </div>
          <div className="department-invoice-config-form__form-row">
            <SMSCurrencyInput
              fullWidth
              label={DEPARTMENT_INVOICE_CONFIG.MINIMUM_FEE}
              value={formData.minimumFee}
              onChange={(value) => handleChange('minimumFee', value ?? 0)}
              name="minimumFee"
              id="minimumFee"
              disabled={saveLoading}
            />
          </div>
          <div className="department-invoice-config-form__form-row">
            <SMSCurrencyInput
              fullWidth
              label={DEPARTMENT_INVOICE_CONFIG.AGENCY_SUPPORT_FEE}
              value={formData.agencySupportFee}
              onChange={(value) => handleChange('agencySupportFee', value ?? 0)}
              name="agencySupportFee"
              id="agencySupportFee"
              disabled={saveLoading}
            />
          </div>
          <div className="department-invoice-config-form__form-row">
            <SMSTextField
              fullWidth
              type="text"
              label={DEPARTMENT_INVOICE_CONFIG.PAYABLE_DIRECTLY_TO}
              value={formData.payableDirectlyTo}
              onChange={(e) => handleChange('payableDirectlyTo', e.target.value)}
              placeholder={DEPARTMENT_INVOICE_CONFIG.PAYABLE_DIRECTLY_TO_PLACEHOLDER}
              name="payableDirectlyTo"
              id="payableDirectlyTo"
              disabled={saveLoading}
              error={Boolean(fieldErrors.payableDirectlyTo)}
            />
          </div>
        </div>
        <div className="department-invoice-config-form__actions">
          {onCancel && (
            <SMSButton
              type="button"
              onClick={onCancel}
              disabled={saveLoading}
            >
              {DEPARTMENT_INVOICE_CONFIG.CANCEL}
            </SMSButton>
          )}
          <SMSButton
            type="submit"
            disabled={saveLoading}
            loading={saveLoading}
          >
            {DEPARTMENT_INVOICE_CONFIG.SAVE}
          </SMSButton>
        </div>
      </form>
    </div>
  );
};
