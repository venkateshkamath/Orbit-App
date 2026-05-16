/**
 * Chats Tab — conversation list (card + search, reference-inspired layout)
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
  ListRenderItemInfo,
  TextInput,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FontSizes, FontWeights, Spacing, BorderRadius } from '../../constants/Colors';
import { useOrbitTheme } from '../../src/theme';
import { ConversationItem, JoinRequestsListHeader } from '../../src/components';
import { AppText } from '../../src/ui/AppText';
import { useConversationsQuery } from '../../src/hooks/useOrbitApi';
import { useQueryClient } from '@tanstack/react-query';
import { orbitKeys } from '../../src/hooks/orbitKeys';
import type { Conversation } from '../../src/types';

const LIST_AVATAR = 56;
const ROW_TEXT_INSET = Spacing.lg + LIST_AVATAR + Spacing.md;

export default function ChatScreen() {
  const queryClient = useQueryClient();
  const {
    data: conversations = [],
    isLoading,
    refetch: refetchConversations,
  } = useConversationsQuery();
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
        main: {
          flex: 1,
          paddingTop: Platform.OS === 'android' ? Spacing.sm : Spacing.xs,
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: Spacing.lg,
          paddingTop: Spacing.md,
          paddingBottom: Spacing.sm,
        },
        screenTitle: {
          fontSize: FontSizes.xxxl,
          fontWeight: '800',
          color: colors.text.primary,
          letterSpacing: 0,
          fontFamily: fonts.extrabold,
        },
        searchIconBtn: {
          padding: 4,
        },
        searchWrap: {
          flexDirection: 'row',
          alignItems: 'center',
          marginHorizontal: Spacing.lg,
          marginBottom: Spacing.md,
          paddingLeft: Spacing.md,
          paddingRight: Spacing.xs,
          minHeight: 44,
          borderRadius: BorderRadius.full,
          backgroundColor: colors.background.tertiary,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        searchIcon: {
          marginRight: Spacing.sm,
        },
        searchInput: {
          flex: 1,
          paddingVertical: Platform.OS === 'ios' ? 10 : 8,
          fontSize: FontSizes.md,
          color: colors.text.primary,
          fontFamily: fonts.regular,
        },
        clearSearch: {
          padding: Spacing.sm,
          justifyContent: 'center',
          alignItems: 'center',
        },
        listFlex: {
          flex: 1,
        },
        listContent: {
          paddingHorizontal: Spacing.lg,
          paddingTop: Spacing.xs,
          flexGrow: 1,
        },
        separator: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.border,
          marginLeft: ROW_TEXT_INSET,
        },
        loadingBox: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingVertical: Spacing.xxl,
        },
        emptyContainer: {
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: Spacing.xxl,
          paddingHorizontal: Spacing.lg,
        },
        emptyIcon: {
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: colors.background.elevated,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: Spacing.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.borderLight,
        },
        emptyTitle: {
          fontSize: FontSizes.lg,
          fontWeight: FontWeights.semibold,
          color: colors.text.primary,
          marginBottom: Spacing.xs,
          fontFamily: fonts.semibold,
          textAlign: 'center',
        },
        emptySubtitle: {
          fontSize: FontSizes.sm,
          color: colors.text.secondary,
          textAlign: 'center',
          lineHeight: 20,
          fontFamily: fonts.regular,
        },
      }),
    [colors, fonts]
  );

  const renderSeparator = useCallback(
    () => <View style={styles.separator} />,
    [styles.separator]
  );

  const onRefresh = useCallback(async () => {
    setIsManualRefreshing(true);
    try {
      await Promise.all([
        refetchConversations(),
        queryClient.invalidateQueries({ queryKey: orbitKeys.likesReceived() }),
      ]);
    } finally {
      setIsManualRefreshing(false);
    }
  }, [refetchConversations, queryClient]);

  useFocusEffect(
    useCallback(() => {
      void refetchConversations();
      void queryClient.invalidateQueries({ queryKey: orbitKeys.likesReceived() });
    }, [refetchConversations, queryClient])
  );

  const conversationsWithOther = useMemo(
    () => conversations.filter((c) => c.other_participant || c.kind === 'event'),
    [conversations]
  );

  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return conversationsWithOther;
    return conversationsWithOther.filter((c) => {
      const name = (c.kind === 'event' ? c.name : c.other_participant?.username)?.toLowerCase() ?? '';
      const preview = c.last_message?.content?.toLowerCase() ?? '';
      return name.includes(q) || preview.includes(q);
    });
  }, [conversationsWithOther, searchQuery]);

  const handleConversationPress = (conversationId: string) => {
    router.push(`/chat/${conversationId}`);
  };

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.primary.default} />
        </View>
      );
    }
    const isFiltered = searchQuery.trim().length > 0;
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <Ionicons
            name={isFiltered ? 'search-outline' : 'chatbubbles-outline'}
            size={36}
            color={colors.text.tertiary}
          />
        </View>
        <AppText style={styles.emptyTitle}>
          {isFiltered ? 'No matches' : 'No chats yet'}
        </AppText>
        <AppText style={styles.emptySubtitle}>
          {isFiltered
            ? 'Try a different name or message keyword.'
            : 'Match with someone to start a conversation.'}
        </AppText>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background.primary }]}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.main}>
          <View style={styles.header}>
            <AppText style={styles.screenTitle}>Messages</AppText>
            <TouchableOpacity
              onPress={() => router.push('/search' as never)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.searchIconBtn}
              accessibilityRole="button"
              accessibilityLabel="Find people"
            >
              <Ionicons name="person-add-outline" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchWrap}>
            <Ionicons
              name="search-outline"
              size={20}
              color={colors.text.secondary}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search"
              placeholderTextColor={colors.text.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel="Search chats"
            />
            {searchQuery.length > 0 ? (
              <TouchableOpacity
                style={styles.clearSearch}
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Ionicons name="close-circle" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            ) : null}
          </View>

          <FlatList
            style={styles.listFlex}
            data={filteredConversations}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={JoinRequestsListHeader}
            renderItem={({ item, index }: ListRenderItemInfo<Conversation>) => (
              <ConversationItem
                conversation={item}
                onPress={() => handleConversationPress(item.id)}
                isFirst={index === 0}
              />
            )}
            ItemSeparatorComponent={renderSeparator}
            ListEmptyComponent={renderEmpty}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: Spacing.lg + tabBarHeight },
            ]}
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
        </View>
      </SafeAreaView>
    </View>
  );
}
