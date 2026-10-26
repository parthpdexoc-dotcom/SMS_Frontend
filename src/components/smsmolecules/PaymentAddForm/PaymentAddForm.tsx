import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { SMSDropdownOption } from '@/components/smsatoms';
import { SMSDatePicker, SMSDropdown, SMSTextField } from '@/components/smsatoms';
import { SMSFormContainer } from '@/components/smsmolecules/SMSFormContainer';
import { PAYMENT_GRID } from '@/constants/strings';
import type { PaymentAddFormInitialValues, PaymentAddFormProps } from '@/types/payment';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchPaymentTypes } from '@/store/slices/paymentTypeSlice';
import { formatDateToYYYYMMDD } from '@/utils/dateTimeUtils';
import './PaymentAddForm.css';

const parseAmount = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const defaultFormState = (requesterID = '', paymentTypeId = '') => ({
  requesterID,
  amount: '',
  paymentDate: formatDateToYYYYMMDD(new Date()),
  paymentTypeId,
  referenceNumber: '',
});

const toFormState = (values: PaymentAddFormInitialValues) => ({
  requesterID: values.requesterID,
  amount: String(values.amount),
  paymentDate: values.paymentDate,
  paymentTypeId: values.paymentTypeId,
  referenceNumber: values.referenceNumber ?? '',
});

export const PaymentAddForm: React.FC<PaymentAddFormProps> = ({
  mode = 'create',
  initialValues,
  requesterOptions,
  requestersLoading = false,
  saving = false,
  initialRequesterId,
  lockRequester = false,
  lockedRequesterLabel,
  onCancel,
  onSave,
}) => {
  const dispatch = useAppDispatch();
  const { paymentTypes, isLoading: paymentTypesLoading } = useAppSelector((s) => s.paymentType);
  const isEditMode = mode === 'edit';

  const paymentTypeOptions: SMSDropdownOption[] = useMemo(
    () =>
      paymentTypes.map((pt) => ({
        value: pt.paymentTypeId,
        label: pt.name,
      })),
    [paymentTypes]
  );

  const defaultPaymentTypeId = useMemo(() => {
    const preferred = paymentTypes.find((pt) => pt.isDefault) ?? paymentTypes[0];
    return preferred?.paymentTypeId ?? '';
  }, [paymentTypes]);

  const [form, setForm] = useState(() =>
    isEditMode && initialValues
      ? toFormState(initialValues)
      : defaultFormState(initialRequesterId ?? '')
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    void dispatch(fetchPaymentTypes({ page: 1, pageSize: 1000, sortBy: 'name', sortDirection: 'asc' }));
  }, [dispatch]);

  useEffect(() => {
    if (!isEditMode) {
      setForm(defaultFormState(initialRequesterId ?? '', defaultPaymentTypeId));
      setErrors(
        paymentTypesLoading || paymentTypeOptions.length > 0
          ? {}
          : { paymentTypeId: PAYMENT_GRID.ERRORS.PAYMENT_TYPE_REQUIRED }
      );
      return;
    }
    if (initialValues) {
      setForm(toFormState(initialValues));
      setErrors({});
    }
  }, [defaultPaymentTypeId, initialRequesterId, initialValues, isEditMode, paymentTypeOptions.length, paymentTypesLoading]);

  const validate = useCallback((): boolean => {
    const next: Record<string, string> = {};
    if (!isEditMode && !form.requesterID.trim()) {
      next.requesterID = PAYMENT_GRID.ERRORS.REQUESTER_REQUIRED;
    }
    if (!form.paymentDate.trim()) {
      next.paymentDate = PAYMENT_GRID.ERRORS.DATE_REQUIRED;
    }
    const parsedAmount = parseAmount(form.amount);
    if (parsedAmount == null || parsedAmount <= 0) {
      next.amount = PAYMENT_GRID.ERRORS.AMOUNT_INVALID;
    }
    if (!form.paymentTypeId.trim() || paymentTypeOptions.length === 0) {
      next.paymentTypeId = PAYMENT_GRID.ERRORS.PAYMENT_TYPE_REQUIRED;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [form, isEditMode, paymentTypeOptions.length]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!validate()) return;
      const parsedAmount = parseAmount(form.amount);
      await onSave({
        paymentId: isEditMode ? initialValues?.paymentId : undefined,
        requesterID: (isEditMode ? initialValues?.requesterID : form.requesterID)?.trim() ?? '',
        amount: parsedAmount ?? 0,
        paymentDate: form.paymentDate,
        paymentTypeId: form.paymentTypeId,
        referenceNumber: form.referenceNumber.trim() || null,
      });
    },
    [form, initialValues, isEditMode, onSave, validate]
  );

  const parsedAmount = parseAmount(form.amount);
  const canSubmit =
    !saving &&
    !requestersLoading &&
    !paymentTypesLoading &&
    paymentTypeOptions.length > 0 &&
    Boolean(form.paymentTypeId.trim()) &&
    (isEditMode || Boolean(form.requesterID.trim())) &&
    Boolean(form.paymentDate.trim()) &&
    parsedAmount != null &&
    parsedAmount > 0;

  const paymentNumberLabel =
    initialValues?.paymentNumber != null && String(initialValues.paymentNumber).trim() !== ''
      ? String(initialValues.paymentNumber)
      : PAYMENT_GRID.EMPTY_PLACEHOLDER;

  return (
    <SMSFormContainer
      className="payment-add-form"
      onSubmit={handleSubmit}
      onCancel={onCancel}
      submitText={PAYMENT_GRID.FORM.SAVE}
      cancelText={PAYMENT_GRID.FORM.CANCEL}
      isLoading={saving}
      disabled={!canSubmit}
      submitFullWidth={false}
      spacing={3}
    >
      <div className="payment-add-form__fields">
        <div className="payment-add-form__row">
          {isEditMode ? (
            <SMSTextField
              label={PAYMENT_GRID.FORM.PAYMENT_NUMBER}
              value={paymentNumberLabel}
              fullWidth
              disabled
              InputLabelProps={{ shrink: true }}
            />
          ) : lockRequester ? (
            <SMSTextField
              label={PAYMENT_GRID.FORM.REQUESTER}
              value={lockedRequesterLabel ?? form.requesterID}
              fullWidth
              disabled
              InputLabelProps={{ shrink: true }}
            />
          ) : (
            <SMSDropdown
              label={PAYMENT_GRID.FORM.REQUESTER}
              placeholder={requestersLoading ? 'Loading requesters…' : PAYMENT_GRID.SELECT_REQUESTER}
              options={requesterOptions}
              value={form.requesterID}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, requesterID: String(e.target.value) }));
                if (errors.requesterID) setErrors((prev) => ({ ...prev, requesterID: '' }));
              }}
              required
              fullWidth
              disabled={saving || requestersLoading}
              error={Boolean(errors.requesterID)}
              helperText={errors.requesterID}
            />
          )}
          <SMSDatePicker
            label={PAYMENT_GRID.FORM.PAYMENT_DATE}
            value={form.paymentDate}
            onChange={(value) => {
              setForm((prev) => ({ ...prev, paymentDate: value }));
              if (errors.paymentDate) setErrors((prev) => ({ ...prev, paymentDate: '' }));
            }}
            required
            disabled={saving}
            valueFormat="YYYY-MM-DD"
            format="MM/DD/YYYY"
          />
        </div>
        <div className="payment-add-form__row">
          <SMSTextField
            label={PAYMENT_GRID.FORM.AMOUNT_PAID}
            value={form.amount}
            onChange={(e) => {
              setForm((prev) => ({ ...prev, amount: e.target.value }));
              if (errors.amount) setErrors((prev) => ({ ...prev, amount: '' }));
            }}
            placeholder={PAYMENT_GRID.FORM.AMOUNT_PLACEHOLDER}
            required
            fullWidth
            type="number"
            inputMode="decimal"
            disabled={saving}
            error={Boolean(errors.amount)}
            helperText={errors.amount}
          />
          <SMSDropdown
            label={PAYMENT_GRID.FORM.PAYMENT_TYPE}
            options={paymentTypeOptions}
            value={form.paymentTypeId}
            onChange={(e) => {
              setForm((prev) => ({ ...prev, paymentTypeId: String(e.target.value) }));
              if (errors.paymentTypeId) setErrors((prev) => ({ ...prev, paymentTypeId: '' }));
            }}
            fullWidth
            disabled={saving || paymentTypesLoading}
            error={Boolean(errors.paymentTypeId)}
            helperText={errors.paymentTypeId}
            required
          />
        </div>
        <div className="payment-add-form__row">
          <SMSTextField
            label={PAYMENT_GRID.FORM.REFERENCE_NUMBER}
            value={form.referenceNumber}
            onChange={(e) => setForm((prev) => ({ ...prev, referenceNumber: e.target.value }))}
            placeholder={PAYMENT_GRID.FORM.REFERENCE_PLACEHOLDER}
            fullWidth
            disabled={saving}
          />
        </div>
      </div>
    </SMSFormContainer>
  );
};
