/**
 * GlassCard - Glassmorphism styled card component
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors, BorderRadius, Spacing, Shadows } from '../../constants/Colors';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
  padding?: number;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  style,
  intensity = 20,
  padding = Spacing.md,
}) => {
  return (
    <View style={[styles.container, { padding }, style]}>
      <View style={styles.background} />
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.glass.border,
    ...Shadows.md,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.glass.background,
  },
});

export default GlassCard;
