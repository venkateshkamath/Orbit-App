/**
 * InterestTag - Animated interest chip component
 */

import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Colors, BorderRadius, FontSizes, Spacing } from '../../constants/Colors';
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
  const scale = useSharedValue(1);

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
          backgroundColor: selected ? interest.color + '30' : Colors.background.tertiary,
          borderColor: selected ? interest.color + '80' : Colors.border,
        },
      ]}
      activeOpacity={0.85}
    >
      <Text style={styles.emoji}>{interest.emoji}</Text>
      <Text
        style={[
          styles.text,
          { fontSize: sizeStyles[size].fontSize },
          selected && { color: interest.color },
        ]}
      >
        {interest.name}
      </Text>
      {selected && (
        <View style={[styles.checkmark, { backgroundColor: interest.color }]}>
          <Text style={styles.checkmarkText}>✓</Text>
        </View>
      )}
    </AnimatedTouchable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginRight: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  emoji: {
    marginRight: Spacing.xs,
  },
  text: {
    color: Colors.text.secondary,
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
    color: Colors.text.primary,
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default InterestTag;
