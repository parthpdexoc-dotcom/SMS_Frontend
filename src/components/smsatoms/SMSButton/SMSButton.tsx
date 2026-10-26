import { Button, ButtonProps, CircularProgress } from '@mui/material';
import { SxProps, Theme } from '@mui/material/styles';
import React, { FC, forwardRef, memo, ReactNode, Ref } from 'react';
import { SMSIcon } from '../SMSIcon';
import { SMSIconButton } from '../SMSIconButton/SMSIconButton';
import { cn } from '@/utils';
import { isSuspendedEmployeeActive } from '@/utils/suspension';
import { useAppSelector } from '@/store/hooks';
import styles from './SMSButton.module.css';

export type SMSButtonVariant = 'contained' | 'outlined' | 'text';

/** `xs` / `xl` extend MUI with tighter/taller hit areas aligned to the SMS field scale. */
export type SMSButtonSize = 'xs' | 'small' | 'medium' | 'large' | 'xl';

export interface SMSButtonProps extends Omit<ButtonProps, 'classes' | 'size'> {
  /** @default 'contained' */
  variant?: SMSButtonVariant;
  /** @default 'primary' */
  color?: ButtonProps['color'];
  /** @default 'small' */
  size?: SMSButtonSize;
  /** Shows a spinner, disables the button, and sets aria-busy (use on save/submit while async work runs). */
  loading?: boolean;
  leftIcon?: ReactNode;
  /** When true, the global suspended-user lock will NOT disable this button. */
  allowWhenSuspended?: boolean;
  /** When true, renders a standard edit (pen) icon as the leading icon if no other icon is provided. */
  editIcon?: boolean;
  backgroundColor?: string;
  hoverBackgroundColor?: string;
}

const SIZE_SX: Record<'xs' | 'small' | 'xl', SxProps<Theme>> = {
  xs: {
    minHeight: 18,
    padding: '2px 8px',
    fontSize: '0.8125rem',
    lineHeight: 1,
    '& .MuiButton-startIcon': { marginRight: '6px', '& svg': { fontSize: '18px' } },
    '& .MuiButton-endIcon': { marginLeft: '6px', '& svg': { fontSize: '18px' } },
  },
  xl: {
    minHeight: 48,
    padding: '12px 28px',
    fontSize: '1.0625rem',
    lineHeight: 1.3,
    '& .MuiButton-startIcon': { marginRight: '10px', '& svg': { fontSize: '24px' } },
    '& .MuiButton-endIcon': { marginLeft: '10px', '& svg': { fontSize: '24px' } },
  },
  small: {
    minHeight: 24,
    padding: '0px 8px',
    fontSize: '0.8125rem',
    lineHeight: 1.1,
    '& .MuiButton-startIcon': { marginRight: '2px', '& svg': { fontSize: '16px' } },
    '& .MuiButton-endIcon': { marginLeft: '2px', '& svg': { fontSize: '16px' } },
  },
};

const SPINNER_PX: Record<SMSButtonSize, number> = {
  xs: 14,
  small: 16,
  medium: 18,
  large: 20,
  xl: 22,
};

function toMuiButtonSize(size: SMSButtonSize | undefined): 'small' | 'medium' | 'large' {
  switch (size) {
    case 'xs':
      return 'small';
    case 'xl':
      return 'large';
    case 'small':
    case 'large':
      return size;
    default:
      return 'medium';
  }
}

/**
 * SMSButton Component
 *
 * 🛡️ BUILT-IN DOUBLE-CLICK & IN-FLIGHT MUTATION PROTECTION:
 * --------------------------------------------------------
 * 1. 450ms Throttle Window (`lastClickTimeRef`):
 *    Rapid clicks (e.g., clicking 2-3 times fast on slow devices) are automatically
 *    throttled. Any second click occurring within 450ms of the first is discarded.
 *
 * 2. Automatic In-Flight Promise Locking (`isAsyncPending`):
 *    If the `onClick` handler returns a Promise (e.g., an asynchronous API call or Redux thunk),
 *    the button automatically detects this and transitions into `isAsyncPending = true`.
 *    This locks the button (`disabled={true}`) and displays a loading spinner until the Promise
 *    settles, preventing duplicate server submissions even if the caller did not pass `loading={true}`.
 *
 * 3. Unified Loading Coordination (`isEffectivelyLoading`):
 *    Combines explicit `loading` props with automatic `isAsyncPending` state to disable the
 *    button, render the spinner, and update accessibility attributes (`aria-busy`).
 */
export const SMSButton: FC<SMSButtonProps> = memo(
  forwardRef(
    (
      {
        loading = false,
        children,
        onClick,
        disabled,
        className,
        variant: variantProp,
        color: colorProp,
        leftIcon,
        startIcon,
        endIcon,
        editIcon,
        backgroundColor,
        hoverBackgroundColor,
        size: sizeProp = 'small',
        sx,
        allowWhenSuspended = false,
        title,
        'aria-label': ariaLabel,
        ...props
      },
      forwardedRef: Ref<HTMLButtonElement>
    ) => {
      const { user } = useAppSelector((state) => state.auth);
      
      // Tracks if an asynchronous onClick promise is currently executing
      const [isAsyncPending, setIsAsyncPending] = React.useState(false);
      
      // Global suspension check for active suspended employees
      const isSuspendedActive = isSuspendedEmployeeActive(user);
      
      // Button is effectively loading if caller passed `loading={true}` OR an async onClick is pending
      const isEffectivelyLoading = Boolean(loading || isAsyncPending);
      
      // Combined disabled state: explicit prop, loading/in-flight, or suspended user lockout
      const isDisabled = Boolean(disabled || isEffectivelyLoading || (!allowWhenSuspended && isSuspendedActive));
      
      // Timestamp of the last successful click event to prevent rapid double-clicks (<450ms)
      const lastClickTimeRef = React.useRef(0);

      const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
        const now = Date.now();
        
        // Block execution if disabled, loading, or clicked within 450ms of the previous click
        if (isDisabled || now - lastClickTimeRef.current < 450) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        lastClickTimeRef.current = now;

        if (onClick) {
          try {
            const result: unknown = onClick(e);
            // If the onClick handler is asynchronous (returns a Promise / Thenable),
            // automatically lock the button and display a loading spinner until it resolves.
            if (result && typeof (result as Promise<unknown>).then === 'function') {
              setIsAsyncPending(true);
              await result;
            }
          } finally {
            setIsAsyncPending(false);
          }
        }
      };

      let resolvedStartIcon = leftIcon ?? startIcon;

      if (editIcon && !resolvedStartIcon && !loading) {
        // Decorative-only span so the glyph uses SMSIcon styling inside an IconButton shell (no nested <button>)
        resolvedStartIcon = (
          <SMSIconButton
            component="span"
            tabIndex={-1}
            aria-hidden
            size="small"
            sx={{
              p: '2px',
              pointerEvents: 'none',
              color: 'inherit',
              '&:hover': { backgroundColor: 'transparent' },
            }}
          >
            <SMSIcon name="edit" size="sm" />
          </SMSIconButton>
        );
      }

      const variant = variantProp ?? 'contained';
      const paletteKey = (
        ['primary', 'secondary', 'error', 'warning', 'info', 'success'].includes(String(colorProp))
          ? colorProp
          : 'primary'
      ) as 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';

      const startIconNode: ReactNode = isEffectivelyLoading ? (
        <CircularProgress
          size={SPINNER_PX[sizeProp]}
          thickness={4}
          sx={(theme) =>
            variant === 'outlined' || variant === 'text'
              ? { color: theme.palette.primary.main }
              : { color: theme.palette.getContrastText(theme.palette[paletteKey].main) }
          }
          aria-hidden
        />
      ) : (
        resolvedStartIcon
      );

      const hasCustomColors =
        backgroundColor != null || hoverBackgroundColor != null;

      const customSx: SxProps<Theme> = hasCustomColors
        ? {
            ...(backgroundColor != null && { backgroundColor }),
            ...(hoverBackgroundColor != null && {
              '&:hover': { backgroundColor: hoverBackgroundColor },
            }),
          }
        : {};

      const extraSizeSx =
        sizeProp === 'xs' || sizeProp === 'small' || sizeProp === 'xl'
          ? SIZE_SX[sizeProp]
          : {};

      const loadingSx: SxProps<Theme> = isEffectivelyLoading
        ? {
            '&.Mui-disabled': {
              opacity: 0.92,
              ...(variant === 'contained' && { color: 'inherit' }),
            },
          }
        : {};

      return (
        <Button
          disableRipple
          ref={forwardedRef}
          onClick={handleClick}
          disabled={isDisabled}
          variant={variant}
          color={colorProp ?? 'primary'}
          size={toMuiButtonSize(sizeProp)}
          className={cn(styles.button, isEffectivelyLoading && styles.loading, className)}
          startIcon={startIconNode}
          endIcon={isEffectivelyLoading ? undefined : endIcon}
          aria-busy={isEffectivelyLoading || undefined}
          aria-label={ariaLabel}
          title={title}
          sx={[customSx, extraSizeSx, loadingSx, sx].filter(Boolean) as SxProps<Theme>}
          {...props}
        >
          {children}
        </Button>
      );
    }
  )
);

SMSButton.displayName = 'SMSButton';

export default SMSButton;
