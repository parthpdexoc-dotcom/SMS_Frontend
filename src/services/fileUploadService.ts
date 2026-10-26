/**
 * File Upload API Service
 * Uploads files for a request and gets/downloads them (fileName, typeOfFile, requestID, fileUploadedId).
 */

import { apiRequest, apiDelete } from '@/utils/apiClient';
import { readResponseOk, parseJsonTextArray, parseJsonText } from '@/services/textPlainJson';
import type { FileUploadDto } from '@/types/fileUpload';
import { coalesceKeyedRequest } from '@/utils/coalesceKeyedRequest';

/**
 * Get files attached to a request.
 * GET UploadFile/Get/{requesterId}/{requestId}?fileId= (omit fileId for list).
 *
 * @param requesterID - Requester ID (guid)
 * @param requestID - The request ID (guid)
 * @param fileId - Optional. Omit for list; set for single file stream.
 * @returns List of file metadata when fileId omitted
 */
export const getFilesOrFile = async (
  requesterID: string,
  requestID: string,
  fileId?: string
): Promise<FileUploadDto[]> => {
  const query = fileId != null ? `?fileId=${encodeURIComponent(fileId)}` : '';
  const endpoint = `/UploadFile/Get/${encodeURIComponent(requesterID)}/${encodeURIComponent(requestID)}${query}`;
  const response = await apiRequest(endpoint, { method: 'GET' });
  const text = await readResponseOk(response, 'Failed to get request files');
  const parsed = parseJsonText<FileUploadDto[] | FileUploadDto>(text);
  return Array.isArray(parsed) ? parsed : [parsed];
};

/**
 * Get a request file as a blob URL for preview. Caller must revoke the URL when done.
 * Same GET API as download; returns object URL instead of triggering download.
 */
export const getRequestFileBlobUrl = async (
  requesterID: string,
  requestID: string,
  fileId: string
): Promise<string> => {
  const endpoint = `/UploadFile/Get/${encodeURIComponent(requesterID)}/${encodeURIComponent(requestID)}?fileId=${encodeURIComponent(fileId)}`;
  const response = await apiRequest(endpoint, {
    method: 'GET',
    headers: { Accept: '*/*' },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Failed to load file');
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
};

/**
 * Download a single request file by requestID and fileId (same GET API with fileId query).
 * Triggers browser download with the given fileName.
 */
export const downloadRequestFile = async (
  requesterID: string,
  requestID: string,
  fileId: string,
  fileName: string
): Promise<void> => {
  const url = await getRequestFileBlobUrl(requesterID, requestID, fileId);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || 'download';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Delete a request file.
 * DELETE UploadFile/{requesterId}/{requestId}/{fileId}
 * Returns 204 No Content on success, 404 when not found.
 */
export const deleteRequestFile = async (
  requesterID: string,
  requestID: string,
  fileId: string
): Promise<void> => {
  const endpoint = `/UploadFile/${encodeURIComponent(requesterID)}/${encodeURIComponent(requestID)}/${encodeURIComponent(fileId)}`;
  const response = await apiDelete(endpoint);
  const text = await response.text();
  if (response.status === 404) {
    throw new Error(text || 'File not found');
  }
  if (!response.ok) {
    throw new Error(text || `Failed to delete file (${response.status})`);
  }
};

/**
 * Upload files for a request. Form field "files". POST UploadFile/upload/{requesterId}/{requestId}.
 *
 * @param requesterID - Requester ID (guid)
 * @param requestID - The request to attach files to (guid)
 * @param files - Files to upload
 * @returns Saved records UploadFileDto[]
 */
export const fileUpload = async (
  requesterID: string,
  requestID: string,
  files: File[]
): Promise<FileUploadDto[]> => {
  if (files.length === 0) {
    return [];
  }
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });
  const endpoint = `/UploadFile/upload/${encodeURIComponent(requesterID)}/${encodeURIComponent(requestID)}`;
  const response = await apiRequest(endpoint, {
    method: 'POST',
    body: formData,
  });
  const text = await readResponseOk(response, 'Failed to upload files');
  return parseJsonTextArray<FileUploadDto>(text);
};

/**
 * Upload department logo. POST UploadFile/departmentLogo/{departmentId}/logo.
 * Form field "file" (single file). Returns { fileName }.
 */
export const uploadDepartmentLogo = async (
  departmentId: string,
  file: File
): Promise<{ fileName: string }> => {
  if (!file || file.size === 0) {
    throw new Error('No file provided. Use form field "file" for the logo image.');
  }
  const formData = new FormData();
  formData.append('file', file);
  const endpoint = `/UploadFile/departmentLogo/${encodeURIComponent(departmentId)}/logo`;
  const response = await apiRequest(endpoint, {
    method: 'POST',
    body: formData,
  });
  const text = await readResponseOk(response, 'Failed to upload department logo');
  return parseJsonText<{ fileName: string }>(text);
};

/**
 * Get department logo as a blob URL for preview.
 * GET UploadFile/departmentLogoGet/{departmentId}/logo. Returns image stream; 404 when no logo.
 * Caller must revoke the returned URL when done.
 */
export const getDepartmentLogoPreviewUrl = async (departmentId: string): Promise<string | null> => {
  const endpoint = `/UploadFile/departmentLogoGet/${encodeURIComponent(departmentId)}/logo`;
  const response = await apiRequest(endpoint, {
    method: 'GET',
    headers: { Accept: '*/*' },
  });
  if (!response.ok) return null;
  const blob = await response.blob();
  if (blob.size === 0) return null;
  return URL.createObjectURL(blob);
};

/**
 * Upload employee profile photo. POST UploadFile/employeePhoto/{employeeId}/photo.
 * Form field "file" (single file). Returns { fileName }.
 */
export const uploadEmployeePhoto = async (
  employeeId: string,
  file: File
): Promise<{ fileName: string }> => {
  if (!file || file.size === 0) {
    throw new Error('No file provided. Use form field "file" for the profile photo.');
  }
  const formData = new FormData();
  formData.append('file', file);
  const endpoint = `/UploadFile/employeePhoto/${encodeURIComponent(employeeId)}/photo`;
  const response = await apiRequest(endpoint, {
    method: 'POST',
    body: formData,
  });
  const text = await readResponseOk(response, 'Failed to upload profile photo');
  return parseJsonText<{ fileName: string }>(text);
};

export type GetEmployeePhotoPreviewOptions = {
  /** Appended as `_cb` so browsers/CDNs do not reuse a cached image after an upload. */
  cacheBust?: string | number;
};

/**
 * Get employee profile photo as a blob URL for preview.
 * GET UploadFile/employeePhotoGet/{employeeId}/photo. Returns image stream; 404 when no photo.
 * Caller must revoke the returned URL when done.
 */
export const getEmployeePhotoPreviewUrl = async (
  employeeId: string,
  options?: GetEmployeePhotoPreviewOptions
): Promise<string | null> => {
  const bust =
    options?.cacheBust !== undefined && options?.cacheBust !== null
      ? String(options.cacheBust)
      : '';
  const query = bust !== '' ? `?_cb=${encodeURIComponent(bust)}` : '';
  const key = `${employeeId}${query}`;
  return coalesceKeyedRequest('getEmployeePhotoPreviewUrl', key, async () => {
    const endpoint = `/UploadFile/employeePhotoGet/${encodeURIComponent(employeeId)}/photo${query}`;
    const response = await apiRequest(endpoint, {
      method: 'GET',
      headers: { Accept: '*/*' },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (blob.size === 0) return null;
    return URL.createObjectURL(blob);
  });
};
