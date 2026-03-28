/**
 * Chat Tab - Conversations list
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, FontWeights, Spacing, BorderRadius } from '../../constants/Colors';
import { ConversationItem, Avatar } from '../../src/components';
import {
  useConversationsQuery,
  useMatchesQuery,
  useStartConversationMutation,
} from '../../src/hooks/useOrbitApi';

export default function ChatScreen() {
  const {
    data: conversations = [],
    isLoading,
    isRefetching,
    refetch: refetchConversations,
  } = useConversationsQuery();
  const { data: matches = [], refetch: refetchMatches } = useMatchesQuery();
  const startConversationMut = useStartConversationMutation();

  const onRefresh = useCallback(async () => {
    await Promise.all([refetchConversations(), refetchMatches()]);
  }, [refetchConversations, refetchMatches]);

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

  const renderHeader = () => (
    <View style={styles.matchesSection}>
      <Text style={styles.sectionTitle}>New Matches</Text>
      {matches.length > 0 ? (
        <FlatList
          horizontal
          data={matches}
          keyExtractor={(item) => item.id}
          renderItem={renderMatchItem}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.matchesList}
        />
      ) : (
        <View style={styles.emptyMatches}>
          <Text style={styles.emptyMatchesText}>
            Keep swiping to find your matches! 💫
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
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.background.primary, Colors.background.secondary]}
        style={StyleSheet.absoluteFillObject}
      />

      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Messages</Text>
        </View>

        {/* Conversations List */}
        <FlatList
          data={conversations}
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
    paddingTop: Spacing.md,
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
