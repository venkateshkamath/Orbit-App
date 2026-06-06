import React, { memo, useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNowStrict } from 'date-fns';
import { API_BASE_URL } from '../api/client';
import { AppText } from '../ui/AppText';
import { CommentsModal } from './CommentsModal';
import { nameToAvatarColor } from '../constants/designTokens';
import { useDeletePostMutation, useToggleLikeMutation } from '../hooks/useOrbitApi';
import { useAuthStore } from '../stores';
import { useOrbitTheme } from '../theme';
import { useToast } from '../context/ToastContext';
import { formatApiError } from '../utils/apiErrors';
import type { Post } from '../types';

const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

function resolveUrl(url?: string | null): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/media/')) return `${API_ORIGIN}${url}`;
  if (url.startsWith('media/')) return `${API_ORIGIN}/${url}`;
  return url;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PostCardProps {
  post: Post;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const PostCard = memo(function PostCard({ post }: PostCardProps) {
  const currentUser = useAuthStore((s) => s.user);
  const { colors, shadows, resolvedScheme } = useOrbitTheme();
  const toast = useToast();
  const deleteMutation = useDeletePostMutation();
  const likeMutation = useToggleLikeMutation();
  const [commentsOpen, setCommentsOpen] = useState(false);

  const isOwn = currentUser?.id === post.author.id;
  const avatarColors = nameToAvatarColor(post.author.username);
  const avatarUri = resolveUrl(post.author.avatar);
  const imageUri = resolveUrl(post.image_url ?? post.image);
  const timeAgo = formatDistanceToNowStrict(new Date(post.created_at), { addSuffix: true });

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete post?',
      'This will permanently remove your post and all its comments.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteMutation.mutate(post.id, {
              onError: (err) => toast.error(formatApiError(err)),
            });
          },
        },
      ]
    );
  }, [deleteMutation, post.id, toast]);

  const handleLike = useCallback(() => {
    likeMutation.mutate(post.id, {
      onError: (err) => toast.error(formatApiError(err)),
    });
  }, [likeMutation, post.id, toast]);

  return (
    <>
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.background.card,
            borderColor: colors.borderLight,
            shadowColor: shadows.md.shadowColor,
            shadowOpacity: resolvedScheme === 'dark' ? 0.3 : 0.04,
          },
        ]}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          {/* Avatar */}
          <View
            style={[
              styles.avatar,
              { backgroundColor: avatarColors.bg },
            ]}
          >
            {avatarUri ? (
              <Image
                source={{ uri: avatarUri }}
                style={styles.avatarImage}
                contentFit="cover"
              />
            ) : (
              <AppText style={[styles.avatarInitial, { color: avatarColors.text }]}>
                {post.author.username.charAt(0).toUpperCase()}
              </AppText>
            )}
          </View>

          {/* Name + time */}
          <View style={styles.authorBlock}>
            <AppText style={[styles.username, { color: colors.text.primary }]}>@{post.author.username}</AppText>
            <AppText style={[styles.timestamp, { color: colors.text.tertiary }]}>{timeAgo}</AppText>
          </View>

          {/* 3-dot menu — own posts only */}
          {isOwn ? (
            <TouchableOpacity
              style={styles.menuBtn}
              onPress={handleDelete}
              hitSlop={8}
            >
              <Ionicons name="ellipsis-horizontal" size={20} color={colors.text.tertiary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* ── Caption ── */}
        {post.caption ? (
          <AppText style={[styles.caption, { color: colors.text.primary }]}>{post.caption}</AppText>
        ) : null}

        {/* ── Image ── */}
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={[styles.postImage, { backgroundColor: colors.background.secondary }]}
            contentFit="cover"
            transition={200}
          />
        ) : null}

        {/* ── Footer ── */}
        <View style={styles.footer}>
          {/* Like */}
          <TouchableOpacity
            style={styles.footerAction}
            onPress={handleLike}
            disabled={likeMutation.isPending}
          >
            <Ionicons
              name={post.is_liked ? 'heart' : 'heart-outline'}
              size={18}
              color={post.is_liked ? colors.error : colors.text.tertiary}
            />
            <AppText style={[styles.footerCount, { color: colors.text.secondary }]}>{post.like_count}</AppText>
          </TouchableOpacity>

          {/* Comments */}
          <TouchableOpacity
            style={styles.footerAction}
            onPress={() => setCommentsOpen(true)}
          >
            <Ionicons name="chatbubble-outline" size={17} color={colors.text.tertiary} />
            <AppText style={[styles.footerCount, { color: colors.text.secondary }]}>{post.comment_count}</AppText>
          </TouchableOpacity>

          {/* Location */}
          {post.location_name ? (
            <View style={styles.footerLocation}>
              <Ionicons name="location-outline" size={14} color={colors.text.muted} />
              <AppText style={[styles.footerLocationText, { color: colors.text.muted }]} numberOfLines={1}>
                {post.location_name}
              </AppText>
            </View>
          ) : null}
        </View>

        {/* Deleting overlay */}
        {deleteMutation.isPending ? (
          <View style={[styles.deletingOverlay, { backgroundColor: resolvedScheme === 'dark' ? 'rgba(5,8,13,0.82)' : 'rgba(255,255,255,0.75)' }]}>
            <AppText style={[styles.deletingText, { color: colors.error }]}>Deleting…</AppText>
          </View>
        ) : null}
      </View>

      <CommentsModal
        visible={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        postId={post.id}
      />
    </>
  );
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    overflow: 'hidden',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    paddingBottom: 10,
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  avatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarInitial: {
    fontSize: 14,
    fontWeight: '700',
  },
  authorBlock: {
    flex: 1,
    minWidth: 0,
  },
  username: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0D0D0D',
  },
  timestamp: {
    fontSize: 12,
    color: '#AAAAAA',
    marginTop: 1,
  },
  menuBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // Caption
  caption: {
    fontSize: 15,
    color: '#0D0D0D',
    lineHeight: 22,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },

  // Image
  postImage: {
    width: '100%',
    height: 240,
    backgroundColor: '#F0F0F0',
  },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 16,
  },
  footerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  footerCount: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  footerLocation: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    justifyContent: 'flex-end',
  },
  footerLocationText: {
    fontSize: 12,
    color: '#BBB',
    flexShrink: 1,
  },

  // Deleting overlay
  deletingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deletingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
});
