import CircularProgress, { CircularProgressProps } from '@mui/material/CircularProgress';
import { FC, memo } from 'react';
import { SMSStack } from '@/components/smsatoms/SMSStack';
import { SMSTypography } from '@/components/smsatoms/SMSTypography';

export type SMSLoaderProps = CircularProgressProps & {
  /**
   * Caption under the spinner. Pass `false` to show only the spinner.
   * @default 'Loading...'
   */
  loadingText?: string | false;
  /**
   * When true, only `CircularProgress` is rendered (e.g. `SMSButton` `startIcon`).
   * Ignores `loadingText` layout; still uses `aria-label` / `aria-hidden` from props.
   */
  inline?: boolean;
};

/**
 * Shared indeterminate spinner for SMS (modals, full-page loading blocks, inline affordances).
 */
export const SMSLoader: FC<SMSLoaderProps> = memo(
  ({
    size = 40,
    thickness = 4,
    loadingText = 'Loading...',
    'aria-label': ariaLabel,
    inline = false,
    ...props
  }) => {
    const caption = loadingText === false ? null : loadingText;
    const progressLabel = ariaLabel ?? caption ?? 'Loading';

    const progress = (
      <CircularProgress size={size} thickness={thickness} aria-label={progressLabel} {...props} />
    );

    if (inline) {
      return progress;
    }

    return (
      <SMSStack spacing={1.5} alignItems="center" justifyContent="center" role="status">
        {progress}
        {caption ? (
          <SMSTypography variant="body2" color="text.secondary" component="span">
            {caption}
          </SMSTypography>
        ) : null}
      </SMSStack>
    );
  }
);

SMSLoader.displayName = 'SMSLoader';
