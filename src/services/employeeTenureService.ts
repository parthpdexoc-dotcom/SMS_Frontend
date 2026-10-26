/**
 * Employee tenure API (rank / tenure history per employee).
 */

import { apiGet } from '@/utils/apiClient';
import { expectOkReadText, parseJsonText } from '@/services/textPlainJson';
import type { EmployeeTenurePagedResponse, EmployeeTenureResponse } from '@/types/employeeTenure';

const BASE = '/EmployeeTenure';

function pickStr(raw: Record<string, unknown>, camel: string, pascal: string): string | null {
  const v = raw[camel] ?? raw[pascal];
  if (v === null || v === undefined || v === '') return null;
  return String(v);
}

function pickNum(raw: Record<string, unknown>, camel: string, pascal: string): number | null {
  const v = raw[camel] ?? raw[pascal];
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v));
  return Number.isFinite(n) ? n : null;
}

function pickBool(raw: Record<string, unknown>, camel: string, pascal: string): boolean | null {
  const v = raw[camel] ?? raw[pascal];
  if (v === null || v === undefined) return null;
  return Boolean(v);
}

export function normalizeEmployeeTenure(raw: Record<string, unknown>): EmployeeTenureResponse {
  const dateOfHire = pickStr(raw, 'dateOfHire', 'DateOfHire');
  const dateOfPromotion = pickStr(raw, 'dateOfPromotion', 'DateOfPromotion');
  const effectiveDate =
    pickStr(raw, 'effectiveDate', 'EffectiveDate') ??
    dateOfPromotion ??
    dateOfHire ??
    pickStr(raw, 'startDate', 'StartDate') ??
    pickStr(raw, 'tenureStartDate', 'TenureStartDate');

  return {
    employeeTenureID: pickStr(raw, 'employeeTenureID', 'EmployeeTenureID') ?? '',
    departmentID: pickStr(raw, 'departmentID', 'DepartmentID'),
    employeeID: pickStr(raw, 'employeeID', 'EmployeeID') ?? '',
    employeeTypeID: pickStr(raw, 'employeeTypeID', 'EmployeeTypeID'),
    employeeTypeShort:
      pickStr(raw, 'employeeTypeShort', 'EmployeeTypeShort') ??
      pickStr(raw, 'employeeType', 'EmployeeType'),
    dateOfHire,
    dateOfPromotion,
    isCurrent: pickBool(raw, 'isCurrent', 'IsCurrent'),
    rank: pickNum(raw, 'rank', 'Rank'),
    effectiveDate,
    endDate:
      pickStr(raw, 'endDate', 'EndDate') ??
      pickStr(raw, 'tenureEndDate', 'TenureEndDate'),
    createdDate: pickStr(raw, 'createdDate', 'CreatedDate'),
    createdUserID: pickStr(raw, 'createdUserID', 'CreatedUserID'),
    createdBy: pickStr(raw, 'createdBy', 'CreatedBy'),
    editedDate: pickStr(raw, 'editedDate', 'EditedDate'),
    editedUserID: pickStr(raw, 'editedUserID', 'EditedUserID'),
    editedBy: pickStr(raw, 'editedBy', 'EditedBy'),
  };
}

/**
 * GET .../EmployeeTenure/by-employee/{employeeId}
 */
export const getEmployeeTenuresByEmployeeId = async (
  employeeId: string
): Promise<EmployeeTenureResponse[]> => {
  const response = await apiGet(`${BASE}/by-employee/${encodeURIComponent(employeeId)}`);
  const text = await expectOkReadText(response, 'Failed to fetch employee tenure history');
  const trimmed = text.trim();
  if (!trimmed) return [];

  const parsed = parseJsonText<unknown>(trimmed);
  if (parsed === null || parsed === undefined) return [];

  // Supports:
  // 1) direct array payload: [{...}]
  // 2) single object payload: {...}
  // 3) paged payload: { totalRecords, data: [{...}], ... }
  let source: unknown = parsed;
  if (typeof parsed === 'object' && !Array.isArray(parsed)) {
    const maybePaged = parsed as EmployeeTenurePagedResponse;
    if (Array.isArray(maybePaged.data)) {
      source = maybePaged.data;
    }
  }

  const rows: Record<string, unknown>[] = Array.isArray(source)
    ? source.filter((x): x is Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x))
    : typeof source === 'object' && !Array.isArray(source)
      ? [source as Record<string, unknown>]
      : [];

  return rows.map(normalizeEmployeeTenure);
};
