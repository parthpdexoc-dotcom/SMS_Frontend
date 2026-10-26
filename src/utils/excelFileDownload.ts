import { getErrorMessageFromErrorResponse } from '@/services/textPlainJson';

export function parseFilenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const star = /filename\*=(?:UTF-8''|utf-8'')([^;\s]+)/i.exec(header);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^["']|["']$/g, ''));
    } catch {
      return star[1].trim().replace(/^["']|["']$/g, '');
    }
  }
  const quoted = /filename="((?:[^"\\]|\\.)*)"/i.exec(header);
  if (quoted?.[1]) {
    return quoted[1].replace(/\\(.)/g, '$1');
  }
  const plain = /filename=([^;\s]+)/i.exec(header);
  if (plain?.[1]) {
    return plain[1].replace(/^["']|["']$/g, '');
  }
  return null;
}

export function resolveExcelFileName(
  contentDispositionHeader: string | null,
  defaultFileName: string
): string {
  let fileName = parseFilenameFromContentDisposition(contentDispositionHeader);
  if (!fileName || !/\.xlsx$/i.test(fileName)) {
    fileName = defaultFileName;
  }
  return fileName;
}

export function triggerBlobFileDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Download an Excel file from a successful API response (report / roster exports).
 * Expects `response.ok` to already be true.
 */
export async function downloadExcelFileFromResponse(
  response: Response,
  defaultFileName: string,
  invalidFileErrorMessage: string
): Promise<void> {
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  const blob = await response.blob();

  const looksLikeExcel =
    contentType.includes('spreadsheet') ||
    contentType.includes('ms-excel') ||
    contentType.includes('octet-stream') ||
    contentType.includes('zip');

  if (
    !looksLikeExcel &&
    (contentType.includes('json') || (contentType.includes('text/plain') && blob.size < 65536))
  ) {
    const text = await blob.text();
    throw new Error(getErrorMessageFromErrorResponse(text, invalidFileErrorMessage));
  }

  const fileName = resolveExcelFileName(response.headers.get('content-disposition'), defaultFileName);
  triggerBlobFileDownload(blob, fileName);
}
