/**
 * RequestEquipment API Service
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

function pickChargedType(row: Record<string, unknown>): number | undefined {
  const keys = ['chargedType', 'ChargedType', 'chargeType', 'ChargeType'];
  if (!keys.some((k) => k in row && row[k] != null && String(row[k]).trim() !== '')) {
    return undefined;
  }
  return pickNumber(row, ...keys);
}

/** Normalize API row (RequestEquipmentWithNameDto) to frontend shape. */
export function normalizeRequestEquipmentRow(row: unknown): RequestEquipmentDto {
  const r = (row ?? {}) as Record<string, unknown>;
  const equipmentName = pickString(r, 'equipmentName', 'EquipmentName');
  const hasPerPostField = ['equipmentPerPost', 'EquipmentPerPost', 'equipment_Per_Post', 'Equipment_Per_Post'].some(
    (k) => typeof r[k] === 'boolean'
  );
  /** true = Per Job; false = Per Job Position */
  const perPost = hasPerPostField
    ? pickBool(r, 'equipmentPerPost', 'EquipmentPerPost', 'equipment_Per_Post', 'Equipment_Per_Post')
    : pickBool(
        r,
        'equipmentPerRequest',
        'EquipmentPerRequest',
        'equipment_Per_Request',
        'Equipment_Per_Request'
      );
  const qty = pickNumber(
    r,
    'equipmentQuantity',
    'EquipmentQuantity',
    'equipment_Quantity',
    'Equipment_Quantity'
  );
  return {
    requestEquipmentID: pickString(
      r,
      'requestEquipmentID',
      'RequestEquipmentID',
      'requestEquipmentId'
    ),
    requestID: pickString(r, 'requestID', 'RequestID', 'requestId'),
    departmentEquipmentID: pickString(
      r,
      'departmentEquipmentID',
      'DepartmentEquipmentID',
      'departmentEquipmentId'
    ),
    equipmentPerPost: perPost,
    equipmentQuantity: qty || 0,
    isVehicle: pickBool(r, 'isVehicle', 'IsVehicle'),
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
    chargedType: pickChargedType(r),
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

export interface RequestEquipmentDto {
  requestEquipmentID?: string | null;
  requestID?: string | null;
  departmentEquipmentID?: string | null;
  equipmentPerPost: boolean;
  equipmentQuantity: number;
  isVehicle: boolean;
  /** Display name from GET by-request (RequestEquipmentWithNameDto.EquipmentName). */
  equipmentName?: string | null;
  equipmentTypeName?: string | null;
  charge?: number | null;
  mileageCharge?: number | null;
  chargeMileage?: boolean | null;
  requiresApproval?: boolean | null;
  requiresUtilizationRecorded?: boolean | null;
  /** From view-details; used by Close Form without a separate DepartmentEquipment call. */
  chargedType?: number;
  equipmentStatus?: boolean;
  /** Effective date range (YYYY-MM-DD). */
  startDate?: string | null;
  endDate?: string | null;
}

export const getRequestEquipment = async (requestID: string): Promise<RequestEquipmentDto[]> => {
    try {
        const allItems: RequestEquipmentDto[] = [];
        let page = 1;
        const pageSize = 100; // Use a reasonable chunk size
        let hasMore = true;

        while (hasMore) {
            const endpoint = `/RequestEquipment/by-request/${requestID}?page=${page}&pageSize=${pageSize}`;
            
            const response = await apiGet(endpoint, {
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            const responseText = await expectOkReadText(response, 'Failed to fetch request equipment');
            const parsed = parseJsonText<unknown[] | { data?: unknown[]; items?: unknown[] }>(responseText);
            const rawItems: unknown[] = Array.isArray(parsed)
                ? parsed
                : (parsed?.data ?? parsed?.items ?? []);
            const items = rawItems.map(normalizeRequestEquipmentRow);

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
        console.error('Error fetching request equipment:', error);
        // Returning empty array might be safer to prevent UI crashes.
        return [];
    }
};

export const upsertRequestEquipment = async (
    data: RequestEquipmentDto
): Promise<RequestEquipmentDto> => {
    try {
        const response = await apiPost('/RequestEquipment', data, {
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const responseText = await expectOkReadText(response, 'Failed to save request equipment');
        return parseJsonText<RequestEquipmentDto>(responseText);
    } catch (error) {
        console.error('Error saving request equipment:', error);
        throw error;
    }
};

export const deleteRequestEquipment = async (
    requestEquipmentID: string
): Promise<void> => {
    try {
        await apiDelete(`/RequestEquipment/${requestEquipmentID}`);
    } catch (error) {
        console.error('Error deleting request equipment:', error);
        throw error;
    }
};
