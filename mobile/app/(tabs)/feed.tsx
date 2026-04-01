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
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { FontSizes, FontWeights, Spacing, BorderRadius } from '../../constants/Colors';
import { useOrbitTheme, type OrbitThemeColors } from '../../src/theme';
import { Avatar, CommentsModal } from '../../src/components';
import { useCreatePostMutation, useFeedQuery, useToggleLikeMutation } from '../../src/hooks/useOrbitApi';
import { AppText } from '../../src/ui/AppText';
import { Post } from '../../src/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function PostItem({
  post,
  onLike,
  onComment,
  onShare,
  styles,
  colors,
}: {
  post: Post;
  onLike: () => Promise<unknown>;
  onComment: () => void;
  onShare: () => void;
  styles: Record<string, any>;
  colors: OrbitThemeColors;
}) {
  const [isLiked, setIsLiked] = useState(post.is_liked);
  const [likeCount, setLikeCount] = useState(post.like_count);

  useEffect(() => {
    setIsLiked(post.is_liked);
    setLikeCount(post.like_count);
  }, [post.id, post.is_liked, post.like_count]);

  const handleLike = async () => {
    const nextLiked = !isLiked;
    setIsLiked(nextLiked);
    setLikeCount((c) => (nextLiked ? c + 1 : Math.max(0, c - 1)));
    try {
      await onLike();
    } catch {
      setIsLiked(post.is_liked);
      setLikeCount(post.like_count);
    }
  };

  return (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <View style={styles.headerLeft}>
          <Avatar uri={post.author.avatar} name={post.author.username} size={32} />
          <View style={styles.headerInfo}>
            <AppText style={styles.username}>{post.author.username}</AppText>
            {post.location_name && (
              <AppText style={styles.locationText}>{post.location_name}</AppText>
            )}
          </View>
        </View>
        <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="ellipsis-horizontal" size={18} color={colors.text.tertiary} />
        </TouchableOpacity>
      </View>

      {post.image_url && (
        <Image
          source={{ uri: post.image_url }}
          style={styles.postImage}
          resizeMode="cover"
        />
      )}

      <View style={styles.postActions}>
        <View style={styles.actionRow}>
          <TouchableOpacity onPress={handleLike} style={styles.actionButton}>
            <Ionicons
              name={isLiked ? 'heart' : 'heart-outline'}
              size={24}
              color={isLiked ? colors.error : colors.text.secondary}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={onComment} style={styles.actionButton}>
            <Ionicons name="chatbubble-outline" size={22} color={colors.text.secondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onShare} style={styles.actionButton}>
            <Ionicons name="share-outline" size={22} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.postContent}>
        {likeCount > 0 && (
          <AppText style={styles.likesText}>{likeCount.toLocaleString()} likes</AppText>
        )}
        
        {post.caption && (
          <View style={styles.captionContainer}>
            <AppText style={styles.captionText}>
              <AppText style={styles.usernameInline}>{post.author.username}</AppText> {post.caption}
            </AppText>
          </View>
        )}

        {post.comment_count >= 0 && (
          <TouchableOpacity onPress={onComment}>
            <AppText style={styles.viewComments}>
              {post.comment_count === 0 
                ? 'Add a comment...' 
                : `View all ${post.comment_count} comments`}
            </AppText>
          </TouchableOpacity>
        )}

        <AppText style={styles.timestamp}>
          {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
        </AppText>
      </View>
    </View>
  );
}

const CARD_INSET = Spacing.lg * 2;

export default function FeedScreen() {
  const { colors, resolvedScheme, fonts, shadows } = useOrbitTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [caption, setCaption] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  const { data: posts = [], isLoading, isRefetching, refetch } = useFeedQuery();
  const toggleLike = useToggleLikeMutation();
  const createPostMutation = useCreatePostMutation();

  const handleOpenComments = (postId: string) => {
    setSelectedPostId(postId);
    setCommentsModalVisible(true);
  };

  const handleRefresh = () => {
    refetch();
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

    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const handleCreatePost = async () => {
    if (!caption.trim() && !selectedImage) {
      Alert.alert('Empty Post', 'Please add a caption or an image.');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('caption', caption);
      
      if (selectedImage) {
        const uriParts = selectedImage.split('.');
        const fileType = uriParts[uriParts.length - 1];
        
        formData.append('image', {
          uri: selectedImage,
          name: `post_${Date.now()}.${fileType}`,
          type: `image/${fileType}`,
        } as any);
      }
      
      await createPostMutation.mutateAsync(formData);
      
      setCreateModalVisible(false);
      setCaption('');
      setSelectedImage(null);
    } catch (error) {
      console.error('Error creating post:', error);
      Alert.alert('Error', 'Failed to create post. Please try again.');
    }
  };

  const handleShare = async (post: Post) => {
    try {
      const message = `${post.caption ? post.caption + '\n\n' : ''}Check out this post on ORBIT by ${post.author.username}!`;
      const url = post.image_url || ''; // You could also use a deep link here if available
      
      await Share.share({
        message,
        url: Platform.OS === 'ios' ? url : undefined,
        title: 'Share Post',
      });
    } catch (error: any) {
      console.error('Error sharing post:', error.message);
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background.primary,
        },
        safeArea: {
          flex: 1,
        },
        listContent: {
          paddingTop: Spacing.sm,
        },
        listContentEmpty: {
          flexGrow: 1,
        },
        loadingContainer: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.background.primary,
        },
        feedHeader: {
          backgroundColor: 'transparent',
          paddingBottom: Spacing.xs,
        },
        headerRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: Spacing.lg,
          paddingBottom: Platform.OS === 'android' ? 10 : 12,
        },
        headerTitle: {
          fontSize: 28,
          fontWeight: '700',
          color: colors.text.primary,
          letterSpacing: -0.5,
          fontFamily: fonts.bold,
        },
        headerCompose: {
          width: 44,
          height: 44,
          borderRadius: BorderRadius.full,
          backgroundColor: colors.background.card,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.borderLight,
          ...shadows.sm,
        },
        postCard: {
          width: SCREEN_WIDTH - CARD_INSET,
          alignSelf: 'center',
          marginBottom: Spacing.md,
          backgroundColor: colors.background.card,
          borderRadius: BorderRadius.xl,
          overflow: 'hidden',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          paddingBottom: Spacing.sm,
          ...shadows.sm,
        },
        postHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: Spacing.lg,
          paddingVertical: Platform.OS === 'android' ? 8 : 10,
        },
        headerLeft: {
          flexDirection: 'row',
          alignItems: 'center',
          flex: 1,
        },
        headerInfo: {
          marginLeft: Spacing.sm,
          flex: 1,
        },
        username: {
          color: colors.text.primary,
          fontSize: FontSizes.sm,
          fontWeight: FontWeights.semibold,
          fontFamily: fonts.semibold,
        },
        locationText: {
          color: colors.text.secondary,
          fontSize: 11,
          marginTop: 1,
          fontFamily: fonts.regular,
        },
        postImage: {
          width: SCREEN_WIDTH - CARD_INSET,
          aspectRatio: 1,
          backgroundColor: colors.background.secondary,
        },
        postActions: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: Spacing.lg,
          paddingVertical: Platform.OS === 'android' ? 6 : Spacing.sm,
        },
        actionRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacing.md,
        },
        actionButton: {
          padding: 4,
        },
        postContent: {
          paddingHorizontal: Spacing.lg,
          paddingBottom: Spacing.sm,
        },
        likesText: {
          color: colors.text.secondary,
          fontSize: FontSizes.sm,
          fontWeight: FontWeights.medium,
          marginBottom: 6,
          fontFamily: fonts.medium,
        },
        captionContainer: {
          marginBottom: 4,
        },
        captionText: {
          color: colors.text.primary,
          fontSize: FontSizes.sm,
          lineHeight: 18,
          fontFamily: fonts.regular,
        },
        usernameInline: {
          fontWeight: FontWeights.semibold,
          fontFamily: fonts.semibold,
        },
        viewComments: {
          color: colors.text.tertiary,
          fontSize: FontSizes.sm,
          marginTop: 4,
          marginBottom: 4,
          fontFamily: fonts.regular,
        },
        timestamp: {
          color: colors.text.muted,
          fontSize: FontSizes.xs,
          marginTop: 6,
          fontFamily: fonts.regular,
        },
        emptyContainer: {
          flex: 1,
          minHeight: 320,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: Spacing.xxl,
          paddingHorizontal: Spacing.xl,
        },
        emptyText: {
          color: colors.text.primary,
          fontSize: FontSizes.xl,
          fontWeight: FontWeights.bold,
          marginTop: Spacing.lg,
          fontFamily: fonts.bold,
        },
        emptySubtext: {
          color: colors.text.secondary,
          fontSize: FontSizes.md,
          textAlign: 'center',
          marginTop: Spacing.xs,
          fontFamily: fonts.regular,
        },
        createButton: {
          marginTop: Spacing.xl,
          borderRadius: BorderRadius.lg,
          backgroundColor: colors.primary.default,
          paddingHorizontal: Spacing.xl,
          paddingVertical: Spacing.md,
        },
        createButtonText: {
          color: '#FFFFFF',
          fontSize: FontSizes.md,
          fontWeight: FontWeights.semibold,
          fontFamily: fonts.semibold,
        },
  
        // Modal Styles
        modalContainer: {
          flex: 1,
          backgroundColor: colors.background.primary,
        },
        modalHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: Spacing.lg,
          paddingBottom: Spacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        modalTitle: {
          fontSize: FontSizes.lg,
          fontWeight: FontWeights.semibold,
          color: colors.text.primary,
          fontFamily: fonts.semibold,
        },
        shareButton: {
          paddingHorizontal: Spacing.lg,
          paddingVertical: Spacing.sm,
          borderRadius: BorderRadius.md,
          backgroundColor: colors.primary.default,
        },
        shareButtonDisabled: {
          opacity: 0.35,
        },
        shareText: {
          color: '#FFFFFF',
          fontSize: FontSizes.sm,
          fontWeight: FontWeights.semibold,
          fontFamily: fonts.semibold,
        },
        imagePickerContainer: {
          width: SCREEN_WIDTH,
          aspectRatio: 1,
          backgroundColor: colors.background.tertiary,
        },
        selectedImage: {
          width: '100%',
          height: '100%',
        },
        imagePlaceholder: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.background.elevated,
        },
        imagePlaceholderText: {
          color: colors.text.tertiary,
          marginTop: Spacing.md,
          fontSize: FontSizes.sm,
          fontWeight: FontWeights.medium,
          fontFamily: fonts.medium,
        },
        captionSection: {
          flex: 1,
          padding: Spacing.lg,
        },
        captionInput: {
          flex: 1,
          color: colors.text.primary,
          fontSize: FontSizes.md,
          textAlignVertical: 'top',
          lineHeight: 22,
          fontFamily: fonts.regular,
        },
        characterCount: {
          color: colors.text.tertiary,
          fontSize: 12,
          textAlign: 'right',
          marginTop: Spacing.sm,
          fontFamily: fonts.regular,
        },
      }),
    [colors, fonts, shadows]
  );

  const feedListHeader = (
    <View
      style={[
        styles.feedHeader,
        {
          paddingTop: Platform.OS === 'android' ? 12 : 8,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <AppText style={styles.headerTitle}>Feed</AppText>
        <TouchableOpacity
          style={styles.headerCompose}
          onPress={() => setCreateModalVisible(true)}
          accessibilityLabel="New post"
        >
          <Ionicons name="add" size={24} color={colors.text.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary.default} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle={resolvedScheme === 'dark' ? 'light-content' : 'dark-content'}
        translucent
        backgroundColor="transparent"
      />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={feedListHeader}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Spacing.xxl + tabBarHeight },
            posts.length === 0 && styles.listContentEmpty,
          ]}
          renderItem={({ item }) => (
            <PostItem
              post={item}
              onLike={() => toggleLike.mutateAsync(item.id)}
              onComment={() => handleOpenComments(item.id)}
              onShare={() => handleShare(item)}
              styles={styles}
              colors={colors}
            />
          )}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={handleRefresh}
              tintColor={colors.primary.default}
              colors={[colors.primary.default]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="images-outline" size={64} color={colors.text.tertiary} />
              <AppText style={styles.emptyText}>No posts yet</AppText>
              <AppText style={styles.emptySubtext}>Share your first moment</AppText>
              <TouchableOpacity
                style={styles.createButton}
                onPress={() => setCreateModalVisible(true)}
              >
                <AppText style={styles.createButtonText}>New post</AppText>
              </TouchableOpacity>
            </View>
          }
        />
      </SafeAreaView>

      <CommentsModal
        visible={commentsModalVisible}
        onClose={() => setCommentsModalVisible(false)}
        postId={selectedPostId}
      />

      <Modal
          visible={createModalVisible}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => setCreateModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <StatusBar barStyle="light-content" />

            <View style={[styles.modalHeader, { paddingTop: insets.top + 8 }]}>
                <TouchableOpacity 
                  onPress={() => setCreateModalVisible(false)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={28} color={colors.text.primary} />
                </TouchableOpacity>
                <AppText style={styles.modalTitle}>New Post</AppText>
                <TouchableOpacity
                  onPress={handleCreatePost}
                  disabled={createPostMutation.isPending || (!caption.trim() && !selectedImage)}
                  style={[
                    styles.shareButton,
                    (createPostMutation.isPending || (!caption.trim() && !selectedImage)) &&
                      styles.shareButtonDisabled,
                  ]}
                >
                  <AppText style={styles.shareText}>
                    {createPostMutation.isPending ? 'Posting…' : 'Post'}
                  </AppText>
                </TouchableOpacity>
              </View>

            <TouchableOpacity 
              style={styles.imagePickerContainer} 
              onPress={pickImage}
              activeOpacity={0.9}
            >
              {selectedImage ? (
                <Image source={{ uri: selectedImage }} style={styles.selectedImage} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Ionicons name="image-outline" size={48} color={colors.text.tertiary} />
                  <AppText style={styles.imagePlaceholderText}>Tap to add a photo</AppText>
                </View>
              )}
            </TouchableOpacity>

            {/* Caption Input */}
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

