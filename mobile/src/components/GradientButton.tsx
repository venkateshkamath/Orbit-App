/**
 * GradientButton - Premium animated button with gradient
 */

import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Colors, BorderRadius, FontSizes, FontWeights, Spacing, Shadows } from '../../constants/Colors';

interface GradientButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export const GradientButton: React.FC<GradientButtonProps> = ({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  size = 'md',
  icon,
  style,
  textStyle,
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const sizeStyles = {
    sm: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
    md: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg },
    lg: { paddingVertical: Spacing.lg, paddingHorizontal: Spacing.xl },
  };

  const textSizes = {
    sm: FontSizes.sm,
    md: FontSizes.md,
    lg: FontSizes.lg,
  };

  const gradientColors = {
    primary: [Colors.primary.start, Colors.primary.end] as const,
    secondary: [Colors.secondary.start, Colors.secondary.end] as const,
    outline: ['transparent', 'transparent'] as const,
  };

  if (variant === 'outline') {
    return (
      <AnimatedTouchable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        style={[
          animatedStyle,
          styles.outlineButton,
          sizeStyles[size],
          disabled && styles.disabled,
          style,
        ]}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color={Colors.primary.default} />
        ) : (
          <>
            {icon}
            <Text
              style={[
                styles.outlineText,
                { fontSize: textSizes[size] },
                textStyle,
              ]}
            >
              {title}
            </Text>
          </>
        )}
      </AnimatedTouchable>
    );
  }

  return (
    <AnimatedTouchable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      style={[animatedStyle, disabled && styles.disabled, style]}
      activeOpacity={0.9}
    >
      <LinearGradient
        colors={gradientColors[variant]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.gradient, sizeStyles[size]]}
      >
        {loading ? (
          <ActivityIndicator color={Colors.text.primary} />
        ) : (
          <>
            {icon}
            <Text
              style={[
                styles.text,
                { fontSize: textSizes[size] },
                icon && { marginLeft: Spacing.sm },
                textStyle,
              ]}
            >
              {title}
            </Text>
          </>
        )}
      </LinearGradient>
    </AnimatedTouchable>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.lg,
    ...Shadows.md,
  },
  text: {
    color: Colors.text.primary,
    fontWeight: FontWeights.semibold,
    textAlign: 'center',
  },
  outlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.primary.default,
    backgroundColor: 'transparent',
  },
  outlineText: {
    color: Colors.primary.default,
    fontWeight: FontWeights.semibold,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
});

export default GradientButton;
