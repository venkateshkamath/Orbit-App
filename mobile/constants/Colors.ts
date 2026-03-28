/**
 * ORBIT — modern dark UI: neutral surfaces, single accent
 */

export const Colors = {
  primary: {
    start: '#6D5AE6',
    end: '#6D5AE6',
    default: '#6D5AE6',
    light: '#A5A0F5',
    dark: '#4B3DB8',
  },

  secondary: {
    start: '#3B82F6',
    end: '#3B82F6',
    default: '#60A5FA',
  },

  background: {
    primary: '#0A0A0B',
    secondary: '#0A0A0B',
    tertiary: '#18181B',
    card: '#141416',
    elevated: '#1C1C1F',
  },

  text: {
    primary: '#FAFAFA',
    secondary: '#A1A1AA',
    tertiary: '#71717A',
    muted: '#52525B',
    accent: '#A5A0F5',
  },

  success: '#4ADE80',
  warning: '#FBBF24',
  error: '#F87171',
  info: '#38BDF8',

  border: 'rgba(255,255,255,0.08)',
  borderLight: 'rgba(255,255,255,0.12)',
  overlay: 'rgba(10, 10, 11, 0.92)',

  glass: {
    background: 'rgba(28, 28, 31, 0.72)',
    border: 'rgba(255,255,255,0.1)',
  },

  online: '#4ADE80',
  offline: '#71717A',
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
  xl: 20,
  full: 9999,
};

export const FontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 30,
  display: 36,
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
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
  glow: {
    shadowColor: '#6D5AE6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 4,
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
