/**
 * Find People — search users by name or interest, send connection requests
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FontSizes, FontWeights, Spacing, BorderRadius } from '../constants/Colors';
import { useOrbitTheme } from '../src/theme';
import { Avatar } from '../src/components';
import { AppText } from '../src/ui/AppText';
import {
  useSearchUsersQuery,
  useSendConnectionRequestMutation,
  useLikeUserMutation,
} from '../src/hooks/useOrbitApi';
import type { SearchUserResult } from '../src/types';

// ---------------------------------------------------------------------------
// Orbit action button — derived from each result's orbit state + local cache
// ---------------------------------------------------------------------------

interface OrbitButtonProps {
  item: SearchUserResult;
  pendingIds: Set<string>;
  onConnect: (id: string) => void;
  onAccept: (id: string) => void;
  connectPending: boolean;
  acceptPending: boolean;
  colors: ReturnType<typeof useOrbitTheme>['colors'];
  fonts: ReturnType<typeof useOrbitTheme>['fonts'];
}

function OrbitButton({
  item,
  pendingIds,
  onConnect,
  onAccept,
  connectPending,
  acceptPending,
  colors,
  fonts,
}: OrbitButtonProps) {
  const btnBase: Record<string, object> = {
    connect: {
      paddingHorizontal: Spacing.md,
      paddingVertical: 7,
      borderRadius: BorderRadius.full,
      borderWidth: 1.5,
      borderColor: colors.primary.default,
      alignItems: 'center' as const,
      minWidth: 90,
    },
    requested: {
      paddingHorizontal: Spacing.md,
      paddingVertical: 7,
      borderRadius: BorderRadius.full,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center' as const,
      minWidth: 90,
    },
    accept: {
      paddingHorizontal: Spacing.md,
      paddingVertical: 7,
      borderRadius: BorderRadius.full,
      backgroundColor: colors.primary.default,
      alignItems: 'center' as const,
      minWidth: 90,
    },
    connected: {
      paddingHorizontal: Spacing.md,
      paddingVertical: 7,
      borderRadius: BorderRadius.full,
      backgroundColor: colors.background.tertiary,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 4,
      minWidth: 90,
    },
  };

  const alreadyRequested = pendingIds.has(item.id) || item.orbit.you_sent_join;

  if (item.orbit.matched) {
    return (
      <View style={btnBase.connected}>
        <Ionicons name="checkmark-circle" size={14} color={colors.primary.default} />
        <AppText style={{ fontSize: FontSizes.sm, color: colors.text.secondary, fontFamily: fonts.regular }}>
          Connected
        </AppText>
      </View>
    );
  }

  if (alreadyRequested) {
    return (
      <View style={btnBase.requested}>
        <AppText style={{ fontSize: FontSizes.sm, color: colors.text.tertiary, fontFamily: fonts.regular }}>
          Requested
        </AppText>
      </View>
    );
  }

  if (item.orbit.they_sent_join) {
    return (
      <TouchableOpacity
        style={btnBase.accept}
        onPress={() => onAccept(item.id)}
        disabled={acceptPending}
      >
        <AppText style={{ fontSize: FontSizes.sm, color: '#fff', fontWeight: FontWeights.semibold, fontFamily: fonts.semibold }}>
          Accept
        </AppText>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={btnBase.connect}
      onPress={() => onConnect(item.id)}
      disabled={connectPending}
    >
      <AppText style={{ fontSize: FontSizes.sm, color: colors.primary.default, fontWeight: FontWeights.semibold, fontFamily: fonts.semibold }}>
        Connect
      </AppText>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function SearchScreen() {
  const { colors, fonts } = useOrbitTheme();
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  // Track IDs the user just requested so the button updates immediately
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  // Debounce the search term by 350 ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);

  // Auto-focus input when screen mounts
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(timer);
  }, []);

  const { data: results = [], isLoading, isFetching } = useSearchUsersQuery(debouncedQuery);
  const sendRequest = useSendConnectionRequestMutation();
  const likeUser = useLikeUserMutation();

  const handleConnect = useCallback(
    async (userId: string) => {
      setPendingIds((prev) => new Set([...prev, userId]));
      try {
        await sendRequest.mutateAsync(userId);
      } catch {
        // Roll back the optimistic state and inform user
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
        Alert.alert('Error', 'Could not send request. Please try again.');
      }
    },
    [sendRequest],
  );

  const handleAccept = useCallback(
    async (userId: string) => {
      try {
        await likeUser.mutateAsync(userId);
        // Query invalidation in useLikeUserMutation will refresh search results
      } catch {
        Alert.alert('Error', 'Could not accept request. Please try again.');
      }
    },
    [likeUser],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flex: 1,
          backgroundColor: colors.background.primary,
        },
        safe: { flex: 1 },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: Spacing.lg,
          paddingTop: Spacing.md,
          paddingBottom: Spacing.sm,
          gap: Spacing.md,
        },
        backBtn: {
          width: 36,
          height: 36,
          borderRadius: BorderRadius.full,
          backgroundColor: colors.background.card,
          alignItems: 'center',
          justifyContent: 'center',
        },
        headerTitle: {
          fontSize: FontSizes.xl,
          fontWeight: FontWeights.bold,
          color: colors.text.primary,
          fontFamily: fonts.bold,
        },
        searchBar: {
          flexDirection: 'row',
          alignItems: 'center',
          marginHorizontal: Spacing.lg,
          marginBottom: Spacing.sm,
          backgroundColor: colors.background.secondary,
          borderRadius: BorderRadius.lg,
          paddingHorizontal: Spacing.md,
          paddingVertical: Platform.OS === 'android' ? 6 : 10,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          gap: Spacing.sm,
        },
        searchInput: {
          flex: 1,
          color: colors.text.primary,
          fontSize: FontSizes.md,
          fontFamily: fonts.regular,
          padding: 0,
        },
        hint: {
          color: colors.text.tertiary,
          fontSize: FontSizes.sm,
          textAlign: 'center',
          marginHorizontal: Spacing.xxl,
          marginTop: Spacing.xxl,
          lineHeight: 22,
          fontFamily: fonts.regular,
        },
        listContent: {
          paddingHorizontal: Spacing.lg,
          paddingBottom: 120,
        },
        card: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: Spacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          gap: Spacing.md,
        },
        cardInfo: {
          flex: 1,
          minWidth: 0,
        },
        cardName: {
          fontSize: FontSizes.md,
          fontWeight: FontWeights.semibold,
          color: colors.text.primary,
          fontFamily: fonts.semibold,
        },
        cardBio: {
          fontSize: FontSizes.sm,
          color: colors.text.secondary,
          marginTop: 2,
          fontFamily: fonts.regular,
        },
        interestRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 4,
          marginTop: 5,
        },
        chip: {
          fontSize: FontSizes.xs,
          color: colors.text.tertiary,
          backgroundColor: colors.background.tertiary,
          borderRadius: BorderRadius.sm,
          paddingHorizontal: 6,
          paddingVertical: 2,
          fontFamily: fonts.regular,
        },
        stateWrapper: {
          alignItems: 'center',
          paddingTop: Spacing.xxl,
        },
        stateText: {
          color: colors.text.secondary,
          fontSize: FontSizes.md,
          fontFamily: fonts.regular,
          marginTop: Spacing.md,
          textAlign: 'center',
          marginHorizontal: Spacing.xl,
        },
      }),
    [colors, fonts],
  );

  const renderItem = useCallback(
    ({ item }: { item: SearchUserResult }) => (
      <View style={styles.card}>
        <TouchableOpacity onPress={() => router.push(`/user/${item.id}`)} activeOpacity={0.8}>
          <Avatar
            uri={item.avatar}
            name={item.username}
            size={50}
            showOnline
            isOnline={item.is_online}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cardInfo}
          onPress={() => router.push(`/user/${item.id}`)}
          activeOpacity={0.8}
        >
          <AppText style={styles.cardName}>{item.username}</AppText>
          {item.bio ? (
            <AppText style={styles.cardBio} numberOfLines={1}>
              {item.bio}
            </AppText>
          ) : null}
          {item.interests.length > 0 && (
            <View style={styles.interestRow}>
              {item.interests.slice(0, 3).map((interest) => (
                <AppText key={interest.id} style={styles.chip}>
                  {interest.emoji} {interest.name}
                </AppText>
              ))}
            </View>
          )}
        </TouchableOpacity>

        <OrbitButton
          item={item}
          pendingIds={pendingIds}
          onConnect={handleConnect}
          onAccept={handleAccept}
          connectPending={sendRequest.isPending}
          acceptPending={likeUser.isPending}
          colors={colors}
          fonts={fonts}
        />
      </View>
    ),
    [styles, pendingIds, handleConnect, handleAccept, sendRequest.isPending, likeUser.isPending, colors, fonts],
  );

  const showLoader = (isLoading || isFetching) && debouncedQuery.length >= 2;
  const showEmpty = !showLoader && debouncedQuery.length >= 2 && results.length === 0;
  const showHint = debouncedQuery.length < 2;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={colors.text.primary} />
          </TouchableOpacity>
          <AppText style={styles.headerTitle}>Find People</AppText>
        </View>

        {/* Search input */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={colors.text.tertiary} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Name or interest…"
            placeholderTextColor={colors.text.tertiary}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
          {query.length > 0 && Platform.OS !== 'ios' && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={colors.text.tertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Content states */}
        {showHint ? (
          <AppText style={styles.hint}>
            Search by username, bio, or interest name to find people on Orbit.
          </AppText>
        ) : showLoader ? (
          <View style={styles.stateWrapper}>
            <ActivityIndicator size="small" color={colors.primary.default} />
          </View>
        ) : showEmpty ? (
          <View style={styles.stateWrapper}>
            <Ionicons name="people-outline" size={52} color={colors.text.tertiary} />
            <AppText style={styles.stateText}>
              No people found for "{debouncedQuery}"
            </AppText>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
