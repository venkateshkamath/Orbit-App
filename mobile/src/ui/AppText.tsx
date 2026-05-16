import React from 'react';
import { Platform, StyleSheet, Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { useOrbitTheme } from '../theme';

/**
 * Default text primitive — applies theme body font so typography is consistent app-wide.
 * Pass `style` with `fontFamily` from `useOrbitTheme().fonts.*` to override weight.
 */
export function AppText({ style, ...props }: TextProps) {
  const { fonts } = useOrbitTheme();
  const flattened = (StyleSheet.flatten(style) ?? {}) as TextStyle;

  const mapWeightToFamily = (weight: TextStyle['fontWeight']) => {
    if (weight == null) return undefined;
    if (weight === 'normal') return fonts.regular;
    if (weight === 'bold') return fonts.bold;

    const parsed = typeof weight === 'string' ? Number.parseInt(weight, 10) : weight;
    if (typeof parsed === 'number' && Number.isFinite(parsed)) {
      if (parsed >= 800) return fonts.extrabold;
      if (parsed >= 700) return fonts.bold;
      if (parsed >= 600) return fonts.semibold;
      if (parsed >= 500) return fonts.medium;
      return fonts.regular;
    }
    return undefined;
  };

  const explicitFamily = flattened.fontFamily;
  const resolvedFamily = explicitFamily ?? mapWeightToFamily(flattened.fontWeight) ?? fonts.regular;
  const shouldStripWeight = Platform.OS === 'android' && Boolean(resolvedFamily);

  const normalizedStyle: TextStyle = {
    ...flattened,
    ...(resolvedFamily ? { fontFamily: resolvedFamily } : null),
    ...(shouldStripWeight ? { fontWeight: undefined } : null),
  };

  return <RNText {...props} style={normalizedStyle} />;
}
