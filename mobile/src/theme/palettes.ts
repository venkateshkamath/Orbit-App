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
 * Primary: orbit cyan-blue for CTAs, selection, and map energy
 * Secondary: bright sky blue for depth and human moments
 * Backgrounds: clean, high-contrast neutrals with frosted surfaces
 */

export const darkPalette: OrbitThemeColors = {
  primary: {
    start:   '#48CAE4',
    end:     '#0077B6',
    default: '#00B4D8',
    light:   '#90E0EF',
    dark:    '#023E8A',
  },
  secondary: {
    start:   '#ADE8F4',
    end:     '#0096C7',
    default: '#48CAE4',
  },
  background: {
    primary:   '#05080D',
    secondary: '#0B111A',
    tertiary:  '#101927',
    card:      '#121D2B',
    elevated:  '#182536',
  },
  text: {
    primary:   '#F7FBFF',
    secondary: '#C9D6E2',
    tertiary:  '#8EA0AF',
    muted:     '#5F7180',
    accent:    '#00B4D8',
  },
  success: '#22C55E',
  warning: '#F59E0B',
  error:   '#EF4444',
  info:    '#00B4D8',
  border:      'rgba(247,251,255,0.08)',
  borderLight: 'rgba(247,251,255,0.14)',
  overlay:     'rgba(5,8,13,0.72)',
  glass: {
    background: 'rgba(11,17,26,0.90)',
    border:     'rgba(247,251,255,0.12)',
  },
  online:  '#22C55E',
  offline: '#64748B',
};

export const lightPalette: OrbitThemeColors = {
  primary: {
    start:   '#48CAE4',
    end:     '#0077B6',
    default: '#00B4D8',
    light:   '#CAF0F8',
    dark:    '#0077B6',
  },
  secondary: {
    start:   '#ADE8F4',
    end:     '#0096C7',
    default: '#48CAE4',
  },
  background: {
    primary:   '#F6FBFF',
    secondary: '#EAF6FB',
    tertiary:  '#DDF0F7',
    card:      '#FFFFFF',
    elevated:  '#FFFFFF',
  },
  text: {
    primary:   '#0D0D0D',
    secondary: '#3A4A55',
    tertiary:  '#687A86',
    muted:     '#A7B4BD',
    accent:    '#00B4D8',
  },
  success: '#22C55E',
  warning: '#F59E0B',
  error:   '#EF4444',
  info:    '#00B4D8',
  border:      'rgba(13,13,13,0.08)',
  borderLight: 'rgba(13,13,13,0.14)',
  overlay:     'rgba(13,13,13,0.32)',
  glass: {
    background: 'rgba(255,255,255,0.88)',
    border:     'rgba(13,13,13,0.08)',
  },
  online:  '#22C55E',
  offline: '#94A3B8',
};

export const shadowsDark: OrbitShadowSet = {
  sm:   { shadowColor: '#000000', shadowOffset: { width: 0, height: 2  }, shadowOpacity: 0.40, shadowRadius: 8,  elevation: 3  },
  md:   { shadowColor: '#000000', shadowOffset: { width: 0, height: 6  }, shadowOpacity: 0.45, shadowRadius: 16, elevation: 6  },
  lg:   { shadowColor: '#000000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.50, shadowRadius: 28, elevation: 10 },
  glow: { shadowColor: '#00B4D8', shadowOffset: { width: 0, height: 0  }, shadowOpacity: 0.32, shadowRadius: 22, elevation: 6  },
};

export const shadowsLight: OrbitShadowSet = {
  sm:   { shadowColor: '#0B5F78', shadowOffset: { width: 0, height: 2  }, shadowOpacity: 0.06, shadowRadius: 8,  elevation: 2 },
  md:   { shadowColor: '#0B5F78', shadowOffset: { width: 0, height: 6  }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 4 },
  lg:   { shadowColor: '#0B5F78', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.10, shadowRadius: 28, elevation: 6 },
  glow: { shadowColor: '#00B4D8', shadowOffset: { width: 0, height: 0  }, shadowOpacity: 0.22, shadowRadius: 18, elevation: 4 },
};
