/**
 * GradientButton — primary CTA uses brand gradient; refined outline & secondary
 */

import React, { useMemo } from 'react';
import {
  TouchableOpacity,
  View,
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
import { BorderRadius, FontSizes, FontWeights, Spacing } from '../../constants/Colors';
import { useOrbitTheme } from '../theme';
import { AppText } from '../ui/AppText';

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
  const { colors } = useOrbitTheme();
  const scale = useSharedValue(1);
  const primaryTextColor = colors.text.primary;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        radiusClip: {
          borderRadius: BorderRadius.lg,
          overflow: 'hidden',
        },
        gradientFill: {
          ...StyleSheet.absoluteFillObject,
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1,
        },
        text: {
          color: primaryTextColor,
          fontWeight: FontWeights.semibold,
          textAlign: 'center',
          letterSpacing: 0,
        },
        secondaryShell: {
          borderRadius: BorderRadius.lg,
          backgroundColor: colors.background.elevated,
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderColor: colors.borderLight,
        },
        secondaryText: {
          color: colors.text.primary,
        },
        outlineButton: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: BorderRadius.lg,
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderColor: colors.primary.default,
          backgroundColor: 'transparent',
        },
        outlineText: {
          color: colors.primary.default,
          fontWeight: FontWeights.semibold,
          textAlign: 'center',
          letterSpacing: 0.15,
        },
        disabled: {
          opacity: 0.48,
        },
      }),
    [colors, primaryTextColor]
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const sizeStyles = {
    sm: { paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.md },
    md: { paddingVertical: Spacing.md + 2, paddingHorizontal: Spacing.lg },
    lg: { paddingVertical: Spacing.lg, paddingHorizontal: Spacing.xl },
  };

  const textSizes = {
    sm: FontSizes.sm,
    md: FontSizes.md,
    lg: FontSizes.lg,
  };

  const textIconSpacing = icon != null ? { marginLeft: Spacing.sm } : undefined;

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
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color={colors.primary.default} />
        ) : (
          <>
            {icon}
            <AppText
              style={[
                styles.outlineText,
                { fontSize: textSizes[size] },
                textIconSpacing,
                textStyle,
              ]}
            >
              {title}
            </AppText>
          </>
        )}
      </AnimatedTouchable>
    );
  }

  if (variant === 'secondary') {
    return (
      <AnimatedTouchable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        style={[animatedStyle, disabled && styles.disabled, style]}
        activeOpacity={0.9}
      >
        <View style={[styles.secondaryShell, sizeStyles[size], styles.row]}>
          {loading ? (
            <ActivityIndicator color={colors.text.primary} />
          ) : (
            <>
              {icon}
              <AppText
                style={[
                  styles.text,
                  styles.secondaryText,
                  { fontSize: textSizes[size] },
                  textIconSpacing,
                  textStyle,
                ]}
              >
                {title}
              </AppText>
            </>
          )}
        </View>
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
      activeOpacity={0.92}
    >
      <View style={styles.radiusClip}>
        <LinearGradient
          colors={[colors.primary.start, colors.primary.end]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientFill}
        />
        <View style={[styles.row, sizeStyles[size]]}>
          {loading ? (
            <ActivityIndicator color={primaryTextColor} />
          ) : (
            <>
              {icon}
              <AppText style={[styles.text, { fontSize: textSizes[size] }, textIconSpacing, textStyle]}>
                {title}
              </AppText>
            </>
          )}
        </View>
      </View>
    </AnimatedTouchable>
  );
};

export default GradientButton;
