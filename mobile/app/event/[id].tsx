import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import ImageViewing from 'react-native-image-viewing';
import { useQueryClient } from '@tanstack/react-query';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { format, isSameDay } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../src/ui/AppText';
import { CreateFAB } from '../../src/components/CreateFAB';
import { OrbitLoader } from '../../src/components/OrbitLoader';
import { StateView } from '../../src/components/StateView';
import { useDeleteCatchupMutation, useEventQuery, useJoinEventMutation, useLeaveEventMutation } from '../../src/hooks/useOrbitApi';
import { orbitKeys } from '../../src/hooks/orbitKeys';
import { useToast } from '../../src/context/ToastContext';
import { useAuthStore } from '../../src/stores/authStore';
import { useOrbitTheme } from '../../src/theme';
import { API_BASE_URL } from '../../src/api/client';
import type { OrbitEvent, User } from '../../src/types';
import {
  ACCENT,
  CARD_BG,
  CARD_BORDER,
  CATEGORY_STYLES,
  DARK,
  DEFAULT_CATEGORY_STYLE,
  nameToAvatarColor,
  type CategoryStyle,
} from '../../src/constants/designTokens';

const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');
const MUTED = '#8A8A8A';
const FAINT = '#BBBBBB';
const ERROR = '#EF4444';
const SUCCESS = '#22C55E';
const ACCENT_SOON = '#0094B0';
const JOINED_BG = '#E8F6FA';
const JOINED_TEXT = '#00A4C4';
const FULL_BG = '#F5F5F5';
const FULL_TEXT = '#999999';
const COVER_BLURHASH = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';
const MAX_VISIBLE_ATTENDEE_CHIPS = 4;

function mediaUrl(url?: string | null): string | null {
  if (!url) return null;
  const value = String(url).trim();
  if (!value) return null;
  if (/^(https?:|file:|content:|data:)/i.test(value)) return value;
  const normalized = value.replace(/^\/+/, '');
  const mediaPath = normalized.startsWith('media/') ? normalized : `media/${normalized}`;
  return `${API_ORIGIN}/${mediaPath}`;
}

function resolveCategory(event: OrbitEvent): CategoryStyle & { label: string } {
  const key = (event.custom_category || event.category || 'social').toLowerCase();
  return CATEGORY_STYLES[key] ?? { ...DEFAULT_CATEGORY_STYLE, label: event.custom_category || 'Other' };
}

function isCompleted(event: OrbitEvent): boolean {
  if (typeof event.is_completed === 'boolean') return event.is_completed;
  const endOrStart = new Date(event.end_at || event.start_at);
  return !Number.isNaN(endOrStart.getTime()) && endOrStart.getTime() < Date.now();
}

function formatEventTime(event: OrbitEvent): string {
  const start = new Date(event.start_at);
  const end = event.end_at ? new Date(event.end_at) : null;
  if (!end || Number.isNaN(end.getTime())) return format(start, 'EEE, MMM d · h:mm a');
  if (isSameDay(start, end)) return `${format(start, 'EEE, MMM d · h:mm a')} - ${format(end, 'h:mm a')}`;
  return `${format(start, 'MMM d, h:mm a')} - ${format(end, 'MMM d, h:mm a')}`;
}

function resolveUrgency(event: OrbitEvent): {
  label: string;
  color: string;
  weight: '500' | '600';
  showDot: boolean;
  isSoon: boolean;
} {
  const start = new Date(event.start_at);
  const diffMin = Math.round((start.getTime() - Date.now()) / 60000);
  if (isCompleted(event)) {
    return { label: 'Ended', color: ERROR, weight: '600', showDot: false, isSoon: false };
  }
  if (diffMin >= 0 && diffMin <= 30) {
    return { label: `In ${diffMin} min`, color: ACCENT_SOON, weight: '600', showDot: true, isSoon: true };
  }
  if (isSameDay(start, new Date())) {
    return { label: `Today, ${format(start, 'h:mm a')}`, color: DARK, weight: '600', showDot: false, isSoon: false };
  }
  return { label: format(start, 'EEE, MMM d · h:mm a'), color: MUTED, weight: '500', showDot: false, isSoon: false };
}

function formatDistance(distance?: number | null): string | null {
  if (distance == null || !Number.isFinite(distance)) return null;
  if (distance < 1000) return `${Math.round(distance)} m`;
  return `${(distance / 1000).toFixed(1)} km`;
}

function completedJoinLabel(attendeeCount: number): string {
  if (attendeeCount <= 0) return 'No one joined';
  return attendeeCount === 1 ? '1 person joined' : `${attendeeCount} people joined`;
}

function morePeopleLabel(count: number): string {
  return count === 1 ? '+1 more person' : `+${count} more people`;
}

function shouldShowGoogleMapsLink(event?: OrbitEvent | null): boolean {
  return Boolean(event && googleMapsQuery(event));
}

function googleMapsQuery(event: OrbitEvent): string | null {
  if (event.location_source === 'manual') {
    return event.address || event.location_name || event.city || null;
  }
  if (Number.isFinite(event.latitude) && Number.isFinite(event.longitude)) {
    return `${event.latitude},${event.longitude}`;
  }
  return event.address || event.location_name || event.city || null;
}

function compactAgo(date: Date): string {
  const diffMs = Math.max(Date.now() - date.getTime(), 0);
  const min = Math.max(Math.round(diffMs / 60000), 1);
  if (min < 60) return `${min}m ago`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  return `${weeks}w ago`;
}

function hostStatus(organizer: NonNullable<OrbitEvent['organizer']>): {
  online: boolean;
  label: string;
} {
  if (organizer.is_online) return { online: true, label: 'Active now' };
  if (organizer.last_seen) {
    return {
      online: false,
      label: `Active ${compactAgo(new Date(organizer.last_seen))}`,
    };
  }
  return { online: false, label: 'Active recently' };
}

function avatarUrl(url?: string | null): string | null {
  return mediaUrl(url);
}

type AttendeePreview = NonNullable<OrbitEvent['attendees_preview']>[number];

const DEV_ATTENDEE_PREVIEW: AttendeePreview[] = [
  { id: 'mock-attendee-vivek', username: 'Vivek', avatar: null },
  { id: 'mock-attendee-priya', username: 'Priya', avatar: null },
  { id: 'mock-attendee-rahul', username: 'Rahul', avatar: null },
  { id: 'mock-attendee-neha', username: 'Neha', avatar: null },
  { id: 'mock-attendee-meera', username: 'Meera', avatar: null },
];

function attendeeFromUser(user: User | null): AttendeePreview | null {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    avatar: user.avatar,
  };
}

function updateSpots(event: OrbitEvent, attendeeCount: number): OrbitEvent {
  const maxPeople = event.max_people ?? 10;
  return {
    ...event,
    attendee_count: attendeeCount,
    spots_left: Math.max(maxPeople - attendeeCount, 0),
  };
}

function optimisticJoin(event: OrbitEvent, user: User | null): OrbitEvent {
  const viewer = attendeeFromUser(user);
  const preview = event.attendees_preview ?? [];
  const hasViewer = viewer ? preview.some((attendee) => attendee.id === viewer.id) : true;
  const nextPreview = viewer && !hasViewer ? [...preview, viewer].slice(0, 8) : preview;
  return updateSpots({
    ...event,
    has_joined: true,
    attendees_preview: nextPreview,
  }, event.has_joined ? event.attendee_count : event.attendee_count + 1);
}

function optimisticLeave(event: OrbitEvent, userId?: string): OrbitEvent {
  const preview = (event.attendees_preview ?? []).filter((attendee) => attendee.id !== userId);
  return updateSpots({
    ...event,
    has_joined: false,
    attendees_preview: preview,
  }, event.has_joined ? Math.max(event.attendee_count - 1, 0) : event.attendee_count);
}

function AvatarBubble({
  name,
  uri,
  size = 42,
  overlap = false,
}: {
  name: string;
  uri?: string | null;
  size?: number;
  overlap?: boolean;
}) {
  const { colors: themeColors } = useOrbitTheme();
  const colors = useMemo(() => nameToAvatarColor(name), [name]);
  const resolvedUri = useMemo(() => avatarUrl(uri), [uri]);

  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.bg,
          marginLeft: overlap ? -9 : 0,
          borderColor: themeColors.background.card,
        },
      ]}
    >
      {resolvedUri ? (
        <Image source={{ uri: resolvedUri }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />
      ) : (
        <AppText style={[styles.avatarInitial, { color: colors.text, fontSize: size * 0.38 }]}>
          {name.charAt(0).toUpperCase()}
        </AppText>
      )}
    </View>
  );
}

function InitialBubble({ name, size = 28 }: { name: string; size?: number }) {
  const colors = useMemo(() => nameToAvatarColor(name), [name]);
  return (
    <View
      style={[
        styles.initialBubble,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.bg,
        },
      ]}
    >
      <AppText style={[styles.initialBubbleText, { color: colors.text, fontSize: size * 0.42 }]}>
        {name.charAt(0).toUpperCase()}
      </AppText>
    </View>
  );
}

function NavIconButton({
  icon,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        style={styles.navButton}
        onPressIn={() => {
          scale.value = withSpring(0.9, { damping: 14, stiffness: 260 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 14, stiffness: 260 });
        }}
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
      >
        <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFillObject} />
        <Ionicons name={icon} size={22} color="#FFFFFF" />
      </Pressable>
    </Animated.View>
  );
}

export default function EventDetailScreen() {
  const { id: rawId, mockPeople } = useLocalSearchParams<{ id?: string | string[]; mockPeople?: string | string[] }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const mockPeopleEnabled = __DEV__ && (Array.isArray(mockPeople) ? mockPeople[0] : mockPeople) === '1';
  const insets = useSafeAreaInsets();
  const { colors, resolvedScheme, shadows } = useOrbitTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const { data: event, isPending, isError, refetch } = useEventQuery(id);
  const joinEvent = useJoinEventMutation();
  const leaveEvent = useLeaveEventMutation();
  const deleteCatchup = useDeleteCatchupMutation();
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const fillProgress = useSharedValue(0);
  const urgencyOpacity = useSharedValue(1);
  const aboutProgress = useSharedValue(0);
  const ctaScale = useSharedValue(1);
  const hostEditScale = useSharedValue(1);
  const isDark = resolvedScheme === 'dark';
  const theme = useMemo(
    () =>
      StyleSheet.create({
        screen: {
          backgroundColor: colors.background.primary,
        },
        card: {
          backgroundColor: colors.background.card,
          borderColor: colors.borderLight,
          shadowColor: shadows.md.shadowColor,
          shadowOpacity: isDark ? 0.34 : 0.05,
        },
        subtleCard: {
          backgroundColor: colors.background.secondary,
          borderColor: colors.border,
        },
        textPrimary: {
          color: colors.text.primary,
        },
        textSecondary: {
          color: colors.text.secondary,
        },
        textTertiary: {
          color: colors.text.tertiary,
        },
        textMuted: {
          color: colors.text.muted,
        },
        actionBar: {
          backgroundColor: colors.background.card,
          borderTopColor: colors.border,
        },
        softAccent: {
          backgroundColor: colors.primary.default + (isDark ? '24' : '18'),
          borderColor: colors.primary.default + '44',
        },
        disabledSurface: {
          backgroundColor: colors.background.secondary,
        },
        modalScrim: {
          backgroundColor: isDark ? 'rgba(5,8,13,0.52)' : 'rgba(13,13,13,0.24)',
        },
      }),
    [colors, isDark, shadows]
  );

  const gallery = useMemo(() => {
    const photos = (event?.photos ?? []).map((photo) => mediaUrl(photo.url)).filter(Boolean) as string[];
    if (photos.length > 0) return photos;
    return [mediaUrl(event?.image_url)].filter(Boolean) as string[];
  }, [event?.image_url, event?.photos]);

  const category = useMemo(() => (event ? resolveCategory(event) : DEFAULT_CATEGORY_STYLE), [event]);
  const urgency = useMemo(() => (event ? resolveUrgency(event) : null), [event]);
  const distanceLabel = useMemo(() => formatDistance(event?.distance_m), [event?.distance_m]);
  const canOpenGoogleMaps = useMemo(() => shouldShowGoogleMapsLink(event), [event]);
  const coverIndex = useMemo(() => {
    if (!event || gallery.length === 0) return 0;
    return Math.min(event.cover_photo_index ?? 0, Math.max(gallery.length - 1, 0));
  }, [event, gallery.length]);
  const coverUrl = useMemo(() => {
    if (!event) return null;
    return mediaUrl(event.image_url)
      ?? gallery[coverIndex]
      ?? gallery[0]
      ?? null;
  }, [coverIndex, event, gallery]);
  const viewerImages = useMemo(() => gallery.map((uri) => ({ uri })), [gallery]);
  const detailGallery = useMemo(
    () => gallery.map((url, index) => ({ url, index, isCover: index === coverIndex })),
    [coverIndex, gallery]
  );
  const description = event?.description?.trim() ?? '';
  const shouldCollapseDescription = description.length > 180 || description.split(/\r?\n/).length > 4;
  const eventMaxPeople = event?.max_people ?? 10;
  const eventAttendeeCount = event?.attendee_count ?? 0;
  const eventSpotsLeft = event?.spots_left ?? Math.max(eventMaxPeople - eventAttendeeCount, 0);
  const mockAttendeeCount = mockPeopleEnabled && eventAttendeeCount <= 1
    ? Math.min(eventMaxPeople, eventAttendeeCount + DEV_ATTENDEE_PREVIEW.length)
    : eventAttendeeCount;
  const eventFillRatio = Math.min(mockAttendeeCount / Math.max(eventMaxPeople, 1), 1);
  const eventIsFull = Boolean(event && eventSpotsLeft <= 0 && !event.has_joined && !event.is_own);
  const fillPercent = eventIsFull ? 100 : Math.round(eventFillRatio * 100);
  const showSpotUrgency = Boolean(event && !isCompleted(event) && eventSpotsLeft > 0 && eventSpotsLeft <= 2);

  useEffect(() => {
    fillProgress.value = 0;
    fillProgress.value = withTiming(fillPercent, { duration: 600 });
  }, [event?.id, fillPercent, fillProgress, mockPeopleEnabled]);

  useEffect(() => {
    if (showSpotUrgency) {
      urgencyOpacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 1000 }),
          withTiming(1, { duration: 1000 })
        ),
        -1,
        false
      );
    } else {
      urgencyOpacity.value = withTiming(1, { duration: 150 });
    }
  }, [showSpotUrgency, urgencyOpacity]);

  useEffect(() => {
    aboutProgress.value = withTiming(aboutExpanded ? 1 : 0, { duration: 260 });
  }, [aboutExpanded, aboutProgress]);

  const fillAnimatedStyle = useAnimatedStyle(() => ({
    width: `${fillProgress.value}%`,
  }));
  const urgencyAnimatedStyle = useAnimatedStyle(() => ({
    opacity: urgencyOpacity.value,
  }));
  const aboutAnimatedStyle = useAnimatedStyle(() => ({
    maxHeight: shouldCollapseDescription
      ? 100 + aboutProgress.value * 900
      : 1000,
  }));
  const ctaAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ctaScale.value }],
  }));
  const hostEditAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: hostEditScale.value }],
  }));

  const handleShare = useCallback(async () => {
    if (!event) return;
    await Share.share({
      title: event.title,
      message: `${event.title}\n${formatEventTime(event)}\n${event.location_name}`,
    });
  }, [event]);

  const handleInvite = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    void handleShare();
  }, [handleShare]);

  const openGroup = useCallback((conversationId?: string | null) => {
    if (conversationId) router.push(`/chat/${conversationId}`);
  }, []);

  const handleJoin = useCallback(async () => {
    if (!id || !event || joinEvent.isPending || isCompleted(event)) return;
    if (event.has_joined) {
      openGroup(event.conversation_id);
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const queryKey = orbitKeys.event(id);
    const previous = queryClient.getQueryData<OrbitEvent>(queryKey);
    queryClient.setQueryData<OrbitEvent>(queryKey, optimisticJoin(event, user));
    try {
      const result = await joinEvent.mutateAsync(id);
      if (result?.event) queryClient.setQueryData(queryKey, result.event);
      toast.success(event.join_mode === 'approval' ? 'Request sent.' : 'You joined this catchup.');
      openGroup(result.conversation_id);
    } catch (error) {
      console.warn('[EventDetail] join failed', error);
      if (previous) queryClient.setQueryData(queryKey, previous);
      toast.error('Could not join this catchup. Try again.');
    }
  }, [event, id, joinEvent, openGroup, queryClient, toast, user]);

  const handleLeave = useCallback(() => {
    if (!id || !event || !event.has_joined || leaveEvent.isPending || isCompleted(event)) return;
    Alert.alert('Leave catchup?', 'You can join again later if spots are still open.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          const queryKey = orbitKeys.event(id);
          const previous = queryClient.getQueryData<OrbitEvent>(queryKey);
          queryClient.setQueryData<OrbitEvent>(queryKey, optimisticLeave(event, user?.id));
          try {
            const result = await leaveEvent.mutateAsync(id);
            if (result?.event) queryClient.setQueryData(queryKey, result.event);
            toast.success('You left this catchup.');
          } catch (error) {
            console.warn('[EventDetail] leave failed', error);
            if (previous) queryClient.setQueryData(queryKey, previous);
            toast.error('Could not leave this catchup. Try again.');
          }
        },
      },
    ]);
  }, [event, id, leaveEvent, queryClient, toast, user?.id]);

  const handleEdit = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setEditOpen(true);
  }, []);

  const handleDelete = useCallback(() => {
    if (!id || !event || deleteCatchup.isPending) return;
    setDeleteModalVisible(true);
  }, [deleteCatchup.isPending, event, id]);

  const confirmDelete = useCallback(async () => {
    if (!id || deleteCatchup.isPending) return;
    try {
      await deleteCatchup.mutateAsync(id);
      setDeleteModalVisible(false);
      toast.success('Catchup deleted.');
      router.replace('/(tabs)/feed');
    } catch (error) {
      console.warn('[EventDetail] delete failed', error);
      toast.error('Could not delete this catchup.');
    }
  }, [deleteCatchup, id, toast]);

  const openGallery = useCallback((index: number) => {
    setViewerIndex(index);
    setViewerVisible(true);
  }, []);

  const openMaps = useCallback(async () => {
    if (!event || !shouldShowGoogleMapsLink(event)) return;
    const query = googleMapsQuery(event);
    if (!query) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      await Linking.openURL(url);
    } catch (error) {
      console.warn('[EventDetail] open maps failed', error);
      toast.error('Could not open maps.');
    }
  }, [event, toast]);

  if (isPending) {
    return (
      <View style={[styles.centered, theme.screen]}>
        <OrbitLoader />
      </View>
    );
  }

  if (isError || !event) {
    return (
      <View style={[styles.centered, theme.screen]}>
        <StateView
          type="error"
          icon="calendar-outline"
          title="Catchup not found"
          description="It may have been deleted or is no longer available."
          actionLabel="Try again"
          onAction={() => refetch()}
        />
      </View>
    );
  }

  const completed = isCompleted(event);
  const isHost = event.is_own;
  const canManage = isHost && !completed;
  const maxPeople = eventMaxPeople;
  const attendeeCount = mockAttendeeCount;
  const joinModeLabel = event.join_mode === 'approval' ? 'By approval' : 'Open';
  const completedJoinedText = completed ? completedJoinLabel(attendeeCount) : null;
  const actionSummaryText = completed ? completedJoinedText : `${attendeeCount}/${maxPeople} spots · ${joinModeLabel}`;
  const spotsLeft = eventSpotsLeft;
  const fillRatio = eventFillRatio;
  const isFull = eventIsFull;
  const isPendingApproval = false;
  const actionDisabled = completed || isFull || isPendingApproval || joinEvent.isPending || leaveEvent.isPending;
  const organizerAttendee = event.organizer
    ? { id: event.organizer.id, username: event.organizer.username || 'Host', avatar: event.organizer.avatar ?? null }
    : null;
  const attendees = event.attendees_preview?.length
    ? event.attendees_preview
    : organizerAttendee && attendeeCount > 0
      ? [organizerAttendee]
      : [];
  const hostId = event.organizer?.id;
  const attendeeChipList = mockPeopleEnabled
    ? [...attendees, ...DEV_ATTENDEE_PREVIEW].slice(0, attendeeCount)
    : attendees;
  const visibleAttendeeChips = attendeeChipList.slice(0, MAX_VISIBLE_ATTENDEE_CHIPS);
  const hiddenAttendeeCount = Math.max(attendeeCount - visibleAttendeeChips.length, 0);
  const showInviteChip = !completed && attendeeCount === 1 && Boolean(hostId) && attendeeChipList.some((attendee) => attendee.id === hostId);
  const attendeeHeaderLabel = completed ? 'WHO JOINED' : "WHO'S GOING";
  const attendeeHeaderSpots = `${attendeeCount}/${maxPeople} spots`;
  const fillColor = isFull || fillRatio >= 0.8 ? colors.error : (isDark ? colors.primary.default : DARK);
  const spotUrgencyText = spotsLeft === 1 ? '🔥 1 spot left!' : `🔥 ${spotsLeft} spots left!`;
  const hostActivity = event.organizer ? hostStatus(event.organizer) : null;
  const ctaLabel = completed
    ? 'Event ended'
    : isPendingApproval
      ? 'Pending...'
      : event.has_joined
        ? 'Joined ✓'
        : isFull
          ? 'Full'
          : event.join_mode === 'approval'
            ? 'Request to join →'
            : 'Join →';

  return (
    <View style={[styles.screen, theme.screen]}>
      <StatusBar style="light" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 132 + insets.bottom }}
      >
        <View style={styles.hero}>
          {coverUrl ? (
            <Image
              source={{ uri: coverUrl }}
              style={styles.cover}
              contentFit="cover"
              placeholder={{ blurhash: COVER_BLURHASH }}
              transition={300}
            />
          ) : (
            <LinearGradient
              colors={[category.bg, colors.background.card]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.cover, styles.fallbackCover]}
            >
              <AppText style={styles.fallbackEmoji}>{category.emoji}</AppText>
            </LinearGradient>
          )}
          <LinearGradient
            colors={['transparent', 'transparent', 'rgba(0,0,0,0.4)']}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFillObject}
          />
        </View>

        <View style={styles.content}>
          <View style={styles.eventHeader}>
            <View style={styles.headerMetaRow}>
              <View style={[styles.categoryPill, { backgroundColor: category.bg }]}>
                <AppText style={[styles.categoryText, { color: category.text }]} numberOfLines={1}>
                  {category.emoji} {category.label}
                </AppText>
              </View>
              {urgency ? (
                <View style={styles.urgencyWrap}>
                  {urgency.showDot ? <View style={styles.urgencyDot} /> : null}
                  <AppText
                    style={[
                      styles.urgencyText,
                      { color: urgency.color === DARK ? colors.text.primary : urgency.color, fontWeight: urgency.weight },
                    ]}
                    numberOfLines={1}
                  >
                    {urgency.label}
                  </AppText>
                </View>
              ) : null}
            </View>
            <AppText style={[styles.title, theme.textPrimary]} numberOfLines={3} ellipsizeMode="clip">{event.title}</AppText>
            <View style={styles.timeLine}>
              <Ionicons name="time-outline" size={14} color={colors.text.tertiary} />
              <AppText style={[styles.timeLineText, theme.textPrimary, urgency?.isSoon && styles.timeLineSoon]}>
                {formatEventTime(event)}
              </AppText>
            </View>
            <View style={styles.placeLine}>
              <Ionicons name="location-outline" size={14} color={colors.text.tertiary} />
              <AppText style={[styles.placeLineText, theme.textSecondary]} numberOfLines={2}>
                {event.location_name || event.city || 'Location TBD'}
                {distanceLabel ? ` · ${distanceLabel}` : ''}
              </AppText>
            </View>
          </View>

          <View style={[styles.card, theme.card]}>
            <View style={styles.attendeeHeaderLine}>
              <AppText style={[styles.attendeeHeaderLabel, theme.textTertiary]}>{attendeeHeaderLabel}</AppText>
              <AppText style={[styles.attendeeHeaderSeparator, theme.textTertiary]}>·</AppText>
              <AppText style={styles.attendeeHeaderSpots}>{attendeeHeaderSpots}</AppText>
            </View>
            {showSpotUrgency ? (
              <Animated.View style={[styles.spotUrgencyWrap, urgencyAnimatedStyle]}>
                <AppText style={[styles.spotUrgencyText, { color: colors.error }]}>{spotUrgencyText}</AppText>
              </Animated.View>
            ) : null}
            {visibleAttendeeChips.length > 0 ? (
              <View style={[styles.attendeePreviewStrip, theme.subtleCard]}>
                <View style={styles.attendeeInitialsRow}>
                  {visibleAttendeeChips.map((attendee) => (
                    <Pressable
                      key={attendee.id}
                      style={styles.initialChip}
                      onPress={() => {
                        if (!attendee.id.startsWith('mock-attendee-')) router.push(`/user/${attendee.id}`);
                      }}
                    >
                      <InitialBubble name={attendee.username} size={30} />
                    </Pressable>
                  ))}
                </View>
                {hiddenAttendeeCount > 0 ? (
                  <View style={[styles.morePeopleChip, theme.card]}>
                    <AppText style={[styles.morePeopleText, theme.textTertiary]}>{morePeopleLabel(hiddenAttendeeCount)}</AppText>
                  </View>
                ) : null}
                {showInviteChip ? (
                  <Pressable style={[styles.inviteChip, theme.card]} onPress={handleInvite}>
                    <AppText style={[styles.inviteChipText, theme.textTertiary]}>+ Invite</AppText>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <AppText style={[styles.noAttendeesText, theme.textTertiary]}>
                {completed ? 'No one joined this catchup.' : 'No one has joined yet — be the first!'}
              </AppText>
            )}
            <View style={[styles.fillTrack, { backgroundColor: colors.background.secondary }]}>
              <Animated.View style={[styles.fillBar, { backgroundColor: fillColor }, fillAnimatedStyle]} />
            </View>
          </View>

          {description ? (
            <View style={[styles.card, theme.card]}>
              <AppText style={[styles.attendeeSectionLabel, theme.textTertiary]}>ABOUT</AppText>
              <Animated.View style={[styles.descriptionClip, aboutAnimatedStyle]}>
                <AppText
                  style={[styles.description, theme.textSecondary]}
                  numberOfLines={shouldCollapseDescription && !aboutExpanded ? 4 : undefined}
                >
                  {description}
                </AppText>
              </Animated.View>
              {shouldCollapseDescription ? (
                <Pressable
                  style={styles.readMoreButton}
                  onPress={() => setAboutExpanded((value) => !value)}
                  hitSlop={8}
                >
                  <AppText style={styles.readMoreText}>
                    {aboutExpanded ? 'show less' : '...read more'}
                  </AppText>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {detailGallery.length > 0 ? (
            <View style={[styles.card, theme.card]}>
              <AppText style={[styles.attendeeSectionLabel, theme.textTertiary]}>PHOTOS</AppText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.detailPhotoRail}>
                {detailGallery.map((photo) => (
                  <Pressable
                    key={`${photo.url}-${photo.index}`}
                    style={[styles.detailPhotoWrap, theme.subtleCard]}
                    onPress={() => openGallery(photo.index)}
                  >
                    <Image
                      source={{ uri: photo.url }}
                      style={styles.detailPhoto}
                      contentFit="cover"
                      placeholder={{ blurhash: COVER_BLURHASH }}
                      transition={300}
                    />
                    {photo.isCover ? (
                      <View style={styles.detailCoverBadge}>
                        <AppText style={styles.detailCoverBadgeText}>Cover</AppText>
                      </View>
                    ) : null}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {event.organizer ? (
            <View style={styles.hostSection}>
              <AppText style={[styles.attendeeSectionLabel, theme.textTertiary]}>HOST</AppText>
              <View style={[styles.hostCard, theme.subtleCard]}>
                <AvatarBubble name={event.organizer.username} uri={event.organizer.avatar} size={48} />
                <View style={styles.hostText}>
                  <AppText style={[styles.hostName, theme.textPrimary]}>{isHost ? 'You' : event.organizer.username}</AppText>
                  <AppText style={[styles.hostUsername, theme.textTertiary]}>@{event.organizer.username}</AppText>
                  {hostActivity ? (
                    <View style={styles.hostStatusRow}>
                      <View style={[styles.hostStatusDot, hostActivity.online ? styles.hostStatusOnline : styles.hostStatusOffline]} />
                      <AppText style={[styles.hostStatusText, hostActivity.online ? styles.hostStatusTextOnline : theme.textTertiary]}>
                        {hostActivity.label}
                      </AppText>
                    </View>
                  ) : null}
                </View>
                <Pressable
                  style={styles.profileLink}
                  onPress={() => router.push(`/user/${event.organizer!.id}`)}
                  hitSlop={8}
                >
                  <AppText style={styles.profileLinkText}>View profile →</AppText>
                </Pressable>
              </View>
            </View>
          ) : null}

          <View style={[styles.card, theme.card]}>
            <AppText style={[styles.sectionTitle, theme.textPrimary]}>Location</AppText>
            <AppText style={[styles.placeTitle, theme.textPrimary]}>{event.location_name || event.city || 'Location TBD'}</AppText>
            {event.address ? <AppText style={[styles.placeSub, theme.textSecondary]}>{event.address}</AppText> : null}
            {event.city ? <AppText style={[styles.placeSub, theme.textSecondary]}>{event.city}</AppText> : null}
            {canOpenGoogleMaps ? (
              <Pressable style={[styles.googleMapsLink, theme.softAccent]} onPress={openMaps}>
                {({ pressed }) => (
                  <>
                    <Ionicons name="navigate-outline" size={15} color={pressed ? ACCENT_SOON : colors.primary.default} />
                    <AppText style={[styles.googleMapsText, { color: colors.primary.default }, pressed && styles.googleMapsTextPressed]}>
                      Open in Google Maps
                    </AppText>
                  </>
                )}
              </Pressable>
            ) : null}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.actionBar, theme.actionBar, { paddingBottom: insets.bottom + 12 }]}>
        {actionSummaryText ? (
          <View style={styles.actionInfo}>
            <AppText style={[styles.actionSummary, theme.textTertiary]} numberOfLines={1}>
              {actionSummaryText}
            </AppText>
          </View>
        ) : (
          <View style={styles.actionInfoEmpty} />
        )}
        {canManage ? (
          <View style={styles.hostActions}>
            <Animated.View style={[styles.hostButtonGroup, theme.card, hostEditAnimatedStyle]}>
              <Pressable
                style={[styles.hostEditSegment, { backgroundColor: isDark ? colors.primary.default : DARK }]}
                onPressIn={() => {
                  hostEditScale.value = withSpring(0.97, { damping: 14, stiffness: 260 });
                }}
                onPressOut={() => {
                  hostEditScale.value = withSpring(1, { damping: 14, stiffness: 260 });
                }}
                onPress={handleEdit}
              >
                <AppText style={styles.hostEditText} numberOfLines={1}>
                  Edit
                </AppText>
              </Pressable>
              <View style={[styles.hostButtonSeparator, { backgroundColor: colors.border }]} />
              <Pressable
                style={[styles.hostDeleteSegment, { backgroundColor: colors.background.card }]}
                onPress={handleDelete}
                disabled={deleteCatchup.isPending}
              >
                {({ pressed }) => (
                  <AppText
                    style={[styles.hostDeleteText, theme.textTertiary, pressed && !deleteCatchup.isPending && styles.hostDeleteTextPressed]}
                    numberOfLines={1}
                  >
                    Delete
                  </AppText>
                )}
              </Pressable>
            </Animated.View>
          </View>
        ) : (
          <Animated.View style={[styles.primaryCtaWrap, ctaAnimatedStyle]}>
            <Pressable
              style={[
                styles.primaryCta,
                { backgroundColor: isDark ? colors.primary.default : DARK },
                event.has_joined && styles.joinedCta,
                event.has_joined && theme.softAccent,
                (isFull || completed || isPendingApproval) && styles.fullCta,
                (isFull || completed || isPendingApproval) && theme.disabledSurface,
              ]}
              onPressIn={() => {
                if (!actionDisabled) ctaScale.value = withSpring(0.95, { damping: 14, stiffness: 260 });
              }}
              onPressOut={() => {
                ctaScale.value = withSpring(1, { damping: 14, stiffness: 260 });
              }}
              onPress={handleJoin}
              onLongPress={event.has_joined ? handleLeave : undefined}
              delayLongPress={450}
              disabled={actionDisabled}
            >
              <Animated.View
                key={`${event.id}-${ctaLabel}-${joinEvent.isPending}-${leaveEvent.isPending}`}
                entering={FadeIn.duration(160)}
                exiting={FadeOut.duration(120)}
              >
                <AppText
                  style={[
                    styles.primaryCtaText,
                    event.has_joined && styles.joinedCtaText,
                    event.has_joined && { color: colors.primary.default },
                    (isFull || completed || isPendingApproval) && styles.fullCtaText,
                    (isFull || completed || isPendingApproval) && theme.textTertiary,
                  ]}
                >
                  {joinEvent.isPending
                    ? (event.join_mode === 'approval' ? 'Requesting...' : 'Joining...')
                    : leaveEvent.isPending
                      ? 'Leaving...'
                      : ctaLabel}
                </AppText>
              </Animated.View>
            </Pressable>
          </Animated.View>
        )}
      </View>

      <View style={[styles.fixedNav, { top: insets.top + 16 }]}>
        <NavIconButton icon="arrow-back" onPress={() => router.back()} />
        <NavIconButton icon="share-outline" onPress={handleShare} />
      </View>

      {canManage ? (
        <CreateFAB
          controlledOpen={editOpen}
          onOpenChange={setEditOpen}
          hideLauncher
          editingEvent={event}
          initialLat={event.latitude}
          initialLng={event.longitude}
          onCreated={() => {
            void refetch();
          }}
        />
      ) : null}

      <ImageViewing
        images={viewerImages}
        imageIndex={viewerIndex}
        visible={viewerVisible}
        onRequestClose={() => setViewerVisible(false)}
        onImageIndexChange={setViewerIndex}
        backgroundColor="#050505"
        swipeToCloseEnabled
        doubleTapToZoomEnabled
      />

      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalRoot}>
          <BlurView intensity={28} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFillObject} />
          <Pressable style={[styles.modalScrim, theme.modalScrim]} onPress={() => setDeleteModalVisible(false)}>
            <Pressable style={[styles.deleteModalCard, theme.card]}>
              <View style={[styles.deleteModalIcon, { backgroundColor: colors.error + '18' }]}>
                <Ionicons name="trash-outline" size={24} color={colors.error} />
              </View>
              <AppText style={[styles.deleteModalTitle, theme.textPrimary]}>Delete this catchup?</AppText>
              <AppText style={[styles.deleteModalBody, theme.textSecondary]}>
                This can't be undone. Everyone who joined will be notified.
              </AppText>
              <View style={styles.deleteModalActions}>
                <Pressable
                  style={[styles.modalCancelButton, theme.disabledSurface]}
                  onPress={() => setDeleteModalVisible(false)}
                  disabled={deleteCatchup.isPending}
                >
                  <AppText style={[styles.modalCancelText, theme.textPrimary]}>Cancel</AppText>
                </Pressable>
                <Pressable
                  style={[styles.modalDeleteButton, { backgroundColor: colors.error }, deleteCatchup.isPending && styles.modalButtonDisabled]}
                  onPress={confirmDelete}
                  disabled={deleteCatchup.isPending}
                >
                  <AppText style={styles.modalDeleteText}>
                    {deleteCatchup.isPending ? 'Deleting...' : 'Delete'}
                  </AppText>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    padding: 24,
  },
  hero: {
    height: 280,
    backgroundColor: CARD_BG,
    overflow: 'hidden',
  },
  cover: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  fallbackCover: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackEmoji: {
    fontSize: 48,
    lineHeight: 58,
  },
  fixedNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  eventHeader: {
    marginTop: 0,
  },
  headerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  categoryPill: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    flexShrink: 1,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0,
  },
  urgencyWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  urgencyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: SUCCESS,
  },
  urgencyText: {
    fontSize: 13,
    letterSpacing: 0,
  },
  title: {
    color: DARK,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 12,
  },
  timeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 12,
  },
  timeLineText: {
    color: DARK,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
    flex: 1,
    minWidth: 0,
  },
  timeLineSoon: {
    color: ACCENT_SOON,
  },
  placeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 6,
  },
  placeLineText: {
    color: MUTED,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    flex: 1,
    minWidth: 0,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 14,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: '#FFFFFF',
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionTitle: {
    color: DARK,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0,
  },
  attendeeSectionLabel: {
    color: FAINT,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  attendeeHeaderLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  attendeeHeaderLabel: {
    color: FAINT,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  attendeeHeaderSeparator: {
    color: FAINT,
    fontSize: 11,
    fontWeight: '500',
    marginHorizontal: 6,
  },
  attendeeHeaderSpots: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0,
  },
  spotUrgencyWrap: {
    marginTop: -4,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  spotUrgencyText: {
    color: ERROR,
    fontSize: 12,
    fontWeight: '700',
  },
  fillTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EBEBEB',
    overflow: 'hidden',
    marginTop: 14,
  },
  fillBar: {
    height: '100%',
    borderRadius: 3,
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
  avatarInitial: {
    fontWeight: '800',
    textAlign: 'center',
  },
  initialBubble: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialBubbleText: {
    fontWeight: '800',
    textAlign: 'center',
  },
  attendeePreviewStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    borderRadius: 18,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#F1F1F1',
    padding: 8,
  },
  attendeeInitialsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  initialChip: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  inviteChip: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#DDDDDD',
    borderRadius: 24,
    paddingHorizontal: 14,
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  inviteChipText: {
    color: '#999999',
    fontSize: 12,
    fontWeight: '500',
  },
  morePeopleChip: {
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    minHeight: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  morePeopleText: {
    color: '#999999',
    fontSize: 12,
    fontWeight: '600',
  },
  noAttendeesText: {
    marginTop: 14,
    color: MUTED,
    fontSize: 14,
    fontStyle: 'italic',
  },
  descriptionClip: {
    overflow: 'hidden',
  },
  description: {
    color: '#333333',
    fontSize: 15,
    lineHeight: 24,
    fontWeight: '400',
  },
  readMoreButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  readMoreText: {
    color: ACCENT,
    fontSize: 15,
    fontWeight: '700',
  },
  detailPhotoRail: {
    gap: 10,
    paddingRight: 4,
  },
  detailPhotoWrap: {
    width: 116,
    height: 92,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: CARD_BG,
  },
  detailPhoto: {
    width: '100%',
    height: '100%',
  },
  detailCoverBadge: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.58)',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  detailCoverBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  hostSection: {
    gap: 0,
  },
  hostCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: CARD_BG,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  hostText: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
  },
  hostName: {
    color: DARK,
    fontSize: 16,
    fontWeight: '700',
  },
  hostUsername: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '400',
    marginTop: 2,
  },
  hostStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  hostStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  hostStatusOnline: {
    backgroundColor: SUCCESS,
  },
  hostStatusOffline: {
    backgroundColor: FAINT,
  },
  hostStatusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  hostStatusTextOnline: {
    color: SUCCESS,
  },
  hostStatusTextOffline: {
    color: MUTED,
  },
  profileLink: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingLeft: 10,
  },
  profileLinkText: {
    color: ACCENT,
    fontSize: 13,
    fontWeight: '500',
  },
  placeTitle: {
    color: DARK,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 10,
  },
  placeSub: {
    color: MUTED,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  googleMapsLink: {
    alignSelf: 'flex-start',
    minHeight: 34,
    borderRadius: 17,
    backgroundColor: '#E8F6FA',
    paddingHorizontal: 12,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  googleMapsText: {
    color: ACCENT,
    fontSize: 13,
    fontWeight: '600',
  },
  googleMapsTextPressed: {
    color: ACCENT_SOON,
  },
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionInfo: {
    flexShrink: 1,
    minWidth: 0,
  },
  actionInfoEmpty: {
    flex: 1,
  },
  actionSummary: {
    color: '#888888',
    fontSize: 13,
    fontWeight: '500',
  },
  primaryCtaWrap: {
    flexShrink: 0,
  },
  primaryCta: {
    height: 48,
    borderRadius: 15,
    backgroundColor: DARK,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    minWidth: 118,
  },
  primaryCtaText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  joinedCta: {
    backgroundColor: JOINED_BG,
  },
  joinedCtaText: {
    color: JOINED_TEXT,
  },
  fullCta: {
    backgroundColor: FULL_BG,
  },
  fullCtaText: {
    color: FULL_TEXT,
  },
  hostActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexShrink: 0,
  },
  hostButtonGroup: {
    height: 42,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E8E8E8',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'stretch',
    flexShrink: 0,
  },
  hostEditSegment: {
    height: 42,
    backgroundColor: DARK,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  hostEditText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  hostButtonSeparator: {
    width: 1,
    backgroundColor: '#E8E8E8',
  },
  hostDeleteSegment: {
    height: 42,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  hostDeleteText: {
    color: '#999999',
    fontSize: 14,
    fontWeight: '400',
  },
  hostDeleteTextPressed: {
    color: ERROR,
  },
  modalRoot: {
    flex: 1,
  },
  modalScrim: {
    flex: 1,
    backgroundColor: 'rgba(13,13,13,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  deleteModalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  deleteModalIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFF1F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  deleteModalTitle: {
    color: DARK,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  deleteModalBody: {
    color: MUTED,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  deleteModalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
  },
  modalCancelButton: {
    flex: 1,
    height: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: FULL_BG,
  },
  modalCancelText: {
    color: DARK,
    fontSize: 15,
    fontWeight: '600',
  },
  modalDeleteButton: {
    flex: 1,
    height: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ERROR,
  },
  modalButtonDisabled: {
    opacity: 0.7,
  },
  modalDeleteText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
