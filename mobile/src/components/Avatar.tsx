/**
 * Avatar - User avatar component with online status indicator
 */

import React, { useMemo } from 'react';
import { View, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { FontWeights } from '../../constants/Colors';
import { useOrbitTheme } from '../theme';
import { AppText } from '../ui/AppText';

interface AvatarProps {
  uri?: string | null;
  name: string;
  size?: number;
  showOnline?: boolean;
  isOnline?: boolean;
  onPress?: () => void;
}

export const Avatar: React.FC<AvatarProps> = ({
  uri,
  name,
  size = 48,
  showOnline = false,
  isOnline = false,
  onPress,
}) => {
  const { colors } = useOrbitTheme();
  const initials = name.charAt(0).toUpperCase();
  const onlineSize = Math.max(size * 0.25, 10);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          position: 'relative',
        },
        image: {
          resizeMode: 'cover',
        },
        placeholder: {
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background.tertiary,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        initials: {
          color: colors.text.primary,
          fontWeight: FontWeights.bold,
        },
        onlineIndicator: {
          position: 'absolute',
          bottom: 0,
          right: 0,
          borderColor: colors.background.primary,
        },
      }),
    [colors]
  );

  const content = (
    <View style={[styles.container, { width: size, height: size }]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
        />
      ) : (
        <View
          style={[
            styles.placeholder,
            { width: size, height: size, borderRadius: size / 2 },
          ]}
        >
          <AppText style={[styles.initials, { fontSize: size * 0.4 }]}>{initials}</AppText>
        </View>
      )}

      {showOnline && (
        <View
          style={[
            styles.onlineIndicator,
            {
              width: onlineSize,
              height: onlineSize,
              borderRadius: onlineSize / 2,
              backgroundColor: isOnline ? colors.online : colors.offline,
              borderWidth: onlineSize * 0.2,
            },
          ]}
        />
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

export default Avatar;
