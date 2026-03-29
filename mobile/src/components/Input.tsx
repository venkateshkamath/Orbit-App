/**
 * Input - Clean, styled text input for mobile
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BorderRadius, FontSizes, Spacing, FontWeights } from '../../constants/Colors';
import { useOrbitTheme } from '../theme';

interface InputProps extends TextInputProps {
  label: string;
  error?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  isPassword?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  icon,
  isPassword = false,
  value,
  onFocus,
  onBlur,
  ...props
}) => {
  const { colors, resolvedScheme } = useOrbitTheme();
  const isLight = resolvedScheme === 'light';
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          marginBottom: Spacing.lg,
        },
        label: {
          fontSize: FontSizes.sm,
          fontWeight: FontWeights.medium,
          color: colors.text.secondary,
          marginBottom: Spacing.sm,
        },
        labelFocused: {
          color: colors.primary.default,
        },
        labelError: {
          color: colors.error,
        },
        inputContainer: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.background.secondary,
          borderRadius: BorderRadius.md,
          borderWidth: 1,
          borderColor: colors.borderLight,
          paddingHorizontal: Spacing.md,
          minHeight: 50,
        },
        inputFocused: {
          borderColor: colors.primary.default,
          borderWidth: 1.5,
          backgroundColor: colors.background.primary,
        },
        inputError: {
          borderColor: colors.error,
        },
        icon: {
          marginRight: Spacing.sm,
        },
        input: {
          flex: 1,
          color: colors.text.primary,
          fontSize: FontSizes.md,
          height: '100%',
        },
        eyeIcon: {
          padding: Spacing.xs,
          marginLeft: Spacing.xs,
        },
        errorText: {
          color: colors.error,
          fontSize: FontSizes.xs,
          marginTop: Spacing.xs,
          marginLeft: Spacing.xs,
        },
      }),
    [colors, isLight]
  );

  const handleFocus = (e: any) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  return (
    <View style={styles.container}>
      <Text
        style={[styles.label, isFocused && styles.labelFocused, error && styles.labelError]}
      >
        {label}
      </Text>

      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputFocused,
          error && styles.inputError,
        ]}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={20}
            color={isFocused ? colors.primary.default : colors.text.tertiary}
            style={styles.icon}
          />
        )}

        <TextInput
          style={styles.input}
          value={value}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholderTextColor={colors.text.muted}
          secureTextEntry={isPassword && !showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          {...props}
        />

        {isPassword && (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.eyeIcon}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={22}
              color={colors.text.tertiary}
            />
          </TouchableOpacity>
        )}
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

export default Input;
