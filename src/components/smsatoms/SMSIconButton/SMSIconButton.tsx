import React, { FC, memo, useRef, useState } from 'react';
import IconButton, { IconButtonProps } from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { SxProps, Theme } from '@mui/material/styles';
import { useAppSelector } from '@/store/hooks';
import { isSuspendedEmployeeActive } from '@/utils/suspension';

/**
 * Semantic icon colors for SMS — defined only here so edit/delete (and other actions)
 * stay consistent; palette values come from `src/styles/theme.css` (:root variables).
 */
export type SMSIconButtonTone =
  | 'default'
  | 'primary'
  | 'error'
  | 'success'
  | 'secondary'
  | 'info'
  /** Green accent (e.g. accept) — uses --success-color */
  | 'positive';

const disabledSx = {
  '&.Mui-disabled': { opacity: 0.4 },
} as const;

/** Outlined “Split Post” style: white fill, light border, corners from `--radius-sm` (tighter than former 10px). */
const outlinedShellBase: SxProps<Theme> = {
  backgroundColor: '#ffffff',
  border: '1px solid #C7CFDA',
  borderRadius: '6px',
  boxSizing: 'border-box',
  transition: 'background-color 0.2s ease-in-out, border-color 0.2s ease-in-out, color 0.2s ease-in-out',
  /* Neutral hover only — no blue border/fill (product request) */
  '&:hover': {
    borderColor: '#94A3B8',
    backgroundColor: 'rgba(15, 23, 42, 0.05)',
  },
  '&:focus-visible': {
    outline: '2px solid #64748B',
    outlineOffset: '2px',
  },
  ...disabledSx,
};

/** Match compact table actions (~32px) and default hit targets (~40px). */
const outlinedSizing: SxProps<Theme> = {
  width: 40,
  height: 40,
  padding: '8px',
  '&.MuiIconButton-sizeSmall': {
    width: 32,
    height: 32,
    padding: '4px',
  },
};

function sxOutlinedTone(tone: SMSIconButtonTone): SxProps<Theme> {
  switch (tone) {
    case 'default':
      return {
        color: 'var(--text-secondary)',
      };
    case 'primary':
      return {
        color: 'var(--primary-color)',
      };
    case 'error':
      return {
        color: 'var(--danger-color)',
        borderColor: 'rgba(196, 30, 58, 0.35)',
        '&:hover': {
          borderColor: 'var(--danger-color)',
          color: 'var(--danger-hover)',
          backgroundColor: 'var(--danger-light)',
        },
      };
    case 'success':
      return {
        color: 'var(--text-gradient-primary-start)',
        borderColor: 'rgba(26, 54, 93, 0.35)',
      };
    case 'secondary':
      return {
        color: 'var(--secondary-color)',
        borderColor: 'rgba(212, 175, 55, 0.45)',
        '&:hover': {
          borderColor: 'var(--secondary-hover)',
          color: 'var(--secondary-hover)',
          backgroundColor: 'rgba(212, 175, 55, 0.08)',
        },
      };
    case 'info':
      return {
        color: 'var(--info-color)',
        borderColor: 'rgba(0, 31, 63, 0.25)',
      };
    case 'positive':
      return {
        color: 'var(--success-color)',
        borderColor: 'rgba(16, 185, 129, 0.4)',
        '&:hover': {
          borderColor: 'var(--success-color)',
          color: 'var(--success-hover)',
          backgroundColor: 'var(--success-light)',
        },
      };
  }
}

/** Ghost / legacy fills — use with `variant="plain"` or when no `tone` (inputs, nested edit glyph). */
const plainHoverNeutral = {
  backgroundColor: 'rgba(15, 23, 42, 0.06)',
} as const;

function sxPlainTone(tone: SMSIconButtonTone): SxProps<Theme> {
  switch (tone) {
    case 'default':
      return {
        color: 'var(--text-secondary)',
        '&:hover': {
          color: 'var(--text-primary)',
          ...plainHoverNeutral,
        },
        '&:focus-visible': { backgroundColor: 'rgba(15, 23, 42, 0.08)' },
        ...disabledSx,
      };
    case 'primary':
      return {
        color: 'var(--primary-color)',
        '&:hover': {
          color: 'var(--primary-color)',
          ...plainHoverNeutral,
        },
        ...disabledSx,
      };
    case 'error':
      return {
        color: 'var(--danger-color)',
        '&:hover': {
          color: 'var(--danger-hover)',
          backgroundColor: 'var(--danger-light)',
        },
        ...disabledSx,
      };
    case 'success':
      return {
        color: 'var(--text-inverse)',
        backgroundColor: 'var(--text-gradient-primary-start)',
        border: '1px solid var(--text-gradient-primary-start)',
        borderRadius: '4px',
        '&:hover': {
          color: 'var(--text-inverse)',
          backgroundColor: '#111827',
          borderColor: '#111827',
        },
        ...disabledSx,
      };
    case 'secondary':
      return {
        color: 'var(--secondary-color)',
        '&:hover': {
          color: 'var(--secondary-hover)',
          backgroundColor: 'var(--secondary-color-rgba-10)',
        },
        ...disabledSx,
      };
    case 'info':
      return {
        color: 'var(--info-color)',
        '&:hover': {
          color: 'var(--info-color)',
          ...plainHoverNeutral,
        },
        ...disabledSx,
      };
    case 'positive':
      return {
        color: 'var(--success-color)',
        '&:hover': {
          color: 'var(--success-hover)',
          backgroundColor: 'var(--success-color-rgba-10)',
        },
        ...disabledSx,
      };
  }
}

export interface SMSIconButtonProps extends IconButtonProps {
  /** Centralized icon color; uses theme CSS variables. Omit to keep MUI/default + `sx` only. */
  tone?: SMSIconButtonTone;
  /** When true, the global suspended-user lock will NOT disable this icon button. */
  allowWhenSuspended?: boolean;
  /**
   * `outlined` — white chip with border (same family as “Split Post” / outlined SMSButton).
   * `plain` — transparent; use in text fields, nested icons, or when you need the legacy filled “success” look.
   * Default: outlined when `tone` is set, plain when `tone` is omitted.
   */
  variant?: 'outlined' | 'plain';
}

/**
 * SMSIconButton Component
 *
 * 🛡️ BUILT-IN DOUBLE-CLICK & IN-FLIGHT MUTATION PROTECTION:
 * --------------------------------------------------------
 * 1. 450ms Throttle Window (`lastClickTimeRef`):
 *    Rapid clicks/taps on action icons (e.g., Delete trash icon, Take Shift icon)
 *    are automatically throttled within a 450ms window.
 *
 * 2. Automatic In-Flight Promise Locking (`isAsyncPending`):
 *    If the `onClick` handler returns an asynchronous Promise, the icon button
 *    automatically disables itself until the operation settles.
 */
export const SMSIconButton: FC<SMSIconButtonProps> = memo(
  ({ tone, variant, sx, title, disabled, allowWhenSuspended = false, onClick, ...props }) => {
    const { user } = useAppSelector((state) => state.auth);
    const [isAsyncPending, setIsAsyncPending] = useState(false);
    const isSuspendedActive = isSuspendedEmployeeActive(user);
    const isDisabled = Boolean(disabled || isAsyncPending || (!allowWhenSuspended && isSuspendedActive));
    const lastClickTimeRef = useRef(0);

    const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
      const now = Date.now();
      if (isDisabled || now - lastClickTimeRef.current < 450) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      lastClickTimeRef.current = now;

      if (onClick) {
        try {
          const result: unknown = onClick(e);
          if (result && typeof (result as Promise<unknown>).then === 'function') {
            setIsAsyncPending(true);
            await result;
          }
        } finally {
          setIsAsyncPending(false);
        }
      }
    };

    const effectiveVariant: 'outlined' | 'plain' =
      variant ?? (tone ? 'outlined' : 'plain');

    const parts: SxProps<Theme>[] = [];

    if (effectiveVariant === 'outlined') {
      parts.push(outlinedShellBase, outlinedSizing);
      if (tone) {
        parts.push(sxOutlinedTone(tone));
      } else {
        parts.push({
          color: 'var(--text-secondary)',
          '&:hover': { color: 'var(--text-primary)' },
        });
      }
    } else if (tone) {
      parts.push(sxPlainTone(tone));
    }

    if (sx != null) parts.push(...(Array.isArray(sx) ? sx : [sx]));
    const composed: SxProps<Theme> | undefined = parts.length
      ? (parts.length === 1 ? parts[0]! : (parts as unknown as SxProps<Theme>))
      : undefined;

    const iconButton = <IconButton {...props} onClick={handleClick} disabled={isDisabled} sx={composed} />;
    const hasTooltip = title !== undefined && title !== null && title !== '';

    if (!hasTooltip) return iconButton;

    return (
      <Tooltip title={title} placement="top">
        <span style={{ display: 'inline-flex' }}>{iconButton}</span>
      </Tooltip>
    );
  }
);

SMSIconButton.displayName = 'SMSIconButton';

export default SMSIconButton;
