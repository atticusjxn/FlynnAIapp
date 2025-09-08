/**
 * FlynnAI Theme Configuration
 * Centralized design tokens for consistent UI
 */

// Color Palette
export const colors = {
  // Brand Colors
  primary: '#2563EB',
  primaryDark: '#1E40AF',
  primaryLight: '#DBEAFE',
  
  // Neutral Colors (Grays)
  secondary: '#64748B',
  gray50: '#F8FAFC',
  gray100: '#F1F5F9',
  gray200: '#E2E8F0',
  gray300: '#CBD5E1',
  gray400: '#94A3B8',
  gray500: '#64748B',
  gray600: '#475569',
  gray700: '#334155',
  gray800: '#1E293B',
  gray900: '#0F172A',
  
  // Semantic Colors
  success: '#10B981',
  successLight: '#D1FAE5',
  successDark: '#047857',
  
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  warningDark: '#D97706',
  
  error: '#EF4444',
  errorLight: '#FEE2E2',
  errorDark: '#DC2626',
  
  // UI Colors
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
  
  // Background variations
  background: '#FFFFFF',
  backgroundSecondary: '#F8FAFC',
  backgroundTertiary: '#F1F5F9',
  
  // Text variations
  textPrimary: '#1E293B',
  textSecondary: '#475569',
  textTertiary: '#64748B',
  textPlaceholder: '#94A3B8',
  textInverse: '#FFFFFF',
  
  // Border colors
  border: '#E2E8F0',
  borderFocus: '#2563EB',
  borderError: '#EF4444',
} as const;

// Typography Scale
export const typography = {
  // Display styles
  displayLarge: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700' as const,
  },
  displayMedium: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700' as const,
  },
  
  // Header styles
  h1: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700' as const,
  },
  h2: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600' as const,
  },
  h3: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600' as const,
  },
  h4: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600' as const,
  },
  
  // Body styles
  bodyLarge: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400' as const,
  },
  bodyMedium: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400' as const,
  },
  bodySmall: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400' as const,
  },
  
  // Specialty styles
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500' as const,
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500' as const,
  },
  button: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600' as const,
  },
  overline: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
} as const;

// Spacing System (4px base unit)
export const spacing = {
  xxxs: 2,
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

// Border Radius
export const borderRadius = {
  none: 0,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  full: 9999,
} as const;

// Shadows
export const shadows = {
  none: {
    shadowColor: colors.transparent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  xs: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sm: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

// Animation Durations
export const animations = {
  fast: 150,
  normal: 300,
  slow: 500,
} as const;

// Opacity levels
export const opacity = {
  disabled: 0.4,
  pressed: 0.8,
  overlay: 0.5,
  hover: 0.9,
} as const;

// Z-Index scale
export const zIndex = {
  hide: -1,
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  modal: 1300,
  popover: 1400,
  tooltip: 1500,
  toast: 1600,
} as const;

// Layout constants
export const layout = {
  headerHeight: 60,
  tabBarHeight: 80,
  buttonHeight: 44, // iOS minimum touch target
  inputHeight: 48,
  avatarSizeSmall: 24,
  avatarSizeMedium: 40,
  avatarSizeLarge: 64,
} as const;

// Export combined theme
export const theme = {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  animations,
  opacity,
  zIndex,
  layout,
} as const;

export default theme;