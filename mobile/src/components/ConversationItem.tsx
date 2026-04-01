/**
 * ConversationItem — chat row: name, preview, relative time; unread badge (success accent).
 */

import React, { useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { BorderRadius, FontSizes, FontWeights, Spacing } from '../../constants/Colors';
import { useOrbitTheme } from '../theme';
import { AppText } from '../ui/AppText';
import { Conversation } from '../types';
import Avatar from './Avatar';

const AVATAR_SIZE = 56;

function formatShortRelative(iso: string): string {
  const d = new Date(iso);
  const t = d.getTime();
  if (Number.isNaN(t)) return '';
  const diff = Date.now() - t;
  if (diff < 45_000) return 'Just now';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

interface ConversationItemProps {
  conversation: Conversation;
  onPress: () => void;
  isFirst?: boolean;
}

export const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  onPress,
  isFirst = false,
}) => {
  const { colors, fonts } = useOrbitTheme();
  const other = conversation.other_participant;
  const hasUnread = (conversation.unread_count ?? 0) > 0;
  const lastAt = conversation.last_message?.created_at;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        pressable: {
          borderRadius: BorderRadius.md,
          overflow: 'hidden',
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: Spacing.md,
          minHeight: 80,
        },
        rowFirst: {
          paddingTop: isFirst ? Spacing.sm : undefined,
        },
        pressed: {
          backgroundColor: colors.background.tertiary,
        },
        avatarWrap: {
          marginRight: Spacing.md,
        },
        middle: {
          flex: 1,
          minWidth: 0,
          justifyContent: 'center',
        },
        name: {
          fontSize: FontSizes.md,
          fontWeight: FontWeights.semibold,
          color: colors.text.primary,
          letterSpacing: -0.2,
          fontFamily: fonts.semibold,
          marginBottom: 2,
        },
        nameMuted: {
          color: colors.text.secondary,
          fontWeight: FontWeights.medium,
          fontFamily: fonts.medium,
        },
        preview: {
          fontSize: FontSizes.sm,
          color: colors.text.secondary,
          lineHeight: 20,
          fontFamily: fonts.regular,
          marginBottom: 4,
        },
        previewUnread: {
          color: colors.text.primary,
          fontFamily: fonts.medium,
          fontWeight: FontWeights.medium,
        },
        time: {
          fontSize: FontSizes.xs,
          color: colors.text.tertiary,
          fontFamily: fonts.regular,
        },
        rightCol: {
          alignSelf: 'stretch',
          justifyContent: 'center',
          alignItems: 'flex-end',
          paddingLeft: Spacing.sm,
          minWidth: 28,
        },
        badge: {
          minWidth: 24,
          height: 24,
          paddingHorizontal: 6,
          borderRadius: 12,
          backgroundColor: colors.success,
          alignItems: 'center',
          justifyContent: 'center',
        },
        badgeText: {
          color: '#FFFFFF',
          fontSize: 11,
          fontWeight: FontWeights.bold,
          fontFamily: fonts.bold,
        },
      }),
    [colors, fonts, isFirst]
  );

  if (!other) return null;

  const previewText =
    conversation.last_message?.content?.trim() || 'Start a conversation';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
      android_ripple={{ color: colors.borderLight }}
    >
      <View style={[styles.row, isFirst && styles.rowFirst]}>
        <View style={styles.avatarWrap}>
          <Avatar
            uri={other.avatar}
            name={other.username}
            size={AVATAR_SIZE}
            showOnline
            isOnline={other.is_online}
          />
        </View>

        <View style={styles.middle}>
          <AppText
            style={[styles.name, !hasUnread && styles.nameMuted]}
            numberOfLines={1}
          >
            {other.username}
          </AppText>
          <AppText
            style={[styles.preview, hasUnread && styles.previewUnread]}
            numberOfLines={1}
          >
            {previewText}
          </AppText>
          {lastAt ? (
            <AppText style={styles.time}>{formatShortRelative(lastAt)}</AppText>
          ) : null}
        </View>

        <View style={styles.rightCol}>
          {hasUnread ? (
            <View style={styles.badge}>
              <AppText style={styles.badgeText}>
                {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
};

export default ConversationItem;
