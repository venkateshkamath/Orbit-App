import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { View, StyleSheet, useColorScheme } from 'react-native';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import * as SplashScreen from 'expo-splash-screen';
import {
  darkPalette,
  lightPalette,
  shadowsDark,
  shadowsLight,
  type OrbitShadowSet,
  type OrbitThemeColors,
} from './palettes';
import { useThemeStore, type ThemePreference } from '../stores/themeStore';
import { orbitFontFamily, orbitFontFamilyFallback, type OrbitFontFamilyMap } from './typography';

void SplashScreen.preventAutoHideAsync().catch(() => {});

function resolveActiveScheme(): 'light' | 'dark' {
  return 'light';
}

export type OrbitThemeContextValue = {
  colors: OrbitThemeColors;
  shadows: OrbitShadowSet;
  resolvedScheme: 'light' | 'dark';
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
  /** Custom UI font when loaded; otherwise `undefined` entries (system default). */
  fonts: OrbitFontFamilyMap | typeof orbitFontFamilyFallback;
  fontsReady: boolean;
};

const ThemeContext = createContext<OrbitThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);
  useColorScheme();

  const resolvedScheme = resolveActiveScheme();

  const fonts = useMemo(
    () => (fontsLoaded && !fontError ? orbitFontFamily : orbitFontFamilyFallback),
    [fontsLoaded, fontError]
  );

  const fontsReady = fontsLoaded && !fontError;

  const value = useMemo<OrbitThemeContextValue>(() => {
    const colors = resolvedScheme === 'dark' ? darkPalette : lightPalette;
    const shadows = resolvedScheme === 'dark' ? shadowsDark : shadowsLight;
    return {
      colors,
      shadows,
      resolvedScheme,
      preference,
      setPreference,
      fonts,
      fontsReady,
    };
  }, [resolvedScheme, preference, setPreference, fonts, fontsReady]);

  if (!fontsLoaded && !fontError) {
    return <View style={[styles.boot, { backgroundColor: lightPalette.background.primary }]} />;
  }

  return (
    <ThemeContext.Provider value={value}>
      <View style={[styles.root, { backgroundColor: value.colors.background.primary }]}>{children}</View>
    </ThemeContext.Provider>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
  },
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
