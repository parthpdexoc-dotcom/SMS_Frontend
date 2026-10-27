/**
 * Helpers for APIs that respond with `text/plain` containing JSON.
 * Many endpoints in this app return JSON payloads with a `text/plain` content-type.
 */

import { InvoiceRefundRequiredError } from '@/types/invoice';
import type { PagedResponse } from '@/types/common';
import type { PostInRequestListDto, RequestPostsResponseDto } from '@/types/request';
import type { InvoiceConflictEditPayload } from '@/types/invoiceConflict';

export async function expectOkReadText(response: Response, failPrefix: string): Promise<string> {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${failPrefix}: ${response.status} ${text}`);
  }
  return text;
}

export function parseJsonText<T>(text: string, invalidMessage = 'Invalid response format from server'): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(invalidMessage);
  }
}

export function parseJsonTextArray<T>(text: string): T[] {
  // Some endpoints return either a single object or an array. Normalize to array.
  const parsed = parseJsonText<unknown>(text);
  return (Array.isArray(parsed) ? parsed : [parsed]) as T[];
}

/** Reads the first non-null string-like value for any of the given JSON keys (camelCase / PascalCase). */
export function readJsonString(source: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = source[key];
    if (value == null) continue;
    return String(value);
  }
  return '';
}

/** Reads the first finite number for any of the given JSON keys (camelCase / PascalCase). */
export function readJsonNumber(source: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
}

/** Reads the first string array for any of the given JSON keys (camelCase / PascalCase). */
export function readJsonStringArray(source: Record<string, unknown>, ...keys: string[]): string[] {
  for (const key of keys) {
    const value = source[key];
    if (!Array.isArray(value)) continue;
    return value.map((item) => String(item));
  }
  return [];
}

/** Parses a JSON array (or single object) and maps each row through `mapRow`. */
export function parseJsonTextArrayMapped<T>(
  text: string,
  mapRow: (raw: Record<string, unknown>) => T,
  invalidMessage = 'Invalid response format from server'
): T[] {
  const parsed = parseJsonText<unknown>(text, invalidMessage);
  const rows = (Array.isArray(parsed) ? parsed : [parsed]) as Record<string, unknown>[];
  return rows.map((row) => mapRow(row && typeof row === 'object' ? row : {}));
}

/** Reads total count from paged API payloads (camelCase or PascalCase, number or numeric string). */
export function readPagedListTotal(source: Record<string, unknown>, fallback: number): number {
  const totalRaw =
    source.totalRecords ??
    source.TotalRecords ??
    source.totalPostPositionCount ??
    source.TotalPostPositionCount ??
    source.totalCount ??
    source.TotalCount ??
    source.recordCount ??
    source.RecordCount ??
    source.total ??
    source.Total;
  if (typeof totalRaw === 'number' && Number.isFinite(totalRaw)) return totalRaw;
  if (typeof totalRaw === 'string' && totalRaw.trim()) {
    const parsed = Number(totalRaw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

/** Reads list array from paged API payloads, including nested `{ data: { data, totalRecords } }`. */
export function readPagedListArray(source: Record<string, unknown>): unknown[] {
  const rawList =
    source.data ??
    source.Data ??
    source.postPositions ??
    source.PostPositions ??
    source.items ??
    source.Items ??
    source.records ??
    source.Records;
  if (Array.isArray(rawList)) return rawList;
  if (rawList && typeof rawList === 'object') {
    const nested = rawList as Record<string, unknown>;
    const inner =
      nested.data ??
      nested.Data ??
      nested.items ??
      nested.Items ??
      nested.postPositions ??
      nested.PostPositions;
    if (Array.isArray(inner)) return inner;
  }
  return [];
}

/**
 * Parses list endpoints that return either a JSON array or a paged object
 * ({ data, totalRecords } or PascalCase variants). Used for server-side grid pagination.
 */
/** Unwraps a nested list field that may be a plain array or `{ data, totalRecords }`. */
export function unwrapPagedList<T>(
  field:
    | T[]
    | {
      data?: T[] | null;
      Data?: T[] | null;
      totalRecords?: number;
      TotalRecords?: number;
    }
    | null
    | undefined
): { data: T[]; totalRecords: number } {
  if (!field) return { data: [], totalRecords: 0 };
  if (Array.isArray(field)) return { data: field, totalRecords: field.length };
  const record = field as Record<string, unknown>;
  const data = (record.data ?? record.Data ?? []) as T[];
  const list = Array.isArray(data) ? data : [];
  return { data: list, totalRecords: readPagedListTotal(record, list.length) };
}

/** Parses `PagedList`-shaped JSON without row mapping. */
export function parsePagedListDto<T>(
  text: string,
  invalidMessage = 'Invalid response format from server'
): PagedResponse<T> {
  const parsed = parseJsonText<unknown>(text, invalidMessage);
  if (Array.isArray(parsed)) {
    const data = parsed as T[];
    return { data, totalRecords: data.length };
  }
  const p = parsed as Record<string, unknown>;
  const list = readPagedListArray(p) as T[];
  const direct = p.data ?? p.Data;
  const data = Array.isArray(direct) ? (direct as T[]) : list;
  return { data, totalRecords: readPagedListTotal(p, data.length) };
}

/** Parses POST `/Post/request-posts` (`RequestPostsResponseDto`). */
export function parseRequestPostsResponseDto(text: string): RequestPostsResponseDto {
  const parsed = parseJsonText<Record<string, unknown>>(text);
  const postsRaw = parsed.posts ?? parsed.Posts ?? parsed.data ?? parsed.Data;
  const posts = Array.isArray(postsRaw) ? (postsRaw as PostInRequestListDto[]) : [];
  return {
    posts,
    totalPostCount: readJsonNumber(parsed, 'totalPostCount', 'TotalPostCount') || posts.length,
    totalPositionCount: readJsonNumber(parsed, 'totalPositionCount', 'TotalPositionCount'),
  };
}

export function parsePagedListJson<T>(
  text: string,
  mapRow: (raw: Record<string, unknown>) => T,
  invalidMessage = 'Invalid response format from server'
): { data: T[]; totalRecords: number } {
  const parsed = parseJsonText<unknown>(text, invalidMessage);
  if (Array.isArray(parsed)) {
    const data = parsed.map((row) => mapRow(row as Record<string, unknown>));
    return { data, totalRecords: data.length };
  }
  const p = parsed as Record<string, unknown>;
  const list = readPagedListArray(p);
  const data = list.map((row) => mapRow(row as Record<string, unknown>));
  const nestedData = p.data ?? p.Data;
  const totalSource =
    nestedData && typeof nestedData === 'object' && !Array.isArray(nestedData)
      ? (nestedData as Record<string, unknown>)
      : p;
  const totalRecords = readPagedListTotal(totalSource, readPagedListTotal(p, data.length));
  return { data, totalRecords };
}

export async function expectOk(response: Response, failPrefix: string): Promise<void> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${failPrefix}: ${response.status} ${text}`);
  }
}

type ApiErrorItem = {
  errorCode?: string;
  errorMessage?: string;
  fieldName?: string;
  ErrorCode?: string;
  ErrorMessage?: string;
  FieldName?: string;
};

function getApiErrorItemMessage(item: ApiErrorItem): string {
  const errorMessage = String(item?.errorMessage ?? item?.ErrorMessage ?? '').trim();
  if (errorMessage) return errorMessage;
  return String(item?.errorCode ?? item?.ErrorCode ?? '').trim();
}

/** Maps API `fieldName` (PascalCase) to camelCase form keys. */
export function getFieldErrorsFromResult(parsed: Record<string, unknown>): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  const errors = (parsed.errors ?? parsed.Errors) as ApiErrorItem[] | undefined;
  if (!Array.isArray(errors)) return fieldErrors;

  for (const item of errors) {
    const fieldName = String(item.fieldName ?? item.FieldName ?? '').trim();
    const message = getApiErrorItemMessage(item);
    if (!fieldName || !message) continue;
    const normalized = fieldName.charAt(0).toLowerCase() + fieldName.slice(1);
    fieldErrors[normalized] = message;
  }

  return fieldErrors;
}

export function getFieldErrorsFromErrorResponse(responseText: string): Record<string, string> {
  try {
    return getFieldErrorsFromResult(JSON.parse(responseText) as Record<string, unknown>);
  } catch {
    return {};
  }
}

export class ApiResponseError extends Error {
  fieldErrors: Record<string, string>;
  status?: number;

  constructor(message: string, fieldErrors: Record<string, string> = {}, status?: number) {
    super(message);
    this.name = 'ApiResponseError';
    this.fieldErrors = fieldErrors;
    this.status = status;
  }
}

/**
 * Extracts all human-readable messages from a SuccessResult-style error payload.
 */
export function getErrorMessagesFromResult(parsed: Record<string, unknown>): string[] {
  const errors = (parsed.errors ?? parsed.Errors) as ApiErrorItem[] | undefined;
  if (Array.isArray(errors) && errors.length > 0) {
    const messages = errors.map((item) => getApiErrorItemMessage(item)).filter(Boolean);
    if (messages.length > 0) return messages;
  }

  const message = String(parsed.message ?? parsed.Message ?? '').trim();
  if (message) {
    return message
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  }

  // Controllers such as PostPosition cancel return `{ error, postPositionId }`.
  const error = String(parsed.error ?? parsed.Error ?? '').trim();
  if (error) return [error];

  return [];
}

/** True when SuccessResult body indicates failure (even if HTTP status is 200). */
export function isSuccessResultFailure(parsed: Record<string, unknown>, httpOk: boolean): boolean {
  const isSuccess = parsed.isSuccessStatusCode ?? parsed.IsSuccessStatusCode;
  if (isSuccess === false) return true;

  const status = Number(parsed.status ?? parsed.Status ?? (httpOk ? 200 : 0));
  if (!Number.isNaN(status) && status >= 400) return true;

  return !httpOk;
}

/**
 * Parses API error response JSON and returns a user-friendly message.
 * Expects shapes like:
 * - { message?: string, errors?: Array<{ errorCode?: string, errorMessage?: string }> }
 * - { error?: string } (e.g. PostPosition cancel BadRequest)
 */
export function getErrorMessageFromErrorResponse(responseText: string, fallback: string): string {
  try {
    const data = JSON.parse(responseText) as Record<string, unknown>;
    const messages = getErrorMessagesFromResult(data);
    if (messages.length > 0) return messages.join('\n');
  } catch {
    const trimmed = String(responseText ?? '').trim();
    if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || /<title>\s*404/i.test(trimmed)) {
      return 'Server Error (404): The API endpoint was not found on the server. Please check the backend service path.';
    }
    if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
      return 'Server Error: An unexpected server response was received. Please contact your system administrator.';
    }
    if (trimmed) return trimmed;
  }
  return fallback;
}

/**
 * Reads response as text. If !response.ok, throws with a user-friendly message
 * (parsed from JSON when possible) instead of raw status + body.
 * Use this for endpoints where errors are shown in the UI (e.g. toasts).
 */
export async function readResponseOk(response: Response, fallback: string): Promise<string> {
  const text = await response.text();
  if (!response.ok) {
    throw new ApiResponseError(
      getErrorMessageFromErrorResponse(text, fallback),
      getFieldErrorsFromErrorResponse(text),
      response.status
    );
  }
  return text;
}

/** Copy fee fields from 409 root onto editPayload when backend sends them outside the nested object. */
const read409FeeField = (
  data: Record<string, unknown>,
  editPayload: Record<string, unknown>,
  camelKey: string,
  pascalKey: string
): Record<string, number> | Record<string, never> => {
  if (editPayload[camelKey] != null || editPayload[pascalKey] != null) {
    return {};
  }
  const value = data[camelKey] ?? data[pascalKey];
  if (value != null && value !== '' && Number.isFinite(Number(value))) {
    return { [camelKey]: Number(value) };
  }
  return {};
};

/** For invoice refund 409 responses only (unclose, modify invoice, etc.). */
export async function readResponseOkOrInvoiceRefund(
  response: Response,
  fallback: string
): Promise<string> {
  const text = await response.text();

  if (response.status === 409) {
    const data = JSON.parse(text) as {
      error?: string;
      message?: string;
      refundRequired?: number;
      invoiceId?: string;
      postPositionId?: string;
      closedPostPositionId?: string;
      ClosedPostPositionId?: string;
      editPayload?: InvoiceConflictEditPayload;
      EditPayload?: InvoiceConflictEditPayload;
    };
    if (typeof data.refundRequired === 'number') {
      const closedPostPositionId =
        data.closedPostPositionId ?? data.ClosedPostPositionId;
      const rawEditPayload = data.editPayload ?? data.EditPayload;
      const editPayload =
        rawEditPayload && typeof rawEditPayload === 'object'
          ? ({
            ...(rawEditPayload as InvoiceConflictEditPayload),
            ...(read409FeeField(data, rawEditPayload as Record<string, unknown>, 'totalVehicleFee', 'TotalVehicleFee')),
            ...(read409FeeField(data, rawEditPayload as Record<string, unknown>, 'totalEquipmentFee', 'TotalEquipmentFee')),
          } satisfies InvoiceConflictEditPayload)
          : undefined;
      throw new InvoiceRefundRequiredError({
        message: data.message?.trim() || data.error?.trim() || fallback,
        refundRequired: data.refundRequired,
        postPositionId: data.postPositionId != null ? String(data.postPositionId) : undefined,
        invoiceId: data.invoiceId != null ? String(data.invoiceId) : undefined,
        closedPostPositionId:
          closedPostPositionId != null ? String(closedPostPositionId) : undefined,
        editPayload,
      });
    }
  }

  if (!response.ok) {
    throw new ApiResponseError(
      getErrorMessageFromErrorResponse(text, fallback),
      getFieldErrorsFromErrorResponse(text)
    );
  }

  return text;
}

