import type { ViewStyle } from 'react-native';

export type OrbitThemeColors = {
  primary: {
    start: string;
    end: string;
    default: string;
    light: string;
    dark: string;
  };
  secondary: {
    start: string;
    end: string;
    default: string;
  };
  background: {
    primary: string;
    secondary: string;
    tertiary: string;
    card: string;
    elevated: string;
  };
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    muted: string;
    accent: string;
  };
  success: string;
  warning: string;
  error: string;
  info: string;
  border: string;
  borderLight: string;
  overlay: string;
  glass: {
    background: string;
    border: string;
  };
  online: string;
  offline: string;
};

export type OrbitShadowSet = {
  sm: ViewStyle;
  md: ViewStyle;
  lg: ViewStyle;
  glow: ViewStyle;
};

/*
 * Navy Orbit — derived from the Navy app icon variant.
 * Deep indigo dark mode, purple accent, gold secondary.
 */

export const darkPalette: OrbitThemeColors = {
  primary: {
    start: '#8B7BF2',
    end: '#6C5CE7',
    default: '#7C6BEF',
    light: '#A99AF5',
    dark: '#5B4BD6',
  },
  secondary: {
    start: '#F0C040',
    end: '#E5A820',
    default: '#EDBE44',
  },
  background: {
    primary: '#08061A',
    secondary: '#0E0C24',
    tertiary: '#18163A',
    card: '#110F2A',
    elevated: '#18163A',
  },
  text: {
    primary: '#F0EEFF',
    secondary: '#8F8BB5',
    tertiary: '#5E5A86',
    muted: '#3D3968',
    accent: '#B8AEFF',
  },
  success: '#6EE7B7',
  warning: '#EDBE44',
  error: '#F87171',
  info: '#93C5FD',
  border: 'rgba(140,130,240,0.08)',
  borderLight: 'rgba(140,130,240,0.14)',
  overlay: 'rgba(8,6,26,0.88)',
  glass: {
    background: 'rgba(17,15,42,0.96)',
    border: 'rgba(140,130,240,0.08)',
  },
  online: '#6EE7B7',
  offline: '#5E5A86',
};

export const lightPalette: OrbitThemeColors = {
  primary: {
    start: '#6C5CE7',
    end: '#8B7BF2',
    default: '#6C5CE7',
    light: '#8B7BF2',
    dark: '#5B4BD6',
  },
  secondary: {
    start: '#E5A820',
    end: '#F0C040',
    default: '#D4990A',
  },
  background: {
    primary: '#FFFFFF',
    secondary: '#F9F8FD',
    tertiary: '#F1F0F8',
    card: '#FFFFFF',
    elevated: '#FFFFFF',
  },
  text: {
    primary: '#08061A',
    secondary: '#4A4672',
    tertiary: '#8F8BB5',
    muted: '#C4C1DA',
    accent: '#6C5CE7',
  },
  success: '#059669',
  warning: '#D4990A',
  error: '#DC2626',
  info: '#2563EB',
  border: 'rgba(8,6,26,0.06)',
  borderLight: 'rgba(8,6,26,0.10)',
  overlay: 'rgba(8,6,26,0.4)',
  glass: {
    background: 'rgba(255,255,255,0.94)',
    border: 'rgba(8,6,26,0.06)',
  },
  online: '#059669',
  offline: '#8F8BB5',
};

export const shadowsDark: OrbitShadowSet = {
  sm: { shadowColor: '#040312', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.5, shadowRadius: 3, elevation: 2 },
  md: { shadowColor: '#040312', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 4 },
  lg: { shadowColor: '#040312', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.55, shadowRadius: 16, elevation: 8 },
  glow: { shadowColor: '#7C6BEF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 4 },
};

export const shadowsLight: OrbitShadowSet = {
  sm: { shadowColor: '#08061A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  md: { shadowColor: '#08061A', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  lg: { shadowColor: '#08061A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 4 },
  glow: { shadowColor: '#6C5CE7', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 3 },
};
