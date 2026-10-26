import React, { useState, useEffect } from 'react';
import { SMSButton, SMSCheckbox, SMSDatePicker, SMSSwitch, SMSTextField } from '@/components/smsatoms';
import { HOLIDAY_DAY } from '@/constants/holidayDayStrings';
import type {
  HolidayDayFormProps,
  HolidayDayFormData,
  HolidayDayFormErrors,
} from '@/types/holidayDay';
import { formatTime } from '@/utils';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { upsertHolidayDayThunk } from '@/store/slices/holidayDaySlice';
import { showToast } from '@/store/slices/toastSlice';
import './HolidayDayForm.css';

const getDefaultFormData = (): HolidayDayFormData => ({
  name: '',
  date: '',
  isPremiumRate: false,
  isActive: true,
  payPremiumForEntireShift: false,
});

const formatDateTimeFull = (value: string | null | undefined): string => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return `${d.toLocaleDateString()} ${formatTime(value, '')}`;
};

export const HolidayDayForm: React.FC<HolidayDayFormProps> = ({
  initialData,
  onSuccess,
  onCancel,
  className = '',
}) => {
  const dispatch = useAppDispatch();
  const { isLoading } = useAppSelector((state) => state.holidayDay);
  const [formData, setFormData] = useState<HolidayDayFormData>(() => {
    if (initialData) {
      return {
        name: initialData.name || '',
        date: initialData.date ? initialData.date.slice(0, 10) : '',
        isPremiumRate: initialData.isPremiumRate === true,
        isActive: initialData.isActive !== false,
        payPremiumForEntireShift: initialData.payPremiumForEntireShift === true,  
      };
    }
    return getDefaultFormData();
  });

  const [errors, setErrors] = useState<HolidayDayFormErrors>({});
  const [, setSubmitSuccess] = useState(false);

  const isEditMode = Boolean(initialData?.holidayDayID);
  const isSubmitting = isLoading;

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        date: initialData.date ? initialData.date.slice(0, 10) : '',
        isPremiumRate: initialData.isPremiumRate === true,
        isActive: initialData.isActive !== false,
        payPremiumForEntireShift: initialData.payPremiumForEntireShift === true,
      });
    } else {
      setFormData(getDefaultFormData());
    }
    setErrors({});
    setSubmitSuccess(false);
  }, [initialData]);

  const handleChange = (field: keyof HolidayDayFormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof HolidayDayFormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: HolidayDayFormErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = HOLIDAY_DAY.ERRORS.NAME_REQUIRED;
    }
    if (!formData.date.trim()) {
      newErrors.date = HOLIDAY_DAY.ERRORS.DATE_REQUIRED;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitSuccess(false);

    if (!validateForm()) {
      const msg = !formData.name.trim()
        ? HOLIDAY_DAY.ERRORS.NAME_REQUIRED
        : HOLIDAY_DAY.ERRORS.DATE_REQUIRED;
      dispatch(showToast(msg, 'error'));
      return;
    }

    try {
      // Prepare request data - convert date to ISO string format
      // Date input provides YYYY-MM-DD, convert to ISO datetime at midnight UTC
      const dateValue = formData.date 
        ? new Date(`${formData.date}T00:00:00.000Z`).toISOString()
        : new Date().toISOString();
      
      const holidayDayID = initialData?.holidayDayID;
      const payload = {
        name: formData.name.trim(),
        date: dateValue,
        isPremiumRate: formData.isPremiumRate,
        isActive: formData.isActive,
        payPremiumForEntireShift: formData.payPremiumForEntireShift,
      };

      if (isEditMode && holidayDayID) {
        await dispatch(upsertHolidayDayThunk({ holidayDayID, ...payload })).unwrap();
        setSubmitSuccess(true);
        setTimeout(() => {
          setSubmitSuccess(false);
          onSuccess?.();
        }, 800);
        return;
      }

      await dispatch(upsertHolidayDayThunk(payload)).unwrap();
      setSubmitSuccess(true);

      if (!isEditMode) {
        setFormData(getDefaultFormData());
      }

      setTimeout(() => {
        setSubmitSuccess(false);
        onSuccess?.();
      }, 800);
    } catch {
      // Error message is shown via toast from holidayDaySlice
    }
  };

  // const areRequiredFieldsFilled = () =>
  //   formData.name.trim() !== '' && formData.date.trim() !== '';
  // const canSubmit = areRequiredFieldsFilled() && !isSubmitting;

  return (
    <div className={`holiday-day-form ${className}`}>
      <form onSubmit={handleSubmit} className="holiday-day-form__form" noValidate>
        <SMSTextField
          type="text"
          label={HOLIDAY_DAY.FORM.NAME}
          placeholder={HOLIDAY_DAY.FORM.NAME_PLACEHOLDER}
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          error={Boolean(errors.name)}
          helperText={errors.name}
          required
          name="name"
          id="holidayDayName"
          inputProps={{ maxLength: 200 }}
          disabled={isSubmitting}
        />

        <SMSDatePicker
          label={HOLIDAY_DAY.FORM.DATE}
          placeholder={HOLIDAY_DAY.FORM.DATE_PLACEHOLDER}
          value={formData.date}
          onChange={(value) => handleChange('date', value)}
          error={errors.date}
          required
          name="date"
          id="holidayDayDate"
          disabled={isSubmitting}
        />

        <div className="holiday-day-form__checkbox">
          <SMSCheckbox
            checked={formData.isPremiumRate}
            onChange={(checked) => handleChange('isPremiumRate', checked)}
            name="isPremiumRate"
            id="isPremiumRate"
            disabled={isSubmitting}
            label={HOLIDAY_DAY.FORM.IS_PREMIUM_RATE}
            className="holiday-day-form__checkbox-label"
          />
        </div>

        <div className="holiday-day-form__toggle">
          <SMSSwitch
            id="isActive"
            label={HOLIDAY_DAY.FORM.IS_ACTIVE}
            checked={formData.isActive}
            onChange={(e) => handleChange('isActive', e.target.checked)}
            disabled={isSubmitting}
          />
        </div>

        <div className="holiday-day-form__checkbox">
          <SMSCheckbox
            checked={formData.payPremiumForEntireShift}
            onChange={(checked) =>
              handleChange('payPremiumForEntireShift', checked)
            }
            name="payPremiumForEntireShift"
            id="payPremiumForEntireShift"
            disabled={isSubmitting}
            label={HOLIDAY_DAY.FORM.PAY_PREMIUM_FOR_ENTIRE_SHIFT}
            className="holiday-day-form__checkbox-label"
          />
        </div>

        {isEditMode && (initialData?.nameOfUserAddingRecord || initialData?.recordAddedDateTimeStamp || initialData?.userNameEditingRecord || initialData?.editDate) && (
          <div className="holiday-day-form__audit-info">
            <div className="holiday-day-form__audit-info-row">
              <span className="holiday-day-form__audit-item">
                <span className="holiday-day-form__audit-label">{HOLIDAY_DAY.FORM.ADDED_BY}:</span>
                <span className="holiday-day-form__audit-value">
                  {initialData.nameOfUserAddingRecord || '-'}
                  {initialData.recordAddedDateTimeStamp && (
                    <span
                      className="holiday-day-form__audit-date"
                      title={formatDateTimeFull(initialData.recordAddedDateTimeStamp)}
                    >
                      {' '}
                      {new Date(initialData.recordAddedDateTimeStamp).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  )}
                </span>
              </span>
              <span className="holiday-day-form__audit-separator">|</span>
              <span className="holiday-day-form__audit-item">
                <span className="holiday-day-form__audit-label">{HOLIDAY_DAY.FORM.EDITED_BY}:</span>
                <span className="holiday-day-form__audit-value">
                  {initialData.userNameEditingRecord || '-'}
                  {initialData.editDate && (
                    <span
                      className="holiday-day-form__audit-date"
                      title={formatDateTimeFull(initialData.editDate)}
                    >
                      {' '}
                      {new Date(initialData.editDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  )}
                </span>
              </span>
            </div>
          </div>
        )}

        <div className="holiday-day-form__footer">
          {onCancel && (
            <SMSButton
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="holiday-day-form__cancel-button"
            >
              {HOLIDAY_DAY.FORM.CANCEL_BUTTON}
            </SMSButton>
          )}
          <SMSButton
            type="submit"
            className="holiday-day-form__submit-button"
            fullWidth={!onCancel}
            disabled={isSubmitting}
            loading={isSubmitting}
          >
            {isEditMode ? HOLIDAY_DAY.BUTTON.UPDATE : HOLIDAY_DAY.FORM.SUBMIT_BUTTON}
          </SMSButton>
        </div>
      </form>
    </div>
  );
};
