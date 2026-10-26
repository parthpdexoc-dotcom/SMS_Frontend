/**
 * Material Symbols names + badge tile styles for attachments.
 * Category resolution: {@link resolveFileCategory} in `./fileTypeResolution`.
 */

import { resolveFileCategory, type FileCategory } from '@/utils/fileTypeResolution';

export {
  getTypeKeyFromFileName,
  getTypeKeyFromFileUpload,
  resolveFileCategory,
  type FileCategory,
} from '@/utils/fileTypeResolution';

function materialSymbolForCategory(fileCategory: FileCategory): string {
  switch (fileCategory) {
    case 'pdf':
      return 'picture_as_pdf';
    case 'doc':
      return 'description';
    case 'xls':
      return 'table_chart';
    case 'image':
      return 'image';
    case 'txt':
      return 'text_snippet';
    default:
      return 'insert_drive_file';
  }
}

/**
 * Icon name for {@link Icon} / {@link SMSIcon} from a normalized extension key (e.g. from upload UI).
 */
export function getAttachmentIconNameFromTypeKey(typeKey: string): string {
  return materialSymbolForCategory(resolveFileCategory(typeKey, ''));
}

export function getAttachmentIconName(fileName: string, typeOfFile?: string | null): string {
  return materialSymbolForCategory(resolveFileCategory(typeOfFile, fileName));
}

export interface FileTypeBadgeStyle {
  label: string;
  outerBg: string;
  textOnPage: string;
}

/**
 * Stone Public Safety brand-inspired file badges (logo palette: navy, gold, red, royal blue).
 * - Navy: #001F3F / #0A1A2B
 * - Gold: #B8860B / #C5A059
 * - Red: #B22222
 * - Royal blue: #1E4976
 */
const BADGE_BY_CATEGORY: Record<FileCategory, FileTypeBadgeStyle> = {
  pdf: { label: 'PDF', outerBg: '#B22222', textOnPage: '#B22222' },
  doc: { label: 'DOC', outerBg: '#1E4976', textOnPage: '#1E4976' },
  /** Gold frame; darker gold text on white for contrast */
  xls: { label: 'XLS', outerBg: '#B8860B', textOnPage: '#6B5300' },
  image: { label: 'IMG', outerBg: '#001F3F', textOnPage: '#001F3F' },
  txt: { label: 'TXT', outerBg: '#0A1A2B', textOnPage: '#0A1A2B' },
  /** Gold + navy (logo braid + shield) for generic files */
  file: { label: 'FILE', outerBg: '#B8860B', textOnPage: '#001F3F' },
};

export function getFileTypeBadgeStyleForCategory(fileCategory: FileCategory): FileTypeBadgeStyle {
  return BADGE_BY_CATEGORY[fileCategory];
}

/** @param typeKey — normalized extension (from API or filename); maps via {@link resolveFileCategory} */
export function getFileTypeBadgeStyle(typeKey: string): FileTypeBadgeStyle {
  return getFileTypeBadgeStyleForCategory(resolveFileCategory(typeKey, ''));
}

export function getFileTypeBadgeStyleFromUpload(fileName: string, typeOfFile?: string | null): FileTypeBadgeStyle {
  return getFileTypeBadgeStyleForCategory(resolveFileCategory(typeOfFile, fileName));
}
