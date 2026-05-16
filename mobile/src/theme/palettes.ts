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
 * Primary: soft sage for warm CTAs and selected states
 * Secondary: soft rose for matches, notifications, and human moments
 * Backgrounds: deep forest green with restrained, editorial contrast
 */

export const darkPalette: OrbitThemeColors = {
  primary: {
    start:   '#FFF4D7',
    end:     '#D6B978',
    default: '#F1DFAF',
    light:   '#FFF7E3',
    dark:    '#9D7F3F',
  },
  secondary: {
    start:   '#F7A8A1',
    end:     '#B9575A',
    default: '#E47C76',
  },
  background: {
    primary:   '#06130D',
    secondary: '#0B1D14',
    tertiary:  '#11281B',
    card:      '#132D20',
    elevated:  '#1B3929',
  },
  text: {
    primary:   '#FFF6DF',
    secondary: '#D4C5A4',
    tertiary:  '#A29173',
    muted:     '#695F4B',
    accent:    '#F1DFAF',
  },
  success: '#9FD08E',
  warning: '#E0AD55',
  error:   '#FF746D',
  info:    '#8FB8B2',
  border:      'rgba(255,246,223,0.08)',
  borderLight: 'rgba(255,246,223,0.14)',
  overlay:     'rgba(6,19,13,0.92)',
  glass: {
    background: 'rgba(8,29,19,0.90)',
    border:     'rgba(255,246,223,0.12)',
  },
  online:  '#A6D38F',
  offline: '#65725D',
};

export const lightPalette: OrbitThemeColors = {
  primary: {
    start:   '#6FA66F',
    end:     '#1F5B3A',
    default: '#2F7D57',
    light:   '#BFDCC7',
    dark:    '#16422D',
  },
  secondary: {
    start:   '#9BC3A4',
    end:     '#477B58',
    default: '#6EA57B',
  },
  background: {
    primary:   '#EEF3EC',
    secondary: '#DFEAE0',
    tertiary:  '#C9DDCF',
    card:      '#FFFFFF',
    elevated:  '#F8FAF7',
  },
  text: {
    primary:   '#111713',
    secondary: '#3E4F43',
    tertiary:  '#6F7D72',
    muted:     '#A5AEA7',
    accent:    '#1F6B47',
  },
  success: '#2F7D57',
  warning: '#A1762A',
  error:   '#C83F3C',
  info:    '#5F8F86',
  border:      'rgba(17,23,19,0.09)',
  borderLight: 'rgba(17,23,19,0.14)',
  overlay:     'rgba(10,32,22,0.48)',
  glass: {
    background: 'rgba(248,250,247,0.92)',
    border:     'rgba(17,23,19,0.08)',
  },
  online:  '#2F7D57',
  offline: '#97A39A',
};

export const shadowsDark: OrbitShadowSet = {
  sm:   { shadowColor: '#000000', shadowOffset: { width: 0, height: 2  }, shadowOpacity: 0.40, shadowRadius: 8,  elevation: 3  },
  md:   { shadowColor: '#000000', shadowOffset: { width: 0, height: 6  }, shadowOpacity: 0.45, shadowRadius: 16, elevation: 6  },
  lg:   { shadowColor: '#000000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.50, shadowRadius: 28, elevation: 10 },
  glow: { shadowColor: '#F1DFAF', shadowOffset: { width: 0, height: 0  }, shadowOpacity: 0.32, shadowRadius: 22, elevation: 6  },
};

export const shadowsLight: OrbitShadowSet = {
  sm:   { shadowColor: '#5A6648', shadowOffset: { width: 0, height: 2  }, shadowOpacity: 0.06, shadowRadius: 8,  elevation: 2 },
  md:   { shadowColor: '#5A6648', shadowOffset: { width: 0, height: 6  }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 4 },
  lg:   { shadowColor: '#5A6648', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.10, shadowRadius: 28, elevation: 6 },
  glow: { shadowColor: '#6F915F', shadowOffset: { width: 0, height: 0  }, shadowOpacity: 0.18, shadowRadius: 18, elevation: 4 },
};
