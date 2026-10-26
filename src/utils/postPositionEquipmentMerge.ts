import type { RequestEquipmentDto } from '@/services/requestEquipmentService';
import type { PostEquipmentDto } from '@/services/postEquipmentService';

/** Request/post equipment APIs may return `departmentEquipmentID` or `DepartmentEquipmentID`. */
export function departmentEquipmentIdFromRow(row: unknown): string {
  if (row == null || typeof row !== 'object') return '';
  const r = row as Record<string, unknown>;
  const id = r.departmentEquipmentID ?? r.DepartmentEquipmentID;
  return id != null && String(id).trim() !== '' ? String(id).trim() : '';
}

export type MergeRequestPostEquipmentOptions = {
  /** When `'none'`, request rows have no postEquipmentID (post form display). Default keeps requestEquipmentID for close/view-details. */
  requestRowPostEquipmentId?: 'none' | 'requestEquipmentId';
  /**
   * Post form: request `equipmentPerPost` (true = Per Job) maps inversely to post `equipmentPerPostPosition`
   * (true = Per Job Position).
   */
  invertRequestEquipmentPerPost?: boolean;
};

/** Same merge as CloseForm bootstrap (request rows + post-specific rows by departmentEquipmentID). */
export function mergeRequestAndPostEquipmentForClose(
  requestEquipment: RequestEquipmentDto[],
  postEquipment: PostEquipmentDto[],
  effectivePostId: string,
  options?: MergeRequestPostEquipmentOptions
): PostEquipmentDto[] {
  const normalizeDeptId = (id: string | null | undefined): string => (id ? String(id).toLowerCase() : '');
  const byDeptId = new Map<string, PostEquipmentDto>();

  (requestEquipment ?? [])
    .filter((it) => Boolean(departmentEquipmentIdFromRow(it)))
    .forEach((it) => {
      const rawId = departmentEquipmentIdFromRow(it);
      const deptId = normalizeDeptId(rawId);
      if (!deptId) return;
      const postEquipmentID =
        options?.requestRowPostEquipmentId === 'none'
          ? null
          : (it.requestEquipmentID ?? rawId ?? null);
      byDeptId.set(deptId, {
        postEquipmentID,
        postID: effectivePostId || null,
        departmentEquipmentID: rawId,
        equipmentPerPostPosition: options?.invertRequestEquipmentPerPost
          ? !it.equipmentPerPost
          : it.equipmentPerPost,
        equipmentPerPost: it.equipmentPerPost,
        equipmentQuantity: it.equipmentQuantity,
        isVehicle: it.isVehicle,
        equipmentName: it.equipmentName ?? it.equipmentTypeName ?? null,
        equipmentTypeName: it.equipmentTypeName ?? null,
        charge: it.charge,
        mileageCharge: it.mileageCharge,
        chargeMileage: it.chargeMileage,
        requiresApproval: it.requiresApproval,
        requiresUtilizationRecorded: it.requiresUtilizationRecorded,
        chargedType: it.chargedType,
        equipmentStatus: it.equipmentStatus,
        startDate: it.startDate ?? null,
        endDate: it.endDate ?? null,
      });
    });

  (postEquipment ?? []).forEach((it) => {
    const rawId = departmentEquipmentIdFromRow(it);
    const deptId = normalizeDeptId(rawId);
    if (!deptId) return;
    const prev = byDeptId.get(deptId);
    byDeptId.set(deptId, {
      ...prev,
      ...it,
      departmentEquipmentID: rawId,
      chargedType: it.chargedType ?? prev?.chargedType,
      equipmentQuantity:
        it.equipmentQuantity != null && it.equipmentQuantity > 0
          ? it.equipmentQuantity
          : (prev?.equipmentQuantity ?? it.equipmentQuantity),
      startDate: it.startDate ?? prev?.startDate ?? null,
      endDate: it.endDate ?? prev?.endDate ?? null,
    });
  });

  return Array.from(byDeptId.values());
}
