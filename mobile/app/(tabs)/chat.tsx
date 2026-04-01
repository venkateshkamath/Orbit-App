/**
 * Chat Tab - Conversations list
 */

import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FontSizes, FontWeights, Spacing } from '../../constants/Colors';
import { useOrbitTheme } from '../../src/theme';
import { ConversationItem } from '../../src/components';
import { AppText } from '../../src/ui/AppText';
import {
  useConversationsQuery,
} from '../../src/hooks/useOrbitApi';

export default function ChatScreen() {
  const {
    data: conversations = [],
    isLoading,
    refetch: refetchConversations,
  } = useConversationsQuery();
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const { colors, fonts } = useOrbitTheme();
  const tabBarHeight = useBottomTabBarHeight();

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
    paddingTop: Platform.OS === 'android' ? 12 : 8,
    paddingBottom: 0,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.5,
    fontFamily: fonts.bold,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 0,
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
    fontFamily: fonts.bold,
  },
  emptySubtitle: {
    fontSize: FontSizes.md,
    color: colors.text.secondary,
    textAlign: 'center',
    fontFamily: fonts.regular,
  },
      }),
    [colors, fonts]
  );

  const onRefresh = useCallback(async () => {
    setIsManualRefreshing(true);
    try {
      await refetchConversations();
    } finally {
      setIsManualRefreshing(false);
    }
  }, [refetchConversations]);

  useFocusEffect(
    useCallback(() => {
      void refetchConversations();
    }, [refetchConversations])
  );

  const conversationsWithOther = useMemo(
    () => conversations.filter((c) => c.other_participant),
    [conversations]
  );

  const handleConversationPress = (conversationId: string) => {
    router.push(`/chat/${conversationId}`);
  };

  const renderEmptyMessages = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIcon}>
        <Ionicons name="chatbubbles-outline" size={48} color={colors.primary.default} />
      </View>
      <AppText style={styles.emptyTitle}>No messages yet</AppText>
      <AppText style={styles.emptySubtitle}>
        Match with someone to start chatting!
      </AppText>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background.primary }]}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <AppText style={styles.title}>Messages</AppText>
        </View>

        {/* Conversations List */}
        <FlatList
          data={conversationsWithOther}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <ConversationItem
              conversation={item}
              onPress={() => handleConversationPress(item.id)}
              isFirst={index === 0}
            />
          )}
          ListEmptyComponent={!isLoading ? renderEmptyMessages : null}
          contentContainerStyle={[styles.listContent, { paddingBottom: Spacing.xxl + tabBarHeight }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isManualRefreshing}
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

