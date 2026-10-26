import type { ClosedPostPositionEquipmentDetail } from '@/types/closedPostPositionEquipment';
import type { InvoiceDetailDto } from '@/types/invoice';

/**
 * Closed-post close/split entity returned as `editPayload` on 409 when an invoiced job edit
 * would change the invoice total (same shape as close API payload / ClosedPostPosition).
 */
export interface InvoiceConflictEditPayload {
  postPositionID?: string;
  PostPositionID?: string;
  closedPostPositionID?: string;
  ClosedPostPositionID?: string;
  parentClosedPostPositionID?: string;
  ParentClosedPostPositionID?: string;
  postID?: string;
  PostID?: string;
  hoursWorked?: number;
  HoursWorked?: number;
  workStartDate?: string | null;
  workStartTime?: string | null;
  workEndTime?: string | null;
  WorkEndTime?: string | null;
  equipmentDetails?: ClosedPostPositionEquipmentDetail[];
  EquipmentDetails?: ClosedPostPositionEquipmentDetail[];
  isMinimumDue?: boolean;
  minimumHoursDue?: number | null;
  payRate?: number | null;
  PayRate?: number | null;
  reimbursePayRate?: number | null;
  ReimbursePayRate?: number | null;
  totalVehicleFee?: number | null;
  TotalVehicleFee?: number | null;
  totalEquipmentFee?: number | null;
  TotalEquipmentFee?: number | null;
}

export type ConflictInvoiceLineEdits = {
  rate: string;
  hours: string;
  vehicleFeeAmount: string;
  equipmentFeeAmount: string;
};

const formatNumericInput = (value?: number | null): string => {
  if (value === null || value === undefined) return '';
  return String(value);
};

const readPayloadAmount = (
  payload: InvoiceConflictEditPayload,
  keys: readonly string[]
): number | null => {
  const raw = payload as Record<string, unknown>;
  for (const key of keys) {
    const value = raw[key];
    if (value != null && value !== '' && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return null;
};

export const readInvoiceLineFeeAmount = (
  line: InvoiceDetailDto,
  camelKey: 'vehicleFeeAmount' | 'equipmentFeeAmount',
  pascalKey: 'VehicleFeeAmount' | 'EquipmentFeeAmount'
): number | null => {
  const raw = line as Record<string, unknown>;
  const value = raw[camelKey] ?? raw[pascalKey];
  if (value != null && value !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
};

const payloadNumber = (
  payload: InvoiceConflictEditPayload,
  camelKey: string,
  pascalKey: string
): number | null => {
  const raw = payload as Record<string, unknown>;
  for (const key of [camelKey, pascalKey]) {
    const value = raw[key];
    if (value != null && value !== '' && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return null;
};

/** Maps closed-post `editPayload` (minutes-based hours) onto invoice modify line fields. */
export const buildConflictInvoiceLineEdits = (
  line: InvoiceDetailDto,
  editPayload: InvoiceConflictEditPayload
): ConflictInvoiceLineEdits => {
  const hoursWorkedMinutes = payloadNumber(editPayload, 'hoursWorked', 'HoursWorked');
  const hours =
    hoursWorkedMinutes != null
      ? String(hoursWorkedMinutes / 60)
      : formatNumericInput(line.hours);

  const payRate = payloadNumber(editPayload, 'payRate', 'PayRate');
  const rate = payRate != null ? String(payRate) : formatNumericInput(line.rate);

  const totalVehicleFee = readPayloadAmount(editPayload, [
    'totalVehicleFee',
    'TotalVehicleFee',
    'vehicleFeeAmount',
    'VehicleFeeAmount',
  ]);
  const totalEquipmentFee = readPayloadAmount(editPayload, [
    'totalEquipmentFee',
    'TotalEquipmentFee',
    'equipmentFeeAmount',
    'EquipmentFeeAmount',
  ]);

  return {
    rate,
    hours,
    vehicleFeeAmount:
      totalVehicleFee != null
        ? String(totalVehicleFee)
        : formatNumericInput(readInvoiceLineFeeAmount(line, 'vehicleFeeAmount', 'VehicleFeeAmount')),
    equipmentFeeAmount:
      totalEquipmentFee != null
        ? String(totalEquipmentFee)
        : formatNumericInput(readInvoiceLineFeeAmount(line, 'equipmentFeeAmount', 'EquipmentFeeAmount')),
  };
};

export const getConflictClosedPostPositionIds = (
  closedPostPositionId?: string,
  editPayload?: InvoiceConflictEditPayload
): string[] => {
  const ids = new Set<string>();
  const add = (value?: string | null) => {
    const trimmed = String(value ?? '').trim();
    if (trimmed) ids.add(trimmed);
  };

  add(closedPostPositionId);
  if (editPayload) {
    const raw = editPayload as Record<string, unknown>;
    add(editPayload.parentClosedPostPositionID);
    add(raw.ParentClosedPostPositionID as string | undefined);
    add(editPayload.closedPostPositionID);
    add(raw.ClosedPostPositionID as string | undefined);
  }

  return Array.from(ids);
};
