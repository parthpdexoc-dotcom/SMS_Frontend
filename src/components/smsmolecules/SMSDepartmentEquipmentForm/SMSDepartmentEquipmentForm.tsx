import React, { useState, useEffect, useMemo } from 'react';
import { SMSButton, SMSCheckbox, SMSCurrencyInput, SMSDropdown, SMSSwitch, SMSTextField } from '@/components/smsatoms';
import { DEPARTMENT_EQUIPMENT } from '@/constants/strings';
import { DepartmentEquipmentResponse, VehicleApprovalRoutingDto } from '@/types/departmentEquipment';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { upsertDepartmentEquipmentThunk } from '@/store/slices/departmentEquipmentSlice';
import { fetchActiveEquipmentTypes } from '@/store/slices/equipmentTypeSlice';
import { formatDate, formatTime } from '@/utils';
import { getDepartmentEquipments } from '@/services/departmentEquipmentService';
import { showToast } from '@/store/slices/toastSlice';
import './SMSDepartmentEquipmentForm.css';

const normalizeTypeId = (id: unknown): string => String(id ?? '').trim().toLowerCase();
export interface SMSDepartmentEquipmentFormProps {
  initialData?: DepartmentEquipmentResponse | null;
  /** Equipment type IDs already assigned in this department (from list data; hides duplicates in Add). */
  assignedEquipmentTypeIds?: string[];
  onSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
}

interface DepartmentEquipmentFormData {
  equipmentTypeID: string;
  chargedType: number;
  charge: number;
  chargeMileage: boolean;
  mileageCharge: number;
  mileageCondition: number;
  equipmentStatus: boolean;
  requiresApproval: boolean;
  routingGroupIDs: string[]; // Changed to array for multi-select
  requiresUtilizationRecorded: boolean;
  isDefault: boolean;
}

// Field name constants to avoid hardcoded strings
const FIELD_NAMES = {
  EQUIPMENT_TYPE_ID: 'equipmentTypeID',
  CHARGED_TYPE: 'chargedType',
  CHARGE: 'charge',
  CHARGE_MILEAGE: 'chargeMileage',
  MILEAGE_CHARGE: 'mileageCharge',
  MILEAGE_CONDITION: 'mileageCondition',
  EQUIPMENT_STATUS: 'equipmentStatus',
  REQUIRES_APPROVAL: 'requiresApproval',
  ROUTING_GROUP_IDS: 'routingGroupIDs',
  REQUIRES_UTILIZATION_RECORDED: 'requiresUtilizationRecorded',
  IS_DEFAULT: 'isDefault',
} as const;

interface DepartmentEquipmentFormErrors {
  equipmentTypeID?: string;
  chargedType?: string;
  charge?: string;
  mileageCharge?: string;
  mileageCondition?: string;
  routingGroupID?: string;
}

/** Backend charged type: 0 = Per Hour, 1 = Per Item (always used for non-vehicle equipment). */
const CHARGED_TYPE_PER_ITEM = 1;

const getDefaultFormData = (): DepartmentEquipmentFormData => ({
  equipmentTypeID: '',
  chargedType: CHARGED_TYPE_PER_ITEM,
  charge: 0,
  chargeMileage: false,
  mileageCharge: 0,
  mileageCondition: 0,
  equipmentStatus: true,
  requiresApproval: false,
  routingGroupIDs: [],
  requiresUtilizationRecorded: false,
  isDefault: false,
});



export const SMSDepartmentEquipmentForm: React.FC<SMSDepartmentEquipmentFormProps> = ({
  initialData,
  assignedEquipmentTypeIds,
  onSuccess,
  onCancel,
  className = '',
}) => {
  const [formData, setFormData] = useState<DepartmentEquipmentFormData>(() => {
    if (initialData) {
      // Extract routingGroupIDs from vehicleApprovalRoutings (backend returns sorted by rank) or fallback to routingGroupIDs/routingGroupID
      let routingGroupIDs: string[] = [];
      
      if (initialData.vehicleApprovalRoutings && initialData.vehicleApprovalRoutings.length > 0) {
        // Extract approverIDs (backend already returns sorted by rank)
        routingGroupIDs = initialData.vehicleApprovalRoutings
          .map(r => r.approverID)
          .filter(id => id);
      } else if (initialData.routingGroupIDs) {
        routingGroupIDs = Array.isArray(initialData.routingGroupIDs) 
          ? initialData.routingGroupIDs 
          : [initialData.routingGroupIDs];
      } else if (initialData.routingGroupID) {
        routingGroupIDs = [initialData.routingGroupID];
      }
      
      return {
        equipmentTypeID: initialData.equipmentTypeID || '',
        chargedType: initialData.chargedType ?? 0,
        charge: initialData.charge ?? 0,
        chargeMileage: initialData.chargeMileage ?? false,
        mileageCharge: initialData.mileageCharge ?? 0,
        mileageCondition: initialData.mileageCondition ?? 0,
        equipmentStatus: initialData.equipmentStatus ?? true,
        requiresApproval: initialData.requiresApproval ?? false,
        routingGroupIDs: routingGroupIDs.filter((id: string) => id), // Filter out empty strings
        requiresUtilizationRecorded: initialData.requiresUtilizationRecorded ?? false,
        isDefault: initialData.isDefault ?? false,
      };
    }
    return getDefaultFormData();
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        equipmentTypeID: initialData.equipmentTypeID || '',
        chargedType: initialData.chargedType ?? 0,
        charge: initialData.charge ?? 0,
        chargeMileage: initialData.chargeMileage ?? false,
        mileageCharge: initialData.mileageCharge ?? 0,
        mileageCondition: initialData.mileageCondition ?? 0,
        equipmentStatus: initialData.equipmentStatus ?? true,
        requiresApproval: false,
        routingGroupIDs: [],
        requiresUtilizationRecorded: initialData.requiresUtilizationRecorded ?? false,
        isDefault: initialData.isDefault ?? false,
      });
    } else {
      setFormData(getDefaultFormData());
    }
  }, [initialData]);

  const dispatch = useAppDispatch();
  const { isLoading, departmentEquipments } = useAppSelector((state) => state.departmentEquipment);
  const { activeEquipmentTypes } = useAppSelector((state) => state.equipmentType);
  const [errors, setErrors] = useState<DepartmentEquipmentFormErrors>({});
  const [allDepartmentEquipments, setAllDepartmentEquipments] = useState<DepartmentEquipmentResponse[]>([]);

  useEffect(() => {
    let cancelled = false;
    getDepartmentEquipments({ page: 1, pageSize: 1000, isActive: true })
      .then(({ data }) => {
        if (!cancelled) setAllDepartmentEquipments(data);
      })
      .catch(() => {
        if (!cancelled) setAllDepartmentEquipments([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch active equipment types for form dropdown
  useEffect(() => {
    dispatch(
      fetchActiveEquipmentTypes({
        selectedId: initialData?.equipmentTypeID || undefined,
      })
    );
  }, [dispatch, initialData?.equipmentTypeID]);

  // Equipment types already assigned to this department — hide from Add dropdown (see EmployeeForm skillOptionsForDropdown).
  const usedEquipmentTypeIdsSet = useMemo(() => {
    const set = new Set<string>();
    const editingTypeId = initialData?.equipmentTypeID
      ? String(initialData.equipmentTypeID).trim().toLowerCase()
      : '';

    const typeIdsFromList =
      assignedEquipmentTypeIds && assignedEquipmentTypeIds.length > 0
        ? assignedEquipmentTypeIds
        : departmentEquipments.map((row) => row.equipmentTypeID);

    typeIdsFromList.forEach((rawId) => {
      const typeId = String(rawId ?? '').trim();
      if (!typeId) return;
      const normalized = typeId.toLowerCase();
      if (editingTypeId && normalized === editingTypeId) return;
      set.add(normalized);
    });

    return set;
  }, [assignedEquipmentTypeIds, departmentEquipments, initialData?.equipmentTypeID]);

  const equipmentTypeOptions = useMemo(() => {
    const base = activeEquipmentTypes
      .filter((et) => {
        const typeId = String(et.equipementTypeID ?? '').trim().toLowerCase();
        return typeId && !usedEquipmentTypeIdsSet.has(typeId);
      })
      .map((et) => ({
        value: et.equipementTypeID,
        label: et.equipementTypeShort || et.equipementTypeLong || 'Unknown',
      }));

    const selected = formData.equipmentTypeID ? String(formData.equipmentTypeID).trim() : '';
    if (!selected || base.some((option) => String(option.value).trim() === selected)) return base;
    return [
      ...base,
      {
        value: selected,
        label:
          (initialData?.equipmentType && String(initialData.equipmentType).trim()) ||
          'Currently assigned',
      },
    ];
  }, [
    activeEquipmentTypes,
    formData.equipmentTypeID,
    initialData?.equipmentType,
    usedEquipmentTypeIdsSet,
  ]);

  const selectedEquipmentType = activeEquipmentTypes.find(
    (et) => et.equipementTypeID === formData.equipmentTypeID
  );
  const isVehicle = selectedEquipmentType
    ? selectedEquipmentType.isVehicle
    : (initialData?.isVehicle ?? false);

  const equipmentTypesById = useMemo(() => {
    const map = new Map<string, boolean>();
    activeEquipmentTypes.forEach((et) => {
      const typeId = normalizeTypeId(et.equipementTypeID);
      if (typeId) map.set(typeId, et.isVehicle);
    });
    return map;
  }, [activeEquipmentTypes]);

  const resolveIsVehicle = (item: DepartmentEquipmentResponse): boolean => {
    const typeId = normalizeTypeId(item.equipmentTypeID);
    if (typeId && equipmentTypesById.has(typeId)) {
      return equipmentTypesById.get(typeId) ?? false;
    }
    return Boolean(item.isVehicle);
  };

  const equipmentsForDefaultCheck =
    allDepartmentEquipments.length > 0 ? allDepartmentEquipments : departmentEquipments;

  const currentEquipmentId = initialData?.departmentEquipmentID?.trim().toLowerCase() ?? '';
  const hasOtherDefaultInCategory = useMemo(
    () =>
      equipmentsForDefaultCheck.some((item) => {
        if (!item.isDefault) return false;
        if (String(item.departmentEquipmentID ?? '').trim().toLowerCase() === currentEquipmentId) {
          return false;
        }
        return resolveIsVehicle(item) === isVehicle;
      }),
    [equipmentsForDefaultCheck, currentEquipmentId, isVehicle, equipmentTypesById]
  );
  const canSetAsDefault = Boolean(formData.equipmentTypeID) && !hasOtherDefaultInCategory;
  const isDefaultSwitchDisabled = isLoading || !canSetAsDefault;

  useEffect(() => {
    if (!isDefaultSwitchDisabled || !formData.isDefault) return;
    setFormData((prev) => ({ ...prev, isDefault: false }));
  }, [isDefaultSwitchDisabled, formData.isDefault]);

  useEffect(() => {
    if (!isVehicle && formData.chargedType !== CHARGED_TYPE_PER_ITEM) {
      setFormData((prev) => ({ ...prev, chargedType: CHARGED_TYPE_PER_ITEM }));
    }
  }, [isVehicle, formData.chargedType]);

  // Charged Type enum options (display text, send number) — vehicles only
  const chargedTypeOptions = DEPARTMENT_EQUIPMENT.ENUMS.CHARGED_TYPE;

  const handleChange = (field: keyof DepartmentEquipmentFormData, value: any) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      
      // If equipment type is being changed, check if it's a vehicle
      if (field === FIELD_NAMES.EQUIPMENT_TYPE_ID) {
        const newSelectedEquipmentType = activeEquipmentTypes.find(
          (et) => et.equipementTypeID === value
        );
        const isNewVehicle = newSelectedEquipmentType?.isVehicle ?? false;
        
        // Non-vehicle equipment is always charged per item
        if (!isNewVehicle) {
          updated.chargedType = CHARGED_TYPE_PER_ITEM;
          updated.chargeMileage = false;
          updated.requiresApproval = false;
          updated.routingGroupIDs = [];
          updated.mileageCharge = 0;
          updated.mileageCondition = 0;
        }
      }
      
      return updated;
    });
    // Clear error for this field when user starts typing
    if (errors[field as keyof DepartmentEquipmentFormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    if (field === FIELD_NAMES.CHARGE_MILEAGE && !value) {
      setErrors((prev) => ({
        ...prev,
        mileageCharge: undefined,
        mileageCondition: undefined,
      }));
    }
  };

  // Prevent decimal point from being typed in integer fields
  const preventDecimalPoint = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === '.') {
      e.preventDefault();
    }
  };

  const validateForm = (): boolean => {
    const newErrors: DepartmentEquipmentFormErrors = {};

    if (!formData.equipmentTypeID.trim()) {
      newErrors.equipmentTypeID = DEPARTMENT_EQUIPMENT.ERRORS.EQUIPMENT_TYPE_REQUIRED;
    }

    if (formData.chargeMileage) {
      if (formData.mileageCharge <= 0) {
        newErrors.mileageCharge = DEPARTMENT_EQUIPMENT.ERRORS.MILEAGE_CHARGE_REQUIRED;
      }
      if (formData.mileageCondition <= 0) {
        newErrors.mileageCondition = DEPARTMENT_EQUIPMENT.ERRORS.MILEAGE_CONDITION_REQUIRED;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (formData.isDefault && hasOtherDefaultInCategory) {
      dispatch(showToast(DEPARTMENT_EQUIPMENT.ERRORS.IS_DEFAULT_CONFLICT, 'error'));
      return;
    }

    try {
      const payload = {
        equipmentTypeID: formData.equipmentTypeID,
        chargedType: isVehicle ? formData.chargedType : CHARGED_TYPE_PER_ITEM,
        charge: formData.charge,
        chargeMileage: formData.chargeMileage,
        mileageCharge: formData.chargeMileage ? formData.mileageCharge : 0,
        mileageCondition: formData.chargeMileage ? formData.mileageCondition : 0,
        equipmentStatus: formData.equipmentStatus,
        requiresApproval: false,
        vehicleApprovalRoutings: null as VehicleApprovalRoutingDto[] | null,
        requiresUtilizationRecorded: formData.requiresUtilizationRecorded,
        isDefault: formData.isDefault,
      };

      if (initialData?.departmentEquipmentID) {
        await dispatch(
          upsertDepartmentEquipmentThunk({
            departmentEquipmentID: initialData.departmentEquipmentID,
            ...payload,
          })
        ).unwrap();
      } else {
        await dispatch(upsertDepartmentEquipmentThunk(payload)).unwrap();
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      // Errors are surfaced via toasts in the Redux slice
      console.error('Failed to save department equipment:', error);
    }
  };

  const isEditMode = Boolean(initialData?.departmentEquipmentID);

  return (
    <div className={`department-equipment-form ${className}`}>
      <form onSubmit={handleSubmit} className="department-equipment-form__form">
        <div className="department-equipment-form__form-row">
          <SMSDropdown
            label={DEPARTMENT_EQUIPMENT.FORM.EQUIPMENT_TYPE}
            options={equipmentTypeOptions}
            value={formData.equipmentTypeID}
            onChange={(e) => handleChange(FIELD_NAMES.EQUIPMENT_TYPE_ID, String(e.target.value))}
            placeholder={DEPARTMENT_EQUIPMENT.FORM.EQUIPMENT_TYPE_PLACEHOLDER}
            error={Boolean(errors.equipmentTypeID)}
            helperText={errors.equipmentTypeID}
            name={FIELD_NAMES.EQUIPMENT_TYPE_ID}
            id={FIELD_NAMES.EQUIPMENT_TYPE_ID}
            disabled={isLoading}
            required
          />
        </div>

        {!isVehicle && (
          <div className="department-equipment-form__form-row">
            <SMSCurrencyInput
              label={DEPARTMENT_EQUIPMENT.FORM.CHARGE}
              value={formData.charge}
              onChange={(value) => handleChange(FIELD_NAMES.CHARGE, value ?? 0)}
              placeholder={DEPARTMENT_EQUIPMENT.FORM.CHARGE_PLACEHOLDER}
              error={Boolean(errors.charge)}
              helperText={errors.charge}
              name={FIELD_NAMES.CHARGE}
              id={FIELD_NAMES.CHARGE}
              disabled={isLoading}
            />
          </div>
        )}

        {isVehicle && (
          <div className="department-equipment-form__form-row">
            <SMSDropdown
              label={DEPARTMENT_EQUIPMENT.FORM.CHARGED_TYPE}
              options={chargedTypeOptions}
              value={formData.chargedType.toString()}
              onChange={(e) =>
                handleChange(FIELD_NAMES.CHARGED_TYPE, parseInt(String(e.target.value)) || 0)
              }
              placeholder={DEPARTMENT_EQUIPMENT.FORM.CHARGED_TYPE_PLACEHOLDER}
              error={Boolean(errors.chargedType)}
              helperText={errors.chargedType}
              name={FIELD_NAMES.CHARGED_TYPE}
              id={FIELD_NAMES.CHARGED_TYPE}
              disabled={isLoading}
            />
            <SMSCurrencyInput
              label={DEPARTMENT_EQUIPMENT.FORM.CHARGE}
              value={formData.charge}
              onChange={(value) => handleChange(FIELD_NAMES.CHARGE, value ?? 0)}
              placeholder={DEPARTMENT_EQUIPMENT.FORM.CHARGE_PLACEHOLDER}
              error={Boolean(errors.charge)}
              helperText={errors.charge}
              name={FIELD_NAMES.CHARGE}
              id={FIELD_NAMES.CHARGE}
              disabled={isLoading}
            />
          </div>
        )}

        {/* Charge Mileage Checkbox - Only show for vehicle equipment types */}
        {isVehicle && (
          <div className="department-equipment-form__checkbox-row">
              <SMSCheckbox
                checked={formData.chargeMileage}
                onChange={(checked) => handleChange(FIELD_NAMES.CHARGE_MILEAGE, checked)}
                name={FIELD_NAMES.CHARGE_MILEAGE}
                id={FIELD_NAMES.CHARGE_MILEAGE}
                disabled={isLoading}
                label={DEPARTMENT_EQUIPMENT.FORM.CHARGE_MILEAGE}
              />
          </div>
        )}

        {/* Mileage Section - Only show when chargeMileage is checked */}
        {formData.chargeMileage && (
          <div className="department-equipment-form__section">
            <div className="department-equipment-form__form-row">
              <SMSCurrencyInput
                label={DEPARTMENT_EQUIPMENT.FORM.MILEAGE_CHARGE}
                value={formData.mileageCharge}
                onChange={(value) => handleChange(FIELD_NAMES.MILEAGE_CHARGE, value ?? 0)}
                decimalPlaces={3}
                placeholder={DEPARTMENT_EQUIPMENT.FORM.MILEAGE_CHARGE_PLACEHOLDER}
                error={Boolean(errors.mileageCharge)}
                helperText={errors.mileageCharge}
                name={FIELD_NAMES.MILEAGE_CHARGE}
                id={FIELD_NAMES.MILEAGE_CHARGE}
                disabled={isLoading}
                required
              />

              <SMSTextField
                type="number"
                label={DEPARTMENT_EQUIPMENT.FORM.MILEAGE_CONDITION}
                value={formData.mileageCondition.toString()}
                onChange={(e) => handleChange(FIELD_NAMES.MILEAGE_CONDITION, parseInt(e.target.value) || 0)}
                onKeyDown={preventDecimalPoint}
                placeholder={DEPARTMENT_EQUIPMENT.FORM.MILEAGE_CONDITION_PLACEHOLDER}
                error={Boolean(errors.mileageCondition)}
                helperText={errors.mileageCondition}
                name={FIELD_NAMES.MILEAGE_CONDITION}
                id={FIELD_NAMES.MILEAGE_CONDITION}
                disabled={isLoading}
                inputProps={{ min: 1, step: 1 }}
                required
              />
            </div>
          </div>
        )}

        {/* Equipment Status / Utilization */}
        <SMSSwitch
          label={DEPARTMENT_EQUIPMENT.FORM.EQUIPMENT_STATUS}
          checked={formData.equipmentStatus}
          onChange={(e) => handleChange(FIELD_NAMES.EQUIPMENT_STATUS, e.target.checked)}
          name={FIELD_NAMES.EQUIPMENT_STATUS}
          id={FIELD_NAMES.EQUIPMENT_STATUS}
          disabled={isLoading}
        />

        <div className="department-equipment-form__checkboxes">
             <SMSCheckbox
            checked={formData.requiresUtilizationRecorded}
            onChange={(checked) => handleChange(FIELD_NAMES.REQUIRES_UTILIZATION_RECORDED, checked)}
            name={FIELD_NAMES.REQUIRES_UTILIZATION_RECORDED}
            id={FIELD_NAMES.REQUIRES_UTILIZATION_RECORDED}
            disabled={isLoading}
            label={DEPARTMENT_EQUIPMENT.FORM.REQUIRES_UTILIZATION_RECORDED}
          />
        </div>

        <SMSSwitch
            label={DEPARTMENT_EQUIPMENT.FORM.IS_DEFAULT}
            checked={formData.isDefault}
            onChange={(e) => handleChange(FIELD_NAMES.IS_DEFAULT, e.target.checked)}
            id={FIELD_NAMES.IS_DEFAULT}
            disabled={isDefaultSwitchDisabled}
            title={
              isDefaultSwitchDisabled && !canSetAsDefault
                ? DEPARTMENT_EQUIPMENT.FORM.IS_DEFAULT_DISABLED_HINT
                : undefined
            }
          />

        {isEditMode && initialData && (
          <div className="department-equipment-form__audit-info">
            <div className="department-equipment-form__audit-info-row">
              <span className="department-equipment-form__audit-item">
                <span className="department-equipment-form__audit-label">Created By:</span>
                <span className="department-equipment-form__audit-value">
                  {initialData.createdBy || ''}
                  {initialData.createdDate && (
                    <span
                      className="department-equipment-form__audit-date"
                      title={`${formatDate(initialData.createdDate.toString())} ${formatTime(initialData.createdDate.toString())}`}
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
              <span className="department-equipment-form__audit-separator">|</span>
              <span className="department-equipment-form__audit-item">
                <span className="department-equipment-form__audit-label">Edited By:</span>
                <span className="department-equipment-form__audit-value">
                  {initialData.editedBy || ''}
                  {initialData.editedDate && (
                    <span
                      className="department-equipment-form__audit-date"
                      title={`${formatDate(initialData.editedDate.toString())} ${formatTime(initialData.editedDate.toString())}`}
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

        <div className="department-equipment-form__footer">
          {onCancel && (
            <SMSButton
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="department-equipment-form__cancel-button"
            >
              {DEPARTMENT_EQUIPMENT.FORM.CANCEL_BUTTON}
            </SMSButton>
          )}
          <SMSButton
            type="submit"
            className="department-equipment-form__submit-button"
            fullWidth={!onCancel}
            disabled={isLoading}
            loading={isLoading}
          >
            {isEditMode ? DEPARTMENT_EQUIPMENT.BUTTON.UPDATE : DEPARTMENT_EQUIPMENT.FORM.SUBMIT_BUTTON}
          </SMSButton>
        </div>
      </form>
    </div>
  );
};

