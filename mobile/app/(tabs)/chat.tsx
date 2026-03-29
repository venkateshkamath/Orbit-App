/**
 * Chat Tab - Conversations list
 */

import React, { useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
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
import { FontSizes, FontWeights, Spacing, BorderRadius } from '../../constants/Colors';
import { useOrbitTheme } from '../../src/theme';
import { ConversationItem, Avatar } from '../../src/components';
import {
  useConversationsQuery,
  useMatchesQuery,
  useStartConversationMutation,
  useLikeUserMutation,
} from '../../src/hooks/useOrbitApi';
import { useLikesReceivedForTab } from '../../src/hooks/useChatTabQueries';
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
  const startConversationMut = useStartConversationMutation();
  const likeMut = useLikeUserMutation();

  const { colors } = useOrbitTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'android' ? Spacing.md : Spacing.md,
    paddingBottom: Spacing.sm,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.5,
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
    color: colors.text.primary,
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
    backgroundColor: colors.secondary.default,
    borderRadius: BorderRadius.sm,
    paddingVertical: 2,
    alignItems: 'center',
  },
  newBadgeText: {
    color: '#08061A',
    fontSize: 9,
    fontWeight: FontWeights.bold,
  },
  matchName: {
    fontSize: FontSizes.sm,
    color: colors.text.secondary,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  emptyMatches: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    backgroundColor: colors.background.tertiary,
    borderRadius: BorderRadius.lg,
  },
  emptyMatchesText: {
    color: colors.text.tertiary,
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
    color: colors.text.secondary,
    marginTop: Spacing.xs,
    textAlign: 'center',
    width: '100%',
  },
  acceptBtn: {
    marginTop: Spacing.sm,
    backgroundColor: colors.primary.default,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  acceptBtnText: {
    color: colors.text.primary,
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.semibold,
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
    backgroundColor: colors.primary.default + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: colors.text.primary,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: FontSizes.md,
    color: colors.text.secondary,
    textAlign: 'center',
  },
      }),
    [colors]
  );

  const onRefresh = useCallback(async () => {
    await Promise.all([refetchConversations(), refetchMatches(), refetchLikes()]);
  }, [refetchConversations, refetchMatches, refetchLikes]);

  useFocusEffect(
    useCallback(() => {
      void refetchConversations();
      void refetchMatches();
      void refetchLikes();
    }, [refetchConversations, refetchMatches, refetchLikes])
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
        <Ionicons name="chatbubbles-outline" size={48} color={colors.primary.default} />
      </View>
      <Text style={styles.emptyTitle}>No messages yet</Text>
      <Text style={styles.emptySubtitle}>
        Match with someone to start chatting!
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background.primary }]}>
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
              tintColor={colors.primary.default}
              colors={[colors.primary.default]}
            />
          }
        />
      </SafeAreaView>
    </View>
  );
}

