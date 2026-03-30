/**
 * Chat Detail Screen - Individual conversation
 */

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontSizes, FontWeights, Spacing, BorderRadius } from '../../constants/Colors';
import { useOrbitTheme } from '../../src/theme';
import { Avatar, MessageBubble } from '../../src/components';
import { AppText } from '../../src/ui/AppText';
import {
  useConversationQuery,
  useClearConversationMutation,
  useBlockConversationMutation,
  useUnblockConversationMutation,
  useDeleteMessageMutation,
  useMarkReadMutation,
  useMessagesQuery,
  useSendMessageMutation,
} from '../../src/hooks/useOrbitApi';
import { useAuthStore } from '../../src/stores';

const BOTTOM_THRESHOLD_PX = 80;

export default function ChatDetailScreen() {
  const { colors, fonts } = useOrbitTheme();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const [menuVisible, setMenuVisible] = useState(false);
  
  const [message, setMessage] = useState('');

  const { data: conversation } = useConversationQuery(id);
  const { data: messagesData, isPending } = useMessagesQuery(id);
  const messages = messagesData ?? [];
  /** Only block the thread on first load — not on background refetch (avoids “reload” flash). */
  const showThreadLoader = Boolean(id) && isPending && messages.length === 0;
  const sendMut = useSendMessageMutation();
  const clearMut = useClearConversationMutation();
  const blockMut = useBlockConversationMutation();
  const unblockMut = useUnblockConversationMutation();
  const deleteMsgMut = useDeleteMessageMutation();
  const markRead = useMarkReadMutation();
  const { user } = useAuthStore();
  const isConversationBlocked = Boolean(conversation?.is_blocked);
  const blockedByMe = Boolean(conversation?.blocked_by_me);
  const blockedByOther = Boolean(conversation?.blocked_by_other);

  useEffect(() => {
    if (id) {
      markRead.mutate(id);
    }
  }, [id]);

  const scrollToLatest = useCallback(
    (animated = true) => {
      flatListRef.current?.scrollToEnd({ animated });
      setIsNearBottom(true);
      setNewMessagesCount(0);
      if (id) {
        markRead.mutate(id);
      }
    },
    [id, markRead]
  );

  const handleListScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
      const distanceFromBottom =
        contentSize.height - (layoutMeasurement.height + contentOffset.y);
      const nearBottom = distanceFromBottom <= BOTTOM_THRESHOLD_PX;
      setIsNearBottom(nearBottom);
      if (nearBottom && newMessagesCount > 0) {
        setNewMessagesCount(0);
        if (id) {
          markRead.mutate(id);
        }
      }
    },
    [id, markRead, newMessagesCount]
  );

  useEffect(() => {
    if (!messages.length) {
      lastMessageIdRef.current = null;
      setNewMessagesCount(0);
      return;
    }

    const latest = messages[messages.length - 1];
    const latestId = latest?.id ? String(latest.id) : null;
    if (!latestId) return;

    if (!lastMessageIdRef.current) {
      lastMessageIdRef.current = latestId;
      requestAnimationFrame(() => scrollToLatest(false));
      return;
    }

    if (lastMessageIdRef.current === latestId) {
      return;
    }

    lastMessageIdRef.current = latestId;
    const isOwnMessage = String(latest?.sender?.id || '') === String(user?.id || '');

    if (isNearBottom || isOwnMessage) {
      requestAnimationFrame(() => scrollToLatest(true));
      return;
    }

    setNewMessagesCount((prev) => prev + 1);
  }, [id, isNearBottom, messages, scrollToLatest, user?.id]);

  const handleSend = async () => {
    if (!message.trim() || !id || isConversationBlocked) return;
    
    const messageText = message.trim();
    setMessage('');
    
    try {
      await sendMut.mutateAsync({ conversationId: id, content: messageText });
      requestAnimationFrame(() => scrollToLatest(true));
    } catch {
      setMessage(messageText);
      Alert.alert('Unable to send', 'This chat is read-only right now.');
    }
  };

  const confirmClearChat = useCallback(() => {
    if (!id) return;
    Alert.alert(
      'Clear chat?',
      'This chat will be deleted for both sides.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear chat',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await clearMut.mutateAsync(id);
                setNewMessagesCount(0);
                Alert.alert('Chat cleared', 'Messages were deleted for both users.');
              } catch {
                Alert.alert('Could not clear chat', 'Please try again.');
              }
            })();
          },
        },
      ],
      { cancelable: true }
    );
  }, [clearMut, id]);

  const confirmBlockUser = useCallback(() => {
    if (!id) return;
    Alert.alert(
      'Block this user?',
      'They will not be able to send messages in this chat.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block user',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await blockMut.mutateAsync(id);
                Alert.alert('User blocked', 'This chat is now read-only.');
              } catch {
                Alert.alert('Could not block user', 'Please try again.');
              }
            })();
          },
        },
      ],
      { cancelable: true }
    );
  }, [blockMut, id]);

  const confirmUnblockUser = useCallback(() => {
    if (!id) return;
    Alert.alert(
      'Unblock this user?',
      'You will be able to send messages again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: () => {
            void (async () => {
              try {
                await unblockMut.mutateAsync(id);
                Alert.alert('User unblocked', 'You can send messages now.');
              } catch {
                Alert.alert('Could not unblock user', 'Please try again.');
              }
            })();
          },
        },
      ],
      { cancelable: true }
    );
  }, [id, unblockMut]);

  const openChatMenu = useCallback(() => {
    setMenuVisible(true);
  }, []);
  const closeChatMenu = useCallback(() => {
    setMenuVisible(false);
  }, []);

  const otherUser = conversation?.other_participant;

  const handleDeleteMessage = useCallback(
    (messageId: string) => {
      if (!id) return;
      deleteMsgMut.mutate({ messageId, conversationId: id });
    },
    [id, deleteMsgMut]
  );

  const renderMessage = useCallback(({ item }: { item: any }) => {
    const isOwn = item.sender.id === user?.id;
    return (
      <MessageBubble
        message={item}
        isOwn={isOwn}
        onDelete={isOwn ? handleDeleteMessage : undefined}
      />
    );
  }, [user?.id, handleDeleteMessage]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
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
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          backgroundColor: colors.background.primary,
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
          color: colors.text.primary,
          fontFamily: fonts.semibold,
        },
        status: {
          fontSize: FontSizes.xs,
          color: colors.text.secondary,
          fontFamily: fonts.regular,
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
          color: colors.text.tertiary,
          fontFamily: fonts.regular,
        },
        inputContainer: {
          flexDirection: 'row',
          alignItems: 'flex-end',
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.sm,
          paddingBottom: Spacing.md,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          backgroundColor: colors.background.primary,
        },
        inputWrapper: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'flex-end',
          backgroundColor: colors.background.tertiary,
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
          color: colors.text.primary,
          paddingVertical: Platform.OS === 'ios' ? Spacing.sm : Spacing.xs,
          paddingHorizontal: Spacing.xs,
          maxHeight: 100,
          fontFamily: fonts.regular,
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
          alignItems: 'center',
          justifyContent: 'center',
        },
        sendCircle: {
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primary.default,
        },
        sendCircleDisabled: {
          backgroundColor: colors.background.tertiary,
        },
        sendCircleSending: {
          opacity: 0.75,
        },
        jumpToLatestWrap: {
          position: 'absolute',
          right: Spacing.md,
          bottom: Spacing.md,
          zIndex: 10,
        },
        jumpToLatestButton: {
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: 999,
          paddingHorizontal: Spacing.sm,
          paddingVertical: Spacing.xs,
          backgroundColor: colors.primary.default,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.18,
          shadowRadius: 4,
          elevation: 3,
          gap: 6,
        },
        jumpToLatestButtonIdle: {
          backgroundColor: colors.background.tertiary,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        jumpToLatestText: {
          fontSize: FontSizes.sm,
          fontWeight: FontWeights.semibold,
          color: colors.text.primary,
          fontFamily: fonts.semibold,
        },
        blockedBanner: {
          marginHorizontal: Spacing.md,
          marginBottom: Spacing.sm,
          marginTop: Spacing.xs,
          borderRadius: BorderRadius.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          backgroundColor: colors.background.tertiary,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacing.xs,
        },
        blockedBannerText: {
          flex: 1,
          color: colors.text.secondary,
          fontSize: FontSizes.sm,
          fontWeight: FontWeights.medium,
          fontFamily: fonts.medium,
        },
        blockedBannerAction: {
          marginLeft: Spacing.sm,
          paddingHorizontal: Spacing.sm,
          paddingVertical: Spacing.xs,
          borderRadius: BorderRadius.full,
          backgroundColor: colors.primary.default,
        },
        blockedBannerActionText: {
          color: colors.text.primary,
          fontSize: FontSizes.xs,
          fontWeight: FontWeights.semibold,
          fontFamily: fonts.semibold,
        },
        menuBackdrop: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.25)',
        },
        menuContainer: {
          position: 'absolute',
          top: insets.top + 52,
          right: Spacing.md,
          minWidth: 180,
          backgroundColor: colors.background.primary,
          borderRadius: BorderRadius.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
          elevation: 7,
        },
        menuItem: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacing.xs,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.sm,
        },
        menuItemText: {
          color: colors.text.primary,
          fontSize: FontSizes.sm,
          fontWeight: FontWeights.medium,
          fontFamily: fonts.medium,
        },
        menuDivider: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.border,
        },
        destructiveText: {
          color: colors.error,
        },
      }),
    [colors, fonts, insets.top]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background.primary }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
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
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>

          {otherUser && (
            <TouchableOpacity
              style={styles.userInfo}
              onPress={() => {
                if (otherUser.id) {
                  router.push(`/user/${otherUser.id}`);
                }
              }}
              activeOpacity={0.7}
            >
              <Avatar
                uri={otherUser.avatar}
                name={otherUser.username}
                size={40}
                showOnline
                isOnline={otherUser.is_online}
              />
              <View style={styles.userDetails}>
                <AppText style={styles.username}>{otherUser.username}</AppText>
                <AppText style={styles.status}>
                  {otherUser.is_online ? 'Online' : 'Offline'}
                </AppText>
              </View>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.moreButton}
            onPress={openChatMenu}
            disabled={clearMut.isPending || blockMut.isPending || unblockMut.isPending}
          >
            <Ionicons name="ellipsis-vertical" size={20} color={colors.text.primary} />
          </TouchableOpacity>
        </View>

        {/* Messages */}
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={insets.top}
        >
          {showThreadLoader ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary.default} />
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item.id}
                renderItem={renderMessage}
                contentContainerStyle={styles.messagesList}
                showsVerticalScrollIndicator={false}
                inverted={false}
                onScroll={handleListScroll}
                scrollEventThrottle={16}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <AppText style={styles.emptyText}>
                      Say hello! 👋
                    </AppText>
                  </View>
                }
              />
              {!isNearBottom ? (
                <View style={styles.jumpToLatestWrap}>
                  <TouchableOpacity
                    style={[
                      styles.jumpToLatestButton,
                      newMessagesCount === 0 && styles.jumpToLatestButtonIdle,
                    ]}
                    onPress={() => scrollToLatest(true)}
                    activeOpacity={0.9}
                  >
                    <Ionicons name="arrow-down" size={16} color={colors.text.primary} />
                    <AppText style={styles.jumpToLatestText}>
                      {newMessagesCount === 0
                        ? 'Latest'
                        : newMessagesCount === 1
                          ? 'New message'
                          : `${newMessagesCount} new messages`}
                    </AppText>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          )}

          {isConversationBlocked ? (
            <View style={styles.blockedBanner}>
              <Ionicons name="lock-closed-outline" size={16} color={colors.text.secondary} />
              <AppText style={styles.blockedBannerText}>
                {blockedByOther
                  ? 'You are blocked and cannot send messages.'
                  : 'You blocked this user. This chat is read-only.'}
              </AppText>
              {blockedByMe ? (
                <TouchableOpacity
                  style={styles.blockedBannerAction}
                  onPress={confirmUnblockUser}
                  disabled={unblockMut.isPending}
                >
                  <AppText style={styles.blockedBannerActionText}>
                    {unblockMut.isPending ? 'Unblocking...' : 'Unblock'}
                  </AppText>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            /* Input Area */
            <View style={styles.inputContainer}>
              <View style={styles.inputWrapper}>
                <TouchableOpacity style={styles.attachButton}>
                  <Ionicons name="add" size={24} color={colors.text.tertiary} />
                </TouchableOpacity>

                <TextInput
                  style={styles.textInput}
                  placeholder="Type a message..."
                  placeholderTextColor={colors.text.muted}
                  value={message}
                  onChangeText={setMessage}
                  multiline
                  maxLength={1000}
                />

                <TouchableOpacity style={styles.emojiButton}>
                  <Ionicons name="happy-outline" size={24} color={colors.text.tertiary} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.sendButton}
                onPress={handleSend}
                disabled={!message.trim() || sendMut.isPending}
                activeOpacity={0.85}
              >
                <View
                  style={[
                    styles.sendCircle,
                    !message.trim() && styles.sendCircleDisabled,
                    sendMut.isPending && styles.sendCircleSending,
                  ]}
                >
                  <Ionicons
                    name="send"
                    size={20}
                    color={
                      message.trim() && !sendMut.isPending
                        ? colors.text.primary
                        : colors.text.muted
                    }
                  />
                </View>
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={closeChatMenu}>
        <Pressable style={styles.menuBackdrop} onPress={closeChatMenu}>
          <Pressable style={styles.menuContainer} onPress={() => {}}>
            {blockedByMe ? (
              <>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    closeChatMenu();
                    confirmUnblockUser();
                  }}
                  disabled={unblockMut.isPending}
                >
                  <Ionicons name="lock-open-outline" size={18} color={colors.text.primary} />
                  <AppText style={styles.menuItemText}>Unblock user</AppText>
                </TouchableOpacity>
                <View style={styles.menuDivider} />
              </>
            ) : null}
            {!blockedByOther && !blockedByMe ? (
              <>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    closeChatMenu();
                    confirmBlockUser();
                  }}
                  disabled={blockMut.isPending}
                >
                  <Ionicons name="ban-outline" size={18} color={colors.error} />
                  <AppText style={[styles.menuItemText, styles.destructiveText]}>Block user</AppText>
                </TouchableOpacity>
                <View style={styles.menuDivider} />
              </>
            ) : null}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                closeChatMenu();
                confirmClearChat();
              }}
              disabled={clearMut.isPending}
            >
              <Ionicons name="trash-outline" size={18} color={colors.error} />
              <AppText style={[styles.menuItemText, styles.destructiveText]}>Clear chat</AppText>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
