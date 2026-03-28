/**
 * Feed Tab - Instagram-inspired clean design
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
  SafeAreaView,
  RefreshControl,
  Dimensions,
  Modal,
  TextInput,
  Alert,
  Platform,
  StatusBar,
  Share,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
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
      {/* Post Header */}
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
          <Ionicons name="ellipsis-horizontal" size={20} color={Colors.text.primary} />
        </TouchableOpacity>
      </View>

      {/* Post Image */}
      {post.image_url && (
        <Image
          source={{ uri: post.image_url }}
          style={styles.postImage}
          resizeMode="cover"
        />
      )}

      {/* Post Actions */}
      <View style={styles.postActions}>
        <View style={styles.actionRow}>
          <TouchableOpacity onPress={handleLike} style={styles.actionButton}>
            <Ionicons
              name={isLiked ? "heart" : "heart-outline"}
              size={26}
              color={isLiked ? "#EF4444" : Colors.text.primary}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={onComment} style={styles.actionButton}>
            <Ionicons name="chatbubble-outline" size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onShare} style={styles.actionButton}>
            <Ionicons name="paper-plane-outline" size={24} color={Colors.text.primary} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity>
          <Ionicons name="bookmark-outline" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
      </View>

      {/* Post Content */}
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
          {formatDistanceToNow(new Date(post.created_at), { addSuffix: true }).toUpperCase()}
        </Text>
      </View>
    </View>
  );
}

export default function FeedScreen() {
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

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary.default} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>ORBIT</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={styles.headerIcon}
              onPress={() => setCreateModalVisible(true)}
            >
              <Ionicons name="add-circle-outline" size={28} color={Colors.text.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerIcon}>
              <Ionicons name="heart-outline" size={28} color={Colors.text.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
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
                <LinearGradient
                  colors={[Colors.primary.start, Colors.primary.end]}
                  style={styles.createButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.createButtonText}>Create Post</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          }
        />

        {/* Comments Modal */}
        <CommentsModal
          visible={commentsModalVisible}
          onClose={() => setCommentsModalVisible(false)}
          postId={selectedPostId}
        />

        {/* Create Post Modal - Instagram Style */}
        <Modal
          visible={createModalVisible}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => setCreateModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <StatusBar barStyle="dark-content" />
            
            {/* Modal Header */}
            <SafeAreaView>
              <View style={styles.modalHeader}>
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
                >
                  <LinearGradient
                    colors={[Colors.primary.start, Colors.primary.end]}
                    style={[
                      styles.shareButton,
                      (createPostMutation.isPending || (!caption.trim() && !selectedImage)) && styles.shareButtonDisabled
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.shareText}>
                      {createPostMutation.isPending ? 'Posting...' : 'Share'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </SafeAreaView>

            {/* Image Preview */}
            <TouchableOpacity 
              style={styles.imagePickerContainer} 
              onPress={pickImage}
              activeOpacity={0.9}
            >
              {selectedImage ? (
                <Image source={{ uri: selectedImage }} style={styles.selectedImage} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <LinearGradient
                    colors={['#F0FDF4', '#DCFCE7']}
                    style={styles.placeholderGradient}
                  >
                    <Ionicons name="image-outline" size={56} color={Colors.primary.default} />
                    <Text style={styles.imagePlaceholderText}>Tap to add photo</Text>
                  </LinearGradient>
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
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background.primary,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  headerIcon: {
    padding: 4,
  },
  postCard: {
    marginBottom: Spacing.sm,
    backgroundColor: Colors.background.card,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
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
    height: SCREEN_WIDTH,
    backgroundColor: Colors.background.tertiary,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
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
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  likesText: {
    color: Colors.text.primary,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
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
    color: Colors.text.tertiary,
    fontSize: 10,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 120,
    paddingHorizontal: Spacing.xxl,
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
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  createButtonGradient: {
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  createButtonText: {
    color: 'white',
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
    paddingVertical: Spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
    color: Colors.text.primary,
  },
  shareButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
  },
  shareButtonDisabled: {
    opacity: 0.4,
  },
  shareText: {
    color: 'white',
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
  },
  imagePickerContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
    backgroundColor: Colors.background.secondary,
  },
  selectedImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
  },
  placeholderGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: {
    color: Colors.primary.default,
    marginTop: Spacing.md,
    fontSize: FontSizes.md,
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
