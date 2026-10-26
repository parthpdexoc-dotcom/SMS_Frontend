import type { BreakpointKey } from './breakpoints';
import { breakpoints } from './breakpoints';

/**
 * Theme tokens (TypeScript)
 * - Source of truth for naming + typing.
 * - Actual runtime values are provided via CSS variables in `globalStyles.css`.
 *
 * Rule: components should reference CSS variables (e.g. `var(--color-primary)`),
 * not hardcoded hex/px values.
 */
export const tokens = {
  colors: {
    primary: 'var(--color-primary)',
    primaryHover: 'var(--color-primary-hover)',
    primarySoft: 'var(--color-primary-soft)',

    secondary: 'var(--color-secondary)',
    secondaryHover: 'var(--color-secondary-hover)',

    success: 'var(--color-success)',
    successHover: 'var(--color-success-hover)',
    successSoft: 'var(--color-success-soft)',

    warning: 'var(--color-warning)',
    warningHover: 'var(--color-warning-hover)',
    warningSoft: 'var(--color-warning-soft)',

    error: 'var(--color-error)',
    errorHover: 'var(--color-error-hover)',
    errorSoft: 'var(--color-error-soft)',

    info: 'var(--color-info)',
    infoHover: 'var(--color-info-hover)',
    infoSoft: 'var(--color-info-soft)',

    bg: {
      canvas: 'var(--bg-canvas)',
      surface: 'var(--bg-surface)',
      subtle: 'var(--bg-subtle)',
    },

    text: {
      primary: 'var(--text-primary)',
      secondary: 'var(--text-secondary)',
      muted: 'var(--text-muted)',
      inverse: 'var(--text-inverse)',
      disabled: 'var(--text-disabled)',
    },

    border: {
      default: 'var(--border-default)',
      subtle: 'var(--border-subtle)',
      focus: 'var(--border-focus)',
      error: 'var(--border-error)',
    },
  },

  typography: {
    fontFamily: 'var(--font-family)',
    monoFamily: 'var(--font-mono)',
    sizes: {
      xs: 'var(--font-xs)',
      sm: 'var(--font-sm)',
      md: 'var(--font-md)',
      lg: 'var(--font-lg)',
      xl: 'var(--font-xl)',
      display: 'var(--font-display)',
    },
    weights: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeights: {
      tight: 'var(--lh-tight)',
      base: 'var(--lh-base)',
      relaxed: 'var(--lh-relaxed)',
    },
  },

  spacing: {
    0: '0',
    1: 'var(--space-1)',
    2: 'var(--space-2)',
    3: 'var(--space-3)',
    4: 'var(--space-4)',
    5: 'var(--space-5)',
    6: 'var(--space-6)',
    7: 'var(--space-7)',
    8: 'var(--space-8)',
  },

  radii: {
    sm: 'var(--radius-sm)',
    md: 'var(--radius-md)',
    lg: 'var(--radius-lg)',
    xl: 'var(--radius-xl)',
    full: 'var(--radius-full)',
  },

  borderWidth: {
    hairline: 'var(--borderw-hairline)',
    thin: 'var(--borderw-thin)',
    thick: 'var(--borderw-thick)',
  },

  shadows: {
    sm: 'var(--shadow-sm)',
    md: 'var(--shadow-md)',
    lg: 'var(--shadow-lg)',
    xl: 'var(--shadow-xl)',
  },

  elevation: {
    0: 'none',
    1: 'var(--shadow-sm)',
    2: 'var(--shadow-md)',
    3: 'var(--shadow-lg)',
    4: 'var(--shadow-xl)',
  },

  breakpoints,

  zIndex: {
    dropdown: 'var(--z-dropdown)',
    sticky: 'var(--z-sticky)',
    fixed: 'var(--z-fixed)',
    modal: 'var(--z-modal)',
    popover: 'var(--z-popover)',
    tooltip: 'var(--z-tooltip)',
    toast: 'var(--z-toast)',
  },
} as const;

export type Tokens = typeof tokens;
export type Breakpoints = Record<BreakpointKey, number>;



