import React, { type ComponentProps, useMemo } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '../ui/AppText';
import { BorderRadius, FontSizes, FontWeights, Spacing, useOrbitTheme } from '../theme';
import { OrbitLoader } from './OrbitLoader';

type IconName = ComponentProps<typeof Ionicons>['name'];
type StateViewType = 'loading' | 'empty' | 'error';

type Props = {
  type: StateViewType;
  title?: string;
  description?: string;
  icon?: IconName;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
  style?: ViewStyle;
};

const DEFAULTS: Record<StateViewType, { title: string; description: string; icon: IconName }> = {
  loading: {
    title: 'Loading...',
    description: '',
    icon: 'sync-outline',
  },
  empty: {
    title: 'Nothing here yet',
    description: 'Check back soon.',
    icon: 'sparkles-outline',
  },
  error: {
    title: 'Something went wrong',
    description: 'Please try again.',
    icon: 'alert-circle-outline',
  },
};

export function StateView({
  type,
  title,
  description,
  icon,
  actionLabel,
  onAction,
  compact = false,
  style,
}: Props) {
  const { colors, fonts } = useOrbitTheme();
  const copy = DEFAULTS[type];
  const resolvedTitle = title ?? copy.title;
  const resolvedDescription = description ?? copy.description;
  const resolvedIcon = icon ?? copy.icon;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          minHeight: compact ? 140 : 300,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: Spacing.xl,
          paddingVertical: compact ? Spacing.lg : Spacing.xxl,
        },
        iconShell: {
          width: compact ? 52 : 68,
          height: compact ? 52 : 68,
          borderRadius: compact ? 26 : 34,
          backgroundColor: type === 'error' ? `${colors.error}14` : colors.background.secondary,
          borderWidth: 1,
          borderColor: type === 'error' ? `${colors.error}30` : colors.border,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: Spacing.md,
        },
        title: {
          color: colors.text.primary,
          fontSize: compact ? FontSizes.md : FontSizes.lg,
          fontWeight: FontWeights.bold,
          fontFamily: fonts.bold,
          textAlign: 'center',
          lineHeight: compact ? 22 : 25,
        },
        description: {
          color: colors.text.secondary,
          fontSize: FontSizes.sm,
          fontFamily: fonts.regular,
          textAlign: 'center',
          lineHeight: 21,
          marginTop: Spacing.sm,
          maxWidth: 280,
        },
        action: {
          height: 42,
          borderRadius: BorderRadius.md,
          backgroundColor: colors.text.primary,
          paddingHorizontal: Spacing.lg,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: Spacing.lg,
        },
        actionText: {
          color: colors.background.primary,
          fontSize: FontSizes.sm,
          fontWeight: FontWeights.bold,
          fontFamily: fonts.bold,
        },
      }),
    [colors, compact, fonts, type]
  );

  return (
    <View style={[styles.wrap, style]}>
      {type === 'loading' ? (
        <OrbitLoader variant="inline" size={compact ? 'sm' : 'md'} />
      ) : (
        <View style={styles.iconShell}>
          <Ionicons
            name={resolvedIcon}
            size={compact ? 24 : 30}
            color={type === 'error' ? colors.error : colors.primary.default}
          />
        </View>
      )}
      <AppText style={styles.title}>{resolvedTitle}</AppText>
      {resolvedDescription ? (
        <AppText style={styles.description}>{resolvedDescription}</AppText>
      ) : null}
      {actionLabel && onAction ? (
        <Pressable style={styles.action} onPress={onAction}>
          <AppText style={styles.actionText}>{actionLabel}</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

export default StateView;
