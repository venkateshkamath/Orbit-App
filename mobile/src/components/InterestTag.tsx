/**
 * InterestTag - Animated interest chip component
 */

import React, { useMemo } from 'react';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { BorderRadius, FontSizes, Spacing } from '../../constants/Colors';
import { useOrbitTheme } from '../theme';
import { AppText } from '../ui/AppText';
import { Interest } from '../types';

interface InterestTagProps {
  interest: Interest;
  selected?: boolean;
  onPress?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export const InterestTag: React.FC<InterestTagProps> = ({
  interest,
  selected = false,
  onPress,
  size = 'md',
}) => {
  const { colors } = useOrbitTheme();
  const scale = useSharedValue(1);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: BorderRadius.full,
          borderWidth: StyleSheet.hairlineWidth,
          marginRight: Spacing.sm,
          marginBottom: Spacing.sm,
        },
        emoji: {
          marginRight: Spacing.xs,
        },
        text: {
          color: colors.text.secondary,
          fontWeight: '500',
        },
        checkmark: {
          width: 18,
          height: 18,
          borderRadius: 9,
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: Spacing.xs,
        },
        checkmarkText: {
          color: '#FFFFFF',
          fontSize: 10,
          fontWeight: 'bold',
        },
      }),
    [colors]
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const sizeStyles = {
    sm: {
      paddingVertical: Spacing.xs,
      paddingHorizontal: Spacing.sm,
      fontSize: FontSizes.xs,
    },
    md: {
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      fontSize: FontSizes.sm,
    },
    lg: {
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      fontSize: FontSizes.md,
    },
  };

  return (
    <AnimatedTouchable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={!onPress}
      style={[
        animatedStyle,
        styles.container,
        {
          paddingVertical: sizeStyles[size].paddingVertical,
          paddingHorizontal: sizeStyles[size].paddingHorizontal,
          backgroundColor: selected ? interest.color + '30' : colors.background.tertiary,
          borderColor: selected ? interest.color + '80' : colors.border,
        },
      ]}
      activeOpacity={0.85}
    >
      <AppText style={styles.emoji}>{interest.emoji}</AppText>
      <AppText
        style={[
          styles.text,
          { fontSize: sizeStyles[size].fontSize },
          selected && { color: interest.color },
        ]}
      >
        {interest.name}
      </AppText>
      {selected && (
        <View style={[styles.checkmark, { backgroundColor: interest.color }]}>
          <AppText style={styles.checkmarkText}>✓</AppText>
        </View>
      )}
    </AnimatedTouchable>
  );
};

export default InterestTag;
