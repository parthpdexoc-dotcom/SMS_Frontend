import type { CardEditDraft } from '@/components/smsmolecules/CardEditModal/CardEditModal';
import { apiGet, apiPost } from '@/utils/apiClient';
import { parseJsonText, readResponseOk, unwrapPagedList } from '@/services/textPlainJson';
import {
  PlaceholderStatus,
  type BulkPlaceholderStatusRequest,
  type PlaceholderBulkStatusResult,
  type PlaceholderDto,
  type PlaceholderListParams,
  type PlaceholderListResult,
  type PlaceholderSearchParams,
} from '@/types/placeholder';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';

const BASE_PATH = '/Placeholder';

function mapPlaceholderDto(o: Record<string, unknown>): PlaceholderDto {
  const id = String(
    o.placeholderId ??
      o.placeholderID ??
      o.PlaceholderId ??
      o.PlaceholderID ??
      o.id ??
      o.Id ??
      ''
  ).trim();
  const status = Number(o.placeholderStatus ?? o.PlaceholderStatus);
  return {
    placeholderId: id || null,
    firstName: String(o.firstName ?? o.FirstName ?? '').trim(),
    lastName: String(o.lastName ?? o.LastName ?? '').trim(),
    contactNumber: o.contactNumber == null && o.ContactNumber == null
      ? null
      : String(o.contactNumber ?? o.ContactNumber),
    employeeNumber: o.employeeNumber == null && o.EmployeeNumber == null
      ? null
      : String(o.employeeNumber ?? o.EmployeeNumber),
    placeholderStatus: Number.isInteger(status) ? status : PlaceholderStatus.Visible,
    isUniquePerPosition:
      o.isUniquePerPosition === true ||
      o.IsUniquePerPosition === true,
  };
}

function readPlaceholderList(text: string): PlaceholderListResult {
  const { data, totalRecords } = unwrapPagedList<Record<string, unknown>>(parseJsonText(text));
  return { items: data.map(mapPlaceholderDto), totalRecords };
}
/** Maps edit-modal values to placeholder upsert body (existing profile update). Department comes from auth token on the server. */
export function buildPlaceholderUpsertPayload(
  placeholderId: string,
  draft: Pick<
    CardEditDraft,
    'firstName' | 'lastName' | 'contactNumber' | 'employeeNumber' | 'isUniquePerPosition'
  >,
  options?: { placeholderStatus?: PlaceholderStatus | null }
): PlaceholderDto {
  const isUniquePerPosition = draft.isUniquePerPosition;
  const badgeDigits = isUniquePerPosition ? '' : draft.employeeNumber.replace(/\D/g, '');
  return {
    placeholderId,
    firstName: draft.firstName.trim(),
    lastName: draft.lastName.trim(),
    contactNumber: draft.contactNumber.trim() || null,
    isUniquePerPosition,
    // Unique-per-position never stores a badge; explicit null clears any prior value on update.
    ...(isUniquePerPosition
      ? { employeeNumber: null }
      : badgeDigits.length > 0
        ? { employeeNumber: badgeDigits }
        : {}),
    ...(options?.placeholderStatus !== undefined && options.placeholderStatus !== null
      ? { placeholderStatus: options.placeholderStatus }
      : {}),
  };
}

/** GET /Placeholder — `status` 0 hidden, 1 visible, 2 archived; omit = Visible+Hidden. */
export const getAllPlaceholders = async (
  params: PlaceholderListParams = {}
): Promise<PlaceholderListResult> => {
  const query = buildPaginationQueryParams({
    page: params.page,
    pageSize: params.pageSize,
  });
  if (params.status != null) query.set('status', String(params.status));
  const qs = query.toString();
  const response = await apiGet(qs ? `${BASE_PATH}?${qs}` : BASE_PATH);
  const text = await readResponseOk(response, 'Failed to load placeholders');
  return readPlaceholderList(text);
};
/** GET /Placeholder/search — `searchTerm` optional; `status` same as list. */
export const searchPlaceholders = async (params: PlaceholderSearchParams = {}): Promise<PlaceholderListResult> => {
  const query = new URLSearchParams();
  const searchTerm = params.searchTerm?.trim();
  if (searchTerm) query.set('searchTerm', searchTerm);
  if (params.status != null) query.set('status', String(params.status));
  const qs = query.toString();
  const response = await apiGet(qs ? `${BASE_PATH}/search?${qs}` : `${BASE_PATH}/search`);
  const text = await readResponseOk(response, 'Failed to search placeholders');
  return readPlaceholderList(text);
};

/** POST /Placeholder — create or update */
export const upsertPlaceholder = async (payload: PlaceholderDto): Promise<PlaceholderDto> => {
  const response = await apiPost(BASE_PATH, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  const text = await readResponseOk(response, 'Failed to save placeholder');
  const parsed = parseJsonText<Record<string, unknown>>(text);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return mapPlaceholderDto(parsed);
  }
  return parsed as unknown as PlaceholderDto;
};

/** POST /Placeholder/bulk-status — per-placeholder result messages. */
export const bulkUpdatePlaceholderStatus = async (
  request: BulkPlaceholderStatusRequest
): Promise<PlaceholderBulkStatusResult[]> => {
  const response = await apiPost(`${BASE_PATH}/bulk-status`, request, {
    headers: { 'Content-Type': 'application/json' },
  });
  const text = await readResponseOk(response, 'Failed to update placeholder visibility');
  if (!text.trim()) return [];
  const parsed = parseJsonText<Record<string, unknown>>(text);
  const data = parsed.data ?? parsed.Data;
  if (!Array.isArray(data)) return [];
  return data.map((row) => {
    const item = row as Record<string, unknown>;
    return {
      placeholderName: String(item.placeholderName ?? item.PlaceholderName ?? '').trim() || undefined,
      message: String(item.message ?? item.Message ?? '').trim(),
      hasError: item.hasError === true || item.HasError === true,
    };
  });
};
