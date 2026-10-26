/**
 * Single source of truth for file extension → category / type key.
 * Used by MUI attachment icons, Material badge tiles, and upload flows.
 */

function normalizeExtensionToken(raw: string): string | null {
  const t = raw.trim().toLowerCase().replace(/^\./, '');
  if (!t || !/^[a-z0-9]+$/.test(t) || t.length > 8) return null;
  return t === 'jpeg' ? 'jpg' : t;
}

/**
 * Last path segment after `.` only if it looks like a real extension (not "invioce (1)" with no dot).
 */
export function getTypeKeyFromFileName(fileName: string): string {
  if (!fileName || !fileName.includes('.')) return '';
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  const key = normalizeExtensionToken(ext);
  if (!key) return '';
  const base = fileName.slice(0, Math.max(0, fileName.length - ext.length - 1));
  if (!base) return '';
  return key;
}

/**
 * Prefer API `typeOfFile` (pdf, xlsx, …) when the UI name omits the extension.
 */
export function getTypeKeyFromFileUpload(fileName: string, typeOfFile?: string | null): string {
  const fromApi = typeOfFile != null && typeOfFile !== '' ? normalizeExtensionToken(String(typeOfFile)) : null;
  if (fromApi) return fromApi;
  return getTypeKeyFromFileName(fileName);
}

/**
 * Canonical buckets aligned with {@link AVAILABLE_POST.DETAILS.FILE_TYPES} and MUI icon rows.
 */
export type FileCategory = 'pdf' | 'doc' | 'xls' | 'image' | 'txt' | 'file';

/**
 * Maps normalized extension + API type to a display category (icons, badges, labels).
 */
export function resolveFileCategory(
  typeOfFile: string | null | undefined,
  fileName?: string | null
): FileCategory {
  const ext = getTypeKeyFromFileUpload(fileName ?? '', typeOfFile);
  if (!ext) return 'file';
  if (ext === 'pdf') return 'pdf';
  if (['doc', 'docx'].includes(ext)) return 'doc';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'xls';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image';
  if (ext === 'txt') return 'txt';
  return 'file';
}
