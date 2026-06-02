/**
 * GlassCard — simple elevated card surface
 */

import React, { useMemo } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { BorderRadius, Spacing } from '../../constants/Colors';
import { useOrbitTheme } from '../theme';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: number;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  style,
  padding = Spacing.md,
}) => {
  const { colors, shadows } = useOrbitTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          borderRadius: BorderRadius.lg,
          backgroundColor: colors.background.card,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.borderLight,
          ...shadows.sm,
        },
      }),
    [colors, shadows]
  );

  return (
    <View style={[styles.container, { padding }, style]}>
      {children}
    </View>
  );
};

export default GlassCard;
