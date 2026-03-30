import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { FontSizes, FontWeights, Spacing, BorderRadius } from '../../constants/Colors';
import { useOrbitTheme } from '../theme';
import { AppText } from '../ui/AppText';
import { Avatar } from './Avatar';
import { useAddCommentMutation, usePostCommentsQuery } from '../hooks/useOrbitApi';
import { Comment } from '../types';

interface CommentsModalProps {
  visible: boolean;
  onClose: () => void;
  postId: string | null;
}

export const CommentsModal: React.FC<CommentsModalProps> = ({ visible, onClose, postId }) => {
  const { colors, fonts } = useOrbitTheme();
  const [newComment, setNewComment] = useState('');
  const { data: comments = [], isLoading: loading } = usePostCommentsQuery(postId, visible);
  const addComment = useAddCommentMutation();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background.primary,
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.sm,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        closeButton: {
          padding: 4,
        },
        headerTitle: {
          fontSize: FontSizes.lg,
          fontWeight: FontWeights.bold,
          color: colors.text.primary,
          fontFamily: fonts.bold,
        },
        listContent: {
          padding: Spacing.md,
          paddingBottom: Spacing.xxl,
        },
        commentItem: {
          flexDirection: 'row',
          marginBottom: Spacing.lg,
        },
        commentContent: {
          flex: 1,
          marginLeft: Spacing.sm,
        },
        commentHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 2,
        },
        commentUser: {
          fontSize: FontSizes.sm,
          fontWeight: FontWeights.bold,
          color: colors.text.primary,
          marginRight: Spacing.xs,
          fontFamily: fonts.bold,
        },
        commentTime: {
          fontSize: 10,
          color: colors.text.tertiary,
          fontFamily: fonts.regular,
        },
        commentText: {
          fontSize: FontSizes.sm,
          color: colors.text.primary,
          lineHeight: 18,
          fontFamily: fonts.regular,
        },
        inputContainer: {
          flexDirection: 'row',
          alignItems: 'flex-end',
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.sm,
          borderTopWidth: 0.5,
          borderTopColor: colors.border,
          backgroundColor: colors.background.primary,
        },
        input: {
          flex: 1,
          minHeight: 40,
          maxHeight: 100,
          backgroundColor: colors.background.secondary,
          borderRadius: BorderRadius.lg,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.sm,
          color: colors.text.primary,
          fontSize: FontSizes.md,
          marginRight: Spacing.sm,
          fontFamily: fonts.regular,
        },
        postButton: {
          height: 40,
          justifyContent: 'center',
          paddingHorizontal: Spacing.sm,
        },
        postButtonDisabled: {
          opacity: 0.5,
        },
        postButtonText: {
          color: colors.primary.default,
          fontWeight: FontWeights.bold,
          fontSize: FontSizes.md,
          fontFamily: fonts.bold,
        },
        loadingContainer: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
        },
        emptyContainer: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: 100,
        },
        emptyText: {
          fontSize: FontSizes.lg,
          fontWeight: FontWeights.bold,
          color: colors.text.primary,
          marginTop: Spacing.md,
          fontFamily: fonts.bold,
        },
        emptySubtext: {
          fontSize: FontSizes.sm,
          color: colors.text.tertiary,
          marginTop: 4,
          fontFamily: fonts.regular,
        },
      }),
    [colors, fonts]
  );

  const handleAddComment = async () => {
    if (!postId || !newComment.trim() || addComment.isPending) return;

    try {
      await addComment.mutateAsync({ postId, text: newComment.trim() });
      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const renderComment = ({ item }: { item: Comment }) => (
    <View style={styles.commentItem}>
      <Avatar uri={item.author.avatar} name={item.author.username} size={32} />
      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <AppText style={styles.commentUser}>{item.author.username}</AppText>
          <AppText style={styles.commentTime}>
            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
          </AppText>
        </View>
        <AppText style={styles.commentText}>{item.text}</AppText>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="chevron-down" size={28} color={colors.text.primary} />
          </TouchableOpacity>
          <AppText style={styles.headerTitle}>Comments</AppText>
          <View style={{ width: 40 }} />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary.default} />
          </View>
        ) : (
          <FlatList
            data={comments}
            renderItem={renderComment}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubble-outline" size={48} color={colors.text.tertiary} />
                <AppText style={styles.emptyText}>No comments yet</AppText>
                <AppText style={styles.emptySubtext}>Be the first to share your thoughts!</AppText>
              </View>
            }
          />
        )}

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Add a comment..."
              placeholderTextColor={colors.text.tertiary}
              value={newComment}
              onChangeText={setNewComment}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              onPress={handleAddComment}
              disabled={!newComment.trim() || addComment.isPending}
              style={[
                styles.postButton,
                (!newComment.trim() || addComment.isPending) && styles.postButtonDisabled,
              ]}
            >
              {addComment.isPending ? (
                <ActivityIndicator size="small" color={colors.primary.default} />
              ) : (
                <AppText style={styles.postButtonText}>Post</AppText>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};
