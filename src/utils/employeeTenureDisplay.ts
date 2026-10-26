/**
 * Display helpers for employee tenure / rank history grid.
 */

import { formatDateShort } from '@/utils';
import type { EmployeeTypeResponse } from '@/types/employeeType';
import type { EmployeeTenureResponse } from '@/types/employeeTenure';

export function formatTenureDateDisplay(value: string | null | undefined): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return formatDateShort(d);
}

export function buildEmployeeTypeByIdMap(
  types: EmployeeTypeResponse[] | undefined
): Map<string, EmployeeTypeResponse> {
  const m = new Map<string, EmployeeTypeResponse>();
  for (const t of types || []) {
    m.set(String(t.employeeTypeID).toLowerCase(), t);
  }
  return m;
}

export function getTenureEmployeeTypeLabel(
  row: EmployeeTenureResponse,
  byId: Map<string, EmployeeTypeResponse>
): string {
  const id = row.employeeTypeID?.trim();
  const fromList = id ? byId.get(id.toLowerCase()) : undefined;
  return (
    fromList?.employeeTypeShort?.trim() ||
    row.employeeTypeShort?.trim() ||
    fromList?.employeeTypeLong?.trim() ||
    '-'
  );
}

export function getTenureRankDisplay(
  row: EmployeeTenureResponse,
  byId: Map<string, EmployeeTypeResponse>
): string {
  if (row.rank != null && Number.isFinite(Number(row.rank))) {
    return String(row.rank);
  }
  const id = row.employeeTypeID?.trim();
  const fromList = id ? byId.get(id.toLowerCase()) : undefined;
  if (fromList?.rank != null && Number.isFinite(Number(fromList.rank))) {
    return String(fromList.rank);
  }
  return '-';
}
