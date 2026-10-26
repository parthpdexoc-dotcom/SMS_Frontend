/**
 * Department Invoice Configuration API Service
 * One record per department. GET all for binding; POST to create/update.
 */

import { apiGet, apiPost } from '@/utils/apiClient';
import type {
  DepartmentInvoiceConfigRequest,
  DepartmentInvoiceConfigResponse,
} from '@/types/departmentInvoiceConfig';
import { expectOkReadText, parseJsonText, parseJsonTextArray, readResponseOk } from '@/services/textPlainJson';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';

const BASE = '/DepartmentInvoiceConfig';

/** GET all – returns all department invoice configs (for binding by department). */
export async function getDepartmentInvoiceConfigs(): Promise<DepartmentInvoiceConfigResponse[]> {
  const queryParams = buildPaginationQueryParams({ page: 1, pageSize: 500 });
  const response = await apiGet(`${BASE}?${queryParams.toString()}`);
  const text = await expectOkReadText(response, 'Failed to fetch invoice configurations');
  return parseJsonTextArray<DepartmentInvoiceConfigResponse>(text);
}

/** Get config for one department: uses get all and finds match by departmentID. */
export async function getDepartmentInvoiceConfigByDepartmentId(
  departmentId: string
): Promise<DepartmentInvoiceConfigResponse | null> {
  const all = await getDepartmentInvoiceConfigs();
  const match = all.find((item) => {
    const deptId = item.departmentID ?? (item as Record<string, unknown>).DepartmentID;
    return String(deptId ?? '') === departmentId;
  });
  return match ?? null;
}

/** POST to create or update (backend may use invoiceConfigID to determine update) */
export async function saveDepartmentInvoiceConfig(
  data: DepartmentInvoiceConfigRequest
): Promise<DepartmentInvoiceConfigResponse> {
  const response = await apiPost(BASE, data, {
    headers: { 'Content-Type': 'application/json' },
  });
  const responseText = await readResponseOk(response, 'Failed to save department invoice configuration');
  return parseJsonText<DepartmentInvoiceConfigResponse>(responseText);
}
