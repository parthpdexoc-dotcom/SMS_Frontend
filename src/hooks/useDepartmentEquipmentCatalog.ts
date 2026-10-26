import { useEffect, useMemo, useState } from 'react';
import { getDepartmentEquipmentByType } from '@/services/departmentEquipmentService';
import { useAppSelector } from '@/store/hooks';
import { DepartmentEquipmentResponse } from '@/types/departmentEquipment';
import {
  buildEquipmentTypeVehicleMap,
  getDepartmentEquipmentCategory,
  mergeCatalogWithDepartmentList,
} from '@/utils/departmentEquipmentCatalogUtils';

/**
 * Loads department equipment catalog for one category (Equipment=0, Vehicle=1)
 * into local state so vehicle/equipment tabs never share the same Redux array.
 */
export function useDepartmentEquipmentCatalog(
  departmentId: string | undefined,
  isVehicle: boolean,
  selectedIds: string[]
) {
  const [catalogItems, setCatalogItems] = useState<DepartmentEquipmentResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const departmentEquipments = useAppSelector((state) => state.departmentEquipment.departmentEquipments);
  const { activeEquipmentTypes } = useAppSelector((state) => state.equipmentType);

  const equipmentTypeVehicleById = useMemo(
    () => buildEquipmentTypeVehicleMap(activeEquipmentTypes),
    [activeEquipmentTypes]
  );

  const category = getDepartmentEquipmentCategory(isVehicle);
  const selectedIdsKey = selectedIds.join('|');

  useEffect(() => {
    if (!departmentId) {
      setCatalogItems([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    getDepartmentEquipmentByType(departmentId, category, {
      pageSize: 10000,
      selectedIds: selectedIds.length > 0 ? selectedIds : undefined,
    })
      .then((data) => {
        if (cancelled) return;
        setCatalogItems(
          mergeCatalogWithDepartmentList(data, departmentEquipments, isVehicle, equipmentTypeVehicleById)
        );
      })
      .catch(() => {
        if (!cancelled) setCatalogItems([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    departmentId,
    category,
    isVehicle,
    selectedIdsKey,
    departmentEquipments,
    equipmentTypeVehicleById,
  ]);

  return { catalogItems, isLoading, equipmentTypeVehicleById };
}
