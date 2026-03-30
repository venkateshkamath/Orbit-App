/**
 * Plus Jakarta Sans — names match keys in `useFonts` from @expo-google-fonts/plus-jakarta-sans.
 */
export const orbitFontFamily = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
} as const;

export type OrbitFontFamilyMap = typeof orbitFontFamily;

/** Use when fonts failed to load or are not ready — React Native falls back to system UI font. */
export const orbitFontFamilyFallback: Record<keyof OrbitFontFamilyMap, undefined> = {
  regular: undefined,
  medium: undefined,
  semibold: undefined,
  bold: undefined,
};
