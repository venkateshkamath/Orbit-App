import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { format } from 'date-fns';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
  type InfiniteData,
} from '@tanstack/react-query';
import { eventsApi, type CatchupFeedFilter, type PaginatedCatchupsResponse } from '../../src/api/events';
import { searchApi, type OrbitSearchResponse } from '../../src/api/search';
import { orbitKeys } from '../../src/hooks/orbitKeys';
import { useFeedQuery } from '../../src/hooks/useOrbitApi';
import { useDebounce } from '../../src/hooks/useDebounce';
import { CatchupCard } from '../../src/components/CatchupCard';
import { OrbitLoader } from '../../src/components/OrbitLoader';
import { PostCard } from '../../src/components/PostCard';
import { StateView } from '../../src/components/StateView';
import { useAuthStore } from '../../src/stores';
import { useOrbitTheme } from '../../src/theme';
import { AppText } from '../../src/ui/AppText';
import type { OrbitEvent } from '../../src/types';

const ACCENT = '#00B4D8';
const DARK = '#0D0D0D';
const MUTED = '#999999';
const FILTERS: Array<{ key: CatchupFeedFilter; label: string }> = [
  { key: 'near', label: 'Near you' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'popular', label: 'Popular' },
];
const PAGE_SIZE = 10;
type FeedDateRange = { start?: string; end?: string };

function localDayRange(date = new Date()): Required<FeedDateRange> {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

function localWeekRange(date = new Date()): Required<FeedDateRange> {
  const start = new Date(date);
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

function rangeForFilter(filter: CatchupFeedFilter): FeedDateRange {
  if (filter === 'near' || filter === 'popular') return localDayRange();
  if (filter === 'today') return localDayRange();
  if (filter === 'week') return localWeekRange();
  return {};
}

// ─── Segmented pill toggle ───────────────────────────────────────────────────

function SegmentedControl({
  active,
  onChange,
}: {
  active: 'catchups' | 'pulse';
  onChange: (tab: 'catchups' | 'pulse') => void;
}) {
  const [width, setWidth] = useState(0);
  const indicatorX = useSharedValue(0);
  const { colors, shadows, resolvedScheme } = useOrbitTheme();
  const themeSeg = useMemo(
    () =>
      StyleSheet.create({
        container: {
          backgroundColor: colors.background.secondary,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        indicator: {
          backgroundColor: colors.background.card,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.borderLight,
          shadowColor: shadows.md.shadowColor,
          shadowOpacity: resolvedScheme === 'dark' ? 0.28 : 0.08,
        },
        label: {
          color: colors.text.tertiary,
        },
        labelActive: {
          color: colors.text.primary,
        },
      }),
    [colors, resolvedScheme, shadows]
  );

  useEffect(() => {
    if (width === 0) return;
    const segW = (width - 8) / 2;
    indicatorX.value = withSpring(active === 'catchups' ? 0 : segW, {
      damping: 22,
      stiffness: 220,
      mass: 0.8,
    });
  }, [active, width]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }));

  return (
    <View
      style={[seg.container, themeSeg.container]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 ? (
        <Animated.View
          style={[seg.indicator, themeSeg.indicator, { width: (width - 8) / 2 }, indicatorStyle]}
        />
      ) : null}
      {(['catchups', 'pulse'] as const).map((tab) => {
        const isActive = active === tab;
        return (
          <TouchableOpacity
            key={tab}
            style={seg.segment}
            onPress={() => onChange(tab)}
            activeOpacity={0.8}
          >
            <AppText style={[seg.label, themeSeg.label, isActive && themeSeg.labelActive]}>
              {tab === 'catchups' ? 'Catchups' : 'Pulse'}
            </AppText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const seg = StyleSheet.create({
  container: {
    flexDirection:   'row',
    backgroundColor: '#F2F2F2',
    borderRadius:    24,
    padding:         4,
    marginHorizontal: 16,
    marginBottom:    6,
    height:          46,
    position:        'relative',
    flexGrow:        0,
    flexShrink:      0,
  },
  indicator: {
    position:        'absolute',
    top:             4,
    left:            4,
    bottom:          4,
    borderRadius:    20,
    backgroundColor: '#FFFFFF',
    shadowColor:     '#000',
    shadowOpacity:   0.08,
    shadowRadius:    6,
    shadowOffset:    { width: 0, height: 2 },
    elevation:       3,
  },
  segment: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    borderRadius:    20,
    zIndex:          1,
  },
  label: {
    fontSize:   15,
    fontWeight: '600',
    color:      '#999999',
  },
  labelActive: {
    color: '#0D0D0D',
  },
});

// ─── Empty states ─────────────────────────────────────────────────────────────

const EMPTY_COPY: Record<CatchupFeedFilter, { title: string; description: string }> = {
  near:    { title: 'No catchups nearby yet',  description: 'Tap + below to host the first one in your area.' },
  today:   { title: 'Nothing happening today', description: 'Be the first — tap + to plan something for today.' },
  week:    { title: 'A quiet week ahead',       description: 'Plan something and others nearby will discover it.' },
  popular: { title: 'Nothing trending yet',     description: 'Your area is just getting started. Create the first buzz.' },
};

function CatchupEmptyState({ filter }: { filter: CatchupFeedFilter }) {
  const copy = EMPTY_COPY[filter] ?? EMPTY_COPY.near;
  return (
    <StateView
      type="empty"
      icon="calendar-outline"
      title={copy.title}
      description={copy.description}
      style={styles.emptyState}
    />
  );
}

export default function FeedScreen() {
  const currentUser = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { colors, resolvedScheme } = useOrbitTheme();
  const [activeTab, setActiveTab] = useState<'catchups' | 'pulse'>('catchups');
  const [filter, setFilter] = useState<CatchupFeedFilter>('near');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<OrbitSearchResponse>({ catchups: [], posts: [], people: [], places: [] });
  const listRef = useRef<FlatList<OrbitEvent>>(null);
  const searchRequestRef = useRef(0);
  // Track whether the current data is from the initial load (for stagger animation)
  const isInitialLoadRef = useRef(true);

  const areaName = currentUser?.city || 'Near you';
  const debouncedSearchQuery = useDebounce(searchQuery.trim(), 260);
  const searchTrendRange = useMemo(() => localDayRange(), []);

  // Key structure: [...orbitKeys.eventsFeed(), filter]
  // The base ['orbit','events','feed'] matches what CreateFAB invalidates,
  // so new events appear immediately after creation.
  const filterRange = rangeForFilter(filter);
  const feedQueryKey = useMemo(
    () => [...orbitKeys.eventsFeed(), filter, filterRange.start ?? null, filterRange.end ?? null] as const,
    [filter, filterRange.end, filterRange.start]
  );

  const {
    data: feedData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isFetching,
    isRefetching,
    refetch,
  } = useInfiniteQuery({
    queryKey: feedQueryKey,
    queryFn: ({ pageParam }) =>
      eventsApi.getFeed({ filter, ...filterRange, page: pageParam as number, limit: PAGE_SIZE }),
    getNextPageParam: (last: PaginatedCatchupsResponse) =>
      last.pagination?.has_more ? (last.pagination.page + 1) : undefined,
    initialPageParam: 1,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    isInitialLoadRef.current = true;
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [activeTab, filter]);

  const catchups = useMemo(() => {
    const flat = feedData?.pages.flatMap((p) => p.results) ?? [];
    const seen = new Set<string>();
    return flat.filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });
  }, [feedData]);

  // Mark initial load done synchronously during render (not in useEffect)
  // so cards rendered after the first batch don't get the entrance animation.
  if (catchups.length > 0 && isInitialLoadRef.current) {
    isInitialLoadRef.current = false;
  }

  // Pulse tab — React Query (enabled only when tab is active so no wasted requests)
  const {
    data: posts = [],
    isLoading: postsLoading,
    isRefetching: postsRefetching,
    refetch: refetchPosts,
  } = useFeedQuery();

  const { data: searchTrendData } = useQuery({
    queryKey: [
      ...orbitKeys.eventsFeed(),
      'search-trending',
      currentUser?.city ?? null,
      currentUser?.latitude ?? null,
      currentUser?.longitude ?? null,
      searchTrendRange.start,
      searchTrendRange.end,
    ],
    queryFn: () => eventsApi.getFeed({
      filter: 'popular',
      ...searchTrendRange,
      page: 1,
      limit: 4,
    }),
    enabled: searchOpen,
    staleTime: 30 * 1000,
  });

  const trendingCatchups = useMemo(() => (
    [...(searchTrendData?.results ?? [])]
      .sort((a, b) => {
        const demand = (b.attendee_count ?? 0) - (a.attendee_count ?? 0);
        if (demand !== 0) return demand;
        return new Date(a.start_at).getTime() - new Date(b.start_at).getTime();
      })
      .slice(0, 4)
  ), [searchTrendData?.results]);

  const recentPulse = useMemo(() => posts.slice(0, 3), [posts]);

  const searchIdeas = useMemo(() => {
    const city = currentUser?.city?.trim();
    return [
      city ? `${city} catchups` : 'catchups near me',
      'music today',
      'running',
      'coffee',
    ];
  }, [currentUser?.city]);
  const isDark = resolvedScheme === 'dark';
  const themed = useMemo(
    () => ({
      screen: { backgroundColor: colors.background.primary },
      header: { backgroundColor: colors.background.primary },
      searchBar: {
        backgroundColor: colors.background.secondary,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
      },
      iconMuted: colors.text.tertiary,
      textMuted: colors.text.muted,
      textSecondary: colors.text.secondary,
      rowSurface: {
        backgroundColor: colors.background.card,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.borderLight,
      },
      subtleSurface: {
        backgroundColor: colors.background.secondary,
      },
      filterPill: {
        backgroundColor: colors.background.secondary,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
      },
      filterPillActive: {
        backgroundColor: colors.text.primary,
        borderColor: colors.text.primary,
      },
      filterTextActive: {
        color: colors.background.primary,
      },
      overlay: {
        backgroundColor: isDark ? 'rgba(5,8,13,0.78)' : 'rgba(255,255,255,0.72)',
      },
    }),
    [colors, isDark]
  );

  useEffect(() => {
    if (!searchOpen) return;

    if (debouncedSearchQuery.length < 2) {
      searchRequestRef.current += 1;
      setSearchResults({ catchups: [], posts: [], people: [], places: [] });
      setSearchLoading(false);
      setSearchError(null);
      return;
    }

    const requestId = searchRequestRef.current + 1;
    searchRequestRef.current = requestId;
    const controller = new AbortController();
    setSearchLoading(true);
    setSearchError(null);
    setSearchResults({ catchups: [], posts: [], people: [], places: [] });

    searchApi.search(debouncedSearchQuery, 'all', { limit: 8, signal: controller.signal })
      .then((results) => {
        if (searchRequestRef.current !== requestId) return;
        setSearchResults(results);
      })
      .catch((error) => {
        if (controller.signal.aborted || error?.code === 'ERR_CANCELED') return;
        if (searchRequestRef.current !== requestId) return;
        console.warn('[FeedSearch] search failed', error);
        setSearchResults({ catchups: [], posts: [], people: [], places: [] });
        setSearchError('Search is having trouble. Try again.');
      })
      .finally(() => {
        if (searchRequestRef.current === requestId) {
          setSearchLoading(false);
        }
      });

    return () => controller.abort();
  }, [debouncedSearchQuery, searchOpen]);

  const joinMutation = useMutation({
    mutationFn: (event: OrbitEvent) =>
      eventsApi.joinCatchup(event.id).catch(() => eventsApi.join(event.id)),
    onMutate: async (event: OrbitEvent) => {
      await queryClient.cancelQueries({ queryKey: feedQueryKey });
      const previous = queryClient.getQueryData(feedQueryKey);
      // Optimistic update: mark event as joined, bump attendee count
      queryClient.setQueryData(
        feedQueryKey,
        (old: InfiniteData<PaginatedCatchupsResponse> | undefined) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              results: page.results.map((e) =>
                e.id === event.id
                  ? { ...e, has_joined: true, attendee_count: e.attendee_count + 1 }
                  : e
              ),
            })),
          };
        }
      );
      return { previous };
    },
    onError: (_err, _event, context) => {
      if (context?.previous) {
        queryClient.setQueryData(feedQueryKey, context.previous);
      }
    },
    onSuccess: (result) => {
      router.push(`/chat/${result.conversation_id}`);
    },
  });

  const handleJoin = useCallback(
    (event: OrbitEvent) => { joinMutation.mutate(event); },
    [joinMutation]
  );

  const openSearch = useCallback(() => {
    setSearchOpen(true);
  }, []);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery('');
    setSearchLoading(false);
    setSearchError(null);
    setSearchResults({ catchups: [], posts: [], people: [], places: [] });
    searchRequestRef.current += 1;
  }, []);

  const openCatchup = useCallback((id: string) => {
    closeSearch();
    router.push(`/event/${id}`);
  }, [closeSearch]);

  const openUser = useCallback((id: string) => {
    closeSearch();
    router.push(`/user/${id}`);
  }, [closeSearch]);

  const applySearchText = useCallback((text: string) => {
    setSearchQuery(text);
  }, []);

  const usePlaceSuggestion = useCallback((place: OrbitSearchResponse['places'][number]) => {
    setSearchQuery(place.city || place.name || place.display_name || '');
  }, []);

  const totalSearchResults =
    searchResults.catchups.length + searchResults.posts.length + searchResults.people.length + searchResults.places.length;
  const searchReady = debouncedSearchQuery.length >= 2;
  const showSearchEmpty = searchReady && !searchLoading && !searchError && totalSearchResults === 0;
  const showSearchSuggestions = !searchReady && !searchError;

  const refresh = () => {
    isInitialLoadRef.current = true;
    if (activeTab === 'catchups') void refetch();
    else void refetchPosts();
  };

  const header = (
    <View style={[styles.header, themed.header]}>
      <View style={styles.logoRow}>
        <AppText style={[styles.logo, { color: colors.primary.default }]}>orbit</AppText>
        <TouchableOpacity style={[styles.locationPill, { borderColor: colors.borderLight, backgroundColor: colors.background.card }]} onPress={() => undefined}>
          <AppText style={[styles.locationText, { color: colors.text.secondary }]}>📍 {areaName}</AppText>
        </TouchableOpacity>
      </View>
      <Pressable style={[styles.searchBar, themed.searchBar]} onPress={openSearch}>
        <Ionicons name="search" size={18} color={themed.iconMuted} />
        <AppText style={[styles.searchPlaceholder, { color: colors.text.muted }]}>Search catchups, people, places...</AppText>
        <TouchableOpacity style={[styles.filterBtn, themed.subtleSurface]} onPress={() => undefined}>
          <Ionicons name="options-outline" size={20} color={colors.text.secondary} />
        </TouchableOpacity>
      </Pressable>
    </View>
  );

  // Filter chips — only rendered under the Catchups tab
  const filterRail = (
    <View style={styles.filterRailFrame}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRail}
        style={styles.filterRailScroll}
        bounces={false}
        alwaysBounceVertical={false}
      >
        {FILTERS.map((pill) => (
          <TouchableOpacity
            key={pill.key}
            style={[styles.filterPill, themed.filterPill, filter === pill.key && themed.filterPillActive]}
            onPress={() => setFilter(pill.key)}
          >
            <AppText style={[styles.filterText, { color: colors.text.secondary }, filter === pill.key && themed.filterTextActive]}>
              {pill.label}
            </AppText>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const searchModal = (
    <Modal visible={searchOpen} animationType="fade" onRequestClose={closeSearch}>
      <View style={[styles.searchScreen, themed.screen]}>
        <View style={[styles.searchTop, { paddingTop: insets.top + 12 }]}>
          <View style={[styles.searchBar, styles.searchBarExpanded, themed.searchBar]}>
            <Ionicons name="search" size={18} color={themed.iconMuted} />
            <TextInput
              autoFocus
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={[styles.searchInput, { color: colors.text.primary }]}
              placeholder="Search catchups, people, places..."
              placeholderTextColor={colors.text.muted}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {searchLoading ? (
              <ActivityIndicator size="small" color={ACCENT} />
            ) : searchQuery.length > 0 ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colors.text.tertiary} />
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity style={styles.cancelBtn} onPress={closeSearch} hitSlop={8}>
            <AppText style={[styles.cancelText, { color: colors.primary.default }]}>Cancel</AppText>
          </TouchableOpacity>
        </View>
        <ScrollView
          contentContainerStyle={[styles.searchResults, showSearchSuggestions && styles.searchResultsSuggestions]}
          keyboardShouldPersistTaps="handled"
        >
          {showSearchSuggestions ? (
            <View style={styles.suggestionsWrap}>
              {trendingCatchups.length ? <AppText style={[styles.sectionHeader, { color: colors.text.tertiary }]}>Trending near you</AppText> : null}
              {trendingCatchups.map((item) => (
                <TouchableOpacity key={`trend-c-${item.id}`} style={[styles.suggestionRow, themed.rowSurface]} onPress={() => openCatchup(item.id)}>
                  <View style={[styles.suggestionIcon, themed.subtleSurface]}>
                    <Ionicons name="flame-outline" size={18} color={colors.primary.default} />
                  </View>
                  <View style={styles.userInfo}>
                    <AppText style={[styles.searchMiniTitle, { color: colors.text.primary }]} numberOfLines={1}>{item.title}</AppText>
                    <AppText style={[styles.searchMiniSub, { color: colors.text.tertiary }]} numberOfLines={1}>
                      {item.location_name || item.city || 'Nearby'} · {item.attendee_count}/{item.max_people ?? 10} going
                    </AppText>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
                </TouchableOpacity>
              ))}

              {recentPulse.length ? <AppText style={[styles.sectionHeader, { color: colors.text.tertiary }]}>Fresh pulse</AppText> : null}
              {recentPulse.map((item) => (
                <View key={`trend-p-${item.id}`} style={[styles.suggestionRow, themed.rowSurface]}>
                  <View style={[styles.suggestionIcon, themed.subtleSurface]}>
                    <Ionicons name="images-outline" size={18} color={colors.primary.default} />
                  </View>
                  <View style={styles.userInfo}>
                    <AppText style={[styles.searchMiniTitle, { color: colors.text.primary }]} numberOfLines={1}>{item.caption || 'Photo post'}</AppText>
                    <AppText style={[styles.searchMiniSub, { color: colors.text.tertiary }]} numberOfLines={1}>@{item.author.username}</AppText>
                  </View>
                </View>
              ))}

              <AppText style={[styles.sectionHeader, { color: colors.text.tertiary }]}>Try searching</AppText>
              {searchIdeas.map((idea) => (
                <TouchableOpacity key={idea} style={[styles.suggestionRow, themed.rowSurface]} onPress={() => applySearchText(idea)}>
                  <View style={[styles.suggestionIcon, themed.subtleSurface]}>
                    <Ionicons name="search-outline" size={18} color={colors.primary.default} />
                  </View>
                  <View style={styles.userInfo}>
                    <AppText style={[styles.searchMiniTitle, { color: colors.text.primary }]}>{idea}</AppText>
                    <AppText style={[styles.searchMiniSub, { color: colors.text.tertiary }]}>Search all catchups, people, posts, and places</AppText>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          {searchError ? (
            <View style={styles.searchState}>
              <Ionicons name="alert-circle-outline" size={36} color={colors.error} />
              <AppText style={[styles.searchStateTitle, { color: colors.text.secondary }]}>{searchError}</AppText>
            </View>
          ) : null}
          {showSearchEmpty ? (
            <View style={styles.searchState}>
              <Ionicons name="search-outline" size={38} color={colors.text.tertiary} />
              <AppText style={[styles.searchStateTitle, { color: colors.text.secondary }]}>No results for "{debouncedSearchQuery}"</AppText>
            </View>
          ) : null}
          {searchResults.catchups.length ? <AppText style={[styles.sectionHeader, { color: colors.text.tertiary }]}>Catchups</AppText> : null}
          {searchResults.catchups.map((item) => (
            <TouchableOpacity key={`c-${item.id}`} style={[styles.searchMini, themed.rowSurface]} onPress={() => openCatchup(item.id)}>
              <AppText style={[styles.searchMiniTitle, { color: colors.text.primary }]}>{item.title}</AppText>
              <AppText style={[styles.searchMiniSub, { color: colors.text.tertiary }]}>{item.location_name} · {format(new Date(item.start_at), 'MMM d, h:mm a')}</AppText>
            </TouchableOpacity>
          ))}
          {searchResults.places.length ? <AppText style={[styles.sectionHeader, { color: colors.text.tertiary }]}>Places</AppText> : null}
          {searchResults.places.map((item, index) => (
            <TouchableOpacity
              key={`place-${item.id ?? `${item.lat}-${item.lng}-${index}`}`}
              style={[styles.placeRow, themed.rowSurface]}
              onPress={() => usePlaceSuggestion(item)}
            >
              <View style={[styles.placeIcon, themed.subtleSurface]}>
                <Ionicons name="location-outline" size={18} color={colors.primary.default} />
              </View>
              <View style={styles.userInfo}>
                <AppText style={[styles.searchMiniTitle, { color: colors.text.primary }]} numberOfLines={1}>{item.name || item.display_name}</AppText>
                <AppText style={[styles.searchMiniSub, { color: colors.text.tertiary }]} numberOfLines={2}>{item.city || item.address || item.display_name}</AppText>
              </View>
              <Ionicons name="search-outline" size={17} color={colors.text.tertiary} />
            </TouchableOpacity>
          ))}
          {searchResults.posts.length ? <AppText style={[styles.sectionHeader, { color: colors.text.tertiary }]}>Posts</AppText> : null}
          {searchResults.posts.map((item) => (
            <View key={`p-${item.id}`} style={[styles.searchMini, themed.rowSurface]}>
              <AppText style={[styles.searchMiniTitle, { color: colors.text.primary }]} numberOfLines={1}>{item.caption || 'Photo post'}</AppText>
              <AppText style={[styles.searchMiniSub, { color: colors.text.tertiary }]}>@{item.author.username}</AppText>
            </View>
          ))}
          {searchResults.people.length ? <AppText style={[styles.sectionHeader, { color: colors.text.tertiary }]}>People</AppText> : null}
          {searchResults.people.map((item) => (
            <TouchableOpacity key={`u-${item.id}`} style={[styles.userRow, themed.rowSurface]} onPress={() => openUser(item.id)}>
              <View style={[styles.userAvatar, themed.subtleSurface]}>
                {item.avatar ? (
                  <Image source={{ uri: item.avatar }} style={styles.userAvatarImage} contentFit="cover" />
                ) : (
                  <AppText style={[styles.userInitial, { color: colors.primary.default }]}>{item.username.charAt(0).toUpperCase()}</AppText>
                )}
              </View>
              <View style={styles.userInfo}>
                <AppText style={[styles.searchMiniTitle, { color: colors.text.primary }]}>@{item.username}</AppText>
                <AppText style={[styles.searchMiniSub, { color: colors.text.tertiary }]}>{item.city || 'Nearby'}</AppText>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );

  return (
    <View style={[styles.container, themed.screen]}>
      <SafeAreaView edges={['top']} style={[styles.safe, themed.screen]}>
        {header}
        <SegmentedControl active={activeTab} onChange={setActiveTab} />
        {activeTab === 'catchups' ? filterRail : null}

        {/* ── Catchups tab ── */}
        {activeTab === 'catchups' ? (
          catchups.length === 0 && !isLoading ? (
            <View style={[styles.emptyContainer, { paddingBottom: tabBarHeight + 16 }]}>
              <CatchupEmptyState filter={filter} />
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={catchups}
              style={styles.list}
              keyExtractor={(item, idx) => item.id ? `catchup-${item.id}` : `catchup-${idx}`}
              contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: tabBarHeight + 16 }}
              renderItem={({ item, index }) => (
                <CatchupCard
                  event={item}
                  onJoin={handleJoin}
                  isInitialLoad={isInitialLoadRef.current}
                  index={index}
                />
              )}
              refreshControl={
                <RefreshControl
                  refreshing={isRefetching && !isFetchingNextPage}
                  onRefresh={refresh}
                  tintColor={ACCENT}
                  colors={[ACCENT]}
                />
              }
              onEndReached={() => {
                if (!isFetchingNextPage && hasNextPage) void fetchNextPage();
              }}
              onEndReachedThreshold={0.4}
              ListFooterComponent={isFetchingNextPage ? <OrbitLoader variant="inline" /> : null}
            />
          )
        ) : null}

        {/* ── Pulse tab ── */}
        {activeTab === 'pulse' ? (
          posts.length === 0 && !postsLoading ? (
            <View style={[styles.emptyContainer, { paddingBottom: tabBarHeight + 16 }]}>
              <StateView
                type="empty"
                icon="images-outline"
                title="No posts nearby yet"
                description="Posts from people around you will appear here."
              />
            </View>
          ) : (
            <FlatList
              data={posts}
              style={styles.list}
              keyExtractor={(item) => `post-${item.id}`}
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingTop: 10,
                paddingBottom: tabBarHeight + 16,
              }}
              renderItem={({ item }) => <PostCard post={item} />}
              refreshControl={
                <RefreshControl
                  refreshing={postsRefetching}
                  onRefresh={refresh}
                  tintColor={ACCENT}
                  colors={[ACCENT]}
                />
              }
              ListFooterComponent={postsLoading ? <OrbitLoader variant="inline" /> : null}
            />
          )
        ) : null}
      </SafeAreaView>
      {isLoading && activeTab === 'catchups' ? (
        <View style={[styles.loadingOverlay, themed.overlay]}><OrbitLoader /></View>
      ) : null}
      {isFetching && !isLoading && !isFetchingNextPage && activeTab === 'catchups' ? (
        <View style={styles.filterFetchBar} />
      ) : null}
      {searchModal}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  list: { flex: 1 },
  emptyContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 44,
    paddingHorizontal: 16,
  },
  header: { paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#FFFFFF' },
  logoRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logo: { color: ACCENT, fontSize: 24, fontWeight: '700' },
  locationPill: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  locationText: { color: '#555555', fontSize: 13, fontWeight: '500' },
  searchBar: { height: 46, borderRadius: 14, backgroundColor: '#F5F5F5', flexDirection: 'row', alignItems: 'center', paddingLeft: 14, paddingRight: 5, gap: 9 },
  searchPlaceholder: { flex: 1, color: '#BBBBBB', fontSize: 14 },
  filterBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' },
  filterRailFrame: {
    height: 46,
    flexGrow: 0,
    flexShrink: 0,
    marginBottom: 6,
    overflow: 'hidden',
  },
  filterRailScroll: {
    height: 46,
    maxHeight: 46,
    flexGrow: 0,
    flexShrink: 0,
  },
  filterRail: {
    minHeight: 46,
    gap: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  filterPill: {
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 18,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPillActive: { backgroundColor: DARK },
  filterText: { color: '#555555', fontSize: 13, fontWeight: '500' },
  filterTextActive: { color: '#FFFFFF' },
  emptyState: { minHeight: 260 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.72)', alignItems: 'center', justifyContent: 'center' },
  filterFetchBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: ACCENT, opacity: 0.7 },
  searchScreen: { flex: 1, backgroundColor: '#FFFFFF' },
  searchTop: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 12, gap: 10 },
  searchBarExpanded: { flex: 1, minWidth: 0 },
  searchInput: { flex: 1, minWidth: 0, color: DARK, fontSize: 14, padding: 0 },
  cancelBtn: { width: 64, height: 46, alignItems: 'flex-end', justifyContent: 'center', flexShrink: 0 },
  cancelText: { color: ACCENT, fontSize: 14, fontWeight: '700' },
  searchResults: { paddingHorizontal: 20, paddingBottom: 30 },
  searchResultsSuggestions: { paddingTop: 2 },
  searchState: { minHeight: 210, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  searchStateTitle: { marginTop: 10, color: '#687A86', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  sectionHeader: { color: MUTED, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginTop: 18, marginBottom: 8, letterSpacing: 0.8 },
  suggestionsWrap: { paddingBottom: 8 },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, backgroundColor: '#F7F7F7', marginBottom: 8 },
  suggestionIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E8F6FA', alignItems: 'center', justifyContent: 'center' },
  searchMini: { padding: 14, borderRadius: 14, backgroundColor: '#F7F7F7', marginBottom: 8 },
  searchMiniTitle: { color: DARK, fontSize: 14, fontWeight: '700' },
  searchMiniSub: { color: MUTED, fontSize: 12, marginTop: 3 },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, backgroundColor: '#F7F7F7', marginBottom: 8 },
  placeIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E8F6FA', alignItems: 'center', justifyContent: 'center' },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, backgroundColor: '#F7F7F7', marginBottom: 8 },
  userAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E8F6FA', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  userAvatarImage: { width: 34, height: 34, borderRadius: 17 },
  userInfo: { flex: 1, minWidth: 0 },
  userInitial: { color: ACCENT, fontWeight: '800' },
});
