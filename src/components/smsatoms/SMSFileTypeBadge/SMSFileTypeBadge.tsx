import { FC, memo, type CSSProperties } from 'react';
import Box from '@mui/material/Box';
import { getFileTypeBadgeStyleFromUpload } from '@/utils/fileAttachmentIcons';
import styles from './SMSFileTypeBadge.module.css';

export interface SMSFileTypeBadgeProps {
  fileName: string;
  /** Backend extension (e.g. pdf) when `fileName` has no extension — same as {@link FileUploadDto.typeOfFile} */
  typeOfFile?: string | null;
  /** Default matches compact attachment rows */
  size?: 'sm' | 'md';
}

/**
 * File-type tile (PDF / DOC / …): rounded colored frame, white “page”, bold type label.
 */
export const SMSFileTypeBadge: FC<SMSFileTypeBadgeProps> = memo(function SMSFileTypeBadge({
  fileName,
  typeOfFile,
  size = 'sm',
}) {
  const { label, outerBg, textOnPage } = getFileTypeBadgeStyleFromUpload(fileName, typeOfFile);

  const cssVars = {
    '--sms-ft-outer-bg': outerBg,
    '--sms-ft-text': textOnPage,
  } as CSSProperties;

  const sizeClass = size === 'md' ? styles.md : styles.sm;

  return (
    <Box className={`${styles.root} ${sizeClass}`} style={cssVars} aria-hidden>
      <Box className={styles.pageHint} />
      <Box className={styles.page}>
        <Box component="span" className={styles.label}>
          {label}
        </Box>
      </Box>
    </Box>
  );
});

SMSFileTypeBadge.displayName = 'SMSFileTypeBadge';

export default SMSFileTypeBadge;
