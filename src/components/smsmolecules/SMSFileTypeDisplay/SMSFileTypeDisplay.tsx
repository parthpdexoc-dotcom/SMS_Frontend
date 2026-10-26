import type { SvgIconComponent } from '@mui/icons-material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DescriptionIcon from '@mui/icons-material/Description';
import TableChartIcon from '@mui/icons-material/TableChart';
import ImageIcon from '@mui/icons-material/Image';
import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';

import { AVAILABLE_POST } from '@/constants/strings';
import { resolveFileCategory, type FileCategory } from '@/utils/fileTypeResolution';

export type SMSFileTypeStyle = {
  icon: SvgIconComponent;
  label: string;
  /** Same as CSS modifier / category key */
  typeKey: FileCategory;
};

const STYLE_BY_CATEGORY: Record<FileCategory, { icon: SvgIconComponent; label: string }> = {
  pdf: { icon: PictureAsPdfIcon, label: AVAILABLE_POST.DETAILS.FILE_TYPES.PDF },
  doc: { icon: DescriptionIcon, label: AVAILABLE_POST.DETAILS.FILE_TYPES.DOC },
  xls: { icon: TableChartIcon, label: AVAILABLE_POST.DETAILS.FILE_TYPES.XLS },
  image: { icon: ImageIcon, label: AVAILABLE_POST.DETAILS.FILE_TYPES.IMAGE },
  txt: { icon: TextSnippetIcon, label: AVAILABLE_POST.DETAILS.FILE_TYPES.TXT },
  file: { icon: InsertDriveFileIcon, label: AVAILABLE_POST.DETAILS.FILE_TYPES.FILE },
};

/**
 * MUI icon + localized label for an uploaded file (Available Post details, etc.).
 */
export function getSMSFileTypeStyle(
  typeOfFile: string | null | undefined,
  fileName?: string | null
): SMSFileTypeStyle {
  const cat = resolveFileCategory(typeOfFile, fileName);
  const row = STYLE_BY_CATEGORY[cat];
  return { icon: row.icon, label: row.label, typeKey: cat };
}
