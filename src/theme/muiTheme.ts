import { createTheme, ThemeOptions } from '@mui/material/styles';

/**
 * MUI Theme Configuration
 * Based on reference project structure, adapted to use CSS variables from globalStyles.css
 * 
 * This theme provides comprehensive styling for all MUI components,
 * ensuring consistency with the design system.
 */

// Border transition configuration (DRY principle)
const BORDER_TRANSITION = 'border-color 0.2s ease-in-out, border-width 0.2s ease-in-out';

/**
 * Default MUI Theme Configuration
 * Uses CSS variables from globalStyles.css for consistency
 */
const DEFAULT_THEME: ThemeOptions = {
  // Align MUI's breakpoint system with the design tokens used in CSS:
  // --bp-mobile: 480px, --bp-tablet: 768px, --bp-desktop: 1024px, --bp-wide: 1280px
  breakpoints: {
    values: {
      xs: 0,
      sm: 480,
      md: 768,
      lg: 1024,
      xl: 1280,
    },
  },
  // Note: MUI's palette system expects concrete color values (hex, rgb, etc.),
  // not CSS variables. We mirror the values from `globalStyles.css` here so
  // that MUI can do its internal color computations, while components can
  // still use CSS variables directly where needed.
  palette: {
    mode: 'light',
    primary: {
      main: '#243F63', // Deep navy blue (from logo)
      dark: '#1A2F4A', // Darker shade for hover
      light: '#4A6B8A', // Lighter shade
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#C8A54B', // Muted gold (from logo)
      dark: '#A6893A', // Darker shade for hover
      light: '#D4B86A', // Lighter shade
      contrastText: '#FFFFFF',
    },
    error: {
      main: '#c41e3a', // Red (from logo shield stripes)
      dark: '#a01a2f',
      light: '#fce7ea',
      contrastText: '#ffffff',
    },
    warning: {
      main: '#f59e0b',
      dark: '#d97706',
      light: '#fef3c7',
      contrastText: '#1F2937',
    },
    success: {
      main: '#10b981',
      dark: '#059669',
      light: '#d1fae5',
      contrastText: '#ffffff',
    },
    info: {
      main: '#1E4976',
      dark: '#0891b2',
      light: '#cffafe',
      contrastText: '#1F2937',
    },
    text: {
      primary: '#1F2937', // Professional dark gray
      secondary: '#6B7280', // Muted gray
      disabled: '#9CA3AF',
    },
    background: {
      default: '#F4F6F8', // Soft gray background (not white)
      paper: '#FFFFFF', // Clean white surface
    },
    divider: '#E5E7EB', // Subtle divider
  },
  typography: {
    fontFamily: 'var(--font-family)',
    h1: {
      fontSize: '2rem', // Larger title
      fontWeight: 600, // Semi-bold
      lineHeight: 1.2,
      color: '#1E4976',
      letterSpacing: '-0.02em',
    },
    h2: {
      fontSize: '1.75rem',
      fontWeight: 600,
      lineHeight: 1.3,
      color: '#1E4976',
      letterSpacing: '-0.01em',
    },
    h3: {
      fontSize: '1.5rem',
      fontWeight: 600,
      lineHeight: 1.4,
      color: '#1E4976',
    },
    h4: {
      fontSize: '1.25rem', // Larger for better hierarchy
      fontWeight: 600,
      lineHeight: 1.5,
      color: '#1E4976',
    },
    h5: {
      fontSize: 'var(--font-md, 1rem)',
      fontWeight: 500,
      lineHeight: 1.5,
      color: '#1E4976',
    },
    h6: {
      fontSize: 'var(--font-sm, 0.875rem)',
      fontWeight: 500,
      lineHeight: 1.5,
      color: '#1E4976',
    },
    subtitle1: {
      fontSize: '1rem',
      fontWeight: 400,
      lineHeight: 1.5,
      color: '#6B7280', // Muted secondary color
    },
    subtitle2: {
      fontSize: '0.875rem',
      fontWeight: 400,
      lineHeight: 1.5,
      color: '#6B7280', // Muted secondary color
    },
    body1: {
      fontSize: 'var(--font-md, 1rem)',
      fontWeight: 400,
      lineHeight: 1.5,
      color: 'var(--text-primary)',
    },
    body2: {
      fontSize: 'var(--font-sm, 0.875rem)',
      fontWeight: 400,
      lineHeight: 1.5,
      color: 'var(--text-primary)',
    },
    button: {
      fontSize: 'var(--font-md, 1rem)',
      fontWeight: 600,
      lineHeight: 1.5,
      textTransform: 'none',
    },
    caption: {
      fontSize: 'var(--font-xs, 0.75rem)',
      fontWeight: 400,
      lineHeight: 1.5,
      color: 'var(--text-secondary)',
    },
    overline: {
      fontSize: 'var(--font-xs, 0.75rem)',
      fontWeight: 400,
      lineHeight: 1.5,
      textTransform: 'uppercase',
      color: 'var(--text-muted)',
    },
  },
  // Global shape configuration - Enterprise-grade, structured appearance
  shape: {
    borderRadius: 6, // Small radius for professional, structured look (6-8px range)
  },
  spacing: 8,
  components: {
    MuiContainer: {
      styleOverrides: {
        root: {
          // Keep Container aligned with the CSS design system container
          maxWidth: 'var(--container-max-width)',
          paddingLeft: 'var(--spacing-md)',
          paddingRight: 'var(--spacing-md)',
        },
      },
    },
    // Applied to all layout grids via SMSGrid (do not import @mui/material/Grid elsewhere).
    MuiGrid: {
      styleOverrides: {
        root: {
          '&.MuiGrid-item': {
            minWidth: 0,
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          fontSize: '1rem',
          fontWeight: 500, // Consistent weight - no changes on states
          textTransform: 'none',
          // Ensure consistent dimensions - no size changes
          boxSizing: 'border-box',
          // Prevent any layout shifts
          verticalAlign: 'middle',
          // Disable any scaling effects
          willChange: 'auto',
          lineHeight: 1.3,
          padding: '8px 16px',
          borderRadius: '6px', // Small radius (4-6px) - professional, not pill-shaped
          
          // Start icon styling
          '& .MuiButton-startIcon': {
            marginRight: '6px',
            marginLeft: 0,
            '& svg': {
              fontSize: '24px',
            },
          },
          
          // End icon styling
          '& .MuiButton-endIcon': {
            marginLeft: '6px',
            marginRight: 0,
            '& svg': {
              fontSize: '24px',
            },
          },
          
          // Completely disable ripple effects to prevent size changes
          '& .MuiTouchRipple-root': {
            display: 'none !important',
          },
          // Prevent ripple from affecting layout
          '& .MuiTouchRipple-ripple': {
            display: 'none !important',
          },
          // Focus styles - professional outline without size changes
          '&:focus': {
            transform: 'none !important',
            scale: '1 !important',
          },
          '&:focus-visible': {
            outline: '2px solid #243F63',
            outlineOffset: '2px',
            transform: 'none !important',
            scale: '1 !important',
          },
        },
        // Text variant styling - match default input height (--sms-input-height: 40px)
        text: {
          textDecoration: 'none',
          padding: '8px 16px',
          fontWeight: 500,
          textTransform: 'none',
          minHeight: '40px',
          height: '40px',
          borderRadius: '6px',
          fontSize: '1rem',
          lineHeight: 1.3,
          color: '#6B7280',
          backgroundColor: 'transparent',
          border: 'none',
          boxShadow: 'none',
          boxSizing: 'border-box',
          transition: 'background-color 0.2s ease-in-out, color 0.2s ease-in-out',
          transform: 'none !important',
          scale: '1 !important',
          '&:hover': {
            backgroundColor: 'rgba(244, 246, 248, 0.8)',
            transform: 'none !important',
            scale: '1 !important',
            padding: '8px 16px !important',
            height: '40px !important',
          },
          '&:active': {
            backgroundColor: 'rgba(244, 246, 248, 0.9)',
            transform: 'none !important',
            scale: '1 !important',
            padding: '8px 16px !important',
            height: '40px !important',
          },
          '&:focus': {
            transform: 'none !important',
            scale: '1 !important',
            padding: '8px 16px !important',
            height: '40px !important',
          },
          '&:focus-visible': {
            outline: '2px solid #243F63',
            outlineOffset: '2px',
            transform: 'none !important',
            scale: '1 !important',
            padding: '8px 16px !important',
            height: '40px !important',
          },
        },
        // Outlined button styling - match default input height (--sms-input-height: 40px)
        outlined: {
          borderRadius: '6px',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: '#C7CFDA',
          padding: '8px 16px',
          minHeight: '40px',
          height: '40px',
          backgroundColor: 'transparent',
          transition: 'background-color 0.2s ease-in-out, border-color 0.2s ease-in-out',
          '&:hover': {
            borderWidth: '1px !important', // Prevent border width changes
            borderColor: '#8FA6C3',
            backgroundColor: 'rgba(244, 246, 248, 0.5)',
            transform: 'none !important',
            scale: '1 !important',
          },
          '&:active': {
            borderWidth: '1px !important',
            transform: 'none !important',
            scale: '1 !important',
          },
          '&:focus': {
            borderWidth: '1px !important',
            transform: 'none !important',
            scale: '1 !important',
          },
        },
        // Outlined small size - Stable
        outlinedSizeSmall: {
          padding: '8px 16px', // Fixed padding
          minHeight: '36px',
          height: '36px',
        },
        // Contained button styling - match default input height (--sms-input-height: 40px)
        contained: {
          borderRadius: '6px',
          padding: '8px 16px',
          fontWeight: 500,
          textTransform: 'none',
          minHeight: '40px',
          height: '40px',
          fontSize: '1rem',
          lineHeight: 1.3,
          border: 'none',
          boxSizing: 'border-box',
          transition: 'background-color 0.2s ease-in-out, color 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
          transform: 'none !important',
          scale: '1 !important',
          '&:hover': {
            transform: 'none !important',
            scale: '1 !important',
          },
          '&:active': {
            transform: 'none !important',
            scale: '1 !important',
          },
          '&:focus': {
            transform: 'none !important',
            scale: '1 !important',
          },
          '&:focus-visible': {
            outline: '2px solid #243F63',
            outlineOffset: '2px',
            transform: 'none !important',
            scale: '1 !important',
          },
          '&.Mui-disabled': {
            backgroundColor: '#E5E7EB',
            color: '#9CA3AF',
            boxShadow: 'none',
            transform: 'none !important',
            scale: '1 !important',
          },
        },
        containedPrimary: {
          backgroundColor: '#243F63',
          color: '#FFFFFF',
          boxShadow: '0 1px 3px rgba(36, 63, 99, 0.2)',
          '&:hover': {
            backgroundColor: '#1A2F4A',
            boxShadow: '0 2px 6px rgba(36, 63, 99, 0.25)',
          },
          '&:active': {
            backgroundColor: '#152438',
            boxShadow: '0 1px 3px rgba(36, 63, 99, 0.2)',
          },
        },
        containedSecondary: {
          backgroundColor: '#C8A54B',
          color: '#FFFFFF',
          boxShadow: '0 1px 3px rgba(200, 165, 75, 0.2)',
          '&:hover': {
            backgroundColor: '#A6893A',
            boxShadow: '0 2px 6px rgba(200, 165, 75, 0.25)',
          },
          '&:active': {
            backgroundColor: '#A6893A',
            boxShadow: '0 1px 3px rgba(200, 165, 75, 0.2)',
          },
        },
        // Contained small size - Stable
        containedSizeSmall: {
          padding: '8px 16px', // Fixed padding
          minHeight: '36px',
          height: '36px',
        },
        // Contained large size - Stable
        containedSizeLarge: {
          padding: '14px 28px', // Fixed padding
          minHeight: '48px',
          height: '48px',
          fontSize: '1rem',
        },
      },
      defaultProps: {
        disableRipple: true,
        disableElevation: true,
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          color: 'var(--text-primary)',
          backgroundColor: 'var(--bg-canvas)',
        },
        // Global textarea styling (for non-MUI textareas)
        textarea: {
          fontFamily: 'var(--font-family)',
          fontSize: 'var(--font-md, 1rem)',
          fontWeight: 400,
          color: 'var(--text-primary)',
          backgroundColor: 'var(--bg-surface)',
          border: 'var(--borderw-thin, 1px) solid var(--border-default)',
          borderRadius: '6px', // Small radius - clean rectangular appearance
          transition: BORDER_TRANSITION,
          
          // Placeholder styling
          '&::placeholder': {
            color: 'var(--text-muted) !important',
            opacity: '1 !important',
          },
          
          // Text selection styling - clearly visible with sufficient contrast
          '&::selection': {
            backgroundColor: 'rgba(36, 63, 99, 0.25)', // Navy tint with better contrast (brand-aligned)
            color: '#1F2937', // Ensure text remains readable
          },
          '&::-moz-selection': {
            backgroundColor: 'rgba(36, 63, 99, 0.25)', // Firefox support
            color: '#1F2937',
          },
          
          // Hover state (not focused)
          '&:hover:not(:focus)': {
            borderColor: 'var(--border-focus)',
          },
          
          // Focus state
          '&:focus, &:focus-visible': {
            borderColor: 'var(--border-focus)',
            outline: 'none',
          },
          
          // Error state
          '&.error, &.errorBorder': {
            borderColor: 'var(--border-error) !important',
          },
        },
        // Global contentEditable styling (exclude MUI DatePicker section elements)
        '[contenteditable="true"]:not([class*="MuiPickers"])': {
          fontFamily: 'var(--font-family)',
          fontSize: 'var(--font-md, 1rem)',
          fontWeight: 400,
          color: 'var(--text-primary)',
          backgroundColor: 'var(--bg-surface)',
          border: 'var(--borderw-thin, 1px) solid var(--border-default)',
          borderRadius: 'var(--radius-md, 0.375rem)',
          transition: BORDER_TRANSITION,
          outline: 'none',
          
          '&:hover:not(:focus):not(:focus-within)': {
            borderColor: 'var(--border-focus)',
          },
          
          '&:focus, &:focus-within': {
            borderColor: 'var(--border-focus)',
          },
          
          '&.error, &.errorBorder': {
            borderColor: 'var(--border-error) !important',
          },
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
        size: 'medium',
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          color: '#1F2937',
          fontSize: '1rem',
          fontFamily: 'var(--font-family)',
          
          // Substantial height for non-multiline inputs
          '&:not(.MuiInputBase-multiline)': {
            height: '48px', // Increased height (medium-large)
            padding: '0 16px', // Comfortable padding
          },
          
          // Placeholder styling for input elements
          '& input::placeholder': {
            color: 'var(--text-muted, #94a3b8) !important',
            opacity: '1 !important',
          },
          // Placeholder styling for textarea elements
          '& textarea::placeholder': {
            color: 'var(--text-muted, #94a3b8) !important',
            opacity: '1 !important',
            fontWeight: '400 !important',
          },
          // Additional specificity for MUI classes
          '& .MuiInputBase-input::placeholder': {
            color: 'var(--text-muted, #94a3b8) !important',
            opacity: '1 !important',
          },
        },
        input: {
          '&::placeholder': {
            color: 'var(--text-muted, #94a3b8) !important',
            opacity: '1 !important',
          },
          // Text selection styling - clearly visible with sufficient contrast
          '&::selection': {
            backgroundColor: 'rgba(36, 63, 99, 0.25)', // Navy tint with better contrast (brand-aligned)
            color: '#1F2937', // Ensure text remains readable
          },
          '&::-moz-selection': {
            backgroundColor: 'rgba(36, 63, 99, 0.25)', // Firefox support
            color: '#1F2937',
          },
        },
        inputMultiline: {
          padding: 0,
          '&::placeholder': {
            color: 'var(--text-muted, #94a3b8) !important',
            opacity: '1 !important',
          },
          // Text selection styling for multiline inputs - clearly visible with sufficient contrast
          '&::selection': {
            backgroundColor: 'rgba(36, 63, 99, 0.25)', // Navy tint with better contrast (brand-aligned)
            color: '#1F2937', // Ensure text remains readable
          },
          '&::-moz-selection': {
            backgroundColor: 'rgba(36, 63, 99, 0.25)', // Firefox support
            color: '#1F2937',
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: '#FFFFFF', // Clean white background
          borderRadius: '6px', // Small radius - clean rectangular appearance
          transition: 'border-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out, background-color 0.2s ease-in-out',
          padding: '0 !important', // No padding on root - padding moved to input element to prevent selection gaps (override MuiInputBase)
          
          // Subtle focus background to visually unify the input area and improve selection visibility
          '&.Mui-focused': {
            backgroundColor: '#F8F9FA', // Subtle background tint on focus - makes field look active and cohesive
          },
          
          // Ensure input element matches root background for consistency
          '& .MuiInputBase-input': {
            backgroundColor: 'transparent', // Inherit root background
            '&.Mui-focused': {
              backgroundColor: 'transparent', // Inherit focused root background
            },
          },
          
          // Small size styling - for compact inputs like search fields
          '&.MuiInputBase-sizeSmall': {
            // Single-line only: fixed height. Multiline must stay auto-height or text overlaps the outline.
            '&:not(.MuiInputBase-multiline)': {
              height: '36px',
            },
            '&.MuiInputBase-multiline': {
              height: 'auto',
              minHeight: '36px',
              alignItems: 'flex-start',
            },
            '& .MuiInputBase-input': {
              padding: '8px 12px',
              fontSize: '0.875rem',
            },
            '& .MuiInputBase-inputMultiline': {
              padding: '8px 12px',
            },
            // Adjust padding when startAdornment is present
            '& .MuiInputBase-inputAdornedStart': {
              paddingLeft: '4px', // Reduced padding since InputAdornment provides spacing
            },
            // Adjust padding when endAdornment is present
            '& .MuiInputBase-inputAdornedEnd': {
              paddingRight: '4px', // Reduced padding since InputAdornment provides spacing
            },
          },
          
          // Default/Idle State - Subtle neutral border
          '& fieldset': {
            borderColor: '#C7CFDA', // Subtle neutral border
            borderWidth: '1px',
          },
          
          // Hover State - Slightly darker
          '&:hover:not(.Mui-focused):not(.Mui-error) fieldset': {
            borderColor: '#8FA6C3', // Slightly darker on hover
            borderWidth: '1px !important',
          },
          
          // Focused State - Prominent primary color focus border
          '&.Mui-focused:not(.Mui-error)': {
            '& fieldset': {
              borderColor: '#243F63', // Primary navy color - prominent and brand-aligned
              borderWidth: '2px !important',
            },
            boxShadow: '0 0 0 3px rgba(36, 63, 99, 0.12)', // Stronger focus ring for better visibility
          },
          
          // Error State
          '&.Mui-error fieldset': {
            borderColor: '#c41e3a',
            borderWidth: '1px !important',
          },
          
          // Disabled State
          '&.Mui-disabled': {
            backgroundColor: '#F4F6F8',
            '& fieldset': {
              borderColor: '#E5E7EB',
            },
          },
        },
        // Base border
        notchedOutline: {
          borderColor: '#C7CFDA',
          borderWidth: '1px',
          transition: BORDER_TRANSITION,
        },
        input: {
          padding: '12px 16px', // Base padding - MUI automatically adjusts right padding when endAdornment is present
          backgroundColor: 'transparent', // Match root background for visual consistency
          // Adjust padding when endAdornment is present (MUI default behavior)
          '&.MuiInputBase-inputAdornedEnd': {
            paddingRight: '8px', // Reduced right padding to make room for adornment
          },
          // Text selection styling - clearly visible with sufficient contrast
          '&::selection': {
            backgroundColor: 'rgba(36, 63, 99, 0.25)', // Navy tint with better contrast (brand-aligned)
            color: '#1F2937', // Ensure text remains readable
          },
          '&::-moz-selection': {
            backgroundColor: 'rgba(36, 63, 99, 0.25)', // Firefox support
            color: '#1F2937',
          },
        },
      },
    },
    MuiFilledInput: {
      styleOverrides: {
        root: {
          backgroundColor: 'var(--bg-surface)',
          borderRadius: '6px 6px 0 0', // Small radius - structured appearance
          '&:hover': {
            backgroundColor: 'var(--bg-surface)',
          },
          '&.Mui-focused': {
            backgroundColor: 'var(--bg-surface)',
          },
          '&.Mui-disabled': {
            backgroundColor: 'var(--bg-subtle)',
          },
        },
      },
    },
    MuiInput: {
      styleOverrides: {
        root: {
          '&::before': {
            borderBottomColor: 'var(--border-default)',
          },
          '&:hover:not(.Mui-disabled)::before': {
            borderBottomColor: 'var(--border-focus)',
          },
          '&.Mui-focused::after': {
            borderBottomColor: 'var(--color-primary)',
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: '#6B7280', // Readable but subtle
          fontSize: '0.875rem',
          fontWeight: 500,
          marginBottom: '6px', // Clear separation
          '&.Mui-focused': {
            color: '#243F63', // Primary color when focused
          },
          '&.Mui-error': {
            color: '#c41e3a',
          },
          '&.Mui-disabled': {
            color: '#9CA3AF',
          },
        },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: {
          color: 'var(--text-secondary)',
          fontSize: 'var(--font-sm, 0.875rem)',
          fontFamily: 'var(--font-family)',
          fontWeight: 400,
          lineHeight: 1.25,
          marginTop: '4px',
          '&.Mui-error': {
            color: 'var(--color-error)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: '#FFFFFF', // Clean white surface
          borderRadius: '10px', // Medium radius - structured, not soft
          transition: 'box-shadow 0.2s ease-in-out',
          // No border - clean minimal appearance
          border: 'none',
          boxSizing: 'border-box',
          '&.MuiPaper-outlined': {
            borderColor: '#E5E7EB', // Neutral border for outlined variant
            borderWidth: '1px',
            borderStyle: 'solid',
            boxShadow: 'none',
          },
          '&.MuiPaper-elevation': {
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06)', // Soft shadow
          },
          '&.MuiPaper-elevation1': {
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06)',
          },
          '&.MuiPaper-elevation2': {
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.06)', // Soft depth
          },
          '&.MuiPaper-elevation3': {
            boxShadow: '0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.07)',
          },
          '&.error-border': {
            borderColor: '#c41e3a', // Error state border
            borderWidth: '1px',
            borderStyle: 'solid',
          },
        },
      },
      defaultProps: {
        elevation: 0,
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#FFFFFF', // Clean white surface
          borderRadius: '10px', // Medium radius - structured, not soft
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.06)', // Soft shadow
          transition: 'box-shadow 0.2s ease-in-out',
          // No border - clean minimal appearance
          border: 'none',
          boxSizing: 'border-box',
          padding: '24px', // Adequate padding
          '&:hover': {
            boxShadow: '0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.07)',
          },
        },
      },
      defaultProps: {
        elevation: 0,
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 'var(--radius-full, 9999px)',
          backgroundColor: 'var(--bg-subtle)',
          padding: '6px 12px',
          color: 'var(--text-primary)',
          fontWeight: 600,
          fontSize: 'var(--font-sm, 0.875rem)',
          fontFamily: 'var(--font-family)',
          
          '& .MuiChip-label': {
            paddingLeft: '6px',
            paddingRight: '4px',
          },
        },
        deleteIcon: {
          width: '16px',
          height: '16px',
          color: 'var(--text-secondary)',
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          boxShadow: 'var(--shadow-md)',
          borderRadius: '8px', // Medium radius - not overly rounded
        },
      },
    },
    MuiPopover: {
      styleOverrides: {
        paper: {
          borderRadius: '8px', // Medium radius - consistent with menus
        },
      },
    },
    MuiMenuItem: {
      defaultProps: {
        disableRipple: true,
      },
      styleOverrides: {
        root: {
          fontFamily: 'var(--font-family)',
          fontSize: 'var(--font-md, 1rem)',
          fontWeight: 400,
          lineHeight: 1.25,
          padding: '10px 16px',
          minHeight: '40px',
          
          '&:focus, &:focus-visible': {
            outline: 'none',
            boxShadow: 'none !important',
          },

          '&:hover': {
            backgroundColor: 'var(--bg-subtle)',
            boxShadow: 'none !important',
            outline: 'none',
          },
          
          '&.Mui-selected': {
            backgroundColor: 'var(--bg-subtle)',
            '&:hover': {
              backgroundColor: 'var(--bg-subtle) !important',
            },
            '&.Mui-focusVisible': {
              backgroundColor: 'var(--bg-subtle)',
              boxShadow: 'none !important',
            },
          },
        },
      },
    },
    MuiList: {
      styleOverrides: {
        root: {
          padding: 0,
        },
      },
    },
    MuiListItemIcon: {
      styleOverrides: {
        root: {
          minWidth: '32px',
        },
      },
    },
    MuiSvgIcon: {
      styleOverrides: {
        root: {
          width: '20px',
          height: '20px',
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: '#6B7280', // Subtle gray for icon buttons (matches text secondary)
          padding: '10px',
          borderRadius: '4px', // Subtle rounding for hover area
          transition: 'background-color 0.2s ease-in-out, color 0.2s ease-in-out',
          /* Neutral hover — avoid blue tint (SMSIconButton / product preference) */
          '&:hover': {
            backgroundColor: 'rgba(15, 23, 42, 0.06)',
            color: '#374151',
          },
          '&:focus-visible': {
            outline: '2px solid #64748B',
            outlineOffset: '2px',
          },
          '&:active': {
            backgroundColor: 'rgba(15, 23, 42, 0.1)',
          },
          '.MuiInputAdornment-root &': {
            '&:hover': {
              backgroundColor: 'rgba(15, 23, 42, 0.06)',
              color: '#374151',
            },
            '&:active': {
              backgroundColor: 'rgba(15, 23, 42, 0.1)',
            },
          },
        },
        sizeSmall: {
          padding: '2px', // More compact for small inputs
        },
      },
    },
    MuiInputAdornment: {
      styleOverrides: {
        root: {
          // Ensure proper vertical alignment with input
          alignItems: 'center',
          maxHeight: 'none', // Allow natural height matching
        },
        positionStart: {
          // Proper spacing for start adornment (search icons, etc.)
          marginLeft: '12px', // Space from left border
          marginRight: '8px', // Space between icon and input text
        },
        positionEnd: {
          // Proper spacing from right border - matches MUI default behavior
          marginLeft: '8px', // Space between input text and icon
          marginRight: '12px', // Space from right border
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: '10px', // Medium radius - structured, not overly rounded
          boxShadow: 'var(--shadow-xl)',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          padding: 'var(--space-4, 1rem)',
          fontSize: 'var(--font-lg, 1.25rem)',
          fontWeight: 600,
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          padding: 'var(--space-4, 1rem)',
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: 'var(--space-4, 1rem)',
          gap: 'var(--space-2, 0.5rem)',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: 'var(--text-primary)',
          color: 'var(--text-inverse)',
          fontSize: 'var(--font-sm, 0.875rem)',
          padding: 'var(--space-2, 0.5rem) var(--space-3, 0.75rem)',
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: '#C7CFDA', // Clean, visible box when unchecked
          padding: '8px',
          '&:hover': {
            backgroundColor: 'rgba(36, 63, 99, 0.04)',
          },
          '&.Mui-checked': {
            color: '#243F63', // Primary color when checked
            '&:hover': {
              backgroundColor: 'rgba(36, 63, 99, 0.08)',
            },
          },
          '&.Mui-disabled': {
            color: '#E5E7EB',
          },
          '& .MuiSvgIcon-root': {
            fontSize: '22px', // Slightly larger size for better visibility
            width: '22px',
            height: '22px',
          },
        },
      },
    },
    MuiRadio: {
      styleOverrides: {
        root: {
          color: 'var(--border-default)',
          '&.Mui-checked': {
            color: 'var(--color-primary)',
          },
          '&.Mui-disabled': {
            color: 'var(--text-disabled)',
          },
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        root: {
          width: 40,
          height: 20,
          padding: 0,
          '& .MuiSwitch-switchBase': {
            padding: 2,
            color: '#FFFFFF', // White thumb for both states
            '&.Mui-checked': {
              color: '#FFFFFF', // White thumb when checked
              '& + .MuiSwitch-track': {
                opacity: 1,
                backgroundColor: '#243F63', // Primary color track when checked
              },
            },
            '&:not(.Mui-checked)': {
              color: '#FFFFFF', // White thumb when unchecked
              '& + .MuiSwitch-track': {
                opacity: 1,
                backgroundColor: '#E5E7EB', // Light gray track when unchecked
              },
            },
          },
          '& .MuiSwitch-thumb': {
            width: 16,
            height: 16,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12)', // Subtle shadow for depth
          },
          '& .MuiSwitch-track': {
            borderRadius: 10,
            opacity: 1,
            backgroundColor: '#E5E7EB', // Default unchecked track color
            boxSizing: 'border-box',
          },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          fontSize: 'var(--font-md, 1rem)',
          minHeight: '48px',
          '&.Mui-selected': {
            color: 'var(--color-primary)',
          },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          backgroundColor: 'var(--color-primary)',
        },
      },
    },
  },
};

// Create and export the theme
const theme = createTheme(DEFAULT_THEME);

export default theme;

