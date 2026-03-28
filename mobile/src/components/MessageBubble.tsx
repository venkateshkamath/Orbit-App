/**
 * MessageBubble - Chat message bubble component
 */

import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, FontSizes, Spacing } from '../../constants/Colors';
import { Message } from '../types';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showAvatar?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwn,
  showAvatar = false,
}) => {
  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <View style={[styles.container, isOwn && styles.ownContainer]}>
      {isOwn ? (
        <View style={[styles.bubble, styles.ownBubble]}>
          <Text style={[styles.text, styles.ownText]}>{message.content}</Text>
          <View style={styles.meta}>
            <Text style={[styles.time, styles.ownTime]}>
              {formatTime(message.created_at)}
            </Text>
            <Ionicons
              name={message.is_read ? 'checkmark-done' : 'checkmark'}
              size={14}
              color={message.is_read ? Colors.text.accent : 'rgba(255,255,255,0.55)'}
              style={styles.readIcon}
            />
          </View>
        </View>
      ) : (
        <View style={[styles.bubble, styles.otherBubble]}>
          <Text style={[styles.text, styles.otherText]}>{message.content}</Text>
          <Text style={[styles.time, styles.otherTime]}>
            {formatTime(message.created_at)}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
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
    backgroundColor: Colors.primary.default,
  },
  otherBubble: {
    backgroundColor: Colors.background.elevated,
    borderBottomLeftRadius: Spacing.xs,
  },
  text: {
    fontSize: FontSizes.md,
    lineHeight: 22,
  },
  ownText: {
    color: Colors.text.primary,
  },
  otherText: {
    color: Colors.text.primary,
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
    color: Colors.text.tertiary,
    marginTop: Spacing.xs,
    textAlign: 'right',
  },
  readIcon: {
    marginLeft: Spacing.xs,
  },
});

export default MessageBubble;
