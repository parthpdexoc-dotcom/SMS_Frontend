/**
 * PostEquipment API Service
 */

import { apiPost, apiGet, apiDelete } from '@/utils/apiClient';
import { expectOkReadText, parseJsonText } from '@/services/textPlainJson';
import { pickEquipmentEffectiveDate } from '@/utils/equipmentEffectiveDates';

function pickString(row: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const v = row[key];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return null;
}

function pickBool(row: Record<string, unknown>, ...keys: string[]): boolean {
  for (const key of keys) {
    const v = row[key];
    if (typeof v === 'boolean') return v;
  }
  return false;
}

function pickNumber(row: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const v = row[key];
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
    if (typeof v === 'string' && v.trim() !== '') {
      const n = Number(v);
      if (!Number.isNaN(n)) return n;
    }
  }
  return 0;
}

/** ViewDetailsEquipmentLine.ChargeType — API JSON camelCase `chargeType`. */
function pickViewDetailsChargeType(row: Record<string, unknown>): number | undefined {
  const value = row.chargeType;
  return typeof value === 'number' && !Number.isNaN(value) ? value : undefined;
}

/** Normalize API row (PostEquipmentWithNameDto) to frontend shape. */
export function normalizePostEquipmentRow(row: unknown): PostEquipmentDto {
  const r = (row ?? {}) as Record<string, unknown>;
  const equipmentName = pickString(r, 'equipmentName', 'EquipmentName');
  const perPostPosition = pickBool(r, 'equipmentPerPostPosition', 'EquipmentPerPostPosition');
  const perPost = pickBool(r, 'equipment_Per_Post', 'Equipment_Per_Post', 'equipmentPerPost', 'EquipmentPerPost');
  const qty = pickNumber(
    r,
    'equipmentQuantity',
    'EquipmentQuantity',
    'equipment_Quantity',
    'Equipment_Quantity'
  );
  const isVehicle = pickBool(r, 'isVehicle', 'IsVehicle');
  return {
    postEquipmentID: pickString(r, 'postEquipmentID', 'PostEquipmentID', 'postEquipmentId'),
    postID: pickString(r, 'postID', 'PostID', 'postId'),
    departmentEquipmentID: pickString(
      r,
      'departmentEquipmentID',
      'DepartmentEquipmentID',
      'departmentEquipmentId'
    ),
    equipmentPerPostPosition: perPostPosition || perPost,
    equipmentPerPost: perPost,
    equipmentQuantity: qty || 0,
    isVehicle,
    equipmentName,
    equipmentTypeName:
      equipmentName ?? pickString(r, 'equipmentTypeName', 'EquipmentTypeName'),
    charge: typeof r.charge === 'number' ? r.charge : typeof r.Charge === 'number' ? (r.Charge as number) : null,
    mileageCharge:
      typeof r.mileageCharge === 'number'
        ? r.mileageCharge
        : typeof r.MileageCharge === 'number'
          ? (r.MileageCharge as number)
          : null,
    chargeMileage: pickBool(r, 'chargeMileage', 'ChargeMileage'),
    requiresApproval:
      typeof r.requiresApproval === 'boolean'
        ? r.requiresApproval
        : typeof r.RequiresApproval === 'boolean'
          ? (r.RequiresApproval as boolean)
          : null,
    requiresUtilizationRecorded:
      typeof r.requiresUtilizationRecorded === 'boolean'
        ? r.requiresUtilizationRecorded
        : typeof r.RequiresUtilizationRecorded === 'boolean'
          ? (r.RequiresUtilizationRecorded as boolean)
          : null,
    chargedType: pickViewDetailsChargeType(r),
    equipmentStatus:
      typeof r.equipmentStatus === 'boolean'
        ? r.equipmentStatus
        : typeof r.EquipmentStatus === 'boolean'
          ? (r.EquipmentStatus as boolean)
          : undefined,
    startDate: pickEquipmentEffectiveDate(r, 'startDate', 'StartDate', 'effectiveStartDate', 'EffectiveStartDate'),
    endDate: pickEquipmentEffectiveDate(r, 'endDate', 'EndDate', 'effectiveEndDate', 'EffectiveEndDate'),
  };
}

export interface PostEquipmentDto {
  postEquipmentID?: string | null;
  postID?: string | null;
  departmentEquipmentID?: string | null;
  equipmentPerPostPosition: boolean;
  equipmentPerPost?: boolean;
  equipmentQuantity: number;
  isVehicle: boolean;
  /** Display name from GET by-post (PostEquipmentWithNameDto.EquipmentName). */
  equipmentName?: string | null;
  /** Display label from view-details lines when department catalog row is missing. */
  equipmentTypeName?: string | null;
  /** Populated from view-details / merged request+post payloads (no department catalog call). */
  charge?: number | null;
  mileageCharge?: number | null;
  chargeMileage?: boolean | null;
  requiresApproval?: boolean | null;
  requiresUtilizationRecorded?: boolean | null;
  /** ViewDetailsEquipmentLine.ChargeType (JSON: chargeType). */
  chargedType?: number;
  equipmentStatus?: boolean;
  /** Effective date range (YYYY-MM-DD). */
  startDate?: string | null;
  endDate?: string | null;
}

export const getPostEquipment = async (postID: string): Promise<PostEquipmentDto[]> => {
    try {
        const allItems: PostEquipmentDto[] = [];
        let page = 1;
        const pageSize = 100; // Use a reasonable chunk size
        let hasMore = true;

        while (hasMore) {
            const response = await apiGet(`/PostEquipment/by-post/${postID}?page=${page}&pageSize=${pageSize}`, {
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            const responseText = await expectOkReadText(response, 'Failed to fetch job equipment');
            // Check if response is array (list) or object (with .data or similar)
            // Based on previous code `parseJsonText<RequestEquipmentDto[]>(responseText)`, it's a direct array.
            const parsed = parseJsonText<unknown[] | { data?: unknown[]; items?: unknown[] }>(responseText);
            const rawItems: unknown[] = Array.isArray(parsed)
                ? parsed
                : (parsed?.data ?? parsed?.items ?? []);
            const items = rawItems.map(normalizePostEquipmentRow);

            if (items.length > 0) {
                allItems.push(...items);
                if (items.length < pageSize) {
                    hasMore = false; // Reached end
                } else {
                    page++; // Try next page
                }
            } else {
                hasMore = false;
            }
        }
        return allItems;
    } catch (error) {
        // It's possible there are no items, return empty array if 404 or similar, 
        // but typically backend should return empty list. 
        // If it throws, we might want to handle it or let it propagate.
        console.error('Error fetching post equipment:', error);
        // If we fetched some items but failed later, maybe return what we have? 
        // For now, consistent data provided so far is safer, or just empty array + log.
        // Returning empty array might be safer to prevent UI crashes.
        return [];
    }
};

export const upsertPostEquipment = async (
    data: PostEquipmentDto
): Promise<PostEquipmentDto> => {
    try {
        const response = await apiPost('/PostEquipment', data, {
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const responseText = await expectOkReadText(response, 'Failed to save job equipment');
        return parseJsonText<PostEquipmentDto>(responseText);
    } catch (error) {
        console.error('Error saving post equipment:', error);
        throw error;
    }
};

export const deletePostEquipment = async (id: string): Promise<boolean> => {
    try {
        await apiDelete(`/PostEquipment/${id}`);
        return true;
    } catch (error) {
        console.error('Error deleting post equipment:', error);
        return false;
    }
};
