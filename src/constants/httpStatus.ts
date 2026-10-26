/**
 * HTTP response status codes used for API response handling.
 */
export enum HttpStatus {
  /** Authentication required or token invalid/expired */
  UNAUTHORIZED = 401,
  /** Authenticated but not allowed to access the resource */
  FORBIDDEN = 403,
  /** Resource not found */
  NOT_FOUND = 404,
}
