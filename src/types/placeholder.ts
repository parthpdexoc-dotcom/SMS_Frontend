/** Mirrors backend `PlaceholderStatus`. */
export enum PlaceholderStatus {
  Hidden = 0,
  Visible = 1,
  Archived = 2,
}

/** Mirrors backend `PlaceholderDto`. Department is resolved from the auth token on the server — do not send it. */
export interface PlaceholderDto {
  placeholderId?: string | null;
  firstName: string;
  lastName: string;
  contactNumber?: string | null;
  employeeNumber?: string | null;
  placeholderStatus?: PlaceholderStatus | null;
  isUniquePerPosition: boolean;
}

/** One row from POST /Placeholder/bulk-status `data`. */
export interface PlaceholderBulkStatusResult {
  placeholderName?: string;
  message: string;
  hasError: boolean;
}

/** Mirrors backend `BulkPlaceholderStatusRequestDto` — POST /Placeholder/bulk-status. */
export interface BulkPlaceholderStatusRequest {
  /** placeholderId → desired `PlaceholderStatus` (0 hidden, 1 visible, 2 archived). */
  placeholders: Record<string, PlaceholderStatus>;
}

/** GET /Placeholder and /Placeholder/search — `data` plus `totalRecords`. */
export interface PlaceholderListResult {
  items: PlaceholderDto[];
  totalRecords: number;
}

/** GET /Placeholder — optional status + PageParam paging. */
export interface PlaceholderListParams {
  status?: PlaceholderStatus | null;
  page?: number;
  pageSize?: number;
}

export interface PlaceholderSearchParams {
  searchTerm?: string;
  status?: PlaceholderStatus | null;
}
