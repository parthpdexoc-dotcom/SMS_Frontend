/**
 * Request File API Service
 * Uploads files for a request and saves them (fileName, typeOfFile, requestID, fileUploadedId).
 */

import { apiRequest } from '@/utils/apiClient';
import { readResponseOk, parseJsonTextArray } from '@/services/textPlainJson';
import type { FileUploadDto } from '@/types/fileUpload';

/**
 * Upload files for a request. Files are sent as multipart/form-data.
 * Backend saves each file with: fileName, typeOfFile, requestID, fileUploadedId.
 *
 * @param requesterID - Requester ID (guid)
 * @param requestID - The request to attach files to
 * @param files - Files to upload
 * @returns Saved records with fileName, typeOfFile, requestID, fileUploadedId
 */
export const uploadFiles = async (
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
