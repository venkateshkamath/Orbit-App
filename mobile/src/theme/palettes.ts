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
 * Orbit — social / discovery product colors:
 * - Primary: indigo-violet (brand, CTAs, links, map accents)
 * - Secondary: warm coral (hearts, “new”, tab pings — attention, not errors)
 * - Success / online: teal (positive state, separate from coral)
 * - Backgrounds: neutral slate so photos, map, avatars stay the hero
 */

export const darkPalette: OrbitThemeColors = {
  primary: {
    start: '#A5A8FC',
    end: '#6D73F5',
    default: '#8188FA',
    light: '#C7CAFE',
    dark: '#555CD6',
  },
  secondary: {
    start: '#FDA4AF',
    end: '#FB7185',
    default: '#FF9F8A',
  },
  background: {
    primary: '#0B0D12',
    secondary: '#12151C',
    tertiary: '#1A1F2A',
    card: '#161B24',
    elevated: '#1E2430',
  },
  text: {
    primary: '#F4F6FB',
    secondary: '#9BA3B4',
    tertiary: '#6B7280',
    muted: '#4B5563',
    accent: '#C7CAFE',
  },
  success: '#34D399',
  warning: '#FBBF24',
  error: '#F43F5E',
  info: '#7DD3FC',
  border: 'rgba(255,255,255,0.06)',
  borderLight: 'rgba(255,255,255,0.10)',
  overlay: 'rgba(6,8,12,0.88)',
  glass: {
    background: 'rgba(22,27,36,0.92)',
    border: 'rgba(255,255,255,0.08)',
  },
  online: '#34D399',
  offline: '#6B7280',
};

export const lightPalette: OrbitThemeColors = {
  primary: {
    start: '#6366F1',
    end: '#7C3AED',
    default: '#6D5AE8',
    light: '#8B7FF5',
    dark: '#5B21B6',
  },
  secondary: {
    start: '#FDA4AF',
    end: '#F43F5E',
    default: '#FB7185',
  },
  background: {
    primary: '#EEF2FA',
    secondary: '#E4EAF6',
    tertiary: '#DCE4F2',
    card: '#FFFFFF',
    elevated: '#FFFFFF',
  },
  text: {
    primary: '#0F172A',
    secondary: '#475569',
    tertiary: '#64748B',
    muted: '#94A3B8',
    accent: '#6D5AE8',
  },
  success: '#059669',
  warning: '#D97706',
  error: '#E11D48',
  info: '#2563EB',
  border: 'rgba(15,23,42,0.06)',
  borderLight: 'rgba(15,23,42,0.09)',
  overlay: 'rgba(15,23,42,0.45)',
  glass: {
    background: 'rgba(255,255,255,0.92)',
    border: 'rgba(15,23,42,0.06)',
  },
  online: '#059669',
  offline: '#94A3B8',
};

export const shadowsDark: OrbitShadowSet = {
  sm: { shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 6, elevation: 3 },
  md: { shadowColor: '#000000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 6 },
  lg: { shadowColor: '#000000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.45, shadowRadius: 24, elevation: 10 },
  glow: { shadowColor: '#8188FA', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 18, elevation: 5 },
};

export const shadowsLight: OrbitShadowSet = {
  sm: { shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 },
  md: { shadowColor: '#64748B', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.09, shadowRadius: 16, elevation: 4 },
  lg: { shadowColor: '#64748B', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.11, shadowRadius: 28, elevation: 6 },
  glow: { shadowColor: '#6D5AE8', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 4 },
};
