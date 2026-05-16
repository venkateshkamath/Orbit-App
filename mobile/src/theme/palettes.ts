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
 * Orbit — premium proximity social
 * Primary: electric violet (brand, CTAs, active states)
 * Secondary: electric cyan (nearby, online, active presence — spatial, not romantic)
 * Backgrounds: deep space navy with blue tint, not flat black
 */

export const darkPalette: OrbitThemeColors = {
  primary: {
    start: '#A090FF',
    end:   '#6248EC',
    default: '#8875FF',
    light:   '#C0B4FF',
    dark:    '#5540D6',
  },
  secondary: {
    start:   '#5EE8FB',
    end:     '#00A8C8',
    default: '#22D4F5',
  },
  background: {
    primary:   '#08090F',
    secondary: '#0D0E1A',
    tertiary:  '#121420',
    card:      '#131525',
    elevated:  '#181A2C',
  },
  text: {
    primary:   '#EDEEFF',
    secondary: '#8891B0',
    tertiary:  '#5A6080',
    muted:     '#3A4060',
    accent:    '#C0B4FF',
  },
  success: '#1ECC8C',
  warning: '#F5B731',
  error:   '#FF4757',
  info:    '#22D4F5',
  border:      'rgba(255,255,255,0.06)',
  borderLight: 'rgba(255,255,255,0.10)',
  overlay:     'rgba(4,5,12,0.90)',
  glass: {
    background: 'rgba(13,14,26,0.94)',
    border:     'rgba(255,255,255,0.08)',
  },
  online:  '#22D4F5',
  offline: '#5A6080',
};

export const lightPalette: OrbitThemeColors = {
  primary: {
    start:   '#7462FF',
    end:     '#4935D6',
    default: '#5B47EF',
    light:   '#8B7CF8',
    dark:    '#3D28C4',
  },
  secondary: {
    start:   '#00B4E0',
    end:     '#0080AA',
    default: '#0096C7',
  },
  background: {
    primary:   '#F6F7FB',
    secondary: '#EDEEF6',
    tertiary:  '#E4E5F0',
    card:      '#FFFFFF',
    elevated:  '#FFFFFF',
  },
  text: {
    primary:   '#0A0B1A',
    secondary: '#4A5070',
    tertiary:  '#6B7090',
    muted:     '#9BA0C0',
    accent:    '#5B47EF',
  },
  success: '#0A9B6D',
  warning: '#D97706',
  error:   '#E8294A',
  info:    '#0096C7',
  border:      'rgba(10,11,26,0.07)',
  borderLight: 'rgba(10,11,26,0.10)',
  overlay:     'rgba(10,11,26,0.50)',
  glass: {
    background: 'rgba(255,255,255,0.94)',
    border:     'rgba(10,11,26,0.07)',
  },
  online:  '#0096C7',
  offline: '#9BA0C0',
};

export const shadowsDark: OrbitShadowSet = {
  sm:   { shadowColor: '#000000', shadowOffset: { width: 0, height: 2  }, shadowOpacity: 0.40, shadowRadius: 8,  elevation: 3  },
  md:   { shadowColor: '#000000', shadowOffset: { width: 0, height: 6  }, shadowOpacity: 0.45, shadowRadius: 16, elevation: 6  },
  lg:   { shadowColor: '#000000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.50, shadowRadius: 28, elevation: 10 },
  glow: { shadowColor: '#8875FF', shadowOffset: { width: 0, height: 0  }, shadowOpacity: 0.45, shadowRadius: 20, elevation: 6  },
};

export const shadowsLight: OrbitShadowSet = {
  sm:   { shadowColor: '#1A1A3A', shadowOffset: { width: 0, height: 2  }, shadowOpacity: 0.06, shadowRadius: 8,  elevation: 2 },
  md:   { shadowColor: '#1A1A3A', shadowOffset: { width: 0, height: 6  }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 4 },
  lg:   { shadowColor: '#1A1A3A', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.10, shadowRadius: 28, elevation: 6 },
  glow: { shadowColor: '#5B47EF', shadowOffset: { width: 0, height: 0  }, shadowOpacity: 0.25, shadowRadius: 18, elevation: 4 },
};
