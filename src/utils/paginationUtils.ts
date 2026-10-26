export interface PaginationParams {
    offset?: number;
    limit?: number;
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortDirection?: string;
    /**
     * When set, sent as `isActive=true|false` for APIs that support `[FromQuery] bool? isActive`.
     * Omit (undefined) to return both active and inactive.
     */
    isActive?: boolean;
}

/** Nested `pageParam` object for POST request bodies. */
export interface PageParamBody {
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
}

/**
 * Builds nested `pageParam` for POST bodies (e.g. notification-data, requester-with-requests).
 */
export const buildPageParamBody = (pagination?: PaginationParams): PageParamBody | undefined => {
    if (!pagination) return undefined;
    const body: PageParamBody = {};
    if (typeof pagination.page === 'number') body.page = pagination.page;
    if (typeof pagination.pageSize === 'number') body.pageSize = pagination.pageSize;
    const sortBy = pagination.sortBy?.trim();
    if (sortBy) body.sortBy = sortBy;
    if (pagination.sortDirection === 'asc' || pagination.sortDirection === 'desc') {
        body.sortDirection = pagination.sortDirection;
    }
    return Object.keys(body).length > 0 ? body : undefined;
};

/**
 * Builds URLSearchParams from a pagination object.
 * Checks for undefined/null to ensure only valid params are appended.
 */
export const buildPaginationQueryParams = (pagination?: PaginationParams): URLSearchParams => {
    const queryParams = new URLSearchParams();
    if (pagination) {
        if (pagination.offset !== undefined) queryParams.append('offset', pagination.offset.toString());
        if (pagination.limit !== undefined) queryParams.append('limit', pagination.limit.toString());
        if (pagination.page !== undefined) queryParams.append('page', pagination.page.toString());
        if (pagination.pageSize !== undefined) queryParams.append('pageSize', pagination.pageSize.toString());
        if (pagination.sortBy) queryParams.append('sortBy', pagination.sortBy);
        if (pagination.sortDirection) queryParams.append('sortDirection', pagination.sortDirection);
        if (pagination.isActive !== undefined) {
            queryParams.append('isActive', pagination.isActive ? 'true' : 'false');
        }
    }
    return queryParams;
};
