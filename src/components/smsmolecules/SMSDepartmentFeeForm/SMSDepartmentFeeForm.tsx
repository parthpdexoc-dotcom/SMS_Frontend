import React, { useState, useEffect, useMemo } from 'react';
import { SMSButton, SMSCheckbox, SMSCurrencyInput, SMSDatePicker, SMSDropdown, SMSSwitch, SMSTextArea, SMSTextField } from '@/components/smsatoms';
import { DEPARTMENT_FEE } from '@/constants/strings';
import { DepartmentFeeResponse, DepartmentFeeFormData, DepartmentFeeFormErrors, FeeType, ReimburseTo } from '@/types/departmentFeeType';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { upsertDepartmentFeeThunk } from '@/store/slices/departmentFeeSlice';
import { formatDate, formatTime } from '@/utils';
import './SMSDepartmentFeeForm.css';

export interface SMSDepartmentFeeFormProps {
	initialData?: DepartmentFeeResponse | null;
	onSuccess?: () => void;
	onCancel?: () => void;
	className?: string;
}

// Field name constants to avoid hardcoded strings
const FIELD_NAMES = {
	DEPARTMENT_ID: 'departmentId',
	FEE_SHORT: 'feeShort',
	FEE_LONG: 'feeLong',
	FEE_TYPE: 'feeType',
	DEFAULT_FEE: 'defaultFee',
	ADDITIONAL_FEE: 'additionalFee',
	REIMBURSE_TO: 'reimburseTo',
	IS_ACTIVE: 'isActive',
	IS_DEFAULT: 'isDefault',
	EFFECTIVE_START_DATE: 'effectiveStartDate',
	EFFECTIVE_END_DATE: 'effectiveEndDate',
} as const;

const getDefaultFormData = (): DepartmentFeeFormData => ({
	departmentId: '',
	feeShort: '',
	feeLong: '',
	feeType: FeeType.PerRequest,
	defaultFee: 0,
	additionalFee: 0,
	reimburseTo: ReimburseTo.Employee,
	isActive: true,
	isDefault: false,
	effectiveStartDate: '',
	effectiveEndDate: '',
});

export const SMSDepartmentFeeForm: React.FC<SMSDepartmentFeeFormProps> = ({
	initialData,
	onSuccess,
	onCancel,
	className = '',
}) => {
	const isEditMode = Boolean(initialData?.feeId);
	const dispatch = useAppDispatch();
	const { isLoading, error: reduxError } = useAppSelector((state) => state.departmentFee);
	const { user } = useAppSelector((state) => state.auth);
	const [errors, setErrors] = useState<DepartmentFeeFormErrors>({});
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [, setSubmitSuccess] = useState(false);

	const initialValues = useMemo(() => {
		return initialData
			? {
					departmentId: initialData.departmentId || user?.departmentID || '',
					feeShort: initialData.feeShort || '',
					feeLong: initialData.feeLong || '',
					feeType: initialData.feeType ?? FeeType.PerRequest,
					defaultFee: initialData.defaultFee ?? 0,
					additionalFee: initialData.additionalFee ?? 0,
					reimburseTo:
						initialData.reimburseTo === ReimburseTo.City
							? ReimburseTo.City
							: ReimburseTo.Employee,
					isActive: initialData.isActive !== false,
					isDefault: initialData.isDefault ?? false,
					effectiveStartDate: initialData.effectiveStartDate || '',
					effectiveEndDate: initialData.effectiveEndDate || '',
				}
			: {
					...getDefaultFormData(),
					departmentId: user?.departmentID || '',
				};
	}, [
		initialData?.departmentId,
		initialData?.feeShort,
		initialData?.feeLong,
		initialData?.feeType,
		initialData?.defaultFee,
		initialData?.additionalFee,
		initialData?.reimburseTo,
		initialData?.isActive,
		initialData?.isDefault,
		initialData?.effectiveStartDate,
		initialData?.effectiveEndDate,
		user?.departmentID,
	]);

	const [formData, setFormData] = useState<DepartmentFeeFormData>(initialValues);

	useEffect(() => {
		setFormData(initialValues);
		setErrors({});
		setSubmitError(null);
		setSubmitSuccess(false);
	}, [initialValues]);

	// Fee Type enum options
	const feeTypeOptions = DEPARTMENT_FEE.ENUMS.FEE_TYPE;

	// Reimburse To enum options
	const reimburseToOptions = DEPARTMENT_FEE.ENUMS.REIMBURSE_TO;

	const handleChange = (field: keyof DepartmentFeeFormData, value: any) => {
		setFormData((prev) => ({ ...prev, [field]: value }));
		// Clear error for this field when user starts typing
		if (errors[field as keyof DepartmentFeeFormErrors]) {
			setErrors((prev) => ({ ...prev, [field]: undefined }));
		}
		if (submitError) {
			setSubmitError(null);
		}
	};

const validateForm = (): boolean => {
		const newErrors: DepartmentFeeFormErrors = {};

		if (!formData.feeShort.trim()) {
			newErrors.feeShort = DEPARTMENT_FEE.ERRORS.TITLE_REQUIRED;
		}

		if (!formData.feeLong || !formData.feeLong.trim()) {
			newErrors.feeLong = DEPARTMENT_FEE.ERRORS.DESCRIPTION_REQUIRED;
		}

		if (!formData.feeType) {
			newErrors.feeType = DEPARTMENT_FEE.ERRORS.FEE_TYPE_REQUIRED;
		}

		if (isNaN(formData.defaultFee)) {
			newErrors.defaultFee = DEPARTMENT_FEE.ERRORS.DEFAULT_FEE_REQUIRED;
		} else if (formData.defaultFee < 0) {
			newErrors.defaultFee = DEPARTMENT_FEE.ERRORS.DEFAULT_FEE_INVALID;
		}

		if (isNaN(formData.additionalFee) || formData.additionalFee < 0) {
			newErrors.additionalFee = DEPARTMENT_FEE.ERRORS.ADDITIONAL_FEE_INVALID;
		}

		if (!formData.reimburseTo) {
			newErrors.reimburseTo = DEPARTMENT_FEE.ERRORS.REIMBURSE_TO_REQUIRED;
		}

		if (!formData.effectiveStartDate) {
			newErrors.effectiveStartDate = DEPARTMENT_FEE.ERRORS.EFFECTIVE_START_DATE_REQUIRED;
		}

		if (formData.effectiveEndDate && formData.effectiveStartDate) {
			if (new Date(formData.effectiveEndDate) < new Date(formData.effectiveStartDate)) {
				newErrors.effectiveEndDate = DEPARTMENT_FEE.ERRORS.EFFECTIVE_END_DATE_INVALID;
			}
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	// Helper function to parse error messages from API responses
	// Handles format: "Failed to create department fee: 400 {"status":400,"message":"...",...}"
	const parseErrorMessage = (error: unknown): string => {
		let errorMessage = isEditMode ? 'Failed to update department fee' : 'Failed to create department fee';

		if (error instanceof Error) {
			const errorText = error.message;

			// Try to extract JSON object from response (might have status code prefix)
			// Pattern: "400 {...}" or just "{...}"
			try {
				const jsonMatch = errorText.match(/\{[\s\S]*\}/);
				if (jsonMatch) {
					const jsonText = jsonMatch[0];
					const errorJson = JSON.parse(jsonText);

					// Check for message field in the error response
					if (errorJson.message && typeof errorJson.message === 'string') {
						errorMessage = errorJson.message;
					} else if (errorJson.Message && typeof errorJson.Message === 'string') {
						// Some APIs use capitalized 'Message'
						errorMessage = errorJson.Message;
					} else if (Array.isArray(errorJson.errors) && errorJson.errors.length > 0) {
						// Some APIs return errors array
						errorMessage = errorJson.errors[0];
					}
				} else {
					// If no JSON found, try regex extraction as fallback
					const messageMatch = errorText.match(/"message"\s*:\s*"([^"]+)"/);
					if (messageMatch && messageMatch[1]) {
						errorMessage = messageMatch[1];
					}
				}
			} catch {
				// If JSON parsing fails, use the original error message
				errorMessage = errorText;
			}
		}

		return errorMessage;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setSubmitError(null);
		setSubmitSuccess(false);

		if (!validateForm()) {
			return;
		}

		try {
			const feeId = initialData?.feeId;
			const payload = {
				departmentId: formData.departmentId,
				feeShort: formData.feeShort.trim(),
				feeLong: formData.feeLong?.trim() || undefined,
				feeType: formData.feeType,
				defaultFee: formData.defaultFee,
				additionalFee: formData.additionalFee,
				reimburseTo: formData.reimburseTo,
				isActive: formData.isActive,
				isDefault: formData.isDefault,
				effectiveStartDate: formData.effectiveStartDate,
				effectiveEndDate: formData.effectiveEndDate || undefined,
			};

			if (isEditMode && feeId) {
				await dispatch(upsertDepartmentFeeThunk({ feeId, ...payload })).unwrap();
			} else {
				await dispatch(upsertDepartmentFeeThunk(payload)).unwrap();
			}

			setSubmitSuccess(true);
			if (onSuccess) {
				setTimeout(() => {
					onSuccess();
				}, 1000);
			}
		} catch (error) {
			const errorMessage = parseErrorMessage(error);
			setSubmitError(
				error instanceof Error
					? errorMessage
					: reduxError || (isEditMode ? 'Failed to update department fee' : 'Failed to create department fee')
			);
		}
	};

	
	return (
		<div className={`department-fee-form ${className}`}>
			<form onSubmit={handleSubmit} className="department-fee-form__form" noValidate>
				<div className="department-fee-form__form-row">
					<SMSTextField
						type="text"
						label={DEPARTMENT_FEE.FORM.TITLE}
						value={formData.feeShort}
						onChange={(e) => handleChange(FIELD_NAMES.FEE_SHORT, e.target.value)}
						placeholder={DEPARTMENT_FEE.FORM.TITLE_PLACEHOLDER}
						error={Boolean(errors.feeShort)}
						helperText={errors.feeShort}
						name={FIELD_NAMES.FEE_SHORT}
						id={FIELD_NAMES.FEE_SHORT}
						disabled={isLoading}
						required
						inputProps={{ maxLength: 50 }}
					/>
				</div>

				<div className="department-fee-form__form-row">
					<SMSTextArea
						label={DEPARTMENT_FEE.FORM.DESCRIPTION}
						value={formData.feeLong || ''}
						onChange={(e) => handleChange(FIELD_NAMES.FEE_LONG, e.target.value)}
						placeholder={DEPARTMENT_FEE.FORM.DESCRIPTION_PLACEHOLDER}
						error={Boolean(errors.feeLong)}
						helperText={errors.feeLong}
						name={FIELD_NAMES.FEE_LONG}
						id={FIELD_NAMES.FEE_LONG}
						disabled={isLoading}
						required
						inputProps={{ maxLength: 200 }}
						rows={4}
					/>
				</div>

				<div className="department-fee-form__form-grid">
					<div className="department-fee-form__form-row">
						<SMSDropdown
							label={DEPARTMENT_FEE.FORM.FEE_TYPE}
							options={feeTypeOptions}
							value={formData.feeType && formData.feeType >= 1 ? String(formData.feeType) : ''}
							onChange={(e) => {
								const value = String(e.target.value);
								if (value) {
									handleChange(FIELD_NAMES.FEE_TYPE, Number(value) as FeeType);
								}
							}}
							placeholder={DEPARTMENT_FEE.FORM.FEE_TYPE_PLACEHOLDER}
							error={Boolean(errors.feeType)}
							helperText={errors.feeType}
							name={FIELD_NAMES.FEE_TYPE}
							id={FIELD_NAMES.FEE_TYPE}
							disabled={isLoading}
						/>
					</div>

					<div className="department-fee-form__form-row">
						<SMSCurrencyInput
							label={DEPARTMENT_FEE.FORM.DEFAULT_FEE}
							value={Number.isNaN(formData.defaultFee) ? null : formData.defaultFee}
							onChange={(value) => handleChange(FIELD_NAMES.DEFAULT_FEE, value ?? Number.NaN)}
							onFocus={(e) => {
								if (formData.defaultFee === 0) {
									e.target.select();
								}
							}}
							placeholder={DEPARTMENT_FEE.FORM.DEFAULT_FEE_PLACEHOLDER}
							error={Boolean(errors.defaultFee)}
							helperText={errors.defaultFee}
							name={FIELD_NAMES.DEFAULT_FEE}
							id={FIELD_NAMES.DEFAULT_FEE}
							disabled={isLoading}
							required
						/>
					</div>

					<div className="department-fee-form__form-row">
						<SMSCurrencyInput
							label={DEPARTMENT_FEE.FORM.ADDITIONAL_FEE}
							value={Number.isNaN(formData.additionalFee) ? null : formData.additionalFee}
							onChange={(value) => handleChange(FIELD_NAMES.ADDITIONAL_FEE, value ?? Number.NaN)}
							onFocus={(e) => {
								if (formData.additionalFee === 0) {
									e.target.select();
								}
							}}
							placeholder={DEPARTMENT_FEE.FORM.ADDITIONAL_FEE_PLACEHOLDER}
							error={Boolean(errors.additionalFee)}
							helperText={errors.additionalFee}
							name={FIELD_NAMES.ADDITIONAL_FEE}
							id={FIELD_NAMES.ADDITIONAL_FEE}
							disabled={isLoading}
						/>
					</div>

					<div className="department-fee-form__form-row">
						<SMSDropdown
							label={DEPARTMENT_FEE.FORM.REIMBURSE_TO}
							options={reimburseToOptions}
							value={String(formData.reimburseTo)}
							onChange={(e) => handleChange(FIELD_NAMES.REIMBURSE_TO, Number(String(e.target.value)) as ReimburseTo)}
							placeholder={DEPARTMENT_FEE.FORM.REIMBURSE_TO_PLACEHOLDER}
							error={Boolean(errors.reimburseTo)}
							helperText={errors.reimburseTo}
							name={FIELD_NAMES.REIMBURSE_TO}
							id={FIELD_NAMES.REIMBURSE_TO}
							disabled={isLoading}
						/>
					</div>
				</div>

				<div className="department-fee-form__form-grid">
					<div className="department-fee-form__form-row">
						<SMSDatePicker
							label={DEPARTMENT_FEE.FORM.EFFECTIVE_START_DATE}
							value={formData.effectiveStartDate || undefined}
							onChange={(value) => handleChange(FIELD_NAMES.EFFECTIVE_START_DATE, value)}
							placeholder={DEPARTMENT_FEE.FORM.EFFECTIVE_START_DATE_PLACEHOLDER}
							error={errors.effectiveStartDate}
							name={FIELD_NAMES.EFFECTIVE_START_DATE}
							id={FIELD_NAMES.EFFECTIVE_START_DATE}
							disabled={isLoading}
							required
						/>
					</div>

					<div className="department-fee-form__form-row">
						<SMSDatePicker
							label={DEPARTMENT_FEE.FORM.EFFECTIVE_END_DATE}
							value={formData.effectiveEndDate || undefined}
							onChange={(value) => handleChange(FIELD_NAMES.EFFECTIVE_END_DATE, value)}
							placeholder={DEPARTMENT_FEE.FORM.EFFECTIVE_END_DATE_PLACEHOLDER}
							error={errors.effectiveEndDate}
							name={FIELD_NAMES.EFFECTIVE_END_DATE}
							id={FIELD_NAMES.EFFECTIVE_END_DATE}
							disabled={isLoading}
							minDate={formData.effectiveStartDate}
						/>
					</div>
				</div>

				<div className="department-fee-form__form-grid">
					<div className="department-fee-form__form-row">
						<SMSCheckbox
							label={DEPARTMENT_FEE.FORM.IS_DEFAULT}
							checked={formData.isDefault}
							onChange={(checked) => handleChange(FIELD_NAMES.IS_DEFAULT, checked)}
							disabled={isLoading}
							name={FIELD_NAMES.IS_DEFAULT}
							id={FIELD_NAMES.IS_DEFAULT}
						/>
					</div>
					<div className="department-fee-form__form-row">
						<SMSSwitch
							id={FIELD_NAMES.IS_ACTIVE}
							label={DEPARTMENT_FEE.FORM.IS_ACTIVE}
							checked={formData.isActive}
							onChange={(e) => handleChange(FIELD_NAMES.IS_ACTIVE, e.target.checked)}
							disabled={isLoading}
						/>
					</div>
				</div>

				{initialData && (
					<div className="department-fee-form__audit-info">
						<div className="department-fee-form__audit-info-row">
							<span className="department-fee-form__audit-item">
								<span className="department-fee-form__audit-label">Created By:</span>
								<span className="department-fee-form__audit-value">
									{initialData.createdBy || ''}
									{initialData.createdDate && (
										<span
											className="department-fee-form__audit-date"
											title={`${formatDate(initialData.createdDate)} ${formatTime(initialData.createdDate)}`}
										>
											{' '}{new Date(initialData.createdDate).toLocaleDateString('en-US', {
												year: 'numeric',
												month: 'short',
												day: 'numeric'
											})}
										</span>
									)}
								</span>
							</span>
							<span className="department-fee-form__audit-separator">|</span>
							<span className="department-fee-form__audit-item">
								<span className="department-fee-form__audit-label">Edited By:</span>
								<span className="department-fee-form__audit-value">
									{initialData.editedBy || ''}
									{initialData.editedDate && (
										<span
											className="department-fee-form__audit-date"
											title={`${formatDate(initialData.editedDate)} ${formatTime(initialData.editedDate)}`}
										>
											{' '}{new Date(initialData.editedDate).toLocaleDateString('en-US', {
												year: 'numeric',
												month: 'short',
												day: 'numeric'
											})}
										</span>
									)}
								</span>
							</span>
						</div>
					</div>
				)}

				<div className="department-fee-form__actions">
					<SMSButton
						type="button"
						onClick={onCancel}
						disabled={isLoading}
					>
						{DEPARTMENT_FEE.FORM.CANCEL_BUTTON}
					</SMSButton>
					<SMSButton type="submit" disabled={isLoading} loading={isLoading}>
						{isEditMode ? DEPARTMENT_FEE.BUTTON.UPDATE : DEPARTMENT_FEE.FORM.SUBMIT_BUTTON}
					</SMSButton>
				</div>
			</form>
		</div>
	);
};
