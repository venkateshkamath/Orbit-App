/**
 * Feed Tab — card-based posts (editorial layout)
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Modal,
  TextInput,
  Alert,
  Platform,
  StatusBar,
  Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { format, formatDistanceToNow } from 'date-fns';
import { FontSizes, FontWeights, Spacing, BorderRadius } from '../../constants/Colors';
import { useOrbitTheme, type OrbitThemeColors } from '../../src/theme';
import { Avatar, CommentsModal } from '../../src/components';
import {
  useCreatePostMutation,
  useDeletePostMutation,
  useEventsFeedQuery,
  useFeedQuery,
  useJoinEventMutation,
  useToggleLikeMutation,
} from '../../src/hooks/useOrbitApi';
import { useAuthStore } from '../../src/stores';
import { AppText } from '../../src/ui/AppText';
import { OrbitEvent, Post } from '../../src/types';
import { router } from 'expo-router';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CARD_W = SCREEN_WIDTH - 16; // 8px margin each side
const FEED_TEXT = '#23301F';
const FEED_MUTED = '#7F8468';
const FEED_CARD = '#FFFDF4';
const FEED_SAGE = '#7F9A56';
const FEED_ROSE = '#D96F6A';

/** Shared action pill used in both card types */
function ActionPill({
  icon, activeIcon, active, count, onPress, tint, onDark = true,
}: {
  icon: string; activeIcon?: string; active?: boolean; count?: number;
  onPress: () => void; tint?: string; onDark?: boolean;
}) {
  const inactive = onDark ? 'rgba(255,253,244,0.88)' : FEED_TEXT;
  return (
    <TouchableOpacity onPress={onPress} style={cardActionStyles.pill} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <View style={[
        cardActionStyles.pillInner,
        !onDark && cardActionStyles.pillInnerLight,
        active && tint ? { backgroundColor: tint + '26' } : {},
      ]}>
        <Ionicons
          name={(active && activeIcon ? activeIcon : icon) as any}
          size={20}
          color={active && tint ? tint : inactive}
        />
        {(count ?? 0) > 0 && (
          <AppText style={[
            cardActionStyles.pillCount,
            !onDark && cardActionStyles.pillCountLight,
            active && tint ? { color: tint } : {},
          ]}>
            {count! > 999 ? `${(count! / 1000).toFixed(1)}k` : count}
          </AppText>
        )}
      </View>
    </TouchableOpacity>
  );
}

const cardActionStyles = StyleSheet.create({
  pill: { marginRight: 6 },
  pillInner: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  pillInnerLight: {
    backgroundColor: 'rgba(111,145,95,0.10)',
    borderColor: 'rgba(35,48,31,0.10)',
  },
  pillCount: {
    fontSize: 13, color: 'rgba(255,255,255,0.85)',
    fontWeight: '600',
  },
  pillCountLight: {
    color: FEED_TEXT,
  },
});

function PostItem({
  post,
  currentUserId,
  onLike,
  onComment,
  onShare,
  onDelete,
  colors,
  fonts,
}: {
  post: Post;
  currentUserId: string | undefined;
  onLike: () => Promise<unknown>;
  onComment: () => void;
  onShare: () => void;
  onDelete: () => void;
  styles: Record<string, any>;
  colors: OrbitThemeColors;
  fonts: Partial<Record<'regular' | 'medium' | 'semibold' | 'bold' | 'extrabold', string>>;
}) {
  const [isLiked, setIsLiked] = useState(post.is_liked);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const isOwn = currentUserId != null && post.author.id === currentUserId;

  useEffect(() => {
    setIsLiked(post.is_liked);
    setLikeCount(post.like_count);
  }, [post.id, post.is_liked, post.like_count]);

  const handleLike = async () => {
    const nextLiked = !isLiked;
    setIsLiked(nextLiked);
    setLikeCount((c) => (nextLiked ? c + 1 : Math.max(0, c - 1)));
    try { await onLike(); } catch {
      setIsLiked(post.is_liked);
      setLikeCount(post.like_count);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete post', 'Remove this moment?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);
  };

  const timeStr = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });
  const subline = post.location_name ? `${post.location_name}  ·  ${timeStr}` : timeStr;

  const renderActions = (onDark = true) => (
    <View style={pcS.actionRow}>
      <ActionPill
        icon="heart-outline" activeIcon="heart"
        active={isLiked} count={likeCount}
        onPress={handleLike} tint={FEED_ROSE}
        onDark={onDark}
      />
      <ActionPill
        icon="chatbubble-outline"
        count={post.comment_count}
        onPress={onComment}
        onDark={onDark}
      />
      <ActionPill icon="paper-plane-outline" onPress={onShare} onDark={onDark} />
      {isOwn && (
        <ActionPill icon="trash-outline" onPress={handleDelete} tint="#C83F3C" onDark={onDark} />
      )}
    </View>
  );

  /* ─── IMAGE CARD ─────────────────────────────────────────── */
  if (post.image_url) {
    const cardH = Math.round(CARD_W * 0.75); // 4:3
    return (
      <View style={[pcS.card, { height: cardH }]}>
        <Image source={{ uri: post.image_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />

        {/* Top gradient + author */}
        <LinearGradient
          colors={['rgba(0,0,0,0.72)', 'rgba(0,0,0,0)']}
          style={pcS.topGrad}
        >
          <Avatar uri={post.author.avatar} name={post.author.username} size={34} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <AppText style={[pcS.overlayName, { fontFamily: fonts.bold }]}>
              {post.author.username}
            </AppText>
            <AppText style={[pcS.overlaySub, { fontFamily: fonts.regular }]}>
              {subline}
            </AppText>
          </View>
          {post.privacy !== 'public' && (
            <View style={pcS.privacyDot}>
              <Ionicons
                name={post.privacy === 'connections' ? 'people' : 'lock-closed'}
                size={11} color="rgba(255,255,255,0.7)"
              />
            </View>
          )}
        </LinearGradient>

        {/* Bottom gradient + caption + actions */}
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.80)']}
          style={pcS.bottomGrad}
        >
          {post.caption ? (
            <AppText
              style={[pcS.captionOverlay, { fontFamily: fonts.regular }]}
              numberOfLines={2}
            >
              {post.caption}
            </AppText>
          ) : null}
          {renderActions(true)}
        </LinearGradient>
      </View>
    );
  }

  /* ─── TEXT CARD ──────────────────────────────────────────── */
  // Pick gradient accent based on post id hash for variety
  const hue = post.id.charCodeAt(0) % 3;
  const textGradients: [string, string, string][] = [
    ['#FFFDF4', '#FFF9EA', '#F7ECCD'],
    ['#FFFDF4', '#FAF1DA', '#F2E4BF'],
    ['#FFFDF4', '#F8EFD1', '#EFDFB9'],
  ];
  const [gc1, gc2, gc3] = textGradients[hue];

  return (
    <View style={pcS.textCard}>
      <LinearGradient
        colors={[gc1, gc2, gc3]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Decorative glyph */}
      <AppText style={pcS.glyphBg} allowFontScaling={false}>○</AppText>

      {/* Content */}
      <View style={pcS.textCardInner}>
        {post.caption ? (
          <AppText style={[pcS.textCardCaption, { fontFamily: fonts.bold }]} numberOfLines={5}>
            {post.caption}
          </AppText>
        ) : (
          <AppText style={[pcS.textCardCaption, { fontFamily: fonts.bold, opacity: 0.3 }]}>
            —
          </AppText>
        )}

        <View style={pcS.textCardFooter}>
          <View style={pcS.textCardAuthor}>
            <Avatar uri={post.author.avatar} name={post.author.username} size={22} />
            <AppText style={[pcS.textCardName, { fontFamily: fonts.medium }]}>
              {post.author.username}
              <AppText style={pcS.textCardTime}>{`  ·  ${timeStr}`}</AppText>
            </AppText>
          </View>
          {renderActions(false)}
        </View>
      </View>
    </View>
  );
}

/** Styles scoped to the PostItem card only */
const pcS = StyleSheet.create({
  card: {
    width: CARD_W,
    alignSelf: 'center',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 14,
  },
  topGrad: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: 90,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 14,
    paddingHorizontal: 14,
  },
  bottomGrad: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingTop: 40,
    paddingBottom: 14,
    paddingHorizontal: 14,
  },
  overlayName: {
    fontSize: 14, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0,
  },
  overlaySub: {
    fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 1,
  },
  privacyDot: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  captionOverlay: {
    fontSize: 14, color: '#FFFFFF', lineHeight: 20,
    marginBottom: 10,
  },
  actionRow: {
    flexDirection: 'row', alignItems: 'center',
  },
  // Text card
  textCard: {
    width: CARD_W,
    alignSelf: 'center',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 14,
    minHeight: 200,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(35,48,31,0.10)',
  },
  glyphBg: {
    position: 'absolute',
    right: -20,
    top: -30,
    fontSize: 200,
    color: 'rgba(111,145,95,0.08)',
    lineHeight: 220,
  },
  textCardInner: {
    padding: 20,
    flex: 1,
    justifyContent: 'space-between',
    minHeight: 200,
  },
  textCardCaption: {
    fontSize: 20,
    fontWeight: '700',
    color: FEED_TEXT,
    lineHeight: 28,
    letterSpacing: 0,
    flex: 1,
    paddingBottom: 16,
  },
  textCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textCardAuthor: {
    flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1,
  },
  textCardName: {
    fontSize: 13, color: FEED_MUTED, fontWeight: '500',
  },
  textCardTime: {
    fontSize: 12, color: FEED_MUTED,
  },
});

// CARD_W defined above in PostItem scope

export default function FeedScreen() {
  const { colors, resolvedScheme, fonts, shadows } = useOrbitTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [caption, setCaption] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [privacy, setPrivacy] = useState<'public' | 'connections'>('public');
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'events' | 'posts'>('events');

  const currentUser = useAuthStore((s) => s.user);
  const { data: posts = [], isLoading, isRefetching, refetch } = useFeedQuery();
  const { data: eventsData, isLoading: eventsLoading, isRefetching: eventsRefetching, refetch: refetchEvents } = useEventsFeedQuery();
  const events = eventsData?.results ?? [];
  const toggleLike = useToggleLikeMutation();
  const createPostMutation = useCreatePostMutation();
  const deletePostMutation = useDeletePostMutation();
  const joinEventMutation = useJoinEventMutation();

  const handleOpenComments = (postId: string) => {
    setSelectedPostId(postId);
    setCommentsModalVisible(true);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'We need access to your photos to create a post.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) setSelectedImage(result.assets[0].uri);
  };

  const handleCreatePost = async () => {
    if (!caption.trim() && !selectedImage) {
      Alert.alert('Empty Post', 'Please add a caption or an image.');
      return;
    }
    try {
      const formData = new FormData();
      formData.append('caption', caption);
      formData.append('privacy', privacy);
      if (selectedImage) {
        const uriParts = selectedImage.split('.');
        const fileType = uriParts[uriParts.length - 1];
        formData.append('image', { uri: selectedImage, name: `post_${Date.now()}.${fileType}`, type: `image/${fileType}` } as any);
      }
      await createPostMutation.mutateAsync(formData);
      setCreateModalVisible(false);
      setCaption('');
      setSelectedImage(null);
      setPrivacy('public');
    } catch (error) {
      console.error('Error creating post:', error);
      Alert.alert('Error', 'Failed to create post. Please try again.');
    }
  };

  const handleShare = async (post: Post) => {
    try {
      const message = `${post.caption ? post.caption + '\n\n' : ''}Check out this post on ORBIT by ${post.author.username}!`;
      const url = post.image_url || '';
      await Share.share({ message, url: Platform.OS === 'ios' ? url : undefined, title: 'Share Post' });
    } catch (error: any) {
      console.error('Error sharing post:', error.message);
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background.primary },
        safeArea: { flex: 1 },
        listContent: { paddingTop: 6 },
        listContentEmpty: { flexGrow: 1 },
        loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background.primary },
        feedHeader: {
          marginHorizontal: Spacing.md,
          marginTop: 8,
          marginBottom: 14,
          borderRadius: 28,
          overflow: 'hidden',
          ...shadows.md,
        },
        feedHeaderGrad: {
          paddingTop: Platform.OS === 'android' ? 14 : 12,
          paddingBottom: Spacing.md,
        },
        headerRow: {
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          paddingHorizontal: Spacing.md,
          paddingBottom: 14,
        },
        headerTitle: {
          fontSize: 30, fontWeight: '800', color: colors.background.card,
          letterSpacing: 0, fontFamily: fonts.extrabold, lineHeight: 34,
        },
        headerSub: {
          fontSize: 14, color: 'rgba(255,255,255,0.74)',
          fontFamily: fonts.regular, marginTop: 0,
        },
        headerCompose: {
          width: 40, height: 40, borderRadius: 20,
          overflow: 'hidden',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: 'rgba(255,255,255,0.20)',
        },
        headerComposeGrad: {
          width: 40, height: 40, borderRadius: 20,
          alignItems: 'center', justifyContent: 'center',
        },
        tabsWrap: {
          flexDirection: 'row',
          marginHorizontal: Spacing.md,
          marginBottom: 0,
          padding: 3,
          borderRadius: BorderRadius.full,
          backgroundColor: 'rgba(255,255,255,0.16)',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: 'rgba(255,255,255,0.18)',
        },
        tabBtn: {
          flex: 1,
          minHeight: 34,
          borderRadius: BorderRadius.full,
          alignItems: 'center',
          justifyContent: 'center',
        },
        tabBtnActive: {
          backgroundColor: colors.background.card,
        },
        tabText: {
          color: 'rgba(255,255,255,0.76)',
          fontSize: FontSizes.sm,
          fontFamily: fonts.semibold,
          fontWeight: FontWeights.semibold,
        },
        tabTextActive: {
          color: colors.primary.dark,
        },
        eventCard: {
          marginHorizontal: Spacing.lg,
          marginBottom: 14,
          padding: 0,
          borderRadius: 20,
          backgroundColor: colors.background.card,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.borderLight,
          overflow: 'hidden',
          ...shadows.sm,
        },
        eventPosterBand: {
          height: 7,
          backgroundColor: colors.primary.dark,
        },
        eventCardInner: {
          padding: Spacing.md,
        },
        eventTop: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 12,
        },
        eventDateTile: {
          width: 52,
          minHeight: 62,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primary.dark,
          paddingVertical: 8,
        },
        eventDateMonth: {
          color: colors.background.card,
          fontSize: 11,
          fontFamily: fonts.semibold,
          fontWeight: FontWeights.semibold,
          textTransform: 'uppercase',
        },
        eventDateDay: {
          color: colors.background.card,
          fontSize: 22,
          fontFamily: fonts.extrabold,
          fontWeight: FontWeights.extrabold,
          lineHeight: 26,
        },
        eventTitle: {
          flex: 1,
          color: colors.text.primary,
          fontSize: 19,
          fontFamily: fonts.extrabold,
          fontWeight: FontWeights.extrabold,
          lineHeight: 24,
        },
        eventCategoryPill: {
          alignSelf: 'flex-start',
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: BorderRadius.full,
          backgroundColor: colors.primary.default + '1F',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.primary.default + '35',
          marginBottom: 8,
        },
        eventCategoryText: {
          color: colors.primary.dark,
          fontSize: 11,
          fontFamily: fonts.semibold,
          fontWeight: FontWeights.semibold,
          textTransform: 'capitalize',
        },
        eventMetaRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          marginTop: 5,
        },
        eventMetaText: {
          flex: 1,
          color: colors.text.secondary,
          fontSize: 13,
          fontFamily: fonts.regular,
          lineHeight: 18,
        },
        eventBody: {
          marginTop: 12,
          color: colors.text.secondary,
          fontSize: 14,
          fontFamily: fonts.regular,
          lineHeight: 20,
        },
        eventFooter: {
          marginTop: 14,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        },
        eventCountPill: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          paddingHorizontal: 10,
          paddingVertical: 7,
          borderRadius: BorderRadius.full,
          backgroundColor: colors.background.secondary,
        },
        eventCount: {
          color: colors.text.secondary,
          fontSize: 13,
          fontFamily: fonts.medium,
        },
        eventJoinBtn: {
          minWidth: 92,
          alignItems: 'center',
          paddingHorizontal: Spacing.md,
          paddingVertical: 10,
          borderRadius: BorderRadius.full,
          backgroundColor: colors.primary.dark,
        },
        eventJoinText: {
          color: colors.background.card,
          fontSize: FontSizes.sm,
          fontWeight: FontWeights.semibold,
          fontFamily: fonts.semibold,
        },
        // (card styles now live in pcS — static stylesheet above)
        emptyContainer: { flex: 1, minHeight: 320, alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xxl, paddingHorizontal: Spacing.xl },
        emptyText: { color: colors.text.primary, fontSize: FontSizes.xl, fontWeight: FontWeights.bold, marginTop: Spacing.lg, fontFamily: fonts.bold },
        emptySubtext: { color: colors.text.secondary, fontSize: FontSizes.md, textAlign: 'center', marginTop: Spacing.xs, fontFamily: fonts.regular },
        createButton: { marginTop: Spacing.xl, borderRadius: BorderRadius.lg, backgroundColor: colors.primary.default, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
        createButtonText: { color: colors.text.primary, fontSize: FontSizes.md, fontWeight: FontWeights.semibold, fontFamily: fonts.semibold },
        modalContainer: { flex: 1, backgroundColor: colors.background.primary },
        modalHeader: {
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
        },
        modalTitle: { fontSize: FontSizes.lg, fontWeight: FontWeights.semibold, color: colors.text.primary, fontFamily: fonts.semibold },
        shareButton: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: colors.primary.default },
        shareButtonDisabled: { opacity: 0.35 },
        shareText: { color: colors.text.primary, fontSize: FontSizes.sm, fontWeight: FontWeights.semibold, fontFamily: fonts.semibold },
        imagePickerContainer: { width: SCREEN_WIDTH, aspectRatio: 1, backgroundColor: colors.background.tertiary },
        selectedImage: { width: '100%', height: '100%' },
        imagePlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background.elevated },
        imagePlaceholderText: { color: colors.text.tertiary, marginTop: Spacing.md, fontSize: FontSizes.sm, fontWeight: FontWeights.medium, fontFamily: fonts.medium },
        captionSection: { flex: 1, padding: Spacing.lg },
        captionInput: { flex: 1, color: colors.text.primary, fontSize: FontSizes.md, textAlignVertical: 'top', lineHeight: 22, fontFamily: fonts.regular },
        characterCount: { color: colors.text.tertiary, fontSize: 12, textAlign: 'right', marginTop: Spacing.sm, fontFamily: fonts.regular },
        privacyRow: {
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
          borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
        },
        privacyLabel: { color: colors.text.secondary, fontSize: FontSizes.sm, fontFamily: fonts.regular },
        privacyOptions: { flexDirection: 'row', gap: Spacing.sm },
        privacyOption: {
          flexDirection: 'row', alignItems: 'center', gap: 4,
          paddingHorizontal: Spacing.sm, paddingVertical: 5, borderRadius: BorderRadius.full,
          borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderLight,
          backgroundColor: colors.background.secondary,
        },
        privacyOptionActive: { backgroundColor: colors.primary.default, borderColor: colors.primary.default },
        privacyOptionText: { color: colors.text.secondary, fontSize: FontSizes.xs, fontFamily: fonts.medium },
        privacyOptionTextActive: { color: colors.text.primary },
      }),
    [colors, fonts, shadows]
  );

  const renderEvent = ({ item }: { item: OrbitEvent }) => {
    const handleJoin = async () => {
      if (item.has_joined && item.conversation_id) {
        router.push(`/chat/${item.conversation_id}`);
        return;
      }
      const res = await joinEventMutation.mutateAsync(item.id);
      router.push(`/chat/${res.conversation_id}`);
    };

    return (
      <TouchableOpacity style={styles.eventCard} activeOpacity={0.9} onPress={() => router.push(`/event/${item.id}`)}>
        <View style={styles.eventPosterBand} />
        <View style={styles.eventCardInner}>
          <View style={styles.eventTop}>
            <View style={styles.eventDateTile}>
              <AppText style={styles.eventDateMonth}>{format(new Date(item.start_at), 'MMM')}</AppText>
              <AppText style={styles.eventDateDay}>{format(new Date(item.start_at), 'd')}</AppText>
            </View>
            <View style={{ flex: 1 }}>
              {item.category ? (
                <View style={styles.eventCategoryPill}>
                  <AppText style={styles.eventCategoryText}>{item.category}</AppText>
                </View>
              ) : null}
              <AppText style={styles.eventTitle} numberOfLines={2}>{item.title}</AppText>
              <View style={styles.eventMetaRow}>
                <Ionicons name="time-outline" size={14} color={colors.text.tertiary} />
                <AppText style={styles.eventMetaText} numberOfLines={1}>
                  {formatDistanceToNow(new Date(item.start_at), { addSuffix: true })}
                </AppText>
              </View>
              <View style={styles.eventMetaRow}>
                <Ionicons name="location-outline" size={14} color={colors.text.tertiary} />
                <AppText style={styles.eventMetaText} numberOfLines={1}>{item.location_name}</AppText>
              </View>
            </View>
          </View>
          {item.description ? (
            <AppText style={styles.eventBody} numberOfLines={2}>{item.description}</AppText>
          ) : null}
          <View style={styles.eventFooter}>
            <View style={styles.eventCountPill}>
              <Ionicons name="people-outline" size={14} color={colors.text.secondary} />
              <AppText style={styles.eventCount}>
                {item.attendee_count} going
              </AppText>
            </View>
            <TouchableOpacity
              style={styles.eventJoinBtn}
              onPress={(event) => {
                event.stopPropagation();
                void handleJoin();
              }}
              disabled={joinEventMutation.isPending}
            >
              <AppText style={styles.eventJoinText}>{item.has_joined ? 'Open group' : 'Join'}</AppText>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const feedListHeader = (
    <View style={styles.feedHeader}>
      <LinearGradient
        colors={[colors.primary.dark, colors.primary.end, colors.primary.default]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.feedHeaderGrad}
      >
      <View style={styles.headerRow}>
        <View>
          <AppText style={styles.headerTitle}>Moments</AppText>
          <AppText style={styles.headerSub}>{activeTab === 'events' ? 'Plans and groups around you' : "What's happening nearby"}</AppText>
        </View>
        <TouchableOpacity
          style={styles.headerCompose}
          onPress={() => activeTab === 'posts' ? setCreateModalVisible(true) : router.push('/(tabs)')}
          accessibilityLabel={activeTab === 'posts' ? 'New post' : 'Open map to create event'}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0.24)', 'rgba(255,255,255,0.12)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.headerComposeGrad}
          >
            <Ionicons name={activeTab === 'posts' ? 'add' : 'map-outline'} size={22} color={colors.background.card} />
          </LinearGradient>
        </TouchableOpacity>
      </View>
      <View style={styles.tabsWrap}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'events' && styles.tabBtnActive]}
          onPress={() => setActiveTab('events')}
        >
          <AppText style={[styles.tabText, activeTab === 'events' && styles.tabTextActive]}>Events</AppText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'posts' && styles.tabBtnActive]}
          onPress={() => setActiveTab('posts')}
        >
          <AppText style={[styles.tabText, activeTab === 'posts' && styles.tabTextActive]}>Posts</AppText>
        </TouchableOpacity>
      </View>
      </LinearGradient>
    </View>
  );

  const listData: Array<Post | OrbitEvent> = activeTab === 'events' ? events : posts;

  if ((activeTab === 'posts' && isLoading) || (activeTab === 'events' && eventsLoading)) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary.default} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle={resolvedScheme === 'dark' ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <FlatList<Post | OrbitEvent>
          data={listData}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={feedListHeader}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Spacing.xxl + tabBarHeight },
            (activeTab === 'events' ? events.length === 0 : posts.length === 0) && styles.listContentEmpty,
          ]}
          renderItem={({ item }) => activeTab === 'events' ? renderEvent({ item: item as OrbitEvent }) : (
            <PostItem
              post={item as Post}
              currentUserId={currentUser?.id}
              onLike={() => toggleLike.mutateAsync((item as Post).id)}
              onComment={() => handleOpenComments((item as Post).id)}
              onShare={() => handleShare(item as Post)}
              onDelete={() => deletePostMutation.mutate((item as Post).id)}
              styles={{}}
              colors={colors}
              fonts={fonts}
            />
          )}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={activeTab === 'events' ? eventsRefetching : isRefetching}
              onRefresh={() => activeTab === 'events' ? refetchEvents() : refetch()}
              tintColor={colors.primary.default}
              colors={[colors.primary.default]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name={activeTab === 'events' ? 'calendar-outline' : 'images-outline'} size={64} color={colors.text.tertiary} />
              <AppText style={styles.emptyText}>{activeTab === 'events' ? 'No events yet' : 'No posts yet'}</AppText>
              <AppText style={styles.emptySubtext}>{activeTab === 'events' ? 'Create a plan from the map to start a group.' : 'Share your first moment'}</AppText>
              {activeTab === 'posts' ? (
                <TouchableOpacity style={styles.createButton} onPress={() => setCreateModalVisible(true)}>
                  <AppText style={styles.createButtonText}>New post</AppText>
                </TouchableOpacity>
              ) : null}
            </View>
          }
        />
      </SafeAreaView>

      <CommentsModal visible={commentsModalVisible} onClose={() => setCommentsModalVisible(false)} postId={selectedPostId} />

      <Modal visible={createModalVisible} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setCreateModalVisible(false)}>
        <View style={styles.modalContainer}>
          <StatusBar barStyle="dark-content" />
          <View style={[styles.modalHeader, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity onPress={() => setCreateModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={28} color={colors.text.primary} />
            </TouchableOpacity>
            <AppText style={styles.modalTitle}>New Post</AppText>
            <TouchableOpacity
              onPress={handleCreatePost}
              disabled={createPostMutation.isPending || (!caption.trim() && !selectedImage)}
              style={[styles.shareButton, (createPostMutation.isPending || (!caption.trim() && !selectedImage)) && styles.shareButtonDisabled]}
            >
              <AppText style={styles.shareText}>{createPostMutation.isPending ? 'Posting…' : 'Post'}</AppText>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.imagePickerContainer} onPress={pickImage} activeOpacity={0.9}>
            {selectedImage ? (
              <Image source={{ uri: selectedImage }} style={styles.selectedImage} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="image-outline" size={48} color={colors.text.tertiary} />
                <AppText style={styles.imagePlaceholderText}>Tap to add a photo</AppText>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.privacyRow}>
            <AppText style={styles.privacyLabel}>Who can see this?</AppText>
            <View style={styles.privacyOptions}>
              <TouchableOpacity style={[styles.privacyOption, privacy === 'public' && styles.privacyOptionActive]} onPress={() => setPrivacy('public')}>
                <Ionicons name="globe-outline" size={14} color={privacy === 'public' ? colors.text.primary : colors.text.secondary} />
                <AppText style={[styles.privacyOptionText, privacy === 'public' && styles.privacyOptionTextActive]}>Public</AppText>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.privacyOption, privacy === 'connections' && styles.privacyOptionActive]} onPress={() => setPrivacy('connections')}>
                <Ionicons name="people-outline" size={14} color={privacy === 'connections' ? colors.text.primary : colors.text.secondary} />
                <AppText style={[styles.privacyOptionText, privacy === 'connections' && styles.privacyOptionTextActive]}>Connections</AppText>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.captionSection}>
            <TextInput
              style={styles.captionInput}
              placeholder="Write a caption..."
              placeholderTextColor={colors.text.tertiary}
              multiline
              value={caption}
              onChangeText={setCaption}
              maxLength={2200}
            />
            <AppText style={styles.characterCount}>{caption.length}/2200</AppText>
          </View>
        </View>
      </Modal>
    </View>
  );
}
