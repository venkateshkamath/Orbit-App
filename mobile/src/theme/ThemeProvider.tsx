import React, { createContext, useContext, useMemo } from 'react';
import { View, StyleSheet, useColorScheme } from 'react-native';
import {
  darkPalette,
  lightPalette,
  shadowsDark,
  shadowsLight,
  type OrbitShadowSet,
  type OrbitThemeColors,
} from './palettes';
import { useThemeStore, type ThemePreference } from '../stores/themeStore';

export type OrbitThemeContextValue = {
  colors: OrbitThemeColors;
  shadows: OrbitShadowSet;
  resolvedScheme: 'light' | 'dark';
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
};

const ThemeContext = createContext<OrbitThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);
  const systemScheme = useColorScheme();

  const resolvedScheme: 'light' | 'dark' =
    preference === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : preference;

  const value = useMemo<OrbitThemeContextValue>(() => {
    const colors = resolvedScheme === 'dark' ? darkPalette : lightPalette;
    const shadows = resolvedScheme === 'dark' ? shadowsDark : shadowsLight;
    return {
      colors,
      shadows,
      resolvedScheme,
      preference,
      setPreference,
    };
  }, [resolvedScheme, preference, setPreference]);

  return (
    <ThemeContext.Provider value={value}>
      <View style={[styles.root, { backgroundColor: value.colors.background.primary }]}>{children}</View>
    </ThemeContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

export function useOrbitTheme(): OrbitThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useOrbitTheme must be used within ThemeProvider');
  }
  return ctx;
}
