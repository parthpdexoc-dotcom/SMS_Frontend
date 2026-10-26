import React, { useMemo } from 'react';
import { EQUIPMENT_TYPE } from '@/constants/strings';
import { EquipmentTypeResponse } from '@/types/equipmentType';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { upsertEquipmentTypeThunk } from '@/store/slices/equipmentTypeSlice';
import { ShortLongStatusForm } from '@/components/smsmolecules/ShortLongStatusForm';

export interface EquipmentTypeFormProps {
  initialData?: EquipmentTypeResponse | null;
  onSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
}

export const EquipmentTypeForm: React.FC<EquipmentTypeFormProps> = ({
  initialData,
  onSuccess,
  onCancel,
  className = '',
}) => {
  const isEditMode = Boolean(initialData?.equipementTypeID);
  const dispatch = useAppDispatch();
  const { isLoading, error: reduxError } = useAppSelector((state) => state.equipmentType);

  // IMPORTANT: keep initialValues reference stable across rerenders (e.g. when isLoading toggles),
  // otherwise ShortLongStatusForm will reset the form briefly to old values.
  const initialValues = useMemo(() => {
    return initialData
      ? {
          short: initialData.equipementTypeShort || '',
          long: initialData.equipementTypeLong || '',
          isActive: initialData.equipementTypeStatus ?? true,
          extras: { isVehicle: Boolean(initialData.isVehicle) },
        }
      : {
          isActive: true,
          extras: { isVehicle: false },
        };
  }, [
    initialData?.equipementTypeShort,
    initialData?.equipementTypeLong,
    initialData?.equipementTypeStatus,
    initialData?.isVehicle,
  ]);

  return (
    <ShortLongStatusForm
      className={className}
      isEditMode={isEditMode}
      isLoading={isLoading}
      reduxError={reduxError}
      strings={{
        FORM: {
          TITLE: EQUIPMENT_TYPE.FORM.TITLE,
          TITLE_PLACEHOLDER: EQUIPMENT_TYPE.FORM.TITLE_PLACEHOLDER,
          DESCRIPTION: EQUIPMENT_TYPE.FORM.DESCRIPTION,
          DESCRIPTION_PLACEHOLDER: EQUIPMENT_TYPE.FORM.DESCRIPTION_PLACEHOLDER,
          IS_ACTIVE: EQUIPMENT_TYPE.FORM.IS_ACTIVE,
          CANCEL_BUTTON: EQUIPMENT_TYPE.FORM.CANCEL_BUTTON,
          SUBMIT_BUTTON: EQUIPMENT_TYPE.FORM.SUBMIT_BUTTON,
          SUBMITTING: EQUIPMENT_TYPE.FORM.SUBMITTING,
        },
        ERRORS: {
          TITLE_REQUIRED: EQUIPMENT_TYPE.ERRORS.TITLE_REQUIRED,
          DESCRIPTION_REQUIRED: EQUIPMENT_TYPE.ERRORS.DESCRIPTION_REQUIRED,
        },
        SUCCESS: {
          ADDED: EQUIPMENT_TYPE.SUCCESS.ADDED,
          UPDATED: EQUIPMENT_TYPE.SUCCESS.UPDATED,
        },
        BUTTON: {
          UPDATE: EQUIPMENT_TYPE.BUTTON.UPDATE,
          UPDATING: EQUIPMENT_TYPE.BUTTON.UPDATING,
        },
      }}
      extraCheckboxes={[
        { key: 'isVehicle', label: EQUIPMENT_TYPE.FORM.IS_VEHICLE },
      ]}
      initialValues={initialValues}
      onSubmit={async (values) => {
        const equipementTypeID = initialData?.equipementTypeID;
        const payload = {
          equipementTypeShort: values.short,
          equipementTypeLong: values.long,
          equipementTypeStatus: values.isActive,
          isVehicle: Boolean(values.extras.isVehicle),
        };

        if (isEditMode && equipementTypeID) {
          await dispatch(
            upsertEquipmentTypeThunk({
              equipementTypeID,
              ...payload,
            })
          ).unwrap();
          return;
        }

        await dispatch(upsertEquipmentTypeThunk(payload)).unwrap();
      }}
      onSuccess={onSuccess}
      onCancel={onCancel}
      showAuditInfo={true}
      auditData={initialData ? {
        createdBy: initialData.createdBy || undefined,
        createdDate: initialData.createdDate || undefined,
        editedBy: initialData.editedBy || undefined,
        editedDate: initialData.editedDate || undefined,
      } : undefined}
    />
  );
};


