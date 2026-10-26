import { DepartmentEquipmentCategory, DepartmentEquipmentResponse } from '@/types/departmentEquipment';
import { EquipmentTypeResponse } from '@/types/equipmentType';

export const normalizeDepartmentEquipmentId = (id: unknown): string =>
  String(id ?? '').trim().toLowerCase();

export const buildEquipmentTypeVehicleMap = (
  equipmentTypes: EquipmentTypeResponse[]
): Map<string, boolean> => {
  const map = new Map<string, boolean>();
  equipmentTypes.forEach((equipmentType) => {
    const typeId = normalizeDepartmentEquipmentId(equipmentType.equipementTypeID);
    if (typeId) map.set(typeId, equipmentType.isVehicle);
  });
  return map;
};

export const resolveDepartmentEquipmentIsVehicle = (
  item: DepartmentEquipmentResponse,
  equipmentTypeVehicleById: Map<string, boolean>
): boolean => {
  const typeId = normalizeDepartmentEquipmentId(item.equipmentTypeID);
  if (typeId && equipmentTypeVehicleById.has(typeId)) {
    return equipmentTypeVehicleById.get(typeId) ?? false;
  }
  return Boolean(item.isVehicle);
};

export const getDepartmentEquipmentCategory = (isVehicle: boolean): DepartmentEquipmentCategory =>
  isVehicle ? DepartmentEquipmentCategory.Vehicle : DepartmentEquipmentCategory.Equipment;

/** Enrich category catalog with names/defaults from /DepartmentEquipment list API. */
export const mergeCatalogWithDepartmentList = (
  catalog: DepartmentEquipmentResponse[],
  list: DepartmentEquipmentResponse[],
  isVehicle: boolean,
  equipmentTypeVehicleById: Map<string, boolean>
): DepartmentEquipmentResponse[] => {
  if (list.length === 0) return catalog;

  const listById = new Map(
    list.map((item) => [normalizeDepartmentEquipmentId(item.departmentEquipmentID), item])
  );

  const defaultIds = new Set(
    list
      .filter(
        (item) =>
          item.isDefault &&
          resolveDepartmentEquipmentIsVehicle(item, equipmentTypeVehicleById) === isVehicle
      )
      .map((item) => normalizeDepartmentEquipmentId(item.departmentEquipmentID))
  );

  return catalog.map((item) => {
    const id = normalizeDepartmentEquipmentId(item.departmentEquipmentID);
    const listItem = listById.get(id);
    const equipmentType =
      String(item.equipmentType ?? '').trim() ||
      String(listItem?.equipmentType ?? '').trim() ||
      item.equipmentType;

    return {
      ...item,
      equipmentType,
      isDefault: item.isDefault || defaultIds.has(id),
    };
  });
};

/** Default department equipment id for vehicle or equipment tab (must exist in catalog). */
export const getDefaultDepartmentEquipmentIdForCategory = (
  catalogItems: DepartmentEquipmentResponse[],
  departmentEquipments: DepartmentEquipmentResponse[],
  isVehicle: boolean,
  equipmentTypeVehicleById: Map<string, boolean>
): string | undefined => {
  const matchesCategory = (item: DepartmentEquipmentResponse) =>
    item.isDefault &&
    resolveDepartmentEquipmentIsVehicle(item, equipmentTypeVehicleById) === isVehicle;

  const fromCatalog = catalogItems.find(matchesCategory);
  if (fromCatalog?.departmentEquipmentID) {
    return fromCatalog.departmentEquipmentID;
  }

  const listDefault = departmentEquipments.find(matchesCategory);
  if (!listDefault?.departmentEquipmentID) return undefined;

  const defaultId = listDefault.departmentEquipmentID;
  const inCatalog = catalogItems.some(
    (item) =>
      normalizeDepartmentEquipmentId(item.departmentEquipmentID) ===
      normalizeDepartmentEquipmentId(defaultId)
  );
  return inCatalog ? defaultId : undefined;
};
