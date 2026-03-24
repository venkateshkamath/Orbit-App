/**
 * Chat Detail Screen - Individual conversation
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSizes, FontWeights, Spacing, BorderRadius, Shadows } from '../../constants/Colors';
import { Avatar, MessageBubble } from '../../src/components';
import { useChatStore, useAuthStore } from '../../src/stores';

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  const { 
    messages, 
    currentConversation, 
    isLoading, 
    isSending,
    fetchMessages, 
    sendMessage,
    markAsRead,
    setCurrentConversation 
  } = useChatStore();
  const { user } = useAuthStore();

  useEffect(() => {
    if (id) {
      fetchMessages(id);
      markAsRead(id);
    }
    
    return () => {
      setCurrentConversation(null);
    };
  }, [id]);

  const handleSend = async () => {
    if (!message.trim() || !id) return;
    
    const messageText = message.trim();
    setMessage('');
    
    await sendMessage(id, messageText);
    
    // Scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const otherUser = currentConversation?.other_participant;

  const renderMessage = useCallback(({ item, index }: { item: any; index: number }) => {
    const isOwn = item.sender.id === user?.id;
    return (
      <MessageBubble
        message={item}
        isOwn={isOwn}
      />
    );
  }, [user?.id]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.background.primary, Colors.background.secondary]}
        style={StyleSheet.absoluteFillObject}
      />

      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              // Avoid 'GO_BACK was not handled' when there is no history
              if (router.canGoBack && router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)/chat');
              }
            }}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
          </TouchableOpacity>

          {otherUser && (
            <TouchableOpacity style={styles.userInfo}>
              <Avatar
                uri={otherUser.avatar}
                name={otherUser.username}
                size={40}
                showOnline
                isOnline={otherUser.is_online}
              />
              <View style={styles.userDetails}>
                <Text style={styles.username}>{otherUser.username}</Text>
                <Text style={styles.status}>
                  {otherUser.is_online ? 'Online' : 'Offline'}
                  {isTyping && ' • Typing...'}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.moreButton}>
            <Ionicons name="ellipsis-vertical" size={20} color={Colors.text.primary} />
          </TouchableOpacity>
        </View>

        {/* Messages */}
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={insets.top}
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary.default} />
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              contentContainerStyle={styles.messagesList}
              showsVerticalScrollIndicator={false}
              inverted={false}
              onContentSizeChange={() => {
                flatListRef.current?.scrollToEnd({ animated: false });
              }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    Say hello! 👋
                  </Text>
                </View>
              }
            />
          )}

          {/* Input Area */}
          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <TouchableOpacity style={styles.attachButton}>
                <Ionicons name="add" size={24} color={Colors.text.tertiary} />
              </TouchableOpacity>

              <TextInput
                style={styles.textInput}
                placeholder="Type a message..."
                placeholderTextColor={Colors.text.muted}
                value={message}
                onChangeText={setMessage}
                multiline
                maxLength={1000}
              />

              <TouchableOpacity style={styles.emojiButton}>
                <Ionicons name="happy-outline" size={24} color={Colors.text.tertiary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                styles.sendButton,
                !message.trim() && styles.sendButtonDisabled,
              ]}
              onPress={handleSend}
              disabled={!message.trim() || isSending}
            >
              {isSending ? (
                <ActivityIndicator size="small" color={Colors.text.primary} />
              ) : (
                <LinearGradient
                  colors={
                    message.trim()
                      ? [Colors.primary.start, Colors.primary.end]
                      : [Colors.background.tertiary, Colors.background.tertiary]
                  }
                  style={styles.sendGradient}
                >
                  <Ionicons
                    name="send"
                    size={20}
                    color={message.trim() ? Colors.text.primary : Colors.text.muted}
                  />
                </LinearGradient>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background.primary + 'E6',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: Spacing.xs,
  },
  userDetails: {
    marginLeft: Spacing.sm,
  },
  username: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    color: Colors.text.primary,
  },
  status: {
    fontSize: FontSizes.xs,
    color: Colors.text.secondary,
  },
  moreButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyboardView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    paddingVertical: Spacing.md,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  emptyText: {
    fontSize: FontSizes.lg,
    color: Colors.text.tertiary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingBottom: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background.primary,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: Colors.background.tertiary,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.xs,
    marginRight: Spacing.sm,
    minHeight: 44,
    maxHeight: 120,
  },
  attachButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    fontSize: FontSizes.md,
    color: Colors.text.primary,
    paddingVertical: Platform.OS === 'ios' ? Spacing.sm : Spacing.xs,
    paddingHorizontal: Spacing.xs,
    maxHeight: 100,
  },
  emojiButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendGradient: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
