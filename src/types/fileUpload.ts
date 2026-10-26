/**
 * Saved file upload record returned by the upload API.
 * Backend stores: name of file, type of file, requestID, fileUploadedId.
 */
export interface FileUploadDto {
  /** Original file name */
  fileName: string;
  /** File type / extension (e.g. pdf, xlsx, txt) */
  typeOfFile: string;
  /** Request this file is attached to */
  requestID: string;
  /** Server-generated id for the uploaded file record */
  fileUploadedId: string;
  /** File size in bytes (optional; when provided by API, shown below filename) */
  fileSize?: number | null;
}
