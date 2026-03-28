/**
 * Chat Tab - Conversations list
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, FontWeights, Spacing, BorderRadius } from '../../constants/Colors';
import { ConversationItem, Avatar } from '../../src/components';
import {
  useConversationsQuery,
  useMatchesQuery,
  useStartConversationMutation,
  useLikeUserMutation,
  useMarkNotificationReadMutation,
} from '../../src/hooks/useOrbitApi';
import { useLikesReceivedForTab, useNotificationsForTab } from '../../src/hooks/useChatTabQueries';
import type { LikeReceivedItem } from '../../src/types';

export default function ChatScreen() {
  const {
    data: conversations = [],
    isLoading,
    isRefetching,
    refetch: refetchConversations,
  } = useConversationsQuery();
  const { data: matches = [], refetch: refetchMatches } = useMatchesQuery();
  const { data: pendingOrbits = [], refetch: refetchLikes } = useLikesReceivedForTab();
  const { data: notifPack, refetch: refetchNotifs } = useNotificationsForTab();
  const startConversationMut = useStartConversationMutation();
  const likeMut = useLikeUserMutation();
  const markNotifRead = useMarkNotificationReadMutation();

  const onRefresh = useCallback(async () => {
    await Promise.all([
      refetchConversations(),
      refetchMatches(),
      refetchLikes(),
      refetchNotifs(),
    ]);
  }, [refetchConversations, refetchMatches, refetchLikes, refetchNotifs]);

  const notificationRows = useMemo(
    () => (Array.isArray(notifPack?.results) ? notifPack!.results : []),
    [notifPack?.results]
  );

  const conversationsWithOther = useMemo(
    () => conversations.filter((c) => c.other_participant),
    [conversations]
  );

  const handleConversationPress = (conversationId: string) => {
    router.push(`/chat/${conversationId}`);
  };

  const renderMatchItem = ({ item }: { item: any }) => {
    const matchedUserId = item.matched_user?.id;
    return (
      <TouchableOpacity
        style={styles.matchItem}
        onPress={async () => {
          if (!matchedUserId) {
            return;
          }
          try {
            const conversation = await startConversationMut.mutateAsync({
              userId: matchedUserId,
            });
            router.push(`/chat/${conversation.id}`);
          } catch (error) {
            // If backend blocked this (e.g., no match), we rely on backend error message
          }
        }}
      >
        <View style={styles.matchAvatarContainer}>
          <Avatar
            uri={item.matched_user?.avatar}
            name={item.matched_user?.username || 'M'}
            size={64}
            showOnline
            isOnline={item.matched_user?.is_online}
          />
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>NEW</Text>
          </View>
        </View>
        <Text style={styles.matchName} numberOfLines={1}>
          {item.matched_user?.username}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderPendingOrbitCard = (item: LikeReceivedItem) => {
    const from = item.from_user;
    if (!from?.id) return null;
    return (
      <View style={styles.requestItem}>
        <Avatar uri={from.avatar} name={from.username} size={56} showOnline isOnline={from.is_online} />
        <Text style={styles.requestName} numberOfLines={1}>
          {from.username}
        </Text>
        <TouchableOpacity
          style={styles.acceptBtn}
          onPress={() => likeMut.mutate(from.id)}
          disabled={likeMut.isPending}
        >
          <Text style={styles.acceptBtnText}>Accept</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.matchesSection}>
      <Text style={styles.sectionTitle}>Join orbit requests</Text>
      {pendingOrbits.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.requestsList}
          keyboardShouldPersistTaps="handled"
        >
          {pendingOrbits.map((item) => (
            <React.Fragment key={item.id}>{renderPendingOrbitCard(item)}</React.Fragment>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.emptyMatches}>
          <Text style={styles.emptyMatchesText}>No pending requests right now.</Text>
        </View>
      )}

      {notificationRows.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, styles.messagesTitle]}>Activity</Text>
          <View style={styles.notifBlock}>
            {notificationRows.slice(0, 8).map((n) => (
              <TouchableOpacity
                key={n.id}
                style={[styles.notifRow, !n.read_at && styles.notifRowUnread]}
                onPress={async () => {
                  if (!n.read_at) {
                    try {
                      await markNotifRead.mutateAsync(n.id);
                    } catch {
                      /* ignore */
                    }
                  }
                  const convId = n.payload?.conversation_id;
                  if (typeof convId === 'string') {
                    router.push(`/chat/${convId}`);
                    return;
                  }
                  const actorId = n.payload?.actor_id;
                  if (typeof actorId === 'string') {
                    router.push(`/user/${actorId}`);
                  }
                }}
              >
                <Text style={styles.notifTitle}>{n.title}</Text>
                <Text style={styles.notifBody} numberOfLines={2}>
                  {n.body}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      <Text style={styles.sectionTitle}>New Matches</Text>
      {matches.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.matchesList}
          keyboardShouldPersistTaps="handled"
        >
          {matches.map((item) => (
            <View key={item.id}>{renderMatchItem({ item })}</View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.emptyMatches}>
          <Text style={styles.emptyMatchesText}>
            Explore Discover on the map to meet people nearby.
          </Text>
        </View>
      )}
      
      <Text style={[styles.sectionTitle, styles.messagesTitle]}>Messages</Text>
    </View>
  );

  const renderEmptyMessages = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIcon}>
        <Ionicons name="chatbubbles-outline" size={48} color={Colors.primary.default} />
      </View>
      <Text style={styles.emptyTitle}>No messages yet</Text>
      <Text style={styles.emptySubtitle}>
        Match with someone to start chatting!
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: Colors.background.primary }]}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Messages</Text>
        </View>

        {/* Conversations List */}
        <FlatList
          data={conversationsWithOther}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ConversationItem
              conversation={item}
              onPress={() => handleConversationPress(item.id)}
            />
          )}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={!isLoading ? renderEmptyMessages : null}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={onRefresh}
              tintColor={Colors.primary.default}
              colors={[Colors.primary.default]}
            />
          }
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'android' ? Spacing.sm : Spacing.md,
    paddingBottom: Spacing.sm,
  },
  title: {
    fontSize: FontSizes.xxxl,
    fontWeight: FontWeights.bold,
    color: Colors.text.primary,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  matchesSection: {
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
    marginTop: Spacing.md,
  },
  messagesTitle: {
    marginTop: Spacing.lg,
  },
  matchesList: {
    paddingRight: Spacing.md,
  },
  matchItem: {
    alignItems: 'center',
    marginRight: Spacing.md,
    width: 80,
  },
  matchAvatarContainer: {
    position: 'relative',
  },
  newBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.primary.default,
    borderRadius: BorderRadius.sm,
    paddingVertical: 2,
    alignItems: 'center',
  },
  newBadgeText: {
    color: Colors.text.primary,
    fontSize: 9,
    fontWeight: FontWeights.bold,
  },
  matchName: {
    fontSize: FontSizes.sm,
    color: Colors.text.secondary,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  emptyMatches: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.background.tertiary,
    borderRadius: BorderRadius.lg,
  },
  emptyMatchesText: {
    color: Colors.text.tertiary,
    fontSize: FontSizes.sm,
    textAlign: 'center',
  },
  requestsList: {
    paddingRight: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  requestItem: {
    width: 100,
    marginRight: Spacing.md,
    alignItems: 'center',
  },
  requestName: {
    fontSize: FontSizes.sm,
    color: Colors.text.secondary,
    marginTop: Spacing.xs,
    textAlign: 'center',
    width: '100%',
  },
  acceptBtn: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.primary.default,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  acceptBtnText: {
    color: Colors.text.primary,
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.semibold,
  },
  notifBlock: {
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  notifRow: {
    backgroundColor: Colors.background.tertiary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.xs,
  },
  notifRowUnread: {
    borderWidth: 1,
    borderColor: Colors.primary.default + '55',
  },
  notifTitle: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    color: Colors.text.primary,
  },
  notifBody: {
    marginTop: 4,
    fontSize: FontSizes.xs,
    color: Colors.text.secondary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primary.default + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: FontSizes.md,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
});
