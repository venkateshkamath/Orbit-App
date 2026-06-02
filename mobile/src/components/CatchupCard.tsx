import React, { memo, useCallback, useEffect, useMemo } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { format, formatDistanceToNowStrict, isSameDay, isThisWeek, isTomorrow } from 'date-fns';
import { API_BASE_URL } from '../api/client';
import { AppText } from '../ui/AppText';
import type { OrbitEvent } from '../types';
import {
  ACCENT,
  CATEGORY_STYLES,
  DARK,
  DEFAULT_CATEGORY_STYLE,
  nameToAvatarColor,
  type CategoryStyle,
} from '../constants/designTokens';

const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

function mediaUrl(url?: string | null): string | null {
  if (!url) return null;
  const value = String(url).trim();
  if (!value) return null;
  if (/^(https?:|file:|content:|data:)/i.test(value)) return value;
  const normalized = value.replace(/^\/+/, '');
  const mediaPath = normalized.startsWith('media/') ? normalized : `media/${normalized}`;
  return `${API_ORIGIN}/${mediaPath}`;
}

function resolveTimeLabel(dateStr: string): { text: string; urgent: boolean } {
  const start = new Date(dateStr);
  const diffMin = Math.round((start.getTime() - Date.now()) / 60000);
  if (diffMin >= 0 && diffMin <= 30) return { text: `In ${diffMin} min`, urgent: true };
  if (isSameDay(start, new Date())) return { text: `Today ${format(start, 'h:mm a')}`, urgent: false };
  if (isTomorrow(start)) return { text: `Tomorrow ${format(start, 'h:mm a')}`, urgent: false };
  if (isThisWeek(start, { weekStartsOn: 1 })) return { text: format(start, 'EEE h:mm a'), urgent: false };
  return { text: format(start, 'MMM d · h:mm a'), urgent: false };
}

function getCategoryStyle(event: OrbitEvent): CategoryStyle & { label: string } {
  const key = (event.custom_category || event.category || 'social').toLowerCase();
  const found = CATEGORY_STYLES[key];
  if (found) return found;
  return { ...DEFAULT_CATEGORY_STYLE, label: event.custom_category || event.category || 'Other' };
}

function completedJoinLabel(attendeeCount: number): string {
  return attendeeCount === 1 ? '1 joined' : `${Math.max(attendeeCount, 0)} joined`;
}

// ─── Sub-components ─────────────────────────────────────────────────────────

interface AvatarBubbleProps {
  name: string;
  uri?: string | null;
  size?: number;
  showBorder?: boolean;
}

const AvatarBubble = memo(function AvatarBubble({ name, uri, size = 22, showBorder = false }: AvatarBubbleProps) {
  const colors = useMemo(() => nameToAvatarColor(name), [name]);
  const resolvedUri = useMemo(() => mediaUrl(uri), [uri]);
  const fontSize = size <= 22 ? 9 : 12;
  const borderStyle = showBorder ? { borderWidth: 1.5, borderColor: '#FFFFFF' } : undefined;

  return (
    <View style={[ss.avatarBubble, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.bg }, borderStyle]}>
      {resolvedUri ? (
        <Image
          source={{ uri: resolvedUri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="cover"
        />
      ) : (
        <AppText style={[ss.avatarInitial, { color: colors.text, fontSize, lineHeight: size }]}>
          {name.charAt(0).toUpperCase()}
        </AppText>
      )}
    </View>
  );
});

interface AttendeeStackProps {
  event: OrbitEvent;
  isCompleted?: boolean;
}

const AttendeeStack = memo(function AttendeeStack({ event, isCompleted = false }: AttendeeStackProps) {
  const preview = event.attendees_preview ?? [];
  const organizerId = event.organizer?.id;

  // Strip creator from the stack — their face is already in Row 1
  const filteredPreview = organizerId ? preview.filter((a) => a.id !== organizerId) : preview;
  const creatorInPreview = organizerId ? preview.some((a) => a.id === organizerId) : false;
  const otherCount = event.attendee_count - (creatorInPreview ? 1 : 0);

  if (otherCount <= 0 && !event.has_joined) {
    if (isCompleted) return null;
    return (
      <View style={ss.beFirstRow}>
        {event.organizer ? (
          <AvatarBubble name={event.organizer.username} uri={event.organizer.avatar} size={22} />
        ) : null}
        <AppText style={ss.beFirstText}>Be first to join</AppText>
      </View>
    );
  }

  const visible = filteredPreview.slice(0, 3);
  const extra = Math.max(otherCount - visible.length, 0);

  if (visible.length === 0 && extra === 0) return null;

  return (
    <View style={ss.avatarStack}>
      {visible.map((a, i) => (
        <View key={a.id} style={{ marginLeft: i === 0 ? 0 : -6 }}>
          <AvatarBubble name={a.username} uri={a.avatar} size={22} />
        </View>
      ))}
      {extra > 0 ? (
        <View style={[ss.avatarBubble, ss.avatarMore, { marginLeft: -6 }]}>
          <AppText style={ss.avatarMoreText}>+{extra}</AppText>
        </View>
      ) : null}
    </View>
  );
});

// ─── CatchupCard ─────────────────────────────────────────────────────────────

export interface CatchupCardProps {
  event: OrbitEvent;
  onJoin: (event: OrbitEvent) => void;
  /** Enables stagger entrance animation — pass true only for the initial screen load batch */
  isInitialLoad?: boolean;
  index?: number;
}

export const CatchupCard = memo(function CatchupCard({
  event,
  onJoin,
  isInitialLoad = false,
  index = 0,
}: CatchupCardProps) {
  const coverUrl = useMemo(
    () => mediaUrl(event.photos?.[event.cover_photo_index ?? 0]?.url ?? event.image_url),
    [event.photos, event.cover_photo_index, event.image_url]
  );
  const hasImage = Boolean(coverUrl);
  const catStyle = useMemo(() => getCategoryStyle(event), [event.category, event.custom_category]);
  const timeInfo = useMemo(() => resolveTimeLabel(event.start_at), [event.start_at]);
  const relativeCreatedAt = useMemo(
    () => formatDistanceToNowStrict(new Date(event.created_at), { addSuffix: true }),
    [event.created_at]
  );
  const isCompleted = useMemo(() => {
    if (typeof event.is_completed === 'boolean') return event.is_completed;
    const endOrStart = new Date(event.end_at || event.start_at);
    return !Number.isNaN(endOrStart.getTime()) && endOrStart.getTime() < Date.now();
  }, [event.end_at, event.is_completed, event.start_at]);
  const spotsLeft = event.spots_left ?? Math.max((event.max_people ?? 10) - event.attendee_count, 0);
  const isFull = !isCompleted && spotsLeft === 0 && !event.has_joined && !event.is_own;
  const maxPeople = event.max_people ?? 10;
  const completedJoinedText = isCompleted ? completedJoinLabel(event.attendee_count) : null;
  const showActionMeta = !isCompleted || Boolean(completedJoinedText);

  // Card press scale
  const cardScale = useSharedValue(1);
  const cardAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: cardScale.value }] }));

  // Join button scale
  const btnScale = useSharedValue(1);
  const btnAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: btnScale.value }] }));

  // Spots urgency pulse
  const spotsOpacity = useSharedValue(1);
  useEffect(() => {
    if (spotsLeft <= 2 && spotsLeft > 0 && !event.has_joined && !isCompleted) {
      spotsOpacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 1000 }),
          withTiming(1, { duration: 1000 })
        ),
        -1,
        false
      );
    } else {
      spotsOpacity.value = 1;
    }
  }, [spotsLeft, event.has_joined, isCompleted]);
  const spotsAnimStyle = useAnimatedStyle(() => ({ opacity: spotsOpacity.value }));

  const handleCardPress = useCallback(() => {
    cardScale.value = withSpring(0.985, { damping: 15, stiffness: 150 }, () => {
      cardScale.value = withSpring(1, { damping: 15, stiffness: 150 });
    });
    router.push(`/event/${event.id}`);
  }, [event.id]);

  const handleJoinPress = useCallback(() => {
    if (isCompleted || isFull) return;
    if (event.is_own) {
      router.push(`/event/${event.id}`);
      return;
    }
    btnScale.value = withSpring(0.95, { damping: 15, stiffness: 150 }, () => {
      btnScale.value = withSpring(1, { damping: 15, stiffness: 150 });
    });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onJoin(event);
  }, [event, isCompleted, isFull, onJoin]);

  // Join button label + style
  let joinLabel = 'Join';
  let joinBtnExtra = {};
  let joinTextExtra = {};
  if (isCompleted) {
    joinLabel = 'Completed';
    joinBtnExtra = ss.joinBtnCompleted;
    joinTextExtra = ss.joinTextCompleted;
  } else if (event.is_own) {
    joinLabel = 'Manage';
  } else if (event.has_joined) {
    joinLabel = 'Joined ✓';
    joinBtnExtra = ss.joinBtnJoined;
    joinTextExtra = ss.joinTextJoined;
  } else if (isFull) {
    joinLabel = 'Full';
    joinBtnExtra = ss.joinBtnFull;
    joinTextExtra = ss.joinTextFull;
  } else if (event.join_mode === 'approval') {
    joinLabel = 'Request';
  }

  // FadeIn (opacity-only) — no translation so cards never appear off-position mid-animation
  const entering = isInitialLoad && index < 8
    ? FadeIn.delay(index * 55).duration(220)
    : undefined;

  // ─── Info section (shared between both variants) ───────────────────────
  const infoSection = (
    <View style={ss.infoArea}>
      {/* Row 1: Creator */}
      <View style={ss.creatorRow}>
        <View style={ss.creatorLeft}>
          {event.organizer ? (
            <>
              <AvatarBubble
                name={event.organizer.username}
                uri={event.organizer.avatar}
                size={28}
                showBorder
              />
              <AppText style={ss.creatorName} numberOfLines={1}>
                {event.organizer.username}
              </AppText>
              <AppText style={ss.creatorSep}> · </AppText>
              <AppText style={ss.creatorTime} numberOfLines={1}>{relativeCreatedAt}</AppText>
            </>
          ) : null}
        </View>
        {!hasImage ? (
          <View style={ss.creatorRowRight}>
            <View style={[ss.categoryPill, { backgroundColor: catStyle.bg }]}>
              <AppText style={[ss.categoryText, { color: catStyle.text }]} numberOfLines={1}>
                {catStyle.emoji} {catStyle.label}
              </AppText>
            </View>
          </View>
        ) : null}
      </View>

      {/* Row 2: Title */}
      <View style={ss.titleRow}>
        <AppText style={ss.title} numberOfLines={2}>{event.title}</AppText>
        {event.is_own ? (
          <View style={ss.hostBadge}>
            <Ionicons name="sparkles-outline" size={13} color={DARK} />
            <AppText style={ss.hostBadgeText}>Host</AppText>
          </View>
        ) : null}
      </View>

      {/* Row 3: Details */}
      <View style={ss.detailsRow}>
        <View style={ss.locationCluster}>
          <Ionicons name="location-outline" size={15} color={ACCENT} />
          <AppText style={ss.venueText} numberOfLines={1} ellipsizeMode="tail">
            {event.location_name}
          </AppText>
        </View>
        {/* Time shown inline for no-image; image cards have it on the cover badge */}
        {!hasImage ? (
          <View style={ss.timeCluster}>
            <Ionicons
              name="time-outline"
              size={15}
              color={timeInfo.urgent ? ACCENT : '#8D99A6'}
            />
            <AppText
              style={[ss.timeText, timeInfo.urgent && ss.timeUrgent]}
              numberOfLines={1}
            >
              {timeInfo.text}
            </AppText>
          </View>
        ) : null}
      </View>

      {/* Row 4: Action */}
      <View style={[ss.actionRow, !showActionMeta && ss.actionRowCompact]}>
        {showActionMeta ? (
          <View style={ss.actionLeft}>
            <AttendeeStack event={event} isCompleted={isCompleted} />
            <View style={ss.spotMeta}>
              <Ionicons name="people-outline" size={14} color="#687A86" />
              <AppText style={ss.goingText} numberOfLines={1}>
                {isCompleted ? completedJoinedText : `${event.attendee_count}/${maxPeople} spots`}
                {!isCompleted ? (
                  <AppText style={ss.joinModeText}>
                    {' · '}{event.join_mode === 'approval' ? 'Approval' : 'Open'}
                  </AppText>
                ) : null}
              </AppText>
            </View>
          </View>
        ) : null}
        <View style={ss.actionRight}>
          {spotsLeft <= 2 && spotsLeft > 0 && !event.has_joined && !isCompleted ? (
            <Animated.View style={spotsAnimStyle}>
              <AppText style={ss.spotsUrgentText}>{spotsLeft} left!</AppText>
            </Animated.View>
          ) : null}
          <Animated.View style={btnAnimStyle}>
            <Pressable
              style={[ss.joinBtn, joinBtnExtra]}
              disabled={isCompleted || (!event.is_own && (event.has_joined || isFull))}
              onPress={(e) => {
                // @ts-ignore — stopPropagation is a synthetic event method
                e.stopPropagation?.();
                handleJoinPress();
              }}
              onLongPress={() => {
                if (event.has_joined && !event.is_own) Alert.alert('Leave catchup?', 'Unjoin support is coming soon.');
              }}
            >
              <AppText style={[ss.joinText, joinTextExtra]}>{joinLabel}</AppText>
            </Pressable>
          </Animated.View>
        </View>
      </View>
    </View>
  );

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <Animated.View
      entering={entering}
      style={[ss.card, cardAnimStyle]}
    >
      <Pressable onPress={handleCardPress} style={ss.pressable}>
        {hasImage ? (
          <>
            <View style={ss.imageWrap}>
              <Image
                source={{ uri: coverUrl! }}
                style={ss.coverImage}
                contentFit="cover"
                transition={200}
              />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.15)']}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
              {/* Time badge — top-left overlay */}
              <View style={ss.imgBadgeLeft}>
                <AppText style={[ss.imgBadgeText, timeInfo.urgent && ss.imgBadgeUrgent]}>
                  {timeInfo.text}
                </AppText>
              </View>
              {/* Category badge — top-right overlay */}
              <View style={ss.imgBadgeRight}>
                <AppText style={ss.imgBadgeText}>{catStyle.emoji} {catStyle.label}</AppText>
              </View>
            </View>
            {infoSection}
          </>
        ) : (
          infoSection
        )}
      </Pressable>
    </Animated.View>
  );
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const ss = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EAF0F4',
    marginBottom: 12,
    shadowColor: '#0B5F78',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    overflow: 'hidden',
  },
  pressable: {
    flex: 1,
  },

  // Cover image
  imageWrap: {
    width: '100%',
    height: 132,
    overflow: 'hidden',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: '#EBEBEB',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  imgBadgeLeft: {
    position: 'absolute',
    top: 10,
    left: 10,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  imgBadgeRight: {
    position: 'absolute',
    top: 10,
    right: 10,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  imgBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  imgBadgeUrgent: {
    color: '#7DF9FF',
  },

  // Info area
  infoArea: {
    padding: 16,
  },

  // Row 1: Creator
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  creatorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
    minWidth: 0,
  },
  avatarBubble: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  avatarInitial: {
    fontWeight: '700',
    textAlign: 'center',
  },
  creatorName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2933',
    flexShrink: 1,
  },
  creatorSep: {
    fontSize: 12,
    color: '#B2BDC6',
    flexShrink: 0,
  },
  creatorTime: {
    fontSize: 12,
    color: '#8D99A6',
    flexShrink: 0,
  },
  creatorRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 10,
    maxWidth: 132,
    flexShrink: 0,
  },
  categoryPill: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: '100%',
    flexShrink: 0,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },

  // Row 2: Title
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    marginBottom: 9,
  },
  title: {
    flex: 1,
    minWidth: 0,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '800',
    color: DARK,
    letterSpacing: 0,
  },
  hostBadge: {
    height: 26,
    borderRadius: 13,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: '#E6EDF2',
    backgroundColor: '#F3F6F8',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
    marginTop: 1,
  },
  hostBadgeText: {
    color: DARK,
    fontSize: 11,
    fontWeight: '800',
  },

  // Row 3: Details
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  locationCluster: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  venueText: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    color: '#687A86',
    fontWeight: '500',
  },
  timeText: {
    fontSize: 13,
    color: '#687A86',
    fontWeight: '500',
    flexShrink: 0,
  },
  timeUrgent: {
    color: ACCENT,
    fontWeight: '700',
  },

  // Row 4: Action
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F4F6',
  },
  actionRowCompact: {
    justifyContent: 'flex-end',
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  actionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },

  // Avatar stack
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarMore: {
    backgroundColor: '#E8E8E8',
  },
  avatarMoreText: {
    color: '#888888',
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
  },
  beFirstRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  beFirstText: {
    fontSize: 11,
    color: '#8D99A6',
  },
  spotMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
    minWidth: 0,
  },
  goingText: {
    flexShrink: 1,
    fontSize: 13,
    color: '#34414A',
    fontWeight: '700',
  },
  joinModeText: {
    fontSize: 13,
    color: '#8D99A6',
    fontWeight: '500',
  },
  spotsUrgentText: {
    fontSize: 12,
    color: '#D94A45',
    fontWeight: '700',
  },

  // Join button
  joinBtn: {
    minWidth: 84,
    height: 36,
    borderRadius: 12,
    backgroundColor: DARK,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  joinBtnJoined: {
    backgroundColor: '#E8F6FA',
  },
  joinBtnFull: {
    backgroundColor: '#F5F5F5',
  },
  joinBtnCompleted: {
    backgroundColor: '#EEF2F4',
    borderWidth: 1,
    borderColor: '#DCE4EA',
  },
  joinText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  joinTextJoined: {
    color: ACCENT,
  },
  joinTextFull: {
    color: '#999999',
  },
  joinTextCompleted: {
    color: '#687A86',
  },
});
