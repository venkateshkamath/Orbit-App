/**
 * MessageBubble — chat message. Long-press own messages to delete.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BorderRadius, FontSizes, Spacing } from '../../constants/Colors';
import { useOrbitTheme } from '../theme';
import { Message } from '../types';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showAvatar?: boolean;
  onDelete?: (messageId: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwn,
  showAvatar = false,
  onDelete,
}) => {
  const { colors } = useOrbitTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flexDirection: 'row',
          marginBottom: Spacing.sm,
          paddingHorizontal: Spacing.md,
        },
        ownContainer: {
          justifyContent: 'flex-end',
        },
        bubble: {
          maxWidth: '80%',
          paddingVertical: Spacing.sm,
          paddingHorizontal: Spacing.md,
          borderRadius: BorderRadius.lg,
        },
        ownBubble: {
          borderBottomRightRadius: Spacing.xs,
          backgroundColor: colors.primary.default,
        },
        otherBubble: {
          backgroundColor: colors.background.tertiary,
          borderBottomLeftRadius: Spacing.xs,
        },
        text: {
          fontSize: FontSizes.md,
          lineHeight: 22,
        },
        ownText: {
          color: '#FAFAFA',
        },
        otherText: {
          color: colors.text.primary,
        },
        meta: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
          marginTop: Spacing.xs,
        },
        time: {
          fontSize: FontSizes.xs,
        },
        ownTime: {
          color: 'rgba(255,255,255,0.7)',
        },
        otherTime: {
          color: colors.text.tertiary,
          marginTop: Spacing.xs,
          textAlign: 'right',
        },
        readIcon: {
          marginLeft: Spacing.xs,
        },
      }),
    [colors]
  );

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleLongPress = () => {
    if (!isOwn || !onDelete) return;
    Alert.alert('Delete message', 'This message will be deleted for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(message.id) },
    ]);
  };

  const readIconColor = message.is_read
    ? 'rgba(255,255,255,0.95)'
    : 'rgba(255,255,255,0.55)';

  return (
    <View style={[styles.container, isOwn && styles.ownContainer]}>
      <Pressable
        onLongPress={handleLongPress}
        delayLongPress={400}
        style={({ pressed }) => [
          styles.bubble,
          isOwn ? styles.ownBubble : styles.otherBubble,
          pressed && { opacity: 0.85 },
        ]}
      >
        <Text style={[styles.text, isOwn ? styles.ownText : styles.otherText]}>
          {message.content}
        </Text>
        {isOwn ? (
          <View style={styles.meta}>
            <Text style={[styles.time, styles.ownTime]}>
              {formatTime(message.created_at)}
            </Text>
            <Ionicons
              name={message.is_read ? 'checkmark-done' : 'checkmark'}
              size={14}
              color={readIconColor}
              style={styles.readIcon}
            />
          </View>
        ) : (
          <Text style={[styles.time, styles.otherTime]}>
            {formatTime(message.created_at)}
          </Text>
        )}
      </Pressable>
    </View>
  );
};

export default MessageBubble;
