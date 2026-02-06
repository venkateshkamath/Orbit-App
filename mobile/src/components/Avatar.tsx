/**
 * Avatar - User avatar component with online status indicator
 */

import React from 'react';
import { View, Image, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, BorderRadius, FontSizes, FontWeights } from '../../constants/Colors';

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
  const initials = name.charAt(0).toUpperCase();
  const onlineSize = Math.max(size * 0.25, 10);

  const content = (
    <View style={[styles.container, { width: size, height: size }]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
        />
      ) : (
        <LinearGradient
          colors={[Colors.primary.start, Colors.primary.end]}
          style={[styles.placeholder, { width: size, height: size, borderRadius: size / 2 }]}
        >
          <Text style={[styles.initials, { fontSize: size * 0.4 }]}>{initials}</Text>
        </LinearGradient>
      )}
      
      {showOnline && (
        <View
          style={[
            styles.onlineIndicator,
            {
              width: onlineSize,
              height: onlineSize,
              borderRadius: onlineSize / 2,
              backgroundColor: isOnline ? Colors.online : Colors.offline,
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

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  image: {
    resizeMode: 'cover',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: Colors.text.primary,
    fontWeight: FontWeights.bold,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderColor: Colors.background.primary,
  },
});

export default Avatar;
