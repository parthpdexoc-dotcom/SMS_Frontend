import Card, { CardProps } from '@mui/material/Card';
import type { SxProps, Theme } from '@mui/material/styles';
import { FC, memo, useMemo } from 'react';
import { cn } from '@/utils';
import styles from './SMSCard.module.css';

const breakpointDown768 = '@media (max-width: 768px)';

export type SMSCardPadding = 'none' | 'sm' | 'md' | 'lg' | 'xl';

function paddingToSx(padding: SMSCardPadding): SxProps<Theme> {
  switch (padding) {
    case 'none':
      return { p: 0 };
    case 'sm':
      return { p: 'var(--spacing-sm)' };
    case 'lg':
      return {
        p: 'var(--spacing-lg)',
        [breakpointDown768]: { p: 'var(--spacing-md)' },
      };
    case 'xl':
      return {
        p: 'var(--spacing-xl)',
        [breakpointDown768]: { p: 'var(--spacing-lg)' },
      };
    case 'md':
    default:
      return {
        p: 'var(--spacing-md)',
        [breakpointDown768]: { p: 'var(--spacing-sm)' },
      };
  }
}

export interface SMSCardProps extends CardProps {
  /** App spacing scale + 768px mobile overrides (matches former atoms/Card). Omit to leave padding to `sx` only. */
  padding?: SMSCardPadding;
}

export const SMSCard: FC<SMSCardProps> = memo(
  ({ variant = 'elevation', elevation = 1, className, padding, sx, ...props }) => {
    const mergedSx = useMemo(() => {
      const paddingSx = padding !== undefined ? paddingToSx(padding) : undefined;
      if (paddingSx && sx !== undefined) {
        return [paddingSx, sx] as SxProps<Theme>;
      }
      return paddingSx ?? sx;
    }, [padding, sx]);

    return (
      <Card
        variant={variant}
        elevation={elevation}
        className={cn(styles.card, className)}
        sx={mergedSx}
        {...props}
      />
    );
  }
);

SMSCard.displayName = 'SMSCard';

export default SMSCard;

