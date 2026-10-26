/**
 * Breakpoint definitions for theme tokens
 * Aligned with MUI default breakpoints
 */
export type BreakpointKey = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export const breakpoints: Record<BreakpointKey, number> = {
  xs: 0,      // extra-small: 0px
  sm: 600,    // small: 600px
  md: 900,    // medium: 900px
  lg: 1200,   // large: 1200px
  xl: 1536,   // extra-large: 1536px
};

