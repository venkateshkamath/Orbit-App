import React, { useState } from 'react';
import {
  View,
  Text,
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
import { Colors, FontSizes, FontWeights, Spacing, BorderRadius } from '../../constants/Colors';
import { Avatar } from './Avatar';
import { useAddCommentMutation, usePostCommentsQuery } from '../hooks/useOrbitApi';
import { Comment } from '../types';

interface CommentsModalProps {
  visible: boolean;
  onClose: () => void;
  postId: string | null;
}

export const CommentsModal: React.FC<CommentsModalProps> = ({ visible, onClose, postId }) => {
  const [newComment, setNewComment] = useState('');
  const { data: comments = [], isLoading: loading } = usePostCommentsQuery(postId, visible);
  const addComment = useAddCommentMutation();

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
          <Text style={styles.commentUser}>{item.author.username}</Text>
          <Text style={styles.commentTime}>
            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
          </Text>
        </View>
        <Text style={styles.commentText}>{item.text}</Text>
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
            <Ionicons name="chevron-down" size={28} color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Comments</Text>
          <View style={{ width: 40 }} />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary.default} />
          </View>
        ) : (
          <FlatList
            data={comments}
            renderItem={renderComment}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubble-outline" size={48} color={Colors.text.tertiary} />
                <Text style={styles.emptyText}>No comments yet</Text>
                <Text style={styles.emptySubtext}>Be the first to share your thoughts!</Text>
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
              placeholderTextColor={Colors.text.tertiary}
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
                (!newComment.trim() || addComment.isPending) && styles.postButtonDisabled
              ]}
            >
              {addComment.isPending ? (
                <ActivityIndicator size="small" color={Colors.primary.default} />
              ) : (
                <Text style={styles.postButtonText}>Post</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    color: Colors.text.primary,
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
    color: Colors.text.primary,
    marginRight: Spacing.xs,
  },
  commentTime: {
    fontSize: 10,
    color: Colors.text.tertiary,
  },
  commentText: {
    fontSize: FontSizes.sm,
    color: Colors.text.primary,
    lineHeight: 18,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background.primary,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.text.primary,
    fontSize: FontSizes.md,
    marginRight: Spacing.sm,
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
    color: Colors.primary.default,
    fontWeight: FontWeights.bold,
    fontSize: FontSizes.md,
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
    color: Colors.text.primary,
    marginTop: Spacing.md,
  },
  emptySubtext: {
    fontSize: FontSizes.sm,
    color: Colors.text.tertiary,
    marginTop: 4,
  },
});
