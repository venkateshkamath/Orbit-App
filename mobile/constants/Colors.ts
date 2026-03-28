/**
 * ORBIT Design System
 * Human, ambient dark theme with soft aurora accents
 */

export const Colors = {
  // Primary gradient colors - violet → soft teal
  primary: {
    start: '#8B5CF6', // Soft violet
    end: '#22C1C3',   // Teal
    default: '#A855F7',
    light: '#D8B4FE',
    dark: '#4C1D95',
  },

  // Secondary accent - warm orbit orange
  secondary: {
    start: '#F97316',
    end: '#FACC15',
    default: '#FB923C',
  },

  // Background colors - soft charcoal, not pure black
  background: {
    primary: '#050816',   // Charcoal with slight blue
    secondary: '#050816',
    tertiary: '#0B1120',  // Deep navy
    card: '#0F172A',
    elevated: '#111827',  // Slightly lifted
  },

  // Text colors - high contrast but gentle
  text: {
    primary: '#F9FAFB',      // Almost white
    secondary: '#D1D5DB',    // Mid gray
    tertiary: '#9CA3AF',     // Muted gray
    muted: '#6B7280',        // Very muted
    accent: '#22C1C3',       // Teal accent
  },

  // Status colors
  success: '#4ADE80',
  warning: '#FACC15',
  error: '#F97373',
  info:   '#38BDF8',

  // UI elements
  border: '#1F2937',
  borderLight: '#111827',
  overlay: 'rgba(15, 23, 42, 0.85)',

  // Glass effect
  glass: {
    background: 'rgba(15, 23, 42, 0.7)',
    border: 'rgba(148, 163, 184, 0.4)',
  },

  // Online status
  online: '#22C55E',
  offline: '#6B7280',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const FontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  display: 40,
};

export const FontWeights = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  glow: {
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
};

export default {
  Colors,
  Spacing,
  BorderRadius,
  FontSizes,
  FontWeights,
  Shadows,
};
