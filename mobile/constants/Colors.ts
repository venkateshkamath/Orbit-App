/**
 * MindLink Design System
 * Premium dark theme with vibrant accents
 */

export const Colors = {
  // Primary gradient colors - Sophisticated sage/mint green
  primary: {
    start: '#34D399', // Soft emerald
    end: '#10B981',   // Rich emerald
    default: '#22C55E',
    light: '#6EE7B7',
    dark: '#059669',
  },
  
  // Secondary accent - Complementary teal
  secondary: {
    start: '#5EEAD4',
    end: '#2DD4BF',
    default: '#14B8A6',
  },
  
  // Background colors (warm whites with subtle green tint)
  background: {
    primary: '#FDFFFE',      // Slightly warm white
    secondary: '#F8FAF9',    // Very subtle green tint
    tertiary: '#F0F4F3',     // Soft sage background
    card: '#FFFFFF',
    elevated: '#FFFFFF',
  },
  
  // Text colors (warm grays that complement green)
  text: {
    primary: '#1F2937',      // Warm dark gray
    secondary: '#6B7280',    // Medium gray
    tertiary: '#9CA3AF',     // Light gray
    muted: '#D1D5DB',        // Very light gray
    accent: '#059669',       // Green for emphasis
  },
  
  // Status colors
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
  
  // UI elements
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  overlay: 'rgba(0, 0, 0, 0.4)',
  
  // Glass effect
  glass: {
    background: 'rgba(255, 255, 255, 0.95)',
    border: 'rgba(16, 185, 129, 0.1)',
  },
  
  // Online status
  online: '#22C55E',
  offline: '#9CA3AF',
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
