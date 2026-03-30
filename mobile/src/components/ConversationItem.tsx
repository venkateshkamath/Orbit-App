/**
 * ConversationItem - Chat list item component
 */

import React, { useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { BorderRadius, FontSizes, FontWeights, Spacing } from '../../constants/Colors';
import { useOrbitTheme } from '../theme';
import { AppText } from '../ui/AppText';
import { Conversation } from '../types';
import Avatar from './Avatar';

interface ConversationItemProps {
  conversation: Conversation;
  onPress: () => void;
}

export const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  onPress,
}) => {
  const { colors, shadows } = useOrbitTheme();
  const other = conversation.other_participant;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: Spacing.md,
          paddingHorizontal: Spacing.sm,
        },
        content: {
          flex: 1,
          marginLeft: Spacing.md,
        },
        header: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: Spacing.xs,
        },
        name: {
          fontSize: FontSizes.md,
          fontWeight: FontWeights.semibold,
          color: colors.text.primary,
          flex: 1,
          marginRight: Spacing.sm,
        },
        time: {
          fontSize: FontSizes.xs,
          color: colors.text.tertiary,
        },
        footer: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        },
        message: {
          fontSize: FontSizes.sm,
          color: colors.text.secondary,
          flex: 1,
          marginRight: Spacing.sm,
        },
        badge: {
          backgroundColor: colors.primary.default,
          borderRadius: BorderRadius.full,
          paddingHorizontal: Spacing.sm,
          paddingVertical: 2,
          minWidth: 20,
          alignItems: 'center',
        },
        badgeText: {
          color: '#FAFAFA',
          fontSize: FontSizes.xs,
          fontWeight: FontWeights.bold,
        },
      }),
    [colors, shadows]
  );

  if (!other) return null;

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (diffDays === 1) {
      return 'Yesterday';
    }
    if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <TouchableOpacity onPress={onPress} style={styles.container} activeOpacity={0.7}>
      <Avatar
        uri={other.avatar}
        name={other.username}
        size={56}
        showOnline
        isOnline={other.is_online}
      />

      <View style={styles.content}>
        <View style={styles.header}>
          <AppText style={styles.name} numberOfLines={1}>
            {other.username}
          </AppText>
          {conversation.last_message && (
            <AppText style={styles.time}>{formatTime(conversation.last_message.created_at)}</AppText>
          )}
        </View>

        <View style={styles.footer}>
          <AppText style={styles.message} numberOfLines={1}>
            {conversation.last_message?.content || 'Start a conversation'}
          </AppText>
          {conversation.unread_count > 0 && (
            <View style={styles.badge}>
              <AppText style={styles.badgeText}>
                {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
              </AppText>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default ConversationItem;
