import FormHelperText, { FormHelperTextProps } from '@mui/material/FormHelperText';
import type { SxProps, Theme } from '@mui/material/styles';
import { FC, memo } from 'react';

export interface SMSHelperTextProps extends FormHelperTextProps {
  // All MUI FormHelperText props are inherited
}

export const SMSHelperText: FC<SMSHelperTextProps> = memo(({ error, sx, ...props }) => {
  const base = Array.isArray(sx) ? sx : sx != null ? [sx] : [];
  /** `&&` raises specificity so we beat theme `MuiFormHelperText-root` + inherited primary/navy from ancestors. */
  const errorSx: SxProps<Theme> | null = error
    ? (theme: Theme) => ({
        '&&': {
          color: theme.palette.error.main,
        },
      })
    : null;
  const sxMerged: SxProps<Theme> | undefined =
    base.length === 0 && !error ? undefined : [...base, ...(errorSx ? [errorSx] : [])];
  return <FormHelperText error={error} sx={sxMerged} {...props} />;
});

SMSHelperText.displayName = 'SMSHelperText';

export default SMSHelperText;

