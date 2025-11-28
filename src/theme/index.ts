/**
 * FlynnAI Theme Configuration
 * Centralized design tokens for consistent UI
 */

// Color Palette
export const colors = {
  // Brand Colors
  primary: '#ff4500', // International Orange
  primaryDark: '#ea3e00',
  primaryLight: '#ffe4e6',

  // Neutral Colors (Grays)
  secondary: '#64748B',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',

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
  background: '#F3F4F6',
  backgroundSecondary: '#FFFFFF',
  backgroundTertiary: '#E5E7EB',

  // Text variations
  textPrimary: '#111827',
  textSecondary: '#4B5563',
  textTertiary: '#9CA3AF',
  textPlaceholder: '#9CA3AF',
  textInverse: '#FFFFFF',

  // Border colors
  border: '#000000',
  borderFocus: '#ff4500',
  borderError: '#EF4444',
} as const;

// Typography Scale
export const typography = {
  // Display styles
  displayLarge: {
    fontSize: 48,
    lineHeight: 56,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700' as const,
  },
  displayMedium: {
    fontSize: 36,
    lineHeight: 44,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700' as const,
  },

  // Header styles
  h1: {
    fontSize: 30,
    lineHeight: 36,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700' as const,
  },
  h2: {
    fontSize: 24,
    lineHeight: 32,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700' as const,
  },
  h3: {
    fontSize: 20,
    lineHeight: 28,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontWeight: '600' as const,
  },
  h4: {
    fontSize: 18,
    lineHeight: 24,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontWeight: '600' as const,
  },

  // Body styles
  bodyLarge: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'Inter_400Regular',
    fontWeight: '400' as const,
  },
  bodyMedium: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
    fontWeight: '400' as const,
  },
  bodySmall: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Inter_400Regular',
    fontWeight: '400' as const,
  },

  // Specialty styles
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500' as const,
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500' as const,
  },
  button: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  overline: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700' as const,
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

// Border Radius - Brutalist style uses less rounding or specific rounding
export const borderRadius = {
  none: 0,
  xs: 2,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  xxl: 16,
  full: 9999,
} as const;

// Shadows - Hard shadows for brutalist look
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
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 1,
  },
  sm: {
    shadowColor: colors.black,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  md: {
    shadowColor: colors.black,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  lg: {
    shadowColor: colors.black,
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
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
  buttonHeight: 56, // Larger touch target for brutalist buttons
  inputHeight: 52,
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