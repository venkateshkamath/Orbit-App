/**
 * Incoming join-orbit requests (likes you have not returned yet).
 * Used as FlatList ListHeaderComponent on the Chats tab.
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { FontSizes, FontWeights, Spacing, BorderRadius } from '../../constants/Colors';
import { useOrbitTheme } from '../theme';
import { AppText } from '../ui/AppText';
import Avatar from './Avatar';
import MatchModal from './MatchModal';
import {
  useLikesReceivedQuery,
  useLikeUserMutation,
  useStartConversationMutation,
} from '../hooks/useOrbitApi';
import type { LikeReceivedItem, PublicUser } from '../types';

function shortTime(iso: string): string {
  const d = new Date(iso);
  const t = d.getTime();
  if (Number.isNaN(t)) return '';
  const diff = Date.now() - t;
  if (diff < 60_000) return 'Just now';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function JoinRequestsListHeader() {
  const { colors, fonts } = useOrbitTheme();
  const { data: requests = [], isLoading, isRefetching } = useLikesReceivedQuery();
  const likeMut = useLikeUserMutation();
  const startConversationMut = useStartConversationMutation();
  const [matchUser, setMatchUser] = useState<PublicUser | null>(null);
  const [showMatchModal, setShowMatchModal] = useState(false);

  const onAccept = async (userId: string) => {
    try {
      const result = await likeMut.mutateAsync(userId);
      if (result.is_match && result.match?.matched_user) {
        setMatchUser(result.match.matched_user);
        setShowMatchModal(true);
      }
    } catch {
      Alert.alert('Error', 'Could not accept this request.');
    }
  };

  const onMatchMessage = async () => {
    if (!matchUser) return;
    try {
      const conversation = await startConversationMut.mutateAsync({ userId: matchUser.id });
      setShowMatchModal(false);
      setMatchUser(null);
      router.push(`/chat/${conversation.id}`);
    } catch {
      Alert.alert('Error', 'Failed to open chat.');
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          marginBottom: Spacing.md,
        },
        titleRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: Spacing.lg,
          marginBottom: Spacing.sm,
        },
        title: {
          fontSize: FontSizes.md,
          fontWeight: FontWeights.semibold,
          color: colors.text.primary,
          fontFamily: fonts.semibold,
        },
        count: {
          fontSize: FontSizes.sm,
          color: colors.text.tertiary,
          fontFamily: fonts.regular,
        },
        card: {
          marginHorizontal: Spacing.lg,
          borderRadius: BorderRadius.lg,
          backgroundColor: colors.background.elevated,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          overflow: 'hidden',
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: Spacing.md,
          paddingHorizontal: Spacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        rowLast: {
          borderBottomWidth: 0,
        },
        rowPress: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          minWidth: 0,
        },
        meta: {
          flex: 1,
          marginLeft: Spacing.md,
          minWidth: 0,
        },
        name: {
          fontSize: FontSizes.md,
          fontWeight: FontWeights.semibold,
          color: colors.text.primary,
          fontFamily: fonts.semibold,
        },
        subtitle: {
          marginTop: 2,
          fontSize: FontSizes.sm,
          color: colors.text.secondary,
          fontFamily: fonts.regular,
        },
        time: {
          marginTop: 2,
          fontSize: 11,
          color: colors.text.tertiary,
          fontFamily: fonts.regular,
        },
        acceptBtn: {
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.sm,
          borderRadius: BorderRadius.full,
          backgroundColor: colors.primary.default,
          marginLeft: Spacing.sm,
        },
        acceptLabel: {
          fontSize: FontSizes.sm,
          fontWeight: FontWeights.semibold,
          color: colors.text.primary,
          fontFamily: fonts.semibold,
        },
        acceptDisabled: {
          opacity: 0.6,
        },
        loadingRow: {
          paddingVertical: Spacing.lg,
          alignItems: 'center',
        },
      }),
    [colors, fonts]
  );

  if (!isLoading && requests.length === 0) {
    return null;
  }

  if (isLoading && requests.length === 0) {
    return (
      <View style={styles.wrap}>
        <View style={styles.titleRow}>
          <AppText style={styles.title}>Requests</AppText>
        </View>
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.primary.default} />
        </View>
      </View>
    );
  }

  const mutatingId = likeMut.isPending && likeMut.variables ? likeMut.variables : null;

  const renderRow = (item: LikeReceivedItem, index: number) => {
    const u = item.from_user;
    const last = index === requests.length - 1;
    const busy = mutatingId === u.id;
    return (
      <View key={item.id} style={[styles.row, last && styles.rowLast]}>
        <Pressable
          onPress={() => router.push(`/user/${u.id}`)}
          style={({ pressed }) => [styles.rowPress, pressed && Platform.OS === 'ios' ? { opacity: 0.85 } : null]}
          accessibilityRole="button"
          accessibilityLabel={`Open ${u.username}'s profile`}
        >
          <Avatar uri={u.avatar} name={u.username} size={48} />
          <View style={styles.meta}>
            <AppText style={styles.name} numberOfLines={1}>
              {u.username}
            </AppText>
            <AppText style={styles.subtitle} numberOfLines={1}>
              Wants to join your orbit
            </AppText>
            <AppText style={styles.time}>{shortTime(item.created_at)}</AppText>
          </View>
        </Pressable>
        <Pressable
          onPress={() => onAccept(u.id)}
          disabled={busy}
          style={[styles.acceptBtn, busy && styles.acceptDisabled]}
          accessibilityRole="button"
          accessibilityLabel={`Accept ${u.username}`}
        >
          {busy ? (
            <ActivityIndicator color={colors.text.primary} size="small" />
          ) : (
            <AppText style={styles.acceptLabel}>Accept</AppText>
          )}
        </Pressable>
      </View>
    );
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <AppText style={styles.title}>Requests</AppText>
        {isRefetching ? (
          <ActivityIndicator size="small" color={colors.text.tertiary} />
        ) : (
          <AppText style={styles.count}>{requests.length} pending</AppText>
        )}
      </View>
      <View style={styles.card}>
        {requests.map((item, index) => renderRow(item, index))}
      </View>

      <MatchModal
        visible={showMatchModal}
        user={matchUser}
        onClose={() => {
          setShowMatchModal(false);
          setMatchUser(null);
        }}
        onMessage={onMatchMessage}
      />
    </View>
  );
}
