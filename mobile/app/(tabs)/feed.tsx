/**
 * Feed Tab — card-based posts (editorial layout)
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { Colors, FontSizes, FontWeights, Spacing, BorderRadius } from '../../constants/Colors';
import { Avatar, CommentsModal } from '../../src/components';
import { useCreatePostMutation, useFeedQuery, useToggleLikeMutation } from '../../src/hooks/useOrbitApi';
import { Post } from '../../src/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function PostItem({ 
  post, 
  onLike, 
  onComment,
  onShare
}: { 
  post: Post; 
  onLike: () => Promise<unknown>;
  onComment: () => void;
  onShare: () => void;
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
            <Text style={styles.username}>{post.author.username}</Text>
            {post.location_name && (
              <Text style={styles.locationText}>{post.location_name}</Text>
            )}
          </View>
        </View>
        <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="ellipsis-horizontal" size={18} color={Colors.text.tertiary} />
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
              color={isLiked ? Colors.error : Colors.text.secondary}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={onComment} style={styles.actionButton}>
            <Ionicons name="chatbubble-outline" size={22} color={Colors.text.secondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onShare} style={styles.actionButton}>
            <Ionicons name="share-outline" size={22} color={Colors.text.secondary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.postContent}>
        {likeCount > 0 && (
          <Text style={styles.likesText}>{likeCount.toLocaleString()} likes</Text>
        )}
        
        {post.caption && (
          <View style={styles.captionContainer}>
            <Text style={styles.captionText}>
              <Text style={styles.usernameInline}>{post.author.username}</Text> {post.caption}
            </Text>
          </View>
        )}

        {post.comment_count >= 0 && (
          <TouchableOpacity onPress={onComment}>
            <Text style={styles.viewComments}>
              {post.comment_count === 0 
                ? 'Add a comment...' 
                : `View all ${post.comment_count} comments`}
            </Text>
          </TouchableOpacity>
        )}

        <Text style={styles.timestamp}>
          {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
        </Text>
      </View>
    </View>
  );
}

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
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

  const feedListHeader = (
    <View
      style={[
        styles.feedHeader,
        {
          paddingTop:
            insets.top + (Platform.OS === 'android' ? 6 : 8),
        },
      ]}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerKicker}>Community</Text>
          <Text style={styles.headerTitle}>Feed</Text>
        </View>
        <TouchableOpacity
          style={styles.headerCompose}
          onPress={() => setCreateModalVisible(true)}
          accessibilityLabel="New post"
        >
          <Ionicons name="add" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary.default} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={feedListHeader}
        contentContainerStyle={[
          styles.listContent,
          posts.length === 0 && styles.listContentEmpty,
        ]}
        renderItem={({ item }) => (
          <PostItem
            post={item}
            onLike={() => toggleLike.mutateAsync(item.id)}
            onComment={() => handleOpenComments(item.id)}
            onShare={() => handleShare(item)}
          />
        )}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor={Colors.primary.default}
            colors={[Colors.primary.default]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="images-outline" size={64} color={Colors.text.tertiary} />
            <Text style={styles.emptyText}>No posts yet</Text>
            <Text style={styles.emptySubtext}>Share your first moment</Text>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => setCreateModalVisible(true)}
            >
              <Text style={styles.createButtonText}>New post</Text>
            </TouchableOpacity>
          </View>
        }
      />

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
                  <Ionicons name="close" size={28} color={Colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>New Post</Text>
                <TouchableOpacity
                  onPress={handleCreatePost}
                  disabled={createPostMutation.isPending || (!caption.trim() && !selectedImage)}
                  style={[
                    styles.shareButton,
                    (createPostMutation.isPending || (!caption.trim() && !selectedImage)) &&
                      styles.shareButtonDisabled,
                  ]}
                >
                  <Text style={styles.shareText}>
                    {createPostMutation.isPending ? 'Posting…' : 'Post'}
                  </Text>
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
                  <Ionicons name="image-outline" size={48} color={Colors.text.tertiary} />
                  <Text style={styles.imagePlaceholderText}>Tap to add a photo</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Caption Input */}
            <View style={styles.captionSection}>
              <TextInput
                style={styles.captionInput}
                placeholder="Write a caption..."
                placeholderTextColor={Colors.text.tertiary}
                multiline
                value={caption}
                onChangeText={setCaption}
                maxLength={2200}
              />
              <Text style={styles.characterCount}>{caption.length}/2200</Text>
            </View>
          </View>
        </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  listContent: {
    paddingBottom: Spacing.xxl,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background.primary,
  },
  feedHeader: {
    backgroundColor: Colors.background.primary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Platform.OS === 'android' ? 10 : 12,
  },
  headerKicker: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text.tertiary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: -0.4,
  },
  headerCompose: {
    width: Platform.OS === 'android' ? 40 : 44,
    height: Platform.OS === 'android' ? 40 : 44,
    borderRadius: 22,
    backgroundColor: Colors.background.elevated,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postCard: {
    width: SCREEN_WIDTH,
    backgroundColor: Colors.background.primary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    paddingBottom: Spacing.sm,
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
    color: Colors.text.primary,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
  },
  locationText: {
    color: Colors.text.secondary,
    fontSize: 11,
    marginTop: 1,
  },
  postImage: {
    width: SCREEN_WIDTH,
    aspectRatio: 1,
    backgroundColor: Colors.background.secondary,
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
    color: Colors.text.secondary,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
    marginBottom: 6,
  },
  captionContainer: {
    marginBottom: 4,
  },
  captionText: {
    color: Colors.text.primary,
    fontSize: FontSizes.sm,
    lineHeight: 18,
  },
  usernameInline: {
    fontWeight: FontWeights.semibold,
  },
  viewComments: {
    color: Colors.text.tertiary,
    fontSize: FontSizes.sm,
    marginTop: 4,
    marginBottom: 4,
  },
  timestamp: {
    color: Colors.text.muted,
    fontSize: FontSizes.xs,
    marginTop: 6,
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
    color: Colors.text.primary,
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    marginTop: Spacing.lg,
  },
  emptySubtext: {
    color: Colors.text.secondary,
    fontSize: FontSizes.md,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  createButton: {
    marginTop: Spacing.xl,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primary.default,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  createButtonText: {
    color: Colors.text.primary,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
  },
  
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
    color: Colors.text.primary,
  },
  shareButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary.default,
  },
  shareButtonDisabled: {
    opacity: 0.35,
  },
  shareText: {
    color: Colors.text.primary,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
  },
  imagePickerContainer: {
    width: SCREEN_WIDTH,
    aspectRatio: 1,
    backgroundColor: Colors.background.tertiary,
  },
  selectedImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background.elevated,
  },
  imagePlaceholderText: {
    color: Colors.text.tertiary,
    marginTop: Spacing.md,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
  },
  captionSection: {
    flex: 1,
    padding: Spacing.lg,
  },
  captionInput: {
    flex: 1,
    color: Colors.text.primary,
    fontSize: FontSizes.md,
    textAlignVertical: 'top',
    lineHeight: 22,
  },
  characterCount: {
    color: Colors.text.tertiary,
    fontSize: 12,
    textAlign: 'right',
    marginTop: Spacing.sm,
  },
});
